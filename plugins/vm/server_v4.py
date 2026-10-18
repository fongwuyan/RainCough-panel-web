#!/usr/bin/env python3
"""虚拟机插件后端(v4 接口库)。

依赖: libvirt-clients(virsh) + qemu-utils(qemu-img) + 可选 virtinst(virt-install)

设计要点(与旧 kvm 插件的关键差异):
  1. ★ 不保存 sudo 密码。旧实现把明文密码写进 config.json, 每次调用
     `echo <密码> | sudo -S ...` —— 既泄露又易失效。v6 面板默认以 root 运行,
     直接执行即可; 非 root 时用 `sudo -n`(免密), 不行就明确报错让人配 NOPASSWD,
     而不是偷偷喂密码。
  2. ★ 所有 virsh 调用强制 LC_ALL=C。实测宿主 locale 为 zh_CN 时, virsh 输出
     "关闭"、"名称：" 等中文, 按 `State:` / `Name:` 解析会全部失败。
  3. ★ 统计优先用 `virsh domstats`(key=value 机器可读), 而不是解析人读表格。
  4. XML 解析用标准库 ElementTree, 不用正则拼。

命令都是本机特权操作, 面板以 root 运行时没有额外授权步骤。
"""
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc  # noqa: E402

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
CONF_PATH = os.path.join(PLUGIN_DIR, "config.json")
NOTES_PATH = os.path.join(PLUGIN_DIR, "notes.json")
META_PATH = os.path.join(PLUGIN_DIR, "plugin.json")

VIRSH = shutil.which("virsh") or "/usr/bin/virsh"
QEMU_IMG = shutil.which("qemu-img") or "/usr/bin/qemu-img"
VIRT_INSTALL = shutil.which("virt-install") or ""

# 强制英文输出: 解析器只认英文关键字, 不受宿主 locale 影响
RUN_ENV = dict(os.environ)
RUN_ENV["LC_ALL"] = "C"
RUN_ENV["LANG"] = "C"
RUN_ENV.pop("LANGUAGE", None)

_state_lock = threading.Lock()


# ---------------------------------------------------------------- 基础工具

def _meta():
    """版本/标签的单一来源: plugin.json。避免代码里再硬编码一份而脱节。"""
    try:
        with open(META_PATH, "r", encoding="utf-8") as f:
            m = json.load(f)
        return {
            "name": m.get("name", "vm"),
            "label": m.get("label", "虚拟机"),
            "version": m.get("version", "0.0.0"),
            "description": m.get("description", ""),
        }
    except Exception:
        return {"name": "vm", "label": "虚拟机", "version": "0.0.0", "description": ""}


def _err(msg):
    raise rc.RCError(3000, msg)


def _p(params):
    return params if isinstance(params, dict) else {}


def _s(params, key, default=""):
    v = _p(params).get(key, default)
    return "" if v is None else str(v)


def _i(params, key, default=0):
    try:
        return int(float(_p(params).get(key, default)))
    except (TypeError, ValueError):
        return default


def _b(params, key, default=False):
    v = _p(params).get(key, default)
    if isinstance(v, bool):
        return v
    return str(v).lower() in ("1", "true", "yes", "on")


def _read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _write_json(path, data):
    """原子写 JSON。失败时给出可操作的提示。

    常见失败: 插件目录属主是 root 而面板以普通用户运行 → 写不进去。
    裸的 "Permission denied: xxx.tmp" 对用户毫无帮助, 这里点明原因和解法。
    """
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except PermissionError:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass
        _err("无法写入 %s: 插件目录不属于当前运行用户。"
             "请执行 chown -R <运行用户> %s 后重试。" % (os.path.basename(path), PLUGIN_DIR))
    except OSError as e:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass
        _err("写入 %s 失败: %s" % (os.path.basename(path), e))


def _conf():
    """插件配置。只有连接 URI 与默认目录 —— 不含任何凭证。"""
    c = _read_json(CONF_PATH, {})
    return {
        "uri": c.get("uri") or "qemu:///system",
        "image_dir": c.get("image_dir") or "/var/lib/libvirt/images",
        "default_vnc_listen": c.get("default_vnc_listen") or "0.0.0.0",
    }


def _notes():
    return _read_json(NOTES_PATH, {})


# ---------------------------------------------------------------- 命令执行

def _need_root_hint():
    return ("权限不足。管理虚拟机需要 root, 或让运行面板的用户具备免密 sudo"
            "(NOPASSWD)。推荐让面板以 root 运行(install.sh 默认如此)。")


# virsh 权限类错误的特征。命中这些才值得用 sudo 重试 ——
# 别的错误(域不存在、XML 非法)重试也没用, 只会掩盖真实原因。
PERM_HINTS = (
    "authentication unavailable", "permission denied", "access denied",
    "not authorized", "failed to connect socket", "read-only",
    "operation not permitted", "insufficient privileges",
)


def _is_perm_error(err):
    e = (err or "").lower()
    return any(h in e for h in PERM_HINTS)


def _exec(cmd, timeout):
    """单次执行, 不做任何权限包装。"""
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout,
                           env=RUN_ENV, text=True,
                           encoding="utf-8", errors="replace")
    except subprocess.TimeoutExpired:
        return False, "", "命令超时(%ss): %s" % (timeout, " ".join(cmd[:3]))
    except FileNotFoundError:
        return False, "", "命令不存在: %s" % cmd[0]
    except Exception as e:  # noqa: BLE001
        return False, "", str(e)
    if r.returncode != 0:
        return False, r.stdout or "", (r.stderr or r.stdout or "").strip()[-800:]
    return True, r.stdout, ""


