#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""JMComic v2 插件子进程 — 禁漫天堂漫画搜索/阅读/下载管理。

独立子进程: 库信息与下载任务存 SharedData namespace; 上游 API 经 JM API 网关。
"""
import os
import json
import re
import time
import sqlite3
import urllib.request
import urllib.parse
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "jmcomic")
DSN = os.environ.get("RAINCOUGH_DB_DSN", "")

# 上游 API 根(可被 env 覆盖)
JM_API = os.environ.get("JM_API_BASE", "https://api.jmcomic.io")

_lock = __import__("threading").RLock()
_library = {}     # aid -> {title, cover, tags, added}
_downloads = {}   # aid -> {status, progress}
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
    global _library, _downloads, _loaded
    if _loaded:
        return
    _library = _ns_get("library", {}) or {}
    _downloads = _ns_get("downloads", {}) or {}
    _loaded = True


def _save():
    _ns_set("library", _library)
    _ns_set("downloads", _downloads)


# ---- 官方 jmcomic 库(旧插件同款, 自动更新 API 域名) ----
_jm = None
_jm_err = None


def _get_jm():
    global _jm, _jm_err
    if _jm is not None or _jm_err:
        return _jm, _jm_err
    try:
        from jmcomic import JmOption
        opt = JmOption.default()
        opt.client.impl = 'api'
        _jm = opt.new_jm_client()
    except Exception as e:
        _jm_err = "jmcomic 库不可用: " + str(e)
    return _jm, _jm_err


def _http(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "raincough-jmcomic/2.0",
                                               "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


def search(keyword, page=1, mode="normal"):
    """经官方 jmcomic 库搜索(自动域名更新, 同旧插件)。"""
    client, err = _get_jm()
    if err or client is None:
        return {"ok": False, "error": err or "客户端不可用"}
    try:
        if mode == "author":
            result = client.search_author(search_query=keyword, page=page)
        elif mode == "tag":
            result = client.search_tag(search_query=keyword, page=page)
        else:
            result = client.search_site(search_query=keyword, page=page)
        items = []
        for aid, name in (result or []):
            items.append({"aid": str(aid), "title": name, "author": "", "cover": ""})
        return {"ok": True, "items": items, "page": page, "mode": mode}
    except Exception as e:
        return {"ok": False, "error": "搜索失败: " + str(e)}


def meta(aid):
    """专辑详情: 标题/作者/封面(经官方库)。"""
    client, err = _get_jm()
    if err or client is None:
        return {"ok": False, "error": err or "客户端不可用"}
    try:
        detail = client.get_album_detail(aid)
        return {"ok": True, "meta": {
            "aid": str(aid),
            "title": getattr(detail, "title", "") or "",
            "author": getattr(detail, "author", "") or "",
            "authors": list(detail.authors) if getattr(detail, "authors", None) else [],
            "tags": list(detail.tags) if getattr(detail, "tags", None) else [],
            "series": getattr(detail, "series", "") or "",
        }}
    except Exception as e:
        return {"ok": False, "error": "详情失败: " + str(e)}


def album(aid, page=1):
    """章节(页码→图片列表)。"""
    client, err = _get_jm()
    if err or client is None:
        return {"ok": False, "error": err or "客户端不可用"}
    try:
        detail = client.get_album_detail(aid)
        pages = []
        if hasattr(detail, "pages") and detail.pages:
            for p in detail.pages:
                pages.append(str(getattr(p, "page", "")) or str(getattr(p, "index", "")))
        return {"ok": True, "album": {"title": getattr(detail, "title", ""), "pages": pages}}
    except Exception as e:
        return {"ok": False, "error": "章节失败: " + str(e)}


def chapter(aid, cid):
    """章节图片列表(经官方库, 返回图片 URL)。"""
    client, err = _get_jm()
    if err or client is None:
        return {"ok": False, "error": err or "客户端不可用"}
    try:
        photo = client.get_photo_detail(cid)
        urls = []
        if hasattr(photo, "image_urls") and photo.image_urls:
            urls = list(photo.image_urls)
        elif hasattr(photo, "images") and photo.images:
            urls = list(photo.images)
        return {"ok": True, "chapter": {
            "cid": str(cid), "title": getattr(photo, "title", ""),
            "images": urls,
        }}
    except Exception as e:
        return {"ok": False, "error": "图片失败: " + str(e)}


def add_library(aid, title, cover, tags):
    _library[str(aid)] = {"title": title or str(aid), "cover": cover or "",
                          "tags": tags or [], "added": int(time.time())}
    _save()
    return {"ok": True, "count": len(_library)}


def library(page=1, page_size=45):
    items = sorted(_library.values(), key=lambda x: -x["added"])
    start = (page - 1) * page_size
    return {"ok": True, "items": items[start:start + page_size],
            "total": len(items), "page": page, "page_size": page_size}


def del_library(aid):
    _library.pop(str(aid), None)
    _save()
    return {"ok": True}


def start_download(aid):
    # 简化: 标记下载任务(真实下载需 JM 网关支持, 这里登记任务状态)
    _downloads[str(aid)] = {"status": "queued", "progress": 0,
                            "started": int(time.time())}
    _save()
    return {"ok": True, "aid": str(aid), "status": "queued"}


def batch_download(aids):
    for a in aids:
        _downloads[str(a)] = {"status": "queued", "progress": 0,
                              "started": int(time.time())}
    _save()
    return {"ok": True, "count": len(aids)}


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
            self._json(200, {"ok": True, "gateway": JM_API})
            return
        if p.startswith("/search"):
            self._json(200, search(q.get("keyword", ""), int(q.get("page") or 1)))
            return
        if p.startswith("/meta/"):
            self._json(200, meta(q.get("aid", p[len("/meta/"):])))
            return
        if p.startswith("/album/"):
            aid = p[len("/album/"):].split("/")[0]
            self._json(200, album(aid, int(q.get("page") or 1)))
            return
        if p.startswith("/chapter/"):
            parts = p[len("/chapter/"):].split("/")
            self._json(200, chapter(parts[0], parts[1] if len(parts) > 1 else ""))
            return
        if p == "/library":
            self._json(200, library(int(q.get("page") or 1), int(q.get("page_size") or 45)))
            return
        if p == "/config":
            self._json(200, {"gateway": JM_API})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/download":
            aid = str(data.get("aid") or "")
            if aid:
                self._json(200, start_download(aid))
            else:
                self._json(400, {"error": "缺少 aid"})
            return
        if p == "/download/batch":
            self._json(200, batch_download(data.get("aids") or []))
            return
        if p == "/library":
            self._json(200, add_library(str(data.get("aid") or ""),
                                        str(data.get("title") or ""),
                                        str(data.get("cover") or ""),
                                        data.get("tags") or []))
            return
        self._json(404, {"error": "not found"})

    def do_DELETE(self):
        if self.path.startswith("/library/"):
            return self._json(200, del_library(self.path[len("/library/"):]))
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    _load()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("jmcomic ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()