import os
import re
import shutil
import tempfile
import zipfile
import hashlib
import subprocess
import time
import threading
import uuid
from flask import Blueprint, request, jsonify, send_file, after_this_request

SEVENZ = '/usr/bin/7z'
if not os.path.isfile(SEVENZ):
    SEVENZ = '7z'

PREVIEW_LIMIT = 512 * 1024
READ_LIMIT_MAX = 5 * 1024 * 1024   # 在线编辑最大读取 5MB
SAVE_LIMIT_MAX = 10 * 1024 * 1024  # 保存最大 10MB
CHUNK_SIZE = 8 * 1024 * 1024

TEXT_EXTS = {
    'txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml', 'ini', 'conf', 'cfg',
    'py', 'js', 'ts', 'html', 'css', 'vue', 'java', 'c', 'cpp', 'h', 'hpp',
    'sh', 'bat', 'ps1', 'sql', 'csv', 'toml', 'php', 'rb', 'go', 'rs',
}
IMG_EXTS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'}
VIDEO_EXTS = {'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'}
AUDIO_EXTS = {'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'}
ARCH_EXTS = {'zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz'}

# 可选根限制: 环境变量 FM_ALLOW_ROOTS=/a,/b 则只允许访问这些路径下; 空 = 不限制
_ALLOW_ROOTS = [os.path.normpath(x) for x in
                os.environ.get('FM_ALLOW_ROOTS', '').split(',') if x.strip()]

fm = Blueprint('filemanager', __name__, url_prefix='/api/fm')

FM_INFO = {
    'name': 'filemanager',
    'label': '文件管理',
    'icon': '',
    'description': '浏览服务器文件系统, 上传下载(分块断点), 增删改, 在线编辑, 预览, 压缩解压, 异步任务',
}


def safe_path(raw):
    if not raw:
        return None
    if '\x00' in raw:
        return None
    if '..' in raw.replace('\\', '/').split('/'):
        return None
    p = os.path.normpath(raw)
    if not os.path.isabs(p):
        return None
    if _ALLOW_ROOTS:
        ok = False
        for r in _ALLOW_ROOTS:
            if p == r or p.startswith(r.rstrip(os.sep) + os.sep):
                ok = True
                break
        if not ok:
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


def detect_encoding(data):
    try:
        data.decode('utf-8')
        return 'utf-8'
    except UnicodeDecodeError:
        return 'gb18030'


def _bad_path():
    return jsonify({'error': '无效路径'}), 400


def _unique_name(dest_dir, name):
    """重名时自动改名 a.txt -> a (1).txt。"""
    base, ext = os.path.splitext(name)
    cand = name
    i = 1
    while os.path.exists(os.path.join(dest_dir, cand)):
        cand = f'{base} ({i}){ext}'
        i += 1
    return cand


# ---------------------------------------------------------------------------
# 异步任务 (复制/移动/删除/打包)
# ---------------------------------------------------------------------------
_TASKS = {}
# RLock: _task_snapshot 会在已持锁的 ops_detail/_task_list 内再次进入
_TASKS_LOCK = threading.RLock()


def _task_snapshot(t):
    with _TASKS_LOCK:
        return {
            'id': t['id'], 'op': t['op'], 'status': t['status'],
            'total': t['total'], 'done': t['done'], 'cancel': bool(t['cancel']),
            'created': t['created'], 'failed': list(t['failed']),
            'result_file': t.get('result_file'), 'error': t.get('error'),
            'name': t.get('name'),
        }


def _task_list():
    with _TASKS_LOCK:
        return [_task_snapshot(t) for t in _TASKS.values()]


def _start_task(op, paths, dest=None, fmt=None, name=None):
    t = {
        'id': uuid.uuid4().hex[:12], 'op': op, 'paths': list(paths),
        'dest': dest, 'fmt': fmt, 'name': name,
        'created': int(time.time()), 'status': 'running',
        'total': len(paths), 'done': 0, 'cancel': False,
        'failed': [], 'result_file': None, 'error': None, 'workdir': None,
    }
    with _TASKS_LOCK:
        _TASKS[t['id']] = t
    threading.Thread(target=_run_task, args=(t['id'],), daemon=True).start()
    return t['id']


