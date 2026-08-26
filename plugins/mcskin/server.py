#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mcskin v2 插件子进程 — 图片转 MC 皮肤(64x64 Java 皮肤布局, Pillow 纯实现)。

皮肤布局(Steve 64x64):
  head:   上半 8x8 区域(图层1: 0,0-8,8; 图层2: 蓝帽区 32,0-40,8)
  body:   20,16-28,32
  左臂:   44,16-48,32 / 右臂: 36,16-40,32
  腿:     4,16-12,32 等
皮肤文件: base64 PNG 输出。
"""
import os
import json
import base64
import io
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))

try:
    from PIL import Image
except ImportError:
    Image = None


def _b64_to_img(b64):
    try:
        return Image.open(io.BytesIO(base64.b64decode(b64)))
    except Exception:
        return None


def detect(b64):
    img = _b64_to_img(b64)
    if img is None:
        return {"ok": False, "error": "图片无法解析"}
    return {"ok": True, "size": img.size, "has_alpha": img.mode == "RGBA"}


def convert(b64):
    """把输入图片(建议正方形全身/头像)映射成 64x64 皮肤。"""
    if Image is None:
        return {"ok": False, "error": "插件需要 Pillow"}
    src = _b64_to_img(b64)
    if src is None:
        return {"ok": False, "error": "图片无法解析"}
    src = src.convert("RGBA")
    # 按头像裁中间 1:1
    w, h = src.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    face = src.crop((left, top, left + side, top + side)).resize((8, 8), Image.LANCZOS)

    skin = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    # 头(正面): 8,8 - 16,16
    skin.paste(face, (8, 8))
    # 身体(简化为正面色块)
    body = face.getpixel((4, 4))
    for x in range(20, 28):
        for y in range(16, 32):
            skin.putpixel((x, y), body)
    # 手臂(按身体色)
    for x in range(36, 40):
        for y in range(16, 32):
            skin.putpixel((x, y), body)
    for x in range(44, 48):
        for y in range(16, 32):
            skin.putpixel((x, y), body)
    # 腿
    for x in range(4, 8):
        for y in range(16, 32):
            skin.putpixel((x, y), body)
    for x in range(12, 16):
        for y in range(16, 32):
            skin.putpixel((x, y), body)
    # 保留透明区域的正确 alpha(整体)
    buf = io.BytesIO()
    skin.save(buf, format="PNG")
    out_b64 = base64.b64encode(buf.getvalue()).decode()
    return {"ok": True, "skin_b64": out_b64, "size": (64, 64),
            "model": "steve"}


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
            self._json(200, {"ok": True, "pillow": Image is not None})
            return
        if p == "/paint/models":
            self._json(200, {"models": ["sd15"]})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/detect":
            self._json(200, detect(str(data.get("image") or data.get("image_b64") or "")))
            return
        if p == "/convert":
            self._json(200, convert(str(data.get("image") or data.get("image_b64") or "")))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("mcskin ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()