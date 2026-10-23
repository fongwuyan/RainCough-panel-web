#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""取证: 文件识别 / 内嵌文件 / 元数据 / 字符串 / 时间线。

不上传大文件: 宿主 RPC 单帧上限 8MB, base64 会再涨 4/3,
所以前端只允许 3MB 以内的样本, 超过就提示用"放进插件目录再引用"的方式。
"""
import base64
import hashlib
import json
import os
import re
import time

from core import store

MAX_BYTES = 3 * 1024 * 1024

# magic 表: 只放常见且判定明确的
MAGIC = [
    (b"\x7fELF", 0, "ELF 可执行文件"),
    (b"MZ", 0, "PE / DOS 可执行文件"),
    (b"\x89PNG\r\n\x1a\n", 0, "PNG 图片"),
    (b"\xff\xd8\xff", 0, "JPEG 图片"),
    (b"GIF8", 0, "GIF 图片"),
    (b"RIFF", 0, "RIFF 容器(WAV/AVI/WebP)"),
    (b"%PDF", 0, "PDF 文档"),
    (b"PK\x03\x04", 0, "ZIP 容器(docx/xlsx/apk/jar)"),
    (b"Rar!\x1a\x07", 0, "RAR 压缩包"),
    (b"7z\xbc\xaf\x27\x1c", 0, "7z 压缩包"),
    (b"\x1f\x8b", 0, "GZIP 压缩数据"),
    (b"BZh", 0, "BZIP2 压缩数据"),
    (b"SQLite format 3\x00", 0, "SQLite 数据库"),
    (b"\xd0\xcf\x11\xe0", 0, "OLE 复合文档(doc/xls/ppt)"),
    (b"dex\n", 0, "DEX(Android)"),
    (b"\x03\x00\x08\x00", 0, "Dalvik? (可能是误判)"),
    (b"#!/", 0, "脚本(带 shebang)"),
    (b"<html", 0, "HTML 文档"),
    (b"<?php", 0, "PHP 源码"),
    (b"\x00\x61\x73\x6d", 0, "WebAssembly"),
    (b"fLaC", 0, "FLAC 音频"),
    (b"OggS", 0, "OGG 容器"),
    (b"\x00\x00\x00\x18ftyp", 0, "MP4/MOV 视频"),
]

# 尾部附加数据的特征(隐写最常见的形式)
TAIL_MARKS = [b"PK\x03\x04", b"\xff\xd8\xff", b"\x89PNG", b"%PDF", b"Rar!", b"7z\xbc"]


def _magic(buf):
    hits = []
    for sig, off, name in MAGIC:
        if buf[off:off + len(sig)] == sig:
            hits.append({"name": name, "offset": off})
    # 内嵌: 在前 1MB 里找其他格式的起始
    if len(buf) > 64:
        for sig, off, name in MAGIC:
            idx = buf.find(sig, 1, min(len(buf), 1024 * 1024))
            if idx > 0:
                hits.append({"name": "内嵌 " + name, "offset": idx})
    return hits[:12]


def _strings(buf, minlen=6, limit=60):
    """可打印字符串: ASCII 与 UTF-16LE 两种, 后者是 Windows 程序常见形态。"""
    out = []
    for m in re.finditer(rb"[\x20-\x7e]{%d,}" % minlen, buf):
        s = m.group().decode("ascii", "ignore")
        if len(out) < limit:
            out.append({"off": m.start(), "s": s[:120]})
    if len(out) < limit // 2:
        for m in re.finditer((rb"(?:[\x20-\x7e]\x00){%d,}" % minlen), buf):
            s = m.group().decode("utf-16le", "ignore")
            if len(out) < limit:
                out.append({"off": m.start(), "s": s[:120], "enc": "utf16"})
    return out


def _tail_extra(buf):
    """判断是否有尾部附加数据: 最后一个已知格式的结束位置之后还有内容。"""
    if len(buf) < 1024:
        return None
    tail = buf[-2048:]
    for mark in TAIL_MARKS:
        idx = tail.find(mark)
        if idx >= 0 and idx + len(mark) < len(tail) - 64:
            return {"marker": mark.decode("latin-1", "ignore"),
                    "offset_from_end": len(tail) - idx,
                    "note": "尾部出现另一种文件头, 可能是附加/隐写数据"}
    return None


# ---------------------------------------------------------------- 图片元数据
#
# ★ 纯标准库实现, 不依赖 PIL。
#   目标机器不一定有 Pillow, 而"读 EXIF"这件事本身只需要按 TIFF 结构走一遍 IFD。

# 只保留对取证有意义的标签
_EXIF_TAGS = {
    0x010E: "ImageDescription", 0x010F: "Make", 0x0110: "Model",
    0x0112: "Orientation", 0x011A: "XResolution", 0x011B: "YResolution",
    0x0128: "ResolutionUnit", 0x0131: "Software", 0x0132: "DateTime",
    0x829A: "ExposureTime", 0x829D: "FNumber", 0x8822: "ExposureProgram",
    0x8827: "ISO", 0x9003: "DateTimeOriginal", 0x9004: "DateTimeDigitized",
    0x9201: "ShutterSpeed", 0x9202: "Aperture", 0x9209: "Flash",
    0x920A: "FocalLength", 0xA002: "PixelXDimension", 0xA003: "PixelYDimension",
    0xA430: "CameraOwner", 0xA431: "BodySerialNumber", 0xA434: "LensModel",
}
_TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8}


def _u16(b, o, le):
    return int.from_bytes(b[o:o + 2], "little" if le else "big")


def _u32(b, o, le):
    return int.from_bytes(b[o:o + 4], "little" if le else "big")


def _read_value(tiff, t, cnt, off, le):
    """按类型读出值。返回 str(便于直接展示), 读不出就返回 None。"""
    size = _TYPE_SIZE.get(t, 1) * cnt
    if size > 1024:          # 单条超长(如缩略图)直接跳过
        return None
    if size <= 4:
        base = off            # 值内联在 entry 里
    else:
        base = _u32(tiff, off, le)
    if base <= 0 or base + size > len(tiff):
        return None
    raw = tiff[base:base + size]
    try:
        if t == 2:            # ASCII
            return raw.split(b"\x00", 1)[0].decode("utf-8", "replace").strip()
        if t in (1, 7):
            return raw[:32].hex()
        if t == 3:
            vals = [_u16(raw, i * 2, le) for i in range(min(cnt, 8))]
        elif t == 4:
            vals = [_u32(raw, i * 4, le) for i in range(min(cnt, 8))]
        elif t == 9:
            vals = [int.from_bytes(raw[i * 4:i * 4 + 4], "little" if le else "big", signed=True)
                    for i in range(min(cnt, 8))]
        elif t in (5, 10):
            vals = []
            for i in range(min(cnt, 4)):
                num = int.from_bytes(raw[i * 8:i * 8 + 4], "little" if le else "big",
                                     signed=(t == 10))
                den = int.from_bytes(raw[i * 8 + 4:i * 8 + 8], "little" if le else "big",
                                     signed=(t == 10))
                vals.append(round(num / den, 4) if den else num)
        else:
            return raw[:32].hex()
        return ", ".join(str(v) for v in vals) if vals else None
    except Exception:
        return None


def _parse_tiff(tiff):
    """走 IFD0 + Exif 子 IFD, 返回 {标签名: 值}。"""
    if len(tiff) < 8:
        return None
    le = tiff[:2] == b"II"
    if tiff[:2] not in (b"II", b"MM"):
        return None
    out = {}
    try:
        ifd = _u32(tiff, 4, le)
        seen = set()
        for _ in range(3):                    # IFD0 → Exif → 最多三层, 防环
            if ifd <= 0 or ifd in seen or ifd + 2 > len(tiff):
                break
            seen.add(ifd)
            n = _u16(tiff, ifd, le)
            if n <= 0 or n > 512:
                break
            nxt = 0
            for i in range(n):
                e = ifd + 2 + i * 12
                if e + 12 > len(tiff):
                    break
                tag = _u16(tiff, e, le)
                typ = _u16(tiff, e + 2, le)
                cnt = _u32(tiff, e + 4, le)
                val = _read_value(tiff, typ, cnt, e + 8, le)
                if tag == 0x8769:              # Exif 子 IFD 指针
                    nxt = _u32(tiff, e + 8, le)
                    continue
                if tag == 0x8825:
                    out["_has_gps"] = "yes"
                    continue
                name = _EXIF_TAGS.get(tag)
                if name and val not in (None, ""):
                    out[name] = val[:120]
            if nxt:
                ifd = nxt
                continue
            break
    except Exception:
        pass
    return out or None


def _jpeg_size(buf):
    i = 2
    while i + 9 < len(buf):
        if buf[i] != 0xFF:
            i += 1
            continue
        m = buf[i + 1]
        if m in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB):
            h = int.from_bytes(buf[i + 5:i + 7], "big")
            w = int.from_bytes(buf[i + 7:i + 9], "big")
            return w, h
        if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
            i += 2
            continue
        seg = int.from_bytes(buf[i + 2:i + 4], "big")
        if seg < 2:
            break
        i += 2 + seg
    return 0, 0


def _png_info(buf):
    w = h = 0
    text = {}
    if len(buf) >= 24 and buf[12:16] == b"IHDR":
        w = int.from_bytes(buf[16:20], "big")
        h = int.from_bytes(buf[20:24], "big")
    pos = 8
    while pos + 8 < len(buf) and len(text) < 20:
        ln = int.from_bytes(buf[pos:pos + 4], "big")
        typ = buf[pos + 4:pos + 8]
        body = buf[pos + 8:pos + 8 + ln]
        if typ in (b"tEXt", b"iTXt") and b"\x00" in body:
            k, v = body.split(b"\x00", 1)
            key = k.decode("latin-1", "replace")[:40]
            val = v.split(b"\x00")[-1].decode("utf-8", "replace")[:120]
            if key and val:
                text[key] = val
        pos += 12 + ln
        if typ == b"IEND":
            break
    return w, h, text


def _image_info(buf):
    """识别格式、尺寸与元数据。返回 dict 或 None(不是图片)。"""
    out = {"format": "", "size": "", "exif": {}}
    try:
        if buf[:3] == b"\xff\xd8\xff":
            out["format"] = "JPEG"
            w, h = _jpeg_size(buf)
            if w and h:
                out["size"] = "%dx%d" % (w, h)
            i = buf.find(b"Exif\x00\x00")
            if i > 0:
                ex = _parse_tiff(buf[i + 6:])
                if ex:
                    out["exif"] = ex
            return out
        if buf[:8] == b"\x89PNG\r\n\x1a\n":
            out["format"] = "PNG"
            w, h, text = _png_info(buf)
            if w and h:
                out["size"] = "%dx%d" % (w, h)
            if text:
                out["exif"] = text
            return out
        if buf[:4] in (b"GIF8", b"GIF9"):
            out["format"] = "GIF"
            if len(buf) >= 10:
                out["size"] = "%dx%d" % (int.from_bytes(buf[6:8], "little"),
                                         int.from_bytes(buf[8:10], "little"))
            return out
        if buf[:2] == b"BM" and len(buf) >= 26:
            out["format"] = "BMP"
            out["size"] = "%dx%d" % (int.from_bytes(buf[18:22], "little"),
                                     abs(int.from_bytes(buf[22:26], "little", signed=True)))
            return out
    except Exception:
        pass
    return None


def upload(params):
    """接收 base64 样本, 落盘并分析。"""
    name = os.path.basename(params.get("filename") or "sample.bin")[:120]
    b64 = params.get("data_b64") or ""
    if not b64:
        raise ValueError("缺少文件内容")
    try:
        buf = base64.b64decode(b64, validate=False)
    except Exception as e:
        raise ValueError("base64 解码失败: %s" % e)
    if len(buf) > MAX_BYTES:
        raise ValueError("样本超过 %d MB, 请先裁剪或改用「放入插件目录」方式" % (MAX_BYTES // 1024 // 1024))
    if not buf:
        raise ValueError("文件为空")

    tid = int(params.get("task_id") or 0)
    ts = int(time.time())
    safe = re.sub(r"[^\w.\-]", "_", name) or "sample.bin"
    path = os.path.join(store.UPLOAD_DIR, "%d_%s" % (ts, safe))
    os.makedirs(store.UPLOAD_DIR, exist_ok=True)
    with open(path, "wb") as f:
        f.write(buf)

    magic = _magic(buf)
    meta = {
        "size": len(buf),
        "md5": hashlib.md5(buf).hexdigest(),
        "sha256": hashlib.sha256(buf).hexdigest(),
        "magic": magic,
        "entropy": round(_entropy(buf), 2),
        "tail": _tail_extra(buf),
        "image": _image_info(buf),
        "strings": _strings(buf),
        "path": path,
    }
    kind = magic[0]["name"] if magic else "未知"
    aid = store.artifact_add(tid, name, kind, json.dumps(meta, ensure_ascii=False), path)
    if tid:
        store.task_touch(tid)
    return {"artifact_id": aid, "filename": name, "kind": kind, "meta": meta}


def _entropy(buf):
    if not buf:
        return 0
    freq = [0] * 256
    for b in buf:
        freq[b] += 1
    n = len(buf)
    import math
    return -sum((c / n) * math.log2(c / n) for c in freq if c)


def artifacts(task_id):
    rows = store.artifact_list(task_id)
    out = []
    for r in rows:
        try:
            meta = json.loads(r["meta"] or "{}")
        except Exception:
            meta = {}
        out.append({"id": r["id"], "filename": r["filename"], "kind": r["kind"],
                    "created_at": r["created_at"],
                    "size": meta.get("size", 0), "md5": meta.get("md5", ""),
                    "findings": _findings(meta)})
    return out


def _findings(meta):
    """把 meta 压成一行人类可读的"发现"。"""
    bits = []
    if meta.get("magic"):
        # 全部列出(最多 3 个): 内嵌文件往往比外层格式更有价值
        # 例如"PNG 图片 · 内嵌 PHP 源码"才是这张图的重点
        names = []
        for m in meta["magic"][:3]:
            if m["name"] not in names:
                names.append(m["name"])
        bits.append(" · ".join(names))
    if meta.get("tail"):
        bits.append("尾部附加数据")
    img = meta.get("image") or {}
    tags = img.get("exif") or {}
    if img.get("size"):
        bits.append(img["size"])
    if tags:
        bits.append("EXIF %d 项" % len(tags))
    if tags.get("_has_gps"):
        bits.append("含 GPS")
    if meta.get("entropy", 0) > 7.5:
        bits.append("高熵(可能压缩/加密)")
    return " · ".join(bits) or "—"


def timeline(task_id):
    """时间线: 提取物按创建时间排, 附 EXIF 里的拍摄时间(若有)。"""
    rows = store.artifact_list(task_id)
    out = []
    for r in rows:
        try:
            meta = json.loads(r["meta"] or "{}")
        except Exception:
            meta = {}
        ts = r["created_at"]
        src = "上传"
        tags = ((meta.get("image") or {}).get("exif") or {})
        for k in ("DateTimeOriginal", "DateTime", "DateTimeDigitized"):
            if tags.get(k):
                ts, src = tags[k], "EXIF " + k
                break
        out.append({"ts": ts, "source": src, "filename": r["filename"],
                    "kind": r["kind"], "findings": _findings(meta)})
    out.sort(key=lambda x: str(x["ts"]))
    return out
