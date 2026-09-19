#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""JMComic 插件后端(接口库 v4) — 复用同目录旧 server.py 的禁漫搜索/阅读/库逻辑。"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
import server as M


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _s(params, key, defv=''):
    return str(_p(params).get(key, defv) or defv).strip()


@rc.interface("jmcomic.search")
def jm_search(params):
    keyword = _s(params, 'keyword')
    try:
        page = int(_p(params).get('page') or 1)
    except (TypeError, ValueError):
        page = 1
    mode = _s(params, 'mode', 'keyword')
    if not keyword:
        _err('请输入搜索关键词')
    try:
        client = M.jm()
        if mode == 'tag' and len([t for t in re.split(r'[,，\s]+', keyword) if t]) > 1:
            tags = [t for t in re.split(r'[,，\s]+', keyword) if t]
            items, total, page_count = M._search_tags_intersection(client, tags, page)
            cached_meta = M.load_metadata()
            for item in items:
                m = cached_meta.get(item['id'])
                if m:
                    item['author'] = m.get('author', '')
                    item['tags'] = m.get('tags', [])
            return {'items': items, 'total': total, 'page_count': page_count}
        if mode == 'author':
            result = client.search_author(search_query=keyword, page=page)
        elif mode == 'tag':
            result = client.search_tag(search_query=keyword, page=page)
        elif mode == 'work':
            result = client.search_work(search_query=keyword, page=page)
        else:
            result = client.search_site(search_query=keyword, page=page)
        items = [{'id': str(aid), 'name': name} for aid, name in result]
        cached_meta = M.load_metadata()
        for item in items:
            m = cached_meta.get(item['id'])
            if m:
                item['author'] = m.get('author', '')
                item['tags'] = m.get('tags', [])
        return {'items': items, 'total': getattr(result, 'total', 0),
                'page_count': getattr(result, 'page_count', 1)}
    except Exception as e:
        _err('搜索失败: %s' % e)


@rc.interface("jmcomic.meta")
def jm_meta(params):
    aid = _s(params, 'aid')
    if not aid or not aid.isdigit():
        _err('缺少漫画ID')
    try:
        return M.get_album_meta(M.jm(), aid)
    except Exception as e:
        _err('获取信息失败: %s' % e)


@rc.interface("jmcomic.album")
def jm_album(params):
    import time
    aid = _s(params, 'aid')
    if not aid or not aid.isdigit():
        _err('缺少漫画ID')
    cache = M._load_cache(M.ALBUM_CACHE_FILE)
    entry = cache.get(aid)
    if entry and entry.get('_v') == 2 and time.time() - entry.get('fetched', 0) < 6 * 3600:
        return entry['data']
    local = M.album_from_local(aid)
    if local:
        return local
    try:
        detail = M.jm().get_album_detail(aid)
        lib = M.load_library()
        if aid not in lib:
            lib[aid] = {}
        lib[aid]['name'] = detail.name
        lib[aid]['author'] = detail.author
        lib[aid]['updated'] = int(time.time())
        M.save_library(lib)
        chapters = []
        for ep in detail.episode_list:
            cid = str(ep[0])
            if cid == '1' and len(detail.episode_list) == 1:
                cid = str(detail.album_id)
            chapters.append({'aid': str(detail.album_id), 'cid': cid,
                             'name': ep[2] if len(ep) > 2 else ''})
        data = {
            'id': str(detail.album_id), 'name': detail.name, 'author': detail.author,
            'authors': list(detail.authors) if detail.authors else [],
            'description': detail.description or '',
            'tags': list(detail.tags) if detail.tags else [],
            'likes': detail.likes, 'views': detail.views,
            'comment_count': detail.comment_count, 'page_count': detail.page_count,
            'chapters': chapters,
            'related': [
                {'id': str(r.get('id', '')), 'name': r.get('name', ''), 'author': r.get('author', '')}
                for r in (detail.related_list or [])
            ],
        }
        cache[aid] = {'data': data, 'fetched': int(time.time()), '_v': 2}
        M._save_cache(M.ALBUM_CACHE_FILE, cache)
        return data
    except Exception as e:
        _err('获取漫画详情失败: %s' % e)


