#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RainCough 全量端点测试 v2 — api.js 全部静态端点 + 17 插件路由。
规则: GET 期望 200/302; POST 空 body 期望非 5xx(400=参数校验 OK, 非404)。
"""
import json
import requests

B = "http://127.0.0.1:3900"
REQS = requests.Session()
REQS.trust_env = False

# 全部静态端点(不含插件/动态路径)
ENDPOINTS = [
    "GET /api/disks", "GET /api/envpkg/catalog", "GET /api/envpkg/envs",
    "GET /api/envpkg/recipes", "GET /api/fm/ops", "GET /api/media/roots",
    "GET /api/media/stats", "GET /api/plugins", "GET /api/scheduler/actions",
    "GET /api/scheduler/jobs", "GET /api/storage",
    "GET /api/store/project/status", "GET /api/store/project/update-info",
    "GET /api/store/registry", "GET /api/store/settings",
    "GET /api/sysfunc/api-monitor/stats", "GET /api/sysfunc/boot/history",
    "GET /api/sysfunc/clean/scan", "GET /api/sysfunc/disks/fs",
    "GET /api/sysfunc/fw/all", "GET /api/sysfunc/hardware",
    "GET /api/sysfunc/health/check", "GET /api/sysfunc/kernels",
    "GET /api/sysfunc/logrotate/list", "GET /api/sysfunc/net/status",
    "GET /api/sysfunc/pwr/state", "GET /api/sysfunc/service/list",
    "GET /api/sysfunc/snapshot/cap", "GET /api/sysfunc/snapshot/list",
    "GET /api/sysfunc/time/status", "GET /api/sysfunc/updates/list",
    "GET /api/sysfunc/users", "GET /api/system",
    "GET /api/terminal/commands", "GET /api/terminal/hosts",
    "GET /api/terminal/ws_token",
    "POST /api/disks/unmount", "POST /api/envpkg/install", "POST /api/envpkg/run",
    "POST /api/envpkg/start", "POST /api/envpkg/stop", "POST /api/envpkg/uninstall",
    "POST /api/fm/copy", "POST /api/fm/delete", "POST /api/fm/mkdir",
    "POST /api/fm/move", "POST /api/fm/ops", "POST /api/fm/rename",
    "POST /api/fm/save", "POST /api/fm/size", "POST /api/fm/unzip",
    "POST /api/media/dedup", "POST /api/media/roots", "POST /api/media/tag",
    "POST /api/scheduler/jobs", "POST /api/store/ping",
    "POST /api/store/plugin/install", "POST /api/store/plugin/remove",
    "POST /api/store/plugin/update", "POST /api/store/project/check",
    "POST /api/store/project/install", "POST /api/store/settings",
    "POST /api/sys/processes/kill", "POST /api/sysfunc/api-monitor/clear",
    "POST /api/sysfunc/clean/do", "POST /api/sysfunc/cron/save",
    "POST /api/sysfunc/health/restart", "POST /api/sysfunc/kernels/remove",
    "POST /api/sysfunc/logrotate/save", "POST /api/sysfunc/pwr/cancel",
    "POST /api/sysfunc/pwr/plan", "POST /api/sysfunc/service/action",
    "POST /api/sysfunc/snapshot/create", "POST /api/sysfunc/ssh/keys/save",
    "POST /api/sysfunc/time/sync", "POST /api/sysfunc/updates/refresh",
    "POST /api/sysfunc/updates/run", "POST /api/tasks/purge",
    "POST /api/terminal/close", "POST /api/terminal/commands",
    "POST /api/terminal/hosts", "POST /api/terminal/hosts/set_sort",
    "POST /api/terminal/input", "POST /api/terminal/open",
    "POST /api/terminal/resize",
]

# 危险执行端点: 测试绝不打(防止误触发关机/重启/升级/删除等副作用)
DANGEROUS = {
    "POST /api/sysfunc/pwr/plan",      # 会安排关机! 空参数曾误触发宿主重启
    "POST /api/sysfunc/pwr/cancel",
    "POST /api/sysfunc/health/restart",  # 重启面板服务
    "POST /api/sysfunc/updates/run",     # apt upgrade
    "POST /api/sysfunc/updates/refresh",  # apt update
    "POST /api/sysfunc/clean/do",        # 清理磁盘
    "POST /api/sysfunc/kernels/remove",  # 删内核
    "POST /api/sysfunc/snapshot/create", # 建快照
    "POST /api/sysfunc/cron/save",       # 改 crontab
    "POST /api/sysfunc/ssh/keys/save",
    "POST /api/sysfunc/service/action",  # 启停服务
    "POST /api/sysfunc/logrotate/save",
    "POST /api/sysfunc/time/sync",
    "POST /api/disks/unmount",           # 卸载磁盘
    "POST /api/store/plugin/remove",
    "POST /api/store/plugin/install",
    "POST /api/store/project/install",
    "POST /api/fm/delete", "POST /api/fm/move", "POST /api/fm/copy",
    "POST /api/fm/rename", "POST /api/fm/save", "POST /api/fm/unzip",
    "POST /api/envpkg/uninstall", "POST /api/envpkg/install",
    "POST /api/envpkg/run", "POST /api/envpkg/start", "POST /api/envpkg/stop",
    "POST /api/tasks/purge",
    "POST /api/sys/processes/kill",
}

PLUGIN_ROUTES = {
    "jmcomic": ["/config", "/library", "/info", "/search"],  # search GET 会真实搜索(慢, 不测)
    "aigen": ["/ping", "/models", "/gallery", "/config", "/info"],
    "compress": ["/info", "/decompress/check"],
    "dltool": ["/check", "/info"],
    "docker": ["/info", "/containers", "/images", "/networks", "/volumes", "/status"],
    "filehash": ["/info"],
    "imagetool": ["/info"],
    "kvm": ["/config", "/info", "/domains", "/storage", "/images"],
    "laizhangsetu": ["/config", "/cooldown", "/history", "/info"],
    "mcserver": ["/instances", "/cores", "/logs", "/core/jars", "/info"],
    "mcskin": ["/paint/models", "/text2skin/models", "/info"],
    "ocrqr": ["/ocr/check", "/info"],
    "texttool": ["/info"],
    "touchgal": ["/info"],
    "uptime": ["/targets", "/status", "/info"],
    "vpn": ["/env", "/overview", "/v2/subs", "/v2/status", "/info"],
    "webspy": ["/rss/feeds", "/info"],
}


def probe(method, path, label):
    url = B + path
    try:
        r = REQS.get(url, timeout=12) if method == "GET" else REQS.post(url, json={}, timeout=15)
        if r.status_code in (200, 201, 302):
            return None
        if r.status_code in (400, 405, 409):
            return "W %s(body=%s)" % (r.status_code, str(r.text)[:60])
        if r.status_code == 404:
            return "F 404 not found"
        return "F HTTP %d %s" % (r.status_code, str(r.text)[:80])
    except Exception as e:
        return "F ERR %s" % str(e)[:70]


def main():
    fails, warns = [], []
    for ep in ENDPOINTS:
        if ep in DANGEROUS:
            continue  # 危险端点不自动探测
        mtd, pth = ep.split(" ", 1)
        res = probe(mtd, pth, ep)
        if res and res.startswith("F"):
            fails.append((ep, res))
        elif res and res.startswith("W"):
            warns.append((ep, res))
    for name, routes in PLUGIN_ROUTES.items():
        for r in ["/__health"] + routes:
            p = "/api/plugins/%s%s" % (name, r)
            res = probe("GET", p, name + r)
            if res and res.startswith("F"):
                fails.append((name + r, res))
            elif res and res.startswith("W"):
                warns.append((name + r, res))
    print("主系统端点: %d" % len(ENDPOINTS))
    print("插件路由: %d" % sum(len(v) + 1 for v in PLUGIN_ROUTES.values()))
    print("\n=== FAIL(%d) ===" % len(fails))
    for ep, d in fails:
        print("  ❌ %s: %s" % (ep, d))
    print("=== WARN(%d) ===" % len(warns))
    for ep, d in warns:
        print("  ⚠️ %s: %s" % (ep, d))
    print(json.dumps({"fails": fails, "warns": warns}, ensure_ascii=False))


if __name__ == "__main__":
    main()