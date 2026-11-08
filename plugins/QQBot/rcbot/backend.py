# -*- coding: utf-8 -*-
"""QQ 框架后端：SnowLuma（Docker 容器里跑 QQ）。

2026-11-07 起插件只支持 SnowLuma。此前是「NapCat / SnowLuma 双后端」，
NapCat 已从生产机卸载（/opt/napcat 不存在），双后端分支与 NapCat WebUI
客户端一并删除 —— 留着只会让代码里出现"明明没装却还在探测"的死路径。

对外接口（给 server_v4.py 用）：
    kind()           固定返回 'snowluma'
    account_info()   账号信息（uin/nick/avatar/login/state/端口…）
    scan()           登录入口：noVNC 远程桌面地址
    refresh_scan()   刷新二维码（远程桌面里 QQ 自己会轮换）
    status()         登录进度
    action(act)      start / stop / restart / logout
    logs(n)          容器日志
    onebot_*()       OneBot 地址与调用

★ 配置放插件自己的 data/config.json。这里刻意**不 import server_v4**
  （会形成循环依赖），只读其中 backend 段的 snowluma_public_host。
"""
import json
import os
import urllib.error
import urllib.request

from . import snowluma

_DEF = {
    "kind": "snowluma",
    "snowluma_public_host": "",    # noVNC 对外主机名（空=由前端用当前页面 host 拼）
}

_PLUGIN_CFG = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "config.json")


