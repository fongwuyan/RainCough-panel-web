#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「驱动」扩展要读的驱动仓库清单 drivers/registry.json（路线 A: 只放补丁数据）。

清单与补丁数据都放在**主面板库**（fongwuyan/RainCough-panel-web）的 drivers/ 目录里，
与系统扩展同一种存放方式：随面板库版本化、可走 gh-proxy 镜像、可离线用本地目录顶替。
不放任何大文件（一个补丁 JSON 约 1KB），因此没有仓库容量配额问题。

输入目录结构（你本地准备，上传到主面板库的就只有 drivers/ 这一层）:

  driver-repo/
    entries/
      p1xx-580.178.04.entry.json      # 条目元数据（卡、版本、收尾动作…）
      cmp-615.71.09.entry.json
    patches/
      p1xx-580.178.04.patch.json      # 由 tools/nvpatch.py make 生成
      cmp-615.71.09.patch.json
    （可选）NVIDIA-Linux-x86_64-580.178.04.run  # 用 --base-run 指定，用于算 base 的 size/sha256

输出:
  <out>/drivers/registry.json
  <out>/drivers/README.md            # 上传/维护说明（给人看）

用法:
  python3 build-driver-registry.py --src ./driver-repo --out ./out \
      --base-run NVIDIA-Linux-x86_64-580.178.04.run
"""

import argparse
import hashlib
import json
import os
import re
import sys

SCHEMA = 1
TYPE_ENUM = ("patch-data", "patch-script", "nvidia-run")
POST_ENUM = ("blacklist-nouveau", "gsp-off", "initramfs", "depmod")
PCI_RE = re.compile(r"^[0-9a-f]{4}:[0-9a-f]{4}$")
TAG_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
NAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
URL_TMPL = "https://download.nvidia.com/XFree86/Linux-x86_64/{v}/NVIDIA-Linux-x86_64-{v}.run"


def sha256_file(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def read_json(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def write_text(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(s)
    os.replace(tmp, p)


def fail(msg):
    print("校验失败: %s" % msg, file=sys.stderr)
    raise SystemExit(2)


def validate_entry(e, patch_doc, patch_sha):
    eid = e.get("id") or "?"
    if not NAME_RE.match(str(eid)):
        fail("条目 id 非法: %r" % eid)
    t = e.get("type")
    if t not in TYPE_ENUM:
        fail("%s: type 必须是 %s 之一，实际 %r" % (eid, "/".join(TYPE_ENUM), t))
    ids = e.get("card_pci_ids") or []
    if not ids:
        fail("%s: card_pci_ids 不能为空" % eid)
    for cid in ids:
        if not PCI_RE.match(str(cid).lower()):
            fail("%s: card_pci_ids 非法: %r（应形如 10de:1c07）" % (eid, cid))
    for p in e.get("post") or []:
        if p not in POST_ENUM:
            fail("%s: post 含未枚举动作 %r（只允许 %s）" % (eid, p, "/".join(POST_ENUM)))
    v = str(e.get("driver_version") or "")
    if not re.match(r"^[0-9]{3}\.[0-9]{1,4}(\.[0-9]{1,4})?$", v):
        fail("%s: driver_version 形如 580.178.04，实际 %r" % (eid, v))
    tag = e.get("release_tag")
    if tag and not TAG_RE.match(tag):
        fail("%s: release_tag 非法: %r" % (eid, tag))

    entry = {
        "id": eid,
        "title": e.get("title") or eid,
        "type": t,
        "card_pci_ids": [str(c).lower() for c in ids],
        "card_names": e.get("card_names") or [],
        "arch": e.get("arch") or [],
        "driver_version": v,
        "requires": e.get("requires") or [],
        "post": e.get("post") or [],
        "reboot_required": bool(e.get("reboot_required", True)),
        "notes": e.get("notes") or "",
    }
    if tag:
        entry["release_tag"] = tag

    if t in ("patch-data", "patch-script"):
        if not patch_doc:
            fail("%s: type=%s 需要 patches/<id>.patch.json" % (eid, t))
        base = dict(e.get("base") or {})
        base.setdefault("version", v)
        base["download_url"] = base.get("download_url") or URL_TMPL.format(v=v)
        if "sha256_expected" in base and base["sha256_expected"] is not None:
            if not SHA_RE.match(str(base["sha256_expected"]).lower()):
                fail("%s: base.sha256_expected 不是合法 sha256" % eid)
            base["sha256_expected"] = str(base["sha256_expected"]).lower()
        else:
            base["sha256_expected"] = None
        base.setdefault("verify", ["sh --check"])
        entry["base"] = base
        entry["patch"] = {
            # 相对路径：由扩展按"来源基址（主面板库 raw / gh-proxy 镜像 / 本地目录）"拼 URL，
            # 这样同一份清单在直连、镜像、离线三种取法下都能用。
            "path": (e.get("patch_path")
                     or "drivers/patches/%s.patch.json" % eid),
            "sha256": patch_sha,
            "target": patch_doc.get("target") or "kernel/nvidia/nv-kernel.o_binary",
            "blocks": len(patch_doc.get("blocks") or []),
            "base_sha256": patch_doc.get("base_sha256"),
            "result_sha256": patch_doc.get("result_sha256"),
            "dry_run_required": True,
        }
        if e.get("patch_url"):
            entry["patch"]["url"] = e["patch_url"]
        if not SHA_RE.match(str(entry["patch"]["base_sha256"] or "")):
            fail("%s: 补丁数据缺 base_sha256" % eid)
        if not SHA_RE.match(str(entry["patch"]["result_sha256"] or "")):
            fail("%s: 补丁数据缺 result_sha256" % eid)
    else:  # nvidia-run
        parts = e.get("parts") or []
        if not parts:
            fail("%s: type=nvidia-run 需要 parts[]（分卷）" % eid)
        total = 0
        for i, p in enumerate(parts):
            nm = str(p.get("name") or "")
            if not NAME_RE.match(nm) or ".." in nm or "/" in nm:
                fail("%s: parts[%d].name 非法（禁 / 与 ..）: %r" % (eid, i, nm))
            sz = int(p.get("size_b") or 0)
            if sz <= 0 or sz > 104857600:
                fail("%s: parts[%d].size_b 必须 1..100MB" % (eid, i))
            if not SHA_RE.match(str(p.get("sha256") or "").lower()):
                fail("%s: parts[%d].sha256 不是合法 sha256" % (eid, i))
            total += sz
        if not SHA_RE.match(str(e.get("total_sha256") or "").lower()):
            fail("%s: total_sha256 不是合法 sha256" % eid)
        entry["total_size_b"] = int(e.get("total_size_b") or total)
        entry["total_sha256"] = str(e["total_sha256"]).lower()
        entry["parts"] = [{"name": p["name"], "size_b": int(p["size_b"]),
                           "sha256": str(p["sha256"]).lower()} for p in parts]
    return entry


README = """# 驱动补丁数据（主面板库）

