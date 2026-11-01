#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""QQ Bot 插件 —— 统一控制台网关。

两块后端：
  · NapCat（协议端）—— 概览 / QQ 账户 / 运行日志，走它自己的 WebUI API
  · rcbot（机器人）—— 模型提供商 / 人格 / 会话 / 上下文，走 127.0.0.1:6710

插件本身不持有业务状态，只做转发与聚合；NapCat 的 Credential 与日志环形缓冲
是唯一的进程内缓存，重启即失效、可自愈。
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

NAME = "QQBot"          # ★ 必须与插件目录名一致
VERSION = "1.1.1"

DIR = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(DIR, "data")
os.makedirs(DATA, exist_ok=True)
CFG_FILE = os.path.join(DATA, "config.json")

DEFAULT_CFG = {
    "api": "http://127.0.0.1:6710",          # rcbot
    "timeout": 90,
    "napcat": {
        "base": "http://127.0.0.1:6099",     # NapCat WebUI
        "token": "rcnapcat",
        "unit": "napcat",                    # systemd 单元名（读历史日志用）
    },
}


def _cfg():
    try:
        with open(CFG_FILE, "r", encoding="utf-8") as f:
            d = json.load(f) or {}
    except Exception:
        d = {}
    out = json.loads(json.dumps(DEFAULT_CFG))
    for k, v in d.items():
        if k == "napcat" and isinstance(v, dict):
            out["napcat"].update({kk: vv for kk, vv in v.items() if kk in out["napcat"]})
        elif k in out:
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


# ---------------------------------------------------------------- NapCat 客户端

_CRED = {"val": "", "exp": 0}
_CRED_LOCK = threading.RLock()


