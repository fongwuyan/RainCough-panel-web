#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ocrqr 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

数据: 磁盘文件(插件目录下 data/feeds.json + cache/ 二维码缓存, 与旧插件一致)
上游: rapidocr(系统模型 /opt/touchgal/models/rapidocr_models) + cv2 QR 解码 + qrcode 生成
multipart 上传由 Handler._multipart() 解析(替代 Flask request.files)。
路由契约与旧面板 api.js 完全一致(ocr/ocr/check/qr/gen/qr/decode)。
"""
import os
import io
import re
import json
import time
import hashlib
import shutil
import threading
import http.server
from datetime import datetime

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

PLUGIN = 'toolbox'
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
    import requests
    resp = requests.get(url, headers={'User-Agent': USER_AGENT},
                        timeout=timeout, verify=False)
    resp.raise_for_status()
    return resp


def _parse_bing(q, limit=10):
    import requests
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


# ---- 会话/work 目录(旧 yulotool_common.new_session, 落插件目录) ----
def work_dir():
    d = os.path.join(PLUGIN_DIR, 'work')
    os.makedirs(d, exist_ok=True)
    return d


def new_session():
    import uuid
    d = os.path.join(work_dir(), uuid.uuid4().hex)
    os.makedirs(d, exist_ok=True)
    return d


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "ocrqr/2.0"

    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _file(self, path, ctype):
        try:
            with open(path, 'rb') as f:
                data = f.read()
        except Exception:
            self._json(404, {'error': '文件不存在'})
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=0")
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def _q(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    # ---- multipart 解析(替代 Flask request.files / request.form) ----
    def _multipart(self):
        """Parse multipart/form-data once; return (form_dict, files_list).
        files_list items: (field, filename, raw_bytes)."""
        if getattr(self, '_mp_parsed', None) is not None:
            return self._mp_parsed
        ctype = self.headers.get('Content-Type') or ''
        form = {}
        files = []
        m = re.search(r'boundary=([^;\s]+)', ctype)
        body = self._body()
        if m and body:
            boundary = m.group(1).strip().strip('"')
            delim = b'--' + boundary.encode()
            for part in body.split(delim):
                if not part or part.strip(b'\r\n') in (b'', b'--'):
                    continue
                if b'\r\n\r\n' in part:
                    head, content = part.split(b'\r\n\r\n', 1)
                elif b'\n\n' in part:
                    head, content = part.split(b'\n\n', 1)
                else:
                    continue
                content = content.rstrip(b'\r\n')
                head = head.decode('utf-8', 'replace')
                mname = re.search(r'name="([^"]*)"', head)
                mfile = re.search(r'filename="([^"]*)"', head)
                name = mname.group(1) if mname else ''
                if mfile:
                    files.append((name, mfile.group(1), content))
                else:
                    try:
                        form[name] = content.decode('utf-8')
                    except Exception:
                        form[name] = content.decode('latin-1')
        self._mp_parsed = (form, files)
        return self._mp_parsed

    def _save_uploads(self, session_dir, fields):
        """旧 yulotool_common.save_uploads 的本地实现."""
        _, files = self._multipart()
        saved = []
        for field in fields:
            for fname, filename, data in files:
                if fname != field or not filename:
                    continue
                safe = os.path.basename(filename)
                dest = os.path.join(session_dir, safe)
                with open(dest, 'wb') as f:
                    f.write(data)
                saved.append({'field': field, 'filename': safe, 'path': dest})
        return saved

    # ---- 路由: POST /ocr ----
    def _rt_ocr(self):
        if not os.path.isdir(OCR_MODEL_DIR):
            return 500, {'ok': False, 'error': 'OCR 模型未下载'}
        session = new_session()
        saved = self._save_uploads(session, ('file', 'files'))
        if not saved:
            return 400, {'ok': False, 'error': '请上传图片'}
        try:
            engine = _get_ocr()
            out = engine(saved[0]['path'])
            data = out.to_json() if hasattr(out, 'to_json') else []
            text = '\n'.join(item.get('txt', '') for item in data)
            shutil.rmtree(session, ignore_errors=True)
            return 200, {'ok': True, 'text': text, 'lines': data,
                         'elapse': getattr(out, 'elapse', None)}
        except Exception as e:
            shutil.rmtree(session, ignore_errors=True)
            return 500, {'ok': False, 'error': str(e)}

    # ---- 路由: GET /ocr/check ----
    def _rt_ocr_check(self):
        models_ok = os.path.isdir(OCR_MODEL_DIR) and any(
            f.endswith('.onnx') for f in os.listdir(OCR_MODEL_DIR)
        )
        try:
            import rapidocr  # noqa
            pkg_ok = True
        except Exception:
            pkg_ok = False
        return 200, {'ok': models_ok and pkg_ok, 'models': models_ok,
                     'package': pkg_ok, 'model_dir': OCR_MODEL_DIR}

    # ---- 路由: GET /qr/gen ----
    def _rt_qr_gen(self, q):
        text = (q.get('text') or '').strip()
        if not text:
            return 400, {'ok': False, 'error': '内容不能为空'}
        try:
            size = int(q.get('size') or 300)
        except ValueError:
            size = 300
        size = max(120, min(size, 1024))
        import qrcode
        from qrcode.constants import ERROR_CORRECT_M
        qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_M,
                           box_size=10, border=4)
        qr.add_data(text)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        img = img.resize((size, size))
        os.makedirs(os.path.join(PLUGIN_DIR, 'cache'), exist_ok=True)
        name = hashlib.md5(text.encode()).hexdigest() + '.png'
        path = os.path.join(PLUGIN_DIR, 'cache', name)
        img.save(path)
        return 200, {'ok': True,
                     'url': f'/api/plugins/toolbox/cache/{name}'}

    # ---- 路由: POST /qr/decode ----
    def _rt_qr_decode(self):
        session = new_session()
        saved = self._save_uploads(session, ('file', 'files'))
        if not saved:
            return 400, {'ok': False, 'error': '请上传图片'}
        try:
            import cv2
            img = cv2.imread(saved[0]['path'])
            if img is None:
                return 400, {'ok': False, 'error': '无法读取图片'}
            detector = cv2.QRCodeDetector()
            data, points, _ = detector.detectAndDecode(img)
            results = []
            if data:
                results.append({'data': data, 'points': points.tolist() if points is not None else None})
            else:
                decoder = cv2.QRCodeDetector()
                ok, decoded, pts, _ = decoder.detectAndDecodeMulti(img)
                if ok:
                    for d, p in zip(decoded, pts):
                        if d:
                            results.append({'data': d, 'points': p.tolist() if p is not None else None})
            shutil.rmtree(session, ignore_errors=True)
            return 200, {'ok': True, 'results': results}
        except Exception as e:
            shutil.rmtree(session, ignore_errors=True)
            return 500, {'ok': False, 'error': str(e)}

    # ---- 路由: GET /cache/<name>(旧面板静态直链的本地等价, 供 url 字段直取) ----
    def _rt_cache(self, name):
        if not name or '/' in name or '\\' in name or '..' in name:
            return 400, {'error': '文件名非法'}
        p = os.path.join(PLUGIN_DIR, 'cache', name)
        if os.path.isfile(p):
            self._file(p, 'image/png')
            return None
        return 404, {'error': '文件不存在'}

    # ---- 路由: GET /info ----
    def _rt_info(self):
        return 200, {'name': 'ocrqr', 'label': '识别二维码', 'version': '2.0.0',
                     'lang': 'python',
                     'description': 'OCR 识别与二维码生成/解码'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/ocr/check":
                return self._json(*self._rt_ocr_check())
            if p == "/qr/gen":
                return self._json(*self._rt_qr_gen(q))
            if p.startswith("/cache/"):
                r = self._rt_cache(_tail('/cache/', p))
                if r:
                    return self._json(*r)
                return
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            if p == "/ocr":
                return self._json(*self._rt_ocr())
            if p == "/qr/decode":
                return self._json(*self._rt_qr_decode())
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("ocrqr ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()