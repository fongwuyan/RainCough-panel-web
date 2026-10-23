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

# 单样本读取上限。APK 常见几十 MB(实测一个 67MB), 64MB 会卡住;
# 256MB 在几十 GB 内存的机器上安全, 再大就该用外部工具了。
MAX_READ = 256 * 1024 * 1024

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


# ══════════════════════════════════════════════════════ APK
#
# APK = zip + 二进制 AndroidManifest.xml(AXML) + 若干 dex。
# AXML 不是文本 XML, 是 Android 的二进制资源格式: 字符串池 + 带类型的属性。
# 纯标准库就能解: zipfile 读包, struct 走 chunk。

AXML_STR_POOL = 0x0001
AXML_START = 0x0102


def _axml_strings(buf, off, chunk_size, header_size):
    """解析字符串池 chunk。返回 (strings, 下一个 chunk 偏移)。"""
    try:
        count, _style_count, flags, str_start = struct.unpack_from("<IIII", buf, off + 8)
    except struct.error:
        return [], off + chunk_size
    utf8 = bool(flags & 0x100)
    offs = []
    base = off + header_size
    for i in range(min(count, 20000)):
        try:
            offs.append(struct.unpack_from("<I", buf, base + i * 4)[0])
        except struct.error:
            break
    data_base = off + str_start
    out = []
    for o in offs:
        p = data_base + o
        try:
            if utf8:
                # UTF-8: 字符数(1-2 字节) + 字节数(1-2 字节) + 数据
                n = buf[p]
                p += 1
                if n & 0x80:
                    p += 1
                m = buf[p]
                p += 1
                if m & 0x80:
                    m = ((m & 0x7F) << 8) | buf[p]
                    p += 1
                out.append(buf[p:p + m].decode("utf-8", "replace"))
            else:
                n = struct.unpack_from("<H", buf, p)[0]
                p += 2
                if n & 0x8000:
                    n = ((n & 0x7FFF) << 16) | struct.unpack_from("<H", buf, p)[0]
                    p += 2
                out.append(buf[p:p + n * 2].decode("utf-16-le", "replace"))
        except Exception:
            out.append("")
    return out, off + chunk_size


def _axml(buf):
    """解析二进制 AndroidManifest.xml → {"strings": [...], "elements": [(name, attrs)]}。"""
    if len(buf) < 8 or struct.unpack_from("<H", buf, 0)[0] != 0x0003:
        return None
    strings = []
    elements = []
    pos = struct.unpack_from("<H", buf, 2)[0]
    total = min(struct.unpack_from("<I", buf, 4)[0], len(buf))
    while pos + 8 <= total:
        ctype, hsize, csize = struct.unpack_from("<HHI", buf, pos)
        if csize <= 0 or pos + csize > total:
            break
        if ctype == AXML_STR_POOL:
            strings, _ = _axml_strings(buf, pos, csize, hsize)
        elif ctype == AXML_START:
            try:
                name_idx = struct.unpack_from("<I", buf, pos + 20)[0]
                attr_start, attr_size, attr_count = struct.unpack_from("<HHH", buf, pos + 24)
                attrs = {}
                # ★ attributeStart 是相对「节点头(16 字节)之后」的偏移, 不是相对 chunk 起点。
                #   按 pos 直接加会整体错位 16 字节 —— 结果是把属性**值**当成了属性名,
                #   解析出来变成 {"v0.1006-beta": "", "16": ""} 这种鬼东西。
                attr_base = pos + 16
                for i in range(attr_count):
                    a = attr_base + attr_start + i * attr_size
                    if a + 20 > pos + csize:
                        break
                    aname = struct.unpack_from("<I", buf, a + 4)[0]
                    raw = struct.unpack_from("<I", buf, a + 8)[0]
                    dtype = buf[a + 15]
                    data = struct.unpack_from("<I", buf, a + 16)[0]
                    key = strings[aname] if aname < len(strings) else ""
                    if raw != 0xFFFFFFFF and raw < len(strings):
                        val = strings[raw]
                    elif dtype == 0x03 and data < len(strings):
                        val = strings[data]
                    elif dtype == 0x12:                 # 布尔
                        val = "true" if data else "false"
                    elif dtype in (0x10, 0x11):         # 十进制 / 十六进制整数
                        val = str(data)
                    elif dtype == 0x01:                 # 资源引用
                        val = "@ref/0x%08x" % data
                    else:
                        val = ""
                    if key:
                        attrs[key] = val
                ename = strings[name_idx] if name_idx < len(strings) else ""
                if ename:
                    elements.append((ename, attrs))
            except Exception:
                pass
        pos += csize
    return {"strings": strings, "elements": elements}


