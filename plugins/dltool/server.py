#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dltool v2 插件子进程 — 下载/分片/合并/重命名/删除/文档检查(纯标准库)。"""
import os
import json
import time
import urllib.request
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))

CHUNK = 32 * 1024 * 1024  # 32MB 分片


def download(url, dest, timeout=600):
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "raincough-dltool/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            tmp = dest + ".part"
            total = 0
            with open(tmp, "wb") as f:
                while True:
                    b = r.read(1024 * 1024)
                    if not b:
                        break
                    f.write(b)
                    total += len(b)
            os.rename(tmp, dest)
            return {"ok": True, "path": dest, "size": total,
                    "size_h": fmt(total)}
    except Exception as e:
        if os.path.exists(dest + ".part"):
            os.remove(dest + ".part")
        return {"ok": False, "error": str(e)}


def split(path, parts=2):
    if not os.path.isfile(path):
        return {"ok": False, "error": "文件不存在"}
    size = os.path.getsize(path)
    if size == 0:
        return {"ok": False, "error": "空文件无需分片"}
    parts = max(1, min(parts, size))
    part_size = max(1, (size + parts - 1) // parts)
    out = []
    with open(path, "rb") as f:
        for i in range(parts):
            chunk = f.read(part_size)
            if not chunk:
                break
            part_path = "%s.part%02d" % (path, i + 1)
            with open(part_path, "wb") as pf:
                pf.write(chunk)
            out.append(part_path)
    return {"ok": True, "parts": out, "part_size": part_size, "count": len(out)}


def join(paths, dest):
    with open(dest, "wb") as df:
        total = 0
        for p in sorted(paths):
            with open(p, "rb") as pf:
                while True:
                    b = pf.read(1024 * 1024)
                    if not b:
                        break
                    df.write(b)
                    total += len(b)
    return {"ok": True, "dest": dest, "size": total}


def rename(path, new_name):
    new_path = os.path.join(os.path.dirname(path), new_name)
    os.rename(path, new_path)
    return {"ok": True, "path": new_path}


def delete(path):
    if os.path.isdir(path):
        import shutil
        shutil.rmtree(path)
    else:
        os.remove(path)
    return {"ok": True}


def doc_convert_check():
    # 检查系统是否有转换工具(libreoffice/pandoc)
    tools = {}
    import shutil
    for t in ("libreoffice", "soffice", "pandoc", "unoconv"):
        tools[t] = shutil.which(t) is not None
    return {"ok": True, "tools": tools, "supported": [t for t, ok in tools.items() if ok]}


def fmt(n):
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
        p = self.path
        if p == "/__health":
            self._json(200, {"ok": True})
            return
        if p == "/docconvert/check":
            self._json(200, doc_convert_check())
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/networktools/download":
            self._json(200, download(str(data.get("url") or ""),
                                     str(data.get("dest") or "/tmp/dl"),
                                     int(data.get("timeout") or 600)))
            return
        if p == "/networktools/split":
            self._json(200, split(str(data.get("path") or ""),
                                  int(data.get("parts") or 2)))
            return
        if p == "/networktools/join":
            self._json(200, join(data.get("paths") or [],
                                 str(data.get("dest") or "/tmp/joined")))
            return
        if p == "/networktools/rename":
            self._json(200, rename(str(data.get("path") or ""),
                                   str(data.get("new_name") or "")))
            return
        if p == "/networktools/delete":
            self._json(200, delete(str(data.get("path") or "")))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("dltool ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()