#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""atk — 网络攻防工具库 · RainCough 插件后端入口。

协议: JSON-RPC over UDS(宿主预建端点, 见 .rc.endpoint), 由 rcplugin 处理。
分工: 本文件只做"参数校验 + 转发", 业务在各 modules/*.py。

★ 两条硬约束:
  1. 侦察/检测/解码/取证全部用内置引擎, 不依赖 nmap/subfinder/nuclei。
     实测宿主上这些工具都没装, 按"调外部命令"写出来会是个空壳。
  2. **只用 Python 标准库**, 不引 requests / Pillow 等第三方包。
     HTTP 走 core/httpc.py(自己实现的连接池), 图片元数据自己解 TIFF/IFD。
     这样插件拷到任何有 python3 的机器上都能跑, 不需要 pip。
"""
import os
import sys

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
if PLUGIN_DIR not in sys.path:
    sys.path.insert(0, PLUGIN_DIR)

import rcplugin as rc                     # noqa: E402
from core import store, util              # noqa: E402
from modules import decode as m_decode    # noqa: E402
from modules import detect as m_detect    # noqa: E402
from modules import forensic as m_forensic  # noqa: E402
from modules import recon as m_recon      # noqa: E402
from modules import task as m_task        # noqa: E402
from modules import verify as m_verify    # noqa: E402

VERSION = "1.0.1"
LABEL = "网络攻防工具库"


def _p(params):
    return params or {}


def _i(params, key, default=0):
    try:
        return int(_p(params).get(key) or default)
    except (TypeError, ValueError):
        return default


def _s(params, key, default=""):
    v = _p(params).get(key)
    return default if v is None else str(v)


def _task(tid):
    t = store.task_get(tid)
    if not t:
        raise ValueError("任务不存在(id=%s)" % tid)
    return t


# ══════════════════════════════════════════════════════════ 任务

@rc.interface("atk.task.list")
def task_list(params):
    return {"tasks": store.task_list()}


@rc.interface("atk.task.create")
def task_create(params):
    name = _s(params, "name").strip()
    target = _s(params, "target").strip()
    if not name:
        # 没给名字就用目标当名字, 省一步输入
        name = target or "未命名任务"
    t = store.task_create(name, target, _s(params, "note"))
    return {"task": t}


@rc.interface("atk.task.get")
def task_get(params):
    tid = _i(params, "task_id")
    t = _task(tid)
    return {"task": t, "stats": m_task.stats(tid)}


@rc.interface("atk.task.delete")
def task_delete(params):
    tid = _i(params, "task_id")
    _task(tid)
    store.task_delete(tid)
    return {"ok": True, "task_id": tid}


@rc.interface("atk.task.export")
def task_export(params):
    tid = _i(params, "task_id")
    fmt = _s(params, "format", "md")
    return m_task.export(tid, fmt)


# ══════════════════════════════════════════════════════════ 侦察

@rc.interface("atk.recon.start")
def recon_start(params):
    tid = _i(params, "task_id")
    t = _task(tid)
    target = _s(params, "target") or t.get("target") or ""
    if not target:
        raise ValueError("请先填写目标(域名或 IP)")
    modes = _p(params).get("modes") or {}
    modes = {
        "subdomain": bool(modes.get("subdomain", True)),
        "port": bool(modes.get("port", True)),
        "dir": bool(modes.get("dir", True)),
        "fingerprint": bool(modes.get("fingerprint", True)),
    }
    if not any(modes.values()):
        raise ValueError("至少要勾选一项")
    run_id = m_recon.start(tid, target, modes, _s(params, "intensity", "normal"))
    # 目标记到任务上, 下次不用重填
    if not t.get("target"):
        store.ex("UPDATE atk_task SET target=? WHERE id=?", (target, tid))
    return {"run_id": run_id, "run": store.run_get(run_id)}


@rc.interface("atk.recon.status")
def recon_status(params):
    rid = _s(params, "run_id")
    if rid:
        r = store.run_get(rid)
        if not r:
            raise ValueError("运行记录不存在(可能已过期)")
        return {"run": r}
    tid = _i(params, "task_id")
    return {"run": store.run_latest(tid, "recon")}


@rc.interface("atk.recon.stop")
def recon_stop(params):
    rid = _s(params, "run_id")
    if not rid:
        r = store.run_latest(_i(params, "task_id"), "recon")
        rid = r["id"] if r else ""
    if not rid:
        raise ValueError("没有可停止的侦察")
    m_recon.stop(rid)
    return {"ok": True, "run_id": rid}


@rc.interface("atk.recon.assets")
def recon_assets(params):
    tid = _i(params, "task_id")
    _task(tid)
    return {"assets": store.asset_list(tid, _s(params, "kind"), _s(params, "q"))}


@rc.interface("atk.recon.assets.delete")
def recon_assets_delete(params):
    aid = _i(params, "asset_id")
    if not aid:
        raise ValueError("缺少 asset_id")
    store.asset_delete(aid)
    return {"ok": True}


# ══════════════════════════════════════════════════════════ 检测

@rc.interface("atk.detect.start")
def detect_start(params):
    tid = _i(params, "task_id")
    _task(tid)
    run_id = m_detect.start(tid)
    return {"run_id": run_id, "run": store.run_get(run_id)}


@rc.interface("atk.detect.status")
def detect_status(params):
    rid = _s(params, "run_id")
    if rid:
        r = store.run_get(rid)
        if not r:
            raise ValueError("运行记录不存在")
        return {"run": r}
    return {"run": store.run_latest(_i(params, "task_id"), "detect")}


@rc.interface("atk.detect.risks")
def detect_risks(params):
    tid = _i(params, "task_id")
    _task(tid)
    return {"risks": store.risk_list(tid, _s(params, "level"), _s(params, "status"))}


@rc.interface("atk.detect.mark")
def detect_mark(params):
    rid = _i(params, "risk_id")
    st = _s(params, "status")
    if st not in ("待确认", "已确认", "误报"):
        raise ValueError("status 只能是 待确认 / 已确认 / 误报")
    if not store.risk_get(rid):
        raise ValueError("风险不存在")
    store.risk_mark(rid, st)
    return {"ok": True, "risk_id": rid, "status": st}


# ══════════════════════════════════════════════════════════ 验证

@rc.interface("atk.verify.payloads")
def verify_payloads(params):
    return m_verify.payloads(_s(params, "kind"))


@rc.interface("atk.verify.request")
def verify_request(params):
    return m_verify.send(_p(params))


@rc.interface("atk.verify.save")
def verify_save(params):
    return m_verify.save(_p(params))


@rc.interface("atk.verify.poc")
def verify_poc(params):
    return m_verify.gen_poc(_p(params))


# ══════════════════════════════════════════════════════════ 解码

@rc.interface("atk.decode.identify")
def decode_identify(params):
    return m_decode.identify(_s(params, "input"))


@rc.interface("atk.decode.chain")
def decode_chain(params):
    return m_decode.chain(_p(params))


@rc.interface("atk.decode.solve")
def decode_solve(params):
    return m_decode.solve(_p(params))


# ══════════════════════════════════════════════════════════ 取证

@rc.interface("atk.forensic.upload")
def forensic_upload(params):
    return m_forensic.upload(_p(params))


@rc.interface("atk.forensic.extract")
def forensic_extract(params):
    return {"artifacts": m_forensic.artifacts(_i(params, "task_id"))}


@rc.interface("atk.forensic.timeline")
def forensic_timeline(params):
    return {"items": m_forensic.timeline(_i(params, "task_id"))}


# ══════════════════════════════════════════════════════════ 环境

@rc.interface("atk.env.tools")
def env_tools(params):
    return util.tool_status()


@rc.interface("atk.env.scope")
def env_scope(params):
    return {"scope": util.get_scope(),
            "options": [
                {"v": "all", "label": "允许全部", "desc": "内网与公网目标都能测(默认)"},
                {"v": "lan", "label": "仅内网", "desc": "只允许 10/8、172.16/12、192.168/16"},
                {"v": "wan", "label": "仅公网", "desc": "内网段一律拒绝"},
            ]}


@rc.interface("atk.env.setScope")
def env_set_scope(params):
    v = _s(params, "scope")
    try:
        util.set_scope(v)
    except ValueError as e:
        raise ValueError(str(e))
    return {"scope": util.get_scope()}


@rc.interface("atk.env.info")
def env_info(params):
    return {
        "name": "atk", "label": LABEL, "version": VERSION, "lang": "python",
        "python": util._py_ver(),
        "plugin_dir": PLUGIN_DIR,
        "db": store.DB_PATH,
        "scope": util.get_scope(),
        "description": "安全作业编排台: 侦察、检测、验证、解码、取证",
        "modules": [
            {"id": "recon", "label": "侦察", "ready": True},
            {"id": "detect", "label": "检测", "ready": True},
            {"id": "verify", "label": "验证", "ready": True},
            {"id": "analyze", "label": "分析", "ready": False, "note": "四期: 依赖反汇编引擎"},
            {"id": "decode", "label": "解码", "ready": True},
            {"id": "forensic", "label": "取证", "ready": True},
        ],
    }


# ══════════════════════════════════════════════════════════ 启动

if __name__ == "__main__":
    store.conn()   # 建库建表, 顺便把 data/ 目录准备好
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="atk",
        version=VERSION,
        manifest={"label": LABEL, "description": "安全作业编排台: 侦察、检测、验证、解码、取证"},
        frontend={"pages": [{"path": "", "title": LABEL}]},
        # ★ 不要硬编码接口清单: iface_ids 会覆盖 rcplugin 的 _handlers.keys(),
        #   漏一个就报"接口不属于该插件"(JMComic 踩过这个坑)。
        iface_ids=None,
        plugin_dir=PLUGIN_DIR,
    )
