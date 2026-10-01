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
import tempfile
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
BUILTIN_ID = "p5-2"      # 本构建阶段标记

# GPG: 清单签名校验（信任锚 = pin 住的指纹；公钥随清单一同取得，但指纹不符即拒）
DEFAULT_GPG_FPR = "0A2352AEAD9DC527DB9339635F36C10321023648"
SIG_SUFFIX = ".asc"
PUBKEY_PATH = "drivers/pubkey.asc"

# NVIDIA 容器工具包（官方仓库；唯一允许新增的第三方源，需显式确认）
CT_KEY_URL = "https://nvidia.github.io/libnvidia-container/gpgkey"
CT_LIST_URL = "https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list"
CT_KEYRING = "/usr/share/keyrings/rc-nvidia-container-toolkit.gpg"
CT_LISTFILE = "/etc/apt/sources.list.d/rc-nvidia-container-toolkit.list"

TASKS = {}
TASK_LOCK = threading.Lock()
ACTIVE = {"id": None}
FIXTURE = os.environ.get("RC_DRIVERS_FIXTURE") == "1"
FAKE_BASE_FILE = None    # 自测: 用本地文件冒充官方 .run
READONLY_PROGS = ("sh", "sha256sum", "dpkg-query", "nvidia-smi", "modinfo", "lsmod", "gpg")

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
        "drivers.task": iface_task,
        "drivers.cancel": iface_cancel,
        "drivers.revert": iface_revert,
        "drivers.log": iface_log,
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
    c = {"branch": DEFAULT_BRANCH, "mirror": True, "local_dir": "", "token": "",
         "gpg": True, "gpg_fpr": DEFAULT_GPG_FPR}
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
        if "gpg" in params:
            c["gpg"] = bool(params["gpg"])
        if "gpg_fpr" in params and str(params["gpg_fpr"]).strip():
            c["gpg_fpr"] = str(params["gpg_fpr"]).strip().replace(" ", "").upper()
        if params.get("clear_token"):
            c["token"] = ""
        elif params.get("token"):
            c["token"] = str(params["token"]).strip()
        conf_put(c)
        invalidate_cache()
    return {"branch": c["branch"], "mirror": c["mirror"], "local_dir": c["local_dir"],
            "token_set": bool(c["token"]), "gpg": c["gpg"], "gpg_fpr": c["gpg_fpr"]}


# ---------------- 清单（补丁数据） ----------------

_cache = {"at": 0, "doc": None, "used": "", "error": "", "sources": [], "gpg": {}}


def invalidate_cache():
    _cache.update({"at": 0, "doc": None, "used": "", "error": "", "sources": [], "gpg": {}})


def http_get(url, token="", timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "raincough-drivers/%s" % BUILTIN_ID})
    if token and "github" in url:
        req.add_header("Authorization", "token %s" % token)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _sibling(url, name):
    return url.rsplit("/", 1)[0] + "/" + name


def gpg_verify(manifest, sig, pubkey, expect_fpr):
    """用临时 keyring 校验 detached 签名，并强制指纹一致。返回 (signer, fpr)。"""
    gpg = which("gpg", ["/usr/bin/gpg", "/usr/local/bin/gpg"])
    if not gpg:
        raise ValueError("缺少 gpg（gnupg）—— 已启用签名校验，无法验证清单")
    os.makedirs(DATA, exist_ok=True)
    home = tempfile.mkdtemp(prefix="gpg-", dir=DATA)
    os.chmod(home, 0o700)
    try:
        with open(os.path.join(home, "manifest"), "wb") as f:
            f.write(manifest)
        with open(os.path.join(home, "manifest.asc"), "wb") as f:
            f.write(sig)
        with open(os.path.join(home, "pubkey.asc"), "wb") as f:
            f.write(pubkey)
        env = dict(os.environ, GNUPGHOME=home)
        rc, out = sh([gpg, "--batch", "--quiet", "--import", os.path.join(home, "pubkey.asc")],
                     timeout=30, env=env)
        if rc != 0:
            raise ValueError("导入公钥失败: %s" % out.strip()[-200:])
        rc, out = sh([gpg, "--batch", "--status-fd", "1", "--verify",
                      os.path.join(home, "manifest.asc"), os.path.join(home, "manifest")],
                     timeout=30, env=env)
        fpr, signer = "", ""
        for ln in out.splitlines():
            if ln.startswith("[GNUPG:] VALIDSIG "):
                fpr = ln.split()[2]
            elif ln.startswith("[GNUPG:] GOODSIG "):
                signer = ln.split(" ", 3)[3] if len(ln.split(" ", 3)) > 3 else ""
        if not fpr:
            raise ValueError("签名校验失败: %s" % out.strip().splitlines()[-1][:200] if out.strip() else "无输出")
        if expect_fpr and fpr.upper() != expect_fpr.upper():
            raise ValueError("签名指纹不符: 实际 %s，期望 %s" % (fpr, expect_fpr))
        return signer, fpr
    finally:
        shutil.rmtree(home, ignore_errors=True)


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