def _dex_info(buf):
    """DEX 头: 版本、字符串数、类数、方法数。"""
    if buf[:4] != b"dex\n" or len(buf) < 112:
        return None
    return {
        "version": buf[4:7].decode("ascii", "replace"),
        "strings": int.from_bytes(buf[56:60], "little"),
        "types": int.from_bytes(buf[64:68], "little"),
        "protos": int.from_bytes(buf[72:76], "little"),
        "fields": int.from_bytes(buf[80:84], "little"),
        "methods": int.from_bytes(buf[88:92], "little"),
        "classes": int.from_bytes(buf[96:100], "little"),
    }


# ── 加固 / 壳特征 ──
#
# 思路: 加固厂商的 so 与 assets 文件名高度固定, 命中即可判断;
# 再用「dex 数量与体积」做交叉验证(壳通常把真实代码搬到 so 或加密的 dex 里)。
PACKERS = [
    ("360 加固", ["libjiagu.so", "libjiagu_art.so", "libjiagu_x86.so", "libjiagu_a64.so",
                 "libjiagu.so.x"]),
    ("腾讯乐固", ["libshella.so", "libshellx.so", "libshell-super", "libmixer.so",
                "libtosprotection"]),
    ("梆梆加固", ["libsecexe.so", "libsecmain.so", "libdexhelper.so", "libsecshell.so",
                "libsecexe.x86.so"]),
    ("爱加密", ["libexec.so", "libexecmain.so", "ijiami.dat", "ijiami.ajm", "libedog.so"]),
    ("阿里聚安全", ["libmobisec.so", "libsgmain.so", "libsgsecuritybody.so", "libfakejni.so"]),
    ("百度加固", ["libbaiduprotect.so", "libbaiduprotect_x86.so"]),
    ("网易易盾", ["libnesec.so", "libnemsfp.so"]),
    ("娜迦", ["libchaosvmp.so", "libddog.so", "libfdog.so", "libnagain.so"]),
    ("顶象", ["libx3g.so", "libx3g.so.1"]),
    ("腾讯御安全", ["libtosprotection.so", "libshell.so"]),
    ("通付盾", ["libegame.so", "libtup.so"]),
    ("几维安全", ["libkwscmm.so", "libkwscr.so"]),
]


def _packer_hints(names, dexes, abis):
    """按 so / assets 文件名匹配加固特征, 再用 dex 结构做旁证。"""
    low = [n.lower() for n in names]
    hits = []
    for vendor, sigs in PACKERS:
        matched = []
        for sig in sigs:
            for n in low:
                if sig in n:
                    matched.append(n)
                    break
        if matched:
            hits.append({"vendor": vendor, "evidence": matched[:3]})

    # 旁证: 只有一个很小的 dex, 但 so 体积很大 —— 真实代码被搬走了
    if dexes:
        total_dex = sum(d.get("size", 0) for d in dexes)
        so_size = sum(1 for _ in abis)  # 仅用于提示是否含 native
        if len(dexes) == 1 and total_dex < 1024 * 1024 and so_size:
            hits.append({"vendor": "疑似加固(结构特征)",
                         "evidence": ["仅 1 个 dex 且 < 1MB，但含 native 库"]})
    return hits


def _dex_classes(buf, limit=4000):
    """从 class_defs 取类名(Lcom/foo/Bar; → com.foo.Bar)。"""
    if buf[:4] != b"dex\n" or len(buf) < 112:
        return []
    n_str = int.from_bytes(buf[56:60], "little")
    str_off = int.from_bytes(buf[60:64], "little")
    n_type = int.from_bytes(buf[64:68], "little")
    type_off = int.from_bytes(buf[68:72], "little")
    n_cls = int.from_bytes(buf[96:100], "little")
    cls_off = int.from_bytes(buf[100:104], "little")
    if not (n_cls and cls_off and type_off and str_off):
        return []

    def string_at(i):
        if i >= n_str:
            return ""
        p = int.from_bytes(buf[str_off + i * 4:str_off + i * 4 + 4], "little")
        if p >= len(buf):
            return ""
        ln, shift, q = 0, 0, p
        while q < len(buf):
            b = buf[q]
            q += 1
            ln |= (b & 0x7F) << shift
            if not (b & 0x80):
                break
            shift += 7
            if shift > 28:
                break
        raw = buf[q:q + ln * 3 + 1]
        end = raw.find(b"\x00")
        if end >= 0:
            raw = raw[:end]
        return raw.decode("utf-8", "replace")

    out = []
    seen = set()
    for i in range(min(n_cls, limit)):
        p = cls_off + i * 32
        if p + 32 > len(buf):
            break
        type_idx = int.from_bytes(buf[p:p + 4], "little")
        if type_idx >= n_type:
            continue
        tp = type_off + type_idx * 4
        if tp + 4 > len(buf):
            continue
        str_idx = int.from_bytes(buf[tp:tp + 4], "little")
        name = string_at(str_idx)
        if not name.startswith("L") or not name.endswith(";"):
            continue
        name = name[1:-1].replace("/", ".")
        if name in seen:
            continue
        seen.add(name)
        out.append(name)
    return out


