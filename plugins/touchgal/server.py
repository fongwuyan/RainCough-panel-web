#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""touchgal 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

上游: touchgal.ink 官方 API + animetrace 识图(与旧插件一致, curl_cffi impersonate)
路由契约与旧面板 api.js 完全一致(search/resource/recognize/recognize-dual)。
"""
import os
import json
import concurrent.futures
import http.server
from curl_cffi import requests as cr

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

TOUCHGAL_API = 'https://www.touchgal.ink/api'
ANIMETRACE_API = 'https://api.animetrace.com/v1/search'

HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'X-Requested-With': 'kun-fetch',
    'Origin': 'https://www.touchgal.ink',
    'Referer': 'https://www.touchgal.ink/'
}


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "touchgal/2.0"

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

    # ---- 路由: POST /search ----
    def _rt_search(self, body):
        try:
            data = body or {}
            keyword = data.get('keyword', '')
            limit = data.get('limit', 15)
            nsfw = data.get('nsfw', False)

            payload = {
                'queryString': json.dumps([{'type': 'keyword', 'name': keyword}]),
                'limit': limit,
                'page': 1,
                'selectedType': 'all',
                'selectedLanguage': 'all',
                'selectedPlatform': 'all',
                'sortField': 'resource_update_time',
                'sortOrder': 'desc',
                'selectedYears': ['all'],
                'selectedMonths': ['all'],
                'minRatingCount': 0,
                'searchOption': {
                    'searchInIntroduction': True,
                    'searchInAlias': True,
                    'searchInTag': True
                }
            }

            cookie = 'kun-patch-setting-store|state|data|kunNsfwEnable=all' if nsfw else 'kun-patch-setting-store|state|data|kunNsfwEnable=sfw'
            req_headers = {**HEADERS, 'Cookie': cookie}

            r = cr.post(f'{TOUCHGAL_API}/search', json=payload, headers=req_headers, impersonate='chrome120', timeout=30)
            return 200, r.json()
        except Exception as e:
            return 500, {'error': str(e)}

    # ---- 路由: GET /resource ----
    def _rt_resource(self, q):
        try:
            patch_id = q.get('patchId', '')
            r = cr.get(f'{TOUCHGAL_API}/patch/resource?patchId={patch_id}', headers=HEADERS, impersonate='chrome120', timeout=30)
            data = r.json()
            normalized = []
            for item in data if isinstance(data, list) else []:
                links = item.get('links', [])
                first_link = links[0] if links else {}
                platform_list = item.get('platform', [])
                if isinstance(platform_list, list):
                    platform_list = ', '.join(platform_list)
                language_list = item.get('language', [])
                if isinstance(language_list, list):
                    language_list = ', '.join(language_list)
                normalized.append({
                    'name': item.get('name', '未知资源'),
                    'platform': platform_list if platform_list else '未知平台',
                    'language': language_list if language_list else '未知语言',
                    'size': first_link.get('size', item.get('size', '未知大小')),
                    'content': first_link.get('content', ''),
                    'code': first_link.get('code', '无'),
                    'password': first_link.get('password', '无'),
                    'note': item.get('note', '无备注'),
                })
            return 200, normalized
        except Exception as e:
            return 500, {'error': str(e)}

    # ---- 路由: POST /recognize ----
    def _rt_recognize(self, body):
        try:
            data = body or {}
            image_url = data.get('imageUrl', '')
            model = data.get('model', 'pre_stable')
            params = {'url': image_url, 'is_multi': '1', 'model': model, 'ai_detect': '0'}
            r = cr.post(ANIMETRACE_API, data=params, impersonate='chrome120', timeout=30)
            return 200, r.json()
        except Exception as e:
            return 500, {'error': str(e)}

    # ---- 路由: POST /recognize-dual ----
    def _rt_recognize_dual(self, body):
        try:
            data = body or {}
            image_url = data.get('imageUrl', '')

            def do_recognize(model):
                params = {'url': image_url, 'is_multi': '1', 'model': model, 'ai_detect': '0'}
                r = cr.post(ANIMETRACE_API, data=params, impersonate='chrome120', timeout=30)
                return r.json()

            with concurrent.futures.ThreadPoolExecutor() as executor:
                anime_future = executor.submit(do_recognize, 'pre_stable')
                gal_future = executor.submit(do_recognize, 'full_game_model_kira')
                anime_result = anime_future.result()
                gal_result = gal_future.result()
            return 200, {'anime': anime_result, 'gal': gal_result}
        except Exception as e:
            return 500, {'error': str(e)}

    # ---- 路由: GET /info ----
    def _rt_info(self):
        return 200, {'name': 'touchgal', 'label': 'TouchGal 游戏查找', 'version': '2.0.0',
                     'lang': 'python',
                     'description': '搜索 Galgame 游戏资源、获取下载链接、图片识别'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/resource":
                return self._json(*self._rt_resource(q))
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
            if p == "/search":
                return self._json(*self._rt_search(body))
            if p == "/recognize":
                return self._json(*self._rt_recognize(body))
            if p == "/recognize-dual":
                return self._json(*self._rt_recognize_dual(body))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("touchgal ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()