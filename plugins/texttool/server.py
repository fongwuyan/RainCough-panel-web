#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""texttool 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

数据: 磁盘文件(插件目录下 data/ feeds 等, 与旧插件一致)
multipart 上传由 Handler._multipart() 解析(替代 Flask request.files);
/plugins/yulotool.plugin.make_zip_from_files 内联(打包 replaced.zip)。
路由契约与旧面板 api.js 完全一致(text/regex/text/replace/text/convert/text/stats)。
"""
import os
import io
import re
import json
import time
import zipfile
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


def make_zip_from_files(file_list, zip_path, arc_prefix=''):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for p in file_list:
            if os.path.isfile(p):
                zf.write(p, os.path.join(arc_prefix, os.path.basename(p)))


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "texttool/2.0"

    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _file(self, path, ctype, as_attach=False):
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
        if as_attach:
            self.send_header("Content-Disposition", 'attachment; filename="%s"' % os.path.basename(path))
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

    # ---- 路由: POST /text/regex ----
    def _rt_text_regex(self, body):
        data = body or {}
        pattern = str(data.get('pattern', ''))
        text = str(data.get('text', ''))
        flags = int(data.get('flags') or 0)
        if not pattern:
            return 400, {'ok': False, 'error': '正则表达式不能为空'}
        try:
            rx = re.compile(pattern, flags)
        except re.error as e:
            return 400, {'ok': False, 'error': f'正则错误: {e}'}
        matches = []
        for m in rx.finditer(text):
            matches.append({
                'start': m.start(),
                'end': m.end(),
                'match': m.group(0),
                'groups': list(m.groups()),
            })
        return 200, {'ok': True, 'pattern': pattern,
                     'count': len(matches), 'matches': matches[:200]}

    # ---- 路由: POST /text/replace ----
    def _rt_text_replace(self):
        session = new_session()
        saved = self._save_uploads(session, ('files',))
        if not saved:
            return 400, {'ok': False, 'error': '请上传文本文件'}
        form, _ = self._multipart()
        find = form.get('find') or ''
        replace = form.get('replace') or ''
        use_regex = form.get('regex') == '1'
        if not find:
            return 400, {'ok': False, 'error': '查找内容不能为空'}
        try:
            if use_regex:
                rx = re.compile(find)
            else:
                rx = None
        except re.error as e:
            return 400, {'ok': False, 'error': f'正则错误: {e}'}
        results = []
        outputs = []
        for item in saved:
            src = item['path']
            try:
                content = open(src, 'r', encoding='utf-8', errors='replace').read()
            except Exception as e:
                results.append({'name': item['filename'], 'ok': False, 'error': str(e)})
                continue
            new = rx.sub(replace, content) if rx else content.replace(find, replace)
            out = os.path.join(session, item['filename'])
            with open(out, 'w', encoding='utf-8') as f:
                f.write(new)
            results.append({'name': item['filename'], 'ok': True,
                            'replaced': content != new,
                            'output': os.path.basename(out)})
            outputs.append(out)
        zip_path = os.path.join(session, 'replaced.zip')
        make_zip_from_files(outputs, zip_path)
        return 200, {'ok': True, 'results': results,
                     'download': f'/api/plugins/toolbox/file/{os.path.basename(session)}/replaced.zip'}

    # ---- 路由: POST /text/convert ----
    def _rt_text_convert(self, body):
        data = body or {}
        content = str(data.get('content', ''))
        action = data.get('action') or 'json2yaml'
        if not content.strip():
            return 400, {'ok': False, 'error': '内容不能为空'}
        try:
            if action == 'json2yaml':
                import yaml
                obj = json.loads(content)
                out = yaml.safe_dump(obj, allow_unicode=True, sort_keys=False)
            elif action == 'yaml2json':
                import yaml
                obj = yaml.safe_load(content)
                out = json.dumps(obj, ensure_ascii=False, indent=2)
            elif action == 'jsonfmt':
                obj = json.loads(content)
                out = json.dumps(obj, ensure_ascii=False, indent=2)
            elif action == 'jsonmin':
                obj = json.loads(content)
                out = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
            else:
                return 400, {'ok': False, 'error': '未知操作'}
        except Exception as e:
            return 400, {'ok': False, 'error': f'转换失败: {e}'}
        return 200, {'ok': True, 'output': out}

    # ---- 路由: POST /text/stats ----
    def _rt_text_stats(self):
        session = new_session()
        saved = self._save_uploads(session, ('file', 'files'))
        if not saved:
            return 400, {'ok': False, 'error': '请上传文本文件'}
        content = open(saved[0]['path'], 'r', encoding='utf-8', errors='replace').read()
        shutil.rmtree(session, ignore_errors=True)
        chars = len(content)
        chars_no_space = len(re.sub(r'\s', '', content))
        words = re.findall(r'\w+', content, re.UNICODE)
        lines = content.splitlines()
        ch_freq = {}
        for ch in re.sub(r'\s', '', content):
            ch_freq[ch] = ch_freq.get(ch, 0) + 1
        top_chars = sorted(ch_freq.items(), key=lambda x: -x[1])[:20]
        return 200, {
            'ok': True,
            'chars': chars,
            'chars_no_space': chars_no_space,
            'words': len(words),
            'lines': len(lines),
            'bytes': len(content.encode('utf-8')),
            'top_chars': [{'char': c, 'count': n} for c, n in top_chars],
        }

    # ---- 路由: GET /file/<session>/<name>(旧面板静态直链的本地等价, 下载 replaced.zip) ----
    def _rt_file(self, rest):
        parts = rest.split('/')
        if len(parts) < 2:
            return 400, {'error': '参数不足'}
        session, name = parts[0], '/'.join(parts[1:])
        if not name or '/' in name or '\\' in name or '..' in name or '..' in session or '/' in session or '\\' in session:
            return 400, {'error': '文件名非法'}
        p = os.path.join(work_dir(), session, name)
        if os.path.isfile(p):
            self._file(p, 'application/zip' if name.endswith('.zip') else 'application/octet-stream', as_attach=True)
            return None
        return 404, {'error': '文件不存在'}

    # ---- 路由: GET /info ----
    def _rt_info(self):
        return 200, {'name': 'texttool', 'label': '文本工具', 'version': '2.0.0',
                     'lang': 'python', 'description': '正则/替换/转换/统计'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p.startswith("/file/"):
                r = self._rt_file(_tail('/file/', p))
                if r:
                    return self._json(*r)
                return
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            if p in ('/text/replace', '/text/stats'):
                if p == '/text/replace':
                    return self._json(*self._rt_text_replace())
                return self._json(*self._rt_text_stats())
            try:
                body = json.loads(self._body() or b'{}')
            except Exception:
                body = {}
            if p == "/text/regex":
                return self._json(*self._rt_text_regex(body))
            if p == "/text/convert":
                return self._json(*self._rt_text_convert(body))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("texttool ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()