def _apk_libs(z, names, max_libs=24, max_bytes=64 * 1024 * 1024):
    """解析 APK 里的 .so（复用 ELF 解析器）。

    为什么要看 so: 加固、加密、反调试、网络协议经常只做在 native 层,
    dex 里反而干净。导入表能直接说明"这个库能干什么"。

    只取一个 ABI（优先 arm64-v8a）—— 各 ABI 的同一个库功能一样, 全解一遍纯属浪费。
    """
    libs = [n for n in names if n.startswith("lib/") and n.endswith(".so") and n.count("/") >= 2]
    if not libs:
        return [], {}
    by_abi = {}
    for n in libs:
        abi = n.split("/")[1]
        by_abi[abi] = by_abi.get(abi, 0) + 1
    prefer = "arm64-v8a" if "arm64-v8a" in by_abi else (
        "armeabi-v7a" if "armeabi-v7a" in by_abi else sorted(by_abi)[0])
    chosen = [n for n in libs if n.split("/")[1] == prefer]

    out = []
    total = 0
    for n in chosen[:max_libs]:
        try:
            size = z.getinfo(n).file_size
            if total + size > max_bytes:
                break
            data = z.read(n)
            total += len(data)
            st = _elf(data)
        except Exception:
            continue
        if not st:
            continue
        imps = st.get("imports") or []
        sus = suspicious(imps)
        out.append({
            "name": n.split("/")[-1],
            "path": n,
            "abi": prefer,
            "size": len(data),
            "arch": st.get("arch", ""),
            "bits": st.get("bits", 0),
            "imports": len(imps),
            "jni": "JNI_OnLoad" in imps or "JNI_OnLoad" in {x["name"] for x in st.get("exports", [])},
            "protections": st.get("protections", {}),
            "suspicious": sus[:6],
            "notes": st.get("notes", [])[:2],
        })
    out.sort(key=lambda x: -x["size"])
    summary = {
        "count": len(libs),
        "by_abi": by_abi,
        "analyzed": len(out),
        "abi": prefer,
        "suspicious_libs": [x["name"] for x in out if x["suspicious"]][:8],
    }
    return out, summary


