import os
import json
import time
import csv
import hashlib
import threading
import subprocess
from flask import Blueprint, request, jsonify, send_file, g
import glob
import re
import struct
import zlib
from PIL import Image

try:
    import numpy as np
except ImportError:
    np = None

media = Blueprint('media', __name__, url_prefix='/api/media')

DATA_DIR = os.environ.get('TOUCHGAL_DATA_DIR', '/opt/touchgal/data')
CONF_FILE = os.path.join(DATA_DIR, 'media.json')
THUMBS_DIR = os.path.join(DATA_DIR, 'thumbs')

IMG_EXTS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'}
VIDEO_EXTS = {'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'}

DEFAULT_ROOTS = {
    'aigen': {'label': 'AI 生图', 'path': '/opt/touchgal/plugins/aigen/output'},
    'jmcomic': {'label': '禁漫下载', 'path': '/opt/touchgal/plugins/JMComic/downloads'},
    'laizhangsetu': {'label': '涩图缓存', 'path': '/opt/touchgal/plugins/laizhangsetu/cache'},
}

_thumb_lock = threading.RLock()          # 保护缩略图生成标记
_thumb_sem = threading.BoundedSemaphore(3)   # 并发生成上限, 避免大图库排队卡死
TAGS_FILE = os.path.join(DATA_DIR, 'tags.json')
WD_MODEL_DIR = os.environ.get('TOUCHGAL_WD_MODEL_DIR', '/opt/touchgal/models/wd14-convnextv2')
WD_MODEL = os.path.join(WD_MODEL_DIR, 'model.onnx')
WD_CSV = os.path.join(WD_MODEL_DIR, 'selected_tags.csv')
TAG_GENERAL_TH = 0.35
TAG_CHARACTER_TH = 0.75
TAG_RATING_TH = 0.85
DEDUP_HAMMING = 4
_tags_lock = threading.Lock()
_session = None
_csv_rows = None


def _load_conf():
    cfg = {'roots': []}
    if os.path.isfile(CONF_FILE):
        try:
            with open(CONF_FILE, encoding='utf-8') as f:
                cfg = json.load(f)
        except Exception:
            cfg = {'roots': []}
    if not isinstance(cfg.get('roots'), list):
        cfg['roots'] = []
    names = {r.get('name') for r in cfg['roots']}
    for name, r in DEFAULT_ROOTS.items():
        if name not in names:
            cfg['roots'].append({'name': name, 'label': r['label'], 'path': r['path']})
    return cfg


def _save_conf(cfg):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONF_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def _root_by(ref):
    for r in _load_conf()['roots']:
        if r.get('path') == ref or r.get('name') == ref:
            return r
    return None


def _safe(p):
    if not p:
        return None
    if '\x00' in p:
        return None
    if '..' in p.replace('\\', '/').split('/'):
        return None
    p = os.path.normpath(p)
    return p if os.path.isabs(p) else None


def _in_roots(p):
    real = os.path.realpath(p)
    for r in _load_conf()['roots']:
        base = os.path.realpath(r.get('path', ''))
        if real == base or real.startswith(base + os.sep):
            return True
    return False


def _ext(name):
    return os.path.splitext(name)[1].lstrip('.').lower()


def _media_kind(name):
    e = _ext(name)
    if e in IMG_EXTS:
        return 'image'
    if e in VIDEO_EXTS:
        return 'video'
    return 'file'


@media.route('/roots', methods=['GET'])
def roots():
    out = []
    for r in _load_conf()['roots']:
        p = r.get('path', '')
        st = os.stat(p) if os.path.isdir(p) else None
        out.append({
            'name': r.get('name'), 'label': r.get('label', r.get('name')),
            'path': p, 'exists': os.path.isdir(p),
            'mtime': int(st.st_mtime) if st else 0,
        })
    return jsonify({'roots': out})


@media.route('/roots', methods=['POST'])
def save_roots():
    data = request.json or {}
    roots_in = data.get('roots')
    if not isinstance(roots_in, list):
        return jsonify({'error': '参数错误'}), 400
    clean = []
    for r in roots_in:
        p = str(r.get('path', '')).strip()
        if not p:
            continue
        clean.append({
            'name': str(r.get('name') or os.path.basename(p.rstrip(os.sep))),
            'label': str(r.get('label') or os.path.basename(p.rstrip(os.sep))),
            'path': p,
        })
    _save_conf({'roots': clean})
    return jsonify({'ok': True, 'roots': clean})


