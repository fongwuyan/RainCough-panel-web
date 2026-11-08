# -*- coding: utf-8 -*-
"""SILK 语音解码（QQ 原生语音格式）。

★ 为什么需要它：
  协议端把语音转成 AMR 再给 OneBot，ffmpeg 直接能解；
  **SnowLuma 给的是原始 SILK**（文件头 `\\x02#!SILK_V3`，但文件名还叫 .amr），
  ffmpeg 没有 SILK 解码器，转码必然失败 → 面板里语音显示"浏览器放不了"。

★ 用什么解：
  `pilk`（PyPI，SILK v3 解码器，C 扩展）。装法：
      python3 -m pip install --break-system-packages pilk \\
          -i https://pypi.tuna.tsinghua.edu.cn/simple
  解码产物是 24kHz 单声道 PCM，再交给 ffmpeg 转 mp3。

★ 没装 pilk 时的行为：
  available() 返回 False，调用方保留原文件、标成不可播放，
  不会抛异常、更不会删文件。
"""
import os


_MAGICS = (b'\x02#!SILK_V3', b'#!SILK_V3', b'\x02#!SILK_V3\x1c')


def available():
    try:
        import pilk  # noqa: F401
        return True
    except Exception:
        return False


def is_silk(path_or_data):
    """按内容判断是不是 SILK（不看后缀 —— QQ 给的文件名一直是 .amr）。"""
    try:
        if isinstance(path_or_data, (bytes, bytearray)):
            head = bytes(path_or_data[:16])
        else:
            with open(path_or_data, 'rb') as f:
                head = f.read(16)
    except Exception:
        return False
    return any(head.startswith(m) for m in _MAGICS)


def to_wav(src, dst, rate=24000):
    """SILK → wav。成功返回 True。"""
    try:
        from pilk import silk_to_wav
    except Exception:
        return False
    try:
        silk_to_wav(src, dst, rate=rate)
        return os.path.isfile(dst) and os.path.getsize(dst) > 0
    except Exception:
        try:
            if os.path.isfile(dst):
                os.remove(dst)
        except Exception:
            pass
        return False


async def to_mp3(src, dst):
    """SILK → mp3（解 SILK 用 pilk，编 mp3 用 ffmpeg）。成功返回 True。"""
    import asyncio

    from . import ffmpeg

    if not (available() and ffmpeg.available()):
        return False
    wav = src + '.dec.wav'
    try:
        if not await asyncio.to_thread(to_wav, src, wav):
            return False
        return await ffmpeg.to_mp3(wav, dst)
    finally:
        try:
            if os.path.isfile(wav):
                os.remove(wav)
        except Exception:
            pass
