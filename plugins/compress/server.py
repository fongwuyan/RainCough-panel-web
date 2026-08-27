#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""compress 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

数据: 磁盘目录(插件目录下 work/<plugin> 会话目录, 与旧面板一致)
依赖: 系统 7z/tar/gzip/bzip2/xz + 标准库(无 Flask / 无旧面板 Plugin 基类)
路由契约与旧面板一致(/decompress/check|list|extract|compress|convert|compare,
另加 /info、/__health、/file/<session>/<name> 用于结果文件下载)。
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


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "compress/2.0"

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

    # ---- 路由: /decompress/check ----
    def _rt_dc_check(self):
        tool = find_tool('7z')
        if not tool:
            return 200, {'ok': False, 'error': '未安装 7z (p7zip-full)'}
        return 200, {'ok': True, '7z': tool}

    # ---- 路由: /decompress/list ----
    def _rt_dc_list(self):
        tool = find_tool('7z')
        if not tool:
            return 400, {'ok': False, 'error': '未安装 7z'}
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('file', 'files'))
        if not saved:
            return 400, {'ok': False, 'error': '请上传压缩包'}
        archive = saved[0]['path']
        r = run_cmd([tool, 'l', archive, '-slt', '-bsp0'])
        if not r['ok']:
            return 400, {'ok': False, 'error': clean_err(r, session)}
        files = parse_7z_list(r['output'])
        total_size = sum(f.get('size', 0) for f in files if not f.get('isDir'))
        shutil.rmtree(session, ignore_errors=True)
        return 200, {'ok': True, 'name': saved[0]['filename'],
                     'files': files, 'total': len(files),
                     'total_size': total_size}

    # ---- 路由: /decompress/extract ----
    def _rt_dc_extract(self):
        tool = find_tool('7z')
        if not tool:
            return 400, {'ok': False, 'error': '未安装 7z'}
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('file', 'files'))
        if not saved:
            return 400, {'ok': False, 'error': '请上传压缩包'}
        form, _ = self._multipart()
        archive = saved[0]['path']
        password = (form.get('password') or '').strip()
        organize = form.get('organize') or 'none'
        if organize not in ORGANIZE_MODES:
            organize = 'none'
        out_dir = os.path.join(session, 'extracted')
        os.makedirs(out_dir, exist_ok=True)

        if organize != 'none':
            temp_dir = os.path.join(session, '_temp')
            args = [tool, 'x', archive, f'-o{temp_dir}']
            if password:
                args.append(f'-p{password}')
            r = run_cmd(args)
            if not r['ok']:
                return 400, {'ok': False, 'error': clean_err(r, session)}
            count = 0
            for root, dirs, files in os.walk(temp_dir):
                for fn in files:
                    src = os.path.join(root, fn)
                    mtime = datetime.fromtimestamp(os.path.getmtime(src))
                    ext = os.path.splitext(fn)[1][1:]
                    if organize == 'type':
                        target = os.path.join(out_dir, classify_ext(ext))
                    elif organize == 'date':
                        target = os.path.join(out_dir, mtime.strftime('%Y-%m-%d'))
                    elif organize == 'ext':
                        target = os.path.join(out_dir, f'.{ext}' if ext else 'no_ext')
                    else:
                        first = fn[:1].upper()
                        target = os.path.join(out_dir, first if first.isalpha() else '#')
                    os.makedirs(target, exist_ok=True)
                    dest = os.path.join(target, fn)
                    i = 1
                    while os.path.exists(dest):
                        base, e = os.path.splitext(fn)
                        dest = os.path.join(target, f'{base}_{i}{e}')
                        i += 1
                    shutil.copy2(src, dest)
                    count += 1
            shutil.rmtree(temp_dir, ignore_errors=True)
        else:
            args = [tool, 'x', archive, f'-o{out_dir}']
            if password:
                args.append(f'-p{password}')
            r = run_cmd(args)
            if not r['ok']:
                return 400, {'ok': False, 'error': clean_err(r, session)}
            count = sum(len(fs) for _, _, fs in os.walk(out_dir))

        zip_path = os.path.join(session, f"{os.path.splitext(saved[0]['filename'])[0]}_extracted.zip")
        make_zip(out_dir, zip_path)
        return 200, {'ok': True, 'count': count,
                     'download': f'/file/{os.path.basename(session)}/{os.path.basename(zip_path)}'}

    # ---- 路由: /decompress/compress ----
    def _rt_dc_compress(self):
        tool = find_tool('7z')
        if not tool:
            return 400, {'ok': False, 'error': '未安装 7z'}
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('files',))
        if not saved:
            return 400, {'ok': False, 'error': '请上传要压缩的文件'}
        form, _ = self._multipart()
        fmt = (form.get('format') or '7z').lower()
        if fmt not in FORMATS:
            fmt = '7z'
        try:
            level = int(form.get('level') or 5)
        except ValueError:
            level = 5
        password = (form.get('password') or '').strip()
        out_name = (form.get('name') or 'archive').strip() or 'archive'
        if fmt in ('gz', 'bz2', 'xz'):
            # 7z 无法直接创建 gz/bz2/xz：先打 tar，再用对应压缩器（tar.gz 两段式）
            comp = find_tool({'gz': 'gzip', 'bz2': 'bzip2', 'xz': 'xz'}[fmt])
            if not comp:
                return 400, {'ok': False, 'error': f'未安装 {fmt} 压缩器'}
            tar_path = os.path.join(session, f'{out_name}.tar')
            args = [tool, 'a', '-ttar', tar_path] + [f['path'] for f in saved]
            r = run_cmd(args)
            if not r['ok'] or not os.path.isfile(tar_path):
                return 400, {'ok': False, 'error': clean_err(r, session)}
            out_path = f'{tar_path}.{fmt}'
            import subprocess as _sp
            with open(tar_path, 'rb') as srcf, open(out_path, 'wb') as dstf:
                p = _sp.run([comp, '-c'], stdin=srcf, stdout=dstf)
            if p.returncode != 0 or not os.path.isfile(out_path) or os.path.getsize(out_path) == 0:
                return 400, {'ok': False, 'error': '压缩失败'}
        else:
            out_path = os.path.join(session, f'{out_name}.{fmt}')
            args = [tool, 'a', f'-t{fmt}']
            if level > 0:
                args.append(f'-mx{level}')
            if password:
                args.append(f'-p{password}')
            args.append(out_path)
            args += [f['path'] for f in saved]
            r = run_cmd(args)
            if not r['ok']:
                return 400, {'ok': False, 'error': clean_err(r, session)}
            if not os.path.isfile(out_path):
                return 400, {'ok': False, 'error': '打包失败'}
        return 200, {'ok': True, 'size': os.path.getsize(out_path),
                     'download': f'/file/{os.path.basename(session)}/{os.path.basename(out_path)}'}

    # ---- 路由: /decompress/convert ----
    def _rt_dc_convert(self):
        tool = find_tool('7z')
        if not tool:
            return 400, {'ok': False, 'error': '未安装 7z'}
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('file', 'files'))
        if not saved:
            return 400, {'ok': False, 'error': '请上传压缩包'}
        form, _ = self._multipart()
        dst_fmt = (form.get('format') or '7z').lower()
        if dst_fmt not in ('7z', 'zip', 'tar'):
            dst_fmt = '7z'
        src = saved[0]['path']
        base = os.path.splitext(saved[0]['filename'])[0]
        out_path = os.path.join(session, f'{base}.{dst_fmt}')
        r = run_cmd([tool, 'a', f'-t{dst_fmt}', out_path, src])
        if not r['ok']:
            return 400, {'ok': False, 'error': clean_err(r, session)}
        return 200, {'ok': True, 'size': os.path.getsize(out_path),
                     'download': f'/file/{os.path.basename(session)}/{os.path.basename(out_path)}'}

    # ---- 路由: /decompress/compare ----
    def _rt_dc_compare(self):
        tool = find_tool('7z')
        if not tool:
            return 400, {'ok': False, 'error': '未安装 7z'}
        session = new_session(PLUGIN)
        saved = save_uploads(self, session, fields=('files',))
        if len(saved) < 2:
            return 400, {'ok': False, 'error': '请上传两个压缩包'}
        a, b = saved[0], saved[1]
        ra = run_cmd([tool, 'l', a['path'], '-slt', '-bsp0'])
        rb = run_cmd([tool, 'l', b['path'], '-slt', '-bsp0'])
        fa = {f['path']: f for f in parse_7z_list(ra['output']) if not f.get('isDir')}
        fb = {f['path']: f for f in parse_7z_list(rb['output']) if not f.get('isDir')}
        only_a = [f for f in fa if f not in fb]
        only_b = [f for f in fb if f not in fa]
        both = [f for f in fa if f in fb and fa[f].get('size') != fb[f].get('size')]
        shutil.rmtree(session, ignore_errors=True)
        return 200, {'ok': True, 'a': a['filename'], 'b': b['filename'],
                     'only_a': only_a, 'only_b': only_b, 'diff': both,
                     'same': len(fa) - len(only_a) - len(both)}

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
        return 200, {'name': 'compress', 'label': '解压压缩', 'version': '2.0.0',
                     'lang': 'python', 'description': '解压/压缩/格式转换/对比'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/decompress/check":
                return self._json(*self._rt_dc_check())
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
            if p == "/decompress/list":
                return self._json(*self._rt_dc_list())
            if p == "/decompress/extract":
                return self._json(*self._rt_dc_extract())
            if p == "/decompress/compress":
                return self._json(*self._rt_dc_compress())
            if p == "/decompress/convert":
                return self._json(*self._rt_dc_convert())
            if p == "/decompress/compare":
                return self._json(*self._rt_dc_compare())
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("compress ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()