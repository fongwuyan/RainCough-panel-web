#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""分析: ELF / PE 结构解析 + 保护机制 + 导入导出 + 可疑 API + 入口反汇编。

全部自研, 不依赖 capstone / pefile / pyelftools —— 这两种格式的头部都是固定偏移
的定长结构, 用 struct 直接读就够了。

反汇编用 core/x86.py(自研), 覆盖整数/跳转/常用 SSE, 已用 objdump 对照验证
(6 个真实二进制 100% 对齐)。

不做的事: 不还原控制流、不识别函数边界(只用符号表)、不模拟执行。
"""
import hashlib
import json
import math
import os
import re
import struct

from core import store, x86

MAX_READ = 64 * 1024 * 1024        # 单样本读取上限

# 可疑 API: 命中即提示"这个样本会做什么", 不做判定
SUSPICIOUS = {
    "system": ("命令执行", "中危"), "popen": ("命令执行", "中危"),
    "execve": ("命令执行", "中危"), "execl": ("命令执行", "中危"),
    "execvp": ("命令执行", "中危"), "fork": ("进程创建", "低危"),
    "socket": ("网络通信", "中危"), "connect": ("网络连接", "中危"),
    "gethostbyname": ("DNS 解析", "低危"), "inet_addr": ("网络通信", "低危"),
    "ptrace": ("反调试", "中危"), "dlopen": ("动态加载", "中危"),
    "dlsym": ("动态加载", "中危"), "mmap": ("内存映射", "低危"),
    "mprotect": ("改内存权限", "中危"), "VirtualAlloc": ("内存分配", "低危"),
    "VirtualProtect": ("改内存权限", "中危"), "CreateRemoteThread": ("进程注入", "高危"),
    "WriteProcessMemory": ("进程注入", "高危"), "SetWindowsHookEx": ("消息钩子", "中危"),
    "LoadLibrary": ("动态加载", "低危"), "GetProcAddress": ("动态解析", "中危"),
    "WinExec": ("命令执行", "中危"), "ShellExecute": ("命令执行", "中危"),
    "CreateProcess": ("进程创建", "中危"), "RegSetValue": ("注册表写入", "中危"),
    "CryptEncrypt": ("加密操作", "中危"), "IsDebuggerPresent": ("反调试", "低危"),
    "checkDebugger": ("反调试", "低危"),
}

MACHINES = {
    3: "x86", 8: "MIPS", 20: "PowerPC", 40: "ARM", 62: "x86-64",
    183: "ARM64", 243: "RISC-V",
}

# 节名提示: 命中说明可能加壳/加密
PACK_HINTS = (".upx", "upx0", "upx1", "aspack", ".packed", ".petite", "mpress", ".themida")


def _entropy(b):
    if not b:
        return 0.0
    freq = [0] * 256
    for x in b:
        freq[x] += 1
    n = len(b)
    return -sum((c / n) * math.log2(c / n) for c in freq if c)


# ══════════════════════════════════════════════════════ ELF

PT_LOAD, PT_DYNAMIC, PT_INTERP = 1, 2, 3
PT_GNU_STACK, PT_GNU_RELRO = 0x6474E551, 0x6474E552
PF_X = 1
SHF_WRITE, SHF_EXECINSTR = 1, 4
DT_BIND_NOW, DT_FLAGS_1 = 0x18, 0x6FFFFFFB


def _elf(buf):
    if buf[:4] != b"\x7fELF":
        return None
    is64 = buf[4] == 2
    le = buf[5] == 1
    e = "<" if le else ">"
    rd = lambda o, n: int.from_bytes(buf[o:o + n], "little" if le else "big")
    if is64:
        e_type, e_machine = rd(16, 2), rd(18, 2)
        e_entry, e_phoff, e_shoff = rd(24, 8), rd(32, 8), rd(40, 8)
        e_phentsize, e_phnum = rd(54, 2), rd(56, 2)
        e_shentsize, e_shnum, e_shstrndx = rd(58, 2), rd(60, 2), rd(62, 2)
    else:
        e_type, e_machine = rd(16, 2), rd(18, 2)
        e_entry, e_phoff, e_shoff = rd(24, 4), rd(28, 4), rd(32, 4)
        e_phentsize, e_phnum = rd(42, 2), rd(44, 2)
        e_shentsize, e_shnum, e_shstrndx = rd(46, 2), rd(48, 2), rd(50, 2)

    out = {
        "format": "ELF", "bits": 64 if is64 else 32,
        "arch": MACHINES.get(e_machine, "machine=%d" % e_machine),
        "type": {1: "可重定位", 2: "可执行", 3: "共享库/PIE", 4: "core"}.get(e_type, str(e_type)),
        "entry": e_entry, "sections": [], "imports": [], "exports": [],
        "protections": {}, "notes": [],
    }

    # 段: NX / RELRO / 解释器
    segs = []
    for i in range(min(e_phnum, 128)):
        o = e_phoff + i * e_phentsize
        if o + (56 if is64 else 32) > len(buf):
            break
        p_type = rd(o, 4)
        if is64:
            p_flags = rd(o + 4, 4)
            p_offset, p_vaddr = rd(o + 8, 8), rd(o + 16, 8)
            p_filesz = rd(o + 32, 8)
        else:
            p_offset, p_vaddr = rd(o + 4, 4), rd(o + 8, 4)
            p_filesz = rd(o + 16, 4)
            p_flags = rd(o + 24, 4)
        segs.append({"type": p_type, "flags": p_flags, "off": p_offset,
                     "vaddr": p_vaddr, "filesz": p_filesz})

    has_stack = any(s["type"] == PT_GNU_STACK for s in segs)
    stack_x = any(s["type"] == PT_GNU_STACK and s["flags"] & PF_X for s in segs)
    has_relro = any(s["type"] == PT_GNU_RELRO for s in segs)
    has_interp = any(s["type"] == PT_INTERP for s in segs)

    # 节
    shstr_off = 0
    if e_shnum and e_shstrndx < e_shnum:
        o = e_shoff + e_shstrndx * e_shentsize
        shstr_off = rd(o + (24 if is64 else 16), 8 if is64 else 4)
    for i in range(min(e_shnum, 96)):
        o = e_shoff + i * e_shentsize
        if o + (64 if is64 else 40) > len(buf):
            break
        name_off = rd(o, 4)
        if is64:
            sh_flags = rd(o + 8, 8)
            sh_addr, sh_offset, sh_size = rd(o + 16, 8), rd(o + 24, 8), rd(o + 32, 8)
        else:
            sh_flags = rd(o + 8, 4)
            sh_addr, sh_offset, sh_size = rd(o + 12, 4), rd(o + 16, 4), rd(o + 20, 4)
        name = _cstr(buf, shstr_off + name_off, 40)
        if not name:
            continue
        body = buf[sh_offset:sh_offset + min(sh_size, 1 << 20)]
        out["sections"].append({
            "name": name, "addr": sh_addr, "size": sh_size,
            "exec": bool(sh_flags & SHF_EXECINSTR), "write": bool(sh_flags & SHF_WRITE),
            "entropy": round(_entropy(body), 2),
        })

    # 动态符号: 导入 / 导出 / canary
    dynsym = next((s for s in out["sections"] if s["name"] == ".dynsym"), None)
    if dynsym:
        ent = 24 if is64 else 16
        # 找 .dynstr
        dynstr = next((s for s in out["sections"] if s["name"] == ".dynstr"), None)
        # 节头里有 offset, 上面只存了 addr, 这里重新取一遍 offset
        off_map = {}
        for i in range(min(e_shnum, 96)):
            o = e_shoff + i * e_shentsize
            if o + (64 if is64 else 40) > len(buf):
                break
            nm = _cstr(buf, shstr_off + rd(o, 4), 40)
            if is64:
                off_map[nm] = (rd(o + 24, 8), rd(o + 32, 8), rd(o + 20, 4))
            else:
                off_map[nm] = (rd(o + 16, 4), rd(o + 20, 4), rd(o + 12, 4))
        if ".dynsym" in off_map and ".dynstr" in off_map:
            sym_off, sym_size, sym_entsize = off_map[".dynsym"]
            str_off, str_size, _ = off_map[".dynstr"]
            cnt = min(sym_size // (sym_entsize or ent), 20000)
            for k in range(cnt):
                p = sym_off + k * (sym_entsize or ent)
                if p + ent > len(buf):
                    break
                st_name = rd(p, 4)
                st_info = buf[p + 4] if p + 4 < len(buf) else 0
                st_shndx = rd(p + 6, 2)
                st_value = rd(p + 8, 8 if is64 else 4)
                st_size = rd(p + 16, 8 if is64 else 4) if is64 else rd(p + 12, 4)
                nm = _cstr(buf, str_off + st_name, 120)
                if not nm:
                    continue
                bind, typ = st_info >> 4, st_info & 0xF
                if st_shndx == 0:
                    out["imports"].append(nm)
                elif typ == 2 and bind in (1, 2):
                    out["exports"].append({"name": nm, "addr": st_value, "size": st_size})
    # 符号表里的 canary
    allnames = set(out["imports"]) | {x["name"] for x in out["exports"]}
    canary = "__stack_chk_fail" in allnames or "__stack_chk_guard" in allnames

    # RELRO 全/部分
    bind_now = False
    dyn = next((s for s in segs if s["type"] == PT_DYNAMIC), None)
    if dyn:
        p = dyn["off"]
        ent = 16 if is64 else 8
        for _ in range(min(dyn["filesz"] // ent, 512)):
            if p + ent > len(buf):
                break
            tag = rd(p, 8 if is64 else 4)
            val = rd(p + (8 if is64 else 4), 8 if is64 else 4)
            if tag == 0:
                break
            if tag == DT_BIND_NOW:
                bind_now = True
            if tag == DT_FLAGS_1 and (val & 1):
                bind_now = True
            p += ent

    out["protections"] = {
        "pie": e_type == 3 and has_interp,
        "nx": (not stack_x),
        "canary": canary,
        "relro": ("全" if (has_relro and bind_now) else ("部分" if has_relro else "无")),
        "stack_exec": stack_x,
    }
    if not has_stack:
        out["notes"].append("未声明 PT_GNU_STACK, NX 状态按默认(不可执行)处理")
    packed = [s["name"] for s in out["sections"] if any(h in s["name"].lower() for h in PACK_HINTS)]
    if packed:
        out["notes"].append("节名命中加壳特征: " + ", ".join(packed))
    high = [s["name"] for s in out["sections"] if s["entropy"] >= 7.5 and s["size"] > 4096]
    if high:
        out["notes"].append("高熵节(可能压缩/加密): " + ", ".join(high[:4]))
    out["imports"] = sorted(set(out["imports"]))[:400]
    return out


def _cstr(buf, off, maxlen=64):
    if off <= 0 or off >= len(buf):
        return ""
    end = buf.find(b"\x00", off, min(off + maxlen, len(buf)))
    if end < 0:
        return ""
    try:
        return buf[off:end].decode("utf-8", "replace")
    except Exception:
        return ""


# ══════════════════════════════════════════════════════ PE

def _pe(buf):
    if buf[:2] != b"MZ" or len(buf) < 0x40:
        return None
    pe_off = int.from_bytes(buf[0x3C:0x40], "little")
    if buf[pe_off:pe_off + 4] != b"PE\x00\x00":
        return None
    coff = pe_off + 4
    machine = int.from_bytes(buf[coff:coff + 2], "little")
    nsec = int.from_bytes(buf[coff + 2:coff + 4], "little")
    opt_size = int.from_bytes(buf[coff + 16:coff + 18], "little")
    characteristics = int.from_bytes(buf[coff + 18:coff + 20], "little")
    opt = coff + 20
    magic = int.from_bytes(buf[opt:opt + 2], "little")
    is64 = magic == 0x20B
    image_base = int.from_bytes(buf[opt + (24 if is64 else 28):][:8 if is64 else 4],
                                "little")
    entry_rva = int.from_bytes(buf[opt + 16:opt + 20], "little")
    dllchar = int.from_bytes(buf[opt + 70:opt + 72], "little")
    subsystem = int.from_bytes(buf[opt + 68:opt + 70], "little")
    dd_off = opt + (0x70 if is64 else 0x60)
    sections = []
    sec_off = opt + opt_size
    for i in range(min(nsec, 96)):
        o = sec_off + i * 40
        if o + 40 > len(buf):
            break
        name = buf[o:o + 8].rstrip(b"\x00").decode("latin-1", "replace")
        vsize = int.from_bytes(buf[o + 8:o + 12], "little")
        vaddr = int.from_bytes(buf[o + 12:o + 16], "little")
        rawsize = int.from_bytes(buf[o + 16:o + 20], "little")
        rawptr = int.from_bytes(buf[o + 20:o + 24], "little")
        chars = int.from_bytes(buf[o + 36:o + 40], "little")
        body = buf[rawptr:rawptr + min(rawsize, 1 << 20)]
        sections.append({"name": name, "vaddr": vaddr, "vsize": vsize,
                         # addr/size 是给前端统一用的(ELF 那边字段就叫这两个)
                         "addr": vaddr, "size": max(vsize, rawsize),
                         "rawptr": rawptr, "rawsize": rawsize, "chars": chars,
                         "entropy": round(_entropy(body), 2),
                         "exec": bool(chars & 0x20000000),
                         "write": bool(chars & 0x80000000)})

    def rva2off(rva):
        for s in sections:
            if s["vaddr"] <= rva < s["vaddr"] + max(s["vsize"], s["rawsize"]):
                return s["rawptr"] + (rva - s["vaddr"])
        return None

    imports = []
    dd_import = int.from_bytes(buf[dd_off + 8:dd_off + 12], "little")
    if dd_import:
        p = rva2off(dd_import)
        while p and p + 20 <= len(buf):
            oft = int.from_bytes(buf[p:p + 4], "little")
            name_rva = int.from_bytes(buf[p + 12:p + 16], "little")
            ft = int.from_bytes(buf[p + 16:p + 20], "little")
            if not name_rva:
                break
            dll_off = rva2off(name_rva)
            dll = _cstr(buf, dll_off or 0, 64) if dll_off else ""
            thunk = rva2off(oft or ft)
            if thunk:
                step = 8 if is64 else 4
                q = thunk
                for _ in range(256):
                    if q + step > len(buf):
                        break
                    v = int.from_bytes(buf[q:q + step], "little")
                    if v == 0:
                        break
                    if v & (1 << (step * 8 - 1)):
                        imports.append("%s!#%d" % (dll, v & 0xFFFF))
                    else:
                        no = rva2off(v & 0x7FFFFFFF)
                        nm = _cstr(buf, (no + 2) if no else 0, 80)
                        if nm:
                            imports.append("%s!%s" % (dll, nm))
                    q += step
            p += 20
            if len(imports) > 800:
                break

    exports = []
    dd_export = int.from_bytes(buf[dd_off:dd_off + 4], "little")
    if dd_export:
        p = rva2off(dd_export)
        if p and p + 40 <= len(buf):
            n_funcs = int.from_bytes(buf[p + 20:p + 24], "little")
            n_names = int.from_bytes(buf[p + 24:p + 28], "little")
            addr_funcs = int.from_bytes(buf[p + 28:p + 32], "little")
            addr_names = int.from_bytes(buf[p + 32:p + 36], "little")
            addr_ords = int.from_bytes(buf[p + 36:p + 40], "little")
            nf = rva2off(addr_funcs)
            nn = rva2off(addr_names)
            no = rva2off(addr_ords)
            for i in range(min(n_names, 400)):
                if not (nn and no and nf):
                    break
                nr = int.from_bytes(buf[nn + i * 4:nn + i * 4 + 4], "little")
                nm = _cstr(buf, (rva2off(nr) or 0), 120)
                if not nm:
                    continue
                ordi = int.from_bytes(buf[no + i * 2:no + i * 2 + 2], "little")
                if ordi >= n_funcs:
                    continue
                rva = int.from_bytes(buf[nf + ordi * 4:nf + ordi * 4 + 4], "little")
                exports.append({"name": nm, "addr": rva, "size": 0})

    return {
        "format": "PE", "bits": 64 if is64 else 32,
        "arch": {0x8664: "x86-64", 0x14C: "x86", 0xAA64: "ARM64"}.get(machine, "machine=%#x" % machine),
        "type": "DLL" if characteristics & 0x2000 else "可执行",
        "entry": entry_rva, "image_base": image_base, "subsystem": subsystem,
        "sections": sections, "imports": sorted(set(imports))[:400],
        "exports": exports,
        "protections": {
            "aslr": bool(dllchar & 0x40), "dep": bool(dllchar & 0x100),
            "cfg": bool(dllchar & 0x4000), "high_entropy_va": bool(dllchar & 0x20),
        },
        "notes": [],
    }


# ══════════════════════════════════════════════════════ 通用

def parse(buf):
    """识别并解析。返回结构 dict, 不支持则 None。"""
    for fn in (_elf, _pe):
        try:
            r = fn(buf)
        except Exception as e:
            r = None
        if r:
            return r
    return None


def suspicious(imports):
    out = []
    for name in imports:
        base = name.split("!")[-1].split("@")[0]
        if base in SUSPICIOUS:
            cap, lv = SUSPICIOUS[base]
            out.append({"api": name, "cap": cap, "level": lv})
    # 按能力去重, 保留一个代表
    seen = {}
    for x in out:
        seen.setdefault(x["cap"], x)
    return list(seen.values())


def classify_strings(buf, limit=300):
    """把字符串按用途分类 —— 比"一坨可打印字符"有用得多。"""
    txt = []
    for m in re.finditer(rb"[\x20-\x7e]{5,}", buf[:4 << 20]):
        txt.append(m.group().decode("ascii", "ignore"))
        if len(txt) >= 20000:
            break
    pats = {
        "URL": re.compile(r"https?://[^\s\"'<>]{4,120}"),
        "IP": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
        "路径": re.compile(r"(?:/[A-Za-z0-9_.\-]{2,}){2,}|[A-Za-z]:\\\\[^\s\"']{2,}"),
        "邮箱": re.compile(r"[\w.+-]+@[\w-]+\.[\w.]{2,}"),
        "域名": re.compile(r"\b(?:[a-z0-9-]+\.)+(?:com|net|org|cn|io|ru|top|xyz|info)\b"),
        "密钥特征": re.compile(r"(?:AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]+PRIVATE KEY-----|"
                          r"(?i:api[_-]?key|secret|password|passwd|token)\s*[:=])"),
    }
    out = {k: [] for k in pats}
    seen = {k: set() for k in pats}
    for s in txt:
        for k, p in pats.items():
            for m in p.findall(s):
                v = m if isinstance(m, str) else m[0]
                if len(v) < 4 or v in seen[k]:
                    continue
                seen[k].add(v)
                if len(out[k]) < limit // len(pats):
                    out[k].append(v)
    return {"total": len(txt), "groups": {k: v for k, v in out.items() if v}}


# ══════════════════════════════════════════════════════ 样本存取

def _load(sample_id):
    row = store.q1("SELECT * FROM atk_artifact WHERE id=?", (int(sample_id),))
    if not row:
        raise ValueError("样本不存在(id=%s)" % sample_id)
    path = row["path"]
    if not path or not os.path.isfile(path):
        raise ValueError("样本文件已丢失, 请重新上传")
    with open(path, "rb") as f:
        buf = f.read(MAX_READ)
    return row, buf


def upload(task_id, filename, data_b64):
    import base64
    import time as _t
    name = os.path.basename(filename or "sample.bin")[:120]
    try:
        buf = base64.b64decode(data_b64 or "", validate=False)
    except Exception as e:
        raise ValueError("base64 解码失败: %s" % e)
    if not buf:
        raise ValueError("文件为空")
    if len(buf) > 32 * 1024 * 1024:
        raise ValueError("样本超过 32MB, 请先裁剪")
    info = parse(buf) or {}
    kind = info.get("format") or "未知"
    safe = re.sub(r"[^\w.\-]", "_", name) or "sample.bin"
    path = os.path.join(store.UPLOAD_DIR, "%d_%s" % (int(_t.time()), safe))
    os.makedirs(store.UPLOAD_DIR, exist_ok=True)
    with open(path, "wb") as f:
        f.write(buf)
    meta = {"format": kind, "size": len(buf),
            "sha256": hashlib.sha256(buf).hexdigest(),
            "md5": hashlib.md5(buf).hexdigest()}
    aid = store.artifact_add(int(task_id or 0), name, "样本·" + kind,
                             json.dumps(meta), path)
    # 返回的 info 与 atk.analyze.info 同构, 前端上传后就能直接渲染
    full = _enrich(info, buf)
    full["filename"] = name
    return {"sample_id": aid, "filename": name, "kind": kind, "size": len(buf),
            "info": full}


def _enrich(st, buf):
    st = dict(st or {})
    st["size"] = len(buf)
    st["md5"] = hashlib.md5(buf).hexdigest()
    st["sha256"] = hashlib.sha256(buf).hexdigest()
    st["suspicious"] = suspicious(st.get("imports") or [])
    st.setdefault("sections", [])
    st.setdefault("imports", [])
    st.setdefault("exports", [])
    st.setdefault("notes", [])
    st.setdefault("protections", {})
    return st


def info(sample_id):
    row, buf = _load(sample_id)
    st = parse(buf)
    if not st:
        raise ValueError("无法识别的格式(目前支持 ELF / PE)")
    st = _enrich(st, buf)
    st["filename"] = row["filename"]
    return st


def functions(sample_id):
    row, buf = _load(sample_id)
    st = parse(buf)
    if not st:
        raise ValueError("无法识别的格式")
    out = []
    for x in st.get("exports", []):
        out.append({"name": x["name"], "addr": x["addr"], "size": x.get("size", 0), "kind": "导出"})
    if st["format"] == "ELF":
        # 从 .symtab 补函数符号(比 dynsym 全)
        syms = _elf_symtab(buf)
        for s in syms:
            if not any(o["addr"] == s["addr"] and o["name"] == s["name"] for o in out):
                out.append(s)
    out.sort(key=lambda x: x["addr"])
    return {"functions": out[:600], "entry": st.get("entry", 0),
            "format": st["format"], "arch": st.get("arch", "")}


def _elf_symtab(buf):
    """读 .symtab(如果有), 返回 FUNC 类型符号。"""
    try:
        is64 = buf[4] == 2
        le = buf[5] == 1
        rd = lambda o, n: int.from_bytes(buf[o:o + n], "little" if le else "big")
        if is64:
            e_shoff, e_shentsize, e_shnum, e_shstrndx = rd(40, 8), rd(58, 2), rd(60, 2), rd(62, 2)
        else:
            e_shoff, e_shentsize, e_shnum, e_shstrndx = rd(32, 4), rd(46, 2), rd(48, 2), rd(50, 2)
        shstr = rd(e_shoff + e_shstrndx * e_shentsize + (24 if is64 else 16), 8 if is64 else 4)
        secs = {}
        for i in range(min(e_shnum, 96)):
            o = e_shoff + i * e_shentsize
            nm = _cstr(buf, shstr + rd(o, 4), 40)
            if not nm:
                continue
            if is64:
                secs[nm] = (rd(o + 24, 8), rd(o + 32, 8), rd(o + 20, 4), rd(o + 56, 4))
            else:
                secs[nm] = (rd(o + 16, 4), rd(o + 20, 4), rd(o + 12, 4), rd(o + 36, 4))
        if ".symtab" not in secs or ".strtab" not in secs:
            return []
        off, size, entsize, link = secs[".symtab"]
        str_off = secs[".strtab"][0]
        ent = entsize or (24 if is64 else 16)
        out = []
        for k in range(min(size // ent, 20000)):
            p = off + k * ent
            if p + ent > len(buf):
                break
            st_name = rd(p, 4)
            st_info = buf[p + 4]
            st_shndx = rd(p + 6, 2)
            st_value = rd(p + 8, 8 if is64 else 4)
            st_size = rd(p + 16, 8 if is64 else 4) if is64 else rd(p + 12, 4)
            if (st_info & 0xF) != 2 or st_shndx == 0 or st_value == 0:
                continue
            nm = _cstr(buf, str_off + st_name, 120)
            if nm:
                out.append({"name": nm, "addr": st_value, "size": st_size, "kind": "符号"})
        return out
    except Exception:
        return []


def disasm(sample_id, addr=0, count=60):
    row, buf = _load(sample_id)
    st = parse(buf)
    if not st:
        raise ValueError("无法识别的格式")
    if st.get("arch") not in ("x86-64", "x86"):
        raise ValueError("反汇编只支持 x86 架构, 当前是 " + str(st.get("arch")))
    target = int(addr or 0) or int(st.get("entry") or 0)
    if st["format"] == "ELF":
        off = _elf_vaddr2off(buf, target)
    else:
        # PE 的入口是 RVA; 前端传进来的可能是 RVA, 也可能是 imageBase+RVA
        rva = target
        if target >= st.get("image_base", 0) > 0:
            rva = target - st["image_base"]
        off = _pe_rva2off(st, rva)
        target = rva
    if off is None:
        raise ValueError("地址 %#x 不在任何可加载段内" % target)
    insns, unknown = x86.disasm(buf[off:off + 1024], target, max_bytes=1024, max_insn=int(count))
    return {"base": target, "count": len(insns), "unknown": unknown,
            "insns": [{"addr": i.addr, "bytes": i.raw.hex(), "text": i.text(),
                       "unknown": i.unknown} for i in insns]}


def _pe_rva2off(st, rva):
    for sec in st.get("sections", []):
        va = sec["vaddr"]
        span = max(sec["vsize"], sec["rawsize"])
        if va <= rva < va + span:
            return sec["rawptr"] + (rva - va)
    return None


def _elf_vaddr2off(buf, vaddr):
    try:
        is64 = buf[4] == 2
        le = buf[5] == 1
        rd = lambda o, n: int.from_bytes(buf[o:o + n], "little" if le else "big")
        if is64:
            phoff, phes, phnum = rd(32, 8), rd(54, 2), rd(56, 2)
        else:
            phoff, phes, phnum = rd(28, 4), rd(42, 2), rd(44, 2)
        for i in range(phnum):
            o = phoff + i * phes
            if rd(o, 4) != 1:
                continue
            if is64:
                off, va, fs = rd(o + 8, 8), rd(o + 16, 8), rd(o + 32, 8)
            else:
                off, va, fs = rd(o + 4, 4), rd(o + 8, 4), rd(o + 16, 4)
            if va <= vaddr < va + fs:
                return off + (vaddr - va)
    except Exception:
        pass
    return None


def strings(sample_id):
    row, buf = _load(sample_id)
    return classify_strings(buf)
