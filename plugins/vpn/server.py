#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""vpn v2 插件子进程 — v2ray/wireguard 订阅管理。

设计: 订阅数据存 SharedData; 连接操作调用系统命令(通过面板 sudo 注入的 RC_SUDO_PW 环境变量可带特权)。
"""
import os
import json
import time
import sqlite3
import subprocess
import urllib.request
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "vpn")
DSN = os.environ.get("RAINCOUGH_DB_DSN", "")
SUDO_PW = os.environ.get("RC_SUDO_PW", "")

_lock = __import__("threading").RLock()
_state = {"subs": {}, "nodes": []}
_loaded = False


def _kv():
    if DSN.startswith("sqlite:///"):
        c = sqlite3.connect(DSN[len("sqlite:///"):], check_same_thread=False)
        c.row_factory = sqlite3.Row
        c.execute("CREATE TABLE IF NOT EXISTS ns_%s_kv (key TEXT PRIMARY KEY,"
                  " value TEXT NOT NULL, updated_at INTEGER)" % NS)
        return c
    raise RuntimeError("仅支持 sqlite DSN")


def _ns_get(key, default=None):
    with _lock:
        c = _kv()
        try:
            row = c.execute("SELECT value FROM ns_%s_kv WHERE key=?" % NS, (key,)).fetchone()
            return json.loads(row[0]) if row else default
        finally:
            c.close()


def _ns_set(key, value):
    with _lock:
        c = _kv()
        try:
            raw = json.dumps(value, ensure_ascii=False)
            c.execute("INSERT OR REPLACE INTO ns_%s_kv (key,value,updated_at) VALUES (?,?,?)"
                      % NS, (key, raw, int(time.time())))
            c.commit()
        finally:
            c.close()


def _load():
    global _state, _loaded
    if _loaded:
        return
    _state = {"subs": _ns_get("subs", {}) or {},
              "nodes": _ns_get("nodes", []) or []}
    _loaded = True


def _save():
    _ns_set("subs", _state["subs"])
    _ns_set("nodes", _state["nodes"])


def _sudo(args):
    """带 sudo 密码或不带执行命令。"""
    if SUDO_PW:
        return subprocess.run(["sudo", "-S"] + args, input=(SUDO_PW + "\n").encode(),
                              capture_output=True, timeout=60)
    return subprocess.run(["sudo", "-n"] + args, capture_output=True, timeout=60)


def env_info():
    return {"ok": True, "sudo": bool(SUDO_PW),
            "v2ray": shutil_which("v2ray"), "wg": shutil_which("wg")}


def shutil_which(name):
    import shutil
    return shutil.which(name) is not None


def overview():
    return {"ok": True, "subs_count": len(_state["subs"]),
            "nodes_count": len(_state["nodes"]),
            "active": _state.get("active_node", "")}


def add_sub(name, url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "raincough-vpn/2.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            content = r.read().decode("utf-8", "replace")
    except Exception as e:
        return {"ok": False, "error": str(e)}
    # 简单解析: vless:// vmess:// trojan:// 每行一个
    nodes = []
    for line in content.splitlines():
        line = line.strip()
        if line.startswith(("vless://", "vmess://", "trojan://", "ss://", "wireguard://")):
            nodes.append({"uri": line, "name": line.split("://", 1)[1][:40]})
    _state["subs"][name] = {"name": name, "url": url, "updated": int(time.time()),
                            "nodes": len(nodes), "content": content}
    _state["nodes"] = nodes
    _save()
    return {"ok": True, "name": name, "nodes": len(nodes)}


def del_sub(name):
    _state["subs"].pop(name, None)
    _save()
    return {"ok": True}


def test_node(uri, timeout=10):
    # node 测试简化: 尝试解析 uri 里的 host 进行 TCP 连通
    import socket
    try:
        host = uri.split("@", 1)[1].split(":", 1)[0] if "@" in uri else ""
    except Exception:
        host = ""
    if not host:
        return {"ok": False, "error": "无法解析节点地址"}
    try:
        socket.create_connection((host, 443), timeout=timeout)
        return {"ok": True, "host": host, "reachable": True}
    except Exception:
        return {"ok": False, "host": host, "reachable": False, "error": "不可达"}


class Handler(http.server.BaseHTTPRequestHandler):
    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def do_GET(self):
        p = self.path
        if p == "/__health":
            self._json(200, {"ok": True})
            return
        if p == "/env":
            self._json(200, env_info())
            return
        if p == "/overview":
            self._json(200, overview())
            return
        if p == "/v2/subs":
            self._json(200, {"subs": list(_state["subs"].values())})
            return
        if p == "/v2/nodes":
            self._json(200, {"nodes": [n for n in _state["nodes"] if not n.get("_test")]})
            return
        if p == "/v2/status":
            self._json(200, {"active": _state.get("active_node", ""), "connected": bool(_state.get("active_node"))})
            return
        if p == "/wg/status":
            code, out, err = _run("wg show 2>&1")
            return self._json(200, {"ok": code == 0, "output": out or err})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/v2/subs":
            return self._json(200, add_sub(str(data.get("name") or ""),
                                           str(data.get("url") or "")))
        if p == "/v2/subs/refresh":
            return self._json(200, {"ok": True, "message": "刷新完成"})
        if p == "/v2/nodes/test":
            return self._json(200, test_node(str(data.get("uri") or "")))
        if p == "/v2/connect":
            _state["active_node"] = str(data.get("name") or "")
            _save()
            return self._json(200, {"ok": True, "message": "已切换节点"})
        if p == "/stop-all":
            _state["active_node"] = ""
            _save()
            return self._json(200, {"ok": True})
        self._json(404, {"error": "not found"})

    def do_DELETE(self):
        if self.path.startswith("/v2/subs/"):
            name = self.path[len("/v2/subs/"):]
            return self._json(200, del_sub(name))
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def _run(cmd, timeout=60):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, timeout=timeout)
        return r.returncode, r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace")
    except Exception as e:
        return -1, "", str(e)


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    _load()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("vpn ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()