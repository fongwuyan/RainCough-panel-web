import os
import re
import shutil
import tempfile
import zipfile
import hashlib
import subprocess
import time
from flask import Blueprint, request, jsonify, send_file, after_this_request

SEVENZ = '/usr/bin/7z'
if not os.path.isfile(SEVENZ):
    SEVENZ = '7z'

PREVIEW_LIMIT = 512 * 1024

TEXT_EXTS = {
    'txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml', 'ini', 'conf', 'cfg',
    'py', 'js', 'ts', 'html', 'css', 'vue', 'java', 'c', 'cpp', 'h', 'hpp',
    'sh', 'bat', 'ps1', 'sql', 'csv', 'toml', 'php', 'rb', 'go', 'rs',
}

IMG_EXTS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'}
VIDEO_EXTS = {'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'}
AUDIO_EXTS = {'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'}
ARCH_EXTS = {'zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz'}

fm = Blueprint('filemanager', __name__, url_prefix='/api/fm')

FM_INFO = {
    'name': 'filemanager',
    'label': '文件管理',
    'icon': '',
    'description': '浏览服务器文件系统、上传下载、增删改、预览与压缩解压',
}


def safe_path(raw):
    if not raw:
        return None
    if '\x00' in raw:
        return None
    # reject explicit ".." segments in the raw input
    if '..' in raw.replace('\\', '/').split('/'):
        return None
    p = os.path.normpath(raw)
    if not os.path.isabs(p):
        return None
    return p


def file_kind(name):
    ext = os.path.splitext(name)[1].lstrip('.').lower()
    if ext in IMG_EXTS:
        return 'image'
    if ext in VIDEO_EXTS:
        return 'video'
    if ext in AUDIO_EXTS:
        return 'audio'
    if ext in ARCH_EXTS:
        return 'archive'
    if ext in TEXT_EXTS:
        return 'text'
    return 'file'


def human_size(n):
    n = float(n or 0)
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if n < 1024 or unit == 'TB':
            return f'{n:.1f} {unit}' if unit != 'B' else f'{int(n)} B'
        n /= 1024


@fm.route('/info', methods=['GET'])
def info():
    return jsonify(FM_INFO)


@fm.route('/search', methods=['GET'])
def search():
    raw = request.args.get('path', '/')
    p = safe_path(raw)
    if not p:
        return jsonify({'error': '无效路径'}), 400
    if not os.path.isdir(p):
        return jsonify({'error': '目录不存在'}), 404
    q = request.args.get('q', '').strip().lower()
    kind = request.args.get('kind', '')
    min_size = request.args.get('min_size', '')
    max_size = request.args.get('max_size', '')
    days = request.args.get('mtime_days', '')
    limit = 500

    try:
        min_b = int(float(min_size)) if min_size else None
        max_b = int(float(max_size)) if max_size else None
        days_i = int(float(days)) if days else None
    except (TypeError, ValueError):
        return jsonify({'error': '无效的大小或时间参数'}), 400

    now = time.time()
    results = []
    visited = set()

    def match(full, name, is_dir):
        if q and q not in name.lower():
            return False
        k = 'dir' if is_dir else file_kind(name)
        if kind and k != kind:
            return False
        try:
            st = os.lstat(full)
        except OSError:
            return False
        if min_b is not None and st.st_size < min_b:
            return False
        if max_b is not None and st.st_size > max_b:
            return False
        if days_i is not None and now - st.st_mtime > days_i * 86400:
            return False
        return True

    try:
        for root, dirs, files in os.walk(p, topdown=True, followlinks=False):
            root_key = os.path.realpath(root)
            if root_key in visited:
                dirs[:] = []
                continue
            visited.add(root_key)
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for name in files:
                if len(results) >= limit:
                    break
                full = os.path.join(root, name)
                if match(full, name, False):
                    try:
                        st = os.lstat(full)
                        results.append({
                            'name': name, 'path': full, 'is_dir': False,
                            'is_link': os.path.islink(full),
                            'size': st.st_size, 'mtime': int(st.st_mtime),
                            'kind': file_kind(name),
                        })
                    except OSError:
                        pass
            if len(results) >= limit:
                break
        results.sort(key=lambda x: x['mtime'], reverse=True)
        return jsonify({'path': p, 'q': q, 'results': results, 'truncated': len(results) >= limit})
    except PermissionError:
        return jsonify({'error': '没有权限访问该目录'}), 403
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fm.route('/list', methods=['GET'])
def list_dir():
    raw = request.args.get('path', '')
    p = safe_path(raw)
    if not p:
        return jsonify({'error': '无效路径'}), 400
    if not os.path.isdir(p):
        return jsonify({'error': '目录不存在'}), 404
    try:
        items = []
        for name in os.listdir(p):
            full = os.path.join(p, name)
            try:
                st = os.lstat(full)
            except OSError:
                continue
            is_dir = os.path.isdir(full)
            items.append({
                'name': name,
                'path': full,
                'is_dir': is_dir,
                'is_link': os.path.islink(full),
                'size': 0 if is_dir else st.st_size,
                'mtime': int(st.st_mtime),
                'hidden': name.startswith('.'),
                'kind': 'dir' if is_dir else file_kind(name),
            })
        items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
        return jsonify({'path': p, 'parent': os.path.dirname(p), 'items': items})
    except PermissionError:
        return jsonify({'error': '没有权限访问该目录'}), 403
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fm.route('/upload', methods=['POST'])
def upload():
    raw = request.form.get('path', '')
    p = safe_path(raw)
    if not p:
        return jsonify({'error': '无效路径'}), 400
    if not os.path.isdir(p):
        return jsonify({'error': '目录不存在'}), 404
    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': '未选择文件'}), 400
    saved = []
    errors = []
    for f in files:
        if not f or not f.filename:
            continue
        name = os.path.basename(f.filename)
        if not name:
            continue
        dest = os.path.join(p, name)
        try:
            f.save(dest)
            saved.append(name)
        except Exception as e:
            errors.append(f'{name}: {e}')
    return jsonify({'saved': saved, 'errors': errors})


