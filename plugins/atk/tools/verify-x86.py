#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""自研反汇编器对照验证（开发期工具，插件运行时不依赖 objdump）。

用法:  python3 tools/verify-x86.py [ELF 路径...]
默认跑 /bin/ls /bin/cat /bin/bash /usr/bin/python3 /usr/bin/grep /bin/systemctl /usr/bin/ssh

比较四件事:
  1. 指令地址      —— 我解出的流是否与 objdump 同步(错位会立刻暴露)
  2. 指令长度      —— 字节消费是否正确
  3. 助记符        —— 解码表是否正确
  4. 跳转目标      —— rel8/rel32 的符号处理是否正确

★ 长度不能用 objdump 的字节列算: 它每行最多显示 7 个字节, 第 8 个字节折到下一行,
  照字节列数会系统性偏小。必须用「下一条指令地址 - 本条地址」。
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.dirname(HERE)
sys.path.insert(0, PLUGIN)

from core import x86  # noqa: E402

PREFIXES = {"cs", "ds", "es", "ss", "fs", "gs", "data16", "data32", "addr32",
            "rex.W", "rex.R", "rex.X", "rex.B", "lock", "repz", "repnz", "rep",
            "bnd", "notrack"}


def norm(mnem):
    toks = mnem.replace("\t", " ").split()
    while toks and toks[0] in PREFIXES:
        toks.pop(0)
    return toks[0] if toks else ""


def objdump_rows(path, addr, size):
    out = subprocess.run(
        ["objdump", "-d", "-M", "intel", "--start-address=%d" % addr,
         "--stop-address=%d" % (addr + size), path],
        capture_output=True, text=True).stdout
    raw = []
    for line in out.splitlines():
        m = re.match(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2}\s)+)\s*(.*)$", line)
        if not m:
            continue
        rest = m.group(3).strip()
        if not rest:
            continue
        raw.append((int(m.group(1), 16), rest))

    rows = []
    for i, (a, rest) in enumerate(raw):
        if i + 1 >= len(raw):
            continue
        ln = raw[i + 1][0] - a
        if rest.split()[0] in (".byte", "(bad)", ".word", ".long"):
            continue
        mnem = norm(rest)
        tgt = None
        if mnem.startswith("j") or mnem in ("call", "loop", "jrcxz"):
            mm = re.search(r"\b([0-9a-f]{4,16})\b", rest)
            if mm:
                tgt = int(mm.group(1), 16)
        rows.append((a, ln, mnem, tgt))
    return rows


def elf_entry(path):
    b = open(path, "rb").read()
    is64 = b[4] == 2
    le = b[5] == 1
    rd = lambda o, n: int.from_bytes(b[o:o + n], "little" if le else "big")
    if is64:
        entry, phoff, phes, phnum = rd(24, 8), rd(32, 8), rd(54, 2), rd(56, 2)
    else:
        entry, phoff, phes, phnum = rd(24, 4), rd(28, 4), rd(42, 2), rd(44, 2)
    for i in range(phnum):
        o = phoff + i * phes
        if rd(o, 4) != 1:
            continue
        if is64:
            off, vaddr, filesz = rd(o + 8, 8), rd(o + 16, 8), rd(o + 32, 8)
        else:
            off, vaddr, filesz = rd(o + 4, 4), rd(o + 8, 4), rd(o + 16, 4)
        if vaddr <= entry < vaddr + filesz:
            return b, entry, off + (entry - vaddr)
    return b, entry, None


def check(path):
    buf, entry, off = elf_entry(path)
    if off is None:
        print("  跳过 %s(entry 不在 PT_LOAD)" % path)
        return
    ref = objdump_rows(path, entry, 768)
    if not ref:
        print("  跳过 %s(objdump 无可比数据)" % path)
        return
    refmap = {a: (l, m, t) for a, l, m, t in ref}
    limit = max(a for a, _, _, _ in ref)
    pos, addr = off, entry
    ok = bad = unknown = 0
    details, unknowns = [], []
    while addr <= limit:
        ins = x86.decode_one(buf, pos, addr)
        if ins is None:
            break
        if addr in refmap:
            rl, rm, rt = refmap[addr]
            mine_t = None
            if (ins.mnem.startswith("j") or ins.mnem == "call") and ins.ops:
                try:
                    mine_t = int(ins.ops[-1], 16)
                except Exception:
                    mine_t = None
            tgt_ok = (rt is None) or (mine_t is None) or (mine_t == rt)
            if ins.unknown:
                unknown += 1
                unknowns.append((addr, ins.raw.hex(), rm))
            elif rl == ins.length and norm(ins.mnem) == rm and tgt_ok:
                ok += 1
            else:
                bad += 1
                if len(details) < 6:
                    details.append("    %#x  我: len=%d %-9s tgt=%s | objdump: len=%d %s tgt=%s" % (
                        addr, ins.length, ins.mnem,
                        hex(mine_t) if mine_t is not None else "-",
                        rl, rm, hex(rt) if rt else "-"))
        pos += ins.length
        addr += ins.length

    total = ok + bad + unknown
    pct = ok * 100.0 / total if total else 0
    print("  %-14s 可比 %3d → 一致 %3d (%.1f%%) · 错 %d · 未覆盖 %d" % (
        os.path.basename(path), total, ok, pct, bad, unknown))
    for d in details:
        print(d)
    if unknowns:
        seen = {}
        for a, raw, m in unknowns:
            seen.setdefault((raw[:2], m), 0)
            seen[(raw[:2], m)] += 1
        top = sorted(seen.items(), key=lambda x: -x[1])[:6]
        print("    未覆盖样例: " + ", ".join("%s(%s)×%d" % (k[0], k[1], v) for k, v in top))


if __name__ == "__main__":
    print("=== 自研反汇编 vs objdump -M intel ===")
    paths = sys.argv[1:] or ["/bin/ls", "/bin/cat", "/bin/bash", "/usr/bin/python3",
                             "/usr/bin/grep", "/bin/systemctl", "/usr/bin/ssh"]
    for p in paths:
        if os.path.isfile(p):
            try:
                check(p)
            except Exception as e:
                print("  %s 失败: %r" % (p, e))
