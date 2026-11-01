#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""雨咯Bot 插件 —— 统一控制台网关。

三块后端：
  · NapCat（协议端）—— 概览 / QQ 账户 / 运行日志，走它自己的 WebUI API
  · rcbot（机器人）—— 模型提供商 / 人格 / 会话 / 上下文 / 聊天记录，走 127.0.0.1:6710
  · NapCat 实例管理 —— systemd 模板多实例（tools/napcat_inst.py）

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

NAME = "QQBot"          # ★ 必须与插件目录名一致（目录名即插件身份，不改）
VERSION = "1.3.0"
LABEL = "雨咯Bot"

DIR = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(DIR, "data")
os.makedirs(DATA, exist_ok=True)
CFG_FILE = os.path.join(DATA, "config.json")

DEFAULT_CFG = {
    "api": "http://127.0.0.1:6710",          # rcbot
    "timeout": 90,
    "napcat": {
        "base": "http://127.0.0.1:6099",     # NapCat WebUI（默认实例）
        "token": "rcnapcat",
        "unit": "napcat",                    # systemd 单元名（读历史日志用）
    },
    # ★ 多实例：NapCat 实例的 systemd 管理
    "instances": {
        "base_dir": "/opt/napcat/instances",
        "webui_base": 6099,      # WebUI = base + index
        "onebot_base": 6700,     # OneBot = base + 2*index（避开 rcbot 的 6710）
        "manage_enabled": True,  # 是否允许面板增删实例（需要 root）
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


# ---- 指定实例的 NapCat 调用（多账号时每个实例有自己的 WebUI 端口与 token）
#
# Credential 是 per-instance 的（登录的是那个实例的 WebUI），
# 所以要单独缓存，不能共用 _CRED。

_CRED_AT = {}
_CRED_AT_LOCK = threading.RLock()


def _nc_login_at(base, token, force=False):
    """对指定 WebUI 登录，返回 Credential。"""
    with _CRED_AT_LOCK:
        key = base + "|" + token
        c = _CRED_AT.get(key)
        if not force and c and c["exp"] > time.time():
            return c["val"]
        digest = hashlib.sha256((token + ".napcat").encode("utf-8")).hexdigest()
        url = base.rstrip("/") + "/api/auth/login"
        # ★ 字段名是 "hash" 不是 "token" —— 写错的话 NapCat 收到空 token,
        #   返回 {"code":-1,"message":"token is empty"}，
        #   而我们自己的代码会把它当成"token 不对？"，误导排查方向。
        data = json.dumps({"hash": digest}).encode("utf-8")
        req = urllib.request.Request(url, data=data,
                                     headers={"Content-Type": "application/json"},
                                     method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                d = json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:
            raise RuntimeError("连不上 NapCat WebUI（%s）：%s" % (base, str(e)[:120]))
        cred = (d.get("data") or {}).get("Credential") or ""
        if not cred:
            # 把 NapCat 的原始 message 透出来 —— "token is empty" 和
            # "token 不对" 是两回事,混在一起会把排查带偏
            msg = d.get("message") or d.get("msg") or ""
            raise RuntimeError("NapCat 登录失败（%s）：%s"
                               % (base, msg or json.dumps(d, ensure_ascii=False)[:120]))
        _CRED_AT[key] = {"val": cred, "exp": time.time() + 50 * 60}
        return cred


def _nc_at(base, token, path, body=None, method="POST", timeout=15, retry=True):
    url = base.rstrip("/") + "/api" + path
    data = json.dumps(body if body is not None else {}).encode("utf-8") if method == "POST" else None
    headers = {"Content-Type": "application/json",
               "Authorization": "Bearer " + _nc_login_at(base, token)}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        if retry and e.code in (401, 403):
            _nc_login_at(base, token, force=True)
            return _nc_at(base, token, path, body, method, timeout, retry=False)
        raise RuntimeError("NapCat %s 返回 HTTP %s" % (path, e.code))
    except Exception as e:
        raise RuntimeError("NapCat 请求失败（%s）：%s" % (path, str(e)[:120]))


def _nc_data_at(base, token, path, body=None, method="POST", timeout=15):
    r = _nc_at(base, token, path, body, method, timeout)
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


# ---------------------------------------------------------------- NapCat 实例管理
#
# 一个 QQ 号 = 一个 NapCat 实例 = 一套 systemd 单元（napcat@<uin> + xvfb@<n>）。
# 端口：WebUI = 6099+index，OneBot = 6700+2*index（避开 rcbot 的 6710）。


def _inst_cfg():
    return _cfg().get("instances") or {}


def _run(cmd, timeout=60):
    """跑一条命令，返回 (rc, 输出)。"""
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True, timeout=timeout)
        return p.returncode, ((p.stdout or b"") + (p.stderr or b"")).decode("utf-8", "replace")
    except Exception as e:
        return 1, str(e)


def _inst_dir(uin):
    base = (_inst_cfg().get("base_dir") or "/opt/napcat/instances").rstrip("/")
    return os.path.join(base, str(uin))


def _inst_env(uin):
    """读实例的 env 文件（端口/display）。"""
    out = {}
    try:
        with open(os.path.join(_inst_dir(uin), "env"), "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    out[k.strip()] = v.strip()
    except Exception:
        pass
    return out


def _inst_list():
    """列出所有实例目录。"""
    base = (_inst_cfg().get("base_dir") or "/opt/napcat/instances").rstrip("/")
    out = []
    try:
        for n in sorted(os.listdir(base)):
            d = os.path.join(base, n)
            if os.path.isdir(d):
                out.append(n)
    except Exception:
        pass
    return out


def _unit_state(unit):
    rc_, o = _run("systemctl is-active %s 2>/dev/null" % unit, timeout=15)
    return (o or "").strip() or "unknown"


def _unit_enabled(unit):
    rc_, o = _run("systemctl is-enabled %s 2>/dev/null" % unit, timeout=15)
    return (o or "").strip() or "unknown"


def _legacy_instance():
    """旧式 napcat.service（升级前就有的单实例）也要出现在列表里。

    早期部署只有���个 napcat.service，它不在 instances/ 目录下，
    面板扫不到 → 用户以为自己的号"不见了"。这里把它补进来。
    """
    unit = (_cfg().get("napcat") or {}).get("unit") or "napcat"
    if not unit or unit.startswith("napcat@"):
        return None
    state = _unit_state(unit)
    if state in ("unknown", "not-found", ""):
        return None
    base = (_cfg().get("napcat") or {}).get("base") or "http://127.0.0.1:6099"
    port = 0
    try:
        port = int(base.rsplit(":", 1)[-1])
    except Exception:
        pass
    return {"uin": "", "unit": unit, "xvfb_unit": "", "state": state,
            "enabled": _unit_enabled(unit), "webui_port": port,
            "onebot_port": 0, "display": "", "dir": "", "webui": base,
            "legacy": True}


@rc.interface("qqbot.inst.list")
def inst_list(params):
    """实例列表：每个 QQ 号一个 NapCat 实例。"""
    cfg = _cfg()
    icfg = _inst_cfg()
    base = (icfg.get("base_dir") or "/opt/napcat/instances").rstrip("/")
    items = []
    legacy = _legacy_instance()
    if legacy:
        items.append(legacy)
    for uin in _inst_list():
        env = _inst_env(uin)
        webui_port = env.get("WEBUI_PORT") or ""
        ob_port = env.get("ONEBOT_PORT") or ""
        disp = env.get("DISPLAY") or ""
        items.append({
            "uin": uin,
            "unit": "napcat@%s" % uin,
            "xvfb_unit": ("xvfb-rcbot-%s" % disp.lstrip(":")) if disp.lstrip(":").isdigit() else "",
            "state": _unit_state("napcat@%s" % uin),
            "enabled": _unit_enabled("napcat@%s" % uin),
            "webui_port": int(webui_port) if webui_port.isdigit() else 0,
            "onebot_port": int(ob_port) if ob_port.isdigit() else 0,
            "display": disp,
            "dir": _inst_dir(uin),
            "webui": ("http://127.0.0.1:%s" % webui_port) if webui_port else "",
        })
    # rcbot 侧的实际连接状态（哪些号真的连上了）
    try:
        st = _data("/api/accounts", timeout=15) or {}
        live = {str(a.get("uin") or ""): a for a in (st.get("items") or [])}
    except Exception:
        live = {}
    for it in items:
        a = live.get(str(it["uin"]))
        if a:
            it["online"] = bool(a.get("online"))
            it["nick"] = a.get("nick") or ""
            it["avatar"] = a.get("avatar") or ""
            it["account_id"] = a.get("id") or ""
            it["connected"] = bool(a.get("connected"))
        else:
            it["online"] = False
            it["nick"] = ""
            it["avatar"] = ""
    return {"ok": True, "data": {"items": items, "base_dir": base,
                                 "count": len(items)}}


@rc.interface("qqbot.inst.add")
def inst_add(params):
    """新增实例：建目录 + 写 env + 写 systemd 模板 + 启动 + 取二维码。

    需要 root（非 root 面板会明确拒绝，不 sudo）。
    """
    p = params or {}
    uin = str(p.get("uin") or "").strip()
    if not uin.isdigit():
        raise RuntimeError("uin 必须是数字")
    if os.geteuid() != 0:
        raise RuntimeError("新增实例需要 root 权限（当前面板不是 root 运行）")
    if os.path.isdir(_inst_dir(uin)):
        raise RuntimeError("这个 QQ 号的实例已经存在了")

    base = (_inst_cfg().get("base_dir") or "/opt/napcat/instances").rstrip("/")
    d = os.path.join(base, uin)
    for sub in ("home", "work", "logs"):
        os.makedirs(os.path.join(d, sub), exist_ok=True)
    os.makedirs(os.path.join(d, "work", "config"), exist_ok=True)

    idx, wp, op, disp = _alloc_instance(_reserved_ports(), _used_displays())

    with open(os.path.join(d, "env"), "w", encoding="utf-8") as f:
        f.write("# 由雨咯Bot 面板生成 —— 每个实例一份\n")
        f.write("# 显示号必须是纯数字：Xvfb 只认 :N，用 QQ 号会报 Bad display name\n")
        f.write("DISPLAY=:%d\n" % disp)
        f.write("WEBUI_PORT=%d\n" % wp)
        f.write("ONEBOT_PORT=%d\n" % op)
        f.write("INDEX=%d\n" % idx)

    token = cfg_napcat_token()
    wcfg = os.path.join(d, "work", "config", "webui.json")
    if not os.path.exists(wcfg):
        with open(wcfg, "w", encoding="utf-8") as f:
            json.dump({"host": "0.0.0.0", "port": wp, "token": token,
                       "loginRate": 100}, f, ensure_ascii=False)
    # OneBot 配置也要提前写好(端口不能撞)
    _write_ob11_config(d, uin, op, wp)

    # systemd：模板 + 该实例专属的 xvfb 单元
    _write_units()
    xvfb_path = os.path.join("/etc/systemd/system", "xvfb-rcbot-%d.service" % disp)
    with open(xvfb_path, "w", encoding="utf-8") as f:
        f.write(_XVFB_UNIT.replace("%i", str(disp)))
    _run("systemctl daemon-reload", timeout=30)

    # 启动顺序：先 Xvfb，再 QQ（QQ 起来就要连 X）
    _run("systemctl enable xvfb-rcbot-%d" % disp, timeout=30)
    _run("systemctl start xvfb-rcbot-%d" % disp, timeout=30)
    _run("systemctl enable napcat@%s" % uin, timeout=30)
    _run("systemctl stop %s 2>/dev/null" % unit, timeout=45)
    _run("systemctl reset-failed %s 2>/dev/null" % unit, timeout=15)
    _run("systemctl start %s" % unit, timeout=90)

    # 等 WebUI 真正监听 —— 之前没等就返回，前端立刻取二维码只会拿到
    # "connection refused"（用户第一次反馈的就是这个）
    ready, st = _wait_ready(unit, wp)

    err = ""
    try:
        _data("/api/accounts", "POST", {
            "action": "add", "uin": uin,
            "ws_url": "ws://127.0.0.1:%d" % op,
            "webui": "http://127.0.0.1:%d" % wp,
            "unit": "napcat@%s" % uin,
            "instance_dir": d,
        }, timeout=25)
    except Exception as e:
        err = "加进 rcbot 失败：%s" % str(e)[:200]

    out = {"uin": uin, "webui_port": wp, "onebot_port": op,
           "display": ":%d" % disp, "dir": d, "unit": "napcat@%s" % uin,
           "ready": ready}
    if not ready:
        out["hint"] = ("实例已创建但 WebUI 没监听 %d。看日志："
                       "journalctl -u napcat@%s -n 50" % (wp, uin))
    if err:
        out["error"] = err
    return {"ok": True, "data": out}


def cfg_napcat_token():
    return (_cfg().get("napcat") or {}).get("token") or "rcnapcat"


# ★ 显示号与端口全部来自 env 文件，%i 只用来标识实例。
#   之前写成 Environment=DISPLAY=:%i 是错的 —— %i 是 QQ 号(如 1132096843)，
#   Xvfb 直接报 "Bad display name, exiting"，QQ 随后报
#   "Missing X server or $DISPLAY" 然后无限重启。
# ★ 单元名带固定前缀,不与 NapCat 的 %i 混用 ——
#   否则 systemd 会拿 QQ 号当 X 显示号(Xvfb 只认 :N)。
_XVFB_UNIT = """[Unit]
Description=Xvfb display :%i (for 雨咯Bot 实例)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :%i -screen 0 1080x760x16 +extension GLX +render
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

_NAPCAT_UNIT = """[Unit]
Description=NapCat instance %i (QQ %i)
# ★ 不能写 Requires=xvfb@%i.service —— %i 是 QQ 号不是显示号,
#   systemd 会用模板自动生成 xvfb@<QQ号>.service,
#   Xvfb 直接报 "Bad display name" 无限重启(实测踩过)。
#   xvfb 改用独立命名的单元 xvfb-rcbot-<显示号>.service,由调用方先起它。
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Environment=HOME=/opt/napcat/instances/%i/home
Environment=NAPCAT_WORKDIR=/opt/napcat/instances/%i/work
# ★ 不设 NAPCAT_QUICK_ACCOUNT：对没登录过的号设了它，NapCat 会尝试快登 →
#   失败("登录态已失效") → 退出 → systemd 拉起 → 死循环(实测每 3 秒一轮)。
#   登录态建立后可以在实例的 env 里加 NAPCAT_QUICK_ACCOUNT=<uin> 开启免扫码。
EnvironmentFile=/opt/napcat/instances/%i/env
WorkingDirectory=/opt/napcat/napcat
ExecStart=/opt/napcat/QQ/qq --no-sandbox
Restart=always
RestartSec=5
LimitNOFILE=65535
# ★ QQ 是 Electron, 收到 SIGTERM 常常不退出 → systemd 卡在 deactivating。
#   用 control-group 把整个 cgroup 的子进程一起收掉;
#   KillSignal 保持 SIGTERM(用 SIGKILL 会让 systemd 判 "Failed with result
#   'signal'" → 立刻拉起 → 变成重启循环),超时后由 systemd 自动 SIGKILL 兜底。
TimeoutStopSec=15
KillMode=control-group

[Install]
WantedBy=multi-user.target
"""


def _write_units():
    """写 systemd 模板单元。"""
    for name, content in (("xvfb@.service", _XVFB_UNIT),
                           ("napcat@.service", _NAPCAT_UNIT)):
        path = os.path.join("/etc/systemd/system", name)
        try:
            old = ""
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    old = f.read()
            if old != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(content)
        except Exception:
            pass


def _reserved_ports():
    """已被占用的端口 = 其它实例 env 里已登记的 + 真正在监听的。

    ★ 必须把"其它实例 env 登记的"也算进去 ——
      只看 ss 会把同一个端口分给两个实例（实测踩过：两个实例都是 6100/6702）。
    """
    used = set()
    for uin in _inst_list():
        env = _inst_env(uin)
        for k in ("WEBUI_PORT", "ONEBOT_PORT"):
            v = env.get(k) or ""
            if v.isdigit():
                used.add(int(v))
    _, out = _run("ss -ltn 2>/dev/null | awk 'NR>1{print $4}'", timeout=15)
    for line in (out or "").splitlines():
        m = re.search(r":(\d+)\s*$", line.strip())
        if m:
            used.add(int(m.group(1)))
    return used


def _used_displays():
    """已被占用的 X 显示号（实例 env 登记的 + 正在跑的 Xvfb）。"""
    used = set()
    for uin in _inst_list():
        env = _inst_env(uin)
        d = (env.get("DISPLAY") or "").lstrip(":")
        if d.isdigit():
            used.add(int(d))
    _, out = _run("ps aux 2>/dev/null | grep -o 'Xvfb :[0-9]*'", timeout=15)
    for x in re.findall(r":(\d+)", out or ""):
        used.add(int(x))
    return used


def _enable_quick_login(uin, env):
    """登录态建立后，把 NAPCAT_QUICK_ACCOUNT 写进实例 env。

    没这一步的话,实例每次重启都会拿 NAPCAT_QUICK_ACCOUNT 去快登,
    而"登录态已失效"时 NapCat 会直接退出 → systemd 拉起 → 死循环。
    写了这个变量,重启时 NapCat 才知道该用哪个号的登录态。
    """
    if (env or {}).get("NAPCAT_QUICK_ACCOUNT") == uin:
        return
    d = _inst_dir(uin)
    ep = os.path.join(d, "env")
    try:
        lines = []
        if os.path.exists(ep):
            with open(ep, "r", encoding="utf-8") as f:
                lines = [l.rstrip("\n") for l in f
                         if l.strip() and not l.strip().startswith("NAPCAT_QUICK_ACCOUNT=")]
        lines.append("NAPCAT_QUICK_ACCOUNT=%s" % uin)
        with open(ep, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    except Exception:
        pass


def icfg_webui_base():
    return int(_inst_cfg().get("webui_base") or 6099)


def icfg_onebot_base():
    return int(_inst_cfg().get("onebot_base") or 6700)


def _write_ob11_config(inst_dir, uin, onebot_port, webui_port):
    """预置实例的 OneBot 配置。

    ★ 必须提前写 —— NapCat 是在**首次登录成功时**才生成 onebot11_<uin>.json,
      里面默认的 WS 端口是 6700。多个实例同时登录会撞端口,
      后登录的那个会把先登录的挤掉(两边都想监听 6700)。
      所以这里先按分配好的端口写好, NapCat 登录时会沿用。
    """
    cfg_dir = os.path.join(inst_dir, "work", "config")
    os.makedirs(cfg_dir, exist_ok=True)
    path = os.path.join(cfg_dir, "onebot11_%s.json" % uin)
    cfg = {
        "network": {
            "httpServers": [],
            "httpSseServers": [],
            "httpClients": [],
            "websocketServers": [{
                "debug": False,
                "enable": True,
                "heartInterval": 30000,
                "host": "127.0.0.1",
                "messagePostFormat": "array",
                "name": "rc-core",
                "port": int(onebot_port),
                "reportSelfMessage": False,
                "token": "",
                "enableForcePushEvent": True,
            }],
            "websocketClients": [],
            "plugins": [],
        },
        "musicSignUrl": "",
        "enableLocalFile2Url": False,
        "parseMultMsg": False,
        "imageDownloadProxy": "",
        "timeout": {
            "baseTimeout": 10000,
            "uploadSpeedKBps": 256,
            "downloadSpeedKBps": 256,
            "maxTimeout": 1800000,
        },
    }
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
        return path
    except Exception:
        return ""


def _sync_instance_ports(uin, env):
    """把 env 里的端口同步到 NapCat 真正读的配置。

    NapCat 读 work/config/webui.json 和 work/config/onebot11_<uin>.json，
    env 文件只是给 systemd 看的。两者不一致时 NapCat 会按旧端口监听，
    面板按 env 里的端口去连 → connection refused。
    """
    wp = (env or {}).get("WEBUI_PORT") or ""
    op = (env or {}).get("ONEBOT_PORT") or ""
    if not wp.isdigit():
        return
    d = _inst_dir(uin)
    wcfg = os.path.join(d, "work", "config", "webui.json")
    try:
        w = {}
        if os.path.exists(wcfg):
            with open(wcfg, "r", encoding="utf-8") as f:
                w = json.load(f)
        if int(w.get("port") or 0) != int(wp):
            w["host"] = w.get("host") or "0.0.0.0"
            w["port"] = int(wp)
            w["token"] = w.get("token") or cfg_napcat_token()
            w.setdefault("loginRate", 100)
            with open(wcfg, "w", encoding="utf-8") as f:
                json.dump(w, f, ensure_ascii=False)
    except Exception:
        pass
    if op.isdigit():
        _write_ob11_config(d, uin, int(op), int(wp))


def _wait_ready(unit, webui_port, tries=45):
    """等实例真正可用。

    ★ 不能只看"端口在监听" —— 进程可能正在反复重启
      (NapCat 快登失败 → 退出 → systemd 拉起 → 每 3 秒一轮)。
      所以要同时确认: 端口在监听 且 单元是 active(不是 activating/auto-restart)。
    """
    for _ in range(tries):
        _, o = _run("ss -ltn 2>/dev/null | grep -c ':%s '" % webui_port, timeout=10)
        listening = "1" in (o or "")
        st = _unit_state(unit)
        if listening and st == "active":
            return True, st
        if st in ("failed", "inactive"):
            return False, st
        time.sleep(1)
    return False, _unit_state(unit)


def _alloc_instance(used_ports, used_displays):
    """给新实例分配 index / 端口 / 显示号。

    端口：WebUI = base+index，OneBot = base+2*index（避开 rcbot 的 6710）
    显示：:1 起，跳过已占用的（:1 通常被旧的 napcat.service 占着）
    """
    icfg = _inst_cfg()
    wb = int(icfg.get("webui_base") or 6099)
    ob = int(icfg.get("onebot_base") or 6700)
    idx = 0
    while True:
        wp = wb + idx
        op = ob + 2 * idx
        if op != 6710 and wp not in used_ports and op not in used_ports:
            break
        idx += 1
    disp = 1
    while disp in used_displays:
        disp += 1
    return idx, wp, op, disp


@rc.interface("qqbot.inst.action")
def inst_action(params):
    """实例操作：start / stop / restart / qrcode / quick_login / remove。"""
    p = params or {}
    uin = str(p.get("uin") or "").strip()
    act = (p.get("action") or "").lower()
    if not uin:
        raise RuntimeError("缺少 uin")
    env = _inst_env(uin)
    wp = env.get("WEBUI_PORT") or ""
    unit = "napcat@%s" % uin
    token = cfg_napcat_token()

    disp = (env.get("DISPLAY") or "").lstrip(":")
    xvfb = "xvfb-rcbot-%s" % disp if disp.isdigit() else ""

    if act in ("start", "stop", "restart"):
        # 启动前把 webui.json 与 env 对齐（NapCat 读的是前者）
        _sync_instance_ports(uin, env)
        # Xvfb 要跟着一起管 —— QQ 起来就要连 X，Xvfb 没起来 QQ 会
        # "Missing X server or $DISPLAY" 然后无限重启
        if act == "stop":
            _run("systemctl stop %s" % unit, timeout=60)
            if xvfb:
                _run("systemctl stop %s" % xvfb, timeout=30)
            return {"ok": True, "data": {"uin": uin, "action": act,
                                         "state": _unit_state(unit)}}
        if act == "start":
            # ★ 已经在跑就别再 stop→start 一遍。
            #   QQ 是 Electron,被 SIGTERM 杀掉后要 3 秒重新初始化,
            #   这期间 WebUI 不监听 → 用户点"扫码"就撞上 connection refused。
            #   只有真的要重启(用户显式点"重启")才走 restart。
            cur = _unit_state(unit)
            if cur == "active":
                ready, st = _wait_ready(unit, env.get("WEBUI_PORT") or "")
                return {"ok": True, "data": {"uin": uin, "action": act,
                                             "state": st, "ready": ready,
                                             "hint": "实例已在运行"}}
        if xvfb:
            _run("systemctl start %s" % xvfb, timeout=30)
        if act == "restart":
            _run("systemctl restart %s" % unit, timeout=90)
        else:
            _run("systemctl start %s" % unit, timeout=90)
        st = _unit_state(unit)
        out = {"uin": uin, "action": act, "state": st}
        if act in ("start", "restart"):
            # 等 WebUI 起来再返回，否则前端立刻取二维码只会拿到 connection refused
            wp_ = env.get("WEBUI_PORT") or ""
            ready, _ = _wait_ready(unit, wp_)
            out["ready"] = ready
            if not ready:
                out["hint"] = ("WebUI 没监听 %s。看日志：journalctl -u %s -n 50"
                               % (wp_ or "?", unit))
        return {"ok": True, "data": out}

    if act == "repair":
        """修复实例：重写 env（修端口/显示号）+ 重写单元 + 重启。

        用于早期版本建的坏实例（显示号用了 QQ 号、端口撞车）。
        """
        if os.geteuid() != 0:
            raise RuntimeError("修复实例需要 root 权限")
        d = _inst_dir(uin)
        if not os.path.isdir(d):
            raise RuntimeError("实例不存在：%s" % uin)
        for sub in ("home", "work", "logs"):
            os.makedirs(os.path.join(d, sub), exist_ok=True)
        os.makedirs(os.path.join(d, "work", "config"), exist_ok=True)

        # 端口/显示重新分配：排除自己和别的实例
        others = [u for u in _inst_list() if u != uin]
        used_ports, used_disp = set(), set()
        for u in others:
            e = _inst_env(u)
            for k in ("WEBUI_PORT", "ONEBOT_PORT"):
                if (e.get(k) or "").isdigit():
                    used_ports.add(int(e[k]))
            dd = (e.get("DISPLAY") or "").lstrip(":")
            if dd.isdigit():
                used_disp.add(int(dd))
        _, o = _run("ss -ltn 2>/dev/null | awk 'NR>1{print $4}'", timeout=15)
        for line in (o or "").splitlines():
            m = re.search(r":(\d+)\s*$", line.strip())
            if m:
                used_ports.add(int(m.group(1)))
        _, o = _run("ps aux 2>/dev/null | grep -o 'Xvfb :[0-9]*'", timeout=15)
        for x in re.findall(r":(\d+)", o or ""):
            used_disp.add(int(x))
        # ★ 自己原来占的端口**不算**已用 —— 否则每次 repair 都会重新分配,
        #   端口一路往上飘(实测 6100→6101→6102…), 旧链接全废。
        #   只有当自己的端口被别人(别的实例/别的进程)也占着时才让出去。
        own_webui = (env.get("WEBUI_PORT") or "")
        own_ob = (env.get("ONEBOT_PORT") or "")
        own_disp = (env.get("DISPLAY") or "").lstrip(":")
        # 从"已用"里把自己的去掉,再单独检查是否真的被别人占了
        for v in (own_webui, own_ob):
            if v.isdigit():
                used_ports.discard(int(v))
        if own_disp.isdigit():
            used_disp.discard(int(own_disp))
        # 别人的实例登记过的端口仍然占着(上面已经加进去了),这里只排除自己

        # ★ 优先保留自己原来的端口/显示号(只要没被别人占)——
        #   否则每次 repair 都重新分配,端口一路往上飘,旧链接全废。
        wp = int(own_webui) if own_webui.isdigit() else 0
        op = int(own_ob) if own_ob.isdigit() else 0
        nd = int(own_disp) if own_disp.isdigit() else 0
        if not (wp and op and op != 6710 and wp not in used_ports and op not in used_ports):
            idx, wp, op, nd = _alloc_instance(used_ports, used_disp)
        else:
            # 端口保留,但显示号可能被占 → 另分配
            if nd in used_disp:
                nd = 1
                while nd in used_disp:
                    nd += 1
            # index 从端口反推（WebUI = base+index）
            idx = max(0, wp - icfg_webui_base())
        with open(os.path.join(d, "env"), "w", encoding="utf-8") as f:
            f.write("# 由雨咯Bot 修复 —— 显示号与端口\n")
            f.write("DISPLAY=:%d\n" % nd)
            f.write("WEBUI_PORT=%d\n" % wp)
            f.write("ONEBOT_PORT=%d\n" % op)
            f.write("INDEX=%d\n" % idx)
        # ★ NapCat 实际读的是 work/config/webui.json 和 onebot11_<uin>.json,
        #   不是 env 文件 —— env 只是给 systemd 看的。
        #   两边必须同步,否则 NapCat 会用旧端口监听(实测:env 写 6100,
        #   webui.json 还是 6101 → 前端连 6100 直接 connection refused)。
        wcfg = os.path.join(d, "work", "config", "webui.json")
        try:
            with open(wcfg, "w", encoding="utf-8") as f:
                json.dump({"host": "0.0.0.0", "port": wp,
                           "token": cfg_napcat_token(), "loginRate": 100},
                          f, ensure_ascii=False)
        except Exception:
            pass
        _write_ob11_config(d, uin, op, wp)
        _write_units()
        # 清理掉用 QQ 号当显示号的旧单元。
        # ★ 用 stop 而不是 disable --now —— 后者会与紧接着的 restart 打架,
        #   结果卡在 deactivating(stop-sigterm): QQ 收到 SIGTERM 不退出。
        _run("systemctl stop xvfb-rcbot-%s 2>/dev/null" % uin, timeout=30)
        _run("systemctl stop %s 2>/dev/null" % unit, timeout=45)
        _run("systemctl reset-failed %s 2>/dev/null" % unit, timeout=15)
        xv = os.path.join("/etc/systemd/system", "xvfb-rcbot-%d.service" % nd)
        with open(xv, "w", encoding="utf-8") as f:
            f.write(_XVFB_UNIT.replace("%i", str(nd)))
        _run("systemctl daemon-reload", timeout=30)
        _run("systemctl enable xvfb-rcbot-%d" % nd, timeout=30)
        _run("systemctl start xvfb-rcbot-%d" % nd, timeout=30)
        _run("systemctl enable %s" % unit, timeout=30)
        _run("systemctl stop %s 2>/dev/null" % unit, timeout=45)
        _run("systemctl reset-failed %s 2>/dev/null" % unit, timeout=15)
        _run("systemctl start %s" % unit, timeout=90)
        ready, st = _wait_ready(unit, wp)
        # 同步 rcbot 侧的账号配置
        try:
            _data("/api/accounts", "POST", {
                "action": "update", "id": "a%s" % uin, "uin": uin,
                "ws_url": "ws://127.0.0.1:%d" % op,
                "webui": "http://127.0.0.1:%d" % wp,
                "unit": unit, "instance_dir": d,
            }, timeout=25)
        except Exception:
            pass
        return {"ok": True, "data": {"uin": uin, "webui_port": wp,
                                     "onebot_port": op, "display": ":%d" % nd,
                                     "ready": ready}}

    if act == "remove":
        if os.geteuid() != 0:
            raise RuntimeError("删除实例需要 root 权限")
        _run("systemctl disable --now %s" % unit, timeout=60)
        if xvfb:
            _run("systemctl disable --now %s" % xvfb, timeout=30)
        try:
            _data("/api/accounts", "POST", {"action": "remove", "id": "a%s" % uin},
                  timeout=25)
        except Exception:
            pass
        import shutil
        d = _inst_dir(uin)
        if os.path.isdir(d) and not p.get("keep_data"):
            shutil.rmtree(d, ignore_errors=True)
        return {"ok": True, "data": {"uin": uin, "removed": True}}

    # 下面的都要连 WebUI，先确认端口
    if not wp:
        raise RuntimeError("这个实例没有 env 文件，端口未知")
    base = "http://127.0.0.1:%s" % wp
    if act == "qrcode":
        st = _nc_data_at(base, token, "/QQLogin/CheckLoginStatus") or {}
        logged = bool(st.get("isLogin"))
        if logged:
            # 登录态建立了 → 写 NAPCAT_QUICK_ACCOUNT, 以后重启免扫码
            _enable_quick_login(uin, env)
            return {"ok": True, "data": {"qrcode": "", "login": True,
                                         "phase": st.get("loginPhase") or "",
                                         "webui": base}}
        # ★ 先用状态里带的 qrcodeurl —— NapCat 在 waiting_qrcode 阶段
        #   已经把二维码生成好了,再调 GetQQLoginQrcode 会返回
        #   "QRCode Get Error"(那个接口是"要一张新码",不是"给我现在的码")。
        qr = st.get("qrcodeurl") or ""
        if not qr:
            try:
                q = _nc_data_at(base, token, "/QQLogin/GetQQLoginQrcode") or {}
                qr = q.get("qrcode") or ""
            except Exception:
                qr = ""
        return {"ok": True, "data": {"qrcode": qr,
                                     "login": logged,
                                     "phase": st.get("loginPhase") or "",
                                     "webui": base}}

    if act == "quick_login":
        r = _nc_data_at(base, token, "/QQLogin/SetQuickLogin", {"uin": uin})
        return {"ok": True, "data": r}

    if act == "status":
        st = _nc_data_at(base, token, "/QQLogin/CheckLoginStatus") or {}
        logged = bool(st.get("isLogin"))
        if logged:
            _enable_quick_login(uin, env)
        return {"ok": True, "data": {"login": logged,
                                     "phase": st.get("loginPhase") or "",
                                     "coreReady": bool(st.get("coreReady"))}}

    raise RuntimeError("不认识的动作：%s" % act)


@rc.interface("qqbot.inst.logs")
def inst_logs(params):
    """实例日志（journalctl）。"""
    p = params or {}
    uin = str(p.get("uin") or "").strip()
    unit = "napcat@%s" % uin if uin else (p.get("unit") or "napcat")
    n = max(50, min(2000, int(p.get("lines") or 400)))
    _, out = _run("journalctl -u %s -n %d --no-pager 2>/dev/null" % (unit, n), timeout=30)
    items = [{"level": _guess_level(x), "text": x, "ts": 0}
             for x in (out or "").splitlines() if x.strip()]
    return {"ok": True, "items": items, "source": "journal", "total": len(items)}


# ---------------------------------------------------------------- 机器人状态

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
    return {"ok": True, "data": _data("/api/chat/sessions" + ("?" + qs if qs else ""),
                                       timeout=30)}


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
    "qqbot.inst.list", "qqbot.inst.add", "qqbot.inst.action", "qqbot.inst.logs",
    "qqbot.chat.sessions", "qqbot.chat.messages", "qqbot.chat.stats",
    "qqbot.chat.export", "qqbot.chat.purge_media",
    "rcbot.status", "rcbot.accounts", "rcbot.account.save",
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
        manifest={"label": LABEL, "description": "NapCat + RainCough Bot 统一控制台"},
        frontend={"pages": [{"path": "", "title": LABEL}]},
        iface_ids=IFACES,
        plugin_dir=DIR,
    )
