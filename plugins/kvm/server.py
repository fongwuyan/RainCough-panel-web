#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""kvm v2 插件子进程 — libvirt virsh 虚拟机管理。"""
import os
import json
import subprocess
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
SUDO = "sudo -n" if not os.environ.get("RC_SUDO_PW") else "sudo -S"


def _virsh(args, timeout=30, pw=False):
    try:
        cmd = ["virsh"] + args
        if pw and "SUDO_PW" in os.environ:
            r = subprocess.run(["sudo", "-S"] + cmd, input=(os.environ["SUDO_PW"] + "\n").encode(),
                               capture_output=True, timeout=timeout)
        else:
            r = subprocess.run(cmd, capture_output=True, timeout=timeout)
        return r.returncode, r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace")
    except FileNotFoundError:
        return -1, "", "virsh 不存在(未安装 libvirt)"
    except subprocess.TimeoutExpired:
        return -1, "", "virsh 超时"


def env_info():
    code, out, err = _virsh(["version"])
    return {"ok": code == 0, "virsh": code == 0, "version": out.splitlines()[0] if out else "",
            "error": err if code != 0 else ""}


def domains(all_c=False):
    code, out, err = _virsh(["list", "--all" if all_c else ""])
    if code != 0:
        return {"ok": False, "error": err}
    items = []
    lines = out.splitlines()[2:]  # 跳表头
    for line in lines:
        parts = line.split()
        if len(parts) >= 3:
            items.append({"id": parts[0], "name": parts[1], "state": " ".join(parts[2:])})
    return {"ok": True, "domains": items}


def domain_info(name):
    code, out, err = _virsh(["dominfo", name])
    if code != 0:
        return {"ok": False, "error": err}
    info = {}
    for line in out.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            info[k.strip()] = v.strip()
    # CPU/内存
    _, vcpus, _ = _virsh(["vcpuinfo", name])
    return {"ok": True, "name": name, "state": info.get("State", ""),
            "cpu": info.get("CPU(s)", ""), "memory": info.get("Max memory", ""),
            "vcpus": vcpus.splitlines()[-1] if vcpus else ""}


def domain_action(name, action):
    a = {"start": "start", "stop": "shutdown", "destroy": "destroy",
         "reboot": "reboot", "suspend": "suspend", "resume": "resume"}.get(action)
    if not a:
        return {"ok": False, "error": "未知动作: " + action}
    code, out, err = _virsh([a, name], pw=True)
    return {"ok": code == 0, "output": out or err}


def domain_vnc(name):
    # 获取 VNC 端口(简化: 从 dumpxml 找 graphics type=vnc)
    code, out, err = _virsh(["dumpxml", name])
    if code != 0:
        return {"ok": False, "error": err}
    import re
    m = re.search(r'<graphics type="vnc"[^>]*port="(\d+)"', out)
    if not m:
        return {"ok": False, "error": "无 VNC 配置"}
    return {"ok": True, "vnc_port": int(m.group(1)),
            "websocket_url": "/none"}


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
        if p == "/config":
            self._json(200, env_info())
            return
        if p == "/info":
            self._json(200, env_info())
            return
        if p == "/domains":
            self._json(200, domains(q.get("all") == "1"))
            return
        if p == "/domain":
            name = q.get("name", "")
            self._json(200, domain_info(name) if name else {"ok": False, "error": "缺少 name"})
            return
        if p == "/domain/stats":
            name = q.get("name", "")
            self._json(200, domain_info(name) if name else {"ok": False, "error": "缺少 name"})
            return
        if p == "/domain/vnc":
            name = q.get("name", "")
            self._json(200, domain_vnc(name) if name else {"ok": False, "error": "缺少 name"})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        name = str(data.get("name") or "")
        if not name:
            self._json(400, {"error": "缺少 name"})
            return
        if p.startswith("/domain/action"):
            self._json(200, domain_action(name, str(data.get("action") or "start")))
            return
        if p.startswith("/domain/autostart"):
            self._json(200, domain_action(name, str(data.get("enabled") or "start")))
            return
        if p.startswith("/domain/vnc"):
            self._json(200, domain_vnc(name))
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("kvm ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()