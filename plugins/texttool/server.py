#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""texttool v2 插件子进程 — 正则/替换/转换/统计(纯标准库)。"""
import os
import re
import json
import html
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))


def regex_op(pattern, text, flags):
    fl = 0
    if "i" in flags: fl |= re.I
    if "m" in flags: fl |= re.M
    if "s" in flags: fl |= re.S
    try:
        rx = re.compile(pattern, fl)
    except re.error as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "matches": [m.group(0) for m in rx.finditer(text)],
            "count": len(rx.findall(text))}


def replace_op(pattern, text, repl, flags):
    fl = 0
    if "i" in flags: fl |= re.I
    if "m" in flags: fl |= re.M
    if "s" in flags: fl |= re.S
    try:
        out, n = re.subn(pattern, repl, text, flags=fl)
    except re.error as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "result": out, "count": n}


def convert_op(action, text):
    if action == "json2yaml":
        import json as _json
        try:
            import yaml
            return {"ok": True, "result": yaml.dump(_json.loads(text), allow_unicode=True)}
        except ImportError:
            return {"ok": False, "error": "需要 pyyaml"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    if action == "yaml2json":
        try:
            import yaml
            import json as _json
            return {"ok": True, "result": _json.dumps(yaml.safe_load(text), ensure_ascii=False, indent=2)}
        except ImportError:
            return {"ok": False, "error": "需要 pyyaml"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    if action == "escape_html":
        return {"ok": True, "result": html.escape(text)}
    if action == "unescape_html":
        return {"ok": True, "result": html.unescape(text)}
    if action == "upper":
        return {"ok": True, "result": text.upper()}
    if action == "lower":
        return {"ok": True, "result": text.lower()}
    if action == "reverse":
        return {"ok": True, "result": text[::-1]}
    return {"ok": False, "error": "未知转换: " + str(action)}


def stats_op(text):
    words = re.findall(r"\b\w+\b", text, re.U)
    lines = text.splitlines()
    return {"ok": True, "chars": len(text), "chars_no_space": len(re.sub(r"\s", "", text)),
            "words": len(words), "lines": len(lines),
            "bytes": len(text.encode("utf-8"))}


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
        text = str(data.get("text") or "")
        if p == "/text/regex":
            self._json(200, regex_op(str(data.get("pattern") or ""), text,
                                      str(data.get("flags") or "")))
            return
        if p == "/text/replace":
            self._json(200, replace_op(str(data.get("pattern") or ""), text,
                                       str(data.get("replacement") or ""),
                                       str(data.get("flags") or "")))
            return
        if p == "/text/convert":
            self._json(200, convert_op(str(data.get("action") or ""), text))
            return
        if p == "/text/stats":
            self._json(200, stats_op(text))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("texttool ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()