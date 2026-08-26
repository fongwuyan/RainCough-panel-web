#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""uptime v2 插件子进程 — 独立运行, 不依赖面板代码。

协议(RainCough 插件 v2):
- 监听环境变量 RAINCOUGH_PORT 指定的 127.0.0.1 端口
- GET /__health -> 200 表示就绪
- 其余路径与 /api/plugins/uptime/* 一一对应(GET/POST/DELETE)
- 数据经 RAINCOUGH_DB_DSN + RAINCOUGH_NS 直连共用数据层(namespace KV)

数据模型(存于 ns_<name>_kv):
  uptime:targets   -> 所有监控目标与历史
"""
import os
import json
import time
import threading
import sqlite3
import urllib.request
import urllib.error
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "uptime")
DSN = os.environ.get("RAINCOUGH_DB_DSN", "")

HISTORY_LIMIT = 2880   # 保留 2880 条历史(2s 粒度约 1.6h)
TICK_SECONDS = 10      # 探活间隔

_lock = threading.RLock()
_targets = {}          # name -> {url, interval, timeout, last_status, last_ms, avail, history:[...]}
_initialized = False


# ---------- 数据层(SharedData namespace KV) ----------

def _kv_conn():
    """按 DSN 连接 KV 存储(仅 sqlite/mysql; mysql 需 pymysql)。"""
    if DSN.startswith("sqlite:///"):
        path = DSN[len("sqlite:///"):]
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn
    if DSN.startswith("mysql://"):
        try:
            import pymysql
        except ImportError:
            raise RuntimeError("mysql DSN 需要插件自带 pymysql")
        rest = DSN[len("mysql://"):]
        cred, _, hp = rest.partition("@")
        user, _, pw = cred.partition(":")
        host, _, port = hp.partition(":")
        db = "raincough"
        if "/" in port:
            port, _, db = port.partition("/")
        conn = pymysql.connect(host=host, port=int(port or 3306), user=user,
                               password=pw, database=db, charset="utf8mb4")
        return conn
    raise RuntimeError("unsupported DSN: " + DSN)


def _ensure_table(conn):
    tbl = "ns_%s_kv" % NS
    if DSN.startswith("sqlite:///"):
        conn.execute("CREATE TABLE IF NOT EXISTS %s (key TEXT PRIMARY KEY,"
                     " value TEXT NOT NULL, updated_at INTEGER NOT NULL)" % tbl)
    else:
        conn.execute("CREATE TABLE IF NOT EXISTS %s (key VARCHAR(255) PRIMARY KEY,"
                     " value TEXT NOT NULL, updated_at BIGINT NOT NULL) "
                     "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" % tbl)
    conn.commit()


def _ns_set(key, value):
    with _lock:
        conn = _kv_conn()
        try:
            _ensure_table(conn)
            raw = json.dumps(value, ensure_ascii=False)
            tbl = "ns_%s_kv" % NS
            if DSN.startswith("sqlite:///"):
                conn.execute("INSERT INTO %s (key,value,updated_at) VALUES (?,?,?) "
                             "ON CONFLICT(key) DO UPDATE SET value=excluded.value,"
                             " updated_at=excluded.updated_at" % tbl,
                             (key, raw, int(time.time())))
            else:
                conn.execute("INSERT INTO %s (key,value,updated_at) VALUES (%s,%s,%s) "
                             "ON DUPLICATE KEY UPDATE value=VALUES(value),"
                             " updated_at=VALUES(updated_at)" % tbl, (key, raw, int(time.time())))
            conn.commit()
        finally:
            conn.close()


def _ns_get(key, default=None):
    with _lock:
        conn = _kv_conn()
        try:
            _ensure_table(conn)
            tbl = "ns_%s_kv" % NS
            cur = conn.cursor()
            cur.execute("SELECT value FROM %s WHERE key=?" % tbl, (key,))
            row = cur.fetchone()
            if row:
                return json.loads(row[0]) if isinstance(row, tuple) else json.loads(row["value"])
            return default
        finally:
            conn.close()


# ---------- 目标管理 ----------

def _load():
    global _targets, _initialized
    with _lock:
        if _initialized:
            return
        try:
            data = _ns_get("uptime:targets", {}) or {}
            _targets = data if isinstance(data, dict) else {}
        except Exception:
            _targets = {}
        _initialized = True


def _save():
    with _lock:
        try:
            _ns_set("uptime:targets", _targets)
        except Exception as e:
            print("save failed:", e, file=os.sys.stderr)


# ---------- 探活 ----------

def probe(url, timeout):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "raincough-uptime/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ms = int((time.time() - t0) * 1000)
            return True, ms, r.status
    except urllib.error.HTTPError as e:
        ms = int((time.time() - t0) * 1000)
        return e.code < 500, ms, e.code
    except Exception:
        ms = int((time.time() - t0) * 1000)
        return False, ms, -1


def _check_target(name):
    t = _targets.get(name)
    if not t:
        return
    url = t.get("url", "")
    timeout = int(t.get("timeout", 5))
    ok, ms, code = probe(url, timeout)
    now = time.time()
    t["last_status"] = bool(ok)
    t["last_ms"] = ms
    t["last_code"] = code
    t["last_check"] = int(now)
    hist = t.setdefault("history", [])
    s = int(now // TICK_SECONDS)
    if hist and hist[-1].get("ts") == s:
        hist[-1]["ok"] = bool(ok)
        hist[-1]["ms"] = ms
    else:
        hist.append({"ts": s, "ok": bool(ok), "ms": ms})
    if len(hist) > HISTORY_LIMIT:
        del hist[:len(hist) - HISTORY_LIMIT]
    # 可用率(近 100 次)
    recent = hist[-100:]
    if recent:
        t["avail"] = round(sum(1 for h in recent if h["ok"]) / len(recent) * 100, 1)


def _worker():
    while True:
        with _lock:
            names = list(_targets.keys())
        for name in names:
            with _lock:
                t = _targets.get(name)
                if not t or not t.get("enabled", True):
                    continue
                interval = int(t.get("interval", 60))
            # 到点才探
            if time.time() - t.get("last_check", 0) >= interval:
                with _lock:
                    _check_target(name)
                _save()
        time.sleep(2)


# ---------- HTTP ----------

class Handler(http.server.BaseHTTPRequestHandler):
    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def do_GET(self):
        p = self.path
        if p == "/__health":
            self._json(200, {"status": "ok"})
            return
        if p == "/targets":
            out = {}
            with _lock:
                for k, v in _targets.items():
                    out[k] = {kk: vv for kk, vv in v.items() if kk != "history"}
                    out[k]["history_len"] = len(v.get("history", []))
            self._json(200, {"targets": out})
            return
        # /targets/<name>
        if p.startswith("/targets/"):
            name = p[len("/targets/"):]
            with _lock:
                t = _targets.get(name)
            if not t:
                self._json(404, {"error": "目标不存在"})
                return
            self._json(200, t)
            return
        if p.startswith("/history/"):
            name = p[len("/history/"):]
            with _lock:
                t = _targets.get(name)
            if not t:
                self._json(404, {"error": "目标不存在"})
                return
            self._json(200, {"name": name, "history": t.get("history", [])})
            return
        self._json(404, {"error": "not found: " + p})

    def do_POST(self):
        if self.path == "/targets":
            try:
                data = json.loads(self._body() or b"{}")
            except Exception:
                self._json(400, {"error": "bad json"})
                return
            name = str(data.get("name") or "").strip()
            url = str(data.get("url") or "").strip()
            if not name or not url.startswith("http"):
                self._json(400, {"error": "name 与合法 url 必填"})
                return
            with _lock:
                t = _targets.get(name, {"name": name, "url": url,
                                        "interval": int(data.get("interval", 60)),
                                        "timeout": int(data.get("timeout", 5)),
                                        "enabled": True,
                                        "history": [],
                                        "avail": 0})
                t.update({"url": url})
                _targets[name] = t
            _save()
            with _lock:
                self._json(200, _targets[name])
            return
        if self.path.startswith("/targets/") and self.path.endswith("/enable"):
            name = self.path[len("/targets/"):-len("/enable")]
            with _lock:
                t = _targets.get(name)
                if t:
                    t["enabled"] = True
            _save()
            self._json(200, {"status": True})
            return
        self._json(404, {"error": "not found"})

    def do_DELETE(self):
        if self.path.startswith("/targets/"):
            name = self.path[len("/targets/"):]
            with _lock:
                removed = _targets.pop(name, None)
            if removed is None:
                self._json(404, {"error": "目标不存在"})
                return
            _save()
            self._json(200, {"status": True, "name": name})
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass  # 安静


def main():
    if PORT <= 0:
        print("RAINCOUGH_PORT 未设置", file=os.sys.stderr)
        raise SystemExit(1)
    _load()
    threading.Thread(target=_worker, daemon=True).start()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("uptime plugin ready on %d ns=%s" % (PORT, NS), file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()