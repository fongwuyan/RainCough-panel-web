#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""uptime 插件后端(接口库 v4) — 由 v3 server.py 迁移。

数据: 插件目录 data/uptime.json(与 v3 一致, 数据不迁移)
功能: 站点探活监控, 定时检测 HTTP 目标在线状态、响应时间与可用率。
通信: 无端口, 经 rcplugin SDK 自注册; 接口 id 见下方 @rc.interface。
"""
import os
import json
import sys
import threading
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PLUGIN_DIR, "data")
STORE_FILE = os.path.join(DATA_DIR, "uptime.json")

HISTORY_LIMIT = 2880
TICK_SECONDS = 2

_lock = threading.RLock()
_loaded = False
_targets = {}


# ---- 数据层(沿用 v3) ----

def _load():
    global _targets, _loaded
    with _lock:
        if _loaded:
            return _targets
        _loaded = True
        if os.path.isfile(STORE_FILE):
            try:
                with open(STORE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                _targets = data if isinstance(data, dict) else {}
            except Exception:
                _targets = {}
        else:
            _targets = {}
        return _targets


def _save():
    with _lock:
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(_targets, f, ensure_ascii=False, indent=2)
        except Exception:
            pass


def _window_uptime(name):
    t = _targets.get(name)
    if not t:
        return None
    history = t.get("history", [])
    if not history:
        return None
    cutoff = time.time() - 86400
    recent = [h for h in history if h.get("ts", 0) >= cutoff]
    if not recent:
        return None
    ok = sum(1 for h in recent if h.get("ok"))
    return round(ok * 100.0 / len(recent), 1)


def _probe(name):
    t = _targets.get(name)
    if not t:
        return None
    method = t.get("method", "GET")
    timeout = float(t.get("timeout", 10))
    expected = int(t.get("expected_status", 200))
    start = time.time()
    try:
        r = requests.request(method, t["url"], timeout=timeout,
                             allow_redirects=True,
                             headers={"User-Agent": "uptime-monitor/1.0"})
        ok = r.status_code == expected
        ms = round((time.time() - start) * 1000)
    except Exception:
        ok = False
        ms = round((time.time() - start) * 1000)
    now = time.time()
    with _lock:
        t = _targets.get(name)
        if t:
            hist = t.setdefault("history", [])
            hist.append({"ts": int(now), "ok": ok, "ms": ms})
            if len(hist) > HISTORY_LIMIT:
                del hist[:len(hist) - HISTORY_LIMIT]
            t["last_check"] = int(now)
            t["last_ms"] = ms
            t["last_ok"] = ok
            if ok:
                t["last_up"] = int(now)
            else:
                t["last_down"] = int(now)
            t["uptime"] = _window_uptime(name)
        _save()
    return ok, ms


def _checker_loop():
    while True:
        time.sleep(TICK_SECONDS)
        now = time.time()
        targets = dict(_targets)
        for name, t in targets.items():
            interval = max(int(t.get("interval", 60)), 5)
            last = t.get("last_check", 0)
            if now - last >= interval:
                try:
                    _probe(name)
                except Exception:
                    pass


def _sanitize(name):
    t = _targets.get(name)
    if not t:
        return None
    return {
        "name": name,
        "url": t.get("url", ""),
        "method": t.get("method", "GET"),
        "timeout": t.get("timeout", 10),
        "interval": t.get("interval", 60),
        "expected_status": t.get("expected_status", 200),
        "last_check": t.get("last_check"),
        "last_ms": t.get("last_ms"),
        "last_ok": t.get("last_ok"),
        "last_up": t.get("last_up"),
        "last_down": t.get("last_down"),
        "uptime": t.get("uptime"),
        "history_count": len(t.get("history", [])),
    }


# ---- 接口实现(由 v3 路由逐一对齐) ----

def _param(params, key, default=""):
    if isinstance(params, dict):
        v = params.get(key, default)
        return str(v) if v is not None else default
    return default


@rc.interface("uptime.targets.list")
def targets_list(params):
    _load()
    result = [_sanitize(n) for n in _targets]
    result.sort(key=lambda x: x["name"])
    return {"targets": result}


@rc.interface("uptime.targets.create")
def targets_create(params):
    name = _param(params, "name").strip()
    url = _param(params, "url").strip()
    if not name or not url:
        raise rc.RCError(3000, "name 与 url 必填")
    _load()
    if name in _targets:
        raise rc.RCError(3000, "目标已存在")
    if not url.startswith(("http://", "https://")):
        raise rc.RCError(3000, "url 需以 http(s):// 开头")
    try:
        timeout = int(_param(params, "timeout", 10))
        interval = int(_param(params, "interval", 60))
        expected = int(_param(params, "expected_status", 200))
    except (TypeError, ValueError):
        raise rc.RCError(3000, "timeout/interval/expected_status 需为数字")
    if interval < 5:
        interval = 5
    method = _param(params, "method", "GET").upper()
    if method not in ("GET", "HEAD"):
        method = "GET"
    with _lock:
        _targets[name] = {
            "url": url, "method": method, "timeout": timeout,
            "interval": interval, "expected_status": expected,
            "history": [], "created": int(time.time()),
        }
        _save()
    return {"target": _sanitize(name)}


@rc.interface("uptime.targets.update")
def targets_update(params):
    name = _param(params, "name").strip()
    _load()
    if name not in _targets:
        raise rc.RCError(3000, "目标不存在")
    t = _targets[name]
    url = _param(params, "url").strip()
    if url:
        if not url.startswith(("http://", "https://")):
            raise rc.RCError(3000, "url 需以 http(s):// 开头")
        t["url"] = url
    if _param(params, "method"):
        method = _param(params, "method").upper()
        if method in ("GET", "HEAD"):
            t["method"] = method
    for key in ("timeout", "interval", "expected_status"):
        if isinstance(params, dict) and key in params and params[key] not in (None, ""):
            try:
                val = int(params[key])
            except (TypeError, ValueError):
                raise rc.RCError(3000, "%s 需为数字" % key)
            if key == "interval" and val < 5:
                val = 5
            t[key] = val
    with _lock:
        _save()
    return {"target": _sanitize(name)}


@rc.interface("uptime.targets.delete")
def targets_delete(params):
    name = _param(params, "name").strip()
    _load()
    if name not in _targets:
        raise rc.RCError(3000, "目标不存在")
    with _lock:
        del _targets[name]
        _save()
    return {"ok": True}


@rc.interface("uptime.targets.test")
def targets_test(params):
    name = _param(params, "name").strip()
    _load()
    if name not in _targets:
        raise rc.RCError(3000, "目标不存在")
    t = _targets[name]
    try:
        r = requests.request(t.get("method", "GET"), t["url"],
                             timeout=float(t.get("timeout", 10)),
                             allow_redirects=True,
                             headers={"User-Agent": "uptime-monitor/1.0"})
        return {"name": name, "ok": r.status_code == int(t.get("expected_status", 200)),
                "ms": int(r.elapsed.total_seconds() * 1000),
                "status_code": r.status_code,
                "expected": int(t.get("expected_status", 200))}
    except requests.exceptions.Timeout:
        return {"name": name, "ok": False,
                "ms": int(t.get("timeout", 10) * 1000), "error": "连接超时"}
    except Exception as e:
        return {"name": name, "ok": False, "ms": 0, "error": str(e)}


@rc.interface("uptime.targets.history")
def targets_history(params):
    name = _param(params, "name").strip()
    _load()
    t = _targets.get(name)
    return {"history": t.get("history", []) if t else []}


@rc.interface("uptime.targets.status24")
def targets_status24(params):
    name = _param(params, "name").strip()
    _load()
    t = _targets.get(name)
    if not t:
        return {"cells": []}
    hist = t.get("history", [])
    bucket = 300
    buckets = 288
    now = int(time.time())
    start = now - buckets * bucket
    cells = [None] * buckets
    prev = None
    for h in hist:
        ts = h.get("ts", 0)
        if ts < start:
            continue
        idx = (ts - start) // bucket
        if 0 <= idx < buckets:
            ok = 1 if h.get("ok") else 0
            cells[idx] = ok
            prev = ok
    result = []
    for c in cells:
        if c is None:
            c = prev
        result.append(c)
    return {"cells": result}


@rc.interface("uptime.status")
def uptime_status(params):
    _load()
    total = len(_targets)
    online = sum(1 for n in _targets if _targets[n].get("last_ok"))
    offline = total - online
    u = [t.get("uptime") for t in _targets.values() if t.get("uptime") is not None]
    avg = round(sum(u) / len(u), 1) if u else None
    return {"total": total, "online": online, "offline": offline, "avg_uptime": avg}


@rc.interface("uptime.info")
def uptime_info(params):
    return {"name": "uptime", "label": "Uptime 监控", "version": "3.0.0", "lang": "python",
            "description": "站点探活监控: 定时检测 HTTP 目标在线状态、响应时间与可用率"}


if __name__ == "__main__":
    _load()
    threading.Thread(target=_checker_loop, daemon=True).start()
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="uptime",
        version="3.0.0",
        manifest={"label": "Uptime 监控", "description": "站点探活监控"},
        frontend={"pages": [{"path": "", "title": "监控目标"}]},
        iface_ids=[
            "uptime.targets.list", "uptime.targets.create", "uptime.targets.update",
            "uptime.targets.delete", "uptime.targets.test", "uptime.targets.history",
            "uptime.targets.status24", "uptime.status", "uptime.info",
        ],
        plugin_dir=PLUGIN_DIR,
    )