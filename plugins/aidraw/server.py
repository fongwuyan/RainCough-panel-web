#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""aidraw 插件后端：存活探测 + 服务端历史画廊持久化。

生图任务仍由前端调用面板 /api/node-jobs；这里只负责历史记录。
"""
import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
MAX_ITEMS = 500
_lock = threading.RLock()


def _load():
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, dict) and isinstance(d.get("items"), list):
            return d["items"]
        if isinstance(d, list):
            return d
    except Exception:
        pass
    return []


def _save(items):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = HISTORY_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"items": items[:MAX_ITEMS], "updated": int(time.time())},
                  f, ensure_ascii=False)
    os.replace(tmp, HISTORY_FILE)


@rc.interface("aidraw.ping")
def aidraw_ping(params):
    return {"ok": True, "plugin": "aidraw"}


@rc.interface("aidraw.history.list")
def history_list(params):
    with _lock:
        items = _load()
    try:
        limit = int((params or {}).get("limit") or 200)
    except Exception:
        limit = 200
    limit = max(1, min(MAX_ITEMS, limit))
    return {"ok": True, "items": items[:limit], "total": len(items)}


@rc.interface("aidraw.history.add")
def history_add(params):
    item = (params or {}).get("item")
    if not isinstance(item, dict):
        raise rc.RCError(400, "item required")
    item = dict(item)
    item.setdefault("id", "h_" + str(int(time.time() * 1000)))
    with _lock:
        items = _load()
        items = [x for x in items if x.get("id") != item.get("id")]
        items.insert(0, item)
        _save(items)
    return {"ok": True, "id": item["id"], "total": len(items)}


@rc.interface("aidraw.history.delete")
def history_delete(params):
    hid = str((params or {}).get("id") or "")
    if not hid:
        raise rc.RCError(400, "id required")
    with _lock:
        items = [x for x in _load() if x.get("id") != hid]
        _save(items)
    return {"ok": True, "total": len(items)}


@rc.interface("aidraw.history.clear")
def history_clear(params):
    with _lock:
        _save([])
    return {"ok": True}


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="aidraw",
        version="1.4.0",
        manifest={"label": "AI 绘图", "description": "节点生图"},
        frontend={"pages": [{"path": "", "title": "AI 绘图"}]},
        iface_ids=None,
        plugin_dir=here,
    )
