# -*- coding: utf-8 -*-
"""媒体转码：把 QQ 的格式转成浏览器能播的。

为什么必须有这一步（都是生产机实测踩到的）：
  · **语音**：QQ 的语音是 AMR-NB（文件头 `#!AMR`），浏览器完全不支持。
    之前按「SILK」假设去找 silk_v3_decoder，方向就错了 ——
    系统的 ffmpeg 自带 amrnb/amrwb 解码器，直接转 mp3 就行。
  · **视频**：QQ 短视频（尤其群里的三秒小视频）大量是
    **HEVC Main10（H.265 10bit）**，Chrome/Firefox 都不支持 → 黑屏/转圈。
    另一个坑：mp4 的 moov atom 在文件尾（非 faststart）时，
    浏览器必须把整个文件下完才能起播，看起来就是「播不出来」。
  · **图片**：OneBot 给的后缀不可信（标 .jpg 的其实是 png/webp），
    面板按后缀发 MIME，png 被当 jpg 发出去，某些浏览器会拒绝渲染。

所以这里做三件事：
  1. 语音   AMR/SILK → mp3
  2. 视频   非 H.264 → H.264+AAC+faststart；H.264 但无 faststart → 只重封装
  3. 图片   按魔数识别真实格式并改正后缀

转码是**重活**（一个 98 秒的 HEVC 视频可能要几十秒），
所以视频走后台任务，不阻塞消息入库。
"""
import asyncio
import os
import shutil
import subprocess

from . import logbuf

# ffmpeg / ffprobe 路径（探测一次缓存）
_FFMPEG = None
_FFPROBE = None


def ffmpeg():
    """ffmpeg 可执行文件路径；没有就返回空串。"""
    global _FFMPEG
    if _FFMPEG is None:
        cfg_path = ''
        try:
            from . import config as _cfg
            cfg_path = ((_cfg.load().get('media') or {}).get('ffmpeg') or '')
        except Exception:
            pass
        _FFMPEG = cfg_path if (cfg_path and os.path.isfile(cfg_path)) else (shutil.which('ffmpeg') or '')
    return _FFMPEG


def ffprobe():
    """ffprobe 可执行文件路径；没有就返回空串。"""
    global _FFPROBE
    if _FFPROBE is None:
        _FFPROBE = shutil.which('ffprobe') or ''
    return _FFPROBE


def available():
    """ffmpeg 与 ffprobe 是否齐备。"""
    return bool(ffmpeg()) and bool(ffprobe())


# ---------------------------------------------------------------- 探测

