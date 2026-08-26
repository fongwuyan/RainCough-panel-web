#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mcserver v2 插件子进程 — Minecraft 多实例管理。

独立子进程: 实例配置存 SharedData; 启动/停止用 tmux + java 命令。
数据(models dict):
  mcserver:instances -> {name: {dir, jar, java, memory, port, started}}
"""
import os
import json
import time
import sqlite3
import subprocess
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "mcserver")
DSN = os.environ.get("RAINCOUGH_DB_DSN", "")

_lock = __import__("threading").RLock()
_instances = {}
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
    global _instances, _loaded
    if _loaded:
        return
    _instances = _ns_get("instances", {}) or {}
    _loaded = True


def _save():
    _ns_set("instances", _instances)


def _run(cmd, timeout=30, cwd=None):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout, cwd=cwd)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "超时"
    except FileNotFoundError:
        return -1, "", "命令不存在"


def tmux_has(name):
    code, out, _ = _run('tmux has-session -t "%s" 2>&1' % name, 5)
    return code == 0


def list_instances():
    out = []
    for name, inst in _instances.items():
        item = dict(inst)
        item["name"] = name
        item["running"] = tmux_has(name)
        item["online"] = _server_online(name)
        out.append(item)
    return out


def _server_online(name):
    inst = _instances.get(name)
    if not inst:
        return False
    port = inst.get("port", 25565)
    # 简单 TCP 探活
    import socket
    try:
        socket.create_connection(("127.0.0.1", int(port)), timeout=2)
        return True
    except Exception:
        return False


def add_instance(name, inst):
    if not name or not inst.get("dir"):
        return {"ok": False, "error": "name 与 dir 必填"}
    _instances[name] = {
        "dir": inst.get("dir"), "jar": inst.get("jar", "server.jar"),
        "java": inst.get("java", "java"), "memory": inst.get("memory", "2048M"),
        "port": inst.get("port", 25565),
    }
    _save()
    return {"ok": True, "name": name}


def update_instance(name, inst):
    if name not in _instances:
        return {"ok": False, "error": "实例不存在"}
    _instances[name].update(inst)
    _save()
    return {"ok": True}


def remove_instance(name):
    _instances.pop(name, None)
    _save()
    return {"ok": True}


def start(name):
    inst = _instances.get(name)
    if not inst:
        return {"ok": False, "error": "实例不存在"}
    if tmux_has(name):
        return {"ok": False, "error": "实例已在运行"}
    dir_path = inst.get("dir")
    if not os.path.isdir(dir_path):
        return {"ok": False, "error": "目录不存在: " + dir_path}
    cmd = ('cd "%s" && tmux new-session -d -s "%s" "%s -Xmx%s -Xms%s -jar %s nogui"' %
           (dir_path, name, inst.get("java"), inst.get("memory"), inst.get("memory"), inst.get("jar")))
    code, out, err = _run(cmd, 15)
    return {"ok": code == 0, "output": out or err}


def stop(name):
    _, out, _ = _run('tmux kill-session -t "%s" 2>&1' % name, 10)
    return {"ok": True, "output": out}


def restart(name):
    stop(name)
    time.sleep(1)
    return start(name)


def status(name):
    inst = _instances.get(name)
    if not inst:
        return {"ok": False, "error": "实例不存在"}
    return {"ok": True, "name": name, "running": tmux_has(name),
            "online": _server_online(name), "detail": inst}


def console(name, lines=50):
    if not tmux_has(name):
        return {"ok": False, "error": "实例未运行"}
    code, out, err = _run('tmux capture-pane -pt "%s" -S -%d' % (name, int(lines)), 10)
    return {"ok": code == 0, "console": out or err}


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

    def _q(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    def do_GET(self):
        p = self.path
        q = self._q()
        if p == "/__health":
            self._json(200, {"ok": True})
            return
        if p == "/instances":
            self._json(200, {"instances": list_instances()})
            return
        if p == "/status":
            self._json(200, status(q.get("name", "")) if q.get("name") else
                       {"instances": list_instances()})
            return
        if p == "/console":
            self._json(200, console(q.get("name", ""), int(q.get("lines") or 50)))
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/instance/add":
            self._json(200, add_instance(str(data.get("name") or ""),
                                         data.get("instance") or data))
            return
        if p == "/instance/update":
            self._json(200, update_instance(str(data.get("name") or ""),
                                            data.get("instance") or data))
            return
        if p == "/instance/remove":
            self._json(200, remove_instance(str(data.get("name") or "")))
            return
        if p == "/start":
            self._json(200, start(str(data.get("name") or "")))
            return
        if p == "/stop":
            self._json(200, stop(str(data.get("name") or "")))
            return
        if p == "/restart":
            self._json(200, restart(str(data.get("name") or "")))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    _load()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("mcserver ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()