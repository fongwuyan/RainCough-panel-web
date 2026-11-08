# -*- coding: utf-8 -*-
"""#sl 指令用的 SnowLuma 状态摘要。

数据都在 rcbot 进程本机拿得到，不经过面板：
  · docker inspect —— 容器状态 / 启动时间
  · OneBot HTTP    —— 登录账号 / 网关版本
  · rcbot 自身     —— WS 连接、聊天档案条数

★ docker / HTTP 都是同步阻塞调用，build() 里统一丢线程池，
  别把事件循环卡住（群里有人连发 #sl 时尤其明显）。
"""
import asyncio
import time
from datetime import datetime

from . import snowluma


def _uptime(started):
    """把 docker 的 StartedAt 转成人话；解析不了就返回空串。"""
    s = str(started or "").strip()
    if not s or s.startswith("0001-"):
        return ""
    try:
        # docker 给的是 2026-11-06T12:34:56.789123456Z，纳秒 Python 不认
        s = s.replace("Z", "+00:00")
        head, _, frac = s.partition(".")
        if frac:
            tail = ""
            for i, ch in enumerate(frac):
                if not ch.isdigit():
                    tail = frac[i:]
                    break
            s = head + "." + (frac[:6].ljust(6, "0")) + tail
        t = datetime.fromisoformat(s)
        sec = max(0, int(time.time() - t.timestamp()))
    except Exception:
        return ""
    d, sec = divmod(sec, 86400)
    h, sec = divmod(sec, 3600)
    m = sec // 60
    if d:
        return "%d天%d小时" % (d, h)
    if h:
        return "%d小时%d分" % (h, m)
    return "%d分钟" % max(1, m)


def _collect():
    out = {"state": "absent", "uptime": "", "running_for": "",
           "login": {}, "version": {}}
    if not snowluma.docker_ok():
        out["state"] = "docker-unavailable"
        return out
    rc, o = snowluma.sh(
        "docker inspect %s --format '{{.State.Status}}|{{.State.StartedAt}}' 2>/dev/null"
        % snowluma.CONTAINER, timeout=15)
    if rc == 0 and (o or "").strip():
        parts = (o or "").strip().split("|", 1)
        out["state"] = parts[0] or "unknown"
        if len(parts) > 1:
            out["uptime"] = _uptime(parts[1])
    out["login"] = snowluma.login_info() or {}
    out["version"] = snowluma._onebot("/get_version_info") or {}
    return out


async def build(bot=None):
    """拼一条可直接发到 QQ 的状态文本。"""
    try:
        loop = asyncio.get_event_loop()
        d = await loop.run_in_executor(None, _collect)
    except Exception:
        d = {"state": "unknown", "login": {}, "version": {}}

    st = d.get("state") or "unknown"
    state_cn = {"running": "运行中", "exited": "已停止", "created": "已创建",
                "paused": "已暂停", "restarting": "重启中",
                "absent": "容器不存在", "docker-unavailable": "Docker 不可用",
                "unknown": "未知"}.get(st, st)

    login = d.get("login") or {}
    uin = str(login.get("uin") or "")
    nick = login.get("nick") or ""

    ob = getattr(bot, "ob", None) if bot else None
    ws = "已连接" if (ob is not None and getattr(ob, "connected", False)) else "未连接"
    ver = (d.get("version") or {})
    app = ver.get("app_name") or "SnowLuma"
    app_ver = ver.get("app_version") or ver.get("version") or ""

    lines = ["【%s 状态】" % app]
    up = d.get("uptime") or ""
    lines.append("容器　%s%s" % (state_cn, (" · 已运行 " + up) if up and st == "running" else ""))
    lines.append("QQ　　%s" % (
        "已登录 %s%s" % (uin, ("（%s）" % nick) if nick else "") if uin else "未登录"))
    lines.append("OneBot　WS %s%s" % (ws, (" · " + app_ver) if app_ver else ""))

    # 档案条数：让人一眼看出消息记录是不是还在长
    try:
        from . import store
        cur = await store._db.execute("SELECT COUNT(*) FROM chat_logs")
        row = await cur.fetchone()
        total = int(row[0]) if row else 0
        lines.append("档案　%d 条消息" % total)
    except Exception:
        pass
    return "\n".join(lines)
