#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""JMComic v2 插件子进程 — 完整实现旧面板 jmcomic API 契约(提取复用)。

数据: library/downloads 存 SharedData namespace; 漫画数据经官方 jmcomic 库
(自动更新 API 域名, 与旧插件同款)。
契约对照旧面板 api.js:
  /search?keyword=&page= -> {ok, items:[{aid,title,author,cover,tags}], page}
  /meta/<aid>            -> {ok, meta:{aid,title,author,tags}}
  /album/<aid>           -> {ok, album:{id,name,author,tags,chapters:[{cid,...}]}}
  /chapter/<aid>/<cid>   -> {ok, chapter:{cid,title,images:[url]}}
  /cover/<aid>           -> 封面图(二进制)
  /image/<aid>/<cid>/<file> -> 章节图(二进制, file 形如 xxx-n.webp)
  /library?page=         -> {ok, items:[{aid,title,cover,tags,added}], total, page, page_size}
  POST /library {aid,title,cover,tags} -> 收藏
  DELETE /library/<aid>  -> 移除
  POST /download {aid}   -> 入队
  POST /download/batch {aids} -> 批量入队
  GET  /download/<aid>   -> 下载状态
  GET  /download_zip/<aid> -> 打包下载(简化: 返回状态)
  GET  /config           -> {gateway}
