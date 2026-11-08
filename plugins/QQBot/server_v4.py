#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""雨咯Bot 插件 —— SnowLuma + RainCough Bot 统一控制台网关。

两块后端：
  · SnowLuma（协议端）—— Docker 容器里跑 QQ，概览 / 账户 / 日志走 OneBot + docker
  · rcbot（机器人）—— 模型 / 人格 / 会话 / 上下文 / 聊天记录，走 127.0.0.1:6710

插件本身不持有业务状态，只做转发与聚合。2026-11-07 起删除 NapCat 双后端
（WebUI 客户端、systemd 多实例、二维码接口、SSE 日志缓冲）与其切换接口。
"""

import collections
import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc  # noqa: E402
from rcbot import backend, snowluma  # noqa: E402  SnowLuma 后端适配
from rcbot import logbuf as _logbuf  # noqa: E402

NAME = "QQBot"          # ★ 必须与插件目录名一致（目录名即插件身份，不改）
VERSION = "1.4.0"
LABEL = "雨咯Bot"

DIR = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(DIR, "data")
os.makedirs(DATA, exist_ok=True)
CFG_FILE = os.path.join(DATA, "config.json")

DEFAULT_CFG = {
    "api": "http://127.0.0.1:6710",          # rcbot
    "timeout": 90,
}

def _cfg():
    try:
        with open(CFG_FILE, "r", encoding="utf-8") as f:
            d = json.load(f) or {}
    except Exception:
        d = {}
    out = json.loads(json.dumps(DEFAULT_CFG))
    for k, v in d.items():
        if k in out:
            out[k] = v
    return out


def _save_cfg(d):
    tmp = CFG_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CFG_FILE)


def _q(s):
    return urllib.parse.quote(str(s), safe="")


# ---------------------------------------------------------------- rcbot 转发

def _req(path, method="GET", body=None, timeout=None):
    cfg = _cfg()
    url = cfg["api"].rstrip("/") + path
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout or cfg["timeout"]) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8", "replace"))
        except Exception:
            return {"ok": False, "error": "rcbot 返回 HTTP %s" % e.code}
    except Exception as e:
        return {"ok": False,
                "error": "连不上 rcbot（%s）。在服务器上跑 systemctl status rcbot 看看"
                         % str(e)[:120]}


def _data(path, method="GET", body=None, timeout=None):
    r = _req(path, method, body, timeout)
    if not r.get("ok"):
        raise RuntimeError(r.get("error") or "rcbot 返回失败")
    return r.get("data")


# ---------------------------------------------------------------- 连接设置

@rc.interface("qqbot.health")
def health(params):
    return {"ok": True, "ts": int(time.time()), "version": VERSION}


@rc.interface("qqbot.conn.get")
def conn_get(params):
    """连接设置与连通性（SnowLuma 容器 + rcbot）。"""
    cfg = _cfg()
    rb_ok, rb_err = False, ""
    try:
        _data("/api/status", timeout=8)
        rb_ok = True
    except Exception as e:
        rb_err = str(e)[:160]
    sl_ok, sl_err = False, ""
    try:
        if not snowluma.docker_ok():
            sl_err = "Docker 不可用"
        elif not snowluma.exists():
            sl_err = "SnowLuma 容器不存在"
        else:
            sl_ok = True
    except Exception as e:
        sl_err = str(e)[:160]
    return {"ok": True, "config": cfg, "version": VERSION,
            "snowluma": {"ok": sl_ok, "error": sl_err},
            "rcbot": {"ok": rb_ok, "error": rb_err}}


@rc.interface("qqbot.conn.save")
def conn_save(params):
    p = (params or {}).get("config") or {}
    d = _cfg()
    if "api" in p:
        d["api"] = str(p.get("api") or "").strip().rstrip("/") or DEFAULT_CFG["api"]
    if "timeout" in p:
        try:
            d["timeout"] = max(10, min(300, int(p["timeout"])))
        except Exception:
            pass
    _save_cfg(d)
    return {"ok": True, "config": d}


# ---------------------------------------------------------------- 概览（SnowLuma）

def _sysinfo_proc():
    """宿主机 CPU / 内存（直接从 /proc 读）。

    ★ 不要去问框架要系统信息：SnowLuma 在容器里，容器看到的是自己的
      资源视图；而且早先那套 SSE 接口会超时 7 秒，把概览拖到首屏空白。
      直接读宿主机 /proc 最稳也最快。
    返回结构：{cpu:{model,core,speed,usage:{system,qq}},
              memory:{total,usage:{system,qq}}}
    """
    out = {"cpu": {}, "memory": {}}
    try:
        model, mhz = "", []
        with open("/proc/cpuinfo", "r", encoding="utf-8", errors="replace") as f:
            for ln in f:
                if ln.startswith("model name") and not model:
                    model = ln.split(":", 1)[1].strip()
                elif ln.startswith("cpu MHz"):
                    try:
                        mhz.append(float(ln.split(":", 1)[1]))
                    except ValueError:
                        pass
        out["cpu"]["model"] = model
        out["cpu"]["core"] = len(mhz) or (os.cpu_count() or 0)
        if mhz:
            out["cpu"]["speed"] = "%.2f" % (sum(mhz) / len(mhz) / 1024.0)
    except Exception:
        pass

    # 使用率要两次采样：/proc/stat 首行是累计值
    try:
        def snap():
            with open("/proc/stat", "r", encoding="utf-8") as f:
                p = [int(x) for x in f.readline().split()[1:]]
            return p[3] + p[4], sum(p)      # idle+wait, total

        i1, t1 = snap()
        time.sleep(0.25)
        i2, t2 = snap()
        dt = (t2 - t1) or 1
        out["cpu"]["usage"] = {"system": "%.1f" % (100.0 * (1 - (i2 - i1) / float(dt)))}
    except Exception:
        out["cpu"]["usage"] = {}

    try:
        mi = {}
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for ln in f:
                k, _ = ln.split(":", 1)
                mi[k] = int(ln.split()[1])
        total = mi.get("MemTotal", 0) / 1024.0
        avail = mi.get("MemAvailable", mi.get("MemFree", 0)) / 1024.0
        out["memory"] = {"total": "%.1f" % total,
                         "usage": {"system": "%.1f" % (total - avail)}}
    except Exception:
        pass
    return out


# 群数/好友数的短期缓存（概览 5 秒轮询，别每次都问 OneBot）
_COUNT_CACHE = {"v": {}, "t": 0}


def _overview_snowluma():
    """SnowLuma 下的概览。

    SnowLuma 没有 WebUI 接口，这里给：账号状态（OneBot get_login_info）、
    网关版本、系统信息、机器人状态，以及群/好友/会话计数。
    """
    out = {"ok": True, "account": {}, "versions": {}, "sys": None,
           "counters": {}, "proc": None, "errors": [], "backend": "snowluma"}
    info = backend.account_info()
    out["account"] = {
        "uin": info.get("uin") or "",
        "nick": info.get("nick") or "",
        "avatar": info.get("avatar") or "",
        "login": bool(info.get("login")),
        "offline": not bool(info.get("login")),
        "phase": info.get("phase") or "",
        "qrcode": "",
        "state": info.get("state") or "",
    }
    out["instances"] = [{"uin": info.get("uin") or "", "webui": "",
                         "unit": "snowluma"}]
    if not info.get("login"):
        out["errors"].append("还没有登录 QQ 账号 —— 去「QQ 账户」扫码（在远程桌面里）")

    # OneBot 版本（登录后才有）
    #
    # 键名：framework=框架名、webui=网关版本（app_version）、qq=QQ 版本。
    #   QQ 跑在容器里，宿主机拿不到版本，留空显示 —。
    try:
        v = backend.onebot_call("get_version_info") or {}
        out["versions"] = {
            "framework": v.get("app_name") or "SnowLuma",
            "qq": "",
            "webui": v.get("app_version") or v.get("version") or "",
            "onebot": v.get("protocol_version") or "",
        }
    except Exception:
        out["versions"] = {"framework": "SnowLuma"}

    out["sys"] = _sysinfo_proc()
    out["proc"] = None          # QQ 跑在容器里，宿主机看不到进程
    try:
        out["bot"] = _data("/api/status", timeout=8)
    except Exception as e:
        out["bot"] = None
        out["errors"].append("rcbot：%s" % str(e)[:120])

    # 计数器：换成对用户有用的几个数（群/好友/会话/消息）。
    # 群/好友数走 OneBot 查，但概览每 5 秒刷一次 —— 加 30 秒缓存，
    # 不然一天下来白调几万次。
    cnt = dict(_COUNT_CACHE.get("v") or {})
    if time.time() - _COUNT_CACHE.get("t", 0) > 30 or not cnt:
        try:
            gl = backend.onebot_call("get_group_list") or []
            fl = backend.onebot_call("get_friend_list") or []
            cnt["groups"] = len(gl) if isinstance(gl, list) else 0
            cnt["friends"] = len(fl) if isinstance(fl, list) else 0
            _COUNT_CACHE.update({"v": {"groups": cnt["groups"], "friends": cnt["friends"]},
                                 "t": time.time()})
        except Exception:
            pass
    st = ((out.get("bot") or {}).get("stats") or {})
    cnt["sessions"] = st.get("sessions") or 0
    cnt["messages"] = st.get("chat_logs") or st.get("messages") or 0
    out["counters"] = cnt
    return out


@rc.interface("qqbot.overview")
def overview(params):
    """概览：账号 / 版本 / 系统 / 计数器，全部来自 SnowLuma + rcbot。"""
    return _overview_snowluma()


# ---------------------------------------------------------------- QQ 账户（SnowLuma）
#
# 账户页只关心"什么状态、怎么登录、能不能重启"，底下由 rcbot/backend.py 适配。
# 这里只做转发，不直接碰 Docker / OneBot。

@rc.interface("qqbot.account.info")
def account_info(params):
    """当前账户信息（后端无关）。

    返回 {backend, uin, nick, avatar, login, accepted, core_ready, phase,
          state, webui_port, onebot_port, scan_mode, novnc_port, novnc_path,
          novnc_password, online, connected, error}
    """
    return {"ok": True, "data": backend.account_info()}


@rc.interface("qqbot.account.qrcode")
def account_qrcode(params):
    """登录入口。

    SnowLuma 没有二维码 API，返回 {mode:'novnc', novnc_port, novnc_path,
    novnc_password}；前端 iframe 嵌远程桌面，用户在里面扫码。
    """
    if os.geteuid() != 0:
        raise RuntimeError("扫码登录需要 root 权限（当前面板不是 root 运行）")
    try:
        return {"ok": True, "data": backend.scan()}
    except Exception as e:
        raise RuntimeError(str(e)[:300])


@rc.interface("qqbot.account.refresh_qrcode")
def account_refresh_qrcode(params):
    """刷新登录二维码（SnowLuma 下是空操作，远程桌面自己轮换）。"""
    try:
        return {"ok": True, "data": backend.refresh_scan()}
    except Exception as e:
        raise RuntimeError(str(e)[:300])


@rc.interface("qqbot.account.status")
def account_status(params):
    """查登录进度（后端无关）。"""
    try:
        return {"ok": True, "data": backend.status()}
    except Exception as e:
        raise RuntimeError(str(e)[:300])


@rc.interface("qqbot.account.action")
def account_action(params):
    """账户操作：start / stop / restart / quick_login / logout。"""
    if os.geteuid() != 0:
        raise RuntimeError("操作账户需要 root 权限（当前面板不是 root 运行）")
    act = str((params or {}).get("action") or "").lower()
    try:
        return {"ok": True, "data": backend.action(act)}
    except Exception as e:
        raise RuntimeError(str(e)[:300])


@rc.interface("qqbot.account.logs")
def account_logs(params):
    """SnowLuma 容器日志（docker logs 本身就是历史，live/history 一视同仁）。"""
    p = params or {}
    n = max(50, min(2000, int(p.get("lines") or 400)))
    level = (p.get("level") or "").lower()
    d = backend.logs(n)
    if level:
        d["items"] = [x for x in d["items"] if x.get("level") == level]
    d["ok"] = True
    return d


@rc.interface("qqbot.account.logs.clear")
def account_logs_clear(params):
    """容器日志由 Docker 管理，没有内存缓冲可清。"""
    return {"ok": True, "data": backend.logs_clear()}


@rc.interface("rcbot.status")
def status(params):
    return {"ok": True, "data": _data("/api/status", timeout=25)}


# ---------------------------------------------------------------- 聊天记录

@rc.interface("qqbot.chat.sessions")
def chat_sessions(params):
    """聊天记录会话列表。"""
    p = params or {}
    q = {}
    for k in ("account_id", "kind", "kw", "limit"):
        if p.get(k) not in (None, ""):
            q[k] = p[k]
    qs = urllib.parse.urlencode(q)
    data = _data("/api/chat/sessions" + ("?" + qs if qs else ""), timeout=30)
    # 本机托管的群头像给的是绝对路径，这里转成面板预览 URL（浏览器直接能取）
    for it in ((data or {}).get("items") or []):
        ap = it.get("avatar_path")
        if ap:
            it["avatar"] = "/api/fm/preview?path=" + urllib.parse.quote(str(ap))
    return {"ok": True, "data": data}


@rc.interface("qqbot.chat.messages")
def chat_messages(params):
    """聊天记录消息分页。"""
    p = params or {}
    q = {}
    for k in ("session_id", "before_id", "limit", "kw"):
        if p.get(k) not in (None, ""):
            q[k] = p[k]
    if not q.get("session_id"):
        raise RuntimeError("缺少 session_id")
    qs = urllib.parse.urlencode(q)
    return {"ok": True, "data": _data("/api/chat/messages?" + qs, timeout=30)}


@rc.interface("qqbot.chat.random_reply")
def chat_random_reply(params):
    """从已启用的群聊里随机挑一条消息，让机器人对它回一句。"""
    p = dict(params or {})
    return {"ok": True, "data": _data("/api/chat/random_reply", "POST", p, timeout=180)}


@rc.interface("qqbot.chat.random_reply.send")
def chat_random_reply_send(params):
    """把随机挑出来的那条回复真正发到 QQ。"""
    p = dict(params or {})
    return {"ok": True, "data": _data("/api/chat/random_reply/send", "POST", p, timeout=60)}


@rc.interface("qqbot.chat.forward")
def chat_forward(params):
    """展开合并转发消息（返回节点列表，图片已落盘）。"""
    p = dict(params or {})
    fid = str(p.get("id") or "")
    if not fid:
        raise RuntimeError("缺少 id")
    qs = urllib.parse.urlencode({"id": fid})
    return {"ok": True, "data": _data("/api/chat/forward?" + qs, timeout=45)}


@rc.interface("qqbot.chat.session_ui")
def chat_session_ui(params):
    """保存会话 UI 状态（置顶 / 免打扰 / 已读位置 / 草稿）。"""
    p = dict(params or {})
    if not p.get("session_id"):
        raise RuntimeError("缺少 session_id")
    return {"ok": True, "data": _data("/api/chat/session-ui", "POST", p, timeout=20)}


@rc.interface("qqbot.chat.recall")
def chat_recall(params):
    """撤回一条消息（自己的、2 分钟内最稳）。"""
    p = dict(params or {})
    mid = str(p.get("msg_id") or "")
    if not mid:
        raise RuntimeError("缺少 msg_id")
    return {"ok": True, "data": _data("/api/chat/recall", "POST", p, timeout=30)}


@rc.interface("qqbot.chat.stats")
def chat_stats(params):
    """聊天记录统计 + 媒体占用 + 磁盘水位。"""
    p = params or {}
    q = {}
    if p.get("account_id"):
        q["account_id"] = p["account_id"]
    qs = urllib.parse.urlencode(q)
    return {"ok": True, "data": _data("/api/chat/stats" + ("?" + qs if qs else ""),
                                       timeout=30)}


@rc.interface("qqbot.chat.export")
def chat_export(params):
    """导出 JSON。

    rcbot 的 /api/chat/export 返回的是**文件下载**（带 Content-Disposition），
    不是 JSON-RPC 那样的 {ok,data}，所以这里不能用 _data() —— 要直接取字节再解析。
    """
    p = params or {}
    q = {}
    for k in ("account_id", "session_id", "from", "to"):
        if p.get(k) not in (None, ""):
            q[k] = p[k]
    qs = urllib.parse.urlencode(q)
    url = _cfg()["api"].rstrip("/") + "/api/chat/export" + ("?" + qs if qs else "")
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            raw = r.read().decode("utf-8", "replace")
    except Exception as e:
        raise RuntimeError("导出失败：%s" % str(e)[:200])
    try:
        doc = json.loads(raw)
    except Exception as e:
        raise RuntimeError("导出结果不是合法 JSON：%s" % str(e)[:120])
    return {"ok": True, "data": doc}


@rc.interface("qqbot.chat.purge_media")
def chat_purge_media(params):
    """清理媒体文件（保留消息文本）。"""
    p = params or {}
    if p.get("confirm") is not True:
        raise RuntimeError("需要 confirm=true")
    return {"ok": True, "data": _data("/api/chat/purge-media", "POST", {
        "account_id": p.get("account_id") or "",
        "session_id": p.get("session_id") or "",
        "from": int(p.get("from") or 0),
        "to": int(p.get("to") or 0),
        "confirm": True,
    }, timeout=300)}


# ---------------------------------------------------------------- 查询

@rc.interface("qqbot.chat.query")
def chat_query(params):
    """按条件查消息。

    可叠加的条件（都是「与」关系）：
      sender   —— QQ 号（精确）或昵称（模糊）
      recalled —— '' 全部 / 'yes' 已撤回 / 'no' 未撤回
      kind     —— '' 全部 / text 文本 / image 图片 / video 视频 / record 语音
                  / face 表情 / file 文件
      kw       —— 文本关键词
      session_id / from / to —— 限定会话与日期范围
    """
    p = params or {}
    q = {}
    for k in ("sender", "recalled", "kind", "session_id", "account_id"):
        if p.get(k) not in (None, ""):
            q[k] = p[k]
    if p.get("kw"):
        q["kw"] = p["kw"]
    if p.get("from"):
        q["from"] = int(p["from"])
    if p.get("to"):
        q["to"] = int(p["to"])
    q["limit"] = int(p.get("limit") or 50)
    if p.get("before_id"):
        q["before_id"] = int(p["before_id"])
    qs = urllib.parse.urlencode(q)
    return {"ok": True, "data": _data("/api/chat/query?" + qs, timeout=60)}


@rc.interface("qqbot.chat.senders")
def chat_senders(params):
    """聊天里出现过的发送者（查询界面做自动补全）。"""
    p = params or {}
    qs = urllib.parse.urlencode({"kw": p.get("kw") or ""})
    return {"ok": True, "data": _data("/api/chat/senders?" + qs, timeout=30)}


# ---------------------------------------------------------------- 一键清空会话

@rc.interface("qqbot.chat.clear_session")
def chat_clear_session(params):
    """一键清空会话。

    with_media=True 时连媒体文件一起删（默认只删消息记录）。
    """
    p = params or {}
    if p.get("confirm") is not True:
        raise RuntimeError("需要 confirm=true")
    sid = str(p.get("session_id") or "").strip()
    if not sid:
        raise RuntimeError("缺少 session_id")
    return {"ok": True, "data": _data("/api/chat/session-clear", "POST", {
        "session_id": sid,
        "account_id": p.get("account_id") or "",
        "with_media": bool(p.get("with_media")),
        "confirm": True,
    }, timeout=300)}


# ---------------------------------------------------------------- 媒体库

@rc.interface("qqbot.chat.media_list")
def chat_media_list(params):
    """媒体库列表 + 统计。"""
    p = params or {}
    q = {}
    for k in ("kind", "sender", "session_id", "account_id"):
        if p.get(k) not in (None, ""):
            q[k] = p[k]
    if p.get("kw"):
        q["kw"] = p["kw"]
    q["limit"] = int(p.get("limit") or 100)
    q["offset"] = int(p.get("offset") or 0)
    qs = urllib.parse.urlencode(q)
    return {"ok": True, "data": _data("/api/chat/media?" + qs, timeout=60)}


@rc.interface("qqbot.chat.media_delete")
def chat_media_delete(params):
    """删除媒体文件。"""
    p = params or {}
    if p.get("confirm") is not True:
        raise RuntimeError("需要 confirm=true")
    return {"ok": True, "data": _data("/api/chat/media/delete", "POST", {
        "ids": p.get("ids") or [],
        "rels": p.get("rels") or [],
        "kind": p.get("kind") or "",
        "session_id": p.get("session_id") or "",
        "confirm": True,
    }, timeout=300)}


@rc.interface("qqbot.chat.media_transcode")
def chat_media_transcode(params):
    """把 HEVC 视频 / AMR 语音转成浏览器能播的格式。"""
    p = params or {}
    return {"ok": True, "data": _data("/api/chat/media/transcode", "POST", {
        "ids": p.get("ids") or [],
    }, timeout=1800)}


@rc.interface("qqbot.chat.media_reindex")
def chat_media_reindex(params):
    """重建媒体索引（补齐历史数据）。"""
    return {"ok": True, "data": _data("/api/chat/media/reindex", "POST", {},
                                     timeout=300)}


@rc.interface("qqbot.chat.media_repair")
def chat_media_repair(params):
    """修复媒体引用（转码后消息里还指向旧文件名 → 前端取不到文件）。"""
    return {"ok": True, "data": _data("/api/chat/media/repair", "POST", {},
                                      timeout=300)}


@rc.interface("rcbot.accounts")
def rcbot_accounts(params):
    """rcbot 侧的账号列表（连接状态）。"""
    return {"ok": True, "data": _data("/api/accounts", timeout=25)}


@rc.interface("rcbot.account.save")
def rcbot_account_save(params):
    """新增/修改/删除账号（rcbot 侧配置）。"""
    p = params or {}
    return {"ok": True, "data": _data("/api/accounts", "POST", p, timeout=25)}


# ---------------------------------------------------------------- 设置（触发 / 上下文 / 能力）

@rc.interface("rcbot.config.get")
def config_get(params):
    return {"ok": True, "data": _data("/api/config")}


@rc.interface("rcbot.config.save")
def config_save(params):
    # ★ 兼容两种参数写法：
    #   {config: {...}}  —— 规范写法
    #   {context: {...}} —— 前端设置页的写法（整个 params 就是配置体）
    #   ★ 以前只认第一种，而前端用的是第二种 —— 设置页的「上下文 / 触发规则 /
    #     能力开关」三块保存其实一直是**静默失败**的（保存了但没生效）。
    p = params or {}
    body = p.get("config")
    if not isinstance(body, dict):
        body = {k: v for k, v in p.items() if k != "config"}
    return {"ok": True, "data": _data("/api/config", "POST", body)}


@rc.interface("rcbot.tools.search")
def tools_search(params):
    q = (params or {}).get("q") or ""
    if not q.strip():
        raise RuntimeError("缺少关键词")
    return {"ok": True, "data": _data("/api/tools/search?q=" + _q(q), timeout=40)}


# ---------------------------------------------------------------- 模型提供商

@rc.interface("rcbot.providers")
def providers(params):
    return {"ok": True, "data": _data("/api/providers")}


@rc.interface("rcbot.provider.save")
def provider_save(params):
    return {"ok": True, "data": _data("/api/providers", "POST", params or {})}


@rc.interface("rcbot.provider.delete")
def provider_delete(params):
    return {"ok": True, "data": _data("/api/providers/delete", "POST", params or {})}


@rc.interface("rcbot.provider.test")
def provider_test(params):
    return {"ok": True, "data": _data("/api/providers/test", "POST", params or {}, timeout=150)}


@rc.interface("rcbot.provider.models")
def provider_models(params):
    pid = (params or {}).get("id") or ""
    return {"ok": True, "data": _data("/api/providers/models?id=" + _q(pid), timeout=40)}


# ---------------------------------------------------------------- 人格

@rc.interface("rcbot.cards")
def cards_list(params):
    """角色卡片列表。"""
    return {"ok": True, "data": _data("/api/cards")}


@rc.interface("rcbot.card.save")
def card_save(params):
    """保存角色卡片（新建/更新/设为默认）。"""
    p = dict(params or {})
    if not isinstance(p.get("card"), dict):
        raise RuntimeError("缺少 card")
    return {"ok": True, "data": _data("/api/cards", "POST", p, timeout=20)}


@rc.interface("rcbot.card.delete")
def card_delete(params):
    """删除角色卡片。"""
    p = dict(params or {})
    if not p.get("id"):
        raise RuntimeError("缺少 id")
    return {"ok": True, "data": _data("/api/cards/delete", "POST", p, timeout=20)}


@rc.interface("rcbot.card.clone")
def card_clone(params):
    """复制一份角色卡片。"""
    p = dict(params or {})
    if not p.get("id"):
        raise RuntimeError("缺少 id")
    return {"ok": True, "data": _data("/api/cards/clone", "POST", p, timeout=20)}


@rc.interface("rcbot.card.import")
def card_import(params):
    """导入角色卡片（JSON）。"""
    p = dict(params or {})
    if not p.get("json"):
        raise RuntimeError("缺少 json")
    return {"ok": True, "data": _data("/api/cards/import", "POST", p, timeout=20)}


@rc.interface("rcbot.card.export")
def card_export(params):
    """导出角色卡片（JSON 字符串）。"""
    p = dict(params or {})
    qs = urllib.parse.urlencode({"id": p.get("id") or ""})
    return {"ok": True, "data": _data("/api/cards/export?" + qs, timeout=20)}


@rc.interface("rcbot.personas")
def personas(params):
    return {"ok": True, "data": _data("/api/personas")}


@rc.interface("rcbot.persona.save")
def persona_save(params):
    return {"ok": True, "data": _data("/api/personas", "POST", params or {})}


@rc.interface("rcbot.persona.delete")
def persona_delete(params):
    return {"ok": True, "data": _data("/api/personas/delete", "POST", params or {})}


# ---------------------------------------------------------------- 会话

@rc.interface("rcbot.sessions")
def sessions(params):
    return {"ok": True, "data": _data("/api/sessions")}


@rc.interface("rcbot.session.get")
def session_get(params):
    p = params or {}
    sid = _q(p.get("id") or "")
    limit = int(p.get("limit") or 50)
    return {"ok": True, "data": _data("/api/sessions/%s?limit=%d" % (sid, limit))}


@rc.interface("rcbot.session.save")
def session_save(params):
    p = dict(params or {})
    sid = _q(p.pop("id", ""))
    return {"ok": True, "data": _data("/api/sessions/%s" % sid, "POST", p)}


@rc.interface("rcbot.session.clear")
def session_clear(params):
    sid = _q((params or {}).get("id") or "")
    return {"ok": True, "data": _data("/api/sessions/%s/clear" % sid, "POST", {})}


@rc.interface("rcbot.session.catalog")
def session_catalog(params):
    """拉取全部群聊/私聊，登记成会话目录（新增项默认不启用）。"""
    return {"ok": True, "data": _data("/api/sessions/catalog", "POST", params or {}, timeout=90)}


@rc.interface("rcbot.session.bulk")
def session_bulk(params):
    """批量启用/停用会话。"""
    return {"ok": True, "data": _data("/api/sessions/bulk", "POST", params or {}, timeout=30)}


@rc.interface("rcbot.session.delete")
def session_delete(params):
    return {"ok": True, "data": _data("/api/sessions/delete", "POST", params or {})}


@rc.interface("rcbot.context")
def context_preview(params):
    sid = (params or {}).get("id") or ""
    return {"ok": True, "data": _data("/api/context?sid=" + _q(sid))}


# ---------------------------------------------------------------- 试聊

@rc.interface("rcbot.test_chat")
def test_chat(params):
    return {"ok": True, "data": _data("/api/test/chat", "POST", params or {}, timeout=180)}


IFACES = [
    "qqbot.health", "qqbot.conn.get", "qqbot.conn.save",
    "qqbot.overview",
    # 单账户（2026-11-02 从多账户回退）
    "qqbot.account.info", "qqbot.account.qrcode", "qqbot.account.refresh_qrcode",
    "qqbot.account.status", "qqbot.account.action", "qqbot.account.logs",
    "qqbot.account.logs.clear",
    "qqbot.chat.sessions", "qqbot.chat.messages", "qqbot.chat.stats",
    "qqbot.chat.recall", "qqbot.chat.forward", "qqbot.chat.session_ui",
    "qqbot.chat.random_reply", "qqbot.chat.random_reply.send",
    "qqbot.chat.export", "qqbot.chat.purge_media",
    # 查询 / 清空会话 / 媒体库
    "qqbot.chat.query", "qqbot.chat.senders", "qqbot.chat.clear_session",
    "qqbot.chat.media_list", "qqbot.chat.media_delete",
    "qqbot.chat.media_transcode", "qqbot.chat.media_reindex",
    "qqbot.chat.media_repair",
    "rcbot.status", "rcbot.accounts", "rcbot.account.save",
    "rcbot.config.get", "rcbot.config.save", "rcbot.tools.search",
    "rcbot.providers", "rcbot.provider.save", "rcbot.provider.delete",
    "rcbot.provider.test", "rcbot.provider.models",
    "rcbot.cards", "rcbot.card.save", "rcbot.card.delete",
    "rcbot.card.clone", "rcbot.card.import", "rcbot.card.export",
    "rcbot.personas", "rcbot.persona.save", "rcbot.persona.delete",
    "rcbot.sessions", "rcbot.session.get", "rcbot.session.save",
    "rcbot.session.clear", "rcbot.session.delete", "rcbot.context",
    "rcbot.session.catalog", "rcbot.session.bulk",
    "rcbot.test_chat",
]


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name=NAME,
        version=VERSION,
        manifest={"label": LABEL, "description": "SnowLuma + RainCough Bot 统一控制台"},
        frontend={"pages": [{"path": "", "title": LABEL}]},
        iface_ids=IFACES,
        plugin_dir=DIR,
    )
