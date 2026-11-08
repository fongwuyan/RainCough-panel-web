# -*- coding: utf-8 -*-
"""媒体副本：下载、落盘、格式转码。

为什么必须**同步**下载（不能等用户点开才取）：
  · OneBot 给的 url 是 QQ CDN 临时地址，会过期
  · file 是协议端本地缓存路径，会被它自己清掉
  → 消息到达那一刻不下手，事后就永远拿不到了

落盘路径：<media_dir>/<账号uin>/<日期>/<msg_id>_<段序号>.<ext>
  日期用**消息事件时间**而不是落盘时间，否则补录历史消息时目录会很怪。

★ 格式处理（浏览器兼容）—— 见 ffmpeg.py 的详细说明：
  · 语音：QQ 给的是 AMR-NB，浏览器不支持 → 转 mp3
  · 视频：QQ 短视频大量是 HEVC Main10，浏览器不支持 → 转 H.264+AAC+faststart
    （转码是重活，走后台任务，不阻塞消息入库）
  · 图片/视频后缀按**魔数与真实容器**判定，不信协议端给的后缀

清单项结构：
  {kind, seg, rel, bytes, mime, local, name, playable, transcode}
    playable  —— 1=浏览器能直接放；0=只存了原件（转码中/转码失败）
    transcode —— ''| 'pending' | 'done' | 'failed' | 'skipped'
"""
import asyncio
import os
import shutil
import subprocess
import time

import aiohttp

from . import ffmpeg, logbuf, silk

MAX_BYTES = 200 * 1024 * 1024

# OneBot 媒体段类型 → (初始落盘扩展名, 是否需要处理)
_MEDIA_TYPES = {
    'image': ('.jpg', False),
    'record': ('.amr', True),     # AMR/SILK → mp3
    'video': ('.mp4', True),      # HEVC → H.264
    'face': ('.gif', False),
    'file': ('.bin', False),
}


class Downloader:
    """带并发上限与超时的下载器。"""

    def __init__(self, concurrency=4, timeout=20):
        self.sem = asyncio.Semaphore(max(1, int(concurrency)))
        self.timeout = int(timeout)

    async def fetch(self, url, headers=None):
        """拿 url 的字节。失败返回 None。"""
        if not url or not url.startswith('http'):
            return None
        async with self.sem:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            try:
                async with aiohttp.ClientSession() as sess:
                    async with sess.get(url, timeout=timeout,
                                        headers=headers or {'User-Agent': 'Mozilla/5.0'}) as r:
                        if r.status >= 400:
                            return None
                        chunks, total = [], 0
                        while True:
                            chunk = await r.content.read(65536)
                            if not chunk:
                                break
                            chunks.append(chunk)
                            total += len(chunk)
                            if total > MAX_BYTES:
                                return None
                        return b''.join(chunks)
            except Exception as e:
                logbuf.debug('media', '下载失败 %s：%s' % (url[:80], str(e)[:100]))
                return None


_DOWNLOADER = None


def downloader(concurrency=4, timeout=20):
    global _DOWNLOADER
    if _DOWNLOADER is None:
        _DOWNLOADER = Downloader(concurrency, timeout)
    return _DOWNLOADER


def _date_dir(ts):
    return time.strftime('%Y-%m-%d', time.localtime(ts or time.time()))


def _safe_name(s):
    keep = []
    for ch in str(s or ''):
        if ch.isalnum() or ch in '-_.':
            keep.append(ch)
        else:
            keep.append('_')
    return ''.join(keep)[:80] or 'x'


def _guess_mime(t):
    return {'image': 'image/jpeg', 'record': 'audio/mpeg', 'video': 'video/mp4',
            'face': 'image/gif', 'file': 'application/octet-stream'}.get(t, '')


