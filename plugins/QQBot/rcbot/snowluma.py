# -*- coding: utf-8 -*-
"""SnowLuma 后端：用 Docker 容器跑 QQ（插件唯一支持的 QQ 框架）。

形态：QQ + Xvfb + noVNC 全在容器里，宿主机只需要 Docker。
  · 控制   docker start / stop / restart（不是 systemd）
  · 日志   docker logs
  · 扫码   没有二维码 API，只能开 noVNC 远程桌面用手机 QQ 扫
  · 账号   问 OneBot 的 get_login_info（HTTP 3000）
  · 协议   OneBot 11 / WebSocket 3001（正向 WS，rcbot 连它）

所以这里做四件事：
  1. 容器的生命周期（起/停/重启/日志）
  2. 从容器日志里取 noVNC 的远程桌面密码，拼出可直接扫码的 URL
  3. 固化 onebot.json 的 accessToken，并打开 reportSelfMessage
     （不开的话机器人自己发的消息不上报事件流，消息页就看不到自己说过的话）
  4. 用 OneBot 的 get_login_info 判断登录态与账号信息

★ SnowLuma 的 OneBot 实例是"QQ 登录后才起来"的（hook 注入成功才拉 OneBotInstance），
  所以 **3000 端口能正常回 get_login_info = 已登录**，不用再猜状态机。
"""
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request

CONTAINER = "snowluma"
IMAGE = "motricseven7/snowluma:latest"

# 端口（与 compose 模板一致）
WEBUI_PORT = 5099
NOVNC_PORT = 6081
ONEBOT_HTTP_PORT = 3000
ONEBOT_WS_PORT = 3001

# OneBot 的固定令牌 —— 部署时写进 onebot.json，rcbot 用它连 WS
ONEBOT_TOKEN = "rcsnow"

# ★ 远程桌面密码必须**固定**。
#
#   镜像默认行为：没给 VNC_PASSWD 时，每次容器启动都随机生成一个，
#   只往日志打一次。于是"退出登录 → 重建容器"之后，面板里缓存的旧密码
#   立刻失效，用户看到的就是 noVNC 弹出「需要凭证登录 / password check failed」。
#   给了 VNC_PASSWD 就走 env 分支（start.sh: if (!isKnownVncPassword(envPass))），
#   重启、重建、换卷都不会变。
VNC_PASSWD = "rcbotvnc"

VOLUMES = {
    "qq-gateway-data": "/app/data",
    "qq-client-config": "/app/.config",
    "qq-client-data": "/app/.local/share",
}

# VNC 密码在容器日志里打印（首次启动时随机生成）
_VNC_RE = re.compile(r"(?:远程桌面密码|remote desktop password)[:：]\s*(\S+)")


def sh(cmd, timeout=60):
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True, timeout=timeout)
        return p.returncode, ((p.stdout or b"") + (p.stderr or b"")).decode("utf-8", "replace")
    except Exception as e:
        return 1, str(e)


def docker_ok():
    rc, o = sh("docker version --format '{{.Server.Version}}' 2>/dev/null", timeout=20)
    return rc == 0 and (o or "").strip() != ""


def exists():
    rc, o = sh("docker inspect -f '{{.State.Status}}' %s 2>/dev/null" % CONTAINER, timeout=20)
    return rc == 0 and (o or "").strip() in ("running", "exited", "created", "paused", "restarting")


def state():
    """容器状态：running / exited / absent / unknown。"""
    rc, o = sh("docker inspect -f '{{.State.Status}}' %s 2>/dev/null" % CONTAINER, timeout=20)
    if rc != 0:
        return "absent"
    return (o or "").strip() or "unknown"


def image_present():
    rc, o = sh("docker images -q %s 2>/dev/null" % IMAGE, timeout=20)
    return rc == 0 and bool((o or "").strip())


def _volume_args():
    args = []
    for vol in VOLUMES:
        args.append("-v %s" % vol)
    return " ".join(args)