def _nc_login(force=False):
    """NapCat WebUI 的登录口令是 sha256(token + '.napcat')，返回 Credential。"""
    with _CRED_LOCK:
        if not force and _CRED["val"] and _CRED["exp"] > time.time():
            return _CRED["val"]
        cfg = _cfg()["napcat"]
        token = (cfg.get("token") or "").strip()
        if not token:
            raise RuntimeError("没有配置 NapCat WebUI token（设置页可改）")
        h = hashlib.sha256((token + ".napcat").encode("utf-8")).hexdigest()
        url = cfg["base"].rstrip("/") + "/api/auth/login"
        req = urllib.request.Request(
            url, json.dumps({"hash": h}).encode("utf-8"),
            {"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=12) as r:
                d = json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:
            raise RuntimeError("连不上 NapCat WebUI（%s）：%s"
                               % (cfg.get("base"), str(e)[:120]))
        cred = (d.get("data") or {}).get("Credential") or ""
        if not cred:
            raise RuntimeError("NapCat 登录失败：token 不对？（返回 %s）"
                               % json.dumps(d, ensure_ascii=False)[:160])
        _CRED["val"] = cred
        _CRED["exp"] = time.time() + 50 * 60
        return cred


def _nc(path, body=None, method="POST", timeout=15, retry=True):
    cfg = _cfg()["napcat"]
    url = cfg["base"].rstrip("/") + "/api" + path
    data = json.dumps(body if body is not None else {}).encode("utf-8") if method == "POST" else None
    headers = {"Content-Type": "application/json",
               "Authorization": "Bearer " + _nc_login()}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        if retry and e.code in (401, 403):
            _nc_login(force=True)
            return _nc(path, body, method, timeout, retry=False)
        raise RuntimeError("NapCat %s 返回 HTTP %s" % (path, e.code))
    except Exception as e:
        raise RuntimeError("NapCat 请求失败（%s）：%s" % (path, str(e)[:120]))


def _nc_data(path, body=None, method="POST", timeout=15):
    r = _nc(path, body, method, timeout)
    if r.get("code") not in (0, None):
        raise RuntimeError("NapCat %s 失败：%s" % (path, r.get("message") or r.get("code")))
    return r.get("data")


# ---------------------------------------------------------------- NapCat 实时日志缓冲

_LOG_BUF = collections.deque(maxlen=4000)
_LOG_LOCK = threading.Lock()
_LOG_THREAD = None
_LOG_STATE = {"connected": False, "err": "", "ts": 0}


def _log_push(level, msg):
    if not msg:
        return
    with _LOG_LOCK:
        _LOG_BUF.append({"level": (level or "info").lower(), "text": msg,
                         "ts": int(time.time())})


def _log_worker():
    """常驻订阅 NapCat 的 SSE 实时日志，写进环形缓冲。"""
    while True:
        try:
            cfg = _cfg()["napcat"]
            url = cfg["base"].rstrip("/") + "/api/Log/GetLogRealTime"
            req = urllib.request.Request(url, headers={
                "Authorization": "Bearer " + _nc_login(),
                "Accept": "text/event-stream"})
            with urllib.request.urlopen(req, timeout=90) as r:
                _LOG_STATE.update(connected=True, err="", ts=int(time.time()))
                for raw in r:
                    line = raw.decode("utf-8", "replace").strip()
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload:
                        continue
                    try:
                        obj = json.loads(payload)
                    except Exception:
                        _log_push("info", payload)
                        continue
                    if isinstance(obj, dict):
                        _log_push(obj.get("level"), obj.get("message") or obj.get("msg") or "")
                    else:
                        _log_push("info", str(obj))
                _LOG_STATE.update(connected=False, err="SSE 结束")
        except Exception as e:
            _LOG_STATE.update(connected=False, err=str(e)[:160])
            time.sleep(4)


def _log_ensure():
    global _LOG_THREAD
    if _LOG_THREAD and _LOG_THREAD.is_alive():
        return
    _LOG_THREAD = threading.Thread(target=_log_worker, name="nc-log", daemon=True)
    _LOG_THREAD.start()


def _journal(unit, lines=400):
    if not unit:
        return []
    try:
        p = subprocess.run(
            ["journalctl", "-u", unit, "-n", str(int(lines)),
             "--no-pager", "-o", "cat"],
            capture_output=True, timeout=12)
        txt = (p.stdout or b"").decode("utf-8", "replace")
        if p.returncode != 0 and not txt.strip():
            return []
        return [ln for ln in txt.splitlines() if ln.strip()]
    except Exception:
        return []


_LV = re.compile(r"\[(INFO|WARN|WARNING|ERROR|DEBUG|FATAL|TRACE)\]", re.I)


def _guess_level(line):
    m = _LV.search(line)
    if m:
        lv = m.group(1).lower()
        return "warn" if lv == "warning" else lv
    low = line.lower()
    if "error" in low or "失败" in line:
        return "error"
    if "warn" in low:
        return "warn"
    if "debug" in low:
        return "debug"
    return "info"


# ---------------------------------------------------------------- 连接设置

@rc.interface("qqbot.health")
def health(params):
    return {"ok": True, "ts": int(time.time()), "version": VERSION}


@rc.interface("qqbot.conn.get")
def conn_get(params):
    cfg = _cfg()
    nc_ok, nc_err = False, ""
    try:
        _nc_login()
        nc_ok = True
    except Exception as e:
        nc_err = str(e)[:160]
    rb_ok, rb_err = False, ""
    try:
        _data("/api/status", timeout=8)
        rb_ok = True
    except Exception as e:
        rb_err = str(e)[:160]
    return {"ok": True, "config": cfg, "version": VERSION,
            "napcat": {"ok": nc_ok, "error": nc_err},
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
    nc = p.get("napcat") or {}
    if isinstance(nc, dict):
        if "base" in nc:
            d["napcat"]["base"] = str(nc.get("base") or "").strip().rstrip("/") or DEFAULT_CFG["napcat"]["base"]
        if "token" in nc:
            d["napcat"]["token"] = str(nc.get("token") or "").strip()
        if "unit" in nc:
            d["napcat"]["unit"] = str(nc.get("unit") or "").strip() or "napcat"
        _CRED.update(val="", exp=0)
    _save_cfg(d)
    return {"ok": True, "config": d}


# ---------------------------------------------------------------- 概览（NapCat 基础信息）

def _sysinfo_sse(timeout=7):
    """NapCat 的 /base/GetSysStatusRealTime 是 SSE，取第一帧就够。"""
    cfg = _cfg()["napcat"]
    url = cfg["base"].rstrip("/") + "/api/base/GetSysStatusRealTime"
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + _nc_login(), "Accept": "text/event-stream"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            deadline = time.time() + timeout
            while time.time() < deadline:
                line = r.readline()
                if not line:
                    break
                s = line.decode("utf-8", "replace").strip()
                if s.startswith("data:"):
                    return json.loads(s[5:].strip())
    except Exception:
        return None
    return None


def _qq_process():
    """找到 QQ 主进程，返回 (pid, rss_mb, cpu_pct 采样)。"""
    try:
        p = subprocess.run(["pgrep", "-af", "qq --no-sandbox"],
                           capture_output=True, timeout=6)
        txt = (p.stdout or b"").decode("utf-8", "replace").strip().splitlines()
        if not txt:
            return None
        pid = int(txt[0].split()[0])
        with open("/proc/%d/status" % pid, "r", encoding="utf-8") as f:
            st = f.read()
        rss = 0
        for ln in st.splitlines():
            if ln.startswith("VmRSS:"):
                rss = int(ln.split()[1]) / 1024.0
                break
        return {"pid": pid, "rss_mb": round(rss, 1)}
    except Exception:
        return None


@rc.interface("qqbot.nc.overview")
def nc_overview(params):
    out = {"ok": True, "account": {}, "versions": {}, "sys": None,
           "counters": {}, "proc": None, "errors": []}

    # 账号
    try:
        st = _nc_data("/QQLogin/CheckLoginStatus") or {}
        out["account"].update({
            "login": bool(st.get("isLogin")),
            "offline": bool(st.get("isOffline")),
            "phase": st.get("loginPhase") or "",
            "qrcode": st.get("qrcodeurl") or "",
        })
    except Exception as e:
        out["errors"].append("账号状态：%s" % str(e)[:120])

    try:
        ql = _nc_data("/QQLogin/GetQuickLoginListNew") or []
        if isinstance(ql, dict):
            ql = ql.get("list") or []
        if ql:
            cur = ql[0]
            out["account"].update({
                "uin": str(cur.get("uin") or ""),
                "nick": cur.get("nickName") or "",
                "avatar": cur.get("faceUrl") or "",
            })
        out["quick"] = [{"uin": str(x.get("uin") or ""), "nick": x.get("nickName") or "",
                         "avatar": x.get("faceUrl") or ""} for x in ql]
    except Exception as e:
        out["errors"].append("快速登录：%s" % str(e)[:120])

    # 版本
    try:
        v = _nc_data("/base/GetNapCatVersion", method="GET")
        out["versions"]["napcat"] = (v or {}).get("version") if isinstance(v, dict) else str(v)
    except Exception as e:
        out["errors"].append("NapCat 版本：%s" % str(e)[:120])
    try:
        qv = _nc_data("/base/QQVersion", method="GET")
        out["versions"]["qq"] = qv if isinstance(qv, str) else (qv or {}).get("version")
    except Exception as e:
        out["errors"].append("QQ 版本：%s" % str(e)[:120])
    out["versions"]["webui"] = "Next"

    # 系统
    out["sys"] = _sysinfo_sse()
    out["proc"] = _qq_process()

    # 网络计数
    try:
        ob = _nc_data("/OB11Config/GetConfig") or {}
        net = ob.get("network") or {}
        out["counters"] = {
            "configs": len([1 for k in ("httpServers", "httpClients", "websocketServers",
                                        "websocketClients", "httpSseServers")
                            if net.get(k)]),
            "httpServers": len(net.get("httpServers") or []),
            "httpClients": len(net.get("httpClients") or []),
            "wsServers": len(net.get("websocketServers") or []),
            "wsClients": len(net.get("websocketClients") or []),
            "sseServers": len(net.get("httpSseServers") or []),
        }
    except Exception as e:
        out["errors"].append("网络配置：%s" % str(e)[:120])

    # rcbot 侧状态（顺带带上，前端概览底部展示）
    try:
        out["bot"] = _data("/api/status", timeout=8)
    except Exception as e:
        out["bot"] = None
        out["errors"].append("rcbot：%s" % str(e)[:120])
    return out


# ---------------------------------------------------------------- QQ 账户

@rc.interface("qqbot.nc.account")
def nc_account(params):
    out = {"ok": True, "status": {}, "quick": [], "qrcode": "", "errors": []}
    try:
        st = _nc_data("/QQLogin/CheckLoginStatus") or {}
        out["status"] = {
            "login": bool(st.get("isLogin")),
            "offline": bool(st.get("isOffline")),
            "phase": st.get("loginPhase") or "",
            "coreReady": bool(st.get("coreReady")),
            "err": st.get("loginError") or st.get("loginErrMsg") or "",
        }
        out["qrcode"] = st.get("qrcodeurl") or ""
    except Exception as e:
        out["errors"].append("账号状态：%s" % str(e)[:140])

    try:
        ql = _nc_data("/QQLogin/GetQuickLoginListNew") or []
        if isinstance(ql, dict):
            ql = ql.get("list") or []
        out["quick"] = [{"uin": str(x.get("uin") or ""), "nick": x.get("nickName") or "",
                         "avatar": x.get("faceUrl") or "",
                         "online": bool(x.get("isQuickLogin"))} for x in ql]
        if out["quick"] and not out["status"].get("login") is None:
            out["status"]["uin"] = out["quick"][0]["uin"]
            out["status"]["nick"] = out["quick"][0]["nick"]
            out["status"]["avatar"] = out["quick"][0]["avatar"]
    except Exception as e:
        out["errors"].append("快速登录：%s" % str(e)[:140])

    # 没登录时拿一张新二维码
    if not out["status"].get("login"):
        try:
            q = _nc_data("/QQLogin/GetQQLoginQrcode") or {}
            out["qrcode"] = q.get("qrcode") or out["qrcode"]
        except Exception as e:
            out["errors"].append("二维码：%s" % str(e)[:140])
    return out


@rc.interface("qqbot.nc.action")
def nc_action(params):
    act = (params or {}).get("action") or ""
    if act == "qrcode":
        return {"ok": True, "data": _nc_data("/QQLogin/GetQQLoginQrcode")}
    if act == "refresh":
        return {"ok": True, "data": _nc_data("/QQLogin/RefreshQRcode")}
    if act == "quick_login":
        uin = str((params or {}).get("uin") or "")
        if not uin:
            raise RuntimeError("缺少 uin")
        return {"ok": True, "data": _nc_data("/QQLogin/SetQuickLogin", {"uin": uin})}
    if act == "restart":
        return {"ok": True, "data": _nc_data("/QQLogin/RestartNapCat")}
    if act == "restart_process":
        return {"ok": True, "data": _nc_data("/Process/Restart")}
    raise RuntimeError("不认识的动作：%s" % act)


# ---------------------------------------------------------------- 运行日志（NapCat）

@rc.interface("qqbot.nc.logs")
def nc_logs(params):
    p = params or {}
    n = max(50, min(2000, int(p.get("lines") or 400)))
    mode = p.get("mode") or "live"
    level = (p.get("level") or "").lower()
    _log_ensure()

    if mode == "history":
        unit = (_cfg()["napcat"].get("unit") or "napcat").strip()
        raw = _journal(unit, n)
        source = "journal"
        items = [{"level": _guess_level(x), "text": x, "ts": 0} for x in raw]
        if not items:
            with _LOG_LOCK:
                items = list(_LOG_BUF)[-n:]
            source = "webui"
    else:
        with _LOG_LOCK:
            items = list(_LOG_BUF)[-n:]
        source = "webui"

    if level:
        items = [x for x in items if x["level"] == level]

    with _LOG_LOCK:
        total = len(_LOG_BUF)
    return {"ok": True, "items": items, "source": source, "total": total,
            "connected": _LOG_STATE["connected"], "err": _LOG_STATE["err"],
            "hint": "" if items else (
                "还没有日志。NapCat 的实时日志走 SSE，连上后新产生的日志会出现在这里"
                if source == "webui" else
                "读不到 systemd 日志（可能不是 systemd 起的，或当前用户没权限）")}


@rc.interface("qqbot.nc.logs.clear")
def nc_logs_clear(params):
    with _LOG_LOCK:
        _LOG_BUF.clear()
    return {"ok": True}


# ---------------------------------------------------------------- 机器人状态

@rc.interface("rcbot.status")
def status(params):
    return {"ok": True, "data": _data("/api/status", timeout=25)}


# ---------------------------------------------------------------- 设置（触发 / 上下文 / 能力）

@rc.interface("rcbot.config.get")
def config_get(params):
    return {"ok": True, "data": _data("/api/config")}


@rc.interface("rcbot.config.save")
def config_save(params):
    body = (params or {}).get("config") or {}
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
    "qqbot.nc.overview", "qqbot.nc.account", "qqbot.nc.action",
    "qqbot.nc.logs", "qqbot.nc.logs.clear",
    "rcbot.status",
    "rcbot.config.get", "rcbot.config.save", "rcbot.tools.search",
    "rcbot.providers", "rcbot.provider.save", "rcbot.provider.delete",
    "rcbot.provider.test", "rcbot.provider.models",
    "rcbot.personas", "rcbot.persona.save", "rcbot.persona.delete",
    "rcbot.sessions", "rcbot.session.get", "rcbot.session.save",
    "rcbot.session.clear", "rcbot.session.delete", "rcbot.context",
    "rcbot.test_chat",
]


if __name__ == "__main__":
    _log_ensure()
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name=NAME,
        version=VERSION,
        manifest={"label": "QQ Bot", "description": "NapCat + RainCough Bot 统一控制台"},
        frontend={"pages": [{"path": "", "title": "QQ Bot"}]},
        iface_ids=IFACES,
        plugin_dir=DIR,
    )