async def save_media(segs, ob, root, account_uin, msg_id, ts, dl=None,
                     silk_bin='', keep_silk=True, account_id='',
                     allow_transcode=True):
    """把消息里的媒体段下载落盘，返回媒体清单 list[dict]。

    segs  —— OneBot 原始消息段数组
    msg_id —— 用于回填转码结果（转码是异步的，完成后要更新库里的记录）
    """
    out = []
    if not segs or isinstance(segs, str):
        return out
    dl = dl or downloader()
    day = _date_dir(ts)
    base = os.path.join(root, str(account_uin or 'unknown'), day)

    for i, s in enumerate(segs):
        if not isinstance(s, dict):
            continue
        t = s.get('type')
        if t not in _MEDIA_TYPES:
            continue
        d = s.get('data') or {}
        ext, need_proc = _MEDIA_TYPES[t]
        url = d.get('url') or ''
        path = d.get('file') or ''
        name = d.get('name') or ''

        # 表情包：只有 id 没有 url 时，用 QQ 官方表情接口补一个
        if t == 'face' and not url:
            fid = str(d.get('id') or '')
            if fid.isdigit():
                url = 'https://qzonestyle.gtimg.cn/qzone/em/e%s.gif' % fid

        data = None
        if url:
            data = await dl.fetch(url)
        if data is None and path and os.path.exists(path):
            try:
                with open(path, 'rb') as f:
                    data = f.read(MAX_BYTES + 1)
            except Exception:
                data = None
        if data is None and path and ob is not None:
            # 让协议端落一份到本地再读
            data = await _via_onebot(ob, t, path)

        if not data:
            out.append({'kind': t, 'seg': i, 'rel': '', 'bytes': 0,
                        'mime': '', 'local': 0, 'playable': 0,
                        'transcode': '', 'name': name})
            continue

        # ---- 按真实内容定后缀（不信协议端给的）----
        mime = ''
        if t == 'image':
            e2, m2 = ffmpeg.sniff_image(data)
            if e2:
                ext, mime = e2, m2
        elif t == 'record':
            e2, m2 = ffmpeg.sniff_audio(data)
            if e2:
                ext, mime = e2, m2
        if not mime:
            mime = _guess_mime(t)

        fname = '%s_%d%s' % (_safe_name(msg_id or str(int(ts))), i, ext)
        rel = os.path.join(str(account_uin or 'unknown'), day, fname)
        full = os.path.join(root, rel)
        try:
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, 'wb') as f:
                f.write(data)
        except Exception as e:
            logbuf.warn('media', '落盘失败 %s：%s' % (rel, str(e)[:120]))
            out.append({'kind': t, 'seg': i, 'rel': '', 'bytes': len(data),
                        'mime': '', 'local': 0, 'playable': 0,
                        'transcode': '', 'name': name})
            continue

        size = len(data)
        entry = {'kind': t, 'seg': i, 'rel': rel, 'bytes': size,
                 'mime': mime, 'local': 1, 'playable': 1,
                 'transcode': '', 'name': name}

        if need_proc:
            await _process(t, full, rel, entry, root, account_id, msg_id,
                           keep_silk, allow_transcode)
        out.append(entry)
    return out


async def _process(t, full, rel, entry, root, account_id, msg_id,
                    keep_silk, allow_transcode):
    """处理媒体格式：语音转 mp3、视频转 H.264。

    语音是小的（几秒音频），同步转。
    视频是重的（可能几十秒），**起后台任务**，不阻塞消息入库。
    """
    if t == 'record':
        await _transcode_audio(full, rel, entry, root, keep_silk)
        return

    if t == 'video':
        if not allow_transcode or not ffmpeg.available():
            entry['playable'] = 1   # 交给前端提示"可能无法播放"
            entry['transcode'] = 'skipped'
            return
        try:
            info = await ffmpeg.probe(full)
        except Exception:
            info = {}
        need = ffmpeg.needs_transcode(info)
        if not need and info.get('ok') and not info.get('has_faststart'):
            # 编码没问题但 moov 在文件尾 → 只需重封装（很快）
            need = 'remux'
        elif not need:
            entry['playable'] = 1
            return
        # 后台转码
        entry['playable'] = 0
        entry['transcode'] = 'pending'
        asyncio.create_task(_transcode_video_bg(full, rel, entry, root,
                                                account_id, msg_id, need))
        return


async def _transcode_audio(full, rel, entry, root, keep_silk):
    """语音 → mp3。

    ★ SILK 走单独分支：SnowLuma 给的是 QQ 原生 SILK，ffmpeg 没有解码器，
      必须先用 pilk 解成 wav（见 rcbot/silk.py），再转 mp3。
      没装 pilk / 解不开就保留原文件、标成不可播放（前端显示下载按钮）。
    """
    if silk.is_silk(full):
        if await _silk_to_mp3(full, entry, root, keep_silk):
            return
        entry['mime'] = 'audio/silk'
        entry['playable'] = 0
        entry['transcode'] = 'failed'
        return

    # ★ 原子转码：先写临时文件，成功才替换。
    #   历史语音文件后缀是 .mp3 但内容是 AMR —— 直接输出到同名文件会被
    #   ffmpeg 拒绝（输入输出同路径），失败清理还会把原件删掉。
    mp3_full, mime = await ffmpeg.convert_atomic(full, 'audio', timeout=180)
    if mp3_full:
        try:
            size = os.path.getsize(mp3_full)
        except Exception:
            size = 0
        mp3_rel = os.path.relpath(mp3_full, root).replace(os.sep, '/')
        entry['rel'] = mp3_rel
        entry['bytes'] = size
        entry['mime'] = mime or 'audio/mpeg'
        entry['playable'] = 1
        entry['transcode'] = 'done'
        if not keep_silk:
            try:
                os.remove(full)
            except Exception:
                pass
    else:
        entry['mime'] = entry.get('mime') or 'audio/amr'
        entry['playable'] = 0
        entry['transcode'] = 'failed'


