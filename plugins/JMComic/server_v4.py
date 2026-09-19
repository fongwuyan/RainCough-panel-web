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


_PAGES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'pages')
import threading as _th
_SERVE_LOCK = _th.BoundedSemaphore(2)   # 阅读/封面解码窗口(与下载 M._cdn_lock 分离)

# 性能统计
_PERF = {'covers_hit': 0, 'covers_miss': 0, 'page_hit': 0, 'page_miss': 0, 'recent_ms': []}
import time as _time


def _perf(mode, hit, ms):
    _PERF['%s_%s' % (mode, 'hit' if hit else 'miss')] = _PERF.get('%s_%s' % (mode, 'hit' if hit else 'miss'), 0) + 1
    _PERF['recent_ms'].append(ms)
    if len(_PERF['recent_ms']) > 50:
        _PERF['recent_ms'] = _PERF['recent_ms'][-50:]


def _page_url(aid, cid, filename):
    return '/api/plugins/JMComic/cache/pages/%s/%s/%s' % (aid, cid, os.path.basename(filename))


def _ensure_page(aid, cid, filename):
    """确保单页图片已缓存, 返回主系统直出 URL(下载本零解码硬链接, 在线本解码缓存)。"""
    cache = _page_cache_path(aid, cid, filename)
    if os.path.isfile(cache):
        return _page_url(aid, cid, filename)
    src = os.path.join(M.album_dir(aid), cid, os.path.basename(filename))
    if os.path.isfile(src):
        try:
            os.makedirs(os.path.dirname(cache), exist_ok=True)
            try:
                os.link(src, cache)
            except OSError:
                import shutil as _sh
                _sh.copyfile(src, cache)
            return _page_url(aid, cid, filename)
        except Exception:
            pass
    t0 = _time.time(); hit = False
    try:
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        with _SERVE_LOCK:
            if os.path.isfile(cache):
                hit = True
                return _page_url(aid, cid, filename)
            data = M._download_image(aid, cid, filename, cache)
            if not data:
                return ''
            M.decode_jm_image(data, M.get_scramble_id(cid), cid, filename, cache)
    except Exception:
        return ''
    finally:
        _perf('page', hit, _time.time() - t0)
    return _page_url(aid, cid, filename)


def _page_cache_path(aid, cid, filename):
    return os.path.join(_PAGES, aid, cid, os.path.basename(filename))


def _chapter_files(aid, cid):
    d = os.path.join(M.album_dir(aid), cid)
    if os.path.isdir(d):
        files = sorted(f for f in os.listdir(d)
                       if f.lower().endswith(('.webp', '.jpg', '.jpeg', '.png', '.gif')))
        if files:
            return files
    try:
        pc = M._load_cache(M.PHOTO_CACHE_FILE)
        entry = pc.get(cid)
        if entry and isinstance(entry, dict) and entry.get('page_arr'):
            return list(entry['page_arr'])
    except Exception:
        pass
    return []


def _ensure_cover(aid):
    """封面缓存(本地 cache/ 优先, 缺失在线取第1章第1页解码), 返回主系统 URL 或 ''。"""
    _CACHE = os.path.join(M.PLUGIN_DIR, 'cache')
    if not aid or not aid.isdigit():
        return ''
    for ext in ('jpg', 'jpeg', 'webp', 'png', 'gif'):
        p = os.path.join(_CACHE, '%s.%s' % (aid, ext))
        if os.path.isfile(p):
            _perf('cover', True, 0.0)
            return '/api/plugins/JMComic/cache/%s.%s' % (aid, ext)
    try:
        client = M.jm()
        album = client.get_album_detail(aid)
        photo_id = str(album.episode_list[0][0])
        if photo_id == '1' and len(album.episode_list) == 1:
            photo_id = str(album.album_id)
        photo = client.get_photo_detail(photo_id)
        if not photo.page_arr:
            return ''
        filename = photo.page_arr[0]
        ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else 'jpg'
        save_path = os.path.join(_CACHE, '%s.%s' % (aid, ext))
        os.makedirs(_CACHE, exist_ok=True)
        with _SERVE_LOCK:
            if os.path.isfile(save_path):
                _perf('cover', True, 0.0)
                return '/api/plugins/JMComic/cache/%s.%s' % (aid, ext)
            data = M._download_image(aid, photo_id, filename, save_path)
            if not data:
                return ''
            M.decode_jm_image(data, photo.scramble_id, photo_id, filename, save_path)
        _perf('cover', False, 0.0)
        return '/api/plugins/JMComic/cache/%s.%s' % (aid, ext)
    except Exception:
        return ''


def _s(params, key, defv=''):
    return str(_p(params).get(key, defv) or defv).strip()


