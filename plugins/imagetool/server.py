#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""imagetool v2 插件子进程 — 图片相似度(pHash)/基础处理(需 Pillow)。"""
import os
import json
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))

try:
    from PIL import Image
except ImportError:
    Image = None


def _load_safe(path):
    if not os.path.isfile(path):
        return None
    try:
        return Image.open(path)
    except Exception:
        return None


def dhash(img, size=16):
    g = img.convert("L").resize((size + 1, size), Image.BILINEAR)
    arr = list(g.getdata())
    w = size + 1
    h = 0
    for y in range(size):
        for x in range(size):
            left = arr[y * w + x]
            right = arr[y * w + x + 1]
            h = (h << 1) | (1 if left > right else 0)
    return h


def hamming(a, b):
    return bin(a ^ b).count("1")


def similar(path_a, path_b, threshold=8):
    if Image is None:
        return {"ok": False, "error": "插件需要 Pillow"}
    img_a, img_b = _load_safe(path_a), _load_safe(path_b)
    if img_a is None or img_b is None:
        return {"ok": False, "error": "图片无法读取"}
    ha, hb = dhash(img_a), dhash(img_b)
    dist = hamming(ha, hb)
    return {"ok": True, "similar": dist <= threshold, "distance": dist,
            "threshold": threshold}


def process(path, action, params):
    if Image is None:
        return {"ok": False, "error": "插件需要 Pillow"}
    img = _load_safe(path)
    if img is None:
        return {"ok": False, "error": "图片无法读取"}
    out = path  # 原地处理需要复制, 这里输出到同目录 _processed
    base, ext = os.path.splitext(path)
    out = base + "_processed" + ext
    try:
        if action == "resize":
            w = int(params.get("width", 0)); h = int(params.get("height", 0))
            if w <= 0 or h <= 0:
                return {"ok": False, "error": "需要 width/height"}
            img = img.resize((w, h), Image.LANCZOS)
        elif action == "thumbnail":
            w = int(params.get("width", 300)); h = int(params.get("height", 300))
            img.thumbnail((w, h), Image.LANCZOS)
        elif action == "rotate":
            deg = int(params.get("degrees", 90))
            img = img.rotate(deg)
        elif action == "grayscale":
            img = img.convert("L")
        elif action == "webp":
            out = base + ".webp"
        elif action == "jpeg":
            out = base + ".jpg"
        elif action == "png":
            out = base + ".png"
        else:
            return {"ok": False, "error": "未知动作: " + str(action)}
        img.save(out)
        return {"ok": True, "output": out, "size": os.path.getsize(out)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


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
            self._json(200, {"ok": True, "pillow": Image is not None})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/image/similar":
            self._json(200, similar(str(data.get("a") or ""),
                                    str(data.get("b") or ""),
                                    int(data.get("threshold") or 8)))
            return
        if p == "/image/process":
            self._json(200, process(str(data.get("path") or ""),
                                    str(data.get("action") or ""),
                                    data.get("params") or {}))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("imagetool ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()