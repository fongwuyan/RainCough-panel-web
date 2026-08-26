#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""filehash v2 插件子进程 — 哈希/校验/目录统计查重(纯标准库)。"""
import os
import json
import time
import hashlib
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))


def file_md5(path, chunk=1024 * 1024):
    h = hashlib.md5()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def file_others(path):
    """返回 sha1 + sha256 + size。"""
    h1, h256 = hashlib.sha1(), hashlib.sha256()
    size = 0
    with open(path, "rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h1.update(b)
            h256.update(b)
            size += len(b)
    return h1.hexdigest(), h256.hexdigest(), size


def dir_tree(base):
    """返回 {rel_path: {size, md5}} (仅文件)。"""
    out = {}
    for root, dirs, files in os.walk(base):
        for fn in files:
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, base)
            try:
                md5 = file_md5(full)
                size = os.path.getsize(full)
            except Exception:
                continue
            out[rel] = {"size": size, "md5": md5}
    return out


def find_duplicates(files_by_size_md5):
    groups = {}
    for rel, info in files_by_size_md5.items():
        key = (info["size"], info["md5"])
        groups.setdefault(key, []).append(rel)
    return [v for k, v in groups.items() if len(v) > 1]


def fmt_size(n):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return "%.1f %s" % (n, unit)
        n /= 1024
    return "%.1f PB" % n


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
        if self.path == "/__health":
            self._json(200, {"status": "ok"})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        path = str(data.get("path") or "")
        if not path or not os.path.exists(path):
            self._json(400, {"error": "path 不存在"})
            return

        if p == "/hash":
            md5 = file_md5(path)
            sha1, sha256, size = file_others(path)
            self._json(200, {"path": path, "md5": md5, "sha1": sha1,
                             "sha256": sha256, "size": size, "size_h": fmt_size(size)})
            return
        if p == "/generate":
            # 生成校验文件(md5 + 路径)
            if not os.path.isfile(path):
                self._json(400, {"error": "只能为单文件生成校验"})
                return
            md5 = file_md5(path)
            checksum_file = path + ".md5"
            with open(checksum_file, "w") as f:
                f.write("%s  %s\n" % (md5, os.path.basename(path)))
            self._json(200, {"path": checksum_file, "md5": md5, "status": True})
            return
        if p == "/verify":
            # path 为校验文件; 校验同目录下文件
            base_dir = os.path.dirname(path)
            ok, bad = [], []
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split(None, 1)
                    if len(parts) != 2:
                        continue
                    want, name = parts[0], parts[1].strip("*")
                    target = os.path.join(base_dir, name)
                    if os.path.isfile(target) and file_md5(target) == want:
                        ok.append(name)
                    else:
                        bad.append(name)
            self._json(200, {"status": True, "ok": ok, "bad": bad,
                             "ok_count": len(ok), "bad_count": len(bad)})
            return
        if p == "/diranalyze/stats":
            tree = dir_tree(path)
            total = sum(i["size"] for i in tree.values())
            self._json(200, {"path": path, "files": len(tree),
                             "total": total, "total_h": fmt_size(total)})
            return
        if p == "/diranalyze/duplicate":
            tree = dir_tree(path)
            dups = find_duplicates(tree)
            self._json(200, {"path": path, "duplicate_groups": dups,
                             "groups": len(dups),
                             "wasted": fmt_size(sum(tree[d[0]]["size"] * (len(d) - 1)
                                                     for d in dups if d))})
            return
        self._json(404, {"error": "not found: " + p})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("filehash ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()