def create():
    """起容器（不存在则创建）。

    ★ 两个安全参数不能少：
        --cap-add=SYS_PTRACE      native addon 靠 ptrace 注入 QQ 进程
        --security-opt seccomp=unconfined  默认 seccomp 会拦截注入
      --shm-size=1g：QQ 基于 Chromium，共享内存太小会崩
    """
    if not docker_ok():
        return False, "Docker 不可用（docker version 失败）"
    if not image_present():
        return False, "镜像不存在：%s（先 docker pull）" % IMAGE

    if exists():
        if state() != "running":
            rc, o = sh("docker start %s" % CONTAINER, timeout=120)
            if rc == 0:
                _boot_fix()
                _VNC_SHARED["done"] = False
                _vnc_shared()
            return rc == 0, o
        _boot_fix()
        _vnc_shared()
        return True, "already running"

    cmd = (
        "docker run -d --name %s --restart unless-stopped "
        "--shm-size=1g --ulimit nofile=65536:1048576 "
        "--cap-add=SYS_PTRACE --security-opt seccomp=unconfined "
        "-e SNOWLUMA_WEBUI_HOST=0.0.0.0 "
        "-e SNOWLUMA_WEBUI_PORT=%d "
        "-e VNC_PASSWD=%s "
        '-e SNOWLUMA_QQ_FLAGS="--disable-gpu --disable-software-rasterizer --disable-gpu-compositing" '
        "-p %d:%d -p %d:%d -p %d:%d -p %d:%d "
        "%s %s"
        % (CONTAINER,
           WEBUI_PORT,
           VNC_PASSWD,
           NOVNC_PORT, NOVNC_PORT,
           WEBUI_PORT, WEBUI_PORT,
           ONEBOT_HTTP_PORT, ONEBOT_HTTP_PORT,
           ONEBOT_WS_PORT, ONEBOT_WS_PORT,
           _volume_args(), IMAGE)
    )
    rc, o = sh(cmd, timeout=300)
    if rc == 0:
        _boot_fix()
        _VNC_SHARED["done"] = False
        _vnc_shared()
    return rc == 0, o


# onebot.json 是否已经固化过（进程级缓存，避免每次调接口都 docker exec）
_ONEBOT_FIXED = {"done": False}

# x11vnc 是否已经切成共享模式（同上，进程级）
_VNC_SHARED = {"done": False}


def _boot_fix():
    """容器起来后做一次初始化：固化 onebot.json 的 token 与自发消息上报。

    SnowLuma 首次启动会生成**随机** token，且 reportSelfMessage 默认 false。
    改完必须重启容器才生效 —— 所以这一步只在真的改了的时候重启。
    """
    if _ONEBOT_FIXED["done"]:
        return
    # 等容器里的 node 与配置文件就绪
    for _ in range(15):
        rc, o = sh("docker exec %s test -f /app/data/config/onebot.json" % CONTAINER,
                   timeout=15)
        if rc == 0:
            break
        time.sleep(2)
    ok, out = ensure_onebot_config()
    if ok and "CONFIG_SET" in (out or ""):
        sh("docker restart %s" % CONTAINER, timeout=180)
        time.sleep(8)
        _ONEBOT_FIXED["done"] = True
        return
    # 已经是目标值 / 暂时改不了：标记完成，避免每次都重启
    if ok:
        _ONEBOT_FIXED["done"] = True


def _vnc_shared():
    """把容器里的 x11vnc 切成**共享模式**（允许多个观看者）。

    ★ 为什么必须做：镜像的 start.sh 起 x11vnc 时只给了 -forever，没给 -shared。
      libvncserver 因此是「独占」的：已经有一个客户端连着时，新连接会被
        -dontdisconnect: Not shared & existing client  →  refusing new client
      直接踢掉 —— noVNC 上看到的就是「已断开连接」。
      面板里 iframe 刷新/关掉重开、或者两个标签页同时看，都会撞上这个。

    ★ 为什么用 docker exec -d 起：直接在 exec 里 `x11vnc ... &` 的话，
      exec 会话一结束子进程就被收走（SIGHUP / supervisord reaped）。
      -d 让容器内的 sh 脱离 exec 会话，进程才能活。
    ★ pkill 必须用 -x x11vnc：`pkill -f "x11vnc -display"` 会把
      执行这条命令的 sh 自己也匹配上（命令行里含同样的串）→ 自杀。
    """
    if _VNC_SHARED["done"]:
        return

    def _count(pattern):
        rc, o = sh("docker exec %s sh -c \"pgrep %s | wc -l\""
                   % (CONTAINER, pattern), timeout=20)
        try:
            return int((o or "0").strip().splitlines()[-1])
        except Exception:
            return 0

    # 容器刚重启时 start.sh 还没把 x11vnc 拉起来 —— 等它出现再替换，
    # 否则我们起的实例和它后起的实例会同时在（两个都占不到同一个端口，
    # 一个 listen 成功、另一个报 Address already in use，但 ps 里都是两个）。
    for _ in range(15):
        if _count("-x x11vnc") >= 1:
            break
        time.sleep(2)

    all_n = _count("-x x11vnc")
    shared_n = _count("-f '^x11vnc .*-shared'")
    if all_n >= 1 and all_n == shared_n:
        _VNC_SHARED["done"] = True
        return

    sh("docker exec -d %s sh -c 'pkill -x x11vnc; sleep 3; "
       "x11vnc -display :1 -shared -noxrecord -noxfixes -noxdamage -forever -threads "
       "-rfbauth /root/.vnc/passwd >/tmp/x11vnc.log 2>&1'" % CONTAINER, timeout=40)
    time.sleep(5)
    if _count("-f '^x11vnc .*-shared'") >= 1:
        _VNC_SHARED["done"] = True


