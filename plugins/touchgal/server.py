#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""touchgal v2 插件子进程 — Galgame 资源搜索。

注意: TouchGal 上行 API 结构随上游变化, 这里封装可配置的搜索引擎端点;
默认使用 `curl_cffi` 若可用(上游要求浏览器指纹), 否则回退 urllib。
"""
import os
import json
import time
import sqlite3
import urllib.request
import urllib.parse
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "touchgal")
DSN = os.environ.get("RAINCOUGH_DB_DSN", "")

# 上游搜索端点(与旧版 touchgal 插件一致, 局域网面板代理时通常经反代)
SEARCH_URL = os.environ.get("TOUCHGAL_SEARCH_URL",
                            "https://www.touchgal.io/api/search")
_lock = __import__("threading").RLock()
_history = []
_loaded = False

try:
    from curl_cffi import requests as crequests
    _HAS_CURL = True
except ImportError:
    _HAS_CURL = False


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


def search(keyword, limit=10):
    params = {"keyword": keyword, "limit": limit}
    query = urllib.parse.urlencode(params)
    url = SEARCH_URL + "?" + query
    try:
        if _HAS_CURL:
            r = crequests.get(url, timeout=30, impersonate="chrome")
            data = r.json()
        else:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
    except Exception as e:
        return {"ok": False, "error": str(e), "engine": "curl_cffi" if _HAS_CURL else "urllib"}
    items = data.get("data") or data.get("items") or data.get("results") or []
    out = []
    for it in items[:limit]:
        out.append({
            "title": it.get("title") or it.get("name") or "",
            "patch_id": str(it.get("patch_id") or it.get("id") or ""),
            "author": it.get("author") or "",
            "desc": it.get("description") or it.get("intro") or "",
            "url": it.get("url") or "",
        })
    if out:
        history_entry = {"keyword": keyword, "time": int(time.time()), "count": len(out)}
        _history.insert(0, history_entry)
        del _history[100:]
        _ns_set("history", _history)
    return {"ok": True, "items": out, "engine": "curl_cffi" if _HAS_CURL else "urllib"}


def resource(patch_id):
    # 资源详情(依赖上游结构, 返回 patch id 标识, 由前端拼接下载链接)
    return {"ok": True, "patch_id": patch_id,
            "detail_url": SEARCH_URL.replace("/api/search", "/patch/" + str(patch_id))}


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
            self._json(200, {"ok": True, "engine": "curl_cffi" if _HAS_CURL else "urllib"})
            return
        if p.startswith("/resource"):
            from urllib.parse import urlparse, parse_qs
            pid = parse_qs(urlparse(p).query).get("patchId", [""])[0]
            self._json(200, resource(pid))
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/search":
            try:
                data = json.loads(self._body() or b"{}")
            except Exception:
                data = {}
            self._json(200, search(str(data.get("keyword") or ""),
                                   int(data.get("limit") or 10)))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    global _history, _loaded
    try:
        _history = _ns_get("history", []) or []
    except Exception:
        _history = []
    _loaded = True
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("touchgal ready on %d engine=%s" % (
        PORT, "curl_cffi" if _HAS_CURL else "urllib"), file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()