@media.route('/list', methods=['GET'])
def media_list():
    root_ref = request.args.get('root', '')
    kind = request.args.get('kind', '')
    tag_filter = request.args.get('tag', '')
    try:
        page = max(0, int(request.args.get('page', 0) or 0))
    except (TypeError, ValueError):
        page = 0
    PAGE = 120
    r = _root_by(root_ref)
    if not r:
        return jsonify({'error': '根目录不存在'}), 400
    base = r['path']
    if not os.path.isdir(base):
        return jsonify({'error': '目录不存在'}), 404

    want = set()
    if kind == 'image':
        want = IMG_EXTS
    elif kind == 'video':
        want = VIDEO_EXTS
    else:
        want = IMG_EXTS | VIDEO_EXTS

    tags_idx = _load_tags_index() if tag_filter else {}
    need_tags = [t.strip().lower() for t in tag_filter.split(',') if t.strip()] if tag_filter else []

    results = []
    try:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for name in files:
                if _ext(name) not in want:
                    continue
                full = os.path.join(root, name)
                if need_tags:
                    entry = tags_idx.get(full)
                    if not entry:
                        continue
                    all_tags = {t.lower() for t in (entry.get('tags') or {}).get('general', [])}
                    all_tags |= {t.lower() for t in (entry.get('tags') or {}).get('character', [])}
                    if not all(t in all_tags for t in need_tags):
                        continue
                try:
                    st = os.lstat(full)
                except OSError:
                    continue
                item = {
                    'name': name, 'path': full, 'kind': _media_kind(name),
                    'size': st.st_size, 'mtime': int(st.st_mtime),
                }
                if tag_filter:
                    item['tags'] = (tags_idx.get(full) or {}).get('tags', {})
                results.append(item)
    except PermissionError:
        return jsonify({'error': '没有权限访问该目录'}), 403

    results.sort(key=lambda x: x['mtime'], reverse=True)
    total = len(results)
    paged = results[page * PAGE:(page + 1) * PAGE]
    return jsonify({'root': base, 'kind': kind, 'page': page, 'total': total, 'items': paged})


def _gen_thumb(src, out):
    k = _media_kind(src)
    if k == 'video':
        rc = subprocess.run(
            ['ffmpeg', '-y', '-ss', '1', '-i', src,
             '-vf', 'scale=256:-2', '-frames:v', '1', '-q:v', '4', out],
            capture_output=True, timeout=60,
        )
        return rc.returncode == 0 and os.path.isfile(out)
    if k == 'image':
        try:
            im = Image.open(src)
            im = im.convert('RGB')
            im.thumbnail((256, 256))
            im.save(out, 'JPEG', quality=80)
            return os.path.isfile(out)
        except Exception:
            return False
    return False


@media.route('/thumb', methods=['GET'])
def thumb():
    p = _safe(request.args.get('path', ''))
    if not p or not os.path.isfile(p) or not _in_roots(p):
        return jsonify({'error': '文件不存在'}), 404
    try:
        st = os.stat(p)
    except OSError:
        return jsonify({'error': '文件不存在'}), 404
    key = hashlib.md5(f'{p}|{st.st_mtime}'.encode('utf-8')).hexdigest()
    out = os.path.join(THUMBS_DIR, key + '.jpg')
    if not os.path.isfile(out):
        os.makedirs(THUMBS_DIR, exist_ok=True)
        marker = out + '.tmp'
        if os.path.isfile(marker):
            return jsonify({'error': '缩略图生成中, 请稍后刷新'}), 202
        with _thumb_lock:
            if not os.path.isfile(out) and not os.path.isfile(marker):
                try:
                    open(marker, 'w').close()
                except OSError:
                    pass
        if os.path.isfile(marker) and not os.path.isfile(out):
            with _thumb_sem:
                ok = _gen_thumb(p, out)
            try:
                os.remove(marker)
            except OSError:
                pass
            if not ok:
                return jsonify({'error': '无法生成缩略图'}), 500
    return send_file(out, mimetype='image/jpeg', max_age=3600)


