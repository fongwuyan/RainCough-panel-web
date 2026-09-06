#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""laizhangsetu 插件后端(接口库 v4) — 由 v3 server.py 迁移。

调用 Lolicon API 获取随机 Pixiv 涩图, 支持标签搜索、R18、图片处理(翻转/高斯模糊)、
排除已见、历史记录与多存储路径。数据沿用插件目录 data.json/seen.json/history.json/cache。
图片浏览: 前端用 /api/plugins/laizhangsetu/cache/<file>(主系统代发, 无端口)。
"""
import os
import re
import random
import json
import hashlib
import shutil
import sys
import requests as http_req
from datetime import datetime
from PIL import Image, ImageFilter
from io import BytesIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
LOLICON_API = 'https://api.lolicon.app/setu/v2'
CACHE_DIR = os.path.join(PLUGIN_DIR, 'cache')
DATA_FILE = os.path.join(PLUGIN_DIR, 'data.json')
SEEN_FILE = os.path.join(PLUGIN_DIR, 'seen.json')
HISTORY_FILE = os.path.join(PLUGIN_DIR, 'history.json')

DEFAULT_CONFIG = {
    'show_info': True, 'exclude_ai': True, 'flip_h': False, 'flip_v': False,
    'auto_revoke': False, 'revoke_time': 5000, 'cool_down': 0, 'blur_chance': 5,
    'r18': False, 'img_size': 0, 'proxy': 'i.pixiv.re', 'exclude_seen': False,
    'storage_paths': [CACHE_DIR], 'active_path': CACHE_DIR,
    'auto_switch_full': True, 'full_threshold_mb': 1024,
}

_BOOT_CONFIG = None  # 启动时快照(供 cooldown)


def path_stats(paths):
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


def _read_history():
    records = []
    if os.path.isfile(HISTORY_FILE):
        try:
            records = json.load(open(HISTORY_FILE, 'r', encoding='utf-8'))
        except Exception:
            pass
    return records


def _fetch_one(cfg, tags):
    """取一张图并落盘(处理/历史); 返回展示记录或抛 RCError。"""
    params = {
        'proxy': cfg.get('proxy', 'i.pixiv.re'),
        'excludeAI': 'true' if cfg.get('exclude_ai', True) else '',
        'r18': 2 if cfg.get('r18', False) else 0,
        'size': ['original', 'regular', 'small'][cfg.get('img_size', 0)],
    }
    if tags:
        params['tag'] = tags if len(tags) > 1 else tags[0]
    params = {k: v for k, v in params.items() if v not in (None, '', 0, False)}

    seen_pids = load_seen() if cfg.get('exclude_seen', False) else set()
    item = None
    for _ in range(10):
        r = http_req.get(LOLICON_API, params=params, timeout=15)
        result = r.json()
        if result.get('error'):
            raise rc.RCError(3000, 'API 错误: %s' % result['error'])
        items = result.get('data', [])
        if not items:
            raise rc.RCError(3000, '没有找到关于 "%s" 的涩图喵!' % ('|'.join(tags) if tags else ''))
        item = items[0]
        pid = item.get('pid')
        if not cfg.get('exclude_seen', False) or pid not in seen_pids:
            break
        item = None
    if item is None:
        raise rc.RCError(3000, '没有找到新的涩图了喵！')

    if cfg.get('exclude_seen', False):
        seen_pids.add(item.get('pid'))
        if len(seen_pids) > 10000:
            seen_pids = set(list(seen_pids)[-5000:])
        save_seen(seen_pids)

    urls = item.get('urls', {})
    size_key = ['original', 'regular', 'small'][cfg.get('img_size', 0)]
    img_url = urls.get(size_key, urls.get('original', ''))

    img_resp = http_req.get(img_url, timeout=30)
    img_resp.raise_for_status()
    img_data = BytesIO(img_resp.content)
    try:
        pil_img = Image.open(img_data)
        pil_img.verify()
    except Exception as e:
        raise rc.RCError(3000, '图片解析失败 (PID: %s, 大小: %d): %s' % (item.get('pid'), len(img_resp.content), e))
    img_data.seek(0)
    pil_img = Image.open(img_data)

    if cfg.get('flip_h', False):
        pil_img = pil_img.transpose(Image.FLIP_LEFT_RIGHT)
    if cfg.get('flip_v', False):
        pil_img = pil_img.transpose(Image.FLIP_TOP_BOTTOM)
    is_blurred = False
    if cfg.get('blur_chance', 5) > 0 and random.randint(0, 99) < cfg.get('blur_chance', 5):
        pil_img = pil_img.filter(ImageFilter.GaussianBlur(radius=20))
        is_blurred = True

    cache_base = pick_dir()
    os.makedirs(cache_base, exist_ok=True)
    safe_name = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff_-]', '_', item.get('title', 'untitled'))[:50]
    cache_path = os.path.join(cache_base, '%s.jpg' % safe_name)
    if pil_img.mode == 'RGBA':
        pil_img = pil_img.convert('RGB')
    pil_img.save(cache_path, 'JPEG', quality=92)

    record = {
        'pid': item.get('pid'), 'uid': item.get('uid'), 'title': item.get('title'),
        'author': item.get('author'), 'width': item.get('width'), 'height': item.get('height'),
        'tags': item.get('tags', []), 'r18': item.get('r18', False),
        'url': '/api/plugins/laizhangsetu/cache/%s.jpg' % safe_name,
        'original_url': img_url, 'is_blurred': is_blurred,
        'show_info': cfg.get('show_info', True),
    }
    history = _read_history()
    history.insert(0, {
        'pid': record['pid'], 'title': record['title'], 'author': record['author'],
        'url': record['url'], 'tags': record['tags'], 'r18': record['r18'],
        'width': record['width'], 'height': record['height'],
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    })
    if len(history) > 100:
        history = history[:100]
    json.dump(history, open(HISTORY_FILE, 'w', encoding='utf-8'), ensure_ascii=False)
    return record


# ---- 接口实现(路由逐一对齐) ----

@rc.interface("laizhangsetu.fetch")
def ls_fetch(params):
    cfg = dict(load_config())
    data = params if isinstance(params, dict) else {}
    tags = data.get('tags') or []
    if not tags:
        tag_str = str(data.get('tag', '')).strip()
        if tag_str:
            tags = [t.strip() for t in tag_str.split('&') if t.strip()]
    record = _fetch_one(cfg, tags)
    return {'items': [record]}


@rc.interface("laizhangsetu.config.get")
def ls_config_get(params):
    return load_config()


@rc.interface("laizhangsetu.config.save")
def ls_config_save(params):
    data = params if isinstance(params, dict) else {}
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
                cfg['full_threshold_mb'] = max(0, int(data['full_threshold_mb'] or 0))
            except (TypeError, ValueError):
                pass
    else:
        cfg.update(data)
    save_config(cfg)
    return {'message': '设置已保存', 'config': load_config()}


@rc.interface("laizhangsetu.settings")
def ls_settings(params):
    cfg = load_config()
    return {'storage_paths': path_stats(cfg.get('storage_paths', [CACHE_DIR])),
            'active_path': cfg.get('active_path'),
            'auto_switch_full': cfg.get('auto_switch_full', True),
            'full_threshold_mb': cfg.get('full_threshold_mb', 1024)}


@rc.interface("laizhangsetu.history.list")
def ls_history_list(params):
    return {'history': _read_history()}


@rc.interface("laizhangsetu.history.clear")
def ls_history_clear(params):
    for f in (HISTORY_FILE, SEEN_FILE):
        if os.path.isfile(f):
            try:
                os.remove(f)
            except Exception:
                pass
    return {'message': '历史已清空'}


@rc.interface("laizhangsetu.cooldown")
def ls_cooldown(params):
    global _BOOT_CONFIG
    if _BOOT_CONFIG is None:
        _BOOT_CONFIG = load_config()
    return {'cool_down': _BOOT_CONFIG.get('cool_down', 0)}


@rc.interface("laizhangsetu.info")
def ls_info(params):
    return {'name': 'laizhangsetu', 'label': '来张涩图', 'version': '2.0.0', 'lang': 'python',
            'description': '调用 Lolicon API 获取随机 Pixiv 涩图，支持标签搜索、R18、图片处理'}


if __name__ == "__main__":
    _BOOT_CONFIG = load_config()
    os.makedirs(CACHE_DIR, exist_ok=True)
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="laizhangsetu",
        version="2.0.0",
        manifest={"label": "来张涩图", "description": "Lolicon 随机涩图"},
        frontend={"pages": [{"path": "", "title": "来张涩图"}]},
        iface_ids=[
            "laizhangsetu.fetch", "laizhangsetu.config.get", "laizhangsetu.config.save",
            "laizhangsetu.settings", "laizhangsetu.history.list", "laizhangsetu.history.clear",
            "laizhangsetu.cooldown", "laizhangsetu.info",
        ],
        plugin_dir=PLUGIN_DIR,
    )