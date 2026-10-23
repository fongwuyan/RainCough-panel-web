#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""atk 数据层: sqlite3 存取 + 长任务运行表。

为什么用 sqlite 而不是 json: 资产与风险是结构化、需要筛选与跨任务统计的数据,
整份 json 读写会随数据量线性变慢(uptime 那种做法在这里不适用)。

表名统一 atk_ 前缀(宿主不校验, 只为可读)。
"""
import json
import os
import sqlite3
import threading
import time

# 插件根目录: core/store.py -> plugins/atk
PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PLUGIN_DIR, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
DB_PATH = os.path.join(DATA_DIR, "atk.db")

_LOCK = threading.RLock()
_conn = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS atk_task (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  target      TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS atk_asset (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL,
  addr        TEXT NOT NULL,
  port        INTEGER NOT NULL DEFAULT 0,
  kind        TEXT NOT NULL DEFAULT '',
  stack       TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT '',
  extra       TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_atk_asset
  ON atk_asset(task_id, addr, port, kind);
CREATE INDEX IF NOT EXISTS ix_atk_asset_task ON atk_asset(task_id);

CREATE TABLE IF NOT EXISTS atk_risk (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL,
  asset_id    INTEGER NOT NULL DEFAULT 0,
  level       TEXT NOT NULL DEFAULT '低危',
  kind        TEXT NOT NULL DEFAULT '',
  target      TEXT NOT NULL DEFAULT '',
  evidence    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '待确认',
  detail      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_atk_risk_task ON atk_risk(task_id);

CREATE TABLE IF NOT EXISTS atk_evidence (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  risk_id     INTEGER NOT NULL,
  task_id     INTEGER NOT NULL DEFAULT 0,
  request     TEXT NOT NULL DEFAULT '',
  response    TEXT NOT NULL DEFAULT '',
  conclusion  TEXT NOT NULL DEFAULT '',
  poc         TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS atk_artifact (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL DEFAULT 0,
  filename    TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT '',
  meta        TEXT NOT NULL DEFAULT '',
  path        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS atk_dataset (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL DEFAULT 0,
  source_url  TEXT NOT NULL DEFAULT '',
  rows_json   TEXT NOT NULL DEFAULT '[]',
  count       INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
"""


def now():
    return int(time.time())


def conn():
    """取连接(单例)。sqlite3 连接本身不是线程安全的, 所有访问都在 _LOCK 内。"""
    global _conn
    with _LOCK:
        if _conn is None:
            os.makedirs(DATA_DIR, exist_ok=True)
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            _conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
            _conn.row_factory = sqlite3.Row
            # WAL: 扫描线程写资产的同时前端在读列表, 不互相阻塞
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.execute("PRAGMA synchronous=NORMAL")
            _conn.executescript(SCHEMA)
            _conn.commit()
        return _conn


def q(sql, args=()):
    with _LOCK:
        cur = conn().execute(sql, args)
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()
        return rows


def q1(sql, args=()):
    r = q(sql, args)
    return r[0] if r else None


def ex(sql, args=()):
    with _LOCK:
        c = conn()
        cur = c.execute(sql, args)
        c.commit()
        last = cur.lastrowid
        cur.close()
        return last


# ---------------------------------------------------------------- 任务

def task_create(name, target="", note=""):
    ts = now()
    tid = ex(
        "INSERT INTO atk_task(name, target, note, status, created_at, updated_at) "
        "VALUES(?,?,?,?,?,?)",
        ((name or "").strip() or "未命名任务", (target or "").strip(), note or "", "active", ts, ts),
    )
    return task_get(tid)


def task_get(tid):
    t = q1("SELECT * FROM atk_task WHERE id=?", (int(tid),))
    if not t:
        return None
    t["counts"] = task_counts(tid)
    return t


def task_list():
    rows = q("SELECT * FROM atk_task ORDER BY updated_at DESC, id DESC")
    for t in rows:
        t["counts"] = task_counts(t["id"])
    return rows


def task_counts(tid):
    a = q1("SELECT COUNT(*) AS n FROM atk_asset WHERE task_id=?", (int(tid),))
    r = q1("SELECT COUNT(*) AS n FROM atk_risk WHERE task_id=?", (int(tid),))
    e = q1("SELECT COUNT(*) AS n FROM atk_artifact WHERE task_id=?", (int(tid),))
    return {"assets": a["n"] if a else 0, "risks": r["n"] if r else 0, "artifacts": e["n"] if e else 0}


def task_touch(tid):
    ex("UPDATE atk_task SET updated_at=? WHERE id=?", (now(), int(tid)))


def task_delete(tid):
    tid = int(tid)
    for tb in ("atk_asset", "atk_risk", "atk_artifact", "atk_dataset"):
        ex("DELETE FROM %s WHERE task_id=?" % tb, (tid,))
    ex("DELETE FROM atk_evidence WHERE task_id=?", (tid,))
    ex("DELETE FROM atk_task WHERE id=?", (tid,))


# ---------------------------------------------------------------- 资产

