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
# 阅读/封面解码窗口(与下载 M._cdn_lock 分离)。
# 原来是 2 —— 列表页一次要出 20+ 个封面，每个未命中的封面要 3 次串行网络请求
# (album detail / photo detail / 图片下载)，只有 2 个并发时整页封面要等十几秒。
# 提到 6：实际并发仍受 server.py 的 _cdn_lock(4) 约束，不会把站点打爆。
_SERVE_LOCK = _th.BoundedSemaphore(6)

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


# 正在生成封面的 aid 集合。
#
# ★ 为什么需要：生成一个封面要 3 次网络请求（album detail / photo detail / 图片下载），
#   实测 1~2 秒。列表一次请求 12 个，4 秒超时内只能完成一部分。
#   前端会重试，如果每次重试都重新提交任务，同一个 aid 会被反复生成 ——
#   既浪费带宽，又因为 _SERVE_LOCK 竞争把批次拖得更慢。
#   用这张表保证：同一 aid 同时只有一个生成任务，其余请求直接返回"还没好"。
_COVER_INFLIGHT = set()
_COVER_INFLIGHT_LOCK = _th.Lock()

# 确认拿不到封面的 aid（本子无图 / 取图失败）。
# 记下来有两个作用：不必反复重试；顺序裁剪时可以跳过它，避免堵住后面。
_COVER_FAILED = set()
_COVER_FAILED_MAX = 5000


# 封面缩略图尺寸：卡片最宽也就 120dp，360px 已经足够（3x 屏也清晰）
COVER_THUMB_W = 360
COVER_THUMB_H = 540


def _cover_cache_dir():
    return os.path.join(M.PLUGIN_DIR, 'cache')


def _cover_url(name):
    return '/api/plugins/JMComic/cache/%s' % name


def _thumb_path(aid):
    return os.path.join(_cover_cache_dir(), '%s_t.webp' % aid)


def _make_thumb(src_path, aid):
    """把封面原图裁成 2:3 缩略图。

    ★ 为什么要这步：JM 的"封面"其实是漫画第一页 —— 实测一张 960x3840 的
      长条图，217KB。卡片只有 72~120dp 宽，等于为了显示一个缩略图
      下载并解码了十几倍的像素。这是"封面加载缓慢"的主因。
      裁成 360x540 后约 15~30KB，解码也快一个数量级。
    """
    try:
        from PIL import Image
        thumb = _thumb_path(aid)
        if os.path.isfile(thumb) and os.path.getsize(thumb) > 0:
            return thumb
        with Image.open(src_path) as im:
            w, h = im.size
            if w <= 0 or h <= 0:
                return None
            # 从顶部裁 2:3（漫画第一页顶部一般是标题/封面区）
            target_h = int(w * 3 / 2)
            if h > target_h:
                im = im.crop((0, 0, w, target_h))
            im = im.convert('RGB')
            im.thumbnail((COVER_THUMB_W, COVER_THUMB_H), Image.LANCZOS)
            tmp = thumb + '.tmp'
            im.save(tmp, 'WEBP', quality=82, method=4)
            os.replace(tmp, thumb)
        return thumb
    except Exception:
        return None


def _prefix_filter(aids, covers):
    """只保留「从列表头开始连续就绪」的那部分。

    ★ 这是「按顺序加载」的关键：批量接口无论走哪条路径（首次触发生成 /
      后续只查缓存），返回给前端的 covers 都必须是列表前缀。
      否则前端会出现「第 3 个有图、第 2 个还空着」的乱序观感。

    跳过规则：确认拿不到的（_COVER_FAILED）直接跳过，不算断点 ——
    否则一个没有封面的本子会让后面全部不显示。
    """
    out = {}
    for a in aids:
        if a in covers:
            out[a] = covers[a]
        elif a in _COVER_FAILED:
            continue
        else:
            break
    return out