@fm.route('/download', methods=['GET'])
def download():
    raw = request.args.get('path', '')
    mode = request.args.get('mode', 'direct')
    p = safe_path(raw)
    if not p:
        return jsonify({'error': '无效路径'}), 400
    if not os.path.exists(p):
        return jsonify({'error': '文件或目录不存在'}), 404

    base = os.path.basename(p.rstrip(os.sep)) or 'root'

    if os.path.isfile(p):
        return send_file(p, as_attachment=True, download_name=base, max_age=0)

    # directory -> package on the fly
    tmp_dir = tempfile.mkdtemp(prefix='fm_dl_')
    out_path = None
    try:
        if mode == 'compress':
            out_path = os.path.join(tmp_dir, base + '.7z')
            rc = subprocess.run(
                [SEVENZ, 'a', '-mx=9', '-t7z', out_path, base],
                cwd=os.path.dirname(p), capture_output=True, timeout=3600,
            )
            if rc.returncode != 0:
                err = (rc.stderr or rc.stdout or b'').decode('utf-8', 'replace')
                return jsonify({'error': f'7z 压缩失败: {err.strip()[:200]}'}), 500
            fname = base + '.7z'
        else:
            out_path = os.path.join(tmp_dir, base + '.zip')
            with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_STORED) as zf:
                for root, dirs, files in os.walk(p):
                    for fn in files:
                        fp = os.path.join(root, fn)
                        arc = os.path.relpath(fp, os.path.dirname(p))
                        zf.write(fp, arc)
            fname = base + '.zip'

        @after_this_request
        def cleanup(resp):
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return resp

        return send_file(out_path, as_attachment=True, download_name=fname, max_age=0)
    except subprocess.TimeoutExpired:
        return jsonify({'error': '压缩超时'}), 504
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return jsonify({'error': str(e)}), 500


