#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""取证: 文件识别 / 内嵌文件 / 元数据 / 字符串 / 时间线。

不上传大文件: 宿主 RPC 单帧上限 8MB, base64 会再涨 4/3,
所以前端只允许 3MB 以内的样本, 超过就提示用"放进插件目录再引用"的方式。
"""
import base64
import hashlib
import io
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


def _exif(buf):
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS
        im = Image.open(io.BytesIO(buf))
        out = {"format": im.format, "size": "%dx%d" % im.size, "mode": im.mode}
        ex = getattr(im, "_getexif", lambda: None)()
        if ex:
            tags = {}
            for k, v in ex.items():
                name = TAGS.get(k, str(k))
                if isinstance(v, bytes):
                    v = v[:40].hex()
                tags[name] = str(v)[:120]
            out["exif"] = dict(list(tags.items())[:30])
        return out
    except Exception:
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
        "exif": _exif(buf),
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
    ex = meta.get("exif") or {}
    if ex.get("exif"):
        bits.append("EXIF %d 项" % len(ex["exif"]))
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
        ex = ((meta.get("exif") or {}).get("exif") or {})
        for k in ("DateTimeOriginal", "DateTime", "CreateDate"):
            if ex.get(k):
                ts, src = ex[k], "EXIF " + k
                break
        out.append({"ts": ts, "source": src, "filename": r["filename"],
                    "kind": r["kind"], "findings": _findings(meta)})
    out.sort(key=lambda x: str(x["ts"]))
    return out