def _apk(buf):
    if buf[:2] != b"PK":
        return None
    import io
    import zipfile
    try:
        z = zipfile.ZipFile(io.BytesIO(buf))
    except Exception:
        return None
    names = z.namelist()
    if "AndroidManifest.xml" not in names:
        return None

    out = {
        "format": "APK", "bits": 0, "arch": "Android", "type": "安装包",
        "entry": 0, "sections": [], "imports": [], "exports": [],
        "protections": {}, "notes": [], "apk": {},
    }

    pkg = ver_name = ver_code = ""
    min_sdk = target_sdk = ""
    perms = []
    comps = {"activity": [], "activity-alias": [], "service": [],
             "receiver": [], "provider": []}
    flags = {}
    try:
        man = _axml(z.read("AndroidManifest.xml"))
    except Exception:
        man = None
    if man:
        for ename, attrs in man["elements"]:
            if ename == "manifest":
                pkg = attrs.get("package", "")
                ver_name = attrs.get("versionName", "")
                ver_code = attrs.get("versionCode", "")
            elif ename in ("uses-permission", "uses-permission-sdk-23"):
                n = attrs.get("name", "")
                if n:
                    perms.append(n[len("android.permission."):]
                                 if n.startswith("android.permission.") else n)
            elif ename == "application":
                flags = {
                    "debuggable": attrs.get("debuggable", "false"),
                    "allowBackup": attrs.get("allowBackup", "true"),
                    "usesCleartextTraffic": attrs.get("usesCleartextTraffic", ""),
                    "networkSecurityConfig": "有" if attrs.get("networkSecurityConfig") else "无",
                }
            elif ename in comps:
                n = attrs.get("name", "")
                if n:
                    comps[ename].append(n)
            elif ename == "uses-sdk":
                min_sdk = attrs.get("minSdkVersion", "")
                target_sdk = attrs.get("targetSdkVersion", "")

    dexes = []
    for n in names:
        if n.endswith(".dex") and "/" not in n:
            try:
                info = _dex_info(z.read(n)) or {}
            except Exception:
                info = {}
            dexes.append(dict({"name": n, "size": z.getinfo(n).file_size}, **info))
    dexes.sort(key=lambda x: -x["size"])

    abis = sorted({n.split("/")[1] for n in names
                   if n.startswith("lib/") and n.count("/") >= 2})
    sigs = [n for n in names if n.startswith("META-INF/")
            and n.upper().endswith((".RSA", ".DSA", ".EC", ".SF"))]
    # v2/v3 签名块紧挨在中央目录之前, 不在文件尾部 —— 先定位 EOCD 拿到 CD 偏移
    v2 = False
    try:
        eocd = buf.rfind(b"PK\x05\x06", max(0, len(buf) - 65558))
        if eocd > 0:
            cd_off = struct.unpack_from("<I", buf, eocd + 16)[0]
            lo = max(0, cd_off - 262144)
            v2 = b"APK Sig Block 42" in buf[lo:cd_off + 8]
    except Exception:
        v2 = b"APK Sig Block 42" in buf[-262144:]

    packers = _packer_hints(names, dexes, abis)
    libs, lib_summary = _apk_libs(z, names)
    # 扫全部 dex 收类名。多 dex 时应用自身的类不一定在 classes.dex 里,
    # 只扫前两个会得出"应用自身类 0 个"的错误结论。
    classes = []
    try:
        for d in dexes:
            if len(classes) >= 20000:
                break
            classes.extend(_dex_classes(z.read(d["name"]), 4000))
    except Exception:
        pass
    classes = list(dict.fromkeys(classes))
    # 去掉编译器生成的 synthetic lambda —— 一个 Compose 页面能生成几十个,
    # 全列出来会淹没真正的业务类。
    classes = [c for c in classes
               if "$$ExternalSyntheticLambda" not in c and "-$$Lambda$" not in c]
    # 按「外层类」聚合: Kotlin 的 lambda 会编译成 Outer$1$1$2 这类内部类,
    # 一个 Compose 页面能出上百个。列外层类才看得出结构, 内部类数量单独给。
    inner_total = len(classes)
    outer = []
    for c in classes:
        i = c.find("$")
        outer.append(c[:i] if i > 0 else c)
    classes = list(dict.fromkeys(outer))
    # 应用自身的类排前面 —— 分析 APK 时最先想看的是"它自己写了什么"
    own_prefix = (pkg + ".") if pkg else None
    own = [c for c in classes if own_prefix and (c == pkg or c.startswith(own_prefix))]
    rest = [c for c in classes if c not in set(own)]
    classes = own + rest

    out["apk"] = {
        "package": pkg, "versionName": ver_name, "versionCode": ver_code,
        "packers": packers, "libs": libs, "lib_summary": lib_summary,
        "classes": classes[:1200],
        "class_count": len(classes), "own_class_count": len(own),
        "class_total": inner_total,
        "permissions": perms[:80],
        "components": {k: v[:40] for k, v in comps.items() if v},
        "flags": flags, "dex": dexes[:20], "dex_count": len(dexes),
        "minSdk": min_sdk, "targetSdk": target_sdk,
        "abis": abis, "v1_sign": bool(sigs), "v2_sign": v2,
        "entries": len(names),
    }
    out["protections"] = {
        "可调试": flags.get("debuggable", "false") == "true",
        "允许备份": flags.get("allowBackup", "true") == "true",
        "明文流量": flags.get("usesCleartextTraffic", "") == "true",
        "v1 签名": bool(sigs),
        "v2/v3 签名": v2,
    }
    if flags.get("debuggable") == "true":
        out["notes"].append("android:debuggable=true —— 可被 jdbs 附加调试, 生产包不应开启")
    if flags.get("allowBackup") == "true":
        out["notes"].append("allowBackup=true —— adb backup 可导出应用私有数据")
    if flags.get("usesCleartextTraffic") == "true":
        out["notes"].append("usesCleartextTraffic=true —— 允许 HTTP 明文流量")
    if not v2:
        out["notes"].append("未检出 v2/v3 签名块, 只有 v1 签名(整包易被篡改)")
    if len(dexes) > 1:
        out["notes"].append("多 dex(%d 个) —— multidex 或大量依赖" % len(dexes))
    for h in packers:
        out["notes"].append("命中加固特征: %s（%s）" % (h["vendor"], "、".join(h["evidence"])))
    sus_libs = (lib_summary or {}).get("suspicious_libs") or []
    if sus_libs:
        out["notes"].append("native 库含敏感能力: " + "、".join(sus_libs[:4])
                            + "（看「so」页的导入明细）")
    return out


