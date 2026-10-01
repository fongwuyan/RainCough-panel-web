#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""声明式二进制补丁引擎 —— 给「驱动」扩展的矿卡魔改用（路线 A）。

为什么不用上游的 bash 脚本：
  1) 上游 linux.sh 用 sed/xxd 在 root 下跑，等于执行第三方脚本来改驱动二进制；
  2) 声明式补丁数据是**数据**，不是命令 —— 清单被篡改也换不来任意 root 命令；
  3) 可以逐块校验命中次数、记录改了哪些偏移、并做"打完必须等于目标哈希"的闭环校验。

靶点路径（在 `--extract-only` 解出来的驱动目录里，2026-10-01 真机实测 NVIDIA 580.178.04）:
  kernel/nvidia/nv-kernel.o_binary        112,677,456 字节  ← 闭源内核模块（默认靶点）
      sha256 = 5269a23ffba19a17fe16f076463e7ad4151254659441d1711bee6c6221ff6f4b
  kernel-open/nvidia/nv-kernel.o_binary    17,319,944 字节  ← 开源内核模块（kernel-open）
      sha256 = 43d59d125312df2cfed9231deb1b77a4dd17fa142470a1f9e46e08eff9a046e5
  （另有 kernel*/nvidia-modeset/nv-modeset-kernel.o_binary）
  注意：旧分支（如 470/535 一代）靶点在 kernel/nv-kernel.o_binary，本工具用 --target 指定。

补丁数据格式（schema 1）:
{
  "schema": 1,
  "id": "p1xx-580.178.04",
  "target": "kernel/nvidia/nv-kernel.o_binary",
  "base_sha256":   "<原始文件的 sha256，必填>",
  "result_sha256": "<打完后的 sha256，必填>",
  "blocks": [
    { "id": "blk-1", "find_hex": "488b...", "replace_hex": "9090...",
      "expect_hits": 1, "note": "上游 pattern 1" }
  ]
}

用法:
  # 1) 从"原始 + 已打好补丁"两个文件生成补丁数据（会做闭环校验）
  python3 nvpatch.py make --original orig.bin --patched patched.bin \
      --target kernel/nvidia/nv-kernel.o_binary --id p1xx-580.178.04 --out p1xx-580.178.04.patch.json

  # 2) 在官方驱动上 dry-run（默认就是 dry-run，不写文件）
  python3 nvpatch.py apply --file orig.bin --patch p1xx-580.178.04.patch.json

  # 3) 真打（写回原文件前会先备份为 <file>.orig-<sha8>）
  python3 nvpatch.py apply --file orig.bin --patch p1xx-580.178.04.patch.json --write

  # 4) 校验一个文件是否已经是"打完"的状态
  python3 nvpatch.py verify --file patched.bin --patch p1xx-580.178.04.patch.json