async def _silk_to_mp3(full, entry, root, keep_silk):
    """SILK → wav → mp3，成功返回 True。

    pilk 只解 SILK，出来的 wav 是 24kHz 单声道；转 mp3 仍走 ffmpeg。
    """
    if not silk.available():
        logbuf.warn('media', '收到 SILK 语音但没装 pilk，转不了：%s' % os.path.basename(full))
        return False
    dst = os.path.splitext(full)[0] + '.mp3'
    if dst == full:                     # 理论上不会，保险
        dst = full + '.conv.mp3'
    if not await silk.to_mp3(full, dst):
        logbuf.debug('media', 'SILK 解码失败：%s' % os.path.basename(full))
        return False
    try:
        size = os.path.getsize(dst)
    except Exception:
        size = 0
    entry['rel'] = os.path.relpath(dst, root).replace(os.sep, '/')
    entry['bytes'] = size
    entry['mime'] = 'audio/mpeg'
    entry['playable'] = 1
    entry['transcode'] = 'done'
    if not keep_silk:
        try:
            os.remove(full)
        except Exception:
            pass
    logbuf.info('media', 'SILK 已转 mp3：%s（%d 字节）' % (os.path.basename(dst), size))
    return True


async def _transcode_video_bg(full, rel, entry, root, account_id, msg_id, mode):
    """后台视频转码。完成后回填数据库里的媒体记录。"""
    dst, mime = await ffmpeg.convert_atomic(full, 'video', timeout=1800)
    if not dst:
        entry['transcode'] = 'failed'
        entry['playable'] = 0
        await _save_media_update(account_id, msg_id, entry)
        return

    try:
        size = os.path.getsize(dst)
    except Exception:
        size = 0
    dst_rel = os.path.relpath(dst, root).replace(os.sep, '/')
    # 原文件转完就没用了（省磁盘）
    try:
        if os.path.abspath(dst) != os.path.abspath(full):
            os.remove(full)
    except Exception:
        pass
    entry['rel'] = dst_rel
    entry['bytes'] = size
    entry['mime'] = mime or 'video/mp4'
    entry['playable'] = 1
    entry['transcode'] = 'done'
    await _save_media_update(account_id, msg_id, entry)
    logbuf.info('media', '视频已转 H.264：%s（%.1f MB）'
                % (os.path.basename(dst_rel), size / 1048576.0))


async def _save_media_update(account_id, msg_id, entry):
    """把转码结果回填到 chat_logs.media。"""
    if not account_id or not msg_id:
        return
    try:
        from . import chats
        await chats.update_media_entry(account_id, msg_id, entry)
    except Exception as e:
        logbuf.debug('media', '回填转码结果失败：%s' % str(e)[:120])


async def _via_onebot(ob, t, path):
    """让协议端把媒体落到本地缓存再读。"""
    action = {'image': 'get_image', 'record': 'get_record', 'video': 'get_video'}.get(t)
    if not action or ob is None:
        return None
    try:
        r = await ob.call(action, {'file': path}, timeout=20)
        p = ((r.get('data') or {}).get('file')) or ''
        if p and os.path.exists(p):
            with open(p, 'rb') as f:
                return f.read(MAX_BYTES + 1)
    except Exception as e:
        logbuf.debug('media', 'OneBot 取媒体失败：%s' % str(e)[:100])
    return None


def dir_usage(root):
    """媒体目录占用统计（字节 + 文件数）。"""
    total = 0
    n = 0
    per = {}
    if not root or not os.path.isdir(root):
        return {'bytes': 0, 'files': 0, 'per_account': {}}
    try:
        for name in os.listdir(root):
            sub = os.path.join(root, name)
            if not os.path.isdir(sub):
                continue
            s = 0
            c = 0
            for dirpath, _, files in os.walk(sub):
                for fn in files:
                    try:
                        s += os.path.getsize(os.path.join(dirpath, fn))
                        c += 1
                    except Exception:
                        pass
            per[name] = {'bytes': s, 'files': c}
            total += s
            n += c
    except Exception:
        pass
    return {'bytes': total, 'files': n, 'per_account': per}


def disk_free(path):
    """目标目录所在磁盘的剩余空间。"""
    try:
        st = shutil.disk_usage(path if os.path.exists(path) else '/')
        return {'total': st.total, 'used': st.used, 'free': st.free}
    except Exception:
        return {'total': 0, 'used': 0, 'free': 0}