# ══════════════════════════════════════════════════════ 通用

def parse(buf):
    """识别并解析。返回结构 dict, 不支持则 None。"""
    for fn in (_elf, _pe, _apk):
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


def classify_texts(txt, limit=300):
    """把一批字符串按用途分类 —— 比"一坨可打印字符"有用得多。"""
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


def classify_strings(buf, limit=300):
    """从原始字节里抽可打印串再分类(ELF/PE 用)。"""
    txt = []
    for m in re.finditer(rb"[\x20-\x7e]{5,}", buf[:4 << 20]):
        txt.append(m.group().decode("ascii", "ignore"))
        if len(txt) >= 20000:
            break
    return classify_texts(txt, limit)


def _dex_strings(buf, limit=200000):
    """解 DEX 的字符串池。

    ★ APK 里的 dex 在 zip 里是压缩的, 直接扫原始字节只能扫到压缩数据 ——
      必须解压 + 走 string_ids 表, 才能拿到"这个 App 里到底有哪些 URL/域名"。
    """
    if buf[:4] != b"dex\n" or len(buf) < 112:
        return []
    n = int.from_bytes(buf[56:60], "little")
    off = int.from_bytes(buf[60:64], "little")
    out = []
    for i in range(min(n, limit)):
        p0 = off + i * 4
        if p0 + 4 > len(buf):
            break
        p = int.from_bytes(buf[p0:p0 + 4], "little")
        if p >= len(buf):
            continue
        # string_data_item: uleb128 长度(UTF-16 码元数) + MUTF-8 字节 + 0x00
        ln, shift, q = 0, 0, p
        try:
            while q < len(buf):
                b = buf[q]
                q += 1
                ln |= (b & 0x7F) << shift
                if not (b & 0x80):
                    break
                shift += 7
                if shift > 28:
                    break
            raw = buf[q:q + ln * 3 + 1]
            end = raw.find(b"\x00")
            if end >= 0:
                raw = raw[:end]
            out.append(raw.decode("utf-8", "replace"))
        except Exception:
            continue
    return out


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


def open_path(task_id, path):
    """直接读服务器上的文件(大样本用)。路径由使用者自己填, 不做沙箱 —— 这是自建面板。"""
    import time as _t
    p = (path or "").strip()
    if not p:
        raise ValueError("请填写文件路径")
    if not os.path.isfile(p):
        raise ValueError("文件不存在: " + p)
    size = os.path.getsize(p)
    if size > MAX_READ:
        raise ValueError("文件超过 %d MB" % (MAX_READ // 1024 // 1024))
    with open(p, "rb") as f:
        buf = f.read(MAX_READ)
    st = parse(buf)
    if not st:
        raise ValueError("无法识别的格式(支持 ELF / PE / APK)")
    kind = st.get("format") or "未知"
    meta = {"format": kind, "size": size, "src": p,
            "sha256": hashlib.sha256(buf).hexdigest(),
            "md5": hashlib.md5(buf).hexdigest()}
    aid = store.artifact_add(int(task_id or 0), os.path.basename(p),
                             "样本·" + kind, json.dumps(meta), p)
    full = _enrich(st, buf)
    full["filename"] = os.path.basename(p)
    return {"sample_id": aid, "filename": os.path.basename(p), "kind": kind,
            "size": size, "info": full}


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
    st = parse(buf)
    if st and st.get("format") == "APK":
        import io
        import zipfile
        try:
            z = zipfile.ZipFile(io.BytesIO(buf))
            dexes = sorted([n for n in z.namelist() if n.endswith(".dex") and "/" not in n],
                           key=lambda n: -z.getinfo(n).file_size)[:4]
            texts = []
            for n in dexes:
                texts.extend(_dex_strings(z.read(n), 120000))
            if texts:
                return classify_texts(texts[:400000])
        except Exception:
            pass
    return classify_strings(buf)
