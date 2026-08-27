#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""imagetool 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

数据: 磁盘目录(插件目录下 data/feeds.json + work/<plugin> 会话目录)
依赖: requests + 可选 Pillow/numpy/rapidocr/bs4 + 系统 ImageMagick(convert)
路由契约与旧面板一致(/image/similar|process,
另加 /info、/__health、/file/<session>/<name> 结果下载)。
"""
import os
import io
import re
import json
import time
import shutil
import hashlib
import threading
import uuid
import subprocess
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


# ---- yulotool_common 内联(旧 plugins/yulotool_common.py 原样) ----
EXT_MAP = {
    'jpg,jpeg,png,gif,bmp,webp,svg,ico': '图片',
    'mp4,avi,mkv,mov,wmv,flv,webm': '视频',
    'mp3,wav,flac,aac,ogg,wma': '音频',
    'doc,docx,xls,xlsx,ppt,pptx,pdf': '文档',
    'zip,7z,rar,tar,gz,bz2,xz': '压缩包',
    'php,js,ts,py,java,cpp,c,h,html,css,json,xml': '代码',
}


def classify_ext(ext):
    ext = (ext or '').lower().lstrip('.')
    for exts, cat in EXT_MAP.items():
        if ext in exts.split(','):
            return cat
    return '其他'


def work_dir(plugin_name):
    d = os.path.join(PLUGIN_DIR, 'work', plugin_name)
    os.makedirs(d, exist_ok=True)
    return d


def new_session(plugin_name):
    d = os.path.join(work_dir(plugin_name), uuid.uuid4().hex)
    os.makedirs(d, exist_ok=True)
    return d


def find_tool(name):
    return shutil.which(name)


def run_cmd(args, timeout=600):
    """Run external command, return dict with ok/output/error/rc."""
    try:
        p = subprocess.run(args, capture_output=True, timeout=timeout)
        out = p.stdout.decode('utf-8', 'replace')
        err = p.stderr.decode('utf-8', 'replace')
        return {'ok': p.returncode == 0, 'rc': p.returncode,
                'output': out, 'error': err}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'rc': -1, 'output': '', 'error': '执行超时'}
    except Exception as e:
        return {'ok': False, 'rc': -1, 'output': '', 'error': str(e)}


def safe_join(base, name):
    return os.path.join(base, os.path.basename(name))


def fmt_size(n):
    n = float(n or 0)
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if n < 1024 or unit == 'TB':
            return f'{n:.1f} {unit}' if unit != 'B' else f'{int(n)} B'
        n /= 1024


def parse_7z_list(output):
    """Parse `7z l -slt` output into file dicts."""
    files = []
    cur = {}
    in_listing = False
    for line in output.splitlines():
        line = line.rstrip()
        if '----------' in line:
            in_listing = True
            continue
        if not in_listing:
            continue
        if line == '':
            if cur:
                files.append(cur)
                cur = {}
            continue
        m = re.match(r'^Path = (.+)', line)
        if m:
            cur['path'] = m.group(1)
            continue
        m = re.match(r'^Size = (.+)', line)
        if m:
            cur['size'] = int(m.group(1))
            continue
        m = re.match(r'^Packed Size = (.+)', line)
        if m:
            cur['packed'] = int(m.group(1))
            continue
        m = re.match(r'^Directory = (.+)', line)
        if m:
            cur['isDir'] = (m.group(1) == '+')
            continue
        m = re.match(r'^CRC = (.+)', line)
        if m:
            cur['crc'] = m.group(1)
            continue
    if cur:
        files.append(cur)
    return files


def make_zip_from_files(file_list, zip_path, arc_prefix=''):
    import zipfile
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for p in file_list:
            if os.path.isfile(p):
                zf.write(p, os.path.join(arc_prefix, os.path.basename(p)))


def save_uploads(handler, session_dir, fields=('files',)):
    """Save uploaded files from parsed multipart body to session_dir.
    Returns list of dicts {field, filename, path}."""
    form, files = handler._multipart()
    saved = []
    for field in fields:
        for f in files:
            if f['field'] != field or not f['filename']:
                continue
            safe = os.path.basename(f['filename'])
            dest = os.path.join(session_dir, safe)
            with open(dest, 'wb') as out:
                out.write(f['data'])
            saved.append({'field': field, 'filename': safe, 'path': dest})
    return saved


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "imagetool/2.0"

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

    def _multipart(self):
        """Parse multipart/form-data (or urlencoded) body.
        Returns (form_dict, files) where files = [{'field','filename','data'}].
        Parsed once per request and cached."""
        if getattr(self, '_mp', None) is None:
            ctype = self.headers.get('Content-Type') or ''
            body = self._body()
            if ctype.startswith('application/x-www-form-urlencoded'):
                from urllib.parse import parse_qs
                q = parse_qs(body.decode('utf-8', 'replace'))
                self._mp = ({k: v[0] for k, v in q.items()}, [])
                return self._mp
            if 'multipart/form-data' not in ctype:
                self._mp = ({}, [])
                return self._mp
            m = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', ctype)
            boundary = (m.group(1) or m.group(2)).strip() if m else None
            if not boundary:
                self._mp = ({}, [])
                return self._mp
            form = {}
            files = []
            for part in body.split(('--' + boundary).encode()):
                part = part.lstrip(b'\r\n')
                if not part or part == b'--':
                    continue
                if part.endswith(b'--'):
                    part = part[:-2]
                if part.endswith(b'\r\n'):
                    part = part[:-2]
                head, sep, content = part.partition(b'\r\n\r\n')
                if not sep:
                    continue
                headers = {}
                for line in head.decode('utf-8', 'replace').split('\r\n'):
                    if ':' in line:
                        k, v = line.split(':', 1)
                        headers[k.strip().lower()] = v.strip()
                disp = headers.get('content-disposition', '')
                mname = re.search(r'name="([^"]*)"', disp)
                mfile = re.search(r'filename="([^"]*)"', disp)
                name = mname.group(1) if mname else ''
                filename = mfile.group(1) if mfile else None
                if filename is not None:
                    files.append({'field': name, 'filename': filename, 'data': content})
                else:
                    form[name] = content.decode('utf-8', 'replace')
            self._mp = (form, files)
        return self._mp

    # ---- 路由: /image/similar ----
    def _rt_img_similar(self):
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('files',))
        if len(saved) < 2:
            return 400, {'ok': False, 'error': '请上传两张图片'}
        a, b = saved[0], saved[1]
        try:
            ha = _dhash_from_bytes(open(a['path'], 'rb').read())
            hb = _dhash_from_bytes(open(b['path'], 'rb').read())
        except Exception as e:
            return 400, {'ok': False, 'error': f'图片解析失败: {e}'}
        dist = _hamming(ha, hb)
        shutil.rmtree(session, ignore_errors=True)
        pct = max(0, round((64 - dist) / 64 * 100, 1))
        return 200, {'ok': True, 'a': a['filename'], 'b': b['filename'],
                     'hamming': dist, 'similarity': pct,
                     'verdict': '高度相似' if dist <= 4 else ('相似' if dist <= 10 else '不同')}

    # ---- 路由: /image/process ----
    def _rt_img_process(self):
        magick = find_tool('convert')
        if not magick:
            return 400, {'ok': False, 'error': '未安装 ImageMagick'}
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('files',))
        if not saved:
            return 400, {'ok': False, 'error': '请上传图片'}
        form, _ = self._multipart()
        fmt = (form.get('format') or '').lower()
        resize = (form.get('resize') or '').strip()
        quality = form.get('quality')
        rotate = form.get('rotate')
        results = []
        outputs = []
        for item in saved:
            src = item['path']
            base, ext = os.path.splitext(item['filename'])
            out_ext = fmt or ext.lstrip('.').lower() or 'png'
            out = os.path.join(session, f'{base}.{out_ext}')
            cmd = [magick, src]
            if resize:
                cmd += ['-resize', resize]
            if quality:
                try:
                    cmd += ['-quality', str(int(quality))]
                except ValueError:
                    pass
            if rotate:
                try:
                    cmd += ['-rotate', str(int(rotate))]
                except ValueError:
                    pass
            cmd.append(out)
            r = run_cmd(cmd)
            ok = os.path.isfile(out)
            results.append({'name': item['filename'], 'ok': ok,
                            'error': '' if ok else (r['error'] or '处理失败').strip()[:200],
                            'output': os.path.basename(out) if ok else ''})
            if ok:
                outputs.append(out)
        if len(outputs) == 1:
            return 200, {'ok': True, 'results': results, 'single': True,
                         'download': f'/file/{os.path.basename(session)}/{os.path.basename(outputs[0])}'}
        zip_path = os.path.join(session, 'images.zip')
        make_zip_from_files(outputs, zip_path)
        return 200, {'ok': True, 'results': results,
                     'download': f'/file/{os.path.basename(session)}/images.zip'}

    # ---- 路由: /file/<session>/<name> (结果文件下载) ----
    def _rt_file(self, rest):
        parts = rest.split('/', 1)
        if len(parts) != 2:
            return 400, {'error': '参数错误: /file/<session>/<name>'}
        sess, name = parts
        base = os.path.join(PLUGIN_DIR, 'work')
        p = safe_join(os.path.join(base, sess), name)
        if not os.path.isfile(p):
            return 404, {'error': '文件不存在'}
        self._file(p, 'application/octet-stream', as_attach=True)
        return None

    # ---- 路由: /info ----
    def _rt_info(self):
        return 200, {'name': 'imagetool', 'label': '图像工具', 'version': '2.0.0',
                     'lang': 'python', 'description': '图片相似度与图像处理'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p.startswith("/file/"):
                r = self._rt_file(p[len('/file/'):])
                if r:
                    return self._json(*r)
                return
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            if p == "/image/similar":
                return self._json(*self._rt_img_similar())
            if p == "/image/process":
                return self._json(*self._rt_img_process())
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("imagetool ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()