@media.route('/file', methods=['GET'])
def media_file():
    p = _safe(request.args.get('path', ''))
    if not p or not os.path.isfile(p) or not _in_roots(p):
        return jsonify({'error': '文件不存在'}), 404
    return send_file(p, download_name=os.path.basename(p), max_age=0)


@media.route('/stats', methods=['GET'])
def stats():
    counts = {}
    for r in _load_conf()['roots']:
        base = r['path']
        if not os.path.isdir(base):
            counts[r['name']] = {'image': 0, 'video': 0, 'total': 0}
            continue
        c = {'image': 0, 'video': 0}
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for name in files:
                k = _media_kind(name)
                if k in c:
                    c[k] += 1
        c['total'] = c['image'] + c['video']
        counts[r['name']] = c
    return jsonify({'counts': counts})


# ---------- 智能打标 / 相似去重 ----------

def _get_session():
    global _session
    if _session is None:
        import onnxruntime as ort
        if not os.path.isfile(WD_MODEL):
            raise FileNotFoundError(f'打标模型不存在: {WD_MODEL}')
        _session = ort.InferenceSession(WD_MODEL, providers=['CPUExecutionProvider'])
    return _session


def _get_csv():
    global _csv_rows
    if _csv_rows is None:
        rows = []
        with open(WD_CSV, encoding='utf-8') as f:
            idx = 0
            for r in csv.reader(f):
                if len(r) >= 3:
                    try:
                        cid = int(r[0])
                        cat = int(r[2])
                    except ValueError:
                        continue
                    rows.append({'id': cid, 'index': idx, 'name': r[1], 'category': cat})
                    idx += 1
        _csv_rows = rows
    return _csv_rows


def _load_tags_index():
    if os.path.isfile(TAGS_FILE):
        try:
            with open(TAGS_FILE, encoding='utf-8') as f:
                idx = json.load(f)
            if isinstance(idx, dict):
                return idx
        except Exception:
            pass
    return {}