def _mark_cover_failed(aid):
    if len(_COVER_FAILED) > _COVER_FAILED_MAX:
        _COVER_FAILED.clear()
    _COVER_FAILED.add(aid)


def _thumb_url_if_exists(aid):
    """只查缩略图是否存在，不做任何图像处理、不发网络请求。
    批量接口第一遍用它，保证快速返回已就绪的那部分。"""
    if not aid or not aid.isdigit():
        return ''
    t = _thumb_path(aid)
    if os.path.isfile(t) and os.path.getsize(t) > 0:
        _perf('cover', True, 0.0)
        return _cover_url('%s_t.webp' % aid)
    return ''


def _cached_cover(aid):
    """只看磁盘缓存，不发起网络请求。有原图但没缩略图时顺手生成。"""
    if not aid or not aid.isdigit():
        return ''
    cache = _cover_cache_dir()
    thumb = _thumb_path(aid)
    if os.path.isfile(thumb) and os.path.getsize(thumb) > 0:
        _perf('cover', True, 0.0)
        return _cover_url('%s_t.webp' % aid)
    for ext in ('jpg', 'jpeg', 'webp', 'png', 'gif'):
        p = os.path.join(cache, '%s.%s' % (aid, ext))
        if os.path.isfile(p):
            t = _make_thumb(p, aid)
            _perf('cover', True, 0.0)
            if t:
                return _cover_url('%s_t.webp' % aid)
            # 缩略图生成失败（Pillow 缺失/图片损坏）就退回原图，别让封面消失
            return _cover_url('%s.%s' % (aid, ext))
    return ''


def _ensure_cover(aid, claim=True):
    """封面: 缩略图 > 原图 > 在线取第一页并生成。返回 URL 或 ''。

    [claim] True  —— 占用 inflight 名额；若该 aid 正在生成中，直接返回 ''，
                     本次拿不到，等下一次查询（避免重复生成）。
             False —— 只查缓存，不触发生成、不占名额（前端轮询用）。
    """
    if not aid or not aid.isdigit():
        return ''

    hit = _cached_cover(aid)
    if hit:
        return hit
    if not claim:
        return ''

    # 抢占：同一 aid 同时只允许一个生成任务
    with _COVER_INFLIGHT_LOCK:
        if aid in _COVER_INFLIGHT:
            return ''
        _COVER_INFLIGHT.add(aid)

    cache = _cover_cache_dir()
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
        save_path = os.path.join(cache, '%s.%s' % (aid, ext))
        os.makedirs(cache, exist_ok=True)
        with _SERVE_LOCK:
            # 双检：等锁期间别的线程可能已经下好了
            hit = _cached_cover(aid)
            if hit:
                return hit
            data = M._download_image(aid, photo_id, filename, save_path)
            if not data:
                return ''
            M.decode_jm_image(data, photo.scramble_id, photo_id, filename, save_path)
            t = _make_thumb(save_path, aid)
        _perf('cover', False, 0.0)
        if t:
            return _cover_url('%s_t.webp' % aid)
        return _cover_url('%s.%s' % (aid, ext))
    except Exception:
        return ''
    finally:
        with _COVER_INFLIGHT_LOCK:
            _COVER_INFLIGHT.discard(aid)


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
    if result == 'already':
        return {'message': '本子 %s 已在下载队列中' % aid, 'status': 'queued'}
    if result == 'queued':
        return {'message': '已开始下载 %s' % aid, 'status': 'queued'}
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
    # 僵尸自愈: worker 线程已退出但状态还停在 queued/downloading 时清掉,
    # 否则 App 会一直转圈, 用户再点下载也只会得到"已在队列中"。
    M._manager.revive_if_stuck(aid)
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


# 批量封面最多让调用方等这么久(秒)。超过就先返回已有的，
# 剩下的在后台继续生成并落盘，下次请求就是缓存命中。
# 原来用 `with ThreadPoolExecutor` 会等全部任务结束才返回 ——
# 列表页 20 个未缓存封面要等十几秒，前端只能一直转圈。
COVER_BATCH_TIMEOUT = 4.0

