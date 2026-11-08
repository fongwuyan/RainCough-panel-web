#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""vqueue 端到端自测: 起一个带各种毛病的本地 HTTP 服务, 造风险, 跑队列, 看判定。

用法: python tools/test-vqueue.py
不碰 data/atk.db —— 库路径被指到临时目录, 跑完自动清。
"""
import json
import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import unquote

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

from core import store  # noqa: E402

TMP = tempfile.mkdtemp(prefix="atk-vq-")
store.DATA_DIR = TMP
store.UPLOAD_DIR = os.path.join(TMP, "uploads")
store.DB_PATH = os.path.join(TMP, "t.db")
store._conn = None

from modules import vqueue  # noqa: E402

PORT = 0


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="text/html; charset=utf-8", extra=None):
        raw = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/":
            self._send(200, "<html><body>hello</body></html>")
        elif p == "/.git/config":
            self._send(200, "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
                       "text/plain")
        elif p == "/.env":
            self._send(200, "DB_PASSWORD=s3cr3t\nAPP_KEY=abc\n", "text/plain")
        elif p == "/backup.zip":
            self._send(200, "PK\x03\x04fake-zip-body", "application/zip")
        elif p == "/search":
            q = unquote(self.path.split("q=")[-1]) if "q=" in self.path else ""
            # 原样反射 —— 模拟最典型的 XSS
            self._send(200, "<html><body>result: " + q + "</body></html>")
        elif p == "/list":
            self._send(200, "<html><body>Index of /</body></html>")
        else:
            self._send(404, "<html><body>not found</body></html>")


def main():
    global PORT
    srv = HTTPServer(("127.0.0.1", 0), H)
    PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % PORT
    print("测试服务:", base)

    t = store.task_create("vq 自测", base)
    tid = t["id"]
    cases = [
        # (资产地址, 端口, 风险 kind, 证据, 期望判定)
        ("127.0.0.1", PORT, "安全响应头缺失", "缺少 HSTS、X-Frame-Options、Referrer-Policy", "确认"),
        ("127.0.0.1/.git/config", PORT, "Git 仓库暴露", "路径命中: /.git/config", "确认"),
        ("127.0.0.1/.env", PORT, "环境变量文件暴露", "路径命中: /.env", "确认"),
        ("127.0.0.1/backup.zip", PORT, "备份文件暴露", "路径命中: /backup.zip", "确认"),
        ("127.0.0.1/nope.sql", PORT, "备份文件暴露", "路径命中: /nope.sql", "误报"),
        ("127.0.0.1", PORT, "目录列举", "页面包含目录索引", "疑似"),
        ("127.0.0.1/search?q=1", PORT, "跨站脚本", "参数反射", "确认"),
        ("127.0.0.1", PORT, "版本信息泄露", "Server: BaseHTTP/0.6", "确认"),
        ("127.0.0.1", PORT, "SQL 注入", "疑似注入点", "需人工"),
        ("127.0.0.1", PORT, "越权", "越权访问", "需人工"),
    ]
    for addr, port, kind, ev, want in cases:
        aid, _ = store.asset_upsert(tid, addr, port, "Path" if "/" in addr else "Web",
                                    "HTTP 200", "自测", "")
        rid = store.risk_add(tid, aid, "中危", kind, addr, ev, "")
        print("  建风险 #%d %-16s → 期望 %s" % (rid, kind, want))

    r = vqueue.enqueue(tid)
    print("入队:", r)
    assert r["added"] == len(cases), "入队数量不对: %s" % r

    rid, n = vqueue.run(tid)
    # 等跑完
    import time
    for _ in range(120):
        run = store.run_get(rid)
        if run["status"] in ("completed", "failed"):
            break
        time.sleep(0.2)
    run = store.run_get(rid)
    print("运行状态:", run["status"], run.get("stats"), run.get("error") or "")

    rows = vqueue.rows(tid)
    bad = 0
    print("\n%-18s %-8s %-6s %s" % ("风险类型", "判定", "期望", "依据"))
    print("-" * 96)
    for row, (_, _, kind, _, want) in zip(rows, cases):
        mark = "OK " if row["verdict"] == want else "!! "
        if row["verdict"] != want:
            bad += 1
        print("%s%-16s %-8s %-6s %s" % (mark, row["kind"], row["verdict"], want, row["note"][:52]))

    # 风险状态回写检查
    rs = store.risk_list(tid)
    print("\n风险状态回写:", ", ".join("%s=%s" % (x["kind"], x["status"]) for x in rs[:4]))

    srv.shutdown()
    print("\n结果: %d/%d 符合预期" % (len(cases) - bad, len(cases)))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
