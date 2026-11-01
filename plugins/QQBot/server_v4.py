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
from rcbot import single  # noqa: E402  单账户：NapCat 实例管理

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
            out = json.loads(r.read().decode("utf-8", "replace"))
        # 同 _nc_at：HTTP 200 + body Unauthorized 也要重登重试
        if retry and _is_unauthorized(out):
            _nc_login(force=True)
            return _nc(path, body, method, timeout, retry=False)
        return out
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


def _is_unauthorized(r):
    """判断 NapCat 响应是不是「凭据失效」。

    ★ NapCat 的 Unauthorized 有两种形态，必须都认：
      ① HTTP 401/403（urlopen 抛 HTTPError）
      ② **HTTP 200 + body 里 {"code":-1,"message":"Unauthorized"}**
         —— 实测新版 NapCat 走的是这种：HTTP 层是成功的，
         只是 body 说没登录。只处理 ① 的话，重登逻辑永远不触发，
         插件会一直拿 50 分钟前缓存的旧 credential 去请求，
         报 "NapCat /QQLogin/CheckLoginStatus 失败：Unauthorized"，
         而实际只要重新登录一次 WebUI 就能好。
    """
    if not isinstance(r, dict):
        return False
    code = r.get("code")
    msg = str(r.get("message") or r.get("msg") or "")
    if code == -1 and "unauthorized" in msg.lower():
        return True
    return False


def _nc_at(base, token, path, body=None, method="POST", timeout=15, retry=True):
    url = base.rstrip("/") + "/api" + path
    data = json.dumps(body if body is not None else {}).encode("utf-8") if method == "POST" else None
    headers = {"Content-Type": "application/json",
               "Authorization": "Bearer " + _nc_login_at(base, token)}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            out = json.loads(r.read().decode("utf-8", "replace"))
        # ② HTTP 200 但 body 是 Unauthorized → 重新登录后重试一次
        if retry and _is_unauthorized(out):
            _nc_login_at(base, token, force=True)
            return _nc_at(base, token, path, body, method, timeout, retry=False)
        return out
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

def _qa_avatar(uin, size=100):
    """按 QQ 号拼头像 URL。

    ★ OneBot 的 get_login_info 只返回 {user_id, nickname}，**没有头像**；
      NapCat 的 GetQuickLoginListNew 有 faceUrl，但只有登录过的号才有。
      头像是腾讯的独立服务 knowing QQ 号就能取：
          https://q1.qlogo.cn/g?b=qq&nk=<QQ号>&s=<边长>
      所以只要知道号就能显示头像，不必等登录成功。
    """
    u = str(uin or '').strip()
    if not u.isdigit() or len(u) < 5 or len(u) > 12:
        return ''
    return "https://q1.qlogo.cn/g?b=qq&nk=%s&s=%d" % (u, int(size))