def _run(cmd, timeout=30):
    """执行命令, 按需用 sudo 提权。

    ★ 顺序很重要(2026-10-18 实测踩到):
      先**直接执行**。libvirt 的 polkit 策略允许本地用户做只读操作
      (list/dumpxml/dominfo), 所以读路径根本不需要 sudo。
      只有直接执行报权限错误时, 才用 `sudo -n`(非交互)重试。

      早期实现是"非 root 就无脑加 sudo -n", 看起来也能跑通 —— 但那只是因为
      之前手工 `sudo -S` 留下的 15 分钟时间戳缓存还在。缓存一过期,
      连"列出虚拟机"都会失败, 而且报错跟真实原因(权限)对不上。
      绝不把一次性缓存当成长期能力。
    """
    if os.geteuid() == 0:
        return _exec(cmd, timeout)

    ok, out, err = _exec(cmd, timeout)
    if ok:
        return True, out, ""

    if not _is_perm_error(err):
        # 不是权限问题, 直接用原始错误(重试无意义)
        return False, out, err

    ok2, out2, err2 = _exec(["sudo", "-n"] + cmd, timeout)
    if ok2:
        return True, out2, ""
    if "password is required" in (err2 or "") or "terminal is required" in (err2 or ""):
        return False, "", _need_root_hint()
    return False, out2, (err2 or err)


def _virsh(args, timeout=30):
    ok, out, err = _run([VIRSH, "-c", _conf()["uri"]] + list(args), timeout)
    return ok, out, err


def _virsh_out(args, timeout=30):
    """必须成功的 virsh 调用, 失败抛 RCError。"""
    ok, out, err = _virsh(args, timeout)
    if not ok:
        _err(err or ("virsh %s 失败" % " ".join(args[:2])))
    return out


# ---------------------------------------------------------------- 状态映射

# domstats state.state → 语义状态。libvirt 的编码:
# 0 no state, 1 running, 2 blocked, 3 paused, 4 shutdown, 5 shutoff, 6 crashed, 7 pmsuspended
STATE_BY_CODE = {
    0: "nostate", 1: "running", 2: "blocked", 3: "paused",
    4: "shutdown", 5: "shutoff", 6: "crashed", 7: "pmsuspended",
}

STATE_LABEL = {
    "running": "运行中", "blocked": "阻塞", "paused": "已暂停",
    "shutdown": "正在关机", "shutoff": "已关闭", "crashed": "已崩溃",
    "pmsuspended": "休眠", "nostate": "未知", "": "未知",
}


def _state_from_text(txt):
    """把 `virsh list` / `domstate` 的英文状态文本归一化。"""
    t = (txt or "").strip().lower()
    if t.startswith("running"):
        return "running"
    if t.startswith("shut off") or t == "shutoff":
        return "shutoff"
    if t.startswith("paused"):
        return "paused"
    if t.startswith("crashed"):
        return "crashed"
    if t.startswith("pmsuspend"):
        return "pmsuspended"
    if t.startswith("in shutdown") or t.startswith("shutdown"):
        return "shutdown"
    if t.startswith("blocked"):
        return "blocked"
    return t or ""


def _parse_list_all(text):
    """解析 `virsh list --all` 的表格。

    形如(LC_ALL=C):
         Id   Name        State
        ----------------------------
         -    rc-deploy   shut off
         3    web         running
    用"按行切 + 至少 3 段"解析, 不依赖固定列宽(名字长短会改变对齐)。
    """
    out = []
    for line in (text or "").splitlines():
        s = line.strip()
        if not s or set(s) <= set("-"):
            continue
        if s.lower().startswith("id") and "name" in s.lower():
            continue
        parts = s.split(None, 2)
        if len(parts) < 3:
            continue
        dom_id, name, state = parts[0], parts[1], parts[2]
        out.append({
            "id": 0 if dom_id == "-" else int(dom_id) if dom_id.isdigit() else 0,
            "name": name,
            "state": _state_from_text(state),
            "state_raw": state.strip(),
        })
    return out


def _parse_kv(text):
    """解析 `key=value` 文本(domstats 格式)成扁平 dict。"""
    d = {}
    for line in (text or "").splitlines():
        s = line.strip()
        if "=" not in s:
            continue
        k, v = s.split("=", 1)
        d[k.strip()] = v.strip()
    return d


def _parse_domstats(text):
    """domstats 输出按 `Domain: '<name>'` 分块。返回 {name: {k: v}}。

    注意: block.N.* / net.N.* 的索引在同一个域内连续, 但不同域的起始索引可能
    不同, 所以按块各自收集, 不能全局合并。
    """
    res = {}
    cur = None
    for line in (text or "").splitlines():
        s = line.strip()
        if s.startswith("Domain:"):
            m = re.match(r"Domain:\s*'(.+)'\s*$", s)
            cur = m.group(1) if m else s.split(":", 1)[1].strip().strip("'")
            res[cur] = {}
            continue
        if cur and "=" in s:
            k, v = s.split("=", 1)
            res[cur][k.strip()] = v.strip()
    return res


def _num(d, key, default=0.0):
    try:
        return float(d.get(key, default))
    except (TypeError, ValueError):
        return float(default)


# ---------------------------------------------------------------- XML 解析