async def probe(path):
    """探测媒体信息。

    返回 {ok, codec, pix_fmt, width, height, duration, has_faststart,
          audio_codec, size}
    has_faststart —— mp4 的 moov 是否在文件头（决定了能不能秒开）
    """
    out = {'ok': False, 'codec': '', 'pix_fmt': '', 'width': 0, 'height': 0,
           'duration': 0.0, 'has_faststart': False, 'audio_codec': '',
           'size': 0, 'vcodecs': [], 'acodecs': []}
    try:
        out['size'] = os.path.getsize(path)
    except Exception:
        pass
    if not available():
        return out
    try:
        p = await asyncio.create_subprocess_exec(
            ffprobe(), '-v', 'error', '-show_entries',
            'stream=codec_type,codec_name,pix_fmt,width,height:'
            'format=duration,format_name',
            '-of', 'json', path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out_b, err_b = await p.communicate()
        if p.returncode != 0:
            return out
        import json
        d = json.loads(out_b.decode('utf-8', 'replace') or '{}')
    except Exception as e:
        logbuf.debug('ffmpeg', '探测失败 %s：%s' % (os.path.basename(path), str(e)[:100]))
        return out

    out['ok'] = True
    try:
        out['duration'] = float((d.get('format') or {}).get('duration') or 0)
    except Exception:
        pass
    for s in (d.get('streams') or []):
        ct = s.get('codec_type')
        if ct == 'video' and not out['codec']:
            out['codec'] = s.get('codec_name') or ''
            out['pix_fmt'] = s.get('pix_fmt') or ''
            try:
                out['width'] = int(s.get('width') or 0)
                out['height'] = int(s.get('height') or 0)
            except Exception:
                pass
            out['vcodecs'].append(out['codec'])
        elif ct == 'audio':
            ac = s.get('codec_name') or ''
            out['acodecs'].append(ac)
            if not out['audio_codec']:
                out['audio_codec'] = ac
    out['has_faststart'] = _has_faststart(path)
    return out


def _has_faststart(path):
    """mp4 的 moov 是否在文件头。

    做法：找 'moov' atom 出现的位置，和 'mdat' 比。
    moov 在前 → faststart（可以边下边播）；moov 在后 → 必须下完。
    """
    try:
        size = os.path.getsize(path)
        if size <= 0:
            return False
        with open(path, 'rb') as f:
            head = f.read(min(size, 4 * 1024 * 1024))
        moov = head.find(b'moov')
        mdat = head.find(b'mdat')
        if moov < 0:
            return False
        return mdat < 0 or moov < mdat
    except Exception:
        return False


def needs_transcode(info):
    """这个视频需要转码吗？

    浏览器（Chrome/Edge/Firefox/Safari 现代版）能播的组合很窄：
      视频 H.264 + yuv420p（8bit）  ← 高兼容
      音频 AAC-LC
    HEVC/H.265、AV1、VP9、10bit 全都不可靠。
    """
    if not info or not info.get('ok'):
        return False
    vc = (info.get('codec') or '').lower()
    pf = (info.get('pix_fmt') or '').lower()
    if vc in ('hevc', 'h265', 'av1', 'vp9', 'vp8', 'mpeg4', 'msmpeg4', 'wmv3', 'theora'):
        return True
    if vc == 'h264':
        # 10bit / 4:2:2 之类的色度格式浏览器解不了
        if pf and pf not in ('yuv420p', 'yuvj420p'):
            return True
        return False
    # 探测不出来就保守起见转
    return bool(vc) and vc not in ('h264',)


def audio_codec_ok(info):
    """音频轨浏览器能不能放（AAC-LC / MP3 / Opus 都可以）。"""
    if not info:
        return True
    for ac in (info.get('acodecs') or []):
        if ac.lower() in ('aac', 'mp3', 'opus', 'm4a'):
            return True
    return not info.get('acodecs')


# ---------------------------------------------------------------- 转码

async def _run(args, timeout=600):
    """跑一个命令。返回 (returncode, stderr)。"""
    try:
        p = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        try:
            _, err = await asyncio.wait_for(p.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            try:
                p.kill()
            except Exception:
                pass
            return 124, b'timeout'
        return p.returncode, (err or b'')
    except FileNotFoundError:
        return 127, b'not found'
    except Exception as e:
        return 1, str(e).encode('utf-8', 'replace')


async def to_mp3(src, dst, timeout=120):
    """语音 → mp3。

    源可能是 AMR-NB(#!AMR 头)、AMR-WB、Silk、wav。
    ffmpeg 的 amrnb/amrwb 解码器能读前两种；silk 需要额外解码器，
    读不了就返回 False（调用方保留原文件并标成不可播放）。

    ★ 失败时**绝不删 dst**：历史数据里源文件就叫 xxx.mp3（其实是 AMR），
      此时 dst 会和 src 同一个路径 —— 之前在这里 os.remove(dst)
      等于把原始语音删掉了，教训记死了。
    """
    if not available():
        return False
    args = [ffmpeg(), '-y', '-loglevel', 'error', '-i', src,
            '-vn', '-acodec', 'libmp3lame', '-b:a', '48k', '-ar', '16000',
            '-ac', '1', dst]
    rc, err = await _run(args, timeout=timeout)
    ok = rc == 0 and os.path.isfile(dst) and os.path.getsize(dst) > 0
    if not ok:
        logbuf.debug('ffmpeg', '语音转 mp3 失败：%s' % (err or b'')[:160])
    return ok


async def to_web_mp4(src, dst, timeout=900):
    """视频 → 浏览器能播的 mp4（H.264 + AAC + faststart）。

    -pix_fmt yuv420p  8bit，兼容所有浏览器
    -movflags +faststart  moov 挪到文件头 → 不用下完就能起播
    """
    if not available():
        return False
    args = [ffmpeg(), '-y', '-loglevel', 'error', '-i', src,
            '-map', '0:v:0', '-map', '0:a:0?',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
            '-movflags', '+faststart', dst]
    rc, err = await _run(args, timeout=timeout)
    ok = rc == 0 and os.path.isfile(dst) and os.path.getsize(dst) > 0
    if not ok:
        logbuf.debug('ffmpeg', '视频转码失败：%s' % (err or b'')[:160])
    return ok


async def remux_faststart(src, dst, timeout=300):
    """只重封装（不重编码），把 moov 挪到文件头。

    已经是 H.264+AAC 的视频走这条 —— 几秒就完事，不用重新编码。
    """
    if not available():
        return False
    args = [ffmpeg(), '-y', '-loglevel', 'error', '-i', src,
            '-c', 'copy', '-movflags', '+faststart', dst]
    rc, err = await _run(args, timeout=timeout)
    ok = rc == 0 and os.path.isfile(dst) and os.path.getsize(dst) > 0
    if not ok:
        logbuf.debug('ffmpeg', '重封装失败：%s' % (err or b'')[:160])
    return ok


async def convert_atomic(src, kind, timeout=600):
    """转码并**原子替换**：先写临时文件，成功了才替换源文件。

    返回 (新路径, mime)；失败返回 (None, '')，且**源文件原封不动**。

    为什么要原子：历史语音文件的后缀是 .mp3，内容其实是 AMR。
    直接让 ffmpeg 输出到同名文件会被 ffmpeg 拒绝
    （"Output file is the same as input file"），
    而之前失败后清理逻辑又会把源文件删掉 —— 原始语音就这么丢了。
    """
    base, _ = os.path.splitext(src)
    if kind == 'audio':
        tmp, final, mime = base + '.conv.mp3', base + '.mp3', 'audio/mpeg'
    elif kind == 'video':
        tmp, final, mime = base + '.conv.h264.mp4', base + '.h264.mp4', 'video/mp4'
    else:
        return None, ''
    ok = False
    try:
        if kind == 'audio':
            ok = await to_mp3(src, tmp, timeout=min(timeout, 120))
        else:
            info = await probe(src)
            if needs_transcode(info):
                ok = await to_web_mp4(src, tmp, timeout=timeout)
            else:
                ok = await remux_faststart(src, tmp, timeout=min(timeout, 300))
        if not ok:
            # 失败：清掉可能的半成品，**不动源文件**
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except Exception:
                pass
            return None, ''
        # 成功：原子替换
        if os.path.abspath(final) != os.path.abspath(src):
            os.replace(tmp, final)
        else:
            os.replace(tmp, final)
        return final, mime
    except Exception as e:
        logbuf.warn('ffmpeg', '转码异常 %s：%s' % (os.path.basename(src), str(e)[:140]))
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass
        return None, ''


# ---------------------------------------------------------------- 图片

# 常见图片魔数 → (扩展名, mime)
_IMAGE_MAGIC = [
    (b'\xff\xd8\xff', '.jpg', 'image/jpeg'),
    (b'\x89PNG\r\n\x1a\n', '.png', 'image/png'),
    (b'GIF87a', '.gif', 'image/gif'),
    (b'GIF89a', '.gif', 'image/gif'),
    (b'BM', '.bmp', 'image/bmp'),
]


def sniff_image(data):
    """按魔数判断图片真实格式。返回 (ext, mime)；认不出返回 ('', '')。"""
    if not data or len(data) < 12:
        return '', ''
    for magic, ext, mime in _IMAGE_MAGIC:
        if data.startswith(magic):
            return ext, mime
    # WebP: "RIFF"...."WEBP"
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return '.webp', 'image/webp'
    return '', ''


def sniff_audio(data):
    """按魔数判断音频真实格式。返回 (ext, mime)。"""
    if not data or len(data) < 12:
        return '', ''
    # ★ QQ 原生语音：SILK v3，头是 "\x02#!SILK_V3"（前面那个 0x02 是帧长前缀）。
    #   千万不能落到下面的 AMR 判断里 —— 文件名一直叫 .amr，但内容 ffmpeg 解不了。
    if b'#!SILK' in bytes(data[:12]):
        return '.silk', 'audio/silk'
    if data.startswith(b'#!AMR'):
        return '.amr', 'audio/amr'
    if data.startswith(b'RIFF') and data[8:12] == b'WAVE':
        return '.wav', 'audio/wav'
    if data[:2] == b'\xff\xfb' or data[:2] == b'\xff\xf3' or data[:2] == b'\xff\xf2':
        return '.mp3', 'audio/mpeg'
    if data[:4] == b'OggS':
        return '.ogg', 'audio/ogg'
    if data.startswith(b'fLaC'):
        return '.flac', 'audio/flac'
    return '', ''