def asset_upsert(task_id, addr, port=0, kind="", stack="", source="", extra=""):
    """按 (task_id, addr, port, kind) 去重; 命中时补全更详细的字段。

    返回 (asset_id, is_new)。
    """
    ts = now()
    addr = (addr or "").strip()
    if not addr:
        return 0, False
    port = int(port or 0)
    old = q1(
        "SELECT id, stack, source, extra FROM atk_asset "
        "WHERE task_id=? AND addr=? AND port=? AND kind=?",
        (int(task_id), addr, port, kind or ""),
    )
    if old:
        # 只在新值更"有内容"时覆盖, 避免后来的空值把已有指纹冲掉
        nstack = stack or old["stack"]
        nsource = _merge_source(old["source"], source)
        nextra = extra or old["extra"]
        if (nstack, nsource, nextra) != (old["stack"], old["source"], old["extra"]):
            ex("UPDATE atk_asset SET stack=?, source=?, extra=? WHERE id=?",
               (nstack, nsource, nextra, old["id"]))
        return old["id"], False
    aid = ex(
        "INSERT INTO atk_asset(task_id, addr, port, kind, stack, source, extra, created_at) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (int(task_id), addr, port, kind or "", stack or "", source or "", extra or "", ts),
    )
    return aid, True


def _merge_source(a, b):
    parts = [x for x in (a or "").split(",") if x.strip()]
    for x in (b or "").split(","):
        x = x.strip()
        if x and x not in parts:
            parts.append(x)
    return ",".join(parts)


def asset_list(task_id, kind="", qtext=""):
    sql = "SELECT * FROM atk_asset WHERE task_id=?"
    args = [int(task_id)]
    if kind:
        sql += " AND kind=?"
        args.append(kind)
    if qtext:
        sql += " AND (addr LIKE ? OR stack LIKE ? OR source LIKE ?)"
        like = "%" + qtext + "%"
        args += [like, like, like]
    sql += " ORDER BY kind, addr, port"
    return q(sql, args)


def asset_delete(aid):
    ex("DELETE FROM atk_asset WHERE id=?", (int(aid),))


# ---------------------------------------------------------------- 风险

def risk_add(task_id, asset_id, level, kind, target, evidence, detail=""):
    rid = ex(
        "INSERT INTO atk_risk(task_id, asset_id, level, kind, target, evidence, status, detail, created_at) "
        "VALUES(?,?,?,?,?,?,?,?,?)",
        (int(task_id), int(asset_id or 0), level, kind, target, evidence, "待确认",
         detail or "", now()),
    )
    return rid


def risk_list(task_id, level="", status=""):
    sql = "SELECT * FROM atk_risk WHERE task_id=?"
    args = [int(task_id)]
    if level:
        sql += " AND level=?"
        args.append(level)
    if status:
        sql += " AND status=?"
        args.append(status)
    sql += " ORDER BY CASE level WHEN '高危' THEN 0 WHEN '中危' THEN 1 ELSE 2 END, id"
    return q(sql, args)


def risk_get(rid):
    return q1("SELECT * FROM atk_risk WHERE id=?", (int(rid),))


def risk_mark(rid, status):
    ex("UPDATE atk_risk SET status=? WHERE id=?", (status, int(rid)))


def risk_delete(rid):
    ex("DELETE FROM atk_risk WHERE id=?", (int(rid),))


# ---------------------------------------------------------------- 提取物

def artifact_add(task_id, filename, kind, meta, path=""):
    return ex(
        "INSERT INTO atk_artifact(task_id, filename, kind, meta, path, created_at) "
        "VALUES(?,?,?,?,?,?)",
        (int(task_id or 0), filename, kind, meta if isinstance(meta, str) else json.dumps(meta, ensure_ascii=False),
         path, now()),
    )


def artifact_list(task_id):
    return q("SELECT * FROM atk_artifact WHERE task_id=? ORDER BY id DESC", (int(task_id),))


# ---------------------------------------------------------------- 运行表(内存)

_RUNS = {}
_RUN_LOCK = threading.Lock()
RUN_KEEP = 40          # 只留最近 40 个运行记录, 防止长期运行内存涨


def run_new(task_id, kind, total=0):
    rid = "%s-%d-%04d" % (kind, int(time.time()), int(time.time() * 1000) % 10000)
    with _RUN_LOCK:
        _RUNS[rid] = {
            "id": rid, "task_id": int(task_id), "kind": kind,
            "status": "queued", "stage": "准备中", "done": 0, "total": int(total),
            "started_at": now(), "ended_at": 0, "error": "", "stats": {},
            "log": [],
        }
        if len(_RUNS) > RUN_KEEP:
            for k in sorted(_RUNS, key=lambda x: _RUNS[x]["started_at"])[:len(_RUNS) - RUN_KEEP]:
                _RUNS.pop(k, None)
    return rid


def run_get(rid):
    with _RUN_LOCK:
        r = _RUNS.get(rid)
        return dict(r) if r else None


def run_latest(task_id, kind=None):
    with _RUN_LOCK:
        cand = [r for r in _RUNS.values() if r["task_id"] == int(task_id) and (kind is None or r["kind"] == kind)]
        if not cand:
            return None
        return dict(max(cand, key=lambda x: x["started_at"]))


def run_patch(rid, **kw):
    with _RUN_LOCK:
        r = _RUNS.get(rid)
        if not r:
            return
        r.update(kw)


def run_log(rid, msg):
    with _RUN_LOCK:
        r = _RUNS.get(rid)
        if not r:
            return
        r["log"].append("%s %s" % (time.strftime("%H:%M:%S"), msg))
        if len(r["log"]) > 200:
            r["log"] = r["log"][-200:]


def run_incr(rid, n=1):
    with _RUN_LOCK:
        r = _RUNS.get(rid)
        if r:
            r["done"] = min(r["done"] + n, r["total"] or (r["done"] + n))
