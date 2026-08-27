#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dltool 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

数据: 磁盘目录(插件目录下 work/<plugin> 会话目录 + tasks.json 任务进度)
依赖: 系统 pandoc/7z + requests + 标准库(无 Flask / 无旧面板 Plugin 基类)
路由契约与旧面板一致(/docconvert/check|convert、/networktools/download|split|join|rename|delete,
另加 /info、/__health、/file/<session>/<name> 结果下载)。
"""
import os
import io
import re
import uuid
import glob
import zlib
import shutil
import subprocess
import zipfile
import hashlib
import struct
import json
import threading
import http.server
from datetime import datetime


PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

PLUGIN = 'yulotool'

FORMATS = ['7z', 'zip', 'tar', 'gz', 'bz2', 'xz', 'rar']
ORGANIZE_MODES = ['none', 'type', 'date', 'ext', 'name']
IMG_EXT = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'ico', 'svg']
ALGOS = {'md5': hashlib.md5, 'sha1': hashlib.sha1, 'sha256': hashlib.sha256}

CHUNK = 32 * 1024 * 1024
FILE_CHUNK = 1024 * 1024


def clean_err(r, session):
    """Remove absolute work-dir paths from command error output."""
    err = r.get('error') or ''
    if session:
        err = err.replace(session + '/', '').replace(session, '[upload]')
    err = re.sub(r'/opt/[^\s\n]+?work/[a-f0-9]+/', '', err)
    return err.strip() or '操作失败'


# ---- videomerge footer ----
MAGIC = b'YLVFUSN1'
END_MAGIC = b'YLVFEND1'
FOOTER_LEN = 48
VERSION = 1
ARCH_ZIP = 1
ARCH_7Z = 2
ARCH_RAR = 3


def detect_archive_type(path):
    with open(path, 'rb') as f:
        head = f.read(8)
    if head[:2] == b'PK':
        return ARCH_ZIP
    if head[:6] == b'\x37\x7a\xbc\xaf\x27\x1c':
        return ARCH_7Z
    if head[:4] == b'Rar!':
        return ARCH_RAR
    return 0


def build_footer(arch_type, arch_size, crc32):
    buf = io.BytesIO()
    buf.write(MAGIC)
    buf.write(struct.pack('<I', VERSION))
    buf.write(struct.pack('<I', arch_type))
    buf.write(struct.pack('<Q', arch_size))
    buf.write(struct.pack('<I', crc32))
    buf.write(struct.pack('<8s', b'\x00' * 8))
    buf.write(struct.pack('<I', FOOTER_LEN))
    buf.write(END_MAGIC)
    return buf.getvalue()


def parse_footer(data):
    if len(data) < FOOTER_LEN or data[:8] != MAGIC:
        return None
    if data[8:12] != struct.pack('<I', VERSION):
        return None
    if data[40:48] != END_MAGIC:
        return None
    arch_type = struct.unpack('<I', data[12:16])[0]
    arch_size = struct.unpack('<Q', data[16:24])[0]
    crc32 = struct.unpack('<I', data[24:28])[0]
    return {'arch_type': arch_type, 'arch_size': arch_size, 'crc32': crc32}


def _u32(buf, off):
    return struct.unpack('<I', buf[off:off + 4])[0]


def _u64(buf, off):
    return struct.unpack('<Q', buf[off:off + 8])[0]


def _p32(buf, off, v):
    struct.pack_into('<I', buf, off, v)


def _p16(buf, off, v):
    struct.pack_into('<H', buf, off, v)


def _p64(buf, off, v):
    struct.pack_into('<Q', buf, off, v)


def fix_zip_offsets(fh, video_size, zip_size):
    """Rewrite ZIP central directory + EOCD so the archive is readable
    directly from the merged file (offsets shifted by video_size)."""
    eocd_off = video_size + zip_size - 22
    if eocd_off < 0:
        return None
    fh.seek(0, 2)
    file_end = fh.tell()
    probe = eocd_off
    found = False
    scan_limit = max(video_size, file_end - 64 * 1024)
    while probe >= scan_limit:
        fh.seek(probe)
        if fh.read(4) == b'PK\x05\x06':
            fh.seek(probe)
            eocd = fh.read(22)
            eocd_off = probe
            found = True
            break
        probe -= 1
    if not found:
        return '未找到 EOCD 签名'
    eocd = bytearray(eocd)
    cd_off = _u32(eocd, 16)
    total_entries = _u32(eocd, 8)
    cd_size = _u32(eocd, 12)

    zip64_eocd_off = -1
    if cd_off == 0xFFFFFFFF:
        scan_start = max(video_size, eocd_off - 128 * 1024)
        fh.seek(scan_start)
        scan = fh.read(eocd_off - scan_start)
        idx = scan.rfind(b'PK\x06\x06')
        if idx >= 0:
            zip64_eocd_off = scan_start + idx
            fh.seek(zip64_eocd_off)
            z64 = fh.read(56)
            if z64[:4] == b'PK\x06\x06':
                cd_off = _u64(z64, 48)
                cd_size = _u64(z64, 40)
                total_entries = _u64(z64, 32)

    new_cd_off = cd_off + video_size
    fh.seek(new_cd_off)
    cd = bytearray(fh.read(cd_size))

    pos = 0
    for i in range(total_entries):
        if pos + 46 > len(cd):
            break
        if cd[pos:pos + 4] != b'PK\x01\x02':
            return f'CD 条目 {i} 签名无效 (offset={new_cd_off + pos})'
        name_len = _u32(cd, pos + 28) & 0xFFFF
        extra_len = _u32(cd, pos + 30) & 0xFFFF
        comment_len = _u32(cd, pos + 32) & 0xFFFF
        old_off = _u32(cd, pos + 42)
        new_off = old_off + video_size

        if old_off == 0xFFFFFFFF:
            extra_start = pos + 46 + name_len
            extra_end = extra_start + extra_len
            ex = extra_start
            while ex + 12 <= extra_end:
                ext_id = struct.unpack('<H', cd[ex:ex + 2])[0]
                ext_sz = struct.unpack('<H', cd[ex + 2:ex + 4])[0]
                if ext_id == 0x0001 and ext_sz >= 8:
                    real_off = _u64(cd, ex + 4)
                    _p64(cd, ex + 4, real_off + video_size)
                    break
                ex += 4 + ext_sz
            pos += 46 + name_len + extra_len + comment_len
        elif new_off > 0xFFFFFFFF:
            _p32(cd, pos + 42, 0xFFFFFFFF)
            old_extra = bytes(cd[pos + 46 + name_len:pos + 46 + name_len + extra_len])
            zip64_ext = struct.pack('<HHQ', 0x0001, 8, new_off)
            new_extra = zip64_ext + old_extra
            new_extra_len = len(new_extra)
            _p16(cd, pos + 30, new_extra_len)
            rest = bytes(cd[pos + 46 + name_len + extra_len + comment_len:])
            head = bytes(cd[:pos + 46 + name_len]) + new_extra
            cd = bytearray(head + rest)
            pos += 46 + name_len + new_extra_len + comment_len
        else:
            _p32(cd, pos + 42, new_off)
            pos += 46 + name_len + extra_len + comment_len

    new_cd_size = len(cd)
    fh.seek(new_cd_off)
    fh.write(cd)

    if new_cd_off > 0xFFFFFFFF:
        _p32(eocd, 16, 0xFFFFFFFF)
    else:
        _p32(eocd, 16, new_cd_off)
    if new_cd_size > 0xFFFFFFFF:
        _p32(eocd, 12, 0xFFFFFFFF)
    else:
        _p32(eocd, 12, new_cd_size)
    _p16(eocd, 20, FOOTER_LEN)
    fh.seek(eocd_off)
    fh.write(eocd)

    if zip64_eocd_off >= 0:
        fh.seek(zip64_eocd_off)
        z64 = bytearray(fh.read(56))
        if z64[:4] == b'PK\x06\x06':
            _p64(z64, 48, new_cd_off)
            _p64(z64, 40, new_cd_size)
            _p64(z64, 32, total_entries)
            fh.seek(zip64_eocd_off)
            fh.write(z64)
    return None


def stream_copy(src_path, dst_fh, start=0, size=None):
    with open(src_path, 'rb') as src:
        if start:
            src.seek(start)
        remaining = size if size is not None else None
        while True:
            if remaining is None:
                b = src.read(CHUNK)
                if not b:
                    break
                dst_fh.write(b)
            else:
                if remaining <= 0:
                    break
                b = src.read(min(CHUNK, remaining))
                if not b:
                    break
                dst_fh.write(b)
                remaining -= len(b)


def crc32_file(path):
    h = 0
    with open(path, 'rb') as f:
        while True:
            b = f.read(CHUNK)
            if not b:
                break
            h = zlib.crc32(b, h)
    return h & 0xFFFFFFFF


# ---- generic helpers ----
def make_zip(src_dir, zip_path):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(src_dir):
            for fn in files:
                fp = os.path.join(root, fn)
                arc = os.path.relpath(fp, src_dir)
                zf.write(fp, arc)


def make_zip_from_files(file_list, zip_path, arc_prefix=''):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for p in file_list:
            if os.path.isfile(p):
                zf.write(p, os.path.join(arc_prefix, os.path.basename(p)))


def hash_file(path, algo):
    h = ALGOS[algo]()
    with open(path, 'rb') as f:
        while True:
            b = f.read(FILE_CHUNK)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def md5_file(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        while True:
            b = f.read(FILE_CHUNK)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def walk_files(root):
    for base, dirs, files in os.walk(root):
        for fn in files:
            yield os.path.join(base, fn)


def secure_wipe(path, passes=3):
    try:
        size = os.path.getsize(path)
        if size <= 0:
            os.remove(path)
            return True
        # 优先用 coreutils shred(内核级覆写, C 循环, 远快于 Python 逐块写)
        try:
            shred = shutil.which('shred')
        except Exception:
            shred = None
        if shred:
            rc = subprocess.run([shred, '-n', str(max(1, int(passes))), '-z', '-u', path],
                                capture_output=True, timeout=3600)
            if rc.returncode == 0:
                return not os.path.exists(path)
        with open(path, 'r+b') as f:
            for p in range(passes):
                f.seek(0)
                remaining = size
                while remaining > 0:
                    n = min(FILE_CHUNK, remaining)
                    f.write(os.urandom(n))
                    remaining -= n
                f.flush()
                os.fsync(f.fileno())
            f.seek(0)
            remaining = size
            while remaining > 0:
                n = min(FILE_CHUNK, remaining)
                f.write(b'\x00' * n)
                remaining -= n
            f.flush()
            os.fsync(f.fileno())
        os.remove(path)
        return not os.path.exists(path)
    except Exception:
        try:
            os.remove(path)
        except Exception:
            pass
        return not os.path.exists(path)


def count_pdf_pages(path):
    qpdf = find_tool('qpdf')
    if not qpdf:
        return 0
    r = run_cmd([qpdf, '--show-npages', path])
    try:
        return int(r['output'].strip())
    except ValueError:
        return 0


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


def fmt_size(n):
    n = float(n or 0)
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if n < 1024 or unit == 'TB':
            return f'{n:.1f} {unit}' if unit != 'B' else f'{int(n)} B'
        n /= 1024


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


# ---- 旧面板 tasks 模块内联(任务进度存磁盘插件目录 tasks.json) ----
_tasks_lock = threading.Lock()
_tasks_file = os.path.join(PLUGIN_DIR, 'tasks.json')


def _tasks_load():
    try:
        if os.path.isfile(_tasks_file):
            return json.load(open(_tasks_file, 'r', encoding='utf-8'))
    except Exception:
        pass
    return {}


def _tasks_save(tasks):
    try:
        os.makedirs(os.path.dirname(_tasks_file), exist_ok=True)
        with open(_tasks_file, 'w', encoding='utf-8') as f:
            json.dump(tasks, f, ensure_ascii=False)
    except Exception:
        pass


def task_begin(name, desc, kind=''):
    tid = uuid.uuid4().hex
    with _tasks_lock:
        tasks = _tasks_load()
        tasks[tid] = {'name': name, 'desc': desc, 'kind': kind,
                      'status': 'running', 'phase': '', 'message': desc,
                      'progress': 0}
        _tasks_save(tasks)
    return tid


def task_update(tid, phase=None, message=None, progress=None):
    with _tasks_lock:
        tasks = _tasks_load()
        t = tasks.get(tid)
        if not t:
            return
        if phase is not None:
            t['phase'] = phase
        if message is not None:
            t['message'] = message
        if progress is not None:
            t['progress'] = progress
        _tasks_save(tasks)


def task_finish(tid, ok, message='', progress=100):
    with _tasks_lock:
        tasks = _tasks_load()
        t = tasks.get(tid)
        if not t:
            return
        t['status'] = 'completed' if ok else 'failed'
        t['message'] = message
        t['progress'] = progress
        _tasks_save(tasks)


# 保持旧代码 `_taskmod.xxx` 的调用形态
class _TaskMod:
    @staticmethod
    def begin(name, desc, kind=''):
        return task_begin(name, desc, kind)

    @staticmethod
    def update(tid, phase=None, message=None, progress=None):
        return task_update(tid, phase=phase, message=message, progress=progress)

    @staticmethod
    def finish(tid, ok, message='', progress=100):
        return task_finish(tid, ok, message=message, progress=progress)


_taskmod = _TaskMod()


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "dltool/2.0"

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

    # ---- 路由: /docconvert/check ----
    def _rt_doc_check(self):
        pandoc = find_tool('pandoc')
        if not pandoc:
            return 200, {'ok': False, 'error': '未安装 pandoc'}
        r = run_cmd([pandoc, '--version'])
        version = ''
        m = r['output'].splitlines()
        if m:
            version = m[0]
        r2 = run_cmd([pandoc, '--list-output-formats'])
        formats = r2['output'].split()
        return 200, {'ok': True, 'version': version, 'formats': formats}

    # ---- 路由: /docconvert/convert ----
    def _rt_doc_convert(self):
        pandoc = find_tool('pandoc')
        if not pandoc:
            return 400, {'ok': False, 'error': '未安装 pandoc'}
        form, _ = self._multipart()
        to = (form.get('to') or 'html').strip()
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('files',))
        if not saved:
            return 400, {'ok': False, 'error': '请上传文档'}
        results = []
        outputs = []
        for item in saved:
            src = item['path']
            ext = os.path.splitext(item['filename'])[1][1:].lower()
            from_fmt = EXT_MAP.get(ext, 'markdown')
            base = os.path.splitext(item['filename'])[0]
            out = os.path.join(session, f'{base}.{to}')
            r = run_cmd([pandoc, src, '-f', from_fmt, '-t', to, '-o', out], timeout=600)
            ok = os.path.isfile(out) and os.path.getsize(out) > 0
            results.append({'name': item['filename'], 'ok': ok,
                            'error': '' if ok else clean_err(r, session),
                            'output': os.path.basename(out) if ok else ''})
            if ok:
                outputs.append(out)
        if len(outputs) == 1:
            return 200, {'ok': True, 'results': results, 'single': True,
                         'download': f'/file/{os.path.basename(session)}/{os.path.basename(outputs[0])}'}
        zip_path = os.path.join(session, 'converted.zip')
        make_zip_from_files(outputs, zip_path)
        return 200, {'ok': True, 'results': results,
                     'download': f'/file/{os.path.basename(session)}/converted.zip'}

    # ---- 路由: /networktools/download ----
    def _rt_nt_download(self):
        session = new_session(PLUGIN)
        data = self._json_body()
        urls = [u for u in (data.get('urls') or []) if isinstance(u, str) and u.strip()]
        if not urls:
            return 400, {'ok': False, 'error': '请提供下载链接'}
        pack = bool(data.get('pack'))
        import threading as _t

        def _work():
            tid = _taskmod.begin('yulotool', '下载 %d 个文件' % len(urls), kind='download')
            import requests as reqs
            results = []
            success = 0
            total = len(urls)
            for i, url in enumerate(urls):
                if not url:
                    continue
                _taskmod.update(tid, phase='downloading %d/%d' % (i + 1, total),
                                message='正在下载 %s' % url[:60], progress=int(i / total * 100))
                try:
                    from urllib.parse import urlparse, unquote
                    path = urlparse(url).path
                    name = unquote(os.path.basename(path)) if path else ''
                    if not name:
                        name = f'download_{uuid.uuid4().hex[:8]}'
                    name = re.sub(r'[^\w.\-\u4e00-\u9fff]', '_', name)[:120]
                    dest = os.path.join(session, name)
                    resp = reqs.get(url, timeout=300, stream=True,
                                    headers={'User-Agent': 'Mozilla/5.0'})
                    resp.raise_for_status()
                    size = 0
                    with open(dest, 'wb') as f:
                        for chunk in resp.iter_content(FILE_CHUNK):
                            if chunk:
                                f.write(chunk)
                                size += len(chunk)
                    results.append({'url': url, 'ok': True, 'name': name,
                                    'size': size})
                    success += 1
                except Exception as e:
                    results.append({'url': url, 'ok': False, 'error': str(e)[:200]})
            _taskmod.update(tid, progress=100, phase='packing')
            try:
                if pack and success:
                    tool = find_tool('7z')
                    archive = os.path.join(session, 'downloaded.7z')
                    files = [os.path.join(session, r['name']) for r in results if r['ok']]
                    if tool and files:
                        run_cmd([tool, 'a', archive] + files)
                    else:
                        archive = os.path.join(session, 'downloaded.zip')
                        make_zip_from_files(files, archive)
                    _taskmod.finish(tid, True, message='完成 %d/~%d' % (success, total),
                                    progress=100)
                    return
            except Exception:
                pass
            _taskmod.finish(tid, True, message='完成 %d/%d' % (success, total), progress=100)

        _t.Thread(target=_work, daemon=True).start()
        return 200, {'ok': True, 'message': '已开始下载 %d 个文件，稍后在任务队列中查看进度' % len(urls)}

    def _json_body(self):
        ctype = self.headers.get('Content-Type') or ''
        if 'application/json' not in ctype:
            return {}
        try:
            return json.loads(self._body() or b'{}')
        except Exception:
            return {}

    # ---- 路由: /networktools/split ----
    def _rt_nt_split(self):
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('file', 'files'))
        if not saved:
            return 400, {'ok': False, 'error': '请上传文件'}
        form, _ = self._multipart()
        try:
            chunk_mb = float(form.get('chunkSize') or 100)
        except ValueError:
            chunk_mb = 100
        if chunk_mb <= 0:
            chunk_mb = 100
        chunk_size = max(1, int(chunk_mb * 1024 * 1024))
        parts = []
        for item in saved:
            src = item['path']
            base = os.path.join(session, os.path.splitext(item['filename'])[0])
            with open(src, 'rb') as fh:
                part = 0
                while True:
                    part += 1
                    out_path = f'{base}.part{part:03d}'
                    written = 0
                    with open(out_path, 'wb') as out:
                        while written < chunk_size:
                            b = fh.read(min(FILE_CHUNK, chunk_size - written))
                            if not b:
                                break
                            out.write(b)
                            written += len(b)
                    parts.append(out_path)
                    if written < chunk_size:
                        break
        zip_path = os.path.join(session, 'parts.zip')
        make_zip_from_files(parts, zip_path)
        return 200, {'ok': True, 'parts': len(parts),
                     'download': f'/file/{os.path.basename(session)}/parts.zip'}

    # ---- 路由: /networktools/join ----
    def _rt_nt_join(self):
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('files',))
        if not saved:
            return 400, {'ok': False, 'error': '请上传分片文件'}
        form, _ = self._multipart()
        out_name = (form.get('name') or 'joined').strip() or 'joined'
        out = os.path.join(session, out_name)
        for item in sorted(saved, key=lambda s: s['filename']):
            with open(item['path'], 'rb') as src, open(out, 'ab') as dst:
                shutil.copyfileobj(src, dst, FILE_CHUNK)
        return 200, {'ok': True, 'files': len(saved),
                     'size': os.path.getsize(out),
                     'download': f'/file/{os.path.basename(session)}/{os.path.basename(out)}'}

    # ---- 路由: /networktools/rename ----
    def _rt_nt_rename(self):
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('files',))
        if not saved:
            return 400, {'ok': False, 'error': '请上传文件'}
        form, _ = self._multipart()
        mode = form.get('mode') or 'prefix'
        value = form.get('value') or ''
        value2 = form.get('value2') or ''
        try:
            start_index = int(form.get('index') or 1)
        except ValueError:
            start_index = 1
        results = []
        outputs = []
        for i, item in enumerate(saved):
            old = item['filename']
            base, ext = os.path.splitext(old)
            new_base = base
            if mode == 'prefix':
                new_base = value + base
            elif mode == 'suffix':
                new_base = base + value
            elif mode == 'replace':
                new_base = base.replace(value, value2)
            elif mode == 'case':
                new_base = base.upper() if value == 'upper' else base.lower()
            elif mode == 'regex':
                try:
                    new_base = re.sub(value, value2, base)
                except re.error:
                    new_base = base
            elif mode == 'number':
                width = 3
                try:
                    width = int(value2 or 3)
                except ValueError:
                    pass
                new_base = f'{value}{start_index + i:0{width}d}'
            new_name = new_base + ext
            new_path = os.path.join(session, new_name)
            if new_path != item['path']:
                shutil.move(item['path'], new_path)
            results.append({'old': old, 'new': new_name, 'ok': True})
            outputs.append(new_path)
        zip_path = os.path.join(session, 'renamed.zip')
        make_zip_from_files(outputs, zip_path)
        return 200, {'ok': True, 'results': results,
                     'download': f'/file/{os.path.basename(session)}/renamed.zip'}

    # ---- 路由: /networktools/delete ----
    def _rt_nt_delete(self):
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('files',))
        if not saved:
            return 400, {'ok': False, 'error': '请上传要安全删除的文件'}
        form, _ = self._multipart()
        try:
            passes = int(form.get('passes') or 3)
        except ValueError:
            passes = 3
        passes = max(1, min(passes, 35))
        results = []
        for item in saved:
            deleted = secure_wipe(item['path'], passes)
            results.append({'name': item['filename'], 'deleted': deleted})
        shutil.rmtree(session, ignore_errors=True)
        return 200, {'ok': True, 'results': results}

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
        return 200, {'name': 'dltool', 'label': '下载工具', 'version': '2.0.0',
                     'lang': 'python', 'description': '下载/分片/重命名与文档转换'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/docconvert/check":
                return self._json(*self._rt_doc_check())
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
            if p == "/docconvert/convert":
                return self._json(*self._rt_doc_convert())
            if p == "/networktools/download":
                return self._json(*self._rt_nt_download())
            if p == "/networktools/split":
                return self._json(*self._rt_nt_split())
            if p == "/networktools/join":
                return self._json(*self._rt_nt_join())
            if p == "/networktools/rename":
                return self._json(*self._rt_nt_rename())
            if p == "/networktools/delete":
                return self._json(*self._rt_nt_delete())
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("dltool ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()