def _nc_login_profile(webui_port):
    """取当前实例已登录账号的资料 {uin, nick, avatar}。

    ★ GetQQLoginInfo 是唯一可靠的来源：
      - GetQuickLoginListNew 扫码刚登录时是空的（实测返回 []）
      - OneBot 的 get_login_info 要等 6700 起来，而 OneBot 端口
        是登录后才监听的，时机上不一定赶得上

    返回空 dict 表示还没登录。
    """
    try:
        wp = int(webui_port or 0)
    except Exception:
        return {}
    if wp <= 0:
        return {}
    base = "http://127.0.0.1:%d" % wp
    token = cfg_napcat_token()
    try:
        info = _nc_data_at(base, token, "/QQLogin/GetQQLoginInfo", timeout=8) or {}
    except Exception:
        return {}
    uin = str(info.get("uin") or "")
    if not uin:
        return {}
    nick = info.get("nick") or info.get("nickName") or ""
    return {
        "uin": uin,
        "nick": nick,
        "avatar": info.get("faceUrl") or info.get("avatar") or _qa_avatar(uin),
    }


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

    # ★ 单账户：只有一个 NapCat 实例（目录固定 main）。
    #   QQ 号问 NapCat 要（GetQQLoginInfo），没登录时是空串 ——
    #   但概览照样要显示"运行中/等待扫码"，不能因为没登录就整页空白。
    single.ensure_running()
    uin = single.pick_instance()
    wp = single.webui_port()
    base = "http://127.0.0.1:%d" % wp if wp else ""
    token = cfg_napcat_token()
    out["instances"] = [{"uin": uin, "webui": base, "unit": single.UNIT}]
    if not uin:
        out["errors"].append("还没有登录 QQ 账户，去「QQ 账户」扫码登录")

    def nc(path, body=None, method="POST", timeout=15):
        r = _nc_at(base, token, path, body, method, timeout)
        if r.get("code") not in (0, None):
            raise RuntimeError("NapCat %s 失败：%s" % (path, r.get("message") or r.get("code")))
        return r.get("data")

    # 账号
    try:
        st = nc("/QQLogin/CheckLoginStatus") or {}
        out["account"].update({
            "login": bool(st.get("isLogin")),
            "offline": bool(st.get("isOffline")),
            "phase": st.get("loginPhase") or "",
            "qrcode": st.get("qrcodeurl") or "",
            "uin": uin,
        })
    except Exception as e:
        out["errors"].append("账号状态：%s" % str(e)[:120])

    # ★ 账号资料：优先 GetQQLoginInfo（当前登录会话，一定准）。
    #   GetQuickLoginListNew 是"本机历史登录过的号列表"，
    #   扫码刚登录时它是空的（实测登录成功后返回 []）——
    #   靠它取昵称/头像会导致概览页账号信息全空。
    try:
        prof = nc("/QQLogin/GetQQLoginInfo") or {}
        if prof.get("uin"):
            out["account"].update({
                "uin": str(prof.get("uin") or uin),
                "nick": prof.get("nick") or prof.get("nickName") or "",
                "avatar": prof.get("faceUrl") or prof.get("avatar") or "",
            })
    except Exception as e:
        out["errors"].append("账号资料：%s" % str(e)[:120])

    # 快登列表（可能有多个历史号）
    try:
        ql = nc("/QQLogin/GetQuickLoginListNew") or []
        if isinstance(ql, dict):
            ql = ql.get("list") or []
        out["quick"] = [{"uin": str(x.get("uin") or ""), "nick": x.get("nickName") or "",
                         "avatar": x.get("faceUrl") or ""} for x in ql]
    except Exception as e:
        out["errors"].append("快速登录：%s" % str(e)[:120])

    # ★ 头像兜底：GetQuickLoginListNew 只有登录过才有数据，
    #   没登录时概览的头像/昵称就全是空的（界面上一片灰圆圈）。
    #   QQ 头像是独立服务，只要知道 QQ 号就能取：
    #       https://q1.qlogo.cn/g?b=qq&nk=<QQ号>&s=100
    #   昵称再从 rcbot 侧兜底（它连上 OneBot 后会拿 get_login_info）。
    uin_now = str(out["account"].get("uin") or "")
    if not out["account"].get("avatar") and uin_now:
        out["account"]["avatar"] = _qa_avatar(uin_now)
    if not out["account"].get("nick") and uin_now:
        try:
            bot = _data("/api/status", timeout=8) or {}
            for a in (bot.get("accounts") or []):
                if str(a.get("uin") or "") == uin_now:
                    out["account"]["nick"] = a.get("nick") or ""
                    if not out["account"].get("avatar"):
                        out["account"]["avatar"] = a.get("avatar") or _qa_avatar(uin_now)
                    break
        except Exception:
            pass

    # 版本
    try:
        v = nc("/base/GetNapCatVersion", method="GET")
        out["versions"]["napcat"] = (v or {}).get("version") if isinstance(v, dict) else str(v)
    except Exception as e:
        out["errors"].append("NapCat 版本：%s" % str(e)[:120])
    try:
        qv = nc("/base/QQVersion", method="GET")
        out["versions"]["qq"] = qv if isinstance(qv, str) else (qv or {}).get("version")
    except Exception as e:
        out["errors"].append("QQ 版本：%s" % str(e)[:120])
    out["versions"]["webui"] = "Next"

    # 系统
    out["sys"] = _sysinfo_sse()
    out["proc"] = _qq_process()

    # 网络计数
    try:
        ob = nc("/OB11Config/GetConfig") or {}
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

    # 当前登录账号的资料（GetQQLoginInfo 才是准的，快登列表扫码后是空的）
    try:
        info = _nc_data("/QQLogin/GetQQLoginInfo") or {}
        if info.get("uin"):
            out["status"].update({
                "uin": str(info.get("uin")),
                "nick": info.get("nick") or info.get("nickName") or "",
                "avatar": info.get("faceUrl") or info.get("avatar")
                          or _qa_avatar(info.get("uin")),
            })
    except Exception as e:
        out["errors"].append("账号资料：%s" % str(e)[:140])

    try:
        ql = _nc_data("/QQLogin/GetQuickLoginListNew") or []
        if isinstance(ql, dict):
            ql = ql.get("list") or []
        out["quick"] = [{"uin": str(x.get("uin") or ""), "nick": x.get("nickName") or "",
                         "avatar": x.get("faceUrl") or "",
                         "online": bool(x.get("isQuickLogin"))} for x in ql]
        # 快登列表非空但状态里还没有 uin 时，用它兜底
        if out["quick"] and not out["status"].get("uin"):
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