def stop():
    if not exists():
        return True, "absent"
    rc, o = sh("docker stop %s" % CONTAINER, timeout=120)
    return rc == 0, o


def restart():
    if not exists():
        return create()
    rc, o = sh("docker restart %s" % CONTAINER, timeout=180)
    if rc == 0:
        _VNC_SHARED["done"] = False
        _vnc_shared()
    return rc == 0, o


def remove():
    """删容器（保留数据卷 —— 登录态在里面，删了要重新扫码）。"""
    if not exists():
        return True, "absent"
    sh("docker stop %s 2>/dev/null" % CONTAINER, timeout=120)
    rc, o = sh("docker rm %s" % CONTAINER, timeout=60)
    return rc == 0, o


def logs(lines=400):
    """容器日志（去掉 Qt/GLib 的噪音行）。"""
    n = max(50, min(5000, int(lines or 400)))
    rc, o = sh("docker logs --tail %d %s 2>&1" % (n, CONTAINER), timeout=60)
    if rc != 0:
        return ""
    keep = []
    for ln in (o or "").splitlines():
        if re.search(r"QtNetwork|GLib|libQt6|Fontconfig|dbus", ln):
            continue
        keep.append(ln)
    return "\n".join(keep)


def vnc_password():
    """远程桌面密码。

    优先级：容器 env 里的 VNC_PASSWD（我们自己起的容器一定有，固定值）→
    容器日志里打印的随机密码（老容器，或镜像换了行为时的兜底）。

    ★ 不能只看日志：日志里是**启动那一刻**的值，容器一旦重建，
      旧密码在日志里还留着（tail -n 1 拿到的是旧行），
      而 x11vnc 已经用新密码了 —— 于是 iframe 弹「需要凭证登录」。
    """
    rc, o = sh("docker inspect %s --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null"
               % CONTAINER, timeout=20)
    if rc == 0:
        for ln in (o or "").splitlines():
            if ln.startswith("VNC_PASSWD="):
                pw = ln.split("=", 1)[1].strip()
                if pw:
                    return pw
    _, o = sh("docker logs %s 2>&1 | grep -Ei '远程桌面密码|remote desktop password' "
              "| tail -n 1" % CONTAINER, timeout=60)
    m = _VNC_RE.search(o or "")
    return m.group(1).strip() if m else ""


def novnc_url(host=""):
    """可直接扫码的 noVNC 地址（带密码，打开就自动连）。

    autoconnect=1 + password 省掉用户手动输密码那一步。
    """
    pw = vnc_password()
    q = "autoconnect=1&resize=scale"
    if pw:
        q += "&password=" + urllib.request.quote(pw)
    return "http://%s:%d/vnc.html?%s" % (host or "127.0.0.1", NOVNC_PORT, q)


# ---------------------------------------------------------------- OneBot

def _onebot(path, body=None, timeout=8):
    """调 OneBot HTTP API（3000）。返回 data；失败返回 None。"""
    url = "http://127.0.0.1:%d%s" % (ONEBOT_HTTP_PORT, path)
    data = json.dumps(body or {}).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + ONEBOT_TOKEN},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            d = json.loads(r.read().decode("utf-8", "replace"))
        if d.get("retcode") not in (0, None):
            return None
        return d.get("data")
    except Exception:
        return None


def login_info():
    """当前登录的账号信息；没登录返回 {}。

    ★ SnowLuma 的 OneBot 实例要等 QQ 登录后才起来 ——
      所以这个接口能返回数据就说明已经登录了。
    """
    d = _onebot("/get_login_info")
    if not isinstance(d, dict):
        return {}
    uin = d.get("user_id") or d.get("uin")
    if not uin:
        return {}
    return {"uin": str(uin), "nick": d.get("nickname") or d.get("nick") or ""}


