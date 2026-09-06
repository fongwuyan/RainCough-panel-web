#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""migrate-plugin-v4.py — 存量 v3 插件 → v4 骨架迁移工具。

用法:
  python tools/migrate-plugin-v4.py plugins/uptime [-o v4-out/uptime] [--lang python]

输出(骨架, 业务逻辑需人工迁移):
  <out>/plugin.json          # v4 清单: 路由→interfaces 机械映射
  <out>/server_v4.py         # SDK 后端模板: 每个接口一个 handler 占位
  <out>/rcplugin.py          # 后端 SDK(从 interface/sdk 复制)
  <out>/plugin-<name>.service# systemd 单元模板(外部管理, 无端口)
  <out>/MIGRATE.md           # 该插件迁移步骤说明

说明: 生成的 plugin.json 前端 entry 默认引用 assets/plugin.js(Vue3),
      前端仍需用 tools/build-plugin-frontend.js 构建; 纯工具插件可给空页面。
"""
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDK_SRC = os.path.join(ROOT, "interface", "sdk", "backend-python", "rcplugin.py")

VIS = {"all", "main", "private"}


def slug_path(route):
    r = route.strip("/")
    r = re.sub(r"[^A-Za-z0-9_.]+", ".", r)
    r = re.sub(r"[.]+", ".", r).strip(".")
    return r or "index"


def main():
    src = None
    out = None
    i = 1
    while i < len(sys.argv):
        a = sys.argv[i]
        if a in ("-o", "--out"):
            out = sys.argv[i + 1] if i + 1 < len(sys.argv) else None
            i += 2
        elif a.startswith("-"):
            i += 1
        elif src is None:
            src = os.path.abspath(a)
            i += 1
        else:
            i += 1
    if not src:
        print(__doc__)
        sys.exit(2)
    if out is None:
        name = os.path.basename(src)
        out = os.path.join(ROOT, "v4-out", name)

    with open(os.path.join(src, "plugin.json"), "r", encoding="utf-8-sig") as f:
        m = json.load(f)
    name = m.get("name") or os.path.basename(src)
    label = m.get("label") or name
    version = m.get("version", "1.0.0")
    lang = m.get("lang", "python")
    routes = [r for r in (m.get("routes") or []) if isinstance(r, str)]

    interfaces = []
    for r in routes:
        if r.startswith("/__") or r == "/":
            continue
        iid = "%s.%s" % (name, slug_path(r))
        vis = "all"
        if name in ("docker", "kvm", "vpn", "mcserver"):
            vis = "main"  # 管理类默认 main, 可人工调整
        interfaces.append({
            "id": iid,
            "visibility": vis,
            "version": "1",
            "description": "由 v3 路由 %s 迁移(待完善 schema)" % r,
            "input": {"type": "object"},
            "output": {"type": "object"},
        })
    if not interfaces:
        interfaces.append({
            "id": "%s.info" % name,
            "visibility": "all", "version": "1",
            "description": "插件信息占位",
            "input": {"type": "object"}, "output": {"type": "object"},
        })

    v4 = {
        "name": name,
        "label": label,
        "version": version,
        "description": m.get("description", ""),
        "author": m.get("author", ""),
        "icon": m.get("icon", ""),
        "frontend": {
            "entry": m.get("assets", {}).get("entry", "assets/plugin.js") if isinstance(m.get("assets"), dict) else "assets/plugin.js",
            "vue": "3.5",
            "pages": [{"path": "", "title": label}],
        },
        "backend": {
            "lang": lang,
            "exec": m.get("entry", ["python", "server_v4.py"]),
            "capabilities": ["invoke", "heartbeat", "log.tail"],
        },
        "interfaces": interfaces,
    }

    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "plugin.json"), "w", encoding="utf-8") as f:
        json.dump(v4, f, ensure_ascii=False, indent=2)

    # SDK
    shutil.copy(SDK_SRC, os.path.join(out, "rcplugin.py"))

    # server_v4.py 模板
    handlers = []
    for it in interfaces:
        hid = it["id"].split(".", 1)[1]
        handlers.append(
            '\n\n@rc.interface("%s")\ndef %s(params):\n'
            '    # TODO: %s 迁移自 v3 路由, 在此实现处理逻辑\n'
            '    return {"migrated": True, "iface": "%s", "params": params}' % (
                it["id"], hid, it.get("description", it["id"]), it["id"]))
    server = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""%s 插件后端 — v4 迁移骨架(无端口, UDS 自注册)。

迁移步骤(MIGRATE.md):
  1) 把 v3 server.py 中的业务逻辑分别移入下方各接口 handler
  2) 数据目录沿用本插件 data/(SDK 写 .runtime.log)
  3) 配 systemd 单元(见 plugin-%s.service)后启动, 即自动注册
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
%s

if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="%s",
        version="%s",
        manifest={"label": "%s"},
        frontend={"pages": [{"path": "", "title": "%s"}]},
        iface_ids=[%s],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )
''' % (label, name, "\n".join(handlers), name, version, label, label,
       ", ".join('"%s"' % it["id"] for it in interfaces))
    with open(os.path.join(out, "server_v4.py"), "w", encoding="utf-8") as f:
        f.write(server)

    # systemd 单元模板
    unit = """[Unit]
Description=RainCough Plugin %s (v4, portless)
After=network.target raincough.service
Wants=raincough.service

[Service]
Type=simple
User=f
WorkingDirectory=%s
ExecStart=/usr/bin/python3 server_v4.py
Restart=always
RestartSec=5
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
""" % (name, out)
    with open(os.path.join(out, "plugin-%s.service" % name), "w", encoding="utf-8") as f:
        f.write(unit)

    # MIGRATE.md
    migrate = """# %s → v4 迁移步骤

1. 把 v3 `server.py` 的业务逻辑移入 `server_v4.py` 各接口 handler(逐路由对照)。
2. 校验清单: `python interface/tools/validate_manifest.py %s/plugin.json`
3. 构建前端: `node tools/build-plugin-frontend.js %s`(需 frontend/plugin.js 按 vue3 SDK 契约)
4. 部署后端: 将目录放到宿主(如 /opt/raincough-plugins/%s), 安装并启动:
   `sudo -n cp %s/plugin-%s.service /etc/systemd/system/ && sudo -n systemctl daemon-reload && sudo -n systemctl enable --now plugin-%s`
5. 启动后应在主系统「接口总览」看到 %d 个接口并可试调用; 旧 /api/plugins/<name>/* 网关随即弃用。
""" % (name, out, name, name, out, name, name, len(interfaces))
    with open(os.path.join(out, "MIGRATE.md"), "w", encoding="utf-8") as f:
        f.write(migrate)

    print("[ok] %s → %s (%d interfaces)" % (name, out, len(interfaces)))
    print("     前端: 仍用 tools/build-plugin-frontend.js 构建 assets")


if __name__ == "__main__":
    main()