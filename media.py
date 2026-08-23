import os
import json
import time
import csv
import hashlib
import threading
import subprocess
from flask import Blueprint, request, jsonify, send_file
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
