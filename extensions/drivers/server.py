#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""系统扩展「驱动」后端（P5-1：只读体检 + 补丁清单 + 预检计划）。

设计见 docs/扩展-驱动-无头矿卡-魔改驱动.md（v3）。要点：
- 补丁数据放**主面板库** <repo>/drivers/{registry.json,patches/*.patch.json}；本后端按来源阶梯取：
  本地目录 → GitHub raw → gh-proxy 镜像（面板库私有可用令牌，只写不读）。
- 官方 .run 由扩展从 download.nvidia.com 下载后本地打补丁（路线 A）：本构建只出**预检计划**，
  真正下载/打补丁/安装是 P5-2。
- 清单不能注入命令：type 只有固定枚举、post 只有四个固定动作、补丁只有 find/replace 十六进制。

自测（无需面板、无需显卡）：
  python3 server.py --print repo  --repo-local /path/to/drivers
  python3 server.py --print gpu   --fake-cards 10de:1c07,10de:2189
  python3 server.py --print plan  --repo-local /path/to/drivers --fake-cards 10de:1c07
"""

import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, ".data")
CONF = os.path.join(DATA, "repo.json")

PANEL_REPO = "fongwuyan/RainCough-panel-web"
DEFAULT_BRANCH = "main"
MIRRORS = ("https://gh-proxy.com/", "https://ghproxy.net/", "https://ghfast.top/")
RAW = "https://raw.githubusercontent.com/%s/%s/%s"
CACHE_TTL = 600          # 清单缓存 10 分钟
PLAN_TTL = 120           # 预检计划有效期(秒)
BUILTIN_ID = "p5-1"      # 本构建阶段标记

TYPE_ENUM = ("patch-data", "patch-script", "nvidia-run")
POST_ENUM = ("blacklist-nouveau", "gsp-off", "initramfs", "depmod")
PCI_RE = re.compile(r"^[0-9a-f]{4}:[0-9a-f]{4}$")
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
VER_RE = re.compile(r"^[0-9]{3}\.[0-9]{1,4}(\.[0-9]{1,4})?$")

# ---- 内置矿卡表（读 pci.ids 兜底；带"这是矿卡"的语义） ----
CARDS = {
    "1b07": ("GP102 [P102-100]", "Pascal", "6.1", "P1XX"),
    "1b87": ("GP104 [P104-100]", "Pascal", "6.1", "P1XX"),
    "1bc7": ("GP104 [P104-101]", "Pascal", "6.1", "P1XX"),
    "1c07": ("GP106 [P106-100]", "Pascal", "6.1", "P1XX"),
    "1c09": ("GP106 [P106-090]", "Pascal", "6.1", "P1XX"),
    "2189": ("TU116 [CMP 30HX]", "Turing", "7.5", "CMP"),
    "1f0b": ("TU106 [CMP 40HX]", "Turing", "7.5", "CMP"),
    "1e09": ("TU102 [CMP 50HX]", "Turing", "7.5", "CMP"),
    "248a": ("GA104 [CMP 70HX]", "Ampere", "8.6", "CMP"),
    "220d": ("GA102 [CMP 90HX]", "Ampere", "8.6", "CMP"),
    "2082": ("GA100 [CMP 170HX]", "Ampere", "8.0", "CMP"),
    "20c2": ("GA100 [CMP 170HX]", "Ampere", "8.0", "CMP"),
}
# 版本偏好（计算用途 → 矩阵 "iGPU/AMD/Turing+/none" 列）
PREFER = {"P1XX": "580.178.04", "CMP": "615.71.09"}
PREFER_WHY = {"P1XX": "P1XX 矿卡 + 计算用途 → 矩阵 iGPU/none 列",
              "CMP": "CMP 矿卡 + 计算用途 → 矩阵 iGPU/none 列"}

PLANS = {}
ROOT = "/"          # fixture 时替换为假根
FAKE_CARDS = None   # selftest 用
FAKE_BASE = None    # selftest: 假官方 .run 路径（用于 base 校验测试）


# ---------------- 基础工具 ----------------

def sh(args, timeout=15, env=None):
    """固定 argv 执行（永不 shell=True）。"""
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=env)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except FileNotFoundError:
        return 127, "not found: %s" % args[0]
    except subprocess.TimeoutExpired:
        return 124, "timeout: %s" % " ".join(args)


def which(name, cands=None):
    if cands:
        for c in cands:
            if os.path.exists(c):
                return c
    return shutil.which(name)


def sha256_file(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def sha256_text(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def p(rel):
    """按（可能的假）根拼路径。"""
    return os.path.join(ROOT, rel.lstrip("/"))


def read_text(path, default=""):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return default


def read_bytes(path, n=0):
    try:
        with open(path, "rb") as f:
            return f.read(n) if n else f.read()
    except OSError:
        return b""


def kv_file(path, key):
    for ln in read_text(path).splitlines():
        if "=" in ln:
            k, v = ln.split("=", 1)
            if k.strip() == key:
                return v.strip()
    return ""


# ---------------- RPC ----------------

def endpoint():
    ep = (os.environ.get("RC_ENDPOINT") or "").strip()
    if ep:
        return ep
    return read_text(os.path.join(HERE, ".rc.endpoint")).strip()


def connect(retries=20, gap=1.5):
    last = None
    for _ in range(retries):
        ep = endpoint()
        try:
            if ep.startswith("unix:"):
                s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                s.connect(ep[len("unix:"):])
                return s
            if ep.startswith("tcp:"):
                host, port = ep[len("tcp:"):].rsplit(":", 1)
                return socket.create_connection((host, int(port)), 5)
            last = RuntimeError("端点未就绪: %r" % ep)
        except OSError as e:
            last = e
        time.sleep(gap)
    raise RuntimeError("连不上接口库端点: %s" % last)


def dispatch(iface, params):
    """接口分发表（与 extension.json 的 interfaces 一致）。"""
    fn = {
        "drivers.gpu": iface_gpu,
        "drivers.repo": iface_repo,
        "drivers.repo.config": iface_repo_config,
        "drivers.install": iface_install,
    }.get(iface)
    if fn is None:
        raise RpcError(-32601, "未知接口: %s" % iface)
    return fn(params or {})


class RpcError(Exception):
    def __init__(self, code, msg):
        Exception.__init__(self, msg)
        self.code = code
        self.msg = msg


# ---------------- 配置 ----------------

def conf_get():
    c = {"branch": DEFAULT_BRANCH, "mirror": True, "local_dir": "", "token": ""}
    try:
        with open(CONF, "r", encoding="utf-8") as f:
            c.update(json.load(f))
    except (OSError, ValueError):
        pass
    return c


def conf_put(c):
    os.makedirs(DATA, exist_ok=True)
    tmp = CONF + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(c, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, CONF)
    os.chmod(CONF, 0o600)


def iface_repo_config(params):
    c = conf_get()
    if params:
        if "branch" in params and str(params["branch"]).strip():
            c["branch"] = str(params["branch"]).strip()
        if "mirror" in params:
            c["mirror"] = bool(params["mirror"])
        if "local_dir" in params:
            c["local_dir"] = str(params["local_dir"] or "").strip()
        if params.get("clear_token"):
            c["token"] = ""
        elif params.get("token"):
            c["token"] = str(params["token"]).strip()
        conf_put(c)
        invalidate_cache()
    return {"branch": c["branch"], "mirror": c["mirror"], "local_dir": c["local_dir"],
            "token_set": bool(c["token"])}


# ---------------- 清单（补丁数据） ----------------

_cache = {"at": 0, "doc": None, "used": "", "error": "", "sources": []}


def invalidate_cache():
    _cache.update({"at": 0, "doc": None, "used": "", "error": "", "sources": []})


def http_get(url, token="", timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "raincough-drivers/%s" % BUILTIN_ID})
    if token and "github" in url:
        req.add_header("Authorization", "token %s" % token)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def manifest_sources(c):
    out = []
    if c.get("local_dir"):
        out.append(("local", os.path.join(c["local_dir"], "registry.json")))
    url = RAW % (PANEL_REPO, c.get("branch") or DEFAULT_BRANCH, "drivers/registry.json")
    out.append(("direct", url))
    if c.get("mirror"):
        # 国内直连 GitHub 常被重置 → 依次尝试镜像（实测这三个都能取到清单）
        for i, m in enumerate(MIRRORS):
            out.append(("mirror%d" % (i + 1), m + url))
    return out


def fetch_manifest(force=False):
    c = conf_get()
    now = time.time()
    if not force and _cache["doc"] is not None and now - _cache["at"] < CACHE_TTL:
        return _cache
    srcs = manifest_sources(c)
    errs = []
    for kind, target in srcs:
        try:
            if kind == "local":
                raw = read_bytes(target)
                if not raw:
                    errs.append("local: 没有 %s" % target)
                    continue
            else:
                raw = http_get(target, c.get("token", ""))
            doc = json.loads(raw.decode("utf-8"))
            ents, problems = validate_manifest(doc)
            _cache.update({"at": now, "doc": {"schema": doc.get("schema"), "entries": ents,
                                              "problems": problems, "note": doc.get("note", "")},
                           "used": kind, "error": "", "sources": [s[0] for s in srcs]})
            return _cache
        except (urllib.error.URLError, OSError, ValueError) as e:
            errs.append("%s: %s" % (kind, e))
    _cache.update({"at": now, "doc": _cache["doc"], "used": "", "error": "；".join(errs),
                   "sources": [s[0] for s in srcs]})
    return _cache


def validate_manifest(doc):
    """逐条校验；坏条目被剔除并记录原因（不静默）。"""
    problems = []
    if not isinstance(doc, dict):
        raise ValueError("清单不是对象")
    if int(doc.get("schema") or 0) != 1:
        raise ValueError("清单 schema 必须是 1")
    out = []
    for e in doc.get("entries") or []:
        eid = str(e.get("id") or "?")
        try:
            t = e.get("type")
            if t not in TYPE_ENUM:
                raise ValueError("type 非法: %r" % t)
            ids = [str(x).lower() for x in (e.get("card_pci_ids") or [])]
            if not ids:
                raise ValueError("card_pci_ids 为空")
            for cid in ids:
                if not PCI_RE.match(cid):
                    raise ValueError("card_pci_ids 非法: %r" % cid)
            ver = str(e.get("driver_version") or "")
            if not VER_RE.match(ver):
                raise ValueError("driver_version 非法: %r" % ver)
            for act in e.get("post") or []:
                if act not in POST_ENUM:
                    raise ValueError("post 含未枚举动作: %r" % act)
            base = e.get("base") or {}
            if not str(base.get("download_url") or "").startswith("https://download.nvidia.com/"):
                raise ValueError("base.download_url 必须是 NVIDIA 官方地址")
            if base.get("size_b") and int(base["size_b"]) <= 0:
                raise ValueError("base.size_b 非法")
            if base.get("sha256_expected") and not SHA_RE.match(str(base["sha256_expected"]).lower()):
                raise ValueError("base.sha256_expected 不是合法 sha256")
            pt = e.get("patch") or {}
            ppath = str(pt.get("path") or "")
            if not ppath or ".." in ppath.split("/") or ppath.startswith("/"):
                raise ValueError("patch.path 非法: %r" % ppath)
            if not SHA_RE.match(str(pt.get("sha256") or "").lower()):
                raise ValueError("patch.sha256 不是合法 sha256")
            for k in ("base_sha256", "result_sha256"):
                if not SHA_RE.match(str(pt.get(k) or "").lower()):
                    raise ValueError("patch.%s 不是合法 sha256" % k)
            target = str(pt.get("target") or "")
            if ".." in target.split("/") or target.startswith("/"):
                raise ValueError("patch.target 非法: %r" % target)
            ent = {"id": eid, "title": e.get("title") or eid, "type": t,
                   "card_pci_ids": ids, "card_names": e.get("card_names") or [],
                   "arch": e.get("arch") or [], "driver_version": ver,
                   "requires": e.get("requires") or [], "post": e.get("post") or [],
                   "reboot_required": bool(e.get("reboot_required", True)),
                   "notes": e.get("notes") or "",
                   "base": {"version": base.get("version") or ver,
                            "download_url": base["download_url"],
                            "size_b": int(base.get("size_b") or 0),
                            "sha256_expected": (base.get("sha256_expected") or "").lower() or None,
                            "verify": base.get("verify") or ["sh --check"]},
                   "patch": {"path": ppath, "sha256": str(pt["sha256"]).lower(),
                             "target": target, "blocks": int(pt.get("blocks") or 0),
                             "base_sha256": str(pt["base_sha256"]).lower(),
                             "result_sha256": str(pt["result_sha256"]).lower(),
                             "dry_run_required": bool(pt.get("dry_run_required", True))}}
            out.append(ent)
        except ValueError as e:
            problems.append({"id": eid, "error": str(e)})
    return out, problems


def iface_repo(params):
    st = fetch_manifest(force=bool((params or {}).get("refresh")))
    c = conf_get()
    doc = st["doc"] or {"entries": [], "problems": []}
    return {"used": st["used"], "branch": c["branch"], "mirror": c["mirror"],
            "local_dir": c["local_dir"], "token_set": bool(c["token"]),
            "fetched_at": int(st["at"]), "cache_age_s": int(time.time() - st["at"]) if st["at"] else None,
            "sources": st["sources"], "error": st["error"],
            "entries": doc.get("entries", []), "problems": doc.get("problems", []),
            "count": len(doc.get("entries", []))}


def patch_url(entry, c):
    """清单里 patch.path 是仓库内相对路径 → 按当前来源基址拼。"""
    if entry["patch"].get("url"):
        return entry["patch"]["url"]
    branch = c.get("branch") or DEFAULT_BRANCH
    if c.get("local_dir"):
        return "file://" + os.path.join(c["local_dir"], entry["patch"]["path"].split("drivers/", 1)[-1])
    return RAW % (PANEL_REPO, branch, entry["patch"]["path"])


# ---------------- 体检 ----------------

def pci_names():
    """解析 /usr/share/misc/pci.ids 的 10de 段（vendor:device → 名称）。"""
    names = {}
    txt = read_text(p("/usr/share/misc/pci.ids"))
    cur = ""
    for ln in txt.splitlines():
        if not ln or ln.startswith("#"):
            continue
        if not ln.startswith("\t"):
            cur = ln.split()[0] if ln.split() else ""
        elif cur == "10de" and ln.startswith("\t") and not ln.startswith("\t\t"):
            parts = ln.strip().split(None, 1)
            if len(parts) == 2:
                names["10de:" + parts[0].lower()] = parts[1].strip()
    return names


def secure_boot():
    d = p("/sys/firmware/efi/efivars")
    try:
        for fn in os.listdir(d):
            if fn.startswith("SecureBoot-"):
                b = read_bytes(os.path.join(d, fn), 5)
                return bool(b[4]) if len(b) >= 5 else None
    except OSError:
        return None
    return None


def drivers_loaded():
    txt = read_text(p("/proc/modules"))
    return {ln.split()[0] for ln in txt.splitlines() if ln.strip()}


def nvidia_state():
    ver, source = "", "none"
    txt = read_text(p("/proc/driver/nvidia/version"))
    m = re.search(r"Kernel Module\s+([0-9][0-9.]+)", txt)
    if m:
        ver = m.group(1)
    if os.path.exists(p("/usr/bin/nvidia-uninstall")):
        source = "run"
    else:
        rc, out = sh(["dpkg-query", "-W", "-f=${Version}", "nvidia-driver"])
        if rc == 0 and out.strip():
            source, ver = "deb", out.strip()
    return ver, source


def deb_nvidia_packages():
    rc, out = sh(["dpkg-query", "-W", "-f=${Package} ${Version}\n",
                  "nvidia-driver", "nvidia-kernel-dkms", "libnvidia-gl"])
    pkgs = []
    for ln in (out or "").splitlines():
        parts = ln.split()
        if len(parts) == 2 and not parts[0].endswith(":"):
            pkgs.append({"pkg": parts[0], "version": parts[1]})
    return pkgs


def tools_state():
    kver = os.uname().release
    rc, _ = sh(["dpkg-query", "-W", "-f=${Status}", "dkms"])
    dkms = rc == 0
    headers = os.path.exists(p("/lib/modules/%s/build" % kver))
    rc2, _ = sh(["dpkg-query", "-W", "-f=${Status}", "build-essential"])
    be = rc2 == 0
    try:
        st = os.statvfs(p("/"))
        free_mb = int(st.f_bavail * st.f_frsize / (1 << 20))
    except OSError:
        free_mb = 0
    return {"kernel": kver, "dkms": dkms, "headers": headers, "build_essential": be,
            "free_disk_mb": free_mb,
            "modprobe": which("modprobe", ["/usr/sbin/modprobe", "/sbin/modprobe"]),
            "nvidia_smi": which("nvidia-smi", ["/usr/bin/nvidia-smi"])}


def pci_devices():
    """返回 [{'bdf','pci_id','class','driver',...}]（只 NVIDIA）。"""
    out = []
    base = p("/sys/bus/pci/devices")
    try:
        names = sorted(os.listdir(base))
    except OSError:
        return out
    for bdf in names:
        d = os.path.join(base, bdf)
        ven = read_text(os.path.join(d, "vendor")).strip().lower()
        if ven != "0x10de":
            continue
        dev = read_text(os.path.join(d, "device")).strip().lower().replace("0x", "")
        cls = read_text(os.path.join(d, "class")).strip().lower().replace("0x", "")[:4]
        ue = read_text(os.path.join(d, "uevent"))
        drv = kv_file(os.path.join(d, "uevent"), "DRIVER") or ""
        if not drv:
            link = os.path.join(d, "driver")
            if os.path.islink(link):
                drv = os.path.basename(os.readlink(link))
        out.append({"bdf": bdf, "pci_id": "10de:%s" % dev, "class": cls, "driver": drv or None,
                    "link_width": read_text(os.path.join(d, "current_link_width")).strip(),
                    "link_max": read_text(os.path.join(d, "max_link_width")).strip(),
                    "link_speed": read_text(os.path.join(d, "current_link_speed")).strip()})
    return out


def connectors():
    """{bdf: [(connector, status)]} —— 按 PCI 地址映射，不能按 card 序号（card0 常常是核显）。"""
    out = {}
    d = p("/sys/class/drm")
    try:
        names = os.listdir(d)
    except OSError:
        return out
    for n in names:
        m = re.match(r"^card(\d+)-(.+)$", n)
        if not m:
            continue
        devlink = os.path.join(d, "card%s" % m.group(1), "device")
        try:
            bdf = os.path.basename(os.path.realpath(devlink))
        except OSError:
            continue
        out.setdefault(bdf, []).append(
            {"name": m.group(2), "status": read_text(os.path.join(d, n, "status")).strip()})
    return out


def nvidia_smi_gsp():
    """从 nvidia-smi 读 GSP 固件状态（没有则 None）。"""
    smi = which("nvidia-smi", ["/usr/bin/nvidia-smi", "/usr/local/nvidia/bin/nvidia-smi"])
    if not smi:
        return None
    rc, out = sh([smi, "-q"], timeout=15)
    if rc != 0:
        return None
    m = re.search(r"GSP Firmware Version\s*:\s*(\S+)", out)
    if m:
        v = m.group(1)
        return {"raw": v, "enabled": v.lower() not in ("n/a", "unknown", "0")}
    return {"raw": "absent", "enabled": False} if "GSP" in out else None


def iface_gpu(params):
    t0 = time.time()
    st = fetch_manifest(force=bool((params or {}).get("refresh")))
    entries = (st["doc"] or {}).get("entries", [])
    names = pci_names()
    loaded = drivers_loaded()
    ver, source = nvidia_state()
    tl = tools_state()
    conns = connectors()
    gsp = nvidia_smi_gsp()
    sb = secure_boot()

    cards = []
    devs = FAKE_CARDS if FAKE_CARDS is not None else pci_devices()
    for dev in devs:
        pid = dev["pci_id"]
        short = pid.split(":")[1]
        builtin = CARDS.get(short)
        model = (builtin[0] if builtin else (names.get(pid) or "NVIDIA 设备 %s" % pid))
        arch = builtin[1] if builtin else ""
        cc = builtin[2] if builtin else ""
        cls = builtin[3] if builtin else ""
        conn = dev.get("connectors") if dev.get("connectors") is not None else conns.get(dev["bdf"], [])
        conn = conn or []
        match = next((e for e in entries if pid in e["card_pci_ids"]), None)
        prefer = PREFER.get(cls, "")
        why = PREFER_WHY.get(cls, "")
        warnings = []
        if match and prefer and match["driver_version"] != prefer:
            warnings.append("清单版本 %s 与矩阵建议 %s 不同" % (match["driver_version"], prefer))
        missing = [k for k, ok in (("dkms", tl["dkms"]), ("headers", tl["headers"]),
                                  ("build-essential", tl["build_essential"])) if not ok]
        blocked = []
        if sb:
            blocked.append("secure-boot")
        cards.append({
            "bdf": dev["bdf"], "pci_id": pid, "model": model, "arch": arch, "compute_cap": cc,
            "mining": bool(builtin), "mining_class": cls, "class": dev.get("class"),
            "driver": dev.get("driver"), "driver_version": ver or None, "driver_source": source,
            "nouveau_loaded": "nouveau" in loaded, "connectors": conn,
            "has_display_output": len(conn) > 0,
            "connected_outputs": sum(1 for c in conn if c.get("status") == "connected"),
            "link": {"width": ("x%s" % dev["link_width"]) if dev.get("link_width") else None,
                     "max_width": ("x%s" % dev["link_max"]) if dev.get("link_max") else None,
                     "speed": dev.get("link_speed") or None},
            "gsp": {"supported": arch in ("Turing", "Ampere"),
                    "enabled": (gsp or {}).get("enabled"),
                    "raw": (gsp or {}).get("raw"),
                    "disable_recommended": cls == "CMP" and arch in ("Turing", "Ampere")},
            "repo_entry": ({"id": match["id"], "driver_version": match["driver_version"],
                            "blocks": match["patch"]["blocks"], "source": st["used"] or "none",
                            "match": "pci_id"} if match else None),
            "preferred_version": ({"value": prefer, "why": why} if prefer else None),
            "ready": {"can_install": bool(match) and not blocked, "blocked_by": blocked,
                      "missing": missing},
            "warnings": warnings,
        })

    return {"cards": cards, "fake": FAKE_CARDS is not None, "purpose_hint": "compute",
            "conflicts": {"deb_nvidia": deb_nvidia_packages(), "nouveau_loaded": "nouveau" in loaded},
            "secure_boot": sb, "tools": tl,
            "requirements": {"dkms": tl["dkms"], "headers": tl["headers"],
                             "build_essential": tl["build_essential"], "free_disk_mb": tl["free_disk_mb"]},
            "repo": {"used": st["used"], "error": st["error"], "count": len(entries)},
            "collected_ms": int((time.time() - t0) * 1000)}


# ---------------- 预检计划 ----------------

def iface_install(params):
    mode = str((params or {}).get("mode") or "precheck")
    if mode != "precheck":
        raise RpcError(10011, "本构建（%s）只提供预检；下载/打补丁/安装在 P5-2 实现" % BUILTIN_ID)
    st = fetch_manifest()
    entries = (st["doc"] or {}).get("entries", [])
    if not entries:
        raise RpcError(10005, "补丁清单为空或不可达: %s" % (st["error"] or "没有条目"))
    eid = str((params or {}).get("entry_id") or "")
    if eid:
        entry = next((e for e in entries if e["id"] == eid), None)
        if not entry:
            raise RpcError(10006, "清单里没有条目: %s" % eid)
    else:
        devs = FAKE_CARDS if FAKE_CARDS is not None else pci_devices()
        ids = [d["pci_id"] for d in devs]
        entry = next((e for e in entries if set(e["card_pci_ids"]) & set(ids)), None)
        if not entry:
            raise RpcError(10006, "没有覆盖本机显卡的条目（本机: %s）" % (", ".join(ids) or "无 NVIDIA 卡"))

    c = conf_get()
    tl = tools_state()
    sb = secure_boot()
    conflicts = deb_nvidia_packages()
    url = patch_url(entry, c)
    lines = ["blacklist nouveau", "options nouveau modeset=0"]
    if "gsp-off" in entry["post"]:
        lines.append("options nvidia NVreg_EnableGpuFirmware=0")
    requires = []
    if not tl["dkms"]:
        requires.append("dkms")
    if not tl["headers"]:
        requires.append("linux-headers-%s" % tl["kernel"])
    if not tl["build_essential"]:
        requires.append("build-essential")
    need = int(entry["base"]["size_b"] or 0)
    free_ok = tl["free_disk_mb"] > (need // (1 << 20)) * 3 + 1024
    commands = [
        {"cmd": "apt-get install -y --no-install-recommends %s" % " ".join(requires),
         "why": "前置依赖", "skip_if_empty": True},
        {"cmd": "curl -r <分段> -o NVIDIA-Linux-x86_64-%s.run.p<i> %s" % (entry["driver_version"], entry["base"]["download_url"]),
         "why": "多路 Range 并发下载官方驱动（实测 ~18MB/s；整文件直连仅 ~55KB/s）"},
        {"cmd": "sha256sum NVIDIA-Linux-x86_64-%s.run" % entry["driver_version"],
         "why": "与清单 sha256 比对"},
        {"cmd": "sh NVIDIA-Linux-x86_64-%s.run --check" % entry["driver_version"],
         "why": "官方自校验（makeself md5）"},
        {"cmd": "sh NVIDIA-Linux-x86_64-%s.run --extract-only" % entry["driver_version"],
         "why": "解包到 NVIDIA-Linux-x86_64-%s/" % entry["driver_version"]},
        {"cmd": "python3 nvpatch apply --file <靶点> --patch %s" % entry["patch"]["path"],
         "why": "声明式补丁（dry-run → 命中数校验 → 结果 sha256 校验 → 原子写入）"},
        {"cmd": "apt-get remove --purge <冲突包>", "why": "移除与官方 .run 冲突的发行版驱动"},
        {"cmd": "./nvidia-installer --silent --no-questions --ui=none --dkms", "why": "安装驱动"},
        {"cmd": "写 /etc/modprobe.d/rc-drivers.conf: %s" % " | ".join(lines), "why": "nouveau 黑名单（+CMP 关 GSP）"},
        {"cmd": "depmod -a && update-initramfs -u -k all", "why": "重建模块依赖与 initramfs"},
        {"cmd": "nvidia-smi -L && nvidia-smi --query-gpu=name,driver_version,compute_cap,memory.total --format=csv",
         "why": "安装后校验"},
    ]
    requires_confirm = ["mod-driver-install", "reboot-required"]
    warnings = []
    if sb:
        warnings.append("Secure Boot 已开启：未签名内核模块无法加载，需先关闭（本扩展不代签 MOK）")
    if not free_ok:
        warnings.append("剩余磁盘 %d MB 偏紧（下载+解包需约 %d MB）" % (tl["free_disk_mb"], (need // (1 << 20)) * 3 + 1024))
    prefer = PREFER.get(next((CARDS.get(i.split(":")[1], ("", "", "", ""))[3]
                              for i in entry["card_pci_ids"]), ""), "")
    if prefer and entry["driver_version"] != prefer:
        warnings.append("清单版本 %s 与矩阵建议 %s 不同" % (entry["driver_version"], prefer))

    pid = "p-%s" % sha256_text("%s|%s|%d" % (entry["id"], entry["base"]["sha256_expected"], int(time.time())))[:8]
    state = sha256_text(json.dumps({"e": entry["id"], "b": entry["base"]["sha256_expected"],
                                    "p": entry["patch"]["sha256"], "deb": conflicts}, sort_keys=True))[:16]
    plan = {
        "plan_id": pid, "created_at": int(time.time()), "expires_at": int(time.time()) + PLAN_TTL,
        "entry_id": entry["id"], "title": entry["title"], "kind": "mod",
        "build": BUILTIN_ID, "mode": "precheck-only",
        "source": {"repo": "panel:%s" % PANEL_REPO, "branch": c["branch"], "used": st["used"],
                   "manifest_url": (manifest_sources(c)[0][1] if st["used"] == "local"
                                    else RAW % (PANEL_REPO, c["branch"], "drivers/registry.json"))},
        "base": dict(entry["base"], download={"mode": "range-parallel", "connections": 8, "resume": True},
                     cached=False),
        "patch": dict(entry["patch"], url=url),
        "prereq": requires, "conflicts": [dict(x, action="remove") for x in conflicts],
        "modprobe": {"file": "/etc/modprobe.d/rc-drivers.conf", "lines": lines},
        "post": entry["post"], "reboot_required": entry["reboot_required"],
        "side_effects": {"nouveau_blacklist": "blacklist-nouveau" in entry["post"],
                         "initramfs": "initramfs" in entry["post"],
                         "display_may_break": False, "reboot_required": entry["reboot_required"]},
        "rollback": {"uninstaller": "/usr/bin/nvidia-uninstall",
                     "restore_deb": "apt-get install nvidia-driver", "keep_download": True,
                     "backup_required": True},
        "commands": [c2 for c2 in commands if not (c2.get("skip_if_empty") and not requires)],
        "requires_confirm": requires_confirm, "state_hash": state,
        "warnings": warnings, "notes": entry["notes"],
    }
    PLANS[pid] = plan
    for k in list(PLANS):
        if PLANS[k]["expires_at"] < time.time():
            del PLANS[k]
    return plan


# ---------------- 自测入口 ----------------

def selftest(what, repo_local=None, fake_cards=None, fake_root=None):
    global ROOT, FAKE_CARDS
    if fake_root:
        ROOT = fake_root
    if repo_local:
        c = conf_get()
        c["local_dir"] = repo_local
        c["mirror"] = False
        conf_put(c)
        invalidate_cache()
    if fake_cards:
        FAKE_CARDS = []
        for pid in fake_cards.split(","):
            pid = pid.strip().lower()
            short = pid.split(":")[1]
            b = CARDS.get(short, ("NVIDIA 设备", "", "", ""))
            FAKE_CARDS.append({"bdf": "0000:01:00.0", "pci_id": pid, "class": "0300",
                               "driver": None, "link_width": "4", "link_max": "16",
                               "link_speed": "8.0 GT/s", "connectors": [{"name": "DVI-I-1", "status": "disconnected"}]})
    out = {}
    if what in ("repo", "all"):
        out["repo"] = iface_repo({})
    if what in ("gpu", "all"):
        out["gpu"] = iface_gpu({})
    if what in ("plan", "all"):
        try:
            out["plan"] = iface_install({"mode": "precheck"})
        except RpcError as e:
            out["plan"] = {"rpc_error": {"code": e.code, "message": e.msg}}
    if what == "config":
        out["config"] = iface_repo_config({})
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


def main():
    argv = sys.argv[1:]
    if "--print" in argv:
        def opt(name, default=None):
            return argv[argv.index(name) + 1] if name in argv else default
        return selftest(opt("--print", "all"), repo_local=opt("--repo-local"),
                        fake_cards=opt("--fake-cards"), fake_root=opt("--fake-root"))

    name = os.environ.get("RC_EXT_NAME") or os.path.basename(HERE)
    ifaces = ["drivers.gpu", "drivers.repo", "drivers.repo.config", "drivers.install"]
    backoff = [1, 2, 5, 10, 30]
    i = 0
    while True:
        try:
            s = connect()
        except RuntimeError as e:
            print("后端等待端点: %s" % e, file=sys.stderr)
            time.sleep(backoff[min(i, len(backoff) - 1)])
            i += 1
            continue
        i = 0
        f = s.makefile("rwb")

        def send(obj):
            f.write((json.dumps(obj) + "\n").encode())
            f.flush()

        send({"jsonrpc": "2.0", "id": 1, "method": "register",
              "params": {"name": name, "version": "1.0.0", "iface_ids": ifaces,
                         "heartbeat_sec": 10, "protocol_version": 1}})
        stop = threading.Event()

        def beat():
            k = 100
            while not stop.wait(10):
                k += 1
                try:
                    send({"jsonrpc": "2.0", "id": k, "method": "heartbeat", "params": {"version": "1.0.0"}})
                except OSError:
                    return

        threading.Thread(target=beat, daemon=True).start()
        try:
            for line in f:
                try:
                    msg = json.loads(line.decode())
                except ValueError:
                    continue
                if msg.get("method") != "invoke":
                    continue
                prm = msg.get("params") or {}
                iid = prm.get("iface") or ""
                try:
                    res = dispatch(iid, prm.get("params") or {})
                    send({"jsonrpc": "2.0", "id": msg.get("id"), "result": res})
                except RpcError as e:
                    send({"jsonrpc": "2.0", "id": msg.get("id"),
                          "error": {"code": e.code, "message": e.msg}})
                except Exception as e:  # noqa: BLE001
                    send({"jsonrpc": "2.0", "id": msg.get("id"),
                          "error": {"code": 10001, "message": "%s: %s" % (type(e).__name__, e)}})
        except OSError:
            pass
        finally:
            stop.set()
            try:
                s.close()
            except OSError:
                pass
        print("连接断开，%ds 后重连" % backoff[min(i, len(backoff) - 1)], file=sys.stderr)
        time.sleep(backoff[min(i, len(backoff) - 1)])
        i += 1


if __name__ == "__main__":
    sys.exit(main() or 0)
