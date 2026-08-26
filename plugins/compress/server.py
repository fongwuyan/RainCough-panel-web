#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""compress v2 插件子进程 — 解压/压缩/转换(调用系统 7z/tar)。"""
import os
import json
import subprocess
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))

SUPPORTED = {
    "zip": "zip", "7z": "7z", "tar": "tar", "gz": "gzip",
    "tgz": "tar.gz", "xz": "xz", "bz2": "bzip2",
}


def _run(cmd, timeout=300):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout, r.stderr


def _ext(__file):
    return os.path.basename(__file).lower().split(".")[-1]


def extract(archive, dest):
    os.makedirs(dest, exist_ok=True)
    low = archive.lower()
    if low.endswith(".zip") or low.endswith(".7z"):
        code, out, err = _run('7z x -y -o"%s" -- "%s"' % (dest, archive))
    elif low.endswith(".tar.gz") or low.endswith(".tgz"):
        code, out, err = _run('tar xzf "%s" -C "%s"' % (archive, dest))
    elif low.endswith(".tar.xz"):
        code, out, err = _run('tar xJf "%s" -C "%s"' % (archive, dest))
    elif low.endswith(".tar.bz2"):
        code, out, err = _run('tar xjf "%s" -C "%s"' % (archive, dest))
    elif low.endswith(".tar"):
        code, out, err = _run('tar xf "%s" -C "%s"' % (archive, dest))
    else:
        return {"ok": False, "error": "不支持的格式: " + low}
    if code != 0:
        return {"ok": False, "error": err.strip() or out.strip()}
    entries = sorted(os.listdir(dest))[:20]
    return {"ok": True, "extracted_to": dest, "entries": entries}


def compress(src, dest, fmt):
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    if os.path.isdir(src):
        if fmt in ("zip", "7z"):
            code, out, err = _run('7z a -y -t%s "%s" "%s"' % (fmt, dest, src))
        else:
            code, out, err = _run('tar -czf "%s" -C "%s" .' % (dest, os.path.dirname(src)))
    else:
        code, out, err = _run('7z a -y -t%s "%s" "%s"' % (fmt, dest, src))
    return {"ok": code == 0, "code": code, "output": out.strip() or err.strip(),
            "dest": dest}


def convert(src, dest):
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    code, out, err = _run('7z a -y "%s" "%s"' % (dest, src))
    return {"ok": code == 0, "code": code, "output": out.strip() or err.strip()}


def compare(a, b):
    ca = _read_many(a)
    cb = _read_many(b)
    same = ca == cb
    return {"same": same, "a_entries": len(ca), "b_entries": len(cb),
            "a_size": sum(len(v) for v in ca.values()),
            "b_size": sum(len(v) for v in cb.values())}


def _read_many(path):
    if os.path.isdir(path):
        out = {}
        for root, _, files in os.walk(path):
            for fn in files:
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, path)
                try:
                    with open(full, "rb") as f:
                        out[rel] = f.read()
                except Exception:
                    out[rel] = b"<unreadable>"
        return out
    with open(path, "rb") as f:
        return {os.path.basename(path): f.read()}


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
        if self.path.startswith("/decompress/check"):
            self._json(200, {"formats": list(SUPPORTED.keys())})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/decompress/list":
            archive = str(data.get("archive") or "")
            if not os.path.isfile(archive):
                self._json(400, {"error": "压缩包不存在"})
                return
            code, out, err = _run('7z l "%s"' % archive, 60)
            lines = out.splitlines() if code == 0 else err.splitlines()
            self._json(200, {"archive": archive, "listing": lines[-30:]})
            return
        if p == "/decompress/extract":
            self._json(200, extract(str(data.get("archive") or ""),
                                    str(data.get("dest") or ".")))
            return
        if p == "/decompress/compress":
            self._json(200, compress(str(data.get("src") or ""),
                                     str(data.get("dest") or ""),
                                     str(data.get("format") or "zip")))
            return
        if p == "/decompress/convert":
            self._json(200, convert(str(data.get("src") or ""),
                                    str(data.get("dest") or "")))
            return
        if p == "/decompress/compare":
            self._json(200, compare(str(data.get("a") or ""),
                                    str(data.get("b") or "")))
            return
        self._json(404, {"error": "not found: " + p})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("compress ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()