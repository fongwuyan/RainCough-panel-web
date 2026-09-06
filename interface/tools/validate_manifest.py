#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""plugin.json v4 快速校验(纯 stdlib; 需要完整 JSON Schema 时用 jsonschema 校验 schema/ 目录)。"""
import json
import re
import sys

NAME_RE = re.compile(r"^[a-z0-9_-]{1,32}$")
IFACE_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_.]+$")


def validate(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        m = json.load(f)
    errs = []
    if not NAME_RE.match(str(m.get("name", ""))):
        errs.append("name 非法: %r (需 ^[a-z0-9_-]{1,32}$)" % m.get("name"))
    for k in ("label", "version"):
        if not m.get(k):
            errs.append("%s 必填" % k)
    fe = m.get("frontend") or {}
    if not fe.get("entry"):
        errs.append("frontend.entry 必填(Vue3 产物相对路径)")
    be = m.get("backend") or {}
    if not (be.get("exec") and isinstance(be["exec"], list) and len(be["exec"]) > 0):
        errs.append("backend.exec 必填(启动命令数组)")
    ifaces = m.get("interfaces")
    if not isinstance(ifaces, list):
        errs.append("interfaces 必须为数组(可为空)")
    else:
        seen = set()
        for it in ifaces:
            iid = it.get("id", "")
            if not IFACE_RE.match(iid):
                errs.append("接口 id 非法: %r" % iid)
            if iid in seen:
                errs.append("接口 id 重复: %s" % iid)
            seen.add(iid)
            if it.get("visibility") not in (None, "all", "main", "private"):
                errs.append("接口 %s visibility 非法" % iid)
    if errs:
        for e in errs:
            print("  [ERR] " + e)
        return False
    print("  [OK] %s v%s: %d interfaces" % (m.get("name"), m.get("version"), len(m.get("interfaces", []))))
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python validate_manifest.py <plugin.json...>")
        sys.exit(2)
    ok = True
    for p in sys.argv[1:]:
        if not validate(p):
            ok = False
    sys.exit(0 if ok else 1)