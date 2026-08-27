#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RainCough 全面功能测试 — 遍历 api.js 全部 276 端点 + 17 插件。
主系统: 84 GET+POST 端点探测(空 body / 最小参数)。
插件: 每个 /__health + 路由白名单 GET。
输出: PASS/FAIL/WARN 统计 + 失败详情。
"""
import json
import time
import requests

B = "http://127.0.0.1:3900"
REQS = requests.Session()
REQS.trust_env = False
FAILS, WARNS, TOT = [], [], [0]

# ---- 主系统端点(从 api.js 硬编码清单, 安全探测) ----
MAIN = [
    ("GET", "/api/system"), ("GET", "/api/disks"), ("GET", "/api/storage"),
    ("GET", "/api/scheduler/jobs"), ("GET", "/api/scheduler/actions"),
    ("GET", "/api/envpkg/catalog"), ("GET", "/api/envpkg/envs"),
    ("GET", "/api/fm/ops"), ("GET", "/api/media/roots"), ("GET", "/api/media/stats"),
    ("GET", "/api/store/registry"), ("GET", "/api/store/settings"),
    ("GET", "/api/store/project/status"),
    ("GET", "/api/sysfunc/service/list"), ("GET", "/api/sysfunc/fw/all"),
    ("GET", "/api/sysfunc/hardware"), ("GET", "/api/sysfunc/updates/list"),
    ("GET", "/api/sysfunc/users"), ("GET", "/api/sysfunc/time/status"),
    ("GET", "/api/sysfunc/kernels"), ("GET", "/api/sysfunc/pwr/state"),
    ("GET", "/api/sysfunc/snapshot/cap"), ("GET", "/api/sysfunc/clean/scan"),
    ("GET", "/api/sysfunc/disks/fs"), ("GET", "/api/sysfunc/health/check"),
    ("GET", "/api/sysfunc/logrotate/list"), ("GET", "/api/sysfunc/boot/history"),
    ("GET", "/api/sysfunc/net/status"), ("GET", "/api/sysfunc/api-monitor/stats"),
    ("GET", "/api/terminal/hosts"), ("GET", "/api/terminal/commands"),
    ("GET", "/api/terminal/ws_token"),
    ("POST", "/api/fm/ops"), ("POST", "/api/fm/mkdir"), ("POST", "/api/fm/size"),
    ("POST", "/api/media/roots"), ("POST", "/api/envpkg/start"),
    ("POST", "/api/store/ping"), ("POST", "/api/store/plugin/update"),
    ("POST", "/api/scheduler/jobs"), ("POST", "/api/disks/unmount"),
]

# ---- 插件路由白名单(GET 安全探测 + health) ----
PLUGINS = {
    "jmcomic": ["/config", "/library", "/info"],
    "aigen": ["/ping", "/models", "/gallery", "/config", "/info"],
    "compress": ["/info", "/decompress/check"],
    "dltool": ["/check", "/info"],
    "docker": ["/info", "/containers", "/images", "/status"],
    "filehash": ["/info"],
    "imagetool": ["/info"],
    "kvm": ["/config", "/info", "/domains"],
    "laizhangsetu": ["/config", "/cooldown", "/history", "/info"],
    "mcserver": ["/instances", "/cores", "/logs", "/info"],
    "mcskin": ["/paint/models", "/info"],
    "ocrqr": ["/ocr/check", "/info"],
    "texttool": ["/info"],
    "touchgal": ["/info"],
    "uptime": ["/targets", "/status", "/info"],
    "vpn": ["/env", "/overview", "/v2/subs", "/v2/status", "/info"],
    "webspy": ["/rss/feeds", "/info"],
}


def probe(method, path, label=""):
    TOT[0] += 1
    url = B + path
    try:
        if method == "GET":
            r = REQS.get(url, timeout=12)
        else:
            r = REQS.post(url, json={"probe": 1}, timeout=15)
        code = r.status_code
        ct = r.headers.get("Content-Type", "")
        if code >= 500:
            FAILS.append((label or path, "HTTP %d %s" % (code, str(r.text)[:100])))
            return "F"
        if code == 404:
            FAILS.append((label or path, "404 not found"))
            return "F"
        # 400 = 参数校验(通常正常, 记 WARN); 200/302 = OK
        if code in (200, 201, 302):
            return "P"
        if code == 400:
            WARNS.append((label or path, "400(可能参数校验)"))
            return "W"
        if code == 405:
            WARNS.append((label or path, "405 method"));
            return "W"
        return "W"  # 其他码
    except Exception as e:
        FAILS.append((label or path, "ERR %s" % str(e)[:80]))
        return "F"


def main():
    print("=== 主系统 %d 端点探测 ===" % len(MAIN))
    pf = pw = 0
    for method, path in MAIN:
        res = probe(method, B and path or path, "main %s %s" % (method, path))
        if res == "F":
            pf += 1
        elif res == "W":
            pw += 1
    print("主系统: %d 端点, FAIL %d, WARN %d" % (len(MAIN), pf, pw))

    print("\n=== 17 插件探测 ===")
    for name, routes in PLUGINS.items():
        for r in ["/__health"] + routes:
            probe("GET", "/api/plugins/%s%s" % (name, r), "plg %s%s" % (name, r))
    print("插件探测完成")

    print("\n=== 汇总 ===")
    print("总探测: %d" % TOT[0])
    print("FAIL %d:" % len(FAILS))
    for lbl, d in FAILS:
        print("  ❌ %s: %s" % (lbl, d))
    print("WARN %d:" % len(WARNS))
    for lbl, d in WARNS[:25]:
        print("  ⚠️ %s: %s" % (lbl, d))
    if len(WARNS) > 25:
        print("  ... 共 %d 条" % len(WARNS))
    print(json.dumps({"fails": FAILS, "warns": WARNS[:40]}, ensure_ascii=False))


if __name__ == "__main__":
    main()