def _xml_root(name):
    ok, out, err = _virsh(["dumpxml", name], timeout=20)
    if not ok:
        return None
    try:
        return ET.fromstring(out)
    except ET.ParseError:
        return None


def _txt(node, path, default=""):
    if node is None:
        return default
    el = node.find(path)
    if el is None or el.text is None:
        return default
    return el.text.strip()


def _attr(node, path, attr, default=""):
    if node is None:
        return default
    el = node.find(path)
    if el is None:
        return default
    return el.get(attr, default)


def _byte_to_mb(kib):
    try:
        return round(float(kib) / 1024.0, 1)
    except (TypeError, ValueError):
        return 0.0


def _fmt_bytes(n):
    try:
        n = float(n)
    except (TypeError, ValueError):
        return "0 B"
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return ("%.1f %s" % (n, unit)) if unit != "B" else ("%d B" % n)
        n /= 1024.0
    return "%.1f TB" % n


def _detail(name):
    """从 XML 提取磁盘/网卡/显示/OS 信息。"""
    root = _xml_root(name)
    if root is None:
        return None

    memory_kib = _num({"v": _txt(root, "memory", "0")}, "v")
    disks = []
    for d in root.findall("devices/disk"):
        src = _attr(d, "source", "file") or _attr(d, "source", "dev") or _attr(d, "source", "volume")
        disks.append({
            "target": _attr(d, "target", "dev"),
            "bus": _attr(d, "target", "bus"),
            "device": d.get("device", "disk"),
            "type": d.get("type", ""),
            "source": src,
            "format": _attr(d, "driver", "type"),
        })

    nets = []
    for n in root.findall("devices/interface"):
        nets.append({
            "type": n.get("type", ""),
            "mac": _attr(n, "mac", "address"),
            "model": _attr(n, "model", "type"),
            "source": _attr(n, "source", "bridge") or _attr(n, "source", "network")
                      or _attr(n, "source", "dev"),
        })

    graphics = []
    for g in root.findall("devices/graphics"):
        graphics.append({
            "type": g.get("type", ""),
            "port": g.get("port", ""),
            "autoport": g.get("autoport", ""),
            "listen": _attr(g, "listen", "address"),
            "passwd": g.get("passwd", ""),
        })

    return {
        "name": _txt(root, "name", name),
        "uuid": _txt(root, "uuid"),
        "description": _txt(root, "description"),
        "vcpu": int(_num({"v": _txt(root, "vcpu", "0")}, "v")),
        "memory_mb": _byte_to_mb(memory_kib),
        "os_type": _attr(root, "os/type", "machine"),
        "arch": _attr(root, "os/type", "arch"),
        "machine": _attr(root, "os/type", "machine"),
        "boot_devs": [b.get("dev", "") for b in root.findall("os/boot")],
        "disks": disks,
        "nets": nets,
        "graphics": graphics,
        "autostart": False,
    }


# ---------------------------------------------------------------- 接口: 环境

@rc.interface("vm.info")
def vm_info(params):
    """环境与能力探测。前端据此决定显示什么、禁用哪些按钮。"""
    cfg = _conf()
    meta = _meta()

    libvirt_ver = ""
    ok, out, _ = _run([VIRSH, "--version"], timeout=15)
    if ok:
        libvirt_ver = out.strip()

    qemu_ver = ""
    ok, out, _ = _virsh(["version"], timeout=15)
    if ok:
        for line in out.splitlines():
            if "qemu" in line.lower() or "emulator" in line.lower():
                qemu_ver = line.strip()
                break
            if "hypervisor" in line.lower() and not qemu_ver:
                qemu_ver = line.strip()

    have_kvm = os.path.exists("/dev/kvm")
    kvm_note = ""
    if not have_kvm:
        kvm_note = "/dev/kvm 不存在: 虚拟机将退化为纯软件模拟(很慢), 需在 BIOS 开启虚拟化"

    doms = []
    ok_list, out_list, err_list = _virsh(["list", "--all"], timeout=20)
    list_err = ""
    if ok_list:
        doms = _parse_list_all(out_list)
    else:
        list_err = err_list

    pools = []
    ok_pool, out_pool, _ = _virsh(["pool-list", "--all"], timeout=20)
    if ok_pool:
        for line in out_pool.splitlines():
            s = line.strip()
            if not s or set(s) <= set("-") or s.lower().startswith("name"):
                continue
            parts = s.split(None, 2)
            if len(parts) >= 2:
                pools.append({"name": parts[0], "state": parts[1],
                              "autostart": parts[2] if len(parts) > 2 else ""})

    return {
        "name": meta["name"], "label": meta["label"],
        "version": meta["version"], "description": meta["description"],
        "lang": "python",
        "uri": cfg["uri"],
        "libvirt": libvirt_ver,
        "qemu": qemu_ver,
        "have_kvm": have_kvm,
        "kvm_note": kvm_note,
        "virt_install": bool(VIRT_INSTALL),
        "domains_total": len(doms),
        "domains_running": len([d for d in doms if d["state"] == "running"]),
        "pools": pools,
        "image_dir": cfg["image_dir"],
        "list_error": list_err,
        # 运行环境: 前端据此提示"只能看不能管"
        #   is_root   面板以 root 运行(可写)
        #   can_manage 能执行启停/创建 —— root 或免密 sudo
        # libvirt 的 polkit 允许普通用户做只读操作, 所以"看得到列表"不代表能改。
        "is_root": os.geteuid() == 0,
        "can_manage": _can_manage(),
        "sudo_nopasswd": _sudo_nopasswd_ok(),
        "user": _whoami(),
    }


