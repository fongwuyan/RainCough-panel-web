#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""webspy v2 插件子进程 — 独立运行, 数据经 SharedData namespace。

功能: 网页搜索 / URL 检测 / RSS 管理 / 正文提取。
"""
import os
import re
import json
import time
import sqlite3
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "webspy")
DSN = os.environ.get("RAINCOUGH_DB_DSN", "")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
_lock = __import__("threading").RLock()
_feeds = {}
_loaded = False


# ---------- 数据层 ----------

def _kv():
    if DSN.startswith("sqlite:///"):
        c = sqlite3.connect(DSN[len("sqlite:///"):], check_same_thread=False)
        c.row_factory = sqlite3.Row
        return c
    raise RuntimeError("仅支持 sqlite DSN: " + DSN)


def _ns_get(key, default=None):
    with _lock:
        c = _kv()
        try:
            c.execute("CREATE TABLE IF NOT EXISTS ns_%s_kv (key TEXT PRIMARY KEY,"
                      " value TEXT NOT NULL, updated_at INTEGER)" % NS)
            row = c.execute("SELECT value FROM ns_%s_kv WHERE key=?" % NS, (key,)).fetchone()
            return json.loads(row[0]) if row else default
        finally:
            c.close()


def _ns_set(key, value):
    with _lock:
        c = _kv()
        try:
            c.execute("CREATE TABLE IF NOT EXISTS ns_%s_kv (key TEXT PRIMARY KEY,"
                      " value TEXT NOT NULL, updated_at INTEGER)" % NS)
            raw = json.dumps(value, ensure_ascii=False)
            c.execute("INSERT OR REPLACE INTO ns_%s_kv (key,value,updated_at) VALUES (?,?,?)"
                      % NS, (key, raw, int(time.time())))
            c.commit()
        finally:
            c.close()


# ---------- 工具 ----------

def http_get(url, timeout=20, as_bytes=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        if as_bytes:
            return raw
        for enc in ("utf-8", "gbk", "latin-1"):
            try:
                return raw.decode(enc)
            except UnicodeDecodeError:
                continue
        return raw.decode("utf-8", "replace")


def strip_html(html):
    text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------- 端点实现 ----------

def do_search(q, limit=8):
    try:
        url = "https://www.baidu.com/s?wd=" + urllib.parse.quote(q)
        html = http_get(url, timeout=15)
    except Exception:
        return []
    # 简单提取 baidu 结果标题+链接(生产应换真正的解析)
    results = []
    for m in re.finditer(r'<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', html):
        link, title = m.group(1), re.sub(r"<[^>]+>", "", m.group(2)).strip()
        if link and title:
            results.append({"title": title, "url": link})
        if len(results) >= limit:
            break
    return results


def do_urlcheck(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=15)
        code = r.getcode()
        return {"url": url, "ok": code < 400, "code": code}
    except urllib.error.HTTPError as e:
        return {"url": url, "ok": e.code < 400, "code": e.code}
    except Exception as e:
        return {"url": url, "ok": False, "code": -1, "error": str(e)}


def do_fetch_feed(feed_url, timeout=20):
    try:
        raw = http_get(feed_url, timeout=timeout, as_bytes=True)
    except Exception as e:
        return {"url": feed_url, "ok": False, "error": str(e)}
    try:
        root = ET.fromstring(raw)
    except Exception:
        try:
            root = ET.fromstring(raw.decode("utf-8", "replace"))
        except Exception as e:
            return {"url": feed_url, "ok": False, "error": "XML 解析失败: " + str(e)}
    items = []
    for item in root.iter("item"):
        title = item.findtext("title") or ""
        link = item.findtext("link") or ""
        desc = strip_html(item.findtext("description") or "")[:300]
        items.append({"title": title, "url": link, "desc": desc})
        if len(items) >= 30:
            break
    return {"url": feed_url, "ok": True, "items": items}


def do_readability(url, timeout=20):
    try:
        html = http_get(url, timeout=timeout)
    except Exception as e:
        return {"url": url, "ok": False, "error": str(e)}
    title = ""
    mt = re.search(r"<title[^>]*>([\s\S]*?)</title>", html, re.I)
    if mt:
        title = strip_html(mt.group(1))
    text = strip_html(html)
    # 取主体: 简单启发式取最常见段落
    return {"url": url, "ok": True, "title": title[:200], "text": text[:5000]}


# ---------- HTTP ----------

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
            self._json(200, {"status": "ok"})
            return
        if p.startswith("/search"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(p).query).get("q", [""])[0]
            self._json(200, {"results": do_search(q)})
            return
        if p == "/rss/feeds":
            self._json(200, {"feeds": list(_feeds.values())})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/urlcheck":
            self._json(200, do_urlcheck(str(data.get("url") or "")))
            return
        if p == "/rss/feeds":
            url = str(data.get("url") or "").strip()
            name = str(data.get("name") or url) or url
            if not url:
                self._json(400, {"error": "url 必填"})
                return
            _feeds[name] = {"name": name, "url": url, "added": int(time.time())}
            _ns_set("feeds", _feeds)
            self._json(200, _feeds[name])
            return
        if p == "/rss/feeds/delete":
            name = str(data.get("name") or "")
            _feeds.pop(name, None)
            _ns_set("feeds", _feeds)
            self._json(200, {"status": True})
            return
        if p == "/rss/fetch":
            name = str(data.get("name") or "")
            f = _feeds.get(name)
            if not f:
                self._json(404, {"error": "feed 不存在"})
                return
            self._json(200, do_fetch_feed(f["url"]))
            return
        if p == "/readability":
            self._json(200, do_readability(str(data.get("url") or "")))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    global _feeds, _loaded
    try:
        _feeds = _ns_get("feeds", {}) or {}
    except Exception:
        _feeds = {}
    _loaded = True
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("webspy ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()