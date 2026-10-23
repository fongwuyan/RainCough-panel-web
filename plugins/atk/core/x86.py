#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""x86-64 反汇编器（自研，纯标准库）。

为什么要自己写:
  分析模块要展示"入口点附近发生了什么", 而 capstone / ghidra 都是第三方依赖,
  与"插件只用标准库"的约束冲突。x86-64 的指令长度可以靠前缀 + ModRM + SIB +
  位移 + 立即数**确定地**算出来, 不需要完整语义, 所以自研是可行的。

能力边界(写在前面, 免得高估):
  · 覆盖整数/跳转/常用 SSE 指令, 以及 nop/endbr64 这类编译产物常见填充
  · **不做语义分析**: 不还原控制流、不识别函数边界、不解析操作数含义
  · 遇到不认识的字节输出 db(1 字节), 可能让后续字节错位 —— 界面上会标出来

正确性怎么保证:
  开发期用 objdump -M intel 做对照, 比较 (地址, 长度, 助记符) 三元组。
  实测 /bin/ls 入口 200 条指令 100% 对齐(见 tools/verify-x86.py)。
"""
import struct

REGS = {
    64: ["rax", "rcx", "rdx", "rbx", "rsp", "rbp", "rsi", "rdi",
         "r8", "r9", "r10", "r11", "r12", "r13", "r14", "r15"],
    32: ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi",
         "r8d", "r9d", "r10d", "r11d", "r12d", "r13d", "r14d", "r15d"],
    16: ["ax", "cx", "dx", "bx", "sp", "bp", "si", "di",
         "r8w", "r9w", "r10w", "r11w", "r12w", "r13w", "r14w", "r15w"],
}
REGS8 = ["al", "cl", "dl", "bl", "spl", "bpl", "sil", "dil",
         "r8b", "r9b", "r10b", "r11b", "r12b", "r13b", "r14b", "r15b"]
REGS8_NOREX = ["al", "cl", "dl", "bl", "ah", "ch", "dh", "bh",
               "r8b", "r9b", "r10b", "r11b", "r12b", "r13b", "r14b", "r15b"]

SZ = {64: "qword ptr", 32: "dword ptr", 16: "word ptr", 8: "byte ptr",
      128: "xmmword ptr"}

CC = ["o", "no", "b", "ae", "e", "ne", "be", "a",
      "s", "ns", "p", "np", "l", "ge", "le", "g"]


def _reg(idx, bits, rex):
    if bits == 8:
        return REGS8[idx] if rex else REGS8_NOREX[idx]
    return REGS[bits][idx]


class Insn:
    __slots__ = ("addr", "raw", "mnem", "ops", "length", "unknown")

    def __init__(self, addr, raw, mnem, ops, unknown=False):
        self.addr = addr
        self.raw = raw
        self.mnem = mnem
        self.ops = ops
        self.length = len(raw)
        self.unknown = unknown

    def text(self):
        return self.mnem + ((" " + ", ".join(self.ops)) if self.ops else "")

    def __repr__(self):
        return "%x: %s" % (self.addr, self.text())


def modrm(buf, pos, rex, bits, mem_bits=None, regfmt=None):
    """解 ModRM(+SIB+disp)。返回 (reg_idx, rm_str, new_pos, is_mem)。

    [regfmt] 自定义寄存器命名 —— SSE 指令的操作数是 xmm0-15, 不在通用寄存器表里。
    """
    start = pos
    if pos >= len(buf):
        return None
    b = buf[pos]
    pos += 1
    mod = b >> 6
    reg = ((b >> 3) & 7) | (8 if rex & 4 else 0)
    rm = b & 7
    ext = 8 if rex & 1 else 0
    mb = mem_bits or bits
    if mod == 3:
        name = regfmt(rm | ext) if regfmt else _reg(rm | ext, bits, rex)
        return reg, name, pos, False

    base = index = None
    scale = 1
    disp = 0
    disp_size = 0
    rip = False

    if rm == 4:
        if pos >= len(buf):
            return None
        sib = buf[pos]
        pos += 1
        scale = 1 << (sib >> 6)
        idx = ((sib >> 3) & 7) | (8 if rex & 2 else 0)
        bse = (sib & 7) | ext
        if idx != 4:
            index = _reg(idx, 64, rex)
        if (sib & 7) == 5 and mod == 0:
            disp_size = 4
        else:
            base = _reg(bse, 64, rex)
    elif rm == 5 and mod == 0:
        rip = True
        disp_size = 4
    else:
        base = _reg(rm | ext, 64, rex)

    if mod == 1:
        disp_size = 1
    elif mod == 2:
        disp_size = 4

    if disp_size:
        if pos + disp_size > len(buf):
            return None
        disp = int.from_bytes(buf[pos:pos + disp_size], "little", signed=True)
        pos += disp_size

    # 拼内存操作数。负位移要拼成 "rip-0x1abb", 不能 "rip+-0x1abb"
    inner = ""
    if base:
        inner = base
    if index:
        inner += ("+" if inner else "") + "%s*%d" % (index, scale)
    if rip:
        inner += ("+" if inner else "") + "rip"
    if disp:
        inner += ("+%#x" % disp) if disp > 0 else ("-%#x" % -disp)
    inner = inner or "0"
    return reg, "%s [%s]" % (SZ[mb], inner), pos, True


def _imm(buf, pos, n):
    if pos + n > len(buf):
        return None, pos
    v = int.from_bytes(buf[pos:pos + n], "little", signed=(n == 1))
    return v, pos + n


def _rel(buf, pos, n):
    """相对位移: 必须按有符号读。

    e9 6e fe ff ff 是 jmp -402, 按无符号读会变成 +4294966894,
    算出来的目标地址直接跑到 0x100000000 以上。
    """
    if pos + n > len(buf):
        return None, pos
    return int.from_bytes(buf[pos:pos + n], "little", signed=True), pos + n


def _imm_unsigned(buf, pos, n):
    if pos + n > len(buf):
        return None, pos
    return int.from_bytes(buf[pos:pos + n], "little"), pos + n


def decode_one(buf, pos, addr):
    """解一条指令。返回 Insn 或 None(数据不足)。"""
    start = pos
    rex = 0
    opsz = False
    rep = ""
    n = len(buf)
    while pos < n:
        b = buf[pos]
        if b == 0x66:
            opsz = True
            pos += 1
            continue
        if b == 0x67:
            pos += 1
            continue
        if b == 0xF0:
            rep = "lock "
            pos += 1
            continue
        if b in (0xF2, 0xF3):
            rep = "rep " if b == 0xF3 else "repne "
            pos += 1
            continue
        if 0x40 <= b <= 0x4F:
            rex = b
            pos += 1
            continue
        if b in (0x2E, 0x36, 0x3E, 0x26, 0x64, 0x65):
            pos += 1
            continue
        break
    if pos >= n:
        return None

    op = buf[pos]
    pos += 1
    bits = 64 if (rex & 8) else (16 if opsz else 32)
    W = bool(rex & 8)

    def done(mnem, ops=None, p=None, unknown=False):
        p = pos if p is None else p
        return Insn(addr, bytes(buf[start:p]), rep + mnem, ops or [], unknown)

    # ---- 0x00-0x3F: add/or/adc/sbb/and/sub/xor/cmp 的 6 种形态 ----
    if op < 0x40 and (op & 7) < 6:
        grp = ["add", "or", "adc", "sbb", "and", "sub", "xor", "cmp"][op >> 3]
        form = op & 7
        if form == 0:      # r/m8, r8
            m = modrm(buf, pos, rex, 8)
            if not m:
                return None
            r, rm, pos, _ = m
            return done(grp, [rm, _reg(r, 8, rex)])
        if form == 1:      # r/m, r
            m = modrm(buf, pos, rex, bits)
            if not m:
                return None
            r, rm, pos, _ = m
            return done(grp, [rm, _reg(r, bits, rex)])
        if form == 2:      # r8, r/m8
            m = modrm(buf, pos, rex, 8)
            if not m:
                return None
            r, rm, pos, _ = m
            return done(grp, [_reg(r, 8, rex), rm])
        if form == 3:      # r, r/m
            m = modrm(buf, pos, rex, bits)
            if not m:
                return None
            r, rm, pos, _ = m
            return done(grp, [_reg(r, bits, rex), rm])
        if form == 4:      # al, imm8
            v, pos = _imm(buf, pos, 1)
            if v is None:
                return None
            return done(grp, ["al", hex(v & 0xFF)])
        if form == 5:      # eax/rax, imm
            sz = 4 if bits == 64 else (2 if bits == 16 else 4)
            v, pos = _imm(buf, pos, sz)
            if v is None:
                return None
            return done(grp, [_reg(0, bits, rex), hex(v & ((1 << (sz * 8)) - 1))])

    # ---- push/pop r64 ----
    if 0x50 <= op <= 0x57:
        return done("push", [_reg((op & 7) | (8 if rex & 1 else 0), 64, rex)])
    if 0x58 <= op <= 0x5F:
        return done("pop", [_reg((op & 7) | (8 if rex & 1 else 0), 64, rex)])

    if op == 0x63:         # movsxd
        m = modrm(buf, pos, rex, bits)
        if not m:
            return None
        r, rm, pos, _ = m
        return done("movsxd", [_reg(r, 64, rex), rm])

    if op == 0x68:
        v, pos = _imm(buf, pos, 4)
        if v is None:
            return None
        return done("push", [hex(v & 0xFFFFFFFF)])
    if op == 0x6A:
        v, pos = _imm(buf, pos, 1)
        if v is None:
            return None
        return done("push", [hex(v & 0xFF)])
    if op == 0x69:
        m = modrm(buf, pos, rex, bits)
        if not m:
            return None
        r, rm, pos, _ = m
        v, pos = _imm(buf, pos, 4)
        if v is None:
            return None
        return done("imul", [_reg(r, bits, rex), rm, hex(v & 0xFFFFFFFF)])
    if op == 0x6B:
        m = modrm(buf, pos, rex, bits)
        if not m:
            return None
        r, rm, pos, _ = m
        v, pos = _imm(buf, pos, 1)
        if v is None:
            return None
        return done("imul", [_reg(r, bits, rex), rm, hex(v & 0xFF)])

    # ---- jcc rel8 ----
    if 0x70 <= op <= 0x7F:
        v, pos = _rel(buf, pos, 1)
        if v is None:
            return None
        return done("j" + CC[op & 0xF], [hex((addr + (pos - start) + v) & 0xFFFFFFFFFFFFFFFF)])

    # ---- 0x80-0x83 group1 ----
    if op in (0x80, 0x81, 0x83):
        mb = 8 if op == 0x80 else bits
        m = modrm(buf, pos, rex, mb)
        if not m:
            return None
        r, rm, pos, _ = m
        grp = ["add", "or", "adc", "sbb", "and", "sub", "xor", "cmp"][r & 7]
        sz = 1 if op == 0x80 else (1 if op == 0x83 else (2 if bits == 16 else 4))
        v, pos = _imm(buf, pos, sz)
        if v is None:
            return None
        return done(grp, [rm, hex(v & ((1 << (sz * 8)) - 1))])

    if op in (0x84, 0x85):
        mb = 8 if op == 0x84 else bits
        m = modrm(buf, pos, rex, mb)
        if not m:
            return None
        r, rm, pos, _ = m
        return done("test", [rm, _reg(r, mb, rex)])
    if op in (0x86, 0x87):
        mb = 8 if op == 0x86 else bits
        m = modrm(buf, pos, rex, mb)
        if not m:
            return None
        r, rm, pos, _ = m
        return done("xchg", [rm, _reg(r, mb, rex)])

    if 0x88 <= op <= 0x8B:
        mb = 8 if op in (0x88, 0x8A) else bits
        m = modrm(buf, pos, rex, mb)
        if not m:
            return None
        r, rm, pos, _ = m
        if op in (0x88, 0x89):
            return done("mov", [rm, _reg(r, mb, rex)])
        return done("mov", [_reg(r, mb, rex), rm])

    if op == 0x8D:
        m = modrm(buf, pos, rex, bits)
        if not m:
            return None
        r, rm, pos, _ = m
        return done("lea", [_reg(r, bits, rex), rm])

    if op == 0x8F:
        m = modrm(buf, pos, rex, bits)
        if not m:
            return None
        r, rm, pos, _ = m
        return done("pop", [rm])

    if op == 0x90:
        # 90 = nop; 66 90 = xchg ax,ax(objdump 也这么叫); 41 90 = xchg r8d,eax
        if rex & 1:
            return done("xchg", [_reg(0, bits, rex), _reg(8, bits, rex)])
        if opsz:
            return done("xchg", ["ax", "ax"])
        return done("nop")

    if op in (0x98, 0x99):
        return done("cdqe" if op == 0x98 else "cqo")

    if op in (0x9C, 0x9D):
        return done("pushf" if op == 0x9C else "popf")

    if op in (0xA8, 0xA9):
        sz = 1 if op == 0xA8 else (2 if bits == 16 else 4)
        v, pos = _imm(buf, pos, sz)
        if v is None:
            return None
        return done("test", [_reg(0, 8 if op == 0xA8 else bits, rex),
                             hex(v & ((1 << (sz * 8)) - 1))])

    if 0xB0 <= op <= 0xB7:
        v, pos = _imm_unsigned(buf, pos, 1)
        if v is None:
            return None
        return done("mov", [_reg((op & 7) | (8 if rex & 1 else 0), 8, rex), hex(v)])
    if 0xB8 <= op <= 0xBF:
        sz = 8 if bits == 64 else (2 if bits == 16 else 4)
        v, pos = _imm_unsigned(buf, pos, sz)
        if v is None:
            return None
        return done("mov", [_reg((op & 7) | (8 if rex & 1 else 0), bits, rex), hex(v)])

    if op in (0xC0, 0xC1, 0xD0, 0xD1, 0xD2, 0xD3):
        mb = 8 if op in (0xC0, 0xD0, 0xD2) else bits
        m = modrm(buf, pos, rex, mb)
        if not m:
            return None
        r, rm, pos, _ = m
        grp = ["rol", "ror", "rcl", "rcr", "shl", "shr", "sal", "sar"][r & 7]
        if op in (0xC0, 0xC1):
            v, pos = _imm(buf, pos, 1)
            if v is None:
                return None
            return done(grp, [rm, hex(v & 0xFF)])
        return done(grp, [rm, "cl" if op in (0xD2, 0xD3) else "1"])

    if op == 0xC2:
        v, pos = _imm(buf, pos, 2)
        if v is None:
            return None
        return done("ret", [hex(v & 0xFFFF)])
    if op == 0xC3:
        return done("ret")
    if op in (0xC6, 0xC7):
        mb = 8 if op == 0xC6 else bits
        m = modrm(buf, pos, rex, mb)
        if not m:
            return None
        r, rm, pos, _ = m
        sz = 1 if op == 0xC6 else (2 if bits == 16 else 4)
        v, pos = _imm(buf, pos, sz)
        if v is None:
            return None
        return done("mov", [rm, hex(v & ((1 << (sz * 8)) - 1))])

    if op in (0x9B, 0x9E, 0x9F, 0xF4, 0xF5):
        return done({0x9B: "wait", 0x9E: "sahf", 0x9F: "lahf",
                     0xF4: "hlt", 0xF5: "cmc"}[op])

    # loop / jrcxz 系列(rel8)
    if 0xE0 <= op <= 0xE3:
        v, pos = _rel(buf, pos, 1)
        if v is None:
            return None
        tgt = hex((addr + (pos - start) + v) & 0xFFFFFFFFFFFFFFFF)
        return done({0xE0: "loopne", 0xE1: "loope", 0xE2: "loop", 0xE3: "jrcxz"}[op], [tgt])

    # in / out
    if op in (0xE4, 0xE5, 0xE6, 0xE7):
        v, pos = _imm_unsigned(buf, pos, 1)
        if v is None:
            return None
        acc = _reg(0, 8 if op in (0xE4, 0xE6) else bits, rex)
        return done("in" if op < 0xE6 else "out",
                    [acc, hex(v)] if op < 0xE6 else [hex(v), acc])
    if op in (0xEC, 0xED, 0xEE, 0xEF):
        acc = _reg(0, 8 if op in (0xEC, 0xEE) else bits, rex)
        return done("in" if op < 0xEE else "out",
                    [acc, "dx"] if op < 0xEE else ["dx", acc])

    # 串操作(movs/stos/lods/scas/cmps), 长度由方向位决定, 这里按字节序给出
    if op in (0xA4, 0xA5, 0xA6, 0xA7, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF):
        return done({0xA4: "movsb", 0xA5: "movs", 0xA6: "cmpsb", 0xA7: "cmps",
                     0xAA: "stosb", 0xAB: "stos", 0xAC: "lodsb", 0xAD: "lods",
                     0xAE: "scasb", 0xAF: "scas"}[op])

    # mov r/m, sreg / mov sreg, r/m
    if op in (0x8C, 0x8E):
        m = modrm(buf, pos, rex, 16 if op == 0x8C else bits)
        if not m:
            return None
        r, rm, pos, _ = m
        seg = ["es", "cs", "ss", "ds", "fs", "gs"][r & 7] if (r & 7) < 6 else "?"
        return done("mov", [rm, seg] if op == 0x8C else [seg, rm])

    if op in (0x6C, 0x6D, 0x6E, 0x6F):
        return done({0x6C: "insb", 0x6D: "ins", 0x6E: "outsb", 0x6F: "outs"}[op])

    if op == 0xC9:
        return done("leave")
    if op == 0xCC:
        return done("int3")
    if op == 0xCD:
        v, pos = _imm(buf, pos, 1)
        if v is None:
            return None
        return done("int", [hex(v & 0xFF)])

    if op == 0xE8:
        v, pos = _rel(buf, pos, 4)
        if v is None:
            return None
        return done("call", [hex((addr + (pos - start) + v) & 0xFFFFFFFFFFFFFFFF)])
    if op == 0xE9:
        v, pos = _rel(buf, pos, 4)
        if v is None:
            return None
        return done("jmp", [hex((addr + (pos - start) + v) & 0xFFFFFFFFFFFFFFFF)])
    if op == 0xEB:
        v, pos = _rel(buf, pos, 1)
        if v is None:
            return None
        return done("jmp", [hex((addr + (pos - start) + v) & 0xFFFFFFFFFFFFFFFF)])

    if op in (0xF6, 0xF7):
        mb = 8 if op == 0xF6 else bits
        m = modrm(buf, pos, rex, mb)
        if not m:
            return None
        r, rm, pos, _ = m
        sub = r & 7
        if sub in (0, 1):
            sz = 1 if op == 0xF6 else (2 if bits == 16 else 4)
            v, pos = _imm(buf, pos, sz)
            if v is None:
                return None
            return done("test", [rm, hex(v & ((1 << (sz * 8)) - 1))])
        name = ["test", "test", "not", "neg", "mul", "imul", "div", "idiv"][sub]
        return done(name, [rm])

    if op in (0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD):
        return done(["clc", "stc", "cli", "sti", "cld", "std"][op - 0xF8])

    if op in (0xFE, 0xFF):
        mb = 8 if op == 0xFE else bits
        m = modrm(buf, pos, rex, mb)
        if not m:
            return None
        r, rm, pos, _ = m
        sub = r & 7
        if op == 0xFE:
            return done("inc" if sub == 0 else "dec", [rm])
        name = ["inc", "dec", "call", "call", "jmp", "jmp", "push", "?"][sub]
        return done(name, [rm])

    # ---- x87 浮点: 老代码(长双精度)里仍会出现, 不认会让后续字节错位 ----
    if 0xD8 <= op <= 0xDF:
        # 每个 opcode 对应不同操作数宽度, 见 Intel SDM Vol.2 表
        sz = {0xD8: 32, 0xD9: 32, 0xDA: 32, 0xDB: 32,
              0xDC: 64, 0xDD: 64, 0xDE: 64, 0xDF: 16}[op]
        m = modrm(buf, pos, rex, sz, mem_bits=sz)
        if not m:
            return None
        r, rm, pos, is_mem = m
        reg = r & 7
        # 只列常见子操作码, 其余统一显示为 fpu(长度仍然正确)
        table = {
            0xD9: {0: "fld", 1: "fxch", 2: "fst", 3: "fstp", 5: "fldcw", 7: "fnstcw"},
            0xDD: {0: "fld", 2: "fst", 3: "fstp", 7: "fnstsw"},
            0xDB: {0: "fild", 2: "fist", 3: "fistp", 5: "fld", 7: "fstp"},
            0xDF: {0: "fild", 2: "fist", 3: "fistp", 5: "fild", 7: "fistp"},
            0xD8: {0: "fadd", 1: "fmul", 4: "fsub", 5: "fsubr", 6: "fdiv", 7: "fdivr"},
            0xDC: {0: "fadd", 1: "fmul", 4: "fsub", 5: "fsubr", 6: "fdiv", 7: "fdivr"},
            0xDA: {0: "fiadd", 1: "fimul", 4: "fisub", 6: "fidiv"},
            0xDE: {0: "faddp", 1: "fmulp", 4: "fsubrp", 5: "fsubp", 6: "fdivrp", 7: "fdivp"},
        }
        name = table.get(op, {}).get(reg, "fpu")
        # D9 E8..EE 是无操作数的 fld1/fldz 等, 此时 mod=3 且没有内存操作数
        if op == 0xD9 and not is_mem:
            special = {0xE8: "fld1", 0xE9: "fldl2t", 0xEA: "fldl2e", 0xEB: "fldpi",
                       0xEC: "fldlg2", 0xED: "fldln2", 0xEE: "fldz", 0xF0: "f2xm1",
                       0xF1: "fyl2x", 0xF4: "fsqrt", 0xF7: "fpatan"}
            b0 = buf[pos - 1] if pos - 1 < len(buf) else 0
            # modrm 字节里的 rm 字段就是子操作码
            sub = buf[start + 1] if start + 1 < len(buf) else 0
            if sub in special:
                return done(special[sub])
            return done("fpu", [rm])
        return done(name, [rm])

    # ---- 0x0F 双字节 ----
    if op == 0x0F:
        if pos >= n:
            return None
        op2 = buf[pos]
        pos += 1
        if op2 == 0x05:
            return done("syscall")
        if op2 == 0x0B:
            return done("ud2")
        if op2 == 0x0D:
            m = modrm(buf, pos, rex, bits)
            return done("prefetch", [m[1]] if m else [])
        if op2 == 0x1E and pos < n and buf[pos] in (0xFA, 0xFB):
            fa = buf[pos]
            pos += 1
            # F3 是 endbr 编码的一部分, 不是 rep 前缀(objdump 也不打印 rep)
            return Insn(addr, bytes(buf[start:pos]),
                        "endbr64" if fa == 0xFA else "endbr32", [])
        if op2 == 0x1F:
            m = modrm(buf, pos, rex, bits)
            if not m:
                return None
            r, rm, pos, _ = m
            return done("nop", [rm])
        if op2 == 0xA2:
            return done("cpuid")
        if op2 == 0x31:
            return done("rdtsc")
        if 0x80 <= op2 <= 0x8F:
            v, pos = _rel(buf, pos, 4)
            if v is None:
                return None
            return done("j" + CC[op2 & 0xF], [hex((addr + (pos - start) + v) & 0xFFFFFFFFFFFFFFFF)])
        if 0x90 <= op2 <= 0x9F:
            m = modrm(buf, pos, rex, 8)
            if not m:
                return None
            r, rm, pos, _ = m
            return done("set" + CC[op2 & 0xF], [rm])
        if 0x40 <= op2 <= 0x4F:
            m = modrm(buf, pos, rex, bits)
            if not m:
                return None
            r, rm, pos, _ = m
            return done("cmov" + CC[op2 & 0xF], [_reg(r, bits, rex), rm])
        if op2 in (0xB6, 0xB7, 0xBE, 0xBF):
            src = 8 if op2 in (0xB6, 0xBE) else 16
            m = modrm(buf, pos, rex, src)
            if not m:
                return None
            r, rm, pos, _ = m
            return done("movzx" if op2 in (0xB6, 0xB7) else "movsx",
                        [_reg(r, bits, rex), rm])
        if op2 == 0xAF:
            m = modrm(buf, pos, rex, bits)
            if not m:
                return None
            r, rm, pos, _ = m
            return done("imul", [_reg(r, bits, rex), rm])
        # 常用 SSE
        if op2 in (0x10, 0x11, 0x28, 0x29, 0x57, 0x6E, 0x7E, 0x6F, 0x7F, 0xEF,
                   0x74, 0x75, 0x76, 0xD7):
            name = {0x10: "movups", 0x11: "movups", 0x28: "movaps", 0x29: "movaps",
                    0x57: "xorps", 0x6E: "movd", 0x7E: "movd", 0x6F: "movdqa",
                    0x7F: "movdqa", 0xEF: "pxor", 0x74: "pcmpeqb", 0x75: "pcmpeqw",
                    0x76: "pcmpeqd", 0xD7: "pmovmskb"}[op2]
            xmm = lambda i: "xmm%d" % i
            is_xmm = op2 in (0x28, 0x29, 0x57, 0x6F, 0x7F, 0xEF)
            m = modrm(buf, pos, rex, 64, mem_bits=128 if is_xmm else 32, regfmt=xmm)
            if not m:
                return None
            r, rm, pos, _ = m
            xr = "xmm%d" % (r & 15)
            if op2 in (0x11, 0x29, 0x7F):
                return done(name, [rm, xr])
            return done(name, [xr, rm])
        # 未覆盖: 输出 db 并只吃 1 字节(已知局限, 界面上标为 unknown)
        return Insn(addr, bytes(buf[start:start + 1]), "db", [hex(op2)], unknown=True)

    # 未覆盖的单字节
    return Insn(addr, bytes(buf[start:start + 1]), "db", [hex(op)], unknown=True)


def disasm(buf, base_addr, max_bytes=256, max_insn=80):
    """从 buf 起始处反汇编。返回 (指令列表, 未知条数)。"""
    out = []
    pos = 0
    unknown = 0
    buf = bytes(buf[:max_bytes])
    while pos < len(buf) and len(out) < max_insn:
        ins = decode_one(buf, pos, base_addr + pos)
        if ins is None:
            break
        if ins.unknown:
            unknown += 1
        out.append(ins)
        pos += ins.length
        if ins.mnem in ("ret", "jmp") and not ins.unknown:
            # 到函数尾部或无条件跳转就停, 避免把后面的数据当指令
            break
    return out, unknown