def nc_logs_clear(params):
    with _LOG_LOCK:
        _LOG_BUF.clear()
    return {"ok": True}


# ---------------------------------------------------------------- NapCat 实例管理
#
# 一个 QQ 号 = 一个 NapCat 实例 = 一套 systemd 单元（napcat@<uin> + xvfb@<n>）。
# 端口：WebUI = 6099+index，OneBot = 6700+2*index（避开 rcbot 的 6710）。


def _run(cmd, timeout=60):
    """跑一条命令，返回 (rc, 输出)。"""
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True, timeout=timeout)
        return p.returncode, ((p.stdout or b"") + (p.stderr or b"")).decode("utf-8", "replace")
    except Exception as e:
        return 1, str(e)


def _unit_state(unit):
    rc_, o = _run("systemctl is-active %s 2>/dev/null" % unit, timeout=15)
    return (o or "").strip() or "unknown"


def _unit_enabled(unit):
    rc_, o = _run("systemctl is-enabled %s 2>/dev/null" % unit, timeout=15)
    return (o or "").strip() or "unknown"


@rc.interface("qqbot.account.info")
def account_info(params):
    """当前账户信息（单账户）。

    登录状态、QQ 号、昵称一律问 NapCat 的接口拿，这里不自己推断。
    返回 {uin, nick, avatar, login, accepted, core_ready, phase,
          state, webui_port, onebot_port, webui, error}。
    """
    out = {"uin": "", "nick": "", "avatar": "", "login": False,
           "accepted": False, "core_ready": False, "phase": "",
           "state": "unknown", "webui_port": 0, "onebot_port": 0,
           "webui": "", "online": False, "connected": False, "error": ""}
    ok, st = single.ensure_running()
    out["state"] = st
    wp = single.webui_port()
    op = single.onebot_port()
    out["webui_port"] = wp
    out["onebot_port"] = op
    out["webui"] = "http://127.0.0.1:%d" % wp

    # ① 登录状态 —— NapCat /QQLogin/CheckLoginStatus
    try:
        s = _nc_data_at(out["webui"], cfg_napcat_token(),
                         "/QQLogin/CheckLoginStatus", timeout=8) or {}
        out["login"] = bool(s.get("isLogin"))
        out["accepted"] = bool(s.get("qrLoginAccepted"))
        out["core_ready"] = bool(s.get("coreReady"))
        out["phase"] = s.get("loginPhase") or ""
        out["qrcode"] = s.get("qrcodeurl") or ""
    except Exception as e:
        out["error"] = str(e)[:160]

    # ② 当前登录号 —— NapCat /QQLogin/GetQQLoginInfo
    #    ★ 未登录时它返回 {uid:"",uin:"",nick:""}（不是报错），别当异常
    if out["login"]:
        try:
            info = _nc_data_at(out["webui"], cfg_napcat_token(),
                               "/QQLogin/GetQQLoginInfo", timeout=8) or {}
            out["uin"] = str(info.get("uin") or "")
            out["nick"] = info.get("nick") or ""
            out["avatar"] = info.get("faceUrl") or info.get("avatar") or ""
        except Exception:
            pass
    if not out["avatar"]:
        out["avatar"] = _qa_avatar(out["uin"])

    # ③ rcbot 侧连接状态
    try:
        st2 = _data("/api/status", timeout=8) or {}
        accs = st2.get("accounts") or []
        a = accs[0] if accs else None
        if a:
            out["online"] = bool(a.get("online"))
            out["connected"] = bool(a.get("connected"))
            if not out["uin"]:
                out["uin"] = str(a.get("uin") or "")
            if not out["nick"]:
                out["nick"] = a.get("nick") or ""
            if not out["avatar"]:
                out["avatar"] = a.get("avatar") or _qa_avatar(out["uin"])
    except Exception:
        pass
    return {"ok": True, "data": out}