def _get_source(kind, target, c):
    """按来源取清单 + 签名 + 公钥（本地源读同名兄弟文件）。"""
    if kind == "local":
        raw = read_bytes(target)
        if not raw:
            raise OSError("没有 %s" % target)
        sig = read_bytes(target + SIG_SUFFIX)
        pub = read_bytes(os.path.join(os.path.dirname(target), "pubkey.asc"))
        return raw, sig, pub
    return (http_get(target, c.get("token", "")),
            http_get(target + SIG_SUFFIX, c.get("token", "")),
            http_get(_sibling(target, "pubkey.asc"), c.get("token", "")))


def pub_key_for(c, source_url):
    """取公钥（本地/远端），用于界面显示指纹。"""
    try:
        if c.get("local_dir") and source_url.startswith("/"):
            return read_bytes(os.path.join(os.path.dirname(source_url), "pubkey.asc"))
        return http_get(_sibling(source_url, "pubkey.asc"), c.get("token", ""))
    except (OSError, urllib.error.URLError):
        return b""


def fetch_manifest(force=False):
    c = conf_get()
    now = time.time()
    if not force and _cache["doc"] is not None and now - _cache["at"] < CACHE_TTL:
        return _cache
    srcs = manifest_sources(c)
    errs = []
    for kind, target in srcs:
        try:
            raw, sig, pub = _get_source(kind, target, c)
            gpg_block = {"enabled": bool(c.get("gpg")), "verified": False, "fpr": "",
                         "expected_fpr": c.get("gpg_fpr", ""), "signer": "", "source": kind}
            if c.get("gpg"):
                if not sig:
                    raise ValueError("缺少签名文件 %s%s" % (target, SIG_SUFFIX))
                if not pub:
                    raise ValueError("缺少公钥 %s" % PUBKEY_PATH)
                signer, fpr = gpg_verify(raw, sig, pub, c.get("gpg_fpr", ""))
                gpg_block.update({"verified": True, "fpr": fpr, "signer": signer})
            doc = json.loads(raw.decode("utf-8"))
            ents, problems = validate_manifest(doc)
            _cache.update({"at": now, "doc": {"schema": doc.get("schema"), "entries": ents,
                                              "problems": problems, "note": doc.get("note", "")},
                           "used": kind, "error": "", "sources": [s[0] for s in srcs],
                           "gpg": gpg_block})
            return _cache
        except (urllib.error.URLError, OSError, ValueError) as e:
            errs.append("%s: %s" % (kind, e))
    # 全部来源失败（含签名校验失败）→ 不给条目，避免用到未验证的清单
    _cache.update({"at": now, "doc": None, "used": "", "error": "；".join(errs),
                   "sources": [s[0] for s in srcs],
                   "gpg": {"enabled": bool(c.get("gpg")), "verified": False,
                           "expected_fpr": c.get("gpg_fpr", ""), "error": errs[-1] if errs else ""}})
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
            "gpg": st.get("gpg") or {},
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
            "container": container_status(),
            "secure_boot": sb, "tools": tl,
            "requirements": {"dkms": tl["dkms"], "headers": tl["headers"],
                             "build_essential": tl["build_essential"], "free_disk_mb": tl["free_disk_mb"]},
            "repo": {"used": st["used"], "error": st["error"], "count": len(entries),
                     "gpg": st.get("gpg") or {}},
            "collected_ms": int((time.time() - t0) * 1000)}


# ---------------- 预检计划 ----------------