# 每块并发数。小一点顺序感更强（前 4 个先出来），太大就回到"乱序"观感。
COVER_CHUNK = 4


@rc.interface("jmcomic.covers")
def jm_covers(params):
    """批量封面: {aids:[...]} → {aid: url}。

    策略: 已缓存的立刻返回；未缓存的并发生成，最多等 COVER_BATCH_TIMEOUT 秒，
    超时的部分不阻塞响应（后台继续跑，下次请求命中磁盘缓存）。
    """
    import concurrent.futures as _cf
    pp = _p(params)
    aids = [str(x) for x in (pp.get('aids') or []) if str(x).isdigit()]
    if not aids:
        return {'ok': True, 'covers': {}}

    # cached_only=true: 只查已生成的，绝不触发生成、也不等待。
    # 前端轮询用（生成要 1~2 秒/个，首批 4s 必然拿不全；轮询能廉价地"等到就显示"）。
    cached_only = str(pp.get('cached_only') or '').lower() in ('1', 'true', 'yes')

    covers = {}
    pending = []
    # 第一遍: 只查缩略图是否已存在。
    #
    # 这里**不能**调 _cached_cover：它会在「有原图但没缩略图」时同步生成缩略图，
    # 12 个 aid 串行做图像处理要好几秒，整批请求就卡在这一步。
    # 一律交给下面的线程池并发处理。
    for a in aids[:60]:
        u = _thumb_url_if_exists(a)
        if u:
            covers[a] = u
        else:
            pending.append(a)

    if cached_only:
        pref = _prefix_filter(aids, covers)
        return {'ok': True, 'covers': pref, 'total': len(aids),
                'pending': len(pending), 'cached_only': True}

    generated = 0
    failed_aids = []
    if pending:
        # ★ 并发生成，但**按顺序收集**。
        #
        # 之前两种做法都不对：
        #   · 全部并发、谁先完成返回谁 → 界面上"第 5 个先出图、第 1 个还空着"
        #   · 分块串行 → 顺序是对的，但块与块之间互相等待，慢一倍
        #
        # 现在：先把任务全部提交（并发跑，速度最快），再按列表顺序逐个取结果。
        # 前一个没好就不返回后一个 —— 返回给前端的 covers 永远是列表前缀，
        # 前端从上往下填充，观感就是"一个一个按顺序出图"。
        # 已经生成完但排在后面的，下次请求立刻命中（已落盘），不会重复劳动。
        deadline = _time.time() + COVER_BATCH_TIMEOUT
        ex = _cf.ThreadPoolExecutor(max_workers=COVER_CHUNK)
        try:
            futures = [(a, ex.submit(_ensure_cover, a)) for a in pending]
            for a, f in futures:
                remain = deadline - _time.time()
                if remain <= 0.05:
                    break
                try:
                    u = f.result(timeout=remain)
                except _cf.TimeoutError:
                    # 只是还没轮到它完成，不是"没有" —— 留给下次请求
                    break
                except Exception:
                    failed_aids.append(a)
                    continue
                if u:
                    covers[a] = u
                    generated += 1
                else:
                    # 确认拿不到（本子没图/取图失败）→ 记下来，让裁剪时跳过这个位置，
                    # 否则它会成为顺序门控上永远过不去的坎，把后面全堵住
                    failed_aids.append(a)
                    _mark_cover_failed(a)
        finally:
            ex.shutdown(wait=False, cancel_futures=False)

    pref = _prefix_filter(aids, covers)
    return {'ok': True, 'covers': pref, 'total': len(aids),
            'pending': len(pending) - generated - len(failed_aids),
            'failed': failed_aids}


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

