#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RainCough 插件后端 SDK (interface_version=1, 无第三方依赖)。

职责(与主系统 contract 一一对应):
  - 连接传输层(unix socket 生产 / tcp loopback 开发)
  - register / heartbeat / unregister 自动执行
  - 接口路由表: @rc.interface("plugin.method") 注册处理器
  - 跨插件调用: rc.call("other.iface", params)
  - 统一日志写 .runtime.log

用法(插件 server.py):
    import rcplugin as rc

    @rc.interface("demo.ping")
    def ping(params):
        return {"pong": True}

    @rc.interface("demo.echo")
    def echo(params):
        return {"echo": params}

    if __name__ == "__main__":
        rc.serve(endpoint=os.environ.get("RC_ENDPOINT", ""),   # unix:/path 或 tcp:127.0.0.1:port
                 name="demo", version="1.0.0",
                 manifest={"label": "接口演示"},
                 frontend={"pages": [{"path": "", "title": "接口演示"}]},
                 iface_ids=["demo.ping", "demo.echo"])
"""
import json
import os
import socket
import sys
import threading
import time

PROTOCOL_VERSION = 1
MAX_RECONNECT = 30.0  # 退避封顶秒
READ_TIMEOUT = 20.0


class RCError(Exception):
    """RPC 层错误(携带 code)。"""

    def __init__(self, code, message, data=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data


class _Conn:
    """单条传输连接: 读循环 + 写锁 + 同步请求/响应。"""

    def __init__(self, endpoint, timeout=READ_TIMEOUT):
        if endpoint.startswith("unix:"):
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.connect(endpoint[len("unix:"):])
        elif endpoint.startswith("tcp:"):
            host, port = endpoint[len("tcp:"):].rsplit(":", 1)
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((host, int(port)))
        else:
            raise RCError(-32602, "endpoint 必须为 unix:/path 或 tcp:host:port")
        sock.settimeout(timeout)
        self.sock = sock
        self.wlock = threading.Lock()
        self.rlock = threading.Lock()
        self.buf = b""
        self._seq = 0
        self._pending = {}  # id -> [Event, slot]

    # ---- 发送 ----
    def send(self, method, params):
        with self.wlock:
            self._seq += 1
            mid = self._seq
            self.sock.sendall((json.dumps({
                "jsonrpc": "2.0", "id": mid, "method": method, "params": params
            }) + "\n").encode("utf-8"))
        return mid

    def send_raw(self, obj):
        with self.wlock:
            self.sock.sendall((json.dumps(obj) + "\n").encode("utf-8"))

    def request(self, method, params, timeout=15.0):
        """同步请求, 等待 reader 线程填充响应。"""
        evt = threading.Event()
        slot = {}
        mid = self.send(method, params)
        self._pending[mid] = (evt, slot)
        evt.wait(timeout)
        self._pending.pop(mid, None)
        if "result" in slot:
            return slot["result"]
        if "error" in slot:
            e = slot["error"]
            raise RCError(e.get("code", -32603), e.get("message", "rpc error"), e.get("data"))
        raise RCError(-32601, "请求超时(method=%s)" % method)

    # ---- 读循环 ----
    def read_once(self, dispatcher):
        """读一帧并处理: dispatcher(method, params)->(result|raise RCError)。返回 True 继续。"""
        data = self.sock.recv(65536)
        if not data:
            return False
        self.buf += data
        while b"\n" in self.buf:
            line, self.buf = self.buf.split(b"\n", 1)
            line = line.strip()
            if not line:
                continue
            self._handle_line(line, dispatcher)
        return True

    def _handle_line(self, line, dispatcher):
        try:
            msg = json.loads(line.decode("utf-8"))
        except Exception:
            return
        if "id" in msg and "method" not in msg:
            # 响应
            with self.rlock:
                got = self._pending.get(msg.get("id"))
            if got:
                evt, slot = got
                if "error" in msg:
                    slot["error"] = msg["error"]
                else:
                    slot["result"] = msg.get("result")
                evt.set()
            return
        if "method" not in msg:
            return
        # 主系统 → 插件 的请求(ping/invoke/log.tail/...): 独立线程执行,
        # 避免处理器内同步 call 其他插件时读不到响应(读线程保持畅通)
        threading.Thread(target=_dispatch_request, args=(self, msg), daemon=True).start()

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


_handlers = {}       # iface -> fn
_log_path = None
_log_lock = threading.Lock()


def _log(msg):
    line = "%s [rcplugin] %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg)
    if _log_path:
        try:
            with _log_lock:
                with open(_log_path, "a", encoding="utf-8") as f:
                    f.write(line + "\n")
            return
        except Exception:
            pass
    sys.stderr.write(line + "\n")


def interface(iface_id):
    """装饰器: 注册业务接口处理器。"""

    def deco(fn):
        _handlers[iface_id] = fn
        return fn
    return deco


def _dispatch(method, params):
    if method == "ping":
        return {"pong": True, "version": _VERSION}
    if method == "invoke":
        iface = (params or {}).get("iface")
        if not iface:
            raise RCError(-32602, "invoke 缺少 iface")
        fn = _handlers.get(iface)
        if fn is None:
            raise RCError(4001, "接口未实现: " + iface)
        return fn(params.get("params") or {})
    if method == "log.tail":
        lines = (params or {}).get("lines") or 200
        text = ""
        total, size = 0, 0
        if _log_path and os.path.isfile(_log_path):
            try:
                with open(_log_path, "r", encoding="utf-8") as f:
                    data = f.read()
                size = len(data)
                parts = data.splitlines()
                total = len(parts)
                text = "\n".join(parts[-lines:])
            except Exception:
                pass
        return {"text": text, "total_lines": total, "size": size}
    if method == "register":
        raise RCError(-32603, "register 由 serve() 自动发起")
    raise RCError(-32601, "未知方法: " + method)


_VERSION = "0.0.0"


def serve(endpoint, name, version="1.0.0", manifest=None, frontend=None,
          iface_ids=None, heartbeat=30, token="", plugin_dir=None):
    """连接主系统并常驻服务(阻塞)。断线自动重连+重注册。"""
    global _log_path, _VERSION, _PROTOCOL_VERSION, _CURRENT
    _VERSION = version or _VERSION
    if plugin_dir:
        _log_path = os.path.join(plugin_dir, ".runtime.log")
        os.makedirs(plugin_dir, exist_ok=True)
    if not endpoint:
        endpoint = os.environ.get("RC_ENDPOINT", "")
    if not endpoint and plugin_dir:
        # 主系统预写端点描述文件(跨传输通用: unix:/path 或 tcp:host:port)
        ep_file = os.path.join(plugin_dir, ".rc.endpoint")
        if os.path.isfile(ep_file):
            try:
                with open(ep_file, "r", encoding="utf-8") as f:
                    endpoint = f.read().strip()
            except Exception:
                pass
    if not endpoint:
        # 默认: 主系统同机 unix socket
        base = os.environ.get("RC_UDS_DIR", "/run/raincough")
        endpoint = "unix:" + os.path.join(base, "plugins", "%s.sock" % name)
    manifest = manifest or {}
    frontend = frontend or {"pages": [{"path": "", "title": name}]}
    iface_ids = iface_ids or list(_handlers.keys())
    backoff = 1.0
    while True:
        try:
            conn = _Conn(endpoint)
            dead = [False]
            threading.Thread(target=_reader_loop, args=(conn, dead), daemon=True).start()
            conn.request("register", {
                "token": token,
                "name": name,
                "version": version,
                "manifest": manifest,
                "frontend": frontend,
                "iface_ids": iface_ids,
                "heartbeat_sec": heartbeat,
                "protocol_version": PROTOCOL_VERSION,
            }, timeout=10)
            _log("已注册: %s (ifaces=%s)" % (name, iface_ids))
            backoff = 1.0
            _CURRENT = conn
            _serve_loop(conn, dead, name, version, heartbeat)
        except RCError as e:
            _log("注册失败: %s (code=%s)" % (e.message, e.code))
        except Exception as e:
            _log("连接中断: %s" % e)
        _log("重连退避 %.0fs..." % backoff)
        time.sleep(backoff)
        backoff = min(backoff * 2, MAX_RECONNECT)


def _reader_loop(conn, dead):
    """后台读线程: 处理主系统请求(ping/invoke/log.tail)并填充同步请求响应。"""
    while True:
        try:
            conn.sock.settimeout(READ_TIMEOUT)
            if not conn.read_once(_dispatch):
                break
        except socket.timeout:
            continue
        except Exception:
            break
    dead[0] = True


def _dispatch_request(conn, msg):
    """独立线程执行主系统请求并回响应。"""
    method, params = msg.get("method"), msg.get("params") or {}
    mid = msg.get("id")
    try:
        result = _dispatch(method, params)
        resp = {"jsonrpc": "2.0", "id": mid, "result": result}
    except RCError as e:
        resp = {"jsonrpc": "2.0", "id": mid, "error": {"code": e.code, "message": e.message, "data": e.data}}
    except Exception as e:
        resp = {"jsonrpc": "2.0", "id": mid, "error": {"code": -32603, "message": str(e), "data": None}}
    try:
        conn.send_raw(resp)
    except Exception:
        pass


def _serve_loop(conn, dead, name, version, heartbeat):
    """心跳循环; 连接死亡(读线程退出)时返回, 交由 serve 重连。"""
    last_hb = time.time()
    while not dead[0]:
        time.sleep(1)
        if heartbeat <= 0:
            continue
        if time.time() - last_hb >= heartbeat:
            try:
                conn.request("heartbeat", {"version": version}, timeout=5)
                last_hb = time.time()
            except Exception:
                return


def call(iface, params=None, timeout=15.0, conn=None):
    """跨插件调用: 经主系统接口库路由到目标插件。

    serve() 内部维护当前连接; 模块级 call 使用最近一次连接。
    """
    global _CURRENT
    c = conn or _CURRENT
    if c is None:
        raise RCError(4301, "插件连接未就绪, 无法跨插件调用")
    return c.request("call", {"iface": iface, "params": params or {}}, timeout=timeout)


_CURRENT = None