def _read_plugin_cfg():
    try:
        with open(_PLUGIN_CFG, "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception:
        return {}


def cfg():
    """读插件配置里的 backend 段。"""
    c = _read_plugin_cfg().get("backend") or {}
    out = dict(_DEF)
    out.update({k: v for k, v in (c or {}).items() if k in out})
    return out


def kind():
    """单后端：永远是 SnowLuma。保留函数是为了让调用点不必大改。"""
    return "snowluma"


# ---------------------------------------------------------------- 账号信息

def _snowluma_info():
    out = {"backend": "snowluma", "uin": "", "nick": "", "avatar": "",
           "login": False, "accepted": False, "core_ready": False,
           "phase": "", "state": "absent", "webui_port": snowluma.WEBUI_PORT,
           "onebot_port": snowluma.ONEBOT_WS_PORT, "webui": "",
           "scan_mode": "novnc", "novnc_port": snowluma.NOVNC_PORT,
           "novnc_path": "", "novnc_password": "", "error": ""}
    if not snowluma.docker_ok():
        out["error"] = "Docker 不可用"
        return out

    st = snowluma.state()
    out["state"] = st
    if st == "running":
        info = snowluma.login_info()
        if info:
            out["uin"] = info.get("uin") or ""
            out["nick"] = info.get("nick") or ""
            out["login"] = True
            # SnowLuma 没有"手机已确认/核心就绪"这种中间态 ——
            # OneBot 能回 get_login_info 就说明 QQ 已登录、hook 已注入
            out["accepted"] = True
            out["core_ready"] = True
            out["phase"] = "ready"
        else:
            out["phase"] = "waiting_qrcode"
    else:
        out["phase"] = "stopped" if st != "absent" else "absent"

    pw = snowluma.vnc_password()
    out["novnc_password"] = pw
    host = str(cfg().get("snowluma_public_host") or "")
    q = "autoconnect=1&resize=scale"
    if pw:
        q += "&password=" + urllib.request.quote(pw)
    out["novnc_path"] = "/vnc.html?" + q
    out["novnc_url"] = ("http://%s:%d%s" % (host, snowluma.NOVNC_PORT, out["novnc_path"])
                        if host else "")
    return out


def account_info():
    out = _snowluma_info()
    # 头像：拿不到时按 QQ 号现拼（QQ 头像是独立服务）
    if not out.get("avatar"):
        out["avatar"] = _avatar(out.get("uin") or "")
    # rcbot 侧的连接状态（谁连上谁没连上，只有 rcbot 自己知道）
    try:
        from . import config as _c
        api = ((_c.load() or {}).get("api") or "http://127.0.0.1:6710").rstrip("/")
        with urllib.request.urlopen(api + "/api/status", timeout=6) as r:
            d = json.loads(r.read().decode("utf-8", "replace"))
        accs = ((d.get("data") or {}).get("accounts") or [])
        a = accs[0] if accs else None
        if a:
            out["online"] = bool(a.get("online"))
            out["connected"] = bool(a.get("connected"))
            if not out.get("uin"):
                out["uin"] = str(a.get("uin") or "")
            if not out.get("nick"):
                out["nick"] = a.get("nick") or ""
            if not out.get("avatar"):
                out["avatar"] = a.get("avatar") or _avatar(out.get("uin") or "")
    except Exception:
        pass
    return out


def _avatar(uin, size=100):
    u = str(uin or "").strip()
    if not u.isdigit() or len(u) < 5 or len(u) > 12:
        return ""
    return "https://q1.qlogo.cn/g?b=qq&nk=%s&s=%d" % (u, int(size))


# ---------------------------------------------------------------- 登录

def scan():
    """登录入口：起容器 + 返回 noVNC 远程桌面地址。

    SnowLuma 没有二维码 API，只能在远程桌面里用手机 QQ 扫码。
    """
    ok, msg = snowluma.create()
    info = _snowluma_info()
    if not ok:
        raise RuntimeError("启动 SnowLuma 容器失败：%s" % str(msg)[:200])
    if info.get("login"):
        return {"mode": "novnc", "login": True, "uin": info.get("uin") or "",
                "nick": info.get("nick") or "",
                "novnc_port": info.get("novnc_port"),
                "novnc_path": info.get("novnc_path") or "",
                "novnc_password": info.get("novnc_password") or "",
                "hint": "已经登录了"}
    return {"mode": "novnc", "login": False,
            "novnc_port": info.get("novnc_port"),
            "novnc_path": info.get("novnc_path") or "",
            "novnc_password": info.get("novnc_password") or "",
            "hint": "在下面的远程桌面里用手机 QQ 扫码登录"}


def refresh_scan():
    # 远程桌面里 QQ 会自己轮换二维码，没有"刷新"这个概念
    return {"mode": "novnc", "hint": "远程桌面里 QQ 会自动刷新二维码"}


def status():
    """扫码进度。"""
    info = account_info()
    return {"done": bool(info.get("login")), "uin": info.get("uin") or "",
            "nick": info.get("nick") or "", "avatar": info.get("avatar") or "",
            "phase": info.get("phase") or "",
            "accepted": bool(info.get("login")),
            "logged": bool(info.get("login")),
            "core_ready": bool(info.get("login")),
            "onebot_ready": bool(info.get("login")),
            "backend": "snowluma", "error": info.get("error") or ""}


def action(act):
    """账户操作：start / stop / restart / logout。"""
    act = str(act or "").lower()
    if act == "start":
        ok, msg = snowluma.create()
        if not ok:
            raise RuntimeError("启动失败：%s" % str(msg)[:200])
        return {"action": act, "state": snowluma.state()}
    if act == "stop":
        snowluma.stop()
        return {"action": act, "state": snowluma.state()}
    if act == "restart":
        ok, msg = snowluma.restart()
        if not ok:
            raise RuntimeError("重启失败：%s" % str(msg)[:200])
        return {"action": act, "state": snowluma.state()}
    if act == "logout":
        # 换号：删容器（数据卷保留则登录态还在，所以要连卷一起清）
        snowluma.remove()
        snowluma.sh("docker volume rm qq-client-config qq-client-data 2>/dev/null",
                    timeout=60)
        return {"action": act, "removed": True,
                "hint": "已清登录态，重新扫码即可换号"}
    if act == "quick_login":
        raise RuntimeError("SnowLuma 没有快登概念 —— QQ 客户端自己会记住上次的号")
    raise RuntimeError("不认识的动作：%s" % act)


def logs(lines=400):
    n = max(50, min(2000, int(lines or 400)))
    txt = snowluma.logs(n)
    items = [{"level": _guess_level(x), "text": x, "ts": 0}
             for x in (txt or "").splitlines()]
    return {"items": items, "source": "docker", "total": len(items),
            "connected": snowluma.state() == "running",
            "err": "", "unit": snowluma.CONTAINER,
            "hint": "" if items else (
                "没有日志。容器可能还没启动（点「启动」或「扫码登录」拉起它）")}


def logs_clear():
    """容器日志由 docker 管理，没有内存缓冲可清。"""
    return {"cleared": True, "hint": "容器日志由 Docker 管理，无需清空"}


def _guess_level(line):
    s = (line or "").lower()
    if "[error]" in s or " error" in s or "失败" in s or "failed" in s:
        return "error"
    if "[warn]" in s or " warning" in s or "警告" in s:
        return "warn"
    if "[debug]" in s:
        return "debug"
    return "info"


# ---------------------------------------------------------------- OneBot

def onebot_call(action, body=None, timeout=10):
    return snowluma._onebot("/" + action, body, timeout)


def onebot_port():
    return snowluma.ONEBOT_WS_PORT


def onebot_url():
    return "ws://127.0.0.1:%d/?access_token=%s" % (
        snowluma.ONEBOT_WS_PORT, snowluma.ONEBOT_TOKEN)