# ---- 版本号单一来源 ----
# 平台会从 plugin.json 读版本用于展示/更新判断; 但插件注册与 jmcomic.info 也会
# 上报版本。两处各写一份必然脱节 —— 2026-10-17 实测: plugin.json 改成 1.00.1 后,
# 界面仍显示 2.0.0, 因为这里硬编码着 '2.0.0' 并在注册时覆盖了清单。
# 统一为: 启动时读一次 plugin.json, 之后所有上报都用它。
def _plugin_meta():
    try:
        import json as _json
        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, 'plugin.json'), 'r', encoding='utf-8') as f:
            m = _json.load(f)
        return {'name': m.get('name', 'JMComic'),
                'label': m.get('label', 'JMComic'),
                'version': m.get('version', '0.0.0'),
                'description': m.get('description', '')}
    except Exception:
        return {'name': 'JMComic', 'label': 'JMComic', 'version': '0.0.0', 'description': ''}


_META = _plugin_meta()


@rc.interface("jmcomic.info")
def jm_info(params):
    return {'name': _META['name'].lower(), 'label': _META['label'],
            'version': _META['version'], 'lang': 'python',
            'description': _META['description']}



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

# ---- 批量下载(移动端 App 依赖) ----
# v4 迁移时漏掉了 batch: 旧的 server.py 的 DownloadManager 里本来就实现了
# start_batch/stop_batch/batch_status, 但 v4 只包了单本下载。
# 配套 App(JMReader)的"批量"页需要这三个接口, 这里补上并保持返回结构一致。
# 返回结构(App 的 BatchStatusResponse):
#   {running,status,mode,keyword,found,done,fail,skip,current,error,results:{aid:{name,status}}}


@rc.interface("jmcomic.batch.start")
def jm_batch_start(params):
    mode = _s(params, 'mode', 'keyword') or 'keyword'
    keyword = _s(params, 'keyword')
    if not keyword:
        _err('请输入批量关键词')
    ok, msg = M._manager.start_batch(mode, keyword)
    if not ok:
        _err(msg)
    return {'message': msg, 'mode': mode, 'keyword': keyword}


@rc.interface("jmcomic.batch.status")
def jm_batch_status(params):
    b = M._manager.batch_status() or {}
    # 只保留 App 认识的字段, results 里的结构也统一一下
    results = {}
    for aid, r in (b.get('results') or {}).items():
        if isinstance(r, dict):
            results[str(aid)] = {'name': r.get('name', '') or '', 'status': r.get('status', 'queued') or 'queued'}
        else:
            results[str(aid)] = {'name': '', 'status': str(r)}
    return {
        'running': bool(b.get('running')),
        'status': b.get('status') or 'idle',
        'mode': b.get('mode') or 'keyword',
        'keyword': b.get('keyword') or '',
        'found': int(b.get('found') or 0),
        'done': int(b.get('done') or 0),
        'fail': int(b.get('fail') or 0),
        'skip': int(b.get('skip') or 0),
        'current': b.get('current'),
        'error': b.get('error') or '',
        'results': results,
    }


@rc.interface("jmcomic.batch.stop")
def jm_batch_stop(params):
    M._manager.stop_batch()
    return {'ok': True, 'message': '已请求停止批量下载'}


if __name__ == "__main__":
    _start_cleaner()
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="JMComic",
        version=_META["version"],
        manifest={"label": "JMComic", "description": "禁漫搜索/阅读/库"},
        frontend={"pages": [{"path": "", "title": "JMComic"}]},
        iface_ids=["jmcomic.search", "jmcomic.meta", "jmcomic.album", "jmcomic.chapter",
                   "jmcomic.cover", "jmcomic.covers", "jmcomic.prefetch", "jmcomic.image",
                   "jmcomic.perf.stats", "jmcomic.download", "jmcomic.download.status",
                   "jmcomic.download.cancel", "jmcomic.library.list", "jmcomic.library.delete",
                   "jmcomic.config.get", "jmcomic.config.save", "jmcomic.info",
                   "jmcomic.batch.start", "jmcomic.batch.status", "jmcomic.batch.stop"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )