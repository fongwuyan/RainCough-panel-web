#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""laizhangsetu v2 插件子进程 — Lolicon API 随机图(纯标准库)。

数据(SharedData namespace):
  config  -> {r18, tag_blacklist, size, proxy}
  history -> 最近拉取记录
"""
import os
import json
import time
import sqlite3
import urllib.request
import urllib.parse
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "laizhangsetu")
DSN = os.environ.get("RAINCOUGH_DB_DSN", "")

API = "https://api.lolicon.app/setu/v2"
HISTORY_LIMIT = 200
_lock = __import__("threading").RLock()
_state = {"config": {}, "history": []}
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
    try:
        _state = {"config": _ns_get("config", {}) or {},
                  "history": _ns_get("history", []) or []}
    except Exception:
        pass
    _loaded = True


def _save_config():
    _ns_set("config", _state["config"])


def _push_history(entry):
    _state["history"].insert(0, entry)
    del _state["history"][HISTORY_LIMIT:]
    _ns_set("history", _state["history"])


def fetch(tags, r18, num=1):
    body = {"r18": 1 if r18 else 0, "num": min(num, 5)}
    if tags:
        body["tag"] = tags
    req = urllib.request.Request(API, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
    except Exception as e:
        return {"ok": False, "error": str(e)}
    if data.get("error"):
        return {"ok": False, "error": data["error"]}
    items = data.get("data", [])
    out = []
    for it in items:
        entry = {
            "pid": it.get("pid"), "title": it.get("title"),
            "author": (it.get("author") or ""),
            "tags": it.get("tags", []),
            "url": it.get("urls", {}).get("original", ""),
            "r18": it.get("r18", 0),
            "fetched_at": int(time.time()),
        }
        out.append(entry)
        _push_history(entry)
    return {"ok": True, "items": out}


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
        if p == "/config":
            self._json(200, _state["config"])
            return
        if p == "/history":
            self._json(200, {"history": _state["history"]})
            return
        if p == "/cooldown":
            self._json(200, {"cooldown": 0})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/fetch":
            r = fetch(data.get("tags") or [], bool(data.get("r18")),
                      int(data.get("num") or 1))
            self._json(200, r)
            return
        if p == "/config":
            _state["config"].update(data or {})
            _save_config()
            self._json(200, _state["config"])
            return
        self._json(404, {"error": "not found"})

    def do_DELETE(self):
        if self.path == "/history":
            _state["history"] = []
            _ns_set("history", [])
            self._json(200, {"status": True})
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    _load()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("laizhangsetu ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()