本目录只放**补丁数据**（KB 级）。魔改驱动的官方 `.run` 由面板「驱动」扩展从 NVIDIA 官网下载后**本地打补丁**
（路线 A）：不占仓库容量、不依赖任何第三方打包的驱动二进制。

## 目录

```
drivers/
  registry.json           扩展读取的唯一清单
  patches/<id>.patch.json 由 tools/nvpatch.py make 生成（声明式补丁数据）
  README.md               本文件
```

## 靶点（真机实测 NVIDIA 580.178.04）

```
sh NVIDIA-Linux-x86_64-<ver>.run --extract-only
kernel/nvidia/nv-kernel.o_binary        112,677,456 字节   ← 默认靶点（闭源内核模块）
kernel-open/nvidia/nv-kernel.o_binary    17,319,944 字节   ← 开源内核模块
（470/535 一代的靶点在 kernel/nv-kernel.o_binary，用 --target 指定）
```

## 维护流程

1. 取官方驱动并解包：
   ```
   sh NVIDIA-Linux-x86_64-<ver>.run --check          # 校验完整性
   sh NVIDIA-Linux-x86_64-<ver>.run --extract-only
   cp -a NVIDIA-Linux-x86_64-<ver>/kernel/nvidia/nv-kernel.o_binary orig.bin
   ```