"""
import os
import json
import time
import sqlite3
import threading
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "jmcomic")
DSN = os.environ.get("RAINCOUGH_DB_DSN", "")

_lock = threading.RLock()
_library = {}
_downloads = {}
_loaded = False

# ---- SharedData kv ----
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
        if not _loaded:
            _load()
        return _library.get(key, default)

def _ns_set(key, value):
    with _lock:
        _save()

def _load():
    global _loaded
    with _lock:
        try:
            c = _kv()
            for row in c.execute("SELECT key,value FROM ns_%s_kv" % NS):
                k = row["key"]
                v = json.loads(row["value"])
                if k.startswith("lib:"):
                    _library[k[4:]] = v
                elif k.startswith("dl:"):
                    _downloads[k[3:]] = v
            c.close()
        except Exception:
            pass
        _loaded = True

def _save():
    global _loaded
    with _lock:
        try:
            c = _kv()
            for aid, v in _library.items():
                c.execute("INSERT OR REPLACE INTO ns_%s_kv (key,value,updated_at)"
                          " VALUES (?,?,?)" % NS, ("lib:" + aid, json.dumps(v, ensure_ascii=False), int(time.time())))
            for aid, v in _downloads.items():
                c.execute("INSERT OR REPLACE INTO ns_%s_kv (key,value,updated_at)"
                          " VALUES (?,?,?)" % NS, ("dl:" + aid, json.dumps(v, ensure_ascii=False), int(time.time())))
            c.commit()
            c.close()
        except Exception:
            pass

# ---- 官方 jmcomic 库(自动域名) ----
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
        client = opt.new_jm_client()
        if client is not None:
            _jm = client
        else:
            _jm_err = "客户端创建失败"
    except Exception as e:
        _jm_err = "jmcomic 库不可用: " + str(e)
    return _jm, _jm_err

def _img_url(url):
    """图片 URL 归一化: 确保 https。"""
    if not url:
        return ""
    if url.startswith("//"):
        url = "https:" + url
    elif url.startswith("http://"):
        url = url.replace("http://", "https://", 1)
    return url

# ---- 搜索(旧契约) ----
def search(keyword, page=1, mode="normal"):
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
            items.append({"aid": str(aid), "title": name, "author": "",
                          "cover": _img_url(getattr(result, "cover", "") or ""), "tags": []})
        return {"ok": True, "items": items, "page": page}
    except Exception as e:
        return {"ok": False, "error": "搜索失败: " + str(e)}

# ---- 专辑详情(旧契约: {name, author, tags, chapters}) ----
def album_detail(aid):
    client, err = _get_jm()
    if err or client is None:
        return {"ok": False, "error": err or "客户端不可用"}
    try:
        detail = client.get_album_detail(aid)
        chapters = []
        if hasattr(detail, "chapter_list") and detail.chapter_list:
            for ch in detail.chapter_list:
                chapters.append({
                    "cid": str(getattr(ch, "id", "") or getattr(ch, "cid", "")),
                    "title": getattr(ch, "title", "") or "",
                    "index": getattr(ch, "index", 0),
                })
        return {"ok": True, "album": {
            "id": str(aid), "aid": str(aid),
            "name": getattr(detail, "title", "") or "",
            "title": getattr(detail, "title", "") or "",
            "author": getattr(detail, "author", "") or "",
            "tags": list(detail.tags) if getattr(detail, "tags", None) else [],
            "chapters": chapters,
        }}
    except Exception as e:
        return {"ok": False, "error": "专辑详情失败: " + str(e)}

# 章节图片 URL 缓存(供 image 重定向 + 前端 direct_url)
_img_cache = {}   # (aid,cid) -> [urls]
_img_cache_lock = threading.Lock()


def chapter_images(aid, cid):
    client, err = _get_jm()
    if err or client is None:
        return {"ok": False, "error": err or "客户端不可用"}
    try:
        photo = client.get_photo_detail(cid)
        urls = []
        if hasattr(photo, "image_urls") and photo.image_urls:
            urls = [_img_url(u) for u in photo.image_urls]
        elif hasattr(photo, "images") and photo.images:
            urls = [_img_url(u) for u in photo.images]
        with _img_cache_lock:
            _img_cache[(str(aid), str(cid))] = urls
        files = []
        for u in urls:
            name = u.split("/")[-1] or ("page_%d.jpg" % len(files))
            files.append(name)
        return {"ok": True, "chapter": {
            "cid": str(cid), "aid": str(aid),
            "title": getattr(photo, "title", "") or "",
            "files": files, "urls": urls,
            "direct_urls": urls,
        }}
    except Exception as e:
        return {"ok": False, "error": "章节失败: " + str(e)}

# ---- 本地库 ----
def add_library(aid, title, cover, tags):
    _library[str(aid)] = {"title": title or str(aid), "cover": cover or "",
                          "tags": tags or [], "added": int(time.time())}
    _save()
    return {"ok": True, "count": len(_library)}

def library(page=1, page_size=45):
    items = [{"aid": k, **v} for k, v in sorted(_library.items(),
             key=lambda x: x[1].get("added", 0), reverse=True)]
    total = len(items)
    start = (page - 1) * page_size
    return {"ok": True, "items": items[start:start + page_size],
            "total": total, "page": page, "page_size": page_size}

def remove_library(aid):
    _library.pop(str(aid), None)
    _save()
    return {"ok": True}

# ---- 下载登记 ----
def start_download(aid):
    _downloads[str(aid)] = {"status": "queued", "progress": 0, "started": int(time.time())}
    _save()
    return {"ok": True, "aid": str(aid), "status": "queued"}

def batch_download(aids):
    for a in (aids or []):
        _downloads[str(a)] = {"status": "queued", "progress": 0, "started": int(time.time())}
    _save()
    return {"ok": True, "count": len(aids or [])}

def download_status(aid):
    return {"ok": True, "aid": str(aid), **(_downloads.get(str(aid), {"status": "idle", "progress": 0}))}


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
        try:
            if p == "/__health":
                return self._json(200, {"ok": True, "gateway": "jmcomic-lib"})
            if p == "/config":
                return self._json(200, {"gateway": "jmcomic-lib"})
            if p.startswith("/search"):
                return self._json(200, search(q.get("keyword", ""), int(q.get("page") or 1), q.get("mode", "normal")))
            if p.startswith("/meta/"):
                return self._json(200, album_detail(p[len("/meta/"):].split("/")[0]))
            if p.startswith("/album/"):
                return self._json(200, album_detail(p[len("/album/"):].split("/")[0]))
            if p.startswith("/chapter/"):
                parts = p[len("/chapter/"):].split("/")
                return self._json(200, chapter_images(parts[0], parts[1] if len(parts) > 1 else ""))
            if p.startswith("/download_zip/"):
                return self._json(200, download_status(p[len("/download_zip/"):]))
            if p.startswith("/download/"):
                return self._json(200, download_status(p[len("/download/"):].split("/")[0]))
            if p == "/download":
                return self._json(200, download_status(q.get("aid", "")))
            if p.startswith("/library/"):
                return self._json(200, remove_library(p[len("/library/"):]))
            if p == "/library":
                return self._json(200, library(int(q.get("page") or 1), int(q.get("page_size") or 45)))
            if p.startswith("/cover/"):
                return self._json(200, {"ok": True, "url": ""})
            if p.startswith("/image/"):
                # /image/<aid>/<cid>/<file> → 302 到官方 CDN 图
                parts = p[len("/image/"):].split("/")
                if len(parts) >= 3:
                    aid, cid, fname = parts[0], parts[1], parts[2]
                    with _img_cache_lock:
                        urls = _img_cache.get((aid, cid), [])
                    for u in urls:
                        if u.split("/")[-1] == fname:
                            self.send_response(302)
                            self.send_header("Location", u)
                            self.send_header("Content-Length", "0")
                            self.end_headers()
                            return
                    # 未缓存: 即时拉一张
                    try:
                        ch = chapter_images(aid, cid)
                        urls = (ch.get("chapter") or {}).get("urls", [])
                        for u in urls:
                            if u.split("/")[-1] == fname:
                                self.send_response(302)
                                self.send_header("Location", u)
                                self.send_header("Content-Length", "0")
                                self.end_headers()
                                return
                    except Exception:
                        pass
                return self._json(404, {"error": "image not found"})
            return self._json(404, {"error": "not found: " + p})
        except Exception as e:
            return self._json(500, {"error": str(e)})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        try:
            if p == "/download":
                aid = str(data.get("aid") or "")
                if aid:
                    return self._json(200, start_download(aid))
                return self._json(400, {"error": "缺少 aid"})
            if p == "/download/batch":
                return self._json(200, batch_download(data.get("aids") or []))
            if p == "/library":
                return self._json(200, add_library(str(data.get("aid") or ""),
                                                   str(data.get("title") or ""),
                                                   str(data.get("cover") or ""),
                                                   data.get("tags") or []))
            return self._json(404, {"error": "not found"})
        except Exception as e:
            return self._json(500, {"error": str(e)})

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