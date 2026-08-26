#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ocrqr v2 插件子进程 — OCR + 二维码工具(调系统命令)。"""
import os
import json
import base64
import subprocess
import shutil
import tempfile
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))


def _run(cmd, timeout=60):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, timeout=timeout)
        return r.returncode, r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace")
    except subprocess.TimeoutExpired:
        return -1, "", "超时"
    except Exception as e:
        return -1, "", str(e)


def ocr_check():
    tools = {
        "tesseract": shutil.which("tesseract") is not None,
        "zbarimg": shutil.which("zbarimg") is not None,
        "qrencode": shutil.which("qrencode") is not None,
    }
    return {"ok": True, "tools": tools}


def ocr(image_b64, lang="chi_sim+eng"):
    if not image_b64:
        return {"ok": False, "error": "缺少图片(base64)"}
    if not shutil.which("tesseract"):
        return {"ok": False, "error": "未安装 tesseract"}
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(base64.b64decode(image_b64))
        img = f.name
    try:
        code, out, err = _run('tesseract "%s" stdout -l %s 2>/dev/null' % (img, lang))
        if code != 0:
            # 回退默认语言
            code, out, err = _run('tesseract "%s" stdout 2>/dev/null' % img)
        return {"ok": code == 0, "text": out.strip(), "error": err if code != 0 else ""}
    finally:
        os.remove(img)


def qr_gen(text, size=256):
    if not shutil.which("qrencode"):
        return {"ok": False, "error": "未安装 qrencode"}
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, "qr.png")
        code, _, err = _run('qrencode -o "%s" -s 8 "%s"' % (out, text.replace('"', '\\"')))
        if code != 0:
            return {"ok": False, "error": err}
        with open(out, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()
    return {"ok": True, "image_b64": img_b64, "mime": "image/png", "text": text}


def qr_decode(image_b64):
    if not image_b64:
        return {"ok": False, "error": "缺少图片"}
    if not shutil.which("zbarimg"):
        return {"ok": False, "error": "未安装 zbarimg"}
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(base64.b64decode(image_b64))
        img = f.name
    try:
        code, out, err = _run('zbarimg --raw "%s" 2>/dev/null' % img)
        if code != 0:
            return {"ok": False, "error": "解码失败或图中无二维码"}
        return {"ok": True, "data": out.strip()}
    finally:
        os.remove(img)


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
            self._json(200, ocr_check())
            return
        if p == "/ocr/check":
            self._json(200, ocr_check())
            return
        if p.startswith("/qr/gen"):
            from urllib.parse import urlparse, parse_qs
            text = parse_qs(urlparse(p).query).get("text", [""])[0]
            self._json(200, qr_gen(text))
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/ocr":
            self._json(200, ocr(str(data.get("image") or data.get("image_b64") or ""),
                                str(data.get("lang") or "chi_sim+eng")))
            return
        if p == "/qr/decode":
            self._json(200, qr_decode(str(data.get("image") or data.get("image_b64") or "")))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("ocrqr ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()