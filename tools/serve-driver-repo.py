#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地冒充主面板库的 drivers/ 目录 —— 用于端到端自测，不用联网、不用真发布。

模拟三种取法（扩展的下载器按这个阶梯取）：
  1) 直连 GitHub raw:  /fongwuyan/RainCough-panel-web/main/drivers/registry.json
  2) raw 显式形式:      /fongwuyan/RainCough-panel-web/raw/main/drivers/...
  3) 极简直取:          /drivers/registry.json
另含 GitHub contents API 形态（可选）：
  - /repos/<owner>/<repo>/contents/<path>?ref=<branch>  →  base64 JSON

用法:
  python3 serve-driver-repo.py --root ./out --port 8199
  # 私有仓库模拟（要求 access_token 或 Authorization: token <t>）
  python3 serve-driver-repo.py --root ./out --port 8199 --token secret
"""

import argparse
import base64
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

ROOT = "."
TOKEN = ""
OWNERS = ("fongwuyan",)


def safe_join(root, rel):
    rel = unquote(rel or "").lstrip("/")
    if ".." in rel.split("/"):
        return None
    p = os.path.normpath(os.path.join(root, rel))
    if not p.startswith(os.path.abspath(root)):
        return None
    return p


class H(BaseHTTPRequestHandler):
    server_version = "rc-driver-repo/1.0"

    def log_message(self, fmt, *a):
        sys.stderr.write("[repo] %s\n" % (fmt % a))

    def _json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _file(self, path, code=200):
        if not path or not os.path.isfile(path):
            self._json({"message": "not found"}, 404)
            return
        size = os.path.getsize(path)
        self.send_response(code)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(size))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        with open(path, "rb") as f:
            while True:
                b = f.read(1 << 16)
                if not b:
                    break
                self.wfile.write(b)

    def _auth_ok(self, q):
        if not TOKEN:
            return True
        if (q.get("access_token") or [""])[0] == TOKEN:
            return True
        h = self.headers.get("Authorization", "")
        return h in ("token %s" % TOKEN, "Bearer %s" % TOKEN)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        path = u.path
        branch = (q.get("ref") or q.get("branch") or ["main"])[0]

        if not self._auth_ok(q):
            self._json({"message": "403 Forbidden (需要 access_token)"}, 403)
            return

        # 极简直取
        if path == "/health":
            self._json({"ok": True, "root": os.path.abspath(ROOT)})
            return

        # GitHub contents API 形态：/repos/<owner>/<repo>/contents/<path>
        m = re.match(r"^/repos/([^/]+)/([^/]+)/contents/(.+)$", path)
        if m:
            fp = safe_join(ROOT, m.group(3))
            if not fp or not os.path.isfile(fp):
                self._json({"message": "Not Found"}, 404)
                return
            with open(fp, "rb") as f:
                content = base64.b64encode(f.read()).decode()
            self._json({"name": os.path.basename(fp), "path": m.group(3),
                        "encoding": "base64", "content": content,
                        "size": os.path.getsize(fp)})
            return

        # 面板库 raw 形态： /<owner>/<repo>/raw/<branch>/<path>
        m = re.match(r"^/([^/]+)/([^/]+)/raw/([^/]+)/(.+)$", path)
        if m:
            self._file(safe_join(ROOT, m.group(4)))
            return

        # 直连 raw.githubusercontent 风格： /<owner>/<repo>/<branch>/<path>
        m = re.match(r"^/([^/]+)/([^/]+)/([^/]+)/(.+)$", path)
        if m and m.group(1) in OWNERS:
            self._file(safe_join(ROOT, m.group(4)))
            return

        # 极简直取：/drivers/registry.json
        fp = safe_join(ROOT, path)
        if fp and os.path.isfile(fp):
            self._file(fp)
            return
        self._json({"message": "not found", "path": path}, 404)


def main(argv=None):
    global ROOT, TOKEN
    ap = argparse.ArgumentParser(description="本地冒充驱动仓库（自测用）")
    ap.add_argument("--root", required=True, help="仓库根目录（含 drivers/）")
    ap.add_argument("--port", type=int, default=8199)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--token", default="", help="设置后即模拟私有仓库")
    args = ap.parse_args(argv)

    ROOT = os.path.abspath(args.root)
    TOKEN = args.token
    if not os.path.isdir(os.path.join(ROOT, "drivers")):
        print("警告: %s/drivers 不存在（清单可能取不到）" % ROOT, file=sys.stderr)
    srv = ThreadingHTTPServer((args.host, args.port), H)
    print("驱动仓库已启动: http://%s:%d  root=%s%s"
          % (args.host, args.port, ROOT, "  (私有, 需 access_token)" if TOKEN else "  (公开)"))
    print("  清单: http://%s:%d/drivers/registry.json" % (args.host, args.port))
    print("  面板库直连形态: http://%s:%d/fongwuyan/RainCough-panel-web/main/drivers/registry.json"
          % (args.host, args.port))
    print("  面板库 raw 形态: http://%s:%d/fongwuyan/RainCough-panel-web/raw/main/drivers/registry.json"
          % (args.host, args.port))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
