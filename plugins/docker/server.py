#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docker v2 插件子进程 — Docker 容器管理(调 docker CLI)。"""
import os
import json
import subprocess
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))


def _run(args, timeout=60):
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except FileNotFoundError:
        return -1, "", "docker 命令不存在"
    except subprocess.TimeoutExpired:
        return -1, "", "docker 命令超时"


def docker(args, timeout=60):
    code, out, err = _run(["docker"] + args, timeout)
    return code, out, err


def env_info():
    ok = False
    code, out, _ = docker(["version", "--format", "{{.Server.Version}}"], 15)
    ver = out if code == 0 else ""
    ok = code == 0
    return {"ok": ok, "version": ver}


def containers(all_c=False):
    code, out, err = docker(["ps", "-a" if all_c else "", "--format",
                             "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"])
    if code != 0:
        return {"ok": False, "error": err}
    items = []
    for line in out.splitlines():
        parts = line.split("|")
        if len(parts) >= 4:
            items.append({"id": parts[0], "name": parts[1], "image": parts[2],
                          "status": parts[3], "ports": parts[4] if len(parts) > 4 else ""})
    return {"ok": True, "containers": items}


def container_action(cid, action):
    code, out, err = docker([action, cid])
    return {"ok": code == 0, "output": out or err}


def container_logs(cid, tail=100):
    code, out, err = docker(["logs", "--tail", str(tail), cid])
    if code != 0:
        return {"ok": False, "error": err}
    return {"ok": True, "logs": out}


def container_stats(cid):
    code, out, err = docker(["stats", "--no-stream", "--format",
                             "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}", cid], 30)
    if code != 0:
        return {"ok": False, "error": err}
    parts = out.split("|")
    return {"ok": True,
            "name": parts[0], "cpu": parts[1] if len(parts) > 1 else "",
            "mem": parts[2] if len(parts) > 2 else "",
            "mem_pct": parts[3] if len(parts) > 3 else "",
            "net": parts[4] if len(parts) > 4 else ""}


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

    def _query(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    def do_GET(self):
        p = self.path
        q = self._query()
        if p == "/__health":
            self._json(200, env_info())
            return
        if p == "/env":
            self._json(200, env_info())
            return
        if p == "/info":
            self._json(200, env_info())
            return
        if p == "/containers":
            self._json(200, containers(q.get("all") == "1"))
            return
        if p.startswith("/containers/logs"):
            cid = q.get("cid") or q.get("id") or ""
            self._json(200, container_logs(cid, int(q.get("tail") or 100)))
            return
        if p.startswith("/containers/stats"):
            cid = q.get("cid") or q.get("id") or ""
            self._json(200, container_stats(cid))
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        cid = str(data.get("cid") or data.get("id") or "")
        if p.startswith("/containers/start"):
            self._json(200, container_action(cid, "start"))
            return
        if p.startswith("/containers/stop"):
            self._json(200, container_action(cid, "stop"))
            return
        if p.startswith("/containers/restart"):
            self._json(200, container_action(cid, "restart"))
            return
        if p.startswith("/containers/remove"):
            self._json(200, container_action(cid, "rm"))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("docker ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()