def onebot_alive():
    """OneBot HTTP 是否可用（= 已登录且 hook 成功）。"""
    return bool(login_info())


def ensure_onebot_config():
    """固化容器里所有 OneBot 配置：token / 自发消息上报 / 内置状态指令。

    三件事：
      · accessToken 首次启动随机生成，rcbot 没法预知 → 固定成 ONEBOT_TOKEN
      · reportSelfMessage 镜像默认 false，机器人自己发的消息不进事件流，
        消息页里就只剩别人说的话 → 打开
      · statusCommand 是框架自带的 #sl 指令，默认开着。插件侧的 rcbot
        也实现了 #sl（面板设置页有开关，任意群/私聊都回），两边同时开
        会一条 #sl 收到两条状态 → 关掉框架侧的，由 rcbot 统一响应

    ★ 容器里不只有 onebot.json：QQ 登录成功后 SnowLuma 会另存一份
      onebot_<uin>.json 并**优先用它**（实测只改 onebot.json 完全不生效）。
      所以必须遍历 /app/data/config/onebot*.json 逐个改。

    ★ 不用 sed —— JSON 里带引号，经 shell → docker exec → sh 三层转义后
      正则几乎必然被吃掉。改成把 python 脚本 base64 传进去，容器里解码执行。
    """
    if not exists():
        return False, "容器不存在"

    rc, listing = sh(
        "docker exec %s sh -c \"ls /app/data/config/onebot*.json 2>/dev/null\"" % CONTAINER,
        timeout=20)
    files = [x.strip() for x in (listing or "").splitlines()
             if x.strip().startswith("/") and x.strip().endswith(".json")]
    if not files:
        return False, "找不到 onebot 配置"

    # 宿主机先逐份解析，全都达标就别白改一遍（改了要重启容器才生效）
    need_fix = False
    for path in files:
        rc, cur = sh("docker exec %s cat %s 2>/dev/null" % (CONTAINER, path), timeout=30)
        if rc != 0 or not (cur or "").strip():
            need_fix = True
            continue
        try:
            d = json.loads(cur)
            servers = []
            for key in ("httpServers", "wsServers"):
                servers += ((d.get("networks") or {}).get(key) or [])
            if not servers or any(
                    x.get("accessToken") != ONEBOT_TOKEN
                    or x.get("reportSelfMessage") is not True for x in servers):
                need_fix = True
            sc = d.get("statusCommand")
            if isinstance(sc, dict) and sc.get("enabled") is not False:
                need_fix = True
        except Exception:
            need_fix = True
    if not need_fix:
        return True, "CONFIG_OK"

    script = (
        "import json,glob\n"
        "n=0\n"
        "for p in glob.glob('/app/data/config/onebot*.json'):\n"
        "    try:\n"
        "        d=json.load(open(p,encoding='utf-8'))\n"
        "    except Exception:\n"
        "        continue\n"
        "    for k in ('httpServers','wsServers'):\n"
        "        for x in (d.get('networks') or {}).get(k) or []:\n"
        "            if x.get('accessToken')!='%s':\n"
        "                x['accessToken']='%s';n+=1\n"
        "            if x.get('reportSelfMessage') is not True:\n"
        "                x['reportSelfMessage']=True;n+=1\n"
        "    sc=d.get('statusCommand')\n"
        "    if isinstance(sc,dict) and sc.get('enabled') is not False:\n"
        "        sc['enabled']=False;n+=1\n"
        "    json.dump(d,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)\n"
        "print('CHANGED' if n else 'NOCHANGE')\n"
    ) % (ONEBOT_TOKEN, ONEBOT_TOKEN)
    import base64
    b64 = base64.b64encode(script.encode("utf-8")).decode("ascii")
    cmd = ("docker exec %s sh -c \"echo %s | base64 -d | python3 -\"" % (CONTAINER, b64))
    rc, o = sh(cmd, timeout=60)
    if "CHANGED" in (o or ""):
        return True, "CONFIG_SET"
    if "NOCHANGE" in (o or ""):
        return True, "CONFIG_OK"
    return False, (o or "")[:200]


def _sq(s):
    """给 shell 用的单引号包裹（内部单引号转义）。"""
    return "'" + s.replace("'", "'\\''") + "'"


def wait_onebot(tries=30):
    """等 OneBot 起来（登录后才有）。"""
    for _ in range(tries):
        if onebot_alive():
            return True
        time.sleep(2)
    return False