def _save_tags_index(idx):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(TAGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(idx, f, ensure_ascii=False)


def _tag_image(path):
    img = Image.open(path).convert('RGB').resize((448, 448), Image.BILINEAR)
    x = np.asarray(img, dtype=np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / \
        np.array([0.229, 0.224, 0.225], dtype=np.float32)
    x = x[None]
    session = _get_session()
    inp = session.get_inputs()[0].name
    out = session.run(None, {inp: x})[0][0]
    return 1.0 / (1.0 + np.exp(-out))


def _probs_to_tags(probs, rows):
    general, character, rating = [], [], []
    for row in rows:
        p = float(probs[row['index']])
        if row['category'] == 0 and p >= TAG_GENERAL_TH:
            general.append(row['name'])
        elif row['category'] == 4 and p >= TAG_CHARACTER_TH:
            character.append(row['name'])
        elif row['category'] == 9 and p >= TAG_RATING_TH:
            rating.append(row['name'])
    return {'general': general, 'character': character, 'rating': rating}


@media.route('/tag', methods=['POST'])
def tag():
    data = request.json or {}
    paths = data.get('paths') or ([data.get('path')] if data.get('path') else [])
    paths = [p for p in paths if _safe(p) and _in_roots(p) and os.path.isfile(p)]
    if not paths:
        return jsonify({'error': '无效的文件路径'}), 400
    try:
        rows = _get_csv()
        _get_session()
    except Exception as e:
        return jsonify({'error': f'打标模型加载失败: {e}'}), 500
    idx = _load_tags_index()
    results = []
    for p in paths:
        try:
            probs = _tag_image(p)
            tags = _probs_to_tags(probs, rows)
            with _tags_lock:
                idx[p] = {'tags': tags, 'time': int(time.time())}
            results.append({'path': p, 'tags': tags})
        except Exception as e:
            results.append({'path': p, 'error': str(e)})
    _save_tags_index(idx)
    return jsonify({'results': results})


@media.route('/tags', methods=['GET'])
def tags_for():
    p = _safe(request.args.get('path', ''))
    if not p:
        return jsonify({'error': '无效路径'}), 400
    idx = _load_tags_index()
    return jsonify({'path': p, 'tags': idx.get(p, {}).get('tags', {})})


@media.route('/tags', methods=['DELETE'])
def tags_clear():
    data = request.json or {}
    p = _safe(data.get('path', ''))
    if not p:
        return jsonify({'error': '无效路径'}), 400
    idx = _load_tags_index()
    removed = idx.pop(p, None)
    _save_tags_index(idx)
    return jsonify({'ok': True, 'removed': bool(removed)})


def _dhash(path, size=16):
    img = Image.open(path).convert('L').resize((size + 1, size), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.int16)
    diff = arr[:, 1:] > arr[:, :-1]
    bits = diff.flatten()
    h = 0
    for b in bits[:64]:
        h = (h << 1) | int(b)
    return h


def _hamming(a, b):
    return (a ^ b).bit_count()  # 内置 C 实现, 快于 bin().count('1')


@media.route('/dedup', methods=['POST'])
def dedup():
    data = request.json or {}
    r = _root_by(data.get('root', ''))
    if not r:
        return jsonify({'error': '根目录不存在'}), 400
    base = r['path']
    if not os.path.isdir(base):
        return jsonify({'error': '目录不存在'}), 404
    files = []
    for root, dirs, fs in os.walk(base):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for name in fs:
            if _ext(name) in IMG_EXTS:
                files.append(os.path.join(root, name))
    buckets = {}
    scanned = 0
    # 哈希阶段并行化(PIL 解码 IO 密集, 4 线程分摊)
    import concurrent.futures as _cf

    def _hash_one(p):
        try:
            return _dhash(p)
        except Exception:
            return None

    with _cf.ThreadPoolExecutor(max_workers=4) as _ex:
        for p, h in zip(files, _ex.map(_hash_one, files)):
            if h is None:
                continue
            buckets.setdefault(h & 0xFFFFFF, []).append((h, p))
            scanned += 1
    groups = []
    for bucket in buckets.values():
        if len(bucket) < 2:
            continue
        bucket.sort()
        used = set()
        for i in range(len(bucket)):
            if i in used:
                continue
            grp = [bucket[i][1]]
            for j in range(i + 1, len(bucket)):
                if j in used:
                    continue
                if _hamming(bucket[i][0], bucket[j][0]) <= DEDUP_HAMMING:
                    grp.append(bucket[j][1])
                    used.add(j)
            if len(grp) > 1:
                groups.append(grp)
                used.add(i)
    return jsonify({'groups': groups, 'scanned': scanned})


# ================= 并入工具: 图片/PDF 处理(yulotool.mediatools 迁入) =================
import uuid as _uuid
import zipfile as _zipfile
import shutil as _shutil


def _yt_session():
    d = os.path.join(DATA_DIR, 'sessions')
    os.makedirs(d, exist_ok=True)
    sess = getattr(g, '_yt_sess', None)
    if not sess or not os.path.isdir(sess):
        sess = os.path.join(d, _uuid.uuid4().hex)
        os.makedirs(sess, exist_ok=True)
        g._yt_sess = sess
    return sess


def _yt_save_uploads(fields=('files',)):
    sess = _yt_session()
    saved = []
    for f in request.files.getlist(fields[0] if fields else 'files'):
        if not f or not f.filename:
            continue
        safe = os.path.basename(f.filename)
        path = os.path.join(sess, safe)
        f.save(path)
        saved.append({'path': path, 'filename': safe})
    return saved


def _yt_run(cmd, timeout=600):
    try:
        r = subprocess.run(list(cmd), capture_output=True, text=True, timeout=timeout)
        return {'ok': r.returncode == 0, 'rc': r.returncode, 'out': r.stdout, 'err': r.stderr}
    except Exception as e:
        return {'ok': False, 'rc': 1, 'out': '', 'err': str(e)}


def _yt_tool(name):
    return _shutil.which(name)


def _yt_clean_err(r, sess):
    try:
        _shutil.rmtree(sess)
    except Exception:
        pass
    return ((r.get('err') or '') + ' ' + (r.get('out') or '')).strip()[-200:]


def _yt_zip(files, out):
    with _zipfile.ZipFile(out, 'w') as z:
        for f in files:
            z.write(f, arcname=os.path.basename(f))


def _yt_count_pdf(path):
    tool = _yt_tool('qpdf')
    if not tool:
        return 0
    r = _yt_run([tool, '--show-npages', path])
    try:
        return int((r['out'] or '').strip())
    except Exception:
        return 0


@media.route('/tool/download', methods=['GET'])
def media_tool_file():
    """受限下载: 仅允许取 sessions 目录内文件。"""
    sess = request.args.get('session', '')
    name = request.args.get('file', '')
    if not re.fullmatch(r'[0-9a-fA-F]{32}', sess) or not re.match(r'^[\w. -]{1,120}$', name):
        return jsonify({'error': '非法参数'}), 400
    base = os.path.join(DATA_DIR, 'sessions', sess)
    target = os.path.abspath(os.path.join(base, name))
    if not target.startswith(os.path.abspath(base) + os.sep) or not os.path.isfile(target):
        return jsonify({'error': '文件不存在'}), 404
    return send_file(target, as_attachment=True, download_name=name)


@media.route('/tool/image', methods=['POST'])
def media_tool_image():
    magick = _yt_tool('convert')
    if not magick:
        return jsonify({'ok': False, 'error': '未安装 ImageMagick (imagemagick)'}), 400
    saved = _yt_save_uploads(('files',))
    if not saved:
        return jsonify({'ok': False, 'error': '请上传图片'}), 400
    fmt = (request.form.get('format') or '').lower()
    resize = (request.form.get('resize') or '').strip()
    quality = request.form.get('quality')
    rotate = request.form.get('rotate')
    sess = _yt_session()
    outputs = []
    results = []
    for item in saved:
        src = item['path']
        base, ext = os.path.splitext(item['filename'])
        out_ext = fmt or ext.lstrip('.').lower()
        out = os.path.join(sess, base + '.' + out_ext)
        cmd = [magick, src]
        if resize:
            cmd += ['-resize', resize]
        if quality:
            try:
                cmd += ['-quality', str(int(quality))]
            except (TypeError, ValueError):
                pass
        if rotate:
            try:
                cmd += ['-rotate', str(int(rotate))]
            except (TypeError, ValueError):
                pass
        cmd.append(out)
        r = _yt_run(cmd)
        ok = os.path.isfile(out)
        results.append({'name': item['filename'], 'ok': ok,
                        'error': '' if ok else _yt_clean_err(r, sess),
                        'output': os.path.basename(out) if ok else ''})
        if ok:
            outputs.append(out)
    if len(outputs) == 1:
        return jsonify({'ok': True, 'results': results, 'single': True,
                        'download': '/api/media/tool/download?session=%s&file=%s' % (os.path.basename(sess), os.path.basename(outputs[0]))})
    zpath = os.path.join(sess, 'images_processed.zip')
    _yt_zip(outputs, zpath)
    return jsonify({'ok': True, 'results': results,
                    'download': '/api/media/tool/download?session=%s&file=images_processed.zip' % os.path.basename(sess)})


@media.route('/tool/pdf', methods=['POST'])
def media_tool_pdf():
    qpdf = _yt_tool('qpdf')
    gs = _yt_tool('gs')
    if not qpdf or not gs:
        return jsonify({'ok': False, 'error': '未安装 qpdf 或 ghostscript'}), 400
    action = request.form.get('action') or request.args.get('action') or 'merge'
    saved = _yt_save_uploads(('files',))
    if not saved:
        return jsonify({'ok': False, 'error': '请上传 PDF 文件'}), 400
    files = [f['path'] for f in saved if f['path'].lower().endswith('.pdf')]
    if not files:
        return jsonify({'ok': False, 'error': '未找到 PDF 文件'}), 400
    sess = _yt_session()
    dl = '/api/media/tool/download?session=%s&file=%%s' % os.path.basename(sess)
    if action == 'merge':
        out = os.path.join(sess, 'merged.pdf')
        r = _yt_run([qpdf, '--empty', '--pages'] + files + ['--', out])
        if not r['ok'] or not os.path.isfile(out):
            return jsonify({'ok': False, 'error': _yt_clean_err(r, sess)}), 400
        return jsonify({'ok': True, 'pages': _yt_count_pdf(out), 'download': dl % 'merged.pdf'})
    if action == 'split':
        out_dir = os.path.join(sess, 'pages')
        os.makedirs(out_dir, exist_ok=True)
        r = _yt_run([qpdf, '--split-pages', files[0], os.path.join(out_dir, 'page.pdf')])
        pages = sorted(glob.glob(os.path.join(out_dir, 'page*.pdf')))
        if not r['ok'] or not pages:
            return jsonify({'ok': False, 'error': _yt_clean_err(r, sess)}), 400
        zpath = os.path.join(sess, 'pages.zip')
        _yt_zip(pages, zpath)
        return jsonify({'ok': True, 'pages': len(pages), 'download': dl % 'pages.zip'})
    if action == 'compress':
        try:
            dpi = int(request.form.get('dpi') or 150)
        except (TypeError, ValueError):
            dpi = 150
        out = os.path.join(sess, 'compressed.pdf')
        r = _yt_run([gs, '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4',
                     '-dPDFSETTINGS=/ebook', '-dNOPAUSE', '-dBATCH',
                     '-dDownsampleColorImages=true', '-dColorImageResolution=%d' % dpi,
                     '-sOutputFile=' + out, files[0]])
        if not r['ok'] or not os.path.isfile(out):
            return jsonify({'ok': False, 'error': _yt_clean_err(r, sess)}), 400
        return jsonify({'ok': True, 'input_size': os.path.getsize(files[0]),
                        'output_size': os.path.getsize(out), 'download': dl % 'compressed.pdf'})
    if action == 'extract':
        fmt = (request.form.get('format') or 'png').lower()
        out_dir = os.path.join(sess, 'images')
        os.makedirs(out_dir, exist_ok=True)
        r = _yt_run([gs, '-sDEVICE=png16m', '-r150', '-o',
                     os.path.join(out_dir, 'page_%d.' + fmt), files[0]])
        imgs = sorted(glob.glob(os.path.join(out_dir, 'page_*.' + fmt)))
        if not r['ok'] or not imgs:
            return jsonify({'ok': False, 'error': _yt_clean_err(r, sess)}), 400
        zpath = os.path.join(sess, 'pdf_images.zip')
        _yt_zip(imgs, zpath)
        return jsonify({'ok': True, 'pages': len(imgs), 'download': dl % 'pdf_images.zip'})
    return jsonify({'ok': False, 'error': '未知操作'}), 400



# ================= 并入工具: 媒体(ffmpeg) 与视频融合(videomerge) =================
_YT_MAGIC = b'YLVFUSN1'
_YT_FOOTER = 48
_YT_ZIP = 1


def _yt_stream_copy(src, dst, start=0, size=None):
    with open(src, 'rb') as f:
        if start:
            f.seek(start)
        remain = size if size is not None else -1
        while True:
            if remain == 0:
                break
            b = f.read(min(1024 * 1024, remain if remain > 0 else 1024 * 1024))
            if not b:
                break
            dst.write(b)
            if remain > 0:
                remain -= len(b)


def _yt_crc32_file(path, start=0, size=None):
    h = 0
    with open(path, 'rb') as f:
        if start:
            f.seek(start)
        remain = size if size is not None else -1
        while True:
            if remain == 0:
                break
            b = f.read(min(1024 * 1024, remain if remain > 0 else 1024 * 1024))
            if not b:
                break
            h = zlib.crc32(b, h)
            if remain > 0:
                remain -= len(b)
    return h & 0xFFFFFFFF


def _yt_detect_archive(path):
    try:
        with open(path, 'rb') as f:
            head = f.read(4)
    except Exception:
        return None
    if head[:2] == b'PK':
        return 'zip'
    if head == b'7z\xbc\xaf':
        return '7z'
    if head[:4] == b'Rar!':
        return 'rar'
    if head[:2] == b'\x1f\x8b':
        return 'tgz'
    return None


def _yt_build_footer(arch_type, arch_size, crc):
    return _YT_MAGIC + struct.pack('<BIQ', int(arch_type), int(arch_size), int(crc & 0xFFFFFFFF))


def _yt_parse_footer(data):
    if len(data) < 13 or data[:8] != _YT_MAGIC:
        return None
    try:
        at, size, crc = struct.unpack('<BIQ', data[8:21])
        return {'arch_type': at, 'arch_size': size, 'crc32': crc}
    except Exception:
        return None


def _yt_fix_zip_offsets(fh, video_size, zip_size):
    eocd_off = video_size + zip_size - 22
    if eocd_off < 0:
        return 'no-eocd'
    try:
        fh.seek(eocd_off)
        if fh.read(4) != b'PK\x05\x06':
            return 'eocd-not-found'
        fh.seek(eocd_off)
        eocd = bytearray(fh.read(22))
        cd_off = struct.unpack_from('<I', eocd, 16)[0]
        new_cd = cd_off + video_size
        struct.pack_into('<I', eocd, 16, new_cd)
        fh.seek(eocd_off)
        fh.write(eocd)
        return None
    except Exception as e:
        return str(e)


@media.route('/tool/media', methods=['POST'])
def media_tool_media():
    ffmpeg = _yt_tool('ffmpeg')
    ffprobe = _yt_tool('ffprobe')
    saved = _yt_save_uploads(('file', 'files'))
    if not saved:
        return jsonify({'ok': False, 'error': '请上传媒体文件'}), 400
    action = request.form.get('action') or request.args.get('action') or 'convert'
    sess = _yt_session()
    dl = '/api/media/tool/download?session=%s&file=%%s' % os.path.basename(sess)

    if action == 'info':
        if not ffprobe:
            return jsonify({'ok': False, 'error': '未安装 ffprobe'}), 400
        path = saved[0]['path']
        r = _yt_run([ffprobe, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path])
        try:
            import json as _j
            data = _j.loads(r.get('out') or '{}')
            streams = data.get('streams', [])
            fmt = data.get('format', {})
            video = next((s for s in streams if s.get('codec_type') == 'video'), None)
            audio = next((s for s in streams if s.get('codec_type') == 'audio'), None)
            info = {'name': saved[0]['filename'], 'size': os.path.getsize(path),
                    'duration': fmt.get('duration'), 'bitrate': fmt.get('bit_rate'),
                    'format': fmt.get('format_name'),
                    'video': video.get('codec_name') if video else None,
                    'resolution': '%sx%s' % (video.get('width'), video.get('height')) if video else None,
                    'audio': audio.get('codec_name') if audio else None}
        except Exception as e:
            info = {'error': str(e)[:160], 'raw': (r.get('out') or r.get('err') or '')[:200]}
        return jsonify({'ok': True, 'info': info})

    if not ffmpeg:
        return jsonify({'ok': False, 'error': '未安装 ffmpeg'}), 400
    if action == 'merge':
        files = [f['path'] for f in saved]
        if len(files) < 2:
            return jsonify({'ok': False, 'error': '合并需要至少 2 个文件'}), 400
        lst = os.path.join(sess, 'list.txt')
        with open(lst, 'w') as f:
            for fp in files:
                f.write("file '%s'\n" % fp.replace("'", "'\\''"))
        out = os.path.join(sess, 'merged.mp4')
        r = _yt_run([ffmpeg, '-f', 'concat', '-safe', '0', '-i', lst,
                     '-c', 'copy', '-y', out], 1800)
        if not r['ok'] or not os.path.isfile(out):
            return jsonify({'ok': False, 'error': _yt_clean_err(r, sess)}), 400
        return jsonify({'ok': True, 'download': dl % 'merged.mp4'})

    results = []
    outputs = []
    try:
        try:
            crf = int(request.form.get('crf') or 28)
        except (TypeError, ValueError):
            crf = 28
        fmt = (request.form.get('format') or '').lower()
        for item in saved:
            src = item['path']
            base, ext = os.path.splitext(item['filename'])
            if action == 'extract_audio':
                out_ext = fmt or 'mp3'
                out = os.path.join(sess, base + '.' + out_ext)
                codec = 'libmp3lame' if out_ext == 'mp3' else 'copy'
                cmd = [ffmpeg, '-i', src, '-vn', '-acodec', codec, '-y', out]
            elif action == 'compress':
                out_ext = fmt or ext.lstrip('.').lower() or 'mp4'
                out = os.path.join(sess, base + '_compressed.' + out_ext)
                cmd = [ffmpeg, '-i', src, '-c:v', 'libx264', '-crf', str(crf),
                       '-c:a', 'aac', '-b:a', '128k', '-y', out]
            else:
                out_ext = fmt or ext.lstrip('.').lower() or 'mp4'
                out = os.path.join(sess, base + '.' + out_ext)
                cmd = [ffmpeg, '-i', src, '-c:v', 'libx264', '-crf', str(crf), '-y', out]
            r = _yt_run(cmd, 1800)
            ok = os.path.isfile(out) and os.path.getsize(out) > 0
            results.append({'name': item['filename'], 'ok': ok,
                            'error': '' if ok else _yt_clean_err(r, sess),
                            'output': os.path.basename(out) if ok else ''})
            if ok:
                outputs.append(out)
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)[:200]}), 500
    if len(outputs) == 1:
        return jsonify({'ok': True, 'results': results, 'single': True,
                        'download': dl % os.path.basename(outputs[0])})
    zpath = os.path.join(sess, 'media_processed.zip')
    _yt_zip(outputs, zpath)
    return jsonify({'ok': True, 'results': results, 'download': dl % 'media_processed.zip'})