2. 用你已准备好的魔改版替换，生成补丁数据（工具自动闭环校验：重打结果必须逐字节等于魔改版）：
   ```
   python3 tools/nvpatch.py make --original orig.bin --patched patched.bin \\
       --target kernel/nvidia/nv-kernel.o_binary --id <id> --out entries/../patches/<id>.patch.json
   ```
3. 写 `entries/<id>.entry.json`（卡 PCI ID、驱动版本、收尾动作），然后生成清单：
   ```
   python3 tools/build-driver-registry.py --src . --out ./out \\
       --base-run NVIDIA-Linux-x86_64-<ver>.run
   ```
4. 把 `out/drivers/` 提交到主面板库（`drivers/registry.json` + `drivers/patches/`）。**不传任何大文件。**
"""


def main(argv=None):
    ap = argparse.ArgumentParser(description="生成驱动仓库清单 registry.json")
    ap.add_argument("--src", required=True, help="含 entries/ 与 patches/ 的目录")
    ap.add_argument("--out", required=True, help="输出目录（会写 <out>/drivers/）")
    ap.add_argument("--base-run", help="官方 .run 本地副本，用于填 base 的 size/sha256")
    ap.add_argument("--release-tag", help="（预留）仅路线 B 分卷分发时需要")
    args = ap.parse_args(argv)

    entries_dir = os.path.join(args.src, "entries")
    patches_dir = os.path.join(args.src, "patches")
    if not os.path.isdir(entries_dir):
        fail("缺少目录: %s" % entries_dir)

    base_info = None
    if args.base_run:
        if not os.path.exists(args.base_run):
            fail("--base-run 文件不存在: %s" % args.base_run)
        base_info = {"size_b": os.path.getsize(args.base_run),
                     "sha256": sha256_file(args.base_run)}

    out_entries = []
    for fn in sorted(os.listdir(entries_dir)):
        if not fn.endswith(".entry.json"):
            continue
        e = read_json(os.path.join(entries_dir, fn))
        eid = e.get("id") or fn[:-len(".entry.json")]
        patch_doc, patch_sha = None, None
        pj = os.path.join(patches_dir, "%s.patch.json" % eid)
        if os.path.exists(pj):
            patch_doc = read_json(pj)
            patch_sha = sha256_file(pj)
        elif e.get("type") in ("patch-data", "patch-script"):
            fail("%s: 找不到 %s" % (eid, pj))
        if args.release_tag and not e.get("release_tag"):
            e["release_tag"] = args.release_tag
        if base_info and e.get("type") in ("patch-data", "patch-script"):
            b = dict(e.get("base") or {})
            b.setdefault("size_b", base_info["size_b"])
            b.setdefault("sha256_expected", base_info["sha256"])
            e["base"] = b
        entry = validate_entry(e, patch_doc, patch_sha)
        # 路线 A 的补丁 URL 默认指向本仓库 main 分支
        out_entries.append(entry)
        kind = entry["type"]
        extra = ("%d 块" % entry["patch"]["blocks"]) if kind in ("patch-data", "patch-script") \
            else ("%d 卷" % len(entry.get("parts", [])))
        print("[ok] %-28s %-12s v%-12s %s" % (entry["id"], kind, entry["driver_version"], extra))

    if not out_entries:
        fail("没有任何条目（检查 %s/*.entry.json）" % entries_dir)

    doc = {"schema": SCHEMA,
           "updated_at": None,  # 由调用方按需改写；不写时间可让 diff 稳定
           "note": "RainCough 面板「驱动」扩展的魔改驱动来源（路线 A: 只放补丁数据）",
           "entries": out_entries}
    out_json = os.path.join(args.out, "drivers", "registry.json")
    write_text(out_json, json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    write_text(os.path.join(args.out, "drivers", "README.md"), README)
    print("\n清单已写出: %s（%d 个条目，%d 字节）"
          % (out_json, len(out_entries), os.path.getsize(out_json)))
    if base_info:
        print("base .run: %d 字节  sha256=%s" % (base_info["size_b"], base_info["sha256"]))
    print("上传: 把 %s 与 patches/ 提交到主面板库（fongwuyan/RainCough-panel-web）的 drivers/ 下即可。"
          % os.path.relpath(out_json, args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