@rc.interface("qqbot.account.qrcode")
def account_qrcode(params):
    """取登录二维码 —— 直接问 NapCat 要。

    已登录 → 返回空码 + 当前账号（前端提示"已经登录了"）。
    未登录 → 返回二维码地址；顺便让 NapCat 出一张新的。
    """
    if os.geteuid() != 0:
        raise RuntimeError("扫码登录需要 root 权限（当前面板不是 root 运行）")
    single.ensure_running()
    base = "http://127.0.0.1:%d" % single.webui_port()
    token = cfg_napcat_token()

    st = _nc_data_at(base, token, "/QQLogin/CheckLoginStatus", timeout=10) or {}
    if st.get("isLogin"):
        info = _nc_data_at(base, token, "/QQLogin/GetQQLoginInfo", timeout=8) or {}
        return {"ok": True, "data": {
            "qrcode": "", "login": True, "phase": st.get("loginPhase") or "",
            "uin": str(info.get("uin") or ""), "nick": info.get("nick") or "",
            "hint": "已经登录了"}}

    # ★ 优先用状态里带的 qrcodeurl（NapCat 已经在 waiting_qrcode 时就出好了），
    #   没有再向它要一张新的。
    qr = st.get("qrcodeurl") or ""
    if not qr:
        try:
            q = _nc_data_at(base, token, "/QQLogin/GetQQLoginQrcode", timeout=10) or {}
            qr = q.get("qrcode") or ""
        except Exception:
            qr = ""
    return {"ok": True, "data": {
        "qrcode": qr, "login": False, "phase": st.get("loginPhase") or "",
        "hint": "用手机 QQ 扫描下面的二维码授权登录"}}


@rc.interface("qqbot.account.refresh_qrcode")
def account_refresh_qrcode(params):
    """刷新二维码 —— NapCat /QQLogin/RefreshQRcode。"""
    base = "http://127.0.0.1:%d" % single.webui_port()
    r = _nc_data_at(base, cfg_napcat_token(), "/QQLogin/RefreshQRcode", timeout=10) or {}
    return {"ok": True, "data": {"qrcode": r.get("qrcodeurl") or r.get("qrcode") or ""}}


@rc.interface("qqbot.account.status")
def account_status(params):
    """查登录进度 —— 只读 NapCat 的状态，不做任何推断。

    返回 {done, uin, nick, avatar, phase, accepted, logged, core_ready,
          onebot_ready, error}。
    """
    base = "http://127.0.0.1:%d" % single.webui_port()
    token = cfg_napcat_token()
    out = {"done": False, "uin": "", "nick": "", "avatar": "",
           "phase": "", "accepted": False, "logged": False,
           "core_ready": False, "onebot_ready": False, "error": ""}
    try:
        st = _nc_data_at(base, token, "/QQLogin/CheckLoginStatus", timeout=10) or {}
    except Exception as e:
        out["error"] = str(e)[:160]
        return {"ok": True, "data": out}

    out["phase"] = st.get("loginPhase") or ""
    # 登录态三层：手机已确认 / QQ 已登录 / 核心就绪
    out["accepted"] = bool(st.get("qrLoginAccepted"))
    out["logged"] = bool(st.get("isLogin"))
    out["core_ready"] = bool(st.get("coreReady"))
    if not st.get("isLogin"):
        return {"ok": True, "data": out}

    # 已登录 → NapCat /QQLogin/GetQQLoginInfo 拿 QQ 号与昵称
    try:
        info = _nc_data_at(base, token, "/QQLogin/GetQQLoginInfo", timeout=8) or {}
    except Exception:
        info = {}
    out["uin"] = str(info.get("uin") or "")
    out["nick"] = info.get("nick") or ""
    out["avatar"] = info.get("faceUrl") or info.get("avatar") or _qa_avatar(out["uin"])
    if not out["uin"]:
        out["error"] = "已登录但还没拿到 QQ 号，稍后再试"
        return {"ok": True, "data": out}

    # OneBot 端口起来才算账户可用
    out["onebot_ready"] = single.port_listening(single.onebot_port())

    # 同步 rcbot 账号表（单账号）
    try:
        _data("/api/accounts", "POST", {
            "action": "add", "uin": out["uin"],
            "ws_url": "ws://127.0.0.1:%d" % single.onebot_port(),
            "webui": base,
            "unit": single.UNIT,
            "instance_dir": single.inst_dir(),
        }, timeout=25)
    except Exception:
        pass
    out["done"] = True
    return {"ok": True, "data": out}