def _whoami():
    try:
        import pwd
        return pwd.getpwuid(os.geteuid()).pw_name
    except Exception:  # noqa: BLE001
        return str(os.geteuid())


def _sudo_nopasswd_ok():
    """当前用户能否免密 sudo。"""
    try:
        r = subprocess.run(["sudo", "-n", "true"], capture_output=True, timeout=8)
        return r.returncode == 0
    except Exception:  # noqa: BLE001
        return False


# libvirt 的 unix socket。rw 权限由 libvirtd.conf 的
# `unix_sock_group`(默认 libvirt) + `unix_sock_rw_perms`(默认 0770) 决定。
SOCK_CANDIDATES = (
    "/run/libvirt/libvirt-sock",
    "/var/run/libvirt/libvirt-sock",
    "/run/libvirt/libvirt-sock-ro",
)


def _can_manage():
    """当前进程能否对 qemu:///system 做写操作(启停/创建/删除)。

    ★ 不能只看是不是 root, 也不能只看 sudo(2026-10-18 实测踩到):
      这道机器上面板以普通用户 f 运行, 没有免密 sudo, 但 f 在 libvirt 组里,
      所以对 libvirt socket 有完整读写 —— 开机/断电都成功。
      只查 sudo 会把这种情况误判成"只能看", 从而白白禁用界面按钮。

    判断依据(任一成立即可):
      1. root
      2. 免密 sudo 可用
      3. libvirt socket 的属组在当前进程的组里, 且该组有读写位
    """
    if os.geteuid() == 0:
        return True
    if _sudo_nopasswd_ok():
        return True

    my_gids = set(os.getgroups()) | {os.getegid()}
    for sock in SOCK_CANDIDATES:
        try:
            st = os.stat(sock)
        except OSError:
            continue
        mode = st.st_mode & 0o777
        # 按 POSIX 权限位判断"我能不能对这个 socket 读写"。四种情况都要覆盖:
        #   属主可读写且我是属主 / 属组可读写且我在该组 / other 可读写(任何人都行)
        # ★ 实测这道机器的 socket 是 0666 root:root —— 既不是我在属组, 也不是我属主,
        #   但 other 位开放, 所以普通用户照样能管理。只看属组会漏掉这种配置。
        if st.st_uid == os.geteuid() and (mode & 0o600) == 0o600:
            return True
        if st.st_gid in my_gids and (mode & 0o060) == 0o060:
            return True
        if (mode & 0o006) == 0o006:
            return True
    return False


# ---------------------------------------------------------------- 接口: 列表/详情

@rc.interface("vm.list")
def vm_list(params):
    out = _virsh_out(["list", "--all"], timeout=20)
    items = _parse_list_all(out)
    notes = _notes()

    # 一次 domstats 拿到所有域的状态/内存/CPU, 避免每台单独调用
    ok, st_out, _ = _virsh(["domstats"], timeout=25)
    stats = _parse_domstats(st_out) if ok else {}

    for it in items:
        s = stats.get(it["name"], {})
        code = int(_num(s, "state.state", -1))
        if code in STATE_BY_CODE:
            it["state"] = STATE_BY_CODE[code]
        it["vcpu"] = int(_num(s, "vcpu.current", 0))
        it["memory_mb"] = round(_num(s, "balloon.current", 0) / 1024.0, 1)
        it["cpu_time_ns"] = int(_num(s, "cpu.time", 0))
        it["note"] = notes.get(it["name"], "")
        it["state_label"] = STATE_LABEL.get(it["state"], it["state"])

    # 配置(CPU/内存)与自启: 关闭的域 domstats 可能没有 balloon, 用 dominfo 兜底
    for it in items:
        if it["vcpu"] and it["memory_mb"]:
            continue
        ok2, info_out, _ = _virsh(["dominfo", it["name"]], timeout=15)
        if not ok2:
            continue
        kv = {}
        for line in info_out.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                kv[k.strip().lower()] = v.strip()
        if not it["vcpu"]:
            try:
                it["vcpu"] = int(kv.get("cpu(s)", "0"))
            except ValueError:
                it["vcpu"] = 0
        if not it["memory_mb"]:
            m = re.sub(r"[^0-9.]", "", kv.get("max memory", "").split()[0] if kv.get("max memory") else "0")
            it["memory_mb"] = _byte_to_mb(m or 0)
        it["autostart"] = "enable" in kv.get("autostart", "")

    for it in items:
        it.setdefault("autostart", False)

    return {"domains": items, "total": len(items),
            "running": len([d for d in items if d["state"] == "running"])}


