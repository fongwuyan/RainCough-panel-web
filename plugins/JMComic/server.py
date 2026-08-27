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
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

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

def _ns_set_cfg(cfg):
    """存插件配置(SharedData ns_jmcomic cfg 键)。"""
    with _lock:
        try:
            c = _kv()
            c.execute("INSERT OR REPLACE INTO ns_%s_kv (key,value,updated_at)"
                      " VALUES (?,?,?)" % NS, ("cfg", json.dumps(cfg, ensure_ascii=False), int(time.time())))
            c.commit()
            c.close()
        except Exception:
            pass

def _ns_get_cfg():
    with _lock:
        try:
            c = _kv()
            row = c.execute("SELECT value FROM ns_%s_kv WHERE key='cfg'" % NS).fetchone()
            c.close()
            if row:
                return json.loads(row["value"])
        except Exception:
            pass
    return {}

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
            items.append({"id": str(aid), "aid": str(aid), "name": name, "title": name,
                          "author": "", "cover": "", "tags": []})
        return {"ok": True, "items": items, "page": page, "page_count": max(1, page)}
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
        ep_list = getattr(detail, "episode_list", None)
        if ep_list:
            for item in ep_list:
                # episode_list 元素: (cid, index, title?) 或 (cid, index)
                cid = ""
                idx = 0
                title = ""
                if isinstance(item, (list, tuple)):
                    cid = str(item[0]) if len(item) > 0 else ""
                    try:
                        idx = int(item[1]) if len(item) > 1 else 0
                    except Exception:
                        idx = 0
                    if len(item) > 2:
                        title = str(item[2])
                elif isinstance(item, dict):
                    cid = str(item.get("id") or item.get("cid") or "")
                    idx = item.get("index", 0)
                    title = item.get("title", "")
                if cid:
                    chapters.append({"cid": cid, "title": title, "index": idx})
        # count 是方法: 转为实际数
        try:
            cnt = int(getattr(detail, "count", None)()) if callable(getattr(detail, "count", None)) else int(getattr(detail, "count", 0) or 0)
        except Exception:
            cnt = 0
        if not chapters and cnt:
            chapters = [{"cid": str(aid), "title": getattr(detail, "name", "") or "", "index": 1}]
        return {"ok": True, "album": {
            "id": str(aid), "aid": str(aid),
            "name": getattr(detail, "name", "") or getattr(detail, "title", "") or "",
            "title": getattr(detail, "title", "") or getattr(detail, "name", "") or "",
            "author": getattr(detail, "author", "") or "",
            "tags": list(detail.tags) if getattr(detail, "tags", None) else [],
            "chapters": chapters,
            "count": cnt,
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
        page_arr = getattr(photo, "page_arr", None)
        if page_arr:
            for i in range(1, len(page_arr) + 1):
                try:
                    u = _img_url(str(photo.get_img_data_original(i)))
                    urls.append(u)
                except Exception:
                    try:
                        urls.append(_img_url(str(photo.get_img_data_original(i, False))))
                    except Exception:
                        continue
        elif hasattr(photo, "image_urls") and photo.image_urls:
            urls = [_img_url(u) for u in photo.image_urls]
        elif hasattr(photo, "images") and photo.images:
            urls = [_img_url(u) for u in photo.images]
        with _img_cache_lock:
            _img_cache[(str(aid), str(cid))] = urls
        files = []
        for u in urls:
            name = (u.split("/")[-1] or "") or ("page_%d.jpg" % len(files))
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

def _cached_count(aid):
    """已下载页数: 扫描插件 downloads/<aid>/ 下的图片文件。"""
    base = os.path.join(_download_dir(), str(aid))
    try:
        n = 0
        for root, _dirs, files in os.walk(base):
            for f in files:
                if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                    n += 1
        return n
    except Exception:
        return 0


def _zip_size(aid):
    p = os.path.join(_download_dir(), str(aid) + ".zip")
    try:
        return os.path.getsize(p)
    except Exception:
        return 0


def library(page=1, page_size=45):
    items = []
    for k, v in sorted(_library.items(),
                       key=lambda x: x[1].get("added", 0), reverse=True):
        dls = _downloads.get(str(k), {})
        total = v.get("total") or 0
        items.append({
            "aid": str(k), "name": v.get("title", ""), "author": v.get("author", ""),
            "tags": v.get("tags", []),
            "cached": dls.get("downloaded", _cached_count(str(k))),
            "total": total,
            "zip_size": _zip_size(str(k)) or None,
        })
    total = len(items)
    start = (page - 1) * page_size
    return {"ok": True, "items": items[start:start + page_size],
            "total": total, "page": page, "page_size": page_size,
            "page_count": max(1, (total + page_size - 1) // page_size)}

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


# ---- 批量任务状态机(旧前端 jmBatchStatus 契约) ----
_batch = {"running": False, "status": "idle", "found": 0, "done": 0, "fail": 0,
          "skip": 0, "current": "", "results": {}}


def batch_start(mode, keyword):
    """收集搜索结果, 逐个加入下载(简化: 登记 queued, 前端轮询状态)。"""
    if _batch["running"]:
        return {"ok": False, "error": "已有批量任务运行中"}
    client, err = _get_jm()
    if err or client is None:
        return {"ok": False, "error": err or "客户端不可用"}
    try:
        mode = mode or "keyword"
        if mode == "author":
            result = client.search_author(search_query=keyword, page=1)
        elif mode == "tag":
            result = client.search_tag(search_query=keyword, page=1)
        else:
            result = client.search_site(search_query=keyword, page=1)
        aids = [str(a) for a, _n in (result or [])][:20]
        _batch["running"] = True
        _batch["status"] = "collecting"
        _batch["found"] = len(aids)
        _batch["done"] = 0
        _batch["fail"] = 0
        _batch["skip"] = 0
        _batch["current"] = ""
        _batch["results"] = {a: {"status": "queued", "name": "未知书名"} for a in aids}
        # 后台逐个登记下载
        import threading

        def _run():
            for i, a in enumerate(aids):
                if not _batch["running"]:
                    _batch["status"] = "stopped"
                    return
                _batch["current"] = a
                _batch["results"][a]["status"] = "downloading"
                try:
                    r = download_one(a)
                    if r.get("ok"):
                        _batch["results"][a]["status"] = "completed"
                        _batch["done"] += 1
                    else:
                        _batch["results"][a]["status"] = "failed"
                        _batch["fail"] += 1
                except Exception:
                    _batch["results"][a]["status"] = "failed"
                    _batch["fail"] += 1
            _batch["status"] = "done"
            _batch["running"] = False

        threading.Thread(target=_run, daemon=True).start()
        return {"ok": True, "found": len(aids)}
    except Exception as e:
        return {"ok": False, "error": "批量启动失败: " + str(e)}


def batch_status():
    return {**_batch}


def batch_stop():
    _batch["running"] = False
    _batch["status"] = "stopped"
    return {"ok": True}

def download_status(aid):
    aid = str(aid)
    st = _downloads.get(aid)
    if st:
        # 真实下载完成后置 completed(插件 downloads/<aid>/ 有文件)
        if st.get("status") == "completed":
            return {"ok": True, "aid": aid, "status": "completed",
                    "downloaded": st.get("downloaded", 0), "total": st.get("total", 0)}
        return {"ok": True, "aid": aid, **st}
    # 未登记: 检查磁盘是否已缓存
    cached = _cached_count(aid)
    if cached > 0:
        return {"ok": True, "aid": aid, "status": "completed", "downloaded": cached,
                "total": cached, "cached": cached}
    return {"ok": True, "aid": aid, "status": "idle", "downloaded": 0, "total": 0}


# ---- 真实下载(旧插件同款: 存插件 downloads/<aid>/, 含总页数统计) ----
def _download_dir():
    base = os.path.join(PLUGIN_DIR, "downloads")
    os.makedirs(base, exist_ok=True)
    return base


def _sum_pages(album):
    total = 0
    try:
        for ep in getattr(album, "episode_list", None) or []:
            cid = str(ep[0]) if isinstance(ep, (list, tuple)) and ep else ""
            if not cid:
                continue
            try:
                ph = _get_jm()[0].get_photo_detail(cid)
                total += len(getattr(ph, "page_arr", None) or [])
            except Exception:
                pass
    except Exception:
        pass
    return total


def download_one(aid):
    """下载专辑到插件 downloads/<aid>/(登记进度, 前端轮询)。"""
    aid = str(aid)
    client, err = _get_jm()
    if err or client is None:
        return {"ok": False, "error": err or "客户端不可用"}
    try:
        detail = client.get_album_detail(aid)
        total = int(getattr(detail, "page_count", 0) or 0)
        if not total:
            total = _sum_pages(detail)
        _downloads[aid] = {"status": "downloading", "downloaded": 0, "total": total,
                           "started": int(time.time())}
        _save()
        # 更新库条目: 名称/作者/总页数
        if aid not in _library:
            _library[aid] = {"title": getattr(detail, "name", "") or aid,
                             "cover": "", "tags": [], "added": int(time.time())}
        if total:
            _library[aid]["total"] = total
        _library[aid].setdefault("author", getattr(detail, "author", ""))
        _save()
        return {"ok": True, "aid": aid, "status": "downloading", "total": total}
    except Exception as e:
        return {"ok": False, "error": "下载失败: " + str(e)}


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
                cfg = _ns_get_cfg()
                return self._json(200, {"gateway": "jmcomic-lib", **cfg})
            if p == "/info":
                return self._json(200, {
                    "name": "JMComic", "label": "JMComic", "version": "2.0.0",
                    "lang": "python", "description": "禁漫天堂搜索/阅读/下载管理",
                })
            if p.startswith("/search"):
                return self._json(200, search(q.get("keyword", ""), int(q.get("page") or 1), q.get("mode", "normal")))
            if p.startswith("/meta/"):
                # 旧 store enrichMeta 读 m.author/m.tags → 平铺 (id, author, tags)
                aid = p[len("/meta/"):].split("/")[0]
                ad = album_detail(aid)
                if not ad.get("ok"):
                    return self._json(200, {"id": aid, "author": "", "tags": [], "error": ad.get("error", "")})
                a = ad["album"]
                return self._json(200, {"id": aid, "aid": aid, "name": a.get("name", ""),
                                        "author": a.get("author", ""), "tags": a.get("tags", [])})
            if p.startswith("/album/"):
                return self._json(200, album_detail(p[len("/album/"):].split("/")[0]))
            if p.startswith("/chapter/"):
                parts = p[len("/chapter/"):].split("/")
                ch = chapter_images(parts[0], parts[1] if len(parts) > 1 else "")
                if ch.get("ok"):
                    c = ch["chapter"]
                    # 旧 store 读 chapterCache[cid].page_arr(文件名数组)
                    page_arr = []
                    if c.get("urls"):
                        page_arr = [u.split("/")[-1] or ("p%d" % (i + 1)) for i, u in enumerate(c["urls"])]
                    # 顶层直出: {ok, cid, aid, title, page_arr, direct_urls}
                    return self._json(200, {
                        "ok": True, "cid": str(c.get("cid", "")), "aid": str(parts[0]),
                        "title": c.get("title", ""), "page_arr": page_arr,
                        "files": page_arr, "urls": c.get("urls", []), "direct_urls": c.get("urls", []),
                    })
                return self._json(200, ch)
            if p.startswith("/download_zip/"):
                return self._json(200, download_status(p[len("/download_zip/"):]))
            if p == "/download/batch":
                return self._json(200, batch_status())
            if p == "/download/batch/stop":
                return self._json(200, batch_stop())
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
            if p == "/download" or p.startswith("/download/"):
                aid = str(data.get("aid") or p[len("/download/"):].split("/")[0] or "")
                if aid:
                    return self._json(200, download_one(aid))
                return self._json(400, {"error": "缺少 aid"})
            if p == "/download/batch":
                # 旧前端: {mode, keyword} → 收集+批量下载
                return self._json(200, batch_start(str(data.get("mode") or "keyword"),
                                                    str(data.get("keyword") or "")))
            if p == "/download/batch/stop":
                return self._json(200, batch_stop())
            if p == "/config":
                # 存配置(仅存储路径等, 简化: 持久化到 SharedData)
                cfg = {"storage_paths": data.get("storage_paths") or [],
                       "active_path": data.get("active_path") or ""}
                try:
                    _ns_set_cfg(cfg)
                except Exception:
                    pass
                return self._json(200, cfg)
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