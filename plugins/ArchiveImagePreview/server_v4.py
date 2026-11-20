# -*- coding: utf-8 -*-
"""压缩包图片预览：上传 ZIP/TAR/TAR.GZ/7Z/RAR，扫描图片并输出卡片缩略图。"""
import base64
import io
import json
import os
import re
import shutil
import subprocess
import tarfile
import threading
import time
import uuid
import zipfile

import rcplugin as rc

APP_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(APP_DIR, "cache")
ARCH_DIR = os.path.join(CACHE, "archives")
THUMB_DIR = os.path.join(CACHE, "thumbs")
FULL_DIR = os.path.join(CACHE, "full")
ORIG_DIR = os.path.join(CACHE, "originals")
META_FILE = os.path.join(CACHE, "archives.json")
for d in (CACHE, ARCH_DIR, THUMB_DIR, FULL_DIR, ORIG_DIR):
    os.makedirs(d, exist_ok=True)

IMAGE_EXTS = {
    ".jpg", ".jpeg", ".jfif", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff",
    ".avif", ".heic", ".heif", ".svg", ".ico", ".cur", ".jp2", ".j2k", ".pcx",
    ".tga", ".dds", ".exr", ".hdr", ".psd", ".ppm", ".pgm", ".pbm", ".xpm",
}
ARCHIVE_EXTS = (".zip", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2",
                ".tar.xz", ".txz", ".7z", ".rar", ".cbz", ".cbr")
_archives = {}
_uploads = {}
_lock = threading.RLock()


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _now():
    return int(time.time())


def _safe(s, default="file"):
    s = re.sub(r"[^0-9A-Za-z._\-\u4e00-\u9fff]+", "_", str(s or "")).strip("._")
    return s[:160] or default


def _load_meta():
    try:
        with open(META_FILE, encoding="utf-8") as f:
            rows = json.load(f)
    except Exception:
        rows = []
    for a in rows:
        if not isinstance(a, dict) or not a.get("id"):
            continue
        if not os.path.isfile(a.get("path") or ""):
            continue
        _archives[a["id"]] = a


def _save_meta():
    rows = []
    for a in _archives.values():
        rows.append({k: v for k, v in a.items() if k not in ("lock",)})
    with _lock:
        tmp = META_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(rows[-200:], f, ensure_ascii=False, indent=2)
        os.replace(tmp, META_FILE)


def _ext(name):
    low = (name or "").lower()
    for e in (".tar.gz", ".tar.bz2", ".tar.xz"):
        if low.endswith(e):
            return e
    return os.path.splitext(low)[1]


def _kind(name):
    e = _ext(name)
    if e in (".zip", ".cbz"):
        return "zip"
    if e in (".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz"):
        return "tar"
    if e in (".7z", ".rar", ".cbr"):
        return "7z"
    return ""


def _is_image(name):
    return _ext(name) in IMAGE_EXTS


def _scan_zip(path):
    out = []
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.is_dir() or not _is_image(info.filename):
                continue
            out.append({"idx": len(out), "name": info.filename,
                        "size": int(info.file_size or 0),
                        "ext": _ext(info.filename), "member": info.filename})
    return out


def _scan_tar(path):
    out = []
    with tarfile.open(path, "r:*") as tf:
        for m in tf.getmembers():
            if not m.isfile() or not _is_image(m.name):
                continue
            out.append({"idx": len(out), "name": m.name,
                        "size": int(m.size or 0),
                        "ext": _ext(m.name), "member": m.name})
    return out


def _find_7z():
    for n in ("7z", "7zz", "7za", "unrar", "unar"):
        p = shutil.which(n)
        if p:
            return n, p
    return "", ""


def _scan_7z(path, aid, name):
    exe, full = _find_7z()
    if not exe:
        _err("服务器没有 7z/unrar，无法解压 7Z/RAR；请安装 p7zip-full 或 unrar")
    dst = os.path.join(CACHE, "extract", aid)
    os.makedirs(dst, exist_ok=True)
    if exe.startswith("7z"):
        cmd = [full, "x", "-y", "-o" + dst, path]
    elif exe == "unrar":
        cmd = [full, "x", "-o+", path, dst + os.sep]
    else:
        cmd = [full, "-o", dst, path]
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       timeout=1800)
    if r.returncode != 0:
        _err("解压失败：" + r.stdout.decode("utf-8", "replace")[-300:])
    out = []
    for root, _dirs, files in os.walk(dst):
        for fn in files:
            if not _is_image(fn):
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, dst).replace("\\", "/")
            out.append({"idx": len(out), "name": rel,
                        "size": os.path.getsize(p), "ext": _ext(fn), "rel": rel})
    return out, dst