def iface_install(params):
    mode = str((params or {}).get("mode") or "precheck")
    kind = str((params or {}).get("kind") or "mod")
    if kind == "container-toolkit":
        return container_install(params, mode)
    if mode == "apply":
        return apply_mod(params)
    if mode != "precheck":
        raise RpcError(10002, "mode 只能是 precheck/apply")
    st = fetch_manifest()
    if conf_get().get("gpg") and not (st.get("gpg") or {}).get("verified"):
        raise RpcError(10012, "清单签名校验未通过，拒绝出计划: %s" % (st.get("gpg") or {}).get("error", ""))
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
    state = _state_hash(entry["id"], entry["base"]["sha256_expected"], entry["patch"]["sha256"], conflicts)
    plan = {
        "plan_id": pid, "created_at": int(time.time()), "expires_at": int(time.time()) + PLAN_TTL,
        "entry_id": entry["id"], "title": entry["title"], "kind": "mod",
        "build": BUILTIN_ID, "mode": "two-phase", "typed_expect": entry["driver_version"],
        "gpg": st.get("gpg") or {},
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


# ---------------- 任务执行 ----------------

def progress(t, label, pct=None):
    t["progress"].append({"ts": int(time.time()), "label": label, "pct": pct})


def step(t, argv, why, timeout=60, allow_fail=False, env=None):
    """执行固定 argv（永不 shell=True）。fixture 只跑只读命令，其余记为 skipped。"""
    rec = {"cmd": " ".join(argv), "why": why, "rc": None, "ms": None, "out_tail": ""}
    t["commands"].append(rec)
    progress(t, why)
    prog = os.path.basename(argv[0]) if argv else ""
    if FIXTURE and prog not in READONLY_PROGS:
        rec["rc"] = 0
        rec["ms"] = 1
        rec["out_tail"] = "(fixture: 未执行) %s" % rec["cmd"]
        return 0, rec["out_tail"]
    t0 = time.time()
    rc, out = sh(list(argv), timeout=timeout, env=env)
    rec["rc"] = rc
    rec["ms"] = int((time.time() - t0) * 1000)
    rec["out_tail"] = out[-4000:]
    t["output_tail"] = out[-4000:]
    if rc != 0 and not allow_fail:
        raise RuntimeError("命令失败(rc=%d): %s\n%s" % (rc, rec["cmd"], out[-600:]))
    return rc, out


def audit_append(t):
    try:
        os.makedirs(DATA, exist_ok=True)
        rec = {"ts": int(time.time()), "actor": "ui", "iface": t["iface"], "action": t["action"],
               "result": "ok" if t["state"] == "done" else t["state"],
               "plan_id": t.get("plan_id"), "backup": t.get("backup"),
               "pid": os.getpid(), "id": t["id"],
               "commands": [{"cmd": c["cmd"], "rc": c["rc"], "ms": c["ms"]} for c in t["commands"]]}
        with open(os.path.join(DATA, "driver-log.ndjson"), "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except OSError:
        pass


def new_task(iface, action, plan_id=None):
    tid = "t-%s" % sha256_text("%s|%d" % (action, time.time()))[:8]
    t = {"id": tid, "iface": iface, "action": action, "state": "queued", "started_at": None,
         "ended_at": None, "progress": [], "commands": [], "output_tail": "", "exit_code": None,
         "backup": None, "effects": {}, "error": None, "cancelled": False, "plan_id": plan_id}
    TASKS[tid] = t
    return t


def start_task(t, fn):
    with TASK_LOCK:
        if ACTIVE["id"]:
            raise RpcError(10007, "已有任务在执行: %s" % ACTIVE["id"])
        ACTIVE["id"] = t["id"]
    t["state"] = "running"
    t["started_at"] = int(time.time())

    def worker():
        try:
            fn(t)
            t["state"] = "cancelled" if t["cancelled"] else "done"
        except Exception as e:  # noqa: BLE001
            t["state"] = "failed"
            t["error"] = "%s: %s" % (type(e).__name__, e)
        finally:
            t["ended_at"] = int(time.time())
            with TASK_LOCK:
                ACTIVE["id"] = None
            audit_append(t)

    threading.Thread(target=worker, daemon=True).start()
    return {"task_id": t["id"], "state": t["state"]}


def iface_task(params):
    tid = str((params or {}).get("id") or "")
    if not tid:
        recent = sorted(TASKS.values(), key=lambda x: x["started_at"] or 0, reverse=True)[:50]
        return {"active": TASKS.get(ACTIVE["id"]) if ACTIVE["id"] else None,
                "recent": [{"id": x["id"], "iface": x["iface"], "action": x["action"],
                            "state": x["state"], "started_at": x["started_at"],
                            "ended_at": x["ended_at"], "exit_code": x["exit_code"]} for x in recent]}
    t = TASKS.get(tid)
    if not t:
        raise RpcError(10006, "任务不存在: %s" % tid)
    return t


def iface_cancel(params):
    tid = str((params or {}).get("id") or ACTIVE["id"] or "")
    t = TASKS.get(tid)
    if not t:
        raise RpcError(10006, "任务不存在: %s" % tid)
    if t["state"] in ("done", "failed", "cancelled"):
        return {"cancelled": False, "state": t["state"]}
    if any("nvidia-installer" in c["cmd"] for c in t["commands"]):
        raise RpcError(10009, "已进入安装阶段，不可取消")
    t["cancelled"] = True
    return {"cancelled": True, "state": t["state"]}


def iface_log(params):
    limit = int((params or {}).get("limit") or 50)
    q = str((params or {}).get("q") or "")
    path = os.path.join(DATA, "driver-log.ndjson")
    items = []
    for ln in read_text(path).splitlines()[-500:]:
        try:
            r = json.loads(ln)
        except ValueError:
            continue
        if q and q not in json.dumps(r, ensure_ascii=False):
            continue
        items.append(r)
    items = items[-limit:]
    return {"total": len(items), "file": path, "items": items}


# ---------------- 备份 ----------------

MANAGED_DIRS = ("etc/modprobe.d", "etc/modules-load.d")


def make_backup(t, trigger):
    ts = time.strftime("%Y%m%d-%H%M%S")
    os.makedirs(DATA, exist_ok=True)
    out = os.path.join(DATA, "driver-backup-%s.tar.gz" % ts)
    args = ["tar", "-czf", out, "-C", ROOT, "etc/modprobe.d", "etc/modules-load.d"]
    if os.path.exists(p("etc/modules")):
        args = ["tar", "-czf", out, "-C", ROOT, "etc/modules", "etc/modprobe.d", "etc/modules-load.d"]
    try:
        rc, _ = step(t, args, "改动前备份(%s)" % trigger, timeout=60, allow_fail=True)
        if not os.path.exists(out):
            if not FIXTURE:
                step(t, ["tar", "-czf", out, "-C", ROOT, "etc/modprobe.d"],
                     "备份(退化: 仅 modprobe.d)", timeout=60)
            else:
                with open(out, "wb") as f:      # fixture: tar 被跳过，落一个占位文件
                    f.write(b"fixture-backup\n")
        manifest = {"created_at": int(time.time()), "trigger": trigger, "sha256": sha256_file(out),
                    "kernel": os.uname().release, "id": os.path.basename(out)[:-7]}
        with open(out + ".json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        t["backup"] = manifest["id"]
        return manifest
    except (OSError, RuntimeError) as e:
        raise RuntimeError("备份失败，已中止: %s" % e)


# ---------------- 下载 / 解包 / 打补丁 ----------------

def download_base(t, entry, dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    ver = entry["driver_version"]
    dest = os.path.join(dest_dir, "NVIDIA-Linux-x86_64-%s.run" % ver)
    want = entry["base"]["sha256_expected"]
    size = int(entry["base"]["size_b"] or 0)
    if os.path.exists(dest) and (not want or sha256_file(dest) == want):
        progress(t, "命中缓存: %s" % os.path.basename(dest))
        return dest
    if FAKE_BASE_FILE:
        shutil.copyfile(FAKE_BASE_FILE, dest)
        size = os.path.getsize(dest)
        progress(t, "fixture: 用本地文件冒充官方 .run")
    else:
        parts = dest + ".parts"
        os.makedirs(parts, exist_ok=True)
        n = max(1, min(12, int(entry["base"].get("download", {}).get("connections") or 8)))
        chunk = (size + n - 1) // n
        for i in range(n):
            if t["cancelled"]:
                raise RpcError(10009, "任务已取消")
            a, b = i * chunk, min((i + 1) * chunk, size) - 1
            pf = os.path.join(parts, "p%02d" % i)
            need = b - a + 1
            for attempt in range(1, 4):
                have = os.path.getsize(pf) if os.path.exists(pf) else 0
                if have >= need:
                    break
                tmp = pf + ".part"
                rc, out = sh(["curl", "-sL", "--retry", "3", "--max-time", "1800",
                              "-r", "%d-%d" % (a + have, b), "-o", tmp,
                              entry["base"]["download_url"]], timeout=1900)
                if rc == 0 and os.path.getsize(tmp) > 0:
                    with open(pf, "ab") as f, open(tmp, "rb") as g:
                        shutil.copyfileobj(g, f)
                if os.path.exists(tmp):
                    os.remove(tmp)
                progress(t, "分段 %d/%d 第 %d 次尝试" % (i + 1, n, attempt),
                         pct=int(100 * (i + attempt / 3.0) / n))
            if not os.path.exists(pf) or os.path.getsize(pf) != need:
                raise RuntimeError("分段 %d 下载不完整（可重试或重开该段）" % (i + 1))
        with open(dest, "wb") as out:
            for i in range(n):
                with open(os.path.join(parts, "p%02d" % i), "rb") as f:
                    shutil.copyfileobj(f, out)
        shutil.rmtree(parts, ignore_errors=True)
    got = os.path.getsize(dest)
    if size and got != size:
        raise RuntimeError("大小不符: %d != %d" % (got, size))
    h = sha256_file(dest)
    if want and h != want:
        os.remove(dest)
        raise RuntimeError("sha256 不符（已删除下载）: %s" % h)
    progress(t, "官方驱动下载完成并校验通过 (%d 字节)" % got, pct=100)
    step(t, ["sh", dest, "--check"], "官方自校验 (--check)", timeout=300)
    return dest


def extract_base(t, runfile):
    d = runfile[:-4]
    if not os.path.isdir(d):
        step(t, ["sh", runfile, "--extract-only"], "解包驱动", timeout=600)
    return d


def load_patch(entry, c):
    """取补丁 JSON（本地文件或按来源基址拼 URL），校验 sha256。"""
    pth = entry["patch"]["path"]
    local = os.path.join(c.get("local_dir") or "", pth.split("drivers/", 1)[-1])
    raw = None
    if c.get("local_dir") and os.path.exists(local):
        raw = read_bytes(local)
    if raw is None:
        url = patch_url(entry, c)
        if url.startswith("file://"):
            raw = read_bytes(url[len("file://"):])
        else:
            raw = http_get(url, c.get("token", ""), timeout=30)
    if sha256_text_bytes(raw) != entry["patch"]["sha256"]:
        raise RuntimeError("补丁文件 sha256 与清单不符（拒绝使用）")
    return json.loads(raw.decode("utf-8"))


def sha256_text_bytes(b):
    return hashlib.sha256(b).hexdigest()


def apply_patch(t, target_path, patch_doc):
    """逐块 find/replace：命中数必须相等 + 结果哈希必须相等 + 原子写入 + 备份。"""
    data = open(target_path, "rb").read()
    h0 = hashlib.sha256(data).hexdigest()
    if h0 == patch_doc["result_sha256"]:
        progress(t, "靶点已是打过补丁的状态，跳过")
        return {"already": True, "sha256": h0}
    if h0 != patch_doc["base_sha256"]:
        raise RuntimeError("靶点 sha256 与补丁声明不符（驱动版本不对？）: %s" % h0)
    buf = bytearray(data)
    report = []
    for b in patch_doc["blocks"]:
        find = bytes.fromhex(b["find_hex"])
        repl = bytes.fromhex(b["replace_hex"])
        hits, i = [], buf.find(find)
        while i != -1:
            hits.append(i)
            i = buf.find(find, i + 1)
        if len(hits) != int(b["expect_hits"]):
            raise RuntimeError("补丁块 %s 命中 %d 次，期望 %d 次（驱动版本与补丁不匹配）"
                               % (b.get("id"), len(hits), b["expect_hits"]))
        for off in hits:
            buf[off:off + len(find)] = repl
        report.append({"id": b.get("id"), "hits": len(hits)})
    out = bytes(buf)
    if hashlib.sha256(out).hexdigest() != patch_doc["result_sha256"]:
        raise RuntimeError("打完后的 sha256 与补丁声明不符，拒绝写入")
    bak = "%s.orig-%s" % (target_path, h0[:8])
    if not os.path.exists(bak):
        shutil.copy2(target_path, bak)
    tmp = target_path + ".rctmp"
    with open(tmp, "wb") as f:
        f.write(out)
    os.replace(tmp, target_path)
    progress(t, "补丁已应用（%d 块，靶点 %s）" % (len(report), os.path.basename(target_path)))
    t["effects"]["patch_report"] = report
    return {"already": False, "sha256": patch_doc["result_sha256"], "backup": os.path.basename(bak),
            "report": report}


def write_managed(t, lines, marker):
    pth = p("etc/modprobe.d/rc-drivers.conf") if marker == "modprobe" else p("etc/modules-load.d/rc-drivers.conf")
    os.makedirs(os.path.dirname(pth), exist_ok=True)
    body = "# 由 RainCough 驱动扩展托管；手工修改会被覆盖\n" + "\n".join(lines) + "\n"
    with open(pth, "w", encoding="utf-8") as f:
        f.write(body)
    progress(t, "已写入托管文件 %s" % pth)
    return pth


# ---------------- 安装（P5-2 核心） ----------------

def plan_get(plan_id):
    pl = PLANS.get(plan_id)
    if not pl:
        raise RpcError(10003, "计划不存在或已过期: %s" % plan_id)
    if pl["expires_at"] < time.time():
        del PLANS[plan_id]
        raise RpcError(10003, "计划已过期，请重新预检")
    return pl


def _state_hash(entry_id, base_sha, patch_sha, deb):
    """预检与 apply 必须用同一个算法（否则永远判"状态已变"）。"""
    return sha256_text(json.dumps({"e": entry_id, "b": base_sha, "p": patch_sha, "deb": deb},
                                  sort_keys=True))[:16]


def check_confirm(pl, confirm):
    confirm = confirm or {}
    missing = []
    for item in pl["requires_confirm"]:
        if item not in (confirm.get("acknowledge") or []):
            missing.append(item)
    typed = str(confirm.get("typed") or "")
    if typed != pl.get("typed_expect"):
        missing.append("输入确认: %s" % pl.get("typed_expect"))
    if missing:
        raise RpcError(10001, "确认不完整: %s" % " / ".join(missing))
    if pl.get("state_hash"):
        st = _state_hash(pl["entry_id"], (pl.get("base") or {}).get("sha256_expected"),
                         (pl.get("patch") or {}).get("sha256"), deb_nvidia_packages())
        if st != pl["state_hash"]:
            raise RpcError(10004, "系统状态已改变（已装驱动包或清单有变），请重新预检")


def apply_mod(params):
    pl = plan_get(str(params.get("plan_id") or ""))
    check_confirm(pl, params.get("confirm"))
    c = conf_get()
    st = fetch_manifest()
    entry = next((e for e in ((st["doc"] or {}).get("entries") or []) if e["id"] == pl["entry_id"]), None)
    if not entry:
        raise RpcError(10006, "清单里已没有条目: %s" % pl["entry_id"])
    if c.get("gpg") and not (st.get("gpg") or {}).get("verified"):
        raise RpcError(10012, "清单签名校验未通过，拒绝安装: %s" % (st.get("gpg") or {}).get("error", ""))
    t = new_task("drivers.install", "安装魔改驱动 %s" % entry["id"], pl["plan_id"])

    def worker(tk):
        make_backup(tk, "安装 %s" % entry["id"])
        if pl["prereq"]:
            step(tk, ["apt-get", "install", "-y", "--no-install-recommends"] + pl["prereq"],
                 "安装前置依赖", timeout=1800,
                 env=dict(os.environ, DEBIAN_FRONTEND="noninteractive"))
        dest_dir = os.path.join(DATA, "nvidia")
        runfile = download_base(tk, entry, dest_dir)
        d = extract_base(tk, runfile)
        target = os.path.join(d, entry["patch"]["target"])
        if not os.path.exists(target):
            raise RuntimeError("靶点不存在: %s（该驱动版本路径不同）" % target)
        doc = load_patch(entry, c)
        res = apply_patch(tk, target, doc)
        tk["effects"]["patch"] = {"already": res["already"], "target": entry["patch"]["target"],
                                  "sha256": res["sha256"]}
        if not res["already"]:
            step(tk, ["chmod", "+x", os.path.join(d, "nvidia-installer")], "安装器可执行位", allow_fail=True)
        if pl["conflicts"]:
            pkgs = [x["pkg"] for x in pl["conflicts"]]
            step(tk, ["apt-get", "remove", "-y", "--purge"] + pkgs, "移除冲突的发行版驱动", timeout=900,
                 env=dict(os.environ, DEBIAN_FRONTEND="noninteractive"))
        step(tk, [os.path.join(d, "nvidia-installer"), "--silent", "--no-questions", "--ui=none", "--dkms"],
             "安装官方驱动(--dkms)", timeout=1800)
        write_managed(tk, pl["modprobe"]["lines"], "modprobe")
        step(tk, ["depmod", "-a"], "重建模块依赖", timeout=120, allow_fail=True)
        step(tk, ["update-initramfs", "-u", "-k", "all"], "重建 initramfs", timeout=600, allow_fail=True)
        rc, out = step(tk, ["nvidia-smi", "-L"], "安装后校验", timeout=60, allow_fail=True)
        tk["effects"]["nvidia_smi"] = out.strip()[:500] if rc == 0 else None
        tk["effects"]["reboot_required"] = bool(entry["reboot_required"])
        tk["exit_code"] = 0
        progress(tk, "完成（需重启后生效）" if entry["reboot_required"] else "完成")

    return start_task(t, worker)


# ---------------- 容器直通（NVIDIA container toolkit） ----------------

def container_status():
    rc, out = sh(["dpkg-query", "-W", "-f=${Version}", "nvidia-container-toolkit"])
    installed = rc == 0 and bool(out.strip())
    ver = out.strip() if installed else ""
    docker = bool(which("docker", ["/usr/bin/docker"]))
    ctk = bool(which("nvidia-ctk", ["/usr/bin/nvidia-ctk"]))
    daemon_ok = False
    try:
        with open("/etc/docker/daemon.json", "r", encoding="utf-8") as f:
            daemon_ok = "nvidia" in f.read()
    except OSError:
        daemon_ok = False
    return {"toolkit_installed": installed, "version": ver, "nvidia_ctk": ctk, "docker": docker,
            "docker_runtime_configured": daemon_ok,
            "keyring": os.path.exists(CT_KEYRING), "list_file": os.path.exists(CT_LISTFILE)}


def container_install(params, mode):
    st = container_status()
    if mode == "precheck":
        commands = [
            {"cmd": "curl -fsSL %s | gpg --dearmor -o %s" % (CT_KEY_URL, CT_KEYRING),
             "why": "NVIDIA 官方仓库签名密钥（唯一允许新增的第三方源）"},
            {"cmd": "写 %s（deb [signed-by=%s] https://nvidia.github.io/...）" % (CT_LISTFILE, CT_KEYRING),
             "why": "仅启用 signed-by 指向上述 keyring 的官方源"},
            {"cmd": "apt-get update", "why": "刷新索引"},
            {"cmd": "apt-get install -y --no-install-recommends nvidia-container-toolkit", "why": "安装工具包"},
        ]
        if st["docker"]:
            commands += [
                {"cmd": "nvidia-ctk runtime configure --runtime=docker", "why": "给 docker 配 nvidia runtime"},
                {"cmd": "systemctl restart docker", "why": "让 runtime 生效"},
            ]
        else:
            commands.append({"cmd": "(未检测到 docker，跳过 runtime 配置)", "why": "装了 docker 后再配"})
        commands.append({"cmd": "nvidia-ctk --version", "why": "校验"})
        requires = ["container-toolkit-repo"] + (["docker-restart"] if st["docker"] else [])
        pid = "p-%s" % sha256_text("ct|%d" % int(time.time()))[:8]
        plan = {"plan_id": pid, "created_at": int(time.time()), "expires_at": int(time.time()) + PLAN_TTL,
                "entry_id": "container-toolkit", "title": "NVIDIA 容器工具包", "kind": "container-toolkit",
                "build": BUILTIN_ID, "mode": "precheck-only", "status": st,
                "source": {"repo": "nvidia.github.io/libnvidia-container", "branch": "stable"},
                "commands": commands, "requires_confirm": requires, "typed_expect": "nvidia-container-toolkit",
                "warnings": ([] if st["docker"] else ["未检测到 docker：只装工具包，runtime 配置等有 docker 后再做"]),
                "notes": "新增第三方 apt 源属在设计护栏之外，已由你明确同意；源文件与 keyring 都用 rc- 前缀，可精确回滚。"}
        PLANS[pid] = plan
        return plan
    t = new_task("drivers.install", "安装 NVIDIA 容器工具包")

    def worker(tk):
        if tk["cancelled"]:
            return
        make_backup(tk, "容器工具包")
        os.makedirs(p("usr/share/keyrings"), exist_ok=True)
        rc, out = sh(["curl", "-fsSL", CT_KEY_URL], timeout=60)
        if rc == 0 and out:
            rc2, out2 = sh(["gpg", "--dearmor", "-o", p(CT_KEYRING.lstrip("/"))], timeout=30)
            if rc2 != 0 and not FIXTURE:
                raise RuntimeError("写入 keyring 失败: %s" % out2[-200:])
            tk["commands"].append({"cmd": "curl %s | gpg --dearmor -o %s" % (CT_KEY_URL, CT_KEYRING),
                                   "why": "NVIDIA 官方仓库密钥", "rc": rc2, "ms": 0, "out_tail": out2[-500:]})
        else:
            tk["commands"].append({"cmd": "curl %s" % CT_KEY_URL, "why": "NVIDIA 官方仓库密钥",
                                   "rc": rc, "ms": 0, "out_tail": out[-500:]})
            if not FIXTURE:
                raise RuntimeError("取密钥失败: %s" % out[-200:])
        rc3, out3 = sh(["curl", "-sL", CT_LIST_URL], timeout=60)
        body = out3 if rc3 == 0 and out3.strip() else \
            "deb [signed-by=%s] https://nvidia.github.io/libnvidia-container/stable/deb/$(ARCH) /" % CT_KEYRING
        signed = body.replace("deb https://", "deb [signed-by=%s] https://" % CT_KEYRING)
        with open(p(CT_LISTFILE.lstrip("/")), "w", encoding="utf-8") as f:
            f.write("# 由 RainCough 驱动扩展托管\n" + signed)
        progress(tk, "已写入 %s" % CT_LISTFILE)
        step(tk, ["apt-get", "update"], "刷新索引", timeout=900,
             env=dict(os.environ, DEBIAN_FRONTEND="noninteractive"))
        step(tk, ["apt-get", "install", "-y", "--no-install-recommends", "nvidia-container-toolkit"],
             "安装 nvidia-container-toolkit", timeout=1800,
             env=dict(os.environ, DEBIAN_FRONTEND="noninteractive"))
        st2 = container_status()
        if st2["docker"]:
            step(tk, ["nvidia-ctk", "runtime", "configure", "--runtime=docker"], "配置 docker runtime",
                 timeout=120, allow_fail=True)
            step(tk, ["systemctl", "restart", "docker"], "重启 docker", timeout=120, allow_fail=True)
        rc4, out4 = step(tk, ["nvidia-ctk", "--version"], "校验", timeout=60, allow_fail=True)
        tk["effects"]["container"] = container_status()
        tk["effects"]["verify"] = out4.strip()[:200] if rc4 == 0 else None
        tk["exit_code"] = 0

    return start_task(t, worker)


# ---------------- 退路（三条） ----------------

REVERT = {
    "uninstall": {"title": "官方卸载", "cmd": ["/usr/bin/nvidia-uninstall", "--silent"],
                  "why": "卸载官方 .run 安装的驱动"},
    "deb": {"title": "回 Debian 包", "cmd": ["apt-get", "install", "-y", "--no-install-recommends", "nvidia-driver"],
            "why": "回到发行版打包驱动"},
    "repatch": {"title": "回补丁前", "cmd": None, "why": "用 .orig-* 备份还原靶点并重装"},
}


def iface_revert(params):
    mode = str((params or {}).get("mode") or "precheck")
    action = str((params or {}).get("action") or "")
    if not action and mode == "apply":
        pl0 = PLANS.get(str((params or {}).get("plan_id") or ""))
        if pl0 and str(pl0.get("entry_id", "")).startswith("revert:"):
            action = pl0["entry_id"].split(":", 1)[1]     # apply 时从计划反推，不必重复传
    if action not in REVERT:
        raise RpcError(10002, "action 只能是 %s" % "/".join(REVERT))
    spec = REVERT[action]
    if mode == "precheck":
        pid = "p-%s" % sha256_text("rv|%s|%d" % (action, int(time.time())))[:8]
        origs = []
        nb = os.path.join(DATA, "nvidia")
        if os.path.isdir(nb):
            for dirp, _, fs in os.walk(nb):
                for f in fs:
                    if ".orig-" in f:
                        origs.append(os.path.join(dirp, f))
        cmds = ([{"cmd": " ".join(spec["cmd"]), "why": spec["why"]}] if spec["cmd"]
                else ([{"cmd": "还原 %s" % x, "why": spec["why"]} for x in origs]
                      or [{"cmd": "(没有找到 .orig-* 备份)", "why": "无法回补丁前"}]))
        pl = {"plan_id": pid, "created_at": int(time.time()), "expires_at": int(time.time()) + PLAN_TTL,
              "entry_id": "revert:" + action, "title": spec["title"], "kind": "revert",
              "build": BUILTIN_ID, "mode": "two-phase", "commands": cmds,
              "requires_confirm": ["revert-" + action], "typed_expect": action,
              "warnings": ["需重启后生效"] if action != "deb" else [],
              "notes": "三条退路都只动驱动与托管文件，不动其它系统文件。"}
        PLANS[pid] = pl
        return pl
    pl = plan_get(str(params.get("plan_id") or ""))
    check_confirm(pl, params.get("confirm"))
    t = new_task("drivers.revert", spec["title"], pl["plan_id"])

    def worker(tk):
        make_backup(tk, "退路: %s" % spec["title"])
        if spec["cmd"]:
            step(tk, spec["cmd"], spec["why"], timeout=1800,
                 env=dict(os.environ, DEBIAN_FRONTEND="noninteractive"))
        else:
            done = False
            base = os.path.join(DATA, "nvidia")
            for dirp, _, fs in os.walk(base):
                for f in fs:
                    if ".orig-" in f:
                        orig = os.path.join(dirp, f)
                        target = orig.split(".orig-")[0]
                        shutil.copy2(orig, target)
                        progress(tk, "已还原 %s" % target)
                        done = True
            if not done:
                raise RuntimeError("没有找到 .orig-* 备份，无法回补丁前")
        step(tk, ["depmod", "-a"], "重建模块依赖", timeout=120, allow_fail=True)
        step(tk, ["update-initramfs", "-u", "-k", "all"], "重建 initramfs", timeout=600, allow_fail=True)
        tk["effects"]["reboot_required"] = True
        tk["exit_code"] = 0

    return start_task(t, worker)


# ---------------- 自测入口 ----------------

def selftest(what, repo_local=None, fake_cards=None, fake_root=None, fake_base=None,
             fixture=False, entry_id=None, do_apply=False, gpg_off=False):
    global ROOT, FAKE_CARDS, FAKE_BASE_FILE, FIXTURE
    if fake_root:
        ROOT = fake_root
    if fixture:
        FIXTURE = True
    if fake_base:
        FAKE_BASE_FILE = fake_base
    if repo_local:
        c = conf_get()
        c["local_dir"] = repo_local
        c["mirror"] = False
        if gpg_off:
            c["gpg"] = False
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
            out["plan"] = iface_install({"mode": "precheck", "entry_id": entry_id} if entry_id
                                        else {"mode": "precheck"})
        except RpcError as e:
            out["plan"] = {"rpc_error": {"code": e.code, "message": e.msg}}
    if what == "config":
        out["config"] = iface_repo_config({})
    if what == "container":
        out["container"] = container_install({"mode": "precheck"}, "precheck")
    if what == "log":
        out["log"] = iface_log({"limit": 5})
    if what == "apply" or do_apply:
        pl = out.get("plan") or iface_install({"mode": "precheck", "entry_id": entry_id} if entry_id
                                             else {"mode": "precheck"})
        if "rpc_error" in pl:
            out["apply"] = pl
        else:
            confirm = {"acknowledge": pl["requires_confirm"], "typed": pl.get("typed_expect")}
            res = apply_mod({"plan_id": pl["plan_id"], "confirm": confirm})
            out["apply_start"] = res
            for _ in range(600):
                tk = TASKS[res["task_id"]]
                if tk["state"] in ("done", "failed", "cancelled"):
                    break
                time.sleep(0.5)
            out["apply"] = TASKS[res["task_id"]]
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


def main():
    argv = sys.argv[1:]
    if "--print" in argv:
        def opt(name, default=None):
            return argv[argv.index(name) + 1] if name in argv else default
        return selftest(opt("--print", "all"), repo_local=opt("--repo-local"),
                        fake_cards=opt("--fake-cards"), fake_root=opt("--fake-root"),
                        fake_base=opt("--fake-base"), fixture="--fixture" in argv,
                        entry_id=opt("--entry"), do_apply="--apply" in argv,
                        gpg_off="--gpg-off" in argv)

    name = os.environ.get("RC_EXT_NAME") or os.path.basename(HERE)
    ifaces = ["drivers.gpu", "drivers.repo", "drivers.repo.config", "drivers.install",
              "drivers.task", "drivers.cancel", "drivers.revert", "drivers.log"]
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
