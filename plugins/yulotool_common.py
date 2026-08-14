import os
import re
import uuid
import shutil
import subprocess
from datetime import datetime

PLUGIN_ROOT = os.path.dirname(__file__)

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
    d = os.path.join(PLUGIN_ROOT, plugin_name, 'work')
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


def save_uploads(request, session_dir, fields=('files',)):
    """Save uploaded files from request.files to session_dir.
    Returns list of dicts {field, filename, path}."""
    saved = []
    for field in fields:
        for f in request.files.getlist(field):
            if not f or not f.filename:
                continue
            safe = os.path.basename(f.filename)
            dest = os.path.join(session_dir, safe)
            f.save(dest)
            saved.append({'field': field, 'filename': safe, 'path': dest})
    return saved


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