def _entry_bytes(a, entry):
    if a.get("extract_dir"):
        p = os.path.join(a["extract_dir"], entry.get("rel") or entry["name"])
        with open(p, "rb") as f:
            return f.read()
    path = a["path"]
    if a["kind"] == "zip":
        with zipfile.ZipFile(path) as z:
            return z.read(entry["member"])
    if a["kind"] == "tar":
        with tarfile.open(path, "r:*") as tf:
            f = tf.extractfile(entry["member"])
            if f is None:
                raise RuntimeError("无法读取成员")
            return f.read()
    raise RuntimeError("不支持的归档类型")


def _file_url(path):
    rel = os.path.relpath(path, CACHE).replace("\\", "/")
    return "/api/plugins/ArchiveImagePreview/cache/" + rel


def _image_to(data, out_path, max_side, ext):
    """转换图片；SVG 直接原样输出。返回输出扩展名。"""
    if ext == ".svg" or (data[:200].lstrip().lower().startswith(b"<svg")):
        out = os.path.splitext(out_path)[0] + ".svg"
        with open(out, "wb") as f:
            f.write(data)
        return out, "image/svg+xml"
    from PIL import Image, ImageOps
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im)
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    if getattr(im, "is_animated", False):
        im.seek(0)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        out = os.path.splitext(out_path)[0] + ".png"
        im.save(out, "PNG", optimize=True)
        return out, "image/png"
    im = im.convert("RGB")
    out = os.path.splitext(out_path)[0] + ".jpg"
    im.save(out, "JPEG", quality=88, optimize=True)
    return out, "image/jpeg"


def _get_archive(aid):
    a = _archives.get(str(aid))
    if not a:
        _err("压缩包不存在")
    return a


def _get_entry(a, idx):
    try:
        i = int(idx)
    except Exception:
        _err("图片索引无效")
    for e in a.get("entries") or []:
        if int(e.get("idx")) == i:
            return e
    _err("图片不存在")


@rc.interface("zipimg.info")
def zipimg_info(params):
    return {"ok": True, "name": "ArchiveImagePreview", "version": "1.0.0",
            "formats": sorted(IMAGE_EXTS), "archives": len(_archives)}


@rc.interface("zipimg.upload.start")
def zipimg_upload_start(params):
    p = _p(params)
    name = _safe(p.get("filename") or "archive.zip")
    size = int(p.get("size") or 0)
    if size <= 0:
        _err("压缩包为空")
    uid = "up_" + uuid.uuid4().hex[:12]
    path = os.path.join(CACHE, uid + ".part")
    open(path, "wb").close()
    _uploads[uid] = {"id": uid, "name": name, "size": size, "path": path,
                     "received": 0, "created": _now()}
    return {"ok": True, "upload_id": uid, "chunk_size": 3 * 1024 * 1024}


@rc.interface("zipimg.upload.chunk")
def zipimg_upload_chunk(params):
    p = _p(params)
    uid = str(p.get("upload_id") or "")
    u = _uploads.get(uid)
    if not u:
        _err("上传会话不存在")
    data = p.get("data") or ""
    if isinstance(data, str) and "," in data and data.startswith("data:"):
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data)
    except Exception:
        _err("分块 base64 无效")
    index = int(p.get("index") or 0)
    # 按顺序追加；分块重复时按偏移覆盖，支持前端重试
    with open(u["path"], "r+b") as f:
        f.seek(index * 3 * 1024 * 1024)
        f.write(raw)
    u["received"] = max(u["received"], index * 3 * 1024 * 1024 + len(raw))
    return {"ok": True, "upload_id": uid, "received": u["received"]}


@rc.interface("zipimg.upload.finish")
def zipimg_upload_finish(params):
    uid = str(_p(params).get("upload_id") or "")
    u = _uploads.pop(uid, None)
    if not u:
        _err("上传会话不存在")
    aid = "arc_" + uuid.uuid4().hex[:12]
    ext = _ext(u["name"])
    kind = _kind(u["name"])
    if not kind:
        try:
            os.remove(u["path"])
        except Exception:
            pass
        _err("不支持的压缩包格式，请上传 ZIP/TAR/TAR.GZ/7Z/RAR")
    dest = os.path.join(ARCH_DIR, aid + ext)
    os.replace(u["path"], dest)
    a = {"id": aid, "name": u["name"], "path": dest, "kind": kind,
         "size": os.path.getsize(dest), "created": _now(), "entries": []}
    try:
        if kind == "zip":
            a["entries"] = _scan_zip(dest)
        elif kind == "tar":
            a["entries"] = _scan_tar(dest)
        else:
            a["entries"], a["extract_dir"] = _scan_7z(dest, aid, u["name"])
    except Exception as e:
        try:
            os.remove(dest)
        except Exception:
            pass
        _err("扫描压缩包失败: %s" % str(e)[:300])
    with _lock:
        _archives[aid] = a
        _save_meta()
    return {"ok": True, "archive": _archive_public(a), "entries": _entries_public(a)}


