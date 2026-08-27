#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""laizhangsetu 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

调用 Lolicon API 获取随机 Pixiv 涩图, 支持标签搜索、R18、图片处理(翻转/高斯模糊)、
排除已见、历史记录与多存储路径。path_stats 内联(旧 plugins.base 解耦)。
路由契约与旧面板一致(fetch/cache//config/cooldown/history/info)。
"""
import os
import re
import random
import json
import hashlib
import shutil
import http.server
import requests as http_req
from datetime import datetime
from PIL import Image, ImageFilter
from io import BytesIO

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

LOLICON_API = 'https://api.lolicon.app/setu/v2'
CACHE_DIR = os.path.join(PLUGIN_DIR, 'cache')
DATA_FILE = os.path.join(PLUGIN_DIR, 'data.json')
SEEN_FILE = os.path.join(PLUGIN_DIR, 'seen.json')
HISTORY_FILE = os.path.join(PLUGIN_DIR, 'history.json')

DEFAULT_CONFIG = {
    'show_info': True,
    'exclude_ai': True,
    'flip_h': False,
    'flip_v': False,
    'auto_revoke': False,
    'revoke_time': 5000,
    'cool_down': 0,
    'blur_chance': 5,
    'r18': False,
    'img_size': 0,
    'proxy': 'i.pixiv.re',
    'exclude_seen': False,
    'storage_paths': [CACHE_DIR],
    'active_path': CACHE_DIR,
    'auto_switch_full': True,
    'full_threshold_mb': 1024,
}


def path_stats(paths):
    """为存储路径列表生成 {path, exists, total, used, free, percent} 统计(旧 plugins.base 内联)。"""
    out = []
    for p in (paths or []):
        item = {'path': p, 'exists': False, 'total': 0, 'used': 0, 'free': 0, 'percent': 0}
        try:
            if os.path.isdir(p):
                item['exists'] = True
                u = shutil.disk_usage(p)
                item.update({'total': u.total, 'used': u.used, 'free': u.free,
                             'percent': round(u.used / u.total * 100, 1) if u.total else 0})
        except Exception:
            pass
        out.append(item)
    return out


def load_config():
    if os.path.isfile(DATA_FILE):
        try:
            cfg = json.load(open(DATA_FILE, 'r', encoding='utf-8'))
        except Exception:
            cfg = {}
    else:
        cfg = {}
    merged = dict(DEFAULT_CONFIG)
    merged.update(cfg)
    paths = merged.get('storage_paths') or []
    if CACHE_DIR not in paths:
        paths.insert(0, CACHE_DIR)
    merged['storage_paths'] = paths
    if merged.get('active_path') not in paths:
        merged['active_path'] = paths[0]
    return merged


def save_config(cfg):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def storage_paths():
    return load_config().get('storage_paths', [CACHE_DIR])


def _dir_writable(path):
    """True if the dir exists and a probe file can be written.
    Uses a real write test because os.access() cannot detect a kernel
    read-only remount (e.g. after disk I/O errors)."""
    try:
        if not os.path.isdir(path):
            return False
        probe = os.path.join(path, '.wtest')
        with open(probe, 'w') as f:
            f.write('1')
        os.remove(probe)
        return True
    except Exception:
        return False


def active_dir():
    cfg = load_config()
    ap = cfg.get('active_path')
    if ap in storage_paths() and _dir_writable(ap):
        return ap
    for p in storage_paths():
        if _dir_writable(p):
            return p
    return storage_paths()[0]


def _dir_free_mb(path):
    try:
        return shutil.disk_usage(path).free // (1024 * 1024)
    except Exception:
        return 0


def pick_dir():
    cfg = load_config()
    paths = storage_paths()
    if not cfg.get('auto_switch_full', True):
        return active_dir()
    threshold = int(cfg.get('full_threshold_mb') or 1024)
    active = active_dir()
    idx = paths.index(active) if active in paths else 0
    n = len(paths)
    for i in range(n):
        cand = paths[(idx + i) % n]
        if _dir_writable(cand) and _dir_free_mb(cand) >= threshold:
            if cand != active:
                cfg['active_path'] = cand
                save_config(cfg)
            return cand
    return active


def load_seen():
    if os.path.isfile(SEEN_FILE):
        try:
            return set(json.load(open(SEEN_FILE, 'r', encoding='utf-8')))
        except Exception:
            pass
    return set()


def save_seen(pids):
    with open(SEEN_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(pids), f)


# ---- 旧 Plugin 基类方法迁移为模块级函数(设置页可插拔接口) ----
def storage_provider():
    cfg = load_config()
    return {
        'name': 'laizhangsetu',
        'label': '图片库存储路径',
        'paths': cfg.get('storage_paths', [CACHE_DIR]),
        'active_path': cfg.get('active_path'),
        'auto_switch_full': cfg.get('auto_switch_full', True),
        'full_threshold_mb': cfg.get('full_threshold_mb', 1024),
    }


def get_setting_schema():
    return [
        {'key': 'storage_paths', 'label': '图片库存储路径', 'type': 'paths'},
        {'key': 'auto_switch_full', 'label': '满盘自动切换', 'type': 'switch',
         'help': '剩余空间低于阈值时自动切换到下一存储路径'},
        {'key': 'full_threshold_mb', 'label': '切换阈值 (MB)', 'type': 'number',
         'help': '剩余空间低于该值时换盘'},
    ]


def get_settings():
    cfg = load_config()
    return {'storage_paths': path_stats(cfg.get('storage_paths', [CACHE_DIR])),
            'active_path': cfg.get('active_path'),
            'auto_switch_full': cfg.get('auto_switch_full', True),
            'full_threshold_mb': cfg.get('full_threshold_mb', 1024)}


def save_settings(data):
    cfg = load_config()
    if 'storage_paths' in data:
        paths = [p for p in data['storage_paths'] if isinstance(p, str) and p.strip()]
        if CACHE_DIR not in paths:
            paths.insert(0, CACHE_DIR)
        cfg['storage_paths'] = paths
        if data.get('active_path') not in paths:
            cfg['active_path'] = paths[0]
        else:
            cfg['active_path'] = data['active_path']
    if 'auto_switch_full' in data:
        cfg['auto_switch_full'] = bool(data['auto_switch_full'])
    if 'full_threshold_mb' in data:
        try:
            cfg['full_threshold_mb'] = int(data['full_threshold_mb'])
        except (TypeError, ValueError):
            pass
    save_config(cfg)
    return True, 'ok'


# 旧插件在注册路由时对 config 做一次快照, /cooldown 返回该快照值
_BOOT_CONFIG = load_config()


def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


def _guess_mime(filename):
    ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
    return {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'webp': 'image/webp', 'gif': 'image/gif',
    }.get(ext, 'image/jpeg')


def _read_history():
    records = []
    if os.path.isfile(HISTORY_FILE):
        try:
            records = json.load(open(HISTORY_FILE, 'r', encoding='utf-8'))
        except Exception:
            pass
    return records


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "laizhangsetu/2.0"

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
            self._json(404, {'error': '图片不存在'})
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def _q(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    # ---- 路由: POST /fetch ----
    def _rt_fetch(self, body):
        try:
            data = body or {}
            cfg = dict(load_config())

            # Accept both 'tags' array and 'tag' string
            tags = data.get('tags') or []
            if not tags:
                tag_str = data.get('tag', '').strip()
                if tag_str:
                    tags = [t.strip() for t in tag_str.split('&') if t.strip()]

            params = {
                'proxy': cfg.get('proxy', 'i.pixiv.re'),
                'excludeAI': 'true' if cfg.get('exclude_ai', True) else '',
                'r18': 2 if cfg.get('r18', False) else 0,
                'size': ['original', 'regular', 'small'][cfg.get('img_size', 0)],
            }

            # Multiple tag params for AND logic; | inside a tag for OR
            if tags:
                params['tag'] = tags if len(tags) > 1 else tags[0]

            params = {k: v for k, v in params.items() if v not in (None, '', 0, False)}

            # Exclude seen PIDs
            seen_pids = load_seen() if cfg.get('exclude_seen', False) else set()
            max_attempts = 10
            attempt = 0
            item = None
            while attempt < max_attempts:
                attempt += 1
                r = http_req.get(LOLICON_API, params=params, timeout=15)
                result = r.json()
                if result.get('error'):
                    return 502, {'error': 'API 错误: %s' % result["error"]}
                items = result.get('data', [])
                if not items:
                    q = '|'.join(tags) if tags else ''
                    return 404, {'error': '没有找到关于 "%s" 的涩图喵!' % q}
                item = items[0]
                pid = item.get('pid')
                if not cfg.get('exclude_seen', False) or pid not in seen_pids:
                    break

            if item is None:
                return 404, {'error': '没有找到新的涩图了喵！'}

            # Mark PID as seen
            if cfg.get('exclude_seen', False):
                seen_pids.add(item.get('pid'))
                if len(seen_pids) > 10000:
                    seen_pids = set(list(seen_pids)[-5000:])
                save_seen(seen_pids)

            urls = item.get('urls', {})
            img_url = urls.get(params.get('size', 'original'), urls.get('original', ''))

            # Download image for processing
            img_resp = http_req.get(img_url, timeout=30)
            img_resp.raise_for_status()
            content_type = img_resp.headers.get('Content-Type', '')
            img_data = BytesIO(img_resp.content)

            try:
                pil_img = Image.open(img_data)
                pil_img.verify()
            except Exception as e:
                err_msg = '图片解析失败 (PID: %s, 大小: %d bytes, Content-Type: %s): %s' % (
                    item.get("pid"), len(img_resp.content), content_type, e)
                return 502, {'error': err_msg}

            img_data.seek(0)
            pil_img = Image.open(img_data)

            if cfg.get('flip_h', False):
                pil_img = pil_img.transpose(Image.FLIP_LEFT_RIGHT)

            if cfg.get('flip_v', False):
                pil_img = pil_img.transpose(Image.FLIP_TOP_BOTTOM)

            blur_chance = cfg.get('blur_chance', 5)
            is_blurred = False
            if blur_chance > 0 and random.randint(0, 99) < blur_chance:
                pil_img = pil_img.filter(ImageFilter.GaussianBlur(radius=20))
                is_blurred = True

            cache_base = pick_dir()
            os.makedirs(cache_base, exist_ok=True)
            safe_name = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff_-]', '_', item.get('title', 'untitled'))[:50]
            cache_path = os.path.join(cache_base, '%s.jpg' % safe_name)
            if pil_img.mode == 'RGBA':
                pil_img = pil_img.convert('RGB')
            pil_img.save(cache_path, 'JPEG', quality=92)

            result_data = {
                'pid': item.get('pid'),
                'uid': item.get('uid'),
                'title': item.get('title'),
                'author': item.get('author'),
                'width': item.get('width'),
                'height': item.get('height'),
                'tags': item.get('tags', []),
                'r18': item.get('r18', False),
                'url': '/api/plugins/laizhangsetu/cache/%s.jpg' % safe_name,
                'original_url': img_url,
                'is_blurred': is_blurred,
                'show_info': cfg.get('show_info', True),
            }

            # Save to history
            history = _read_history()
            history.insert(0, {
                'pid': result_data['pid'],
                'title': result_data['title'],
                'author': result_data['author'],
                'url': result_data['url'],
                'tags': result_data['tags'],
                'r18': result_data['r18'],
                'width': result_data['width'],
                'height': result_data['height'],
                'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            })
            if len(history) > 100:
                history = history[:100]
            json.dump(history, open(HISTORY_FILE, 'w', encoding='utf-8'), ensure_ascii=False)

            return 200, result_data

        except Exception as e:
            return 500, {'error': str(e)}

    # ---- 路由: GET /cache/<path:filename> ----
    def _rt_cache(self, filename):
        for base in storage_paths():
            p = os.path.join(base, filename)
            if os.path.isfile(p):
                self._file(p, _guess_mime(os.path.basename(filename)))
                return None
        return 404, {'error': '图片不存在'}

    # ---- 路由: GET/POST /config ----
    def _rt_config(self, body, is_post):
        if is_post:
            new_cfg = body or {}
            cfg = load_config()
            if 'storage_paths' in new_cfg:
                paths = [p for p in new_cfg['storage_paths'] if isinstance(p, str) and p.strip()]
                if CACHE_DIR not in paths:
                    paths.insert(0, CACHE_DIR)
                cfg['storage_paths'] = paths
                if new_cfg.get('active_path') not in paths:
                    cfg['active_path'] = paths[0]
                else:
                    cfg['active_path'] = new_cfg['active_path']
                if 'auto_switch_full' in new_cfg:
                    cfg['auto_switch_full'] = bool(new_cfg['auto_switch_full'])
                if 'full_threshold_mb' in new_cfg:
                    cfg['full_threshold_mb'] = max(0, int(new_cfg['full_threshold_mb'] or 0))
            else:
                cfg.update(new_cfg)
            save_config(cfg)
            return 200, {'message': '设置已保存', 'config': load_config()}
        return 200, load_config()

    # ---- 路由: GET /cooldown ----
    def _rt_cooldown(self):
        cool_secs = _BOOT_CONFIG.get('cool_down', 0)
        return 200, {'cool_down': cool_secs}

    # ---- 路由: GET/DELETE /history ----
    def _rt_history(self, is_delete):
        if is_delete:
            if os.path.isfile(HISTORY_FILE):
                os.remove(HISTORY_FILE)
            if os.path.isfile(SEEN_FILE):
                os.remove(SEEN_FILE)
            return 200, {'message': '历史已清空'}
        return 200, _read_history()

    # ---- 路由: GET /info (新体系插件元数据) ----
    def _rt_info(self):
        return 200, {'name': 'laizhangsetu', 'label': '来张涩图', 'version': '2.0.0',
                     'lang': 'python',
                     'description': '调用 Lolicon API 获取随机 Pixiv 涩图，支持标签搜索、R18、图片处理'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/cooldown":
                return self._json(*self._rt_cooldown())
            if p == "/history":
                return self._json(*self._rt_history(False))
            if p == "/config":
                return self._json(*self._rt_config({}, False))
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
            try:
                body = json.loads(self._body() or b'{}')
            except Exception:
                body = {}
            if p == "/fetch":
                return self._json(*self._rt_fetch(body))
            if p == "/config":
                return self._json(*self._rt_config(body, True))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_DELETE(self):
        try:
            p = self.path.split('?')[0]
            if p == "/history":
                return self._json(*self._rt_history(True))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    os.makedirs(CACHE_DIR, exist_ok=True)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("laizhangsetu ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()