@rc.interface("vm.detail")
def vm_detail(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    d = _detail(name)
    if d is None:
        _err("读取虚拟机 %s 的配置失败" % name)

    ok, out, _ = _virsh(["dominfo", name], timeout=15)
    if ok:
        kv = {}
        for line in out.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                kv[k.strip().lower()] = v.strip()
        d["autostart"] = "enable" in kv.get("autostart", "")
        d["persistent"] = kv.get("persistent", "").lower().startswith("yes")
        d["state_raw"] = kv.get("state", "")

    ok, out, _ = _virsh(["domstate", name], timeout=15)
    if ok:
        d["state"] = _state_from_text(out)
        d["state_label"] = STATE_LABEL.get(d["state"], d["state"])

    d["note"] = _notes().get(name, "")
    return d


@rc.interface("vm.stats")
def vm_stats(params):
    """实时统计。用 domstats 的 key=value, 不做文本解析。

    返回的字段直接给前端画进度条/速率, 单位已换算好:
      cpu_pct      CPU 占用百分比(相对 vcpu 总数, 由两次采样差值算)
      mem_*        内存 MB
      net_rx_kbps / net_tx_kbps
      disk_rd_kbps / disk_wr_kbps
    """
    name = _s(params, "name") or _err("缺少虚拟机名称")

    ok, out, err = _virsh(["domstats", name], timeout=20)
    if not ok:
        _err(err or "读取统计失败")
    kv = _parse_domstats(out).get(name)
    if not kv:
        _err("虚拟机 %s 无统计数据(可能未启动)" % name)

    total_mem = _num(kv, "balloon.maximum", 0) or _num(kv, "balloon.current", 0)
    cur_mem = _num(kv, "balloon.current", 0)
    vcpu = int(_num(kv, "vcpu.current", 0))
    cpu_time = int(_num(kv, "cpu.time", 0))

    net_rx = sum(_num(kv, k) for k in kv if re.match(r"net\.\d+\.rx\.bytes$", k))
    net_tx = sum(_num(kv, k) for k in kv if re.match(r"net\.\d+\.tx\.bytes$", k))
    disk_rd = sum(_num(kv, k) for k in kv if re.match(r"block\.\d+\.rd\.bytes$", k))
    disk_wr = sum(_num(kv, k) for k in kv if re.match(r"block\.\d+\.wr\.bytes$", k))

    # CPU 百分比需要两次采样: 用模块级缓存存上一次的值与时间
    now = time.time()
    pct = 0.0
    key = "cpu:" + name
    with _state_lock:
        prev = _STATS_CACHE.get(key)
        if prev:
            dt = now - prev["t"]
            dns = cpu_time - prev["ns"]
            if dt > 0.05 and dns >= 0 and vcpu > 0:
                pct = round(dns / (dt * 1e9) / vcpu * 100.0, 1)
        _STATS_CACHE[key] = {"t": now, "ns": cpu_time}

    # 网络/磁盘速率同理需要差值。首次采样没有基准, 返回 warmup 标记,
    # 让前端显示"测量中"而不是一个假的 0。
    def _rate(field, cur):
        k = field + ":" + name
        with _state_lock:
            prev = _STATS_CACHE.get(k)
            _STATS_CACHE[k] = {"t": now, "v": cur}
        if not prev:
            return 0.0, True
        dt = now - prev["t"]
        if dt <= 0.05:
            return 0.0, False
        d = cur - prev["v"]
        if d < 0:
            return 0.0, False
        return round(d * 8 / 1000.0 / dt, 1), False

    rx_kbps, rx_first = _rate("netrx", net_rx)
    tx_kbps, tx_first = _rate("nettx", net_tx)
    rd_kbps, rd_first = _rate("diskrd", disk_rd)
    wr_kbps, wr_first = _rate("diskwr", disk_wr)

    return {
        "name": name,
        "state": STATE_BY_CODE.get(int(_num(kv, "state.state", -1)), ""),
        "vcpu": vcpu,
        "cpu_pct": pct,
        "cpu_time_sec": round(cpu_time / 1e9, 1),
        "mem_cur_mb": round(cur_mem / 1024.0, 1),
        "mem_max_mb": round(total_mem / 1024.0, 1),
        "mem_pct": round(cur_mem / total_mem * 100.0, 1) if total_mem else 0.0,
        "net_rx_kbps": rx_kbps, "net_tx_kbps": tx_kbps,
        "disk_rd_kbps": rd_kbps, "disk_wr_kbps": wr_kbps,
        "net_rx_total": net_rx, "net_tx_total": net_tx,
        "disk_rd_total": disk_rd, "disk_wr_total": disk_wr,
        "warmup": bool(rx_first or tx_first or rd_first or wr_first),
        # 第二次采样才有速率; 前端第一次拿到 warmup=True 时显示"测量中"
    }


_STATS_CACHE = {}


# ---------------------------------------------------------------- 接口: 操作

# action → virsh 子命令
ACTION_MAP = {
    "start": "start",
    "shutdown": "shutdown",       # 优雅关机(ACPI), 客人不响应会一直等
    "destroy": "destroy",         # 强制断电
    "reboot": "reboot",           # 优雅重启
    "reset": "reset",             # 强制重启
    "suspend": "suspend",
    "resume": "resume",
}


@rc.interface("vm.action")
def vm_action(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    action = _s(params, "action").lower()
    if action not in ACTION_MAP:
        _err("不支持的操作: %s(可用: %s)" % (action, ", ".join(ACTION_MAP)))

    # 幂等性: 已经在目标状态时直接返回, 免得界面报错
    ok, st, _ = _virsh(["domstate", name], timeout=15)
    cur = _state_from_text(st) if ok else ""
    if action == "start" and cur == "running":
        return {"ok": True, "name": name, "action": action, "state": cur, "noop": True}
    if action in ("shutdown", "destroy", "suspend") and cur in ("shutoff", ""):
        return {"ok": True, "name": name, "action": action, "state": "shutoff", "noop": True}

    args = [ACTION_MAP[action], name]
    # 关机默认等 60s; 强制操作不等
    timeout = 60 if action in ("shutdown", "reboot") else 20
    ok, out, err = _virsh(args, timeout=timeout)
    if not ok:
        _err(err or ("%s 失败" % action))

    # 回读新状态, 让前端立刻更新而不是靠猜
    ok2, st2, _ = _virsh(["domstate", name], timeout=10)
    new_state = _state_from_text(st2) if ok2 else ""
    return {"ok": True, "name": name, "action": action,
            "state": new_state, "state_label": STATE_LABEL.get(new_state, new_state)}


@rc.interface("vm.autostart")
def vm_autostart(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    on = _b(params, "on", True)
    ok, out, err = _virsh(["autostart", name] + ([] if on else ["--disable"]), timeout=20)
    if not ok:
        _err(err or "设置自启失败")
    return {"ok": True, "name": name, "autostart": on}


@rc.interface("vm.note.get")
def vm_note_get(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    return {"name": name, "note": _notes().get(name, "")}


@rc.interface("vm.note.save")
def vm_note_save(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    note = _s(params, "note")
    with _state_lock:
        notes = _notes()
        if note.strip():
            notes[name] = note.strip()
        else:
            notes.pop(name, None)
        _write_json(NOTES_PATH, notes)
    return {"ok": True, "name": name, "note": note.strip()}


# ---------------------------------------------------------------- 接口: 镜像/存储池

IMG_EXT = (".qcow2", ".img", ".raw", ".iso", ".qcow")


def _img_info(path):
    """用 qemu-img info 读镜像元数据。读不到就返回最小信息(不报错)。"""
    size = 0
    try:
        size = os.path.getsize(path)
    except OSError:
        pass
    fmt, vsize, backing = "", 0, ""
    ok, out, _ = _run([QEMU_IMG, "info", "--output=json", path], timeout=20)
    if ok:
        try:
            j = json.loads(out)
            fmt = j.get("format", "")
            vsize = int(j.get("virtual-size", 0) or 0)
            backing = j.get("backing-filename", "") or ""
        except (ValueError, TypeError):
            pass
    return {
        "name": os.path.basename(path),
        "path": path,
        "size": size,
        "size_h": _fmt_bytes(size),
        "format": fmt,
        "virtual_size": vsize,
        "virtual_size_h": _fmt_bytes(vsize) if vsize else "",
        "backing": backing,
    }


def _scan_images(dirs, max_files=80):
    found = []
    seen = set()
    for d in dirs:
        if not d or not os.path.isdir(d):
            continue
        try:
            names = sorted(os.listdir(d))
        except OSError:
            continue
        for n in names:
            p = os.path.join(d, n)
            if not os.path.isfile(p) or p in seen:
                continue
            if not n.lower().endswith(IMG_EXT):
                continue
            # .bad 之类明显损坏的备份不列出
            if n.endswith(".bad"):
                continue
            seen.add(p)
            found.append(p)
            if len(found) >= max_files:
                return found
    return found


@rc.interface("vm.images.list")
def vm_images_list(params):
    """列出可用镜像。

    同时扫存储池路径与配置的 image_dir —— 镜像常散落在
    /var/lib/libvirt/images 与自定义池里, 只扫一处会漏。
    """
    cfg = _conf()
    dirs = [cfg["image_dir"]]

    ok, out, _ = _virsh(["pool-list", "--name", "--all"], timeout=20)
    if ok:
        for pname in [x.strip() for x in out.splitlines() if x.strip()]:
            ok2, dx, _ = _virsh(["pool-dumpxml", pname], timeout=15)
            if not ok2:
                continue
            try:
                root = ET.fromstring(dx)
                path = _txt(root, "target/path")
                if path and path not in dirs:
                    dirs.append(path)
            except ET.ParseError:
                continue

    paths = _scan_images(dirs)
    images = [_img_info(p) for p in paths]
    # 大的排前面(通常是可用的基础镜像; 小的多是 seed.iso)
    images.sort(key=lambda x: x["size"], reverse=True)
    return {"images": images, "dirs": dirs, "count": len(images)}


@rc.interface("vm.pools.list")
def vm_pools_list(params):
    out = _virsh_out(["pool-list", "--all", "--details"], timeout=20)
    items = []
    for line in out.splitlines():
        s = line.strip()
        if not s or set(s) <= set("-") or s.lower().startswith("name"):
            continue
        parts = s.split()
        if len(parts) < 5:
            continue
        items.append({
            "name": parts[0],
            "state": parts[1],
            "autostart": parts[2],
            "persistent": parts[3],
            "capacity": " ".join(parts[4:]),
        })
    # 补路径与容量(人读的 capacity 列有时是 "1.00 GiB", 直接给了)
    for it in items:
        ok, dx, _ = _virsh(["pool-dumpxml", it["name"]], timeout=15)
        if not ok:
            continue
        try:
            root = ET.fromstring(dx)
            it["path"] = _txt(root, "target/path")
        except ET.ParseError:
            it["path"] = ""
    return {"pools": items, "count": len(items)}


# ---------------------------------------------------------------- 接口: 创建/删除

def _safe_name(name):
    """虚拟机名即 libvirt 域名的合法字符集。防注入到命令行。"""
    if not re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$", name or ""):
        _err("名称只能包含字母、数字、点、下划线、短横线, 且以字母或数字开头(最长 63)")
    return name


@rc.interface("vm.create")
def vm_create(params):
    """从镜像创建虚拟机。

    走 `qemu-img create -b 基础镜像` 做 COW 覆盖层, 保留基础镜像不动;
    然后用 virt-install --import 注册并启动(如果要求)。
    没有 virt-install 时退化为手写 XML + virsh define。
    """
    name = _safe_name(_s(params, "name"))
    image = _s(params, "image")
    if not image:
        _err("请选择基础镜像")
    if not os.path.isfile(image):
        _err("镜像不存在: %s" % image)

    vcpu = max(1, min(_i(params, "vcpu", 2), 64))
    mem_mb = max(128, min(_i(params, "memory", 2048), 1048576))
    disk_gb = max(1, min(_i(params, "disk_gb", 20), 4096))
    net_mode = _s(params, "network", "default") or "default"
    vnc_listen = _s(params, "vnc_listen", _conf()["default_vnc_listen"])
    start_now = _b(params, "start", True)

    if name in [d["name"] for d in _parse_list_all(_virsh_out(["list", "--all"], 20))]:
        _err("已存在同名虚拟机: %s" % name)

    # 目标磁盘: 与基础镜像同目录(通常同一存储池, 避免跨设备 COW 问题)
    target_dir = os.path.dirname(image)
    target = os.path.join(target_dir, "%s.qcow2" % name)
    if os.path.exists(target):
        _err("磁盘已存在: %s" % target)

    # COW 覆盖层: 秒级创建且不复制数据。基础镜像只读, 多台虚拟机可共享。
    ok, out, err = _run([QEMU_IMG, "create", "-q", "-f", "qcow2",
                         "-F", "qcow2", "-b", image, target, "%dG" % disk_gb], timeout=120)
    if not ok:
        _err("创建磁盘失败: %s" % (err or out))
    try:
        os.chmod(target, 0o666)  # libvirt-qemu 需要可写
    except OSError:
        pass

    created = False
    try:
        if VIRT_INSTALL:
            args = [VIRT_INSTALL, "--connect", _conf()["uri"], "--name", name,
                    "--memory", str(mem_mb), "--vcpus", str(vcpu),
                    "--disk", "path=%s,format=qcow2,bus=virtio" % target,
                    "--network", "network=%s,model=virtio" % net_mode,
                    "--graphics", "vnc,listen=%s" % vnc_listen,
                    "--os-variant", "detect=on",
                    "--import", "--noautoconsole"]
            if not start_now:
                args += ["--noreboot"]
            ok, out, err = _run(args, timeout=180)
            if not ok:
                _err("virt-install 失败: %s" % (err or out))
            created = True
            if not start_now:
                _virsh(["destroy", name], timeout=20)
        else:
            xml = _build_xml(name, mem_mb, vcpu, target, net_mode, vnc_listen)
            tmp = os.path.join(PLUGIN_DIR, ".create-%s.xml" % name)
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(xml)
            ok, out, err = _virsh(["define", tmp], timeout=60)
            try:
                os.remove(tmp)
            except OSError:
                pass
            if not ok:
                _err("define 失败: %s" % (err or out))
            created = True
            if start_now:
                ok2, _, err2 = _virsh(["start", name], timeout=60)
                if not ok2:
                    _err("已创建但启动失败: %s" % err2)
    finally:
        if not created:
            # 创建失败要把覆盖层删掉, 否则留下一个孤儿磁盘
            try:
                os.remove(target)
            except OSError:
                pass

    ok2, st, _ = _virsh(["domstate", name], timeout=15)
    return {"ok": True, "name": name, "disk": target,
            "vcpu": vcpu, "memory_mb": mem_mb, "disk_gb": disk_gb,
            "state": _state_from_text(st) if ok2 else ""}


def _build_xml(name, mem_mb, vcpu, disk, network, vnc_listen):
    """没有 virt-install 时手写的 minimal domain XML。"""
    mem_kib = mem_mb * 1024
    return """<domain type='kvm'>
  <name>{name}</name>
  <memory unit='KiB'>{mem}</memory>
  <vcpu placement='static'>{vcpu}</vcpu>
  <os>
    <type arch='x86_64' machine='pc'>hvm</type>
    <boot dev='hd'/>
  </os>
  <features><acpi/><apic/></features>
  <cpu mode='host-passthrough'/>
  <devices>
    <disk type='file' device='disk'>
      <driver name='qemu' type='qcow2' cache='none' io='native'/>
      <source file='{disk}'/>
      <target dev='vda' bus='virtio'/>
    </disk>
    <interface type='network'>
      <source network='{network}'/>
      <model type='virtio'/>
    </interface>
    <graphics type='vnc' port='-1' autoport='yes' listen='{vnc}'/>
    <video><model type='virtio'/></video>
    <console type='pty'/>
  </devices>
</domain>
""".format(name=name, mem=mem_kib, vcpu=vcpu, disk=disk,
           network=network, vnc=vnc_listen)


@rc.interface("vm.delete")
def vm_delete(params):
    """删除虚拟机。可选同时删除磁盘(默认不删 —— 误删数据代价太大)。"""
    name = _s(params, "name") or _err("缺少虚拟机名称")
    with_disk = _b(params, "with_disk", False)

    # 运行中先强制断电, 否则 undefine 会失败
    ok, st, _ = _virsh(["domstate", name], timeout=15)
    if ok and _state_from_text(st) == "running":
        _virsh(["destroy", name], timeout=30)

    args = ["undefine", name]
    if with_disk:
        args += ["--remove-all-storage"]
    ok, out, err = _virsh(args, timeout=90)
    if not ok:
        _err(err or "删除失败")

    # 备注一并清掉
    with _state_lock:
        notes = _notes()
        if notes.pop(name, None) is not None:
            _write_json(NOTES_PATH, notes)

    return {"ok": True, "name": name, "with_disk": with_disk}


# ---------------------------------------------------------------- 接口: VNC

@rc.interface("vm.console")
def vm_console(params):
    """VNC 控制台信息。返回端口与连接地址, 不返回密码(密码不应经日志/前端泄露)。"""
    name = _s(params, "name") or _err("缺少虚拟机名称")

    # 先查状态: 关机时 domdisplay 会返回 "Domain is not running",
    # 直接透传会让用户以为"这台机器没有 VNC", 其实是没开机。
    ok, st, _ = _virsh(["domstate", name], timeout=15)
    state = _state_from_text(st) if ok else ""
    if state and state != "running":
        _err("虚拟机未运行(%s), 开机后才有 VNC 控制台" % STATE_LABEL.get(state, state))

    ok, out, err = _virsh(["domdisplay", "--type", "vnc", name], timeout=15)
    if not ok:
        _err("该虚拟机没有 VNC 显示(可能使用串口/无图形): %s" % (err or out))

    port = 0
    m = re.search(r":(\d+)", out)
    if m:
        port = 5900 + int(m.group(1))

    root = _xml_root(name)
    listen, passwd_set = "", False
    if root is not None:
        for g in root.findall("devices/graphics"):
            if g.get("type") == "vnc":
                listen = _attr(g, "listen", "address")
                passwd_set = bool(g.get("passwd"))

    # 可达性提示: 监听 127.0.0.1 时只有宿主机本机连得上,
    # 局域网里的客户端连不上 —— 这不是插件问题, 但用户需要知道去哪改。
    reachable = "all" if listen in ("0.0.0.0", "::", "") else ("local" if listen.startswith("127.") else "custom")
    hint = ""
    if reachable == "local":
        hint = ("VNC 只监听 127.0.0.1(仅宿主机可连)。要用 VNC 客户端从其他机器接入, "
                "需把虚拟机显示配置改成 listen='0.0.0.0' 并设置密码。")

    return {"name": name, "vnc": out.strip(), "port": port,
            "listen": listen, "has_password": passwd_set,
            "reachable": reachable, "hint": hint}


# ---------------------------------------------------------------- 接口: 快照

@rc.interface("vm.snapshot.list")
def vm_snapshot_list(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    ok, out, err = _virsh(["snapshot-list", name, "--name"], timeout=20)
    if not ok:
        # 没有快照时 virsh 返回非 0 且提示 "no snapshot", 这不是错误
        if "no snapshot" in (err or "").lower() or "没有快照" in (err or ""):
            return {"name": name, "snapshots": [], "count": 0}
        _err(err or "读取快照失败")

    names = [x.strip() for x in out.splitlines() if x.strip()]
    items = []
    for sn in names:
        it = {"name": sn, "created": "", "state": "", "parent": ""}
        ok2, info, _ = _virsh(["snapshot-info", name, sn], timeout=15)
        if ok2:
            kv = {}
            for line in info.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    kv[k.strip().lower()] = v.strip()
            it["created"] = kv.get("created", "")
            it["state"] = kv.get("state", "")
            it["parent"] = kv.get("parent", "")
        items.append(it)
    return {"name": name, "snapshots": items, "count": len(items)}


@rc.interface("vm.snapshot.create")
def vm_snapshot_create(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    snap = _safe_name(_s(params, "snapshot") or ("snap-" + time.strftime("%Y%m%d-%H%M%S")))
    desc = _s(params, "description", "")
    args = ["snapshot-create-as", name, snap]
    if desc:
        args += ["--description", desc]
    ok, out, err = _virsh(args, timeout=120)
    if not ok:
        _err(err or "创建快照失败")
    return {"ok": True, "name": name, "snapshot": snap}


@rc.interface("vm.snapshot.revert")
def vm_snapshot_revert(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    snap = _s(params, "snapshot") or _err("缺少快照名称")
    ok, out, err = _virsh(["snapshot-revert", name, snap], timeout=180)
    if not ok:
        _err(err or "回滚失败")
    return {"ok": True, "name": name, "snapshot": snap}


@rc.interface("vm.snapshot.delete")
def vm_snapshot_delete(params):
    name = _s(params, "name") or _err("缺少虚拟机名称")
    snap = _s(params, "snapshot") or _err("缺少快照名称")
    ok, out, err = _virsh(["snapshot-delete", name, snap], timeout=120)
    if not ok:
        _err(err or "删除快照失败")
    return {"ok": True, "name": name, "snapshot": snap}


# ---------------------------------------------------------------- 启动

if __name__ == "__main__":
    _m = _meta()
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name=_m["name"],
        version=_m["version"],
        manifest={"label": _m["label"], "description": _m["description"]},
        frontend={"pages": [{"path": "", "title": _m["label"]}]},
        iface_ids=[
            "vm.info", "vm.list", "vm.detail", "vm.stats", "vm.action", "vm.autostart",
            "vm.note.get", "vm.note.save", "vm.images.list", "vm.pools.list",
            "vm.create", "vm.delete", "vm.console",
            "vm.snapshot.list", "vm.snapshot.create", "vm.snapshot.revert",
            "vm.snapshot.delete",
        ],
        plugin_dir=PLUGIN_DIR,
    )