@fm.route('/mkdir', methods=['POST'])
def mkdir():
    data = request.json or {}
    p = safe_path(data.get('path', ''))
    if not p:
        return jsonify({'error': '无效路径'}), 400
    if os.path.exists(p):
        return jsonify({'error': '路径已存在'}), 409
    try:
        os.makedirs(p, exist_ok=True)
        return jsonify({'message': '已创建'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fm.route('/rename', methods=['POST'])
def rename():
    data = request.json or {}
    p = safe_path(data.get('path', ''))
    new_name = data.get('new_name', '')
    if not p or not os.path.exists(p):
        return jsonify({'error': '路径不存在'}), 404
    new_name = os.path.basename(str(new_name).strip())
    if not new_name or new_name in ('.', '..'):
        return jsonify({'error': '无效的新名称'}), 400
    if '\x00' in new_name or '/' in new_name.replace('\\', '/'):
        return jsonify({'error': '无效的新名称'}), 400
    dest = os.path.join(os.path.dirname(p), new_name)
    try:
        os.rename(p, dest)
        return jsonify({'message': '已重命名'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fm.route('/move', methods=['POST'])
def move():
    data = request.json or {}
    paths = data.get('paths') or []
    dest_raw = data.get('dest', '')
    dest = safe_path(dest_raw)
    if not dest:
        return jsonify({'error': '无效目标路径'}), 400
    if not os.path.isdir(dest):
        return jsonify({'error': '目标目录不存在'}), 404
    done, failed = [], []
    for raw in paths:
        p = safe_path(raw)
        if not p or not os.path.exists(p):
            failed.append(f'{raw}: 不存在')
            continue
        try:
            shutil.move(p, os.path.join(dest, os.path.basename(p.rstrip(os.sep))))
            done.append(raw)
        except Exception as e:
            failed.append(f'{raw}: {e}')
    return jsonify({'moved': done, 'failed': failed})


@fm.route('/copy', methods=['POST'])
def copy():
    data = request.json or {}
    paths = data.get('paths') or []
    dest_raw = data.get('dest', '')
    dest = safe_path(dest_raw)
    if not dest:
        return jsonify({'error': '无效目标路径'}), 400
    if not os.path.isdir(dest):
        return jsonify({'error': '目标目录不存在'}), 404
    done, failed = [], []
    for raw in paths:
        p = safe_path(raw)
        if not p or not os.path.exists(p):
            failed.append(f'{raw}: 不存在')
            continue
        target = os.path.join(dest, os.path.basename(p.rstrip(os.sep)))
        try:
            if os.path.isdir(p):
                shutil.copytree(p, target)
            else:
                shutil.copy2(p, target)
            done.append(raw)
        except Exception as e:
            failed.append(f'{raw}: {e}')
    return jsonify({'copied': done, 'failed': failed})


@fm.route('/delete', methods=['POST'])
def delete():
    data = request.json or {}
    paths = data.get('paths') or []
    done, failed = [], []
    for raw in paths:
        p = safe_path(raw)
        if not p or not os.path.exists(p):
            failed.append(f'{raw}: 不存在')
            continue
        try:
            if os.path.isdir(p) and not os.path.islink(p):
                shutil.rmtree(p)
            else:
                os.remove(p)
            done.append(raw)
        except Exception as e:
            failed.append(f'{raw}: {e}')
    return jsonify({'deleted': done, 'failed': failed})


@fm.route('/hash', methods=['GET'])
def hash_file():
    raw = request.args.get('path', '')
    algo = request.args.get('algo', 'sha256').lower()
    p = safe_path(raw)
    if not p or not os.path.isfile(p):
        return jsonify({'error': '文件不存在'}), 404
    if algo not in ('md5', 'sha1', 'sha256', 'sha512'):
        return jsonify({'error': '不支持的算法'}), 400
    try:
        h = hashlib.new(algo)
        with open(p, 'rb') as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                h.update(chunk)
        return jsonify({'path': p, 'algo': algo, 'hash': h.hexdigest()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fm.route('/unzip', methods=['POST'])
def unzip():
    data = request.json or {}
    arc = safe_path(data.get('archive', ''))
    dest = safe_path(data.get('dest', ''))
    password = data.get('password', '')
    if not arc or not os.path.isfile(arc):
        return jsonify({'error': '压缩包不存在'}), 404
    if not dest or not os.path.isdir(dest):
        return jsonify({'error': '目标目录不存在'}), 404
    ext = os.path.splitext(arc)[1].lower().lstrip('.')
    tmp_dir = None
    try:
        if ext == 'zip':
            with zipfile.ZipFile(arc, 'r') as zf:
                zf.extractall(dest)
            return jsonify({'message': '解压完成'})
        # 7z / rar / tar family -> use 7z CLI
        tmp_dir = tempfile.mkdtemp(prefix='fm_uz_')
        args = [SEVENZ, 'x', '-y', '-o' + tmp_dir, arc]
        if password:
            args.insert(3, '-p' + password)
        rc = subprocess.run(args, capture_output=True, timeout=3600)
        if rc.returncode != 0:
            err = (rc.stderr or rc.stdout or b'').decode('utf-8', 'replace')
            hint = '（密码错误？）' if 'Can not open encrypted archive' in err or 'Wrong password' in err else ''
            return jsonify({'error': f'解压失败: {err.strip()[:200]}{hint}'}), 500
        for item in os.listdir(tmp_dir):
            shutil.move(os.path.join(tmp_dir, item), os.path.join(dest, item))
        return jsonify({'message': '解压完成'})
    except zipfile.BadZipFile:
        return jsonify({'error': '无效的 ZIP 文件'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if tmp_dir:
            shutil.rmtree(tmp_dir, ignore_errors=True)


@fm.route('/archive', methods=['GET', 'POST'])
def archive():
    if request.method == 'POST':
        data = request.json or {}
        paths = data.get('paths') or []
        fmt = data.get('format', 'zip')
        name = os.path.basename(str(data.get('name') or 'archive'))
    else:
        paths = request.args.getlist('paths')
        fmt = request.args.get('format', 'zip')
        name = os.path.basename(str(request.args.get('name') or 'archive'))
    if fmt not in ('zip', '7z'):
        return jsonify({'error': '仅支持 zip / 7z'}), 400
    if not paths:
        return jsonify({'error': '未选择内容'}), 400
    safe_list = []
    for raw in paths:
        p = safe_path(raw)
        if p and os.path.exists(p):
            safe_list.append(p)
    if not safe_list:
        return jsonify({'error': '所选路径无效'}), 400

    tmp_dir = tempfile.mkdtemp(prefix='fm_ar_')
    fname = re.sub(r'[^\w.\-\u4e00-\u9fff]+', '_', name) or 'archive'
    if not fname.lower().endswith('.' + fmt):
        fname += '.' + fmt
    out_path = os.path.join(tmp_dir, fname)
    try:
        common = os.path.commonpath(safe_list) if len(safe_list) > 1 else os.path.dirname(safe_list[0])
        cwd = common
        rels = [os.path.relpath(x, cwd) for x in safe_list]
        if fmt == '7z':
            rc = subprocess.run(
                [SEVENZ, 'a', '-mx=9', '-t7z', out_path] + rels,
                cwd=cwd, capture_output=True, timeout=3600,
            )
            if rc.returncode != 0:
                return jsonify({'error': '7z 压缩失败'}), 500
        else:
            with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for src in safe_list:
                    rel = os.path.relpath(src, cwd)
                    if os.path.isdir(src):
                        for root, dirs, files in os.walk(src):
                            for fn in files:
                                fp = os.path.join(root, fn)
                                zf.write(fp, os.path.relpath(fp, cwd))
                    else:
                        zf.write(src, rel)

        @after_this_request
        def cleanup(resp):
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return resp

        return send_file(out_path, as_attachment=True, download_name=fname, max_age=0)
    except subprocess.TimeoutExpired:
        return jsonify({'error': '压缩超时'}), 504
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return jsonify({'error': str(e)}), 500


@fm.route('/preview', methods=['GET'])
def preview():
    raw = request.args.get('path', '')
    p = safe_path(raw)
    if not p or not os.path.isfile(p):
        return jsonify({'error': '文件不存在'}), 404
    try:
        with open(p, 'rb') as f:
            data = f.read(PREVIEW_LIMIT + 1)
        is_binary = b'\x00' in data[:8192]
        truncated = len(data) > PREVIEW_LIMIT
        if is_binary:
            return jsonify({'binary': True, 'kind': file_kind(p)})
        try:
            text = data[:PREVIEW_LIMIT].decode('utf-8')
        except UnicodeDecodeError:
            text = data[:PREVIEW_LIMIT].decode('gb18030', errors='replace')
        return jsonify({'binary': False, 'truncated': truncated, 'text': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