@rc.interface("jmcomic.chapter")
def jm_chapter(params):
    import time
    cid = _s(params, 'cid')
    aid = _s(params, 'aid')
    if not cid or not cid.isdigit():
        _err('缺少章节ID')
    if aid and aid.isdigit() and M.is_complete_download(aid):
        d = os.path.join(M.album_dir(aid), cid)
        if os.path.isdir(d):
            files = sorted(f for f in os.listdir(d)
                           if f.lower().endswith(('.webp', '.jpg', '.jpeg', '.png', '.gif')))
            if files:
                return {'id': cid, 'name': '', 'page_arr': files, 'total': len(files)}
    pcache = M._load_cache(M.PHOTO_CACHE_FILE)
    entry = pcache.get(cid)
    if entry and entry.get('_v') == 2:
        return entry
    try:
        photo = M.jm().get_photo_detail(cid)
        M._scramble_cache[str(photo.photo_id)] = str(photo.scramble_id)
        M._persist_scramble()
        data = {'id': str(photo.photo_id), 'name': photo.name, 'author': photo.author,
                'tags': list(photo.tags) if photo.tags else [],
                'scramble_id': str(photo.scramble_id),
                'page_arr': list(photo.page_arr), 'total': len(photo.page_arr)}
        pcache[cid] = data
        pcache.setdefault(cid, {})
        pcache[cid]['_v'] = 2
        M._save_cache(M.PHOTO_CACHE_FILE, pcache)
        return data
    except Exception as e:
        _err('获取章节失败: %s' % e)


@rc.interface("jmcomic.download")
def jm_download(params):
    aid = _s(params, 'aid')
    if not aid or not aid.isdigit():
        _err('缺少漫画ID')
    result = M._manager.enqueue(aid)
    if result == 'cached':
        return {'message': '本子 %s 已缓存' % aid, 'status': 'cached'}
    if result == 'queued':
        return {'message': '本子 %s 已在下载队列中' % aid, 'status': 'queued'}
    return {'message': '开始下载 %s' % aid, 'status': 'downloading'}


@rc.interface("jmcomic.download.status")
def jm_download_status(params):
    aid = _s(params, 'aid')
    if not aid or not aid.isdigit():
        _err('缺少漫画ID')
    cached = M.scan_cached_files(aid)
    tmp = None
    tmp_count = 0
    for base in M.storage_paths():
        p = os.path.join(base, '_tmp_%s' % aid)
        if os.path.isdir(p):
            tmp = p
            break
    if tmp and os.path.isdir(tmp):
        for root, dirs, files in os.walk(tmp):
            for f in files:
                if f.lower().endswith(('.webp', '.jpg', '.jpeg', '.png', '.gif')):
                    tmp_count += 1
    downloaded = cached + tmp_count
    lib = M.load_library()
    entry = lib.get(aid, {})
    total = entry.get('total') or 0
    if total and downloaded > total:
        downloaded = total
    task = M._manager.status(aid)
    if task and task['status'] in ('queued', 'downloading'):
        status = 'downloading'
    elif task and task['status'] == 'failed':
        status = 'failed'
    elif cached >= total and total > 0:
        status = 'completed'
    elif downloaded > 0:
        status = 'downloading'
    else:
        status = 'not_found'
    return {'aid': aid, 'total': total, 'downloaded': downloaded, 'cached': cached, 'status': status}


@rc.interface("jmcomic.cover")
def jm_cover(params):
    """本子封面(本地 cache/ 优先, 缺失则在线取第 1 章第 1 页解码缓存), 返回主系统代发 URL。"""
    aid = _s(params, 'aid')
    if not aid or not aid.isdigit():
        _err('缺少漫画ID')
    _CACHE = os.path.join(M.PLUGIN_DIR, 'cache')

    def _find():
        for ext in ('jpg', 'jpeg', 'webp', 'png', 'gif'):
            p = os.path.join(_CACHE, '%s.%s' % (aid, ext))
            if os.path.isfile(p):
                return p
        return None

    try:
        p = _find()
        if not p:
            client = M.jm()
            album = client.get_album_detail(aid)
            photo_id = str(album.episode_list[0][0])
            if photo_id == '1' and len(album.episode_list) == 1:
                photo_id = str(album.album_id)
            photo = client.get_photo_detail(photo_id)
            if not photo.page_arr:
                _err('该漫画无图片')
            filename = photo.page_arr[0]
            ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else 'jpg'
            save_path = os.path.join(_CACHE, '%s.%s' % (aid, ext))
            os.makedirs(_CACHE, exist_ok=True)
            with M._cdn_lock:
                p = _find()
                if not p:
                    data = M._download_image(aid, photo_id, filename, save_path)
                    if not data:
                        _err('封面下载失败')
                    M.decode_jm_image(data, photo.scramble_id, photo_id, filename, save_path)
                    p = save_path
        ext = os.path.splitext(p)[1][1:] or 'jpg'
        return {'ok': True, 'cover': '/api/plugins/JMComic/cache/%s.%s' % (aid, ext)}
    except Exception as e:
        _err('获取封面失败: %s' % e)