def _work_one(t, path):
    op = t['op']
    if op == 'delete':
        if os.path.isdir(path) and not os.path.islink(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
        return
    if op == 'move':
        dest = os.path.join(t['dest'], os.path.basename(path.rstrip(os.sep)))
        dest = _unique_name(t['dest'], os.path.basename(dest))
        shutil.move(path, dest)
        return
    if op == 'copy':
        target = os.path.join(t['dest'], os.path.basename(path.rstrip(os.sep)))
        if os.path.isdir(path) and not os.path.islink(path):
            shutil.copytree(path, _unique_name(t['dest'], os.path.basename(path.rstrip(os.sep))))
        else:
            shutil.copy2(path, _unique_name(t['dest'], os.path.basename(path.rstrip(os.sep))))
        return
    raise ValueError('未知操作: ' + op)


def _run_task(tid):
    with _TASKS_LOCK:
        t = _TASKS.get(tid)
    if not t:
        return
    try:
        if t['op'] == 'archive':
            _run_archive(t)
        else:
            for i, raw in enumerate(t['paths']):
                if t['cancel']:
                    break
                p = safe_path(raw)
                if not p or not os.path.exists(p):
                    t['failed'].append(f'{raw}: 不存在')
                    t['done'] = i + 1
                    continue
                try:
                    _work_one(t, p)
                    t['done'] = i + 1
                except Exception as e:
                    t['failed'].append(f'{raw}: {e}')
                    t['done'] = i + 1
            with _TASKS_LOCK:
                t['status'] = 'cancelled' if t['cancel'] else 'done'
    except Exception as e:
        with _TASKS_LOCK:
            t['status'] = 'error'
            t['error'] = str(e)


def _run_archive(t):
    workdir = tempfile.mkdtemp(prefix='fm_task_')
    t['workdir'] = workdir
    fname = re.sub(r'[^\w.\-\u4e00-\u9fff]+', '_', t.get('name') or 'archive') or 'archive'
    fmt = t.get('fmt') or 'zip'
    if not fname.lower().endswith('.' + fmt):
        fname += '.' + fmt
    out = os.path.join(workdir, fname)
    safe_list = []
    for raw in t['paths']:
        p = safe_path(raw)
        if p and os.path.exists(p):
            safe_list.append(p)
    err = None
    try:
        common = os.path.commonpath(safe_list) if len(safe_list) > 1 else os.path.dirname(safe_list[0])
        if fmt == '7z':
            rels = [os.path.relpath(x, common) for x in safe_list]
            rc = subprocess.run([SEVENZ, 'a', '-mx=9', '-t7z', out] + rels,
                                cwd=common, capture_output=True, timeout=3600)
            if rc.returncode != 0:
                err = '7z 压缩失败'
        else:
            with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
                for src in safe_list:
                    rel = os.path.relpath(src, common)
                    if os.path.isdir(src):
                        for root, dirs, files in os.walk(src):
                            for fn in files:
                                fp = os.path.join(root, fn)
                                zf.write(fp, os.path.relpath(fp, common))
                    else:
                        zf.write(src, rel)
    except Exception as e:
        err = str(e)
    with _TASKS_LOCK:
        if t['cancel']:
            t['status'] = 'cancelled'
        elif err:
            t['status'] = 'error'
            t['error'] = err
        else:
            t['status'] = 'done'
            t['done'] = t['total']
            t['result_file'] = out


@fm.route('/ops', methods=['GET', 'POST'])
def ops():
    if request.method == 'GET':
        return jsonify({'tasks': _task_list()})
    data = request.json or {}
    op = data.get('op')
    paths = data.get('paths') or []
    if op not in ('copy', 'move', 'delete', 'archive'):
        return jsonify({'error': '不支持的 op'}), 400
    if not paths:
        return jsonify({'error': '未选择内容'}), 400
    if op in ('copy', 'move'):
        dest = safe_path(data.get('dest', ''))
        if not dest or not os.path.isdir(dest):
            return jsonify({'error': '目标目录不存在'}), 404
    else:
        dest = None
    tid = _start_task(op, paths, dest=dest, fmt=data.get('format'), name=data.get('name'))
    return jsonify({'task_id': tid, 'status': 'running'})


@fm.route('/ops/<tid>', methods=['GET', 'DELETE'])
def ops_detail(tid):
    with _TASKS_LOCK:
        t = _TASKS.get(tid)
        if not t:
            return jsonify({'error': '任务不存在'}), 404
        snap = _task_snapshot(t)
        if request.method == 'DELETE' and t['status'] in ('done', 'error', 'cancelled'):
            del _TASKS[tid]
            wd = t.get('workdir')
            if wd and os.path.isdir(wd):
                shutil.rmtree(wd, ignore_errors=True)
            return jsonify({'removed': tid})
    return jsonify(snap)


@fm.route('/ops/<tid>/cancel', methods=['POST'])
def ops_cancel(tid):
    with _TASKS_LOCK:
        t = _TASKS.get(tid)
        if not t:
            return jsonify({'error': '任务不存在'}), 404
        if t['status'] == 'running':
            t['cancel'] = True
    return jsonify({'cancelled': True})


@fm.route('/ops/<tid>/download', methods=['GET'])
def ops_download(tid):
    with _TASKS_LOCK:
        t = _TASKS.get(tid)
        if not t:
            return jsonify({'error': '任务不存在'}), 404
        if t['status'] != 'done' or not t.get('result_file'):
            return jsonify({'error': '任务未完成或不是打包任务'}), 400
        rf = t['result_file']
        name = os.path.basename(rf)
    return send_file(rf, as_attachment=True, download_name=name, max_age=0)


# ---------------------------------------------------------------------------
# 基础 CRUD
# ---------------------------------------------------------------------------
@fm.route('/info', methods=['GET'])
def info():
    return jsonify(FM_INFO)


@fm.route('/list', methods=['GET'])
def list_dir():
    raw = request.args.get('path', '')
    p = safe_path(raw)
    if not p:
        return _bad_path()
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
            is_link = os.path.islink(full)
            items.append({
                'name': name,
                'path': full,
                'is_dir': is_dir,
                'is_link': is_link,
                'link_target': os.readlink(full) if is_link else '',
                'size': 0 if is_dir else st.st_size,
                'mtime': int(st.st_mtime),
                'mode': oct(st.st_mode & 0o7777)[2:],
                'hidden': name.startswith('.'),
                'kind': 'dir' if is_dir else file_kind(name),
            })
        items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
        return jsonify({'path': p, 'parent': os.path.dirname(p), 'items': items})
    except PermissionError:
        return jsonify({'error': '没有权限访问该目录'}), 403
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fm.route('/search', methods=['GET'])
def search():
    raw = request.args.get('path', '/')
    p = safe_path(raw)
    if not p:
        return _bad_path()
    if not os.path.isdir(p):
        return jsonify({'error': '目录不存在'}), 404
    q = request.args.get('q', '').strip().lower()
    kind = request.args.get('kind', '')
    min_size = request.args.get('min_size', '')
    max_size = request.args.get('max_size', '')
    days = request.args.get('mtime_days', '')
    limit = 500
    try:
        offset = max(0, int(float(request.args.get('offset', 0))))
    except (TypeError, ValueError):
        offset = 0
    try:
        min_b = int(float(min_size)) if min_size else None
        max_b = int(float(max_size)) if max_size else None
        days_i = int(float(days)) if days else None
    except (TypeError, ValueError):
        return jsonify({'error': '无效的大小或时间参数'}), 400

    now = time.time()
    collected = []
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
                if len(collected) >= offset + limit + 1:
                    break
                full = os.path.join(root, name)
                if match(full, name, False):
                    try:
                        st = os.lstat(full)
                        collected.append({
                            'name': name, 'path': full, 'is_dir': False,
                            'is_link': os.path.islink(full),
                            'size': st.st_size, 'mtime': int(st.st_mtime),
                            'kind': file_kind(name),
                        })
                    except OSError:
                        pass
            if len(collected) >= offset + limit + 1:
                break
        collected.sort(key=lambda x: x['mtime'], reverse=True)
        results = collected[offset:offset + limit]
        return jsonify({
            'path': p, 'q': q, 'results': results, 'offset': offset, 'limit': limit,
            'has_more': len(collected) > offset + limit,
            'shown': len(results),
        })
    except PermissionError:
        return jsonify({'error': '没有权限访问该目录'}), 403
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fm.route('/mkdir', methods=['POST'])
def mkdir():
    data = request.json or {}
    p = safe_path(data.get('path', ''))
    if not p:
        return _bad_path()
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
    dest = safe_path(data.get('dest', ''))
    if not dest:
        return _bad_path()
    if not os.path.isdir(dest):
        return jsonify({'error': '目标目录不存在'}), 404
    done, failed = [], []
    for raw in data.get('paths') or []:
        p = safe_path(raw)
        if not p or not os.path.exists(p):
            failed.append(f'{raw}: 不存在')
            continue
        try:
            shutil.move(p, _unique_name(dest, os.path.basename(p.rstrip(os.sep))))
            done.append(raw)
        except Exception as e:
            failed.append(f'{raw}: {e}')
    return jsonify({'moved': done, 'failed': failed})


@fm.route('/copy', methods=['POST'])
def copy():
    data = request.json or {}
    dest = safe_path(data.get('dest', ''))
    if not dest:
        return _bad_path()
    if not os.path.isdir(dest):
        return jsonify({'error': '目标目录不存在'}), 404
    done, failed = [], []
    for raw in data.get('paths') or []:
        p = safe_path(raw)
        if not p or not os.path.exists(p):
            failed.append(f'{raw}: 不存在')
            continue
        try:
            base = os.path.basename(p.rstrip(os.sep))
            target = _unique_name(dest, base)
            if os.path.isdir(p) and not os.path.islink(p):
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
    done, failed = [], []
    for raw in data.get('paths') or []:
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


# ---------------------------------------------------------------------------
# 上传 (普通 / 分块)
# ---------------------------------------------------------------------------
@fm.route('/upload', methods=['POST'])
def upload():
    raw = request.form.get('path', '')
    p = safe_path(raw)
    if not p:
        return _bad_path()
    if not os.path.isdir(p):
        return jsonify({'error': '目录不存在'}), 404
    conflict = request.form.get('conflict', 'rename')
    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': '未选择文件'}), 400
    saved, errors = [], []
    for f in files:
        if not f or not f.filename:
            continue
        name = os.path.basename(f.filename)
        if not name:
            continue
        dest = os.path.join(p, name)
        try:
            if conflict == 'overwrite' or not os.path.exists(dest):
                f.save(dest)
            else:
                f.save(os.path.join(p, _unique_name(p, name)))
            saved.append(name)
        except Exception as e:
            errors.append(f'{name}: {e}')
    return jsonify({'saved': saved, 'errors': errors})


@fm.route('/upload/chunk', methods=['POST'])
def upload_chunk():
    raw = request.form.get('path', '')
    p = safe_path(raw)
    if not p:
        return _bad_path()
    if not os.path.isdir(p):
        return jsonify({'error': '目录不存在'}), 404
    filename = os.path.basename(request.form.get('filename', ''))
    file_id = request.form.get('file_id', '')
    try:
        idx = int(request.form.get('chunk_index', -1))
        total = int(request.form.get('total_chunks', -1))
    except (TypeError, ValueError):
        return jsonify({'error': '无效分片参数'}), 400
    f = request.files.get('chunk')
    if not filename or not file_id or idx < 0 or total < 1 or not f:
        return jsonify({'error': '参数不完整'}), 400
    tmp_root = os.path.join(tempfile.gettempdir(), 'fm_upload')
    part_dir = os.path.join(tmp_root, file_id)
    try:
        os.makedirs(part_dir, exist_ok=True)
        part = os.path.join(part_dir, f'part_{idx:06d}')
        f.save(part)
    except Exception as e:
        return jsonify({'error': f'分片写入失败: {e}'}), 500
    if idx < total - 1:
        return jsonify({'ok': True, 'received': idx, 'complete': False})
    # 最后一片: 先核对分片齐全与磁盘余量, 再按序合并
    parts = [os.path.join(part_dir, f'part_{i:06d}') for i in range(total)]
    try:
        for i, part in enumerate(parts):
            if not os.path.isfile(part):
                raise RuntimeError(f'缺少分片 part_{i}')
        total_bytes = 0
        for part in parts:
            try:
                total_bytes += os.path.getsize(part)
            except OSError:
                pass
        du = shutil.disk_usage(p)
        if total_bytes > du.free:
            shutil.rmtree(part_dir, ignore_errors=True)
            return jsonify({'error': '磁盘空间不足, 已中止合并'}), 507
    except Exception as e:
        shutil.rmtree(part_dir, ignore_errors=True)
        return jsonify({'error': f'校验失败: {e}'}), 500
    dest_name = _unique_name(p, filename) if request.form.get('conflict', 'rename') == 'rename' and os.path.exists(os.path.join(p, filename)) else filename
    dest = os.path.join(p, dest_name)
    try:
        with open(dest, 'wb') as out:
            for part in parts:
                with open(part, 'rb') as pf:
                    shutil.copyfileobj(pf, out)
        shutil.rmtree(part_dir, ignore_errors=True)
        return jsonify({'ok': True, 'complete': True, 'path': dest, 'name': dest_name})
    except Exception as e:
        shutil.rmtree(part_dir, ignore_errors=True)
        return jsonify({'error': f'合并失败: {e}'}), 500


# ---------------------------------------------------------------------------
# 下载 / 预览 / 编辑
# ---------------------------------------------------------------------------
@fm.route('/download', methods=['GET'])
def download():
    raw = request.args.get('path', '')
    mode = request.args.get('mode', 'direct')
    p = safe_path(raw)
    if not p:
        return _bad_path()
    if not os.path.exists(p):
        return jsonify({'error': '文件或目录不存在'}), 404

    base = os.path.basename(p.rstrip(os.sep)) or 'root'
    if os.path.isfile(p):
        return send_file(p, as_attachment=True, download_name=base, max_age=0)

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


@fm.route('/read', methods=['GET'])
def read_file():
    raw = request.args.get('path', '')
    p = safe_path(raw)
    if not p or not os.path.isfile(p):
        return jsonify({'error': '文件不存在'}), 404
    try:
        offset = max(0, int(float(request.args.get('offset', 0))))
    except (TypeError, ValueError):
        offset = 0
    try:
        limit = int(float(request.args.get('limit', PREVIEW_LIMIT)))
    except (TypeError, ValueError):
        limit = PREVIEW_LIMIT
    limit = PREVIEW_LIMIT if limit < 1 else min(READ_LIMIT_MAX, limit)
    try:
        size = os.path.getsize(p)
        with open(p, 'rb') as f:
            f.seek(offset)
            data = f.read(limit)
        enc = detect_encoding(data)
        text = data.decode(enc, errors='replace')
        return jsonify({
            'path': p, 'offset': offset, 'size': size,
            'encoding': enc, 'truncated': offset + len(data) < size,
            'text': text,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fm.route('/save', methods=['POST'])
def save():
    data = request.json or {}
    p = safe_path(data.get('path', ''))
    if not p:
        return _bad_path()
    content = data.get('content', '')
    if isinstance(content, str):
        content = content.encode('utf-8')
    if len(content) > SAVE_LIMIT_MAX:
        return jsonify({'error': '内容过大(>10MB)'}), 413
    enc = str(data.get('encoding') or 'utf-8')
    if enc not in ('utf-8', 'gb18030', 'gbk', 'ascii', 'latin-1'):
        enc = 'utf-8'
    try:
        with open(p, 'wb') as f:
            f.write(content)
        return jsonify({'message': '已保存', 'path': p, 'size': len(content)})
    except Exception as e:
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
        enc = detect_encoding(data)
        text = data[:PREVIEW_LIMIT].decode(enc, errors='replace')
        return jsonify({'binary': False, 'truncated': truncated, 'encoding': enc, 'text': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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


# ---------------------------------------------------------------------------
# 压缩 / 解压 / 目录大小
# ---------------------------------------------------------------------------
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
                for m in zf.namelist():
                    norm = m.replace('\\', '/')
                    if norm.startswith('/') or '..' in norm.split('/'):
                        return jsonify({'error': '压缩包含非法路径, 已拒绝解压'}), 400
                zf.extractall(dest)
            return jsonify({'message': '解压完成'})
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


@fm.route('/size', methods=['POST'])
def size():
    data = request.json or {}
    paths = data.get('paths') or []
    sizes = {}
    for raw in paths[:200]:
        p = safe_path(raw)
        if not p or not os.path.exists(p):
            continue
        if os.path.isfile(p):
            try:
                sizes[p] = os.path.getsize(p)
            except OSError:
                pass
            continue
        try:
            rc = subprocess.run(['du', '-sb', p], capture_output=True, timeout=60)
            if rc.returncode == 0:
                sizes[p] = int(rc.stdout.split(b'\t')[0])
                continue
        except Exception:
            pass
        # 兜底: python 遍历
        total = 0
        try:
            for root, dirs, files in os.walk(p):
                for fn in files:
                    try:
                        total += os.path.getsize(os.path.join(root, fn))
                    except OSError:
                        pass
        except Exception:
            pass
        sizes[p] = total
    return jsonify({'sizes': sizes})