@media.route('/tool/vmerge', methods=['POST'])
def media_tool_vmerge():
    sess = _yt_session()
    dl = '/api/media/tool/download?session=%s&file=%%s' % os.path.basename(sess)
    action = request.form.get('action') or 'merge'
    saved = _yt_save_uploads(('file', 'files'))

    if action in ('info', 'extract'):
        if not saved:
            return jsonify({'ok': False, 'error': '请上传融合文件'}), 400
        path = saved[0]['path']
        total = os.path.getsize(path)
        with open(path, 'rb') as f:
            f.seek(max(0, total - _YT_FOOTER))
            fmeta = _yt_parse_footer(f.read(_YT_FOOTER))
        if not fmeta:
            return jsonify({'ok': False, 'error': '未检测到 YLVFUSN1 融合尾部'}), 400
        arch_offset = total - _YT_FOOTER - fmeta['arch_size']
        types = {_YT_ZIP: 'ZIP'}
        if action == 'info':
            crc = _yt_crc32_file(path, arch_offset, fmeta['arch_size'])
            return jsonify({'ok': True, 'arch_type': types.get(fmeta['arch_type'], '?'),
                            'arch_size': fmeta['arch_size'], 'arch_offset': arch_offset,
                            'video_size': arch_offset, 'total_size': total,
                            'crc32': '%08x' % fmeta['crc32'],
                            'crc_ok': crc == fmeta['crc32']})
        ext = {_YT_ZIP: 'zip'}.get(fmeta['arch_type'], 'bin')
        out = os.path.join(sess, 'extracted.' + ext)
        with open(out, 'wb') as o:
            _yt_stream_copy(path, o, start=arch_offset, size=fmeta['arch_size'])
        return jsonify({'ok': True, 'arch_type': ext, 'arch_size': fmeta['arch_size'],
                        'download': dl % ('extracted.' + ext)})

    if len(saved) < 2:
        return jsonify({'ok': False, 'error': '请上传视频和压缩包'}), 400
    video = archive = None
    for item in saved:
        if _yt_detect_archive(item['path']):
            archive = item
        else:
            video = item
    if not video or not archive:
        return jsonify({'ok': False, 'error': '需要同时上传一个视频和一个压缩包 (zip/7z/rar)'}), 400
    arch_type = _YT_ZIP
    video_size = os.path.getsize(video['path'])
    arch_size = os.path.getsize(archive['path'])
    out_name = (request.form.get('name') or '').strip() or (os.path.splitext(video['filename'])[0] + '_merged')
    out = os.path.join(sess, out_name + '.mp4')
    crc = _yt_crc32_file(archive['path'])
    with open(out, 'wb') as o:
        _yt_stream_copy(video['path'], o)
        _yt_stream_copy(archive['path'], o)
        o.write(_yt_build_footer(_YT_ZIP, arch_size, crc))
    with open(out, 'r+b') as o:
        err = _yt_fix_zip_offsets(o, video_size, arch_size)
        if err:
            return jsonify({'ok': False, 'error': 'ZIP 偏移修正失败: %s' % err}), 400
    crc = _yt_crc32_file(out, video_size, arch_size)
    with open(out, 'r+b') as o:
        o.seek(video_size + arch_size + 24)
        o.write(struct.pack('<I', crc))
    return jsonify({'ok': True, 'video': video['filename'], 'archive': archive['filename'],
                    'arch_type': 'ZIP', 'arch_size': arch_size,
                    'output_size': os.path.getsize(out), 'crc32': '%08x' % crc,
                    'download': dl % (out_name + '.mp4')})