@rc.interface("jmcomic.image")
def jm_image(params):
    """按需取单张漫画图(本地优先, 缺失则下载+解码), 返回 base64 data URL。"""
    import base64 as _b64
    aid = _s(params, 'aid')
    cid = _s(params, 'cid')
    filename = _s(params, 'filename')
    if not (aid and cid and filename):
        _err('缺少 aid/cid/filename')
    local = M.find_local_image(aid, filename)
    if not local:
        path = os.path.join(M.active_dir(), aid, cid, filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with M._cdn_lock:
            p = M.find_local_image(aid, filename)
            if not p:
                data = M._download_image(aid, cid, filename, path)
                if not data:
                    _err('图片加载失败')
                M.decode_jm_image(data, M.get_scramble_id(cid), cid, filename, path)
                p = path
        local = p
    if not os.path.isfile(local):
        _err('图片不存在')
    ext = os.path.splitext(local)[1].lower().lstrip('.') or 'jpg'
    with open(local, 'rb') as f:
        b64 = _b64.b64encode(f.read()).decode()
    return {'ok': True, 'data': 'data:image/%s;base64,%s' % (ext, b64)}


@rc.interface("jmcomic.library.list")
def jm_library_list(params):
    try:
        page = max(int(_p(params).get('page') or 1), 1)
        page_size = max(int(_p(params).get('page_size') or 45), 1)
    except (TypeError, ValueError):
        page, page_size = 1, 45
    items = M._sorted_library()
    # 库条目键为 aid, 前端契约补 id(字符串数字)
    items = [dict(it, id=str(it.get('aid', ''))) for it in items]
    total = len(items)
    start = (page - 1) * page_size
    paged = items[start:start + page_size]
    return {'items': paged, 'total': total, 'page': page, 'page_size': page_size,
            'page_count': (total + page_size - 1) // page_size}


@rc.interface("jmcomic.library.delete")
def jm_library_delete(params):
    import shutil
    aid = _s(params, 'aid')
    for base in M.storage_paths():
        d = os.path.join(base, aid)
        if os.path.isdir(d):
            shutil.rmtree(d, ignore_errors=True)
        zip_path = os.path.join(base, '%s.zip' % aid)
        if os.path.isfile(zip_path):
            os.remove(zip_path)
    lib = M.load_library()
    if aid in lib:
        del lib[aid]
        M.save_library(lib)
    return {'message': '已删除 %s' % aid}


@rc.interface("jmcomic.config.get")
def jm_config_get(params):
    return M.load_config()


@rc.interface("jmcomic.config.save")
def jm_config_save(params):
    new_cfg = _p(params)
    cfg = M.load_config()
    if 'storage_paths' in new_cfg:
        paths = [p for p in new_cfg['storage_paths'] if isinstance(p, str) and p.strip()]
        if M.DOWNLOADS_DIR not in paths:
            paths.insert(0, M.DOWNLOADS_DIR)
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
    M.save_config(cfg)
    return {'message': '设置已保存', 'config': M.load_config()}


@rc.interface("jmcomic.info")
def jm_info(params):
    return {'name': 'jmcomic', 'label': 'JMComic', 'version': '2.0.0', 'lang': 'python',
            'description': '禁漫天堂搜索与漫画阅读'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="JMComic",
        version="2.0.0",
        manifest={"label": "JMComic", "description": "禁漫搜索/阅读/库"},
        frontend={"pages": [{"path": "", "title": "JMComic"}]},
        iface_ids=["jmcomic.search", "jmcomic.meta", "jmcomic.album", "jmcomic.chapter",
                   "jmcomic.cover", "jmcomic.image", "jmcomic.download", "jmcomic.download.status",
                   "jmcomic.library.list", "jmcomic.library.delete",
                   "jmcomic.config.get", "jmcomic.config.save", "jmcomic.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )