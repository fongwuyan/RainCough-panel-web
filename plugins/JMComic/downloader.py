"""JMComic 内置下载器。

为什么不用 `jmcomic.download_album()`：
那是个黑盒，拿不到单页粒度 —— 无法按页重试、无法显示真实进度、
无法只补失败的那几页。而本机到 JM CDN 的 **TTFB 实测约 41 秒**，
黑盒串行下载一本 34 页的章节要 23 分钟，且一次超时就整本失败。

本模块自己按页下载，换来四件事：

1. **并发**：多页同时发起。TTFB 等待可以重叠 ——
   这是当前网络环境下最大的提速点（34 页从 ~23 分钟降到 ~4 分钟）。
2. **按页重试 + 换域名**：单页失败只重试那一页，不影响其它页。
3. **断点续传**：已存在的非空文件直接跳过。中断后再点继续不重下。
4. **可观测**：页数/章节/速度/ETA/失败明细都能报给前端。

磁盘布局与旧实现保持一致（jmcomic 的 Bd_Aid 规则），
所以旧下载器下好的文件能被直接复用：

    <storage>/<aid>/<aid>/<cid>/<filename>
"""
import json
import os
import threading
import time
import traceback

import requests

# 单页请求超时。★ 不能用 30s —— 实测 CDN TTFB 约 41s，30s 必然超时，
# 表现为"每页都失败"（旧实现就是这样，3 个域名全部 timeout）。
CONNECT_TIMEOUT = 15
READ_TIMEOUT = 120

# 并发页数。太高会触发 CDN 限流，太低则被 TTFB 拖死。6 是实测比较稳的值。
DEFAULT_WORKERS = 6

# 单页最多重试次数（含换域名）
MAX_RETRY_PER_PAGE = 4

UA = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Referer': 'https://18comic.vip/',
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
}


def _now():
    return int(time.time())


class Task(object):
    """一个相册的下载任务。可序列化，用于持久化与上报。"""

    FIELDS = (
        'aid', 'name', 'author', 'status', 'total_pages', 'done_pages',
        'failed_pages', 'total_chapters', 'done_chapters', 'current',
        'bytes', 'started_at', 'updated_at', 'error', 'workers',
    )

    def __init__(self, aid, name='', author=''):
        self.aid = str(aid)
        self.name = name
        self.author = author
        self.status = 'queued'          # queued/downloading/paused/completed/failed/cancelled
        self.total_pages = 0
        self.done_pages = 0
        self.failed_pages = 0
        self.total_chapters = 0
        self.done_chapters = 0
        self.current = ''
        self.bytes = 0
        self.started_at = 0
        self.updated_at = _now()
        self.error = ''
        self.workers = DEFAULT_WORKERS
        # 不持久化：失败明细与已完成的页（体积可能大）
        self.failed = []                # [{cid, file, reason}]
        self.done_set = None            # 内存去重

    def to_dict(self):
        d = {k: getattr(self, k) for k in self.FIELDS}
        # 前端需要的计算字段
        elapsed = max(1, _now() - self.started_at) if self.started_at else 0
        d['elapsed'] = elapsed
        d['speed_bps'] = int(self.bytes / elapsed) if elapsed and self.bytes else 0
        remain = max(0, self.total_pages - self.done_pages)
        if self.status == 'downloading' and self.done_pages and elapsed:
            per_page = elapsed / float(self.done_pages)
            d['eta_sec'] = int(per_page * remain)
        else:
            d['eta_sec'] = 0
        d['failed_count'] = len(self.failed)
        d['failed_sample'] = self.failed[:20]
        d['progress'] = round(self.done_pages * 100.0 / self.total_pages, 1) if self.total_pages else 0
        return d

    @classmethod
    def from_dict(cls, d):
        t = cls(d.get('aid', ''))
        for k in cls.FIELDS:
            if k in d and d[k] is not None:
                setattr(t, k, d[k])
        # 重启后不可能还在跑，统一标为暂停，由用户决定是否继续
        if t.status in ('downloading', 'queued'):
            t.status = 'paused'
            t.error = '上次未完成，点继续恢复'
        return t


class Downloader(object):
    """多任务下载器。每个相册一个后台线程，页级并发在任务内部完成。"""

    def __init__(self, plugin_dir, server_module, state_file=None,
                 dir_picker=None, decode_fn=None, cdn_domains=None):
        self.plugin_dir = plugin_dir
        self.M = server_module
        self.state_file = state_file or os.path.join(plugin_dir, 'cache', 'dl_tasks.json')
        self._pick_dir = dir_picker or (lambda: server_module.pick_dir())
        self._decode = decode_fn or (lambda *a: server_module.decode_jm_image(*a))
        self._domains = cdn_domains or server_module.CDN_DOMAINS

        self._lock = threading.RLock()
        self._tasks = {}            # aid -> Task
        self._threads = {}          # aid -> Thread
        self._cancel = set()        # 被要求取消/暂停的 aid
        self._paused = set()
        self._load_state()

    # ------------------------------------------------------------------ 状态

    def _load_state(self):
        try:
            if os.path.isfile(self.state_file):
                raw = json.load(open(self.state_file, 'r', encoding='utf-8'))
                for d in raw.get('tasks', []):
                    t = Task.from_dict(d)
                    if t.aid:
                        self._tasks[t.aid] = t
        except Exception:
            pass

    def _save_state(self):
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            with self._lock:
                data = {'tasks': [t.to_dict() for t in self._tasks.values()]}
            tmp = self.state_file + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False)
            os.replace(tmp, self.state_file)
        except Exception:
            pass

    def _touch(self, t):
        t.updated_at = _now()
        self._save_state()

    # ------------------------------------------------------------------ 查询

    def list_all(self):
        with self._lock:
            items = [t.to_dict() for t in self._tasks.values()]
        items.sort(key=lambda x: x.get('updated_at') or 0, reverse=True)
        return items

    def status(self, aid):
        with self._lock:
            t = self._tasks.get(str(aid))
        return t.to_dict() if t else None

    def is_active(self, aid):
        with self._lock:
            t = self._tasks.get(str(aid))
            return bool(t and t.status in ('queued', 'downloading'))

    # ------------------------------------------------------------------ 控制

    def start(self, aid, name='', author='', workers=DEFAULT_WORKERS):
        aid = str(aid)
        # ★ 旧线程还在跑就先让它停：否则两代线程同时往同一个 task 写
        #   done_pages/failed，会出现"状态还在 queued，页数却在涨"的竞态，
        #   而且旧线程因 cancel 标志提前退出的页不会被补下（表现为 done < total 但 failed=0）。
        old = self._threads.get(aid)
        if old is not None and old.is_alive():
            self._cancel.add(aid)
            old.join(timeout=8)
            if old.is_alive():
                return 'busy'
        with self._lock:
            t = self._tasks.get(aid)
            if t and t.status == 'downloading':
                return 'already'
            if t and t.status == 'completed':
                # 已完成但可能缺页：允许重跑一次（会跳过已存在的文件）
                pass
            if t is None:
                t = Task(aid, name, author)
                self._tasks[aid] = t
            t.status = 'queued'
            t.error = ''
            t.failed = []
            t.workers = max(1, min(int(workers or DEFAULT_WORKERS), 12))
            t.started_at = _now()
            self._cancel.discard(aid)
            self._paused.discard(aid)
            self._touch(t)
        self._spawn(aid)
        return 'queued'

    def _spawn(self, aid):
        with self._lock:
            th = self._threads.get(aid)
            if th and th.is_alive():
                return
            th = threading.Thread(target=self._run, args=(aid,), daemon=True,
                                  name='jm-dl-%s' % aid)
            self._threads[aid] = th
            th.start()

    def pause(self, aid):
        aid = str(aid)
        with self._lock:
            self._paused.add(aid)
            self._cancel.add(aid)
            t = self._tasks.get(aid)
            if t and t.status in ('queued', 'downloading'):
                t.status = 'paused'
                t.current = ''
                self._touch(t)
        return 'paused'

    def cancel(self, aid):
        aid = str(aid)
        with self._lock:
            self._cancel.add(aid)
            t = self._tasks.get(aid)
            if t:
                t.status = 'cancelled'
                t.current = ''
                self._touch(t)
        return 'cancelled'

    def resume(self, aid):
        aid = str(aid)
        with self._lock:
            t = self._tasks.get(aid)
            if not t:
                return 'not_found'
            if t.status == 'downloading':
                return 'already'
        return self.start(aid, t.name, t.author, t.workers)

    def remove(self, aid, delete_files=False):
        aid = str(aid)
        self.cancel(aid)
        with self._lock:
            self._tasks.pop(aid, None)
            self._save_state()
        if delete_files:
            import shutil
            for base in self.M.storage_paths():
                for p in (os.path.join(base, aid), os.path.join(base, '_tmp_%s' % aid)):
                    if os.path.isdir(p):
                        shutil.rmtree(p, ignore_errors=True)
        return 'removed'

    def retry_failed(self, aid):
        """只补下失败的页。"""
        aid = str(aid)
        with self._lock:
            t = self._tasks.get(aid)
            if not t:
                return 'not_found'
            if not t.failed:
                return 'nothing_to_retry'
            t.failed = []
            t.status = 'paused'
            self._touch(t)
        return self.start(aid, t.name, t.author, t.workers)

    # ------------------------------------------------------------------ 下载

    def _cancelled(self, aid):
        return aid in self._cancel

    def _run(self, aid):
        t = None
        try:
            with self._lock:
                t = self._tasks.get(aid)
            if not t:
                return
            t.status = 'downloading'
            t.current = '获取目录…'
            t.failed = []
            t.bytes = 0
            if not t.started_at:
                t.started_at = _now()
            self._touch(t)

            base = self._pick_dir()
            os.makedirs(base, exist_ok=True)

            client = self.M.jm()
            album = client.get_album_detail(aid)
            if not t.name:
                t.name = album.name or ''
            if not t.author:
                t.author = album.author or ''
            chapters = list(album.episode_list or [])
            if not chapters:
                raise RuntimeError('该本子没有章节')

            # ★ 不预扫描所有章节的页列表。
            #
            # 原来先遍历每个 chapter 调 get_photo_detail 拿 page_arr，再开始下载。
            # 实测一本 1500 页的本子，光"获取目录"就要几分钟 ——
            # 期间 done_pages 一直是 0，界面看着像卡死。
            # 现在：拿到章节列表就开下，total_pages 边下边累加。
            # 代价是总页数一开始不准（前端按"已完成/已知"显示），
            # 换来的是**第一页几乎立刻开始**。
            t.total_chapters = len(chapters)
            t.total_pages = 0
            t.current = ''
            self._touch(t)

            for item in chapters:
                if self._cancelled(aid):
                    break
                if isinstance(item, (list, tuple)):
                    cid = str(item[0])
                    cname = str(item[2]) if len(item) > 2 else (
                        str(item[1]) if len(item) > 1 else cid)
                else:
                    cid, cname = str(item), str(item)

                t.current = '读取章节 %s' % (cname or cid)
                self._touch(t)
                try:
                    photo = client.get_photo_detail(cid)
                except Exception as e:
                    t.failed.append({'cid': cid, 'file': '', 'reason': '取章节失败: %s' % e})
                    continue
                pages = list(photo.page_arr or [])
                if not pages:
                    t.failed.append({'cid': cid, 'file': '', 'reason': '章节无图片'})
                    continue

                ch = {
                    'cid': cid, 'name': cname or cid,
                    'scramble': str(photo.scramble_id or ''),
                    'pages': pages,
                }
                with self._lock:
                    t.total_pages += len(pages)
                self._touch(t)

                self._download_chapter(aid, t, base, ch)
                if self._cancelled(aid):
                    break
                t.done_chapters += 1
                self._touch(t)

            # 收尾
            t.failed_pages = len(t.failed)
            if t.failed_pages == 0 and t.done_pages >= t.total_pages and t.total_pages > 0:
                t.status = 'completed'
                t.error = ''
                self._finalize(aid, base, t)
            elif t.done_pages > 0:
                t.status = 'failed'
                if t.failed_pages:
                    t.error = '%d 页失败（共 %d 页）；可点"只补失败"重试' % (
                        t.failed_pages, t.total_pages)
                else:
                    t.error = '已下 %d/%d 页后中断；点"全部续传"继续' % (
                        t.done_pages, t.total_pages)
            else:
                t.status = 'failed'
                t.error = t.error or '没有成功下载任何页'
            t.current = ''
            self._touch(t)

        except Exception as e:
            if t is not None:
                t.status = 'failed'
                t.error = '%s: %s' % (type(e).__name__, e)
                t.current = ''
                self._touch(t)
        finally:
            with self._lock:
                self._threads.pop(aid, None)
                self._cancel.discard(aid)
                self._paused.discard(aid)

    def _download_chapter(self, aid, t, base, ch):
        cid = ch['cid']
        pages = ch['pages']
        scramble = ch['scramble']

        # 目标目录：<base>/<aid>/<aid>/<cid>/
        album_dir = os.path.join(base, aid, aid)
        cid_dir = os.path.join(album_dir, cid)
        os.makedirs(cid_dir, exist_ok=True)

        t.current = ch['name']
        self._touch(t)

        lock = threading.Lock()
        sem = threading.Semaphore(t.workers)
        errors = []

        def one(fn):
            if self._cancelled(aid):
                return
            dest = os.path.join(cid_dir, fn)
            # 断点续传：已有非空文件直接算完成
            try:
                if os.path.isfile(dest) and os.path.getsize(dest) > 0:
                    with lock:
                        t.done_pages += 1
                    return
            except Exception:
                pass

            sem.acquire()
            try:
                if self._cancelled(aid):
                    return
                data = self._fetch(cid, fn)
                if data:
                    self._decode(data, scramble, cid, fn, dest)
                    with lock:
                        t.done_pages += 1
                        t.bytes += len(data)
                        self._touch(t)
                else:
                    with lock:
                        t.failed.append({'cid': cid, 'file': fn, 'reason': '多次重试仍失败'})
                        t.failed_pages = len(t.failed)
                        self._touch(t)
            except Exception as e:
                with lock:
                    t.failed.append({'cid': cid, 'file': fn, 'reason': str(e)[:120]})
                    t.failed_pages = len(t.failed)
                    self._touch(t)
            finally:
                sem.release()

        threads = []
        for fn in pages:
            if self._cancelled(aid):
                break
            th = threading.Thread(target=one, args=(fn,), daemon=True)
            th.start()
            threads.append(th)
            # 控制同时在飞的线程数，避免一次开几百个线程
            if len(threads) >= t.workers * 2:
                for x in threads:
                    x.join(timeout=0.1)
                threads = [x for x in threads if x.is_alive()]

        for th in threads:
            th.join()

    def _fetch(self, cid, filename):
        """按页下载原始（未解码）字节。域名轮换 + 指数退避。"""
        last = ''
        for attempt in range(MAX_RETRY_PER_PAGE):
            domain = self._domains[attempt % len(self._domains)]
            url = 'https://%s/media/photos/%s/%s' % (domain, cid, filename)
            try:
                r = requests.get(url, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
                                 headers=UA, stream=True)
                if r.status_code != 200:
                    last = 'HTTP %s' % r.status_code
                    r.close()
                    time.sleep(0.4 * (attempt + 1))
                    continue
                buf = bytearray()
                for chunk in r.iter_content(65536):
                    if chunk:
                        buf.extend(chunk)
                r.close()
                if len(buf) > 512:      # 太小说明不是图
                    return bytes(buf)
                last = '响应过短(%d B)' % len(buf)
            except Exception as e:
                last = '%s: %s' % (type(e).__name__, str(e)[:60])
            time.sleep(0.6 * (attempt + 1))
        return None

    def _finalize(self, aid, base, t):
        """全部成功后打完成标记 + 更新库元数据。"""
        try:
            # ★ 标记必须放在 <base>/<aid>/.complete ——
            #   server.is_complete_download() 就是按这个路径判断的。
            #   （章节目录在 <base>/<aid>/<aid>/<cid>/，两者差一层，别放错）
            marker = os.path.join(base, aid, '.complete')
            os.makedirs(os.path.dirname(marker), exist_ok=True)
            open(marker, 'w').close()
        except Exception:
            pass
        try:
            lib = self.M.load_library()
            entry = lib.get(aid, {})
            entry['total'] = t.total_pages
            entry['cached'] = t.done_pages
            entry['name'] = entry.get('name') or t.name
            entry['author'] = entry.get('author') or t.author
            entry['updated'] = _now()
            lib[aid] = entry
            self.M.save_library(lib)
        except Exception:
            pass