def _archive_public(a):
    return {"id": a["id"], "name": a["name"], "kind": a["kind"],
            "size": a.get("size") or 0, "created": a.get("created") or 0,
            "images": len(a.get("entries") or [])}


def _entries_public(a):
    return [{"idx": e["idx"], "name": e["name"], "size": e.get("size") or 0,
             "ext": e.get("ext") or ""} for e in (a.get("entries") or [])]


@rc.interface("zipimg.list")
def zipimg_list(params):
    rows = sorted(_archives.values(), key=lambda x: x.get("created") or 0, reverse=True)
    return {"ok": True, "archives": [_archive_public(a) for a in rows]}


@rc.interface("zipimg.entries")
def zipimg_entries(params):
    a = _get_archive(_p(params).get("aid"))
    return {"ok": True, "archive": _archive_public(a), "entries": _entries_public(a)}


@rc.interface("zipimg.thumb")
def zipimg_thumb(params):
    a = _get_archive(_p(params).get("aid"))
    e = _get_entry(a, _p(params).get("idx"))
    out_base = os.path.join(THUMB_DIR, a["id"], "%04d" % int(e["idx"]))
    for ext in (".jpg", ".png", ".svg"):
        p = out_base + ext
        if os.path.isfile(p):
            return {"ok": True, "file": _file_url(p), "mime": _mime(p)}
    os.makedirs(os.path.dirname(out_base), exist_ok=True)
    data = _entry_bytes(a, e)
    out, mime = _image_to(data, out_base, 480, e.get("ext") or "")
    return {"ok": True, "file": _file_url(out), "mime": mime}


@rc.interface("zipimg.preview")
def zipimg_preview(params):
    a = _get_archive(_p(params).get("aid"))
    e = _get_entry(a, _p(params).get("idx"))
    out_base = os.path.join(FULL_DIR, a["id"], "%04d" % int(e["idx"]))
    for ext in (".jpg", ".png", ".svg"):
        p = out_base + ext
        if os.path.isfile(p):
            return {"ok": True, "file": _file_url(p), "mime": _mime(p)}
    os.makedirs(os.path.dirname(out_base), exist_ok=True)
    data = _entry_bytes(a, e)
    out, mime = _image_to(data, out_base, 2400, e.get("ext") or "")
    return {"ok": True, "file": _file_url(out), "mime": mime}


@rc.interface("zipimg.original")
def zipimg_original(params):
    a = _get_archive(_p(params).get("aid"))
    e = _get_entry(a, _p(params).get("idx"))
    out = os.path.join(ORIG_DIR, a["id"], "%04d_%s" % (int(e["idx"]), _safe(os.path.basename(e["name"]))))
    if not os.path.isfile(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "wb") as f:
            f.write(_entry_bytes(a, e))
    return {"ok": True, "file": _file_url(out), "name": os.path.basename(e["name"]),
            "mime": _mime(out), "size": os.path.getsize(out)}


@rc.interface("zipimg.delete")
def zipimg_delete(params):
    aid = str(_p(params).get("aid") or "")
    a = _archives.pop(aid, None)
    if a:
        for p in (a.get("path"), a.get("extract_dir")):
            if p:
                try:
                    if os.path.isdir(p):
                        shutil.rmtree(p, ignore_errors=True)
                    elif os.path.isfile(p):
                        os.remove(p)
                except Exception:
                    pass
        for d in (THUMB_DIR, FULL_DIR, ORIG_DIR):
            shutil.rmtree(os.path.join(d, aid), ignore_errors=True)
        _save_meta()
    return {"ok": True}


def _mime(path):
    ext = os.path.splitext(path)[1].lower()
    return {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
            ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
            ".bmp": "image/bmp", ".ico": "image/x-icon"}.get(ext, "application/octet-stream")


_load_meta()

if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="ArchiveImagePreview",
        version="1.0.0",
        manifest={"label": "压缩包图片预览",
                  "description": "上传压缩包，扫描图片并以卡片墙预览"},
        frontend={"pages": [{"path": "", "title": "压缩包图片预览"}]},
        iface_ids=None,
        plugin_dir=APP_DIR,
    )
