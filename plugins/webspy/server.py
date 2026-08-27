#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""webspy 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

数据: 插件目录下 data/feeds.json 磁盘 JSON(与旧插件一致)
功能: 搜索(Bing)/链接检测/RSS 管理/正文提取, 内置 OCR 与图像去重工具(保留原逻辑)。
路由契约与旧面板一致(search/urlcheck/rss/readability/info)。
"""
import os
import io
import re
import json
import time
import shutil
import hashlib
import threading
from datetime import datetime
import requests
import http.server


PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())
PLUGIN = 'toolbox'
PLUGIN_ROOT = PLUGIN_DIR
DATA_DIR = os.path.join(PLUGIN_DIR, 'data')
FEEDS_FILE = os.path.join(DATA_DIR, 'feeds.json')

OCR_MODEL_DIR = '/opt/touchgal/models/rapidocr_models'

_ocr_engine = None
_ocr_lock = threading.Lock()

USER_AGENT = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')


def _get_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        with _ocr_lock:
            if _ocr_engine is None:
                from rapidocr import RapidOCR
                from rapidocr.utils.typings import OCRVersion, ModelType
                params = {
                    'Global.model_root_dir': OCR_MODEL_DIR,
                    'Det.ocr_version': OCRVersion.PPOCRV5,
                    'Det.model_type': ModelType.SERVER,
                    'Rec.ocr_version': OCRVersion.PPOCRV5,
                    'Rec.model_type': ModelType.SERVER,
                    'Cls.ocr_version': OCRVersion.PPOCRV5,
                    'Cls.model_type': ModelType.MOBILE,
                }
                _ocr_engine = RapidOCR(params=params)
    return _ocr_engine


def _dhash_from_bytes(data, size=16):
    from PIL import Image
    import numpy as np
    img = Image.open(io.BytesIO(data)).convert('L').resize((size + 1, size), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.int16)
    diff = arr[:, 1:] > arr[:, :-1]
    bits = diff.flatten()
    h = 0
    for b in bits[:64]:
        h = (h << 1) | int(b)
    return h


def _hamming(a, b):
    return (a ^ b).bit_count()  # 内置 C 实现


def _load_feeds():
    if not os.path.isfile(FEEDS_FILE):
        return []
    try:
        with open(FEEDS_FILE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def _save_feeds(feeds):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(FEEDS_FILE, 'w', encoding='utf-8') as f:
        json.dump(feeds, f, ensure_ascii=False, indent=2)


def _http_get(url, timeout=20):
    resp = requests.get(url, headers={'User-Agent': USER_AGENT},
                        timeout=timeout, verify=False)
    resp.raise_for_status()
    return resp


def _parse_bing(q, limit=10):
    from urllib.parse import quote
    url = f'https://www.bing.com/search?q={quote(q)}&count={limit}'
    try:
        resp = _http_get(url)
    except Exception as e:
        return {'ok': False, 'error': f'搜索失败: {e}'}
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(resp.text, 'html.parser')
    results = []
    for li in soup.select('li.b_algo'):
        a = li.select_one('h2 a')
        p = li.select_one('.b_caption p, p')
        if not a or not a.get('href'):
            continue
        results.append({
            'title': a.get_text(strip=True),
            'url': a['href'],
            'snippet': p.get_text(strip=True) if p else '',
        })
        if len(results) >= limit:
            break
    return {'ok': True, 'results': results}


def _fetch_feed(url, timeout=20):
    import feedparser
    try:
        resp = _http_get(url, timeout=timeout)
        return feedparser.parse(resp.content)
    except Exception as e:
        return {'bozo': 1, 'bozo_exception': str(e), 'entries': [],
                'feed': {'title': url}}


def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "webspy/2.0"

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

    # ---- 路由: GET /search ----
    def _rt_search(self, q):
        query = (q.get('q') or '').strip()
        if not query:
            return 400, {'ok': False, 'error': '搜索关键词不能为空'}
        try:
            limit = int(q.get('limit') or 10)
        except ValueError:
            limit = 10
        limit = max(1, min(limit, 20))
        return 200, _parse_bing(query, limit)

    # ---- 路由: POST /urlcheck ----
    def _rt_urlcheck(self, body):
        data = body or {}
        urls = [u for u in (data.get('urls') or []) if isinstance(u, str) and u.strip()]
        if not urls:
            return 400, {'ok': False, 'error': '请提供 URL 列表'}
        results = []
        for url in urls[:20]:
            started = time.time()
            entry = {'url': url}
            try:
                r = requests.get(url, headers={'User-Agent': USER_AGENT},
                                 timeout=15, allow_redirects=True, verify=False)
                entry['status'] = r.status_code
                entry['ok'] = 200 <= r.status_code < 400
                entry['ms'] = round((time.time() - started) * 1000)
                entry['final_url'] = r.url
                entry['size'] = len(r.content)
            except Exception as e:
                entry['ok'] = False
                entry['status'] = 0
                entry['ms'] = round((time.time() - started) * 1000)
                entry['error'] = str(e)[:150]
            results.append(entry)
        return 200, {'ok': True, 'results': results}

    # ---- 路由: GET /rss/feeds ----
    def _rt_rss_list(self):
        feeds = _load_feeds()
        for f in feeds:
            f['last_fetched'] = f.get('last_fetched')
        return 200, {'ok': True, 'feeds': feeds}

    # ---- 路由: POST /rss/feeds ----
    def _rt_rss_add(self, body):
        data = body or {}
        url = str(data.get('url', '')).strip()
        name = str(data.get('name', '')).strip()
        if not url:
            return 400, {'ok': False, 'error': 'RSS 地址不能为空'}
        parsed = _fetch_feed(url)
        if parsed.bozo and not parsed.entries:
            return 400, {'ok': False, 'error': '无法解析该 RSS 地址'}
        title = (name or parsed.feed.get('title') or url)[:120]
        feeds = _load_feeds()
        for f in feeds:
            if f['url'] == url:
                return 400, {'ok': False, 'error': '该订阅源已存在'}
        feeds.append({'url': url, 'name': title, 'added': int(time.time())})
        _save_feeds(feeds)
        return 200, {'ok': True, 'feeds': feeds}

    # ---- 路由: POST /rss/feeds/delete ----
    def _rt_rss_del(self, body):
        data = body or {}
        idx = data.get('idx')
        feeds = _load_feeds()
        if idx is None or not isinstance(idx, int) or idx < 0 or idx >= len(feeds):
            return 404, {'ok': False, 'error': '订阅源不存在'}
        feeds.pop(idx)
        _save_feeds(feeds)
        return 200, {'ok': True, 'feeds': feeds}

    # ---- 路由: POST /rss/fetch ----
    def _rt_rss_fetch(self, body):
        data = body or {}
        url = str(data.get('url', '')).strip()
        limit = 20
        if not url:
            return 400, {'ok': False, 'error': 'RSS 地址不能为空'}
        parsed = _fetch_feed(url)
        if parsed.bozo and not parsed.entries:
            return 400, {'ok': False, 'error': '解析失败或源不可达'}
        entries = []
        for e in parsed.entries[:limit]:
            entries.append({
                'title': e.get('title', ''),
                'link': e.get('link', ''),
                'summary': (e.get('summary') or e.get('description') or '')[:500],
                'published': e.get('published', ''),
                'published_ts': time.mktime(e.get('published_parsed', time.localtime())),
            })
        feeds = _load_feeds()
        for f in feeds:
            if f['url'] == url:
                f['last_fetched'] = int(time.time())
        _save_feeds(feeds)
        return 200, {'ok': True, 'feed_title': parsed.feed.get('title', url),
                     'entries': entries}

    # ---- 路由: POST /readability ----
    def _rt_readability(self, body):
        data = body or {}
        url = str(data.get('url', '')).strip()
        if not url:
            return 400, {'ok': False, 'error': 'URL 不能为空'}
        try:
            resp = _http_get(url)
        except Exception as e:
            return 400, {'ok': False, 'error': f'抓取失败: {e}'}
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, 'html.parser')
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
            tag.decompose()
        title = soup.title.get_text(strip=True) if soup.title else url
        body = soup.body if soup.body else soup
        text = body.get_text(separator='\n', strip=True)
        text = re.sub(r'\n{3,}', '\n\n', text).strip()
        return 200, {'ok': True, 'url': url, 'title': title,
                     'length': len(text), 'text': text[:50000]}

    # ---- 路由: GET /info ----
    def _rt_info(self):
        return 200, {'name': 'webspy', 'label': '采集解析', 'version': '2.0.0',
                     'lang': 'python', 'description': '搜索/链接检测/RSS/正文提取'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/search":
                return self._json(*self._rt_search(q))
            if p == "/rss/feeds":
                return self._json(*self._rt_rss_list())
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            try:
                body = json.loads(self._body() or b'{}')
            except Exception:
                body = {}
            if p == "/urlcheck":
                return self._json(*self._rt_urlcheck(body))
            if p == "/rss/feeds":
                return self._json(*self._rt_rss_add(body))
            if p == "/rss/feeds/delete":
                return self._json(*self._rt_rss_del(body))
            if p == "/rss/fetch":
                return self._json(*self._rt_rss_fetch(body))
            if p == "/readability":
                return self._json(*self._rt_readability(body))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("webspy ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()