# ---- 搜索内存缓存(5min, ≤50 条 LRU) ----
_SEARCH_CACHE = {}
_SEARCH_MAX = 50


def _search_cache_get(key):
    import time as _t
    hit = _SEARCH_CACHE.get(key)
    if hit and _t.time() - hit[0] < 300:
        return hit[1]
    return None


def _search_cache_set(key, data):
    import time as _t
    _SEARCH_CACHE[key] = (_t.time(), data)
    if len(_SEARCH_CACHE) > _SEARCH_MAX:
        for k in sorted(_SEARCH_CACHE, key=lambda x: _SEARCH_CACHE[x][0])[:len(_SEARCH_CACHE) - _SEARCH_MAX]:
            _SEARCH_CACHE.pop(k, None)


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
    cache_key = '%s|%d|%s' % (keyword, page, mode)
    cached = _search_cache_get(cache_key)
    if cached is not None:
        return cached
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
            _search_cache_set(cache_key, {'items': items, 'total': total, 'page_count': page_count})
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
        data = {'items': items, 'total': getattr(result, 'total', 0),
                'page_count': getattr(result, 'page_count', 1)}
        _search_cache_set(cache_key, data)
        return data
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


@rc.interface("jmcomic.download.cancel")
def jm_download_cancel(params):
    import shutil
    aid = _s(params, 'aid')
    if not aid or not aid.isdigit():
        _err('缺少漫画ID')
    r = M._manager.cancel(aid)
    # 清理临时目录(下载中被取消时清残留)
    for base in M.storage_paths():
        tmp = os.path.join(base, '_tmp_%s' % aid)
        if os.path.isdir(tmp):
            shutil.rmtree(tmp, ignore_errors=True)
    return {'ok': True, 'status': r}


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
    elif task and task['status'] == 'cancelled':
        status = 'cancelled'
    elif task and task['status'] == 'failed':
        status = 'failed'
    elif cached >= total and total > 0:
        status = 'completed'
    elif total == 0 and (cached > 0 or M.is_complete_download(aid)):
        status = 'completed'  # 边界: 元数据缺失但本子已下完(zip/目录存在)
    elif downloaded > 0:
        status = 'downloading'
    else:
        status = 'not_found'
    return {'aid': aid, 'total': total, 'downloaded': downloaded, 'cached': cached, 'status': status}


@rc.interface("jmcomic.cover")
def jm_cover(params):
    """本子封面, 返回主系统直出 URL(缓存 cache/)。"""
    aid = _s(params, 'aid')
    if not aid or not aid.isdigit():
        _err('缺少漫画ID')
    url = _ensure_cover(aid)
    if not url:
        _err('获取封面失败')
    return {'ok': True, 'cover': url}


@rc.interface("jmcomic.covers")
def jm_covers(params):
    """批量封面: {aids:[...]} → {aid: url} (并发≤4, 已缓存短路)。"""
    import concurrent.futures as _cf
    aids = [str(x) for x in (_p(params).get('aids') or []) if str(x).isdigit()]
    if not aids:
        return {'ok': True, 'covers': {}}
    covers = {}
    with _cf.ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(_ensure_cover, a): a for a in aids[:60]}
        for f in _cf.as_completed(futs):
            a = futs[f]
            try:
                u = f.result()
                if u:
                    covers[a] = u
            except Exception:
                pass
    return {'ok': True, 'covers': covers, 'total': len(aids)}


@rc.interface("jmcomic.prefetch")
def jm_prefetch(params):
    """章节图片批量预取: {aid,cid,start,count} → 已缓存页 URL 列表(后台并发解码)。"""
    import concurrent.futures as _cf
    aid = _s(params, 'aid')
    cid = _s(params, 'cid')
    try:
        start = max(0, int(_p(params).get('start') or 0))
        count = max(1, min(int(_p(params).get('count') or 12), 24))
    except (TypeError, ValueError):
        start, count = 0, 12
    if not (aid.isdigit() and cid.isdigit()):
        _err('缺少 aid/cid')
    files = _chapter_files(aid, cid)
    if not files:
        _err('该章节暂无图片')
    batch = files[start:start + count]
    urls = [None] * len(batch)
    with _cf.ThreadPoolExecutor(max_workers=2) as ex:
        futs = {ex.submit(_ensure_page, aid, cid, f): i for i, f in enumerate(batch)}
        for f in _cf.as_completed(futs):
            i = futs[f]
            try:
                urls[i] = f.result()
            except Exception:
                urls[i] = ''
    return {'ok': True, 'start': start, 'count': len(batch), 'total': len(files), 'urls': [u for u in urls if u]}