"""

import argparse
import hashlib
import json
import os
import shutil
import sys

SCHEMA = 1
CONTEXT_STEPS = (8, 24, 64, 160, 384, 900)


# ---------------- 基础工具 ----------------

def sha256_file(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def hex2bytes(s, field):
    s = (s or "").strip().replace(" ", "").replace("\n", "")
    if not s:
        raise ValueError("%s 为空" % field)
    if len(s) % 2:
        raise ValueError("%s 长度不是偶数(十六进制)" % field)
    try:
        return bytes.fromhex(s)
    except ValueError:
        raise ValueError("%s 不是合法十六进制" % field)


def find_all(hay, needle):
    """返回 needle 在 hay 中所有出现的偏移。"""
    out = []
    if not needle:
        return out
    i = hay.find(needle)
    while i != -1:
        out.append(i)
        i = hay.find(needle, i + 1)
    return out


def die(msg, code=2):
    print("错误: %s" % msg, file=sys.stderr)
    return code


# ---------------- 补丁数据校验 ----------------

REQUIRED_ENTRY_FIELDS = ("schema", "id", "target", "base_sha256", "result_sha256", "blocks")


def validate_patch(doc):
    """校验补丁数据结构；返回规范化后的 blocks。"""
    for k in REQUIRED_ENTRY_FIELDS:
        if k not in doc:
            raise ValueError("补丁数据缺字段: %s" % k)
    if int(doc["schema"]) != SCHEMA:
        raise ValueError("补丁数据 schema=%s，本工具只支持 %s" % (doc["schema"], SCHEMA))
    for k in ("base_sha256", "result_sha256"):
        v = str(doc[k]).strip().lower()
        if len(v) != 64 or any(c not in "0123456789abcdef" for c in v):
            raise ValueError("%s 不是合法 sha256" % k)
    blocks = doc["blocks"]
    if not isinstance(blocks, list) or not blocks:
        raise ValueError("blocks 必须是非空数组")
    seen = set()
    norm = []
    for i, b in enumerate(blocks):
        bid = str(b.get("id") or ("blk-%d" % (i + 1)))
        if bid in seen:
            raise ValueError("blocks[].id 重复: %s" % bid)
        seen.add(bid)
        find = hex2bytes(b.get("find_hex"), "%s.find_hex" % bid)
        repl = hex2bytes(b.get("replace_hex"), "%s.replace_hex" % bid)
        if len(find) != len(repl):
            raise ValueError("%s: find/replace 长度必须一致(本引擎做等长替换)" % bid)
        hits = int(b.get("expect_hits", 1))
        if hits < 1:
            raise ValueError("%s: expect_hits 必须 >= 1" % bid)
        if find == repl:
            raise ValueError("%s: find 与 replace 相同(空补丁)" % bid)
        norm.append({"id": bid, "find": find, "replace": repl, "expect_hits": hits,
                     "note": b.get("note", "")})
    return norm


def apply_blocks(data, blocks, dry_run=True):
    """在内存里逐块替换；返回 (新数据, 报告)。命中数不符直接抛错。"""
    report = []
    out = bytearray(data)
    # 逐块操作：后一块在前一块的结果上继续找（与上游脚本顺序一致）
    for b in blocks:
        hits = find_all(bytes(out), b["find"])
        if len(hits) != b["expect_hits"]:
            raise ValueError("块 %s 命中 %d 次，期望 %d 次（驱动版本与本补丁不匹配？）"
                             % (b["id"], len(hits), b["expect_hits"]))
        for off in hits:
            out[off:off + len(b["find"])] = b["replace"]
        report.append({"id": b["id"], "hits": len(hits), "offsets": hits,
                       "bytes_changed": len(hits) * len(b["find"]), "note": b.get("note", "")})
    return bytes(out), report


# ---------------- make: 从"原始/已补丁"生成数据 ----------------

def diff_runs(a, b):
    """返回 [(start, end_exclusive)] 表示 a/b 不同的连续区间。"""
    runs = []
    i, n = 0, min(len(a), len(b))
    while i < n:
        if a[i] != b[i]:
            j = i
            while j < n and a[j] != b[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    if len(a) != len(b):
        # 长度不同：把尾部差异也算成一段（等长替换引擎不支持，稍后报错）
        runs.append((n, max(len(a), len(b))))
    return runs


def make_blocks(orig, patched):
    """把字节差异转成块：先取差异段，再按需扩上下文直到在原文里唯一。"""
    if len(orig) != len(patched):
        raise ValueError("原始与已补丁文件长度不同(%d vs %d)：本引擎只做等长替换，"
                         "长度变化请改用 nvidia-installer 的 --apply-patch 或重打包 .run"
                         % (len(orig), len(patched)))
    runs = diff_runs(orig, patched)
    if not runs:
        raise ValueError("两个文件完全相同，没有可生成的补丁")
    blocks = []
    for idx, (s, e) in enumerate(runs, 1):
        find = None
        hits = None
        for ctx in CONTEXT_STEPS:
            lo = max(0, s - ctx)
            hi = min(len(orig), e + ctx)
            cand = orig[lo:hi]
            cnt = len(find_all(orig, cand))
            # 唯一 或 已经扩到极限（整文件）
            if cnt == 1 or (lo == 0 and hi == len(orig)):
                find, hits, span = cand, cnt, (lo, hi)
                break
        if find is None:
            lo = max(0, s - CONTEXT_STEPS[-1])
            hi = min(len(orig), e + CONTEXT_STEPS[-1])
            find, hits, span = orig[lo:hi], len(find_all(orig, orig[lo:hi])), (lo, hi)
        lo, hi = span
        repl = patched[lo:hi]
        blocks.append({
            "id": "blk-%d" % idx,
            "find_hex": find.hex(),
            "replace_hex": repl.hex(),
            "expect_hits": hits,
            "note": "diff 区间 %d..%d（上下文 %d 字节，命中 %d 次）" % (s, e, lo and (s - lo) or 0, hits),
        })
    return blocks


# ---------------- 子命令 ----------------

def cmd_make(args):
    orig = open(args.original, "rb").read()
    patched = open(args.patched, "rb").read()
    blocks = make_blocks(orig, patched)
    doc = {
        "schema": SCHEMA,
        "id": args.id or os.path.basename(args.out or "patch").split(".")[0],
        "target": args.target or "kernel/nv-kernel.o_binary",
        "base_sha256": sha256_bytes(orig),
        "result_sha256": sha256_bytes(patched),
        "blocks": blocks,
    }
    # 闭环：用生成的块重新打一遍，必须逐字节等于 patched
    norm = validate_patch(doc)
    redo, report = apply_blocks(orig, norm, dry_run=True)
    if redo != patched:
        return die("闭环校验失败：用生成的补丁重打后与 patched 文件不一致（请检查输入）")
    print("生成补丁: %s" % doc["id"])
    print("  目标文件   : %s" % doc["target"])
    print("  块数       : %d（总改动 %d 字节）"
          % (len(report), sum(r["bytes_changed"] for r in report)))
    print("  base_sha256: %s" % doc["base_sha256"])
    print("  result_sha256: %s" % doc["result_sha256"])
    for r in report:
        print("  - %-8s 命中 %d 次 @ %s" % (r["id"], r["hits"],
                                            ",".join(hex(o) for o in r["offsets"][:4]) + ("…" if len(r["offsets"]) > 4 else "")))
    print("  闭环校验   : 通过（重打结果与 patched 完全一致）")
    if args.out:
        write_json(args.out, doc)
        print("已写出: %s (%d 字节)" % (args.out, os.path.getsize(args.out)))
    return 0


def cmd_apply(args):
    doc = read_json(args.patch)
    norm = validate_patch(doc)
    data = open(args.file, "rb").read()
    base = sha256_bytes(data)
    if base == doc["result_sha256"]:
        print("该文件已经是打过补丁的状态（sha256 等于 result_sha256），无需再打。")
        return 0
    if args.expect_base and base != str(doc["base_sha256"]).lower():
        return die("文件 sha256 与补丁声明的 base_sha256 不符：\n  实际: %s\n  声明: %s\n"
                   "（驱动版本不对，或文件已被改动）" % (base, doc["base_sha256"]))
    if base != str(doc["base_sha256"]).lower():
        print("注意: 文件 sha256 与补丁声明的 base_sha256 不同，但命中数校验仍会执行。")
    out, report = apply_blocks(data, norm, dry_run=True)
    result_hash = sha256_bytes(out)
    ok = (result_hash == str(doc["result_sha256"]).lower())
    print("补丁: %s  目标: %s" % (doc["id"], doc["target"]))
    print("  文件        : %s (%d 字节)" % (args.file, len(data)))
    for r in report:
        print("  - %-8s 命中 %d 次，改动 %d 字节" % (r["id"], r["hits"], r["bytes_changed"]))
    print("  结果 sha256 : %s" % result_hash)
    print("  期望 sha256 : %s" % doc["result_sha256"])
    print("  闭环校验    : %s" % ("通过" if ok else "★不一致★"))
    if not ok:
        return die("打完后的哈希与补丁声明不一致，拒绝写入")
    if not args.write:
        print("dry-run：未写入（加 --write 才真正写入）。")
        return 0
    backup = "%s.orig-%s" % (args.file, base[:8])
    if not os.path.exists(backup):
        shutil.copy2(args.file, backup)
    with open(args.file, "wb") as f:
        f.write(out)
    print("已写入: %s（原文件备份: %s）" % (args.file, backup))
    return 0


def cmd_verify(args):
    doc = read_json(args.patch)
    validate_patch(doc)
    data = open(args.file, "rb").read()
    h = sha256_bytes(data)
    if h == str(doc["result_sha256"]).lower():
        print("verify: 该文件是【已打补丁】状态 (%s)" % doc["id"])
        return 0
    if h == str(doc["base_sha256"]).lower():
        print("verify: 该文件是【原始未打】状态 (%s)" % doc["id"])
        return 0
    print("verify: 该文件既不匹配 base 也不匹配 result（未知状态）")
    return 1


def main(argv=None):
    p = argparse.ArgumentParser(description="声明式二进制补丁引擎（矿卡魔改驱动用）")
    sub = p.add_subparsers(dest="cmd", required=True)

    m = sub.add_parser("make", help="从原始文件与已补丁文件生成补丁数据")
    m.add_argument("--original", required=True)
    m.add_argument("--patched", required=True)
    m.add_argument("--out", help="输出补丁 JSON")
    m.add_argument("--id", help="补丁 id")
    m.add_argument("--target", default="kernel/nvidia/nv-kernel.o_binary",
                   help="靶点在解包驱动目录内的相对路径（默认闭源内核模块）")
    m.set_defaults(func=cmd_make)

    a = sub.add_parser("apply", help="应用补丁（默认 dry-run）")
    a.add_argument("--file", required=True)
    a.add_argument("--patch", required=True)
    a.add_argument("--write", action="store_true", help="真正写入（默认只校验）")
    a.add_argument("--no-expect-base", dest="expect_base", action="store_false",
                   help="不强制文件哈希等于 base_sha256")
    a.set_defaults(func=cmd_apply, expect_base=True)

    v = sub.add_parser("verify", help="判断文件处于原始/已补丁/未知")
    v.add_argument("--file", required=True)
    v.add_argument("--patch", required=True)
    v.set_defaults(func=cmd_verify)

    args = p.parse_args(argv)
    try:
        return args.func(args)
    except (ValueError, OSError) as e:
        return die(str(e))


if __name__ == "__main__":
    sys.exit(main())