@rc.interface("qqbot.account.action")
def account_action(params):
    """账户操作：start / stop / restart / quick_login / logout。

    logout = 换号：清掉登录态（NapCat 没有 LogoutQQ 接口，
    它提供的 SetQuickLogin 只设快登号，所以这一步只能自己清目录）。
    """
    if os.geteuid() != 0:
        raise RuntimeError("操作账户需要 root 权限（当前面板不是 root 运行）")
    act = str((params or {}).get("action") or "").lower()

    if act == "logout":
        single.logout()
        single.restart()
        return {"ok": True, "data": {"action": act, "removed": True}}

    if act in ("start", "stop", "restart"):
        if act == "start":
            single.ensure_running()
        elif act == "stop":
            single.stop()
        else:
            single.ensure_running()
            single.restart()
        return {"ok": True, "data": {"action": act, "state": single.unit_state()}}

    if act == "quick_login":
        base = "http://127.0.0.1:%d" % single.webui_port()
        info = _nc_data_at(base, cfg_napcat_token(),
                           "/QQLogin/GetQQLoginInfo", timeout=8) or {}
        uin = str(info.get("uin") or "")
        if not uin:
            raise RuntimeError("还没登录，没有可快登的号")
        r = _nc_data_at(base, cfg_napcat_token(),
                        "/QQLogin/SetQuickLogin", {"uin": uin})
        return {"ok": True, "data": r}

    raise RuntimeError("不认识的动作：%s" % act)


@rc.interface("qqbot.account.logs")
def account_logs(params):
    """NapCat 运行日志。

    mode=live    —— 走 NapCat WebUI 的 SSE 实时日志（_LOG_BUF）
    mode=history —— 读 systemd journalctl

    ★ 返回结构与前端「运行日志」页一致：{items, source, total, connected, hint}。
      这里**不能**套 data —— 前端用 call() 直接取 result。
    """
    p = params or {}
    n = max(50, min(2000, int(p.get("lines") or 400)))
    mode = p.get("mode") or "live"
    level = (p.get("level") or "").lower()
    _log_ensure()

    unit = single.UNIT
    if mode == "history":
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
            "unit": unit,
            "hint": "" if items else (
                "还没有日志。NapCat 的实时日志走 SSE，连上后新产生的日志会出现在这里"
                if source == "webui" else
                "读不到 systemd 日志（可能不是 systemd 起的，或当前用户没权限）")}


@rc.interface("qqbot.account.logs.clear")
def account_logs_clear(params):
    """清空实时日志缓冲。"""
    with _LOG_LOCK:
        _LOG_BUF.clear()
    return {"ok": True}


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


def _wait_onebot(onebot_port, tries=25):
    """等 OneBot 端口真正监听。

    ★ 这是"账户真的可用"的标志：
      NapCat 的 coreReady 变 true 之后，OneBot 的 WS 端口才会开始监听；
      在此之前 rcbot 连不上、聊天记录也不通。
      认领完等它一下，能保证"添加完立刻就能用"，而不是要等下一次重连。
    """
    try:
        port = int(onebot_port or 0)
    except Exception:
        return False
    if port <= 0:
        return False
    for _ in range(tries):
        _, o = _run("ss -ltn 2>/dev/null | grep -c ':%s '" % port, timeout=10)
        if "1" in (o or ""):
            return True
        time.sleep(1)
    return False


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
    "qqbot.nc.overview",
    # 单账户（2026-11-02 从多账户回退）
    "qqbot.account.info", "qqbot.account.qrcode", "qqbot.account.refresh_qrcode",
    "qqbot.account.status", "qqbot.account.action", "qqbot.account.logs",
    "qqbot.account.logs.clear",
    "qqbot.chat.sessions", "qqbot.chat.messages", "qqbot.chat.stats",
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