@rc.interface("jmcomic.image")
def jm_image(params):
    """按需取单张漫画图, 返回主系统直出 URL(代替 base64, 浏览器直连缓存文件)。"""
    aid = _s(params, 'aid')
    cid = _s(params, 'cid')
    filename = _s(params, 'filename')
    if not (aid and cid and filename):
        _err('缺少 aid/cid/filename')
    url = _ensure_page(aid, cid, filename)
    if not url:
        _err('图片加载失败')
    return {'ok': True, 'url': url}


@rc.interface("jmcomic.library.list")
def jm_library_list(params):
    try:
        page = max(int(_p(params).get('page') or 1), 1)
        page_size = max(int(_p(params).get('page_size') or 45), 1)
    except (TypeError, ValueError):
        page, page_size = 1, 45
    snap = _lib_snap_get(force=False)
    items = list(snap) if snap is not None else []
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
    # 立即失效 5s 库缓存, 删除后列表立即反映
    M._library_cache = {'ts': 0, 'data': None}
    _LIB_SNAP['snap'] = None
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



@rc.interface("jmcomic.perf.stats")
def jm_perf_stats(params):
    import statistics as _st
    ms = _PERF.get('recent_ms') or []
    return {'ok': True, 'covers_hit': _PERF.get('covers_hit', 0), 'covers_miss': _PERF.get('covers_miss', 0),
            'page_hit': _PERF.get('page_hit', 0), 'page_miss': _PERF.get('page_miss', 0),
            'recent50_avg_ms': round(_st.mean(ms), 1) if ms else 0.0, 'samples': len(ms)}

@rc.interface("jmcomic.info")
def jm_info(params):
    return {'name': 'jmcomic', 'label': 'JMComic', 'version': '2.0.0', 'lang': 'python',
            'description': '禁漫天堂搜索与漫画阅读'}



# ---- cache/pages LRU 清理(>7天 或 >500MB, 启动后台) ----
_PAGES_MAX_AGE = 7 * 86400
_PAGES_MAX_BYTES = 500 * 1024 * 1024


def _clean_pages():
    try:
        total = 0
        now = _time.time()
        for root, dirs, files in os.walk(_PAGES):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    st = os.stat(fp)
                    total += st.st_size
                    if now - st.st_mtime > _PAGES_MAX_AGE:
                        os.remove(fp)
                except OSError:
                    pass
        if total > _PAGES_MAX_BYTES:
            todo = []
            for root, dirs, files in os.walk(_PAGES):
                for f in files:
                    fp = os.path.join(root, f)
                    try:
                        todo.append((os.path.getmtime(fp), fp))
                    except OSError:
                        pass
            todo.sort()
            freed = 0
            for _, fp in todo:
                if total - freed <= _PAGES_MAX_BYTES * 0.7:
                    break
                try:
                    freed += os.path.getsize(fp)
                    os.remove(fp)
                except OSError:
                    pass
    except Exception:
        pass


def _start_cleaner():
    _th.Thread(target=lambda: (_clean_pages(), print('[jmcomic] cache/pages LRU cleaned')), daemon=True).start()


# ---- 库列表快照(非阻塞: 后台重建, list 返回上次快照) ----
_LIB_SNAP = {'snap': None, 'ts': 0}


def _lib_snap_refresh():
    import time as _t
    try:
        its = M._sorted_library()
        _LIB_SNAP['snap'] = [dict(it, id=str(it.get('aid', ''))) for it in its]
        _LIB_SNAP['ts'] = _t.time()
    except Exception:
        pass


def _lib_snap_get(force):
    import time as _t
    fresh = _LIB_SNAP['snap'] is not None and _t.time() - _LIB_SNAP['ts'] < 5
    if force or not _LIB_SNAP['snap']:
        # 后台刷新, 本次可用现网快照(或无)以免阻塞
        if _LIB_SNAP['snap'] is None:
            _lib_snap_refresh()
        elif not fresh:
            _th.Thread(target=_lib_snap_refresh, daemon=True).start()
    if _t.time() - _LIB_SNAP['ts'] >= 5 and _LIB_SNAP['snap'] is not None:
        _th.Thread(target=_lib_snap_refresh, daemon=True).start()
    return _LIB_SNAP['snap']

if __name__ == "__main__":
    _start_cleaner()
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="JMComic",
        version="2.0.0",
        manifest={"label": "JMComic", "description": "禁漫搜索/阅读/库"},
        frontend={"pages": [{"path": "", "title": "JMComic"}]},
        iface_ids=["jmcomic.search", "jmcomic.meta", "jmcomic.album", "jmcomic.chapter",
                   "jmcomic.cover", "jmcomic.covers", "jmcomic.prefetch", "jmcomic.image",
                   "jmcomic.perf.stats", "jmcomic.download", "jmcomic.download.status",
                   "jmcomic.download.cancel", "jmcomic.library.list", "jmcomic.library.delete",
                   "jmcomic.config.get", "jmcomic.config.save", "jmcomic.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )