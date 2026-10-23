#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""侦察: 子域枚举 / 端口扫描 / 目录探测 / 指纹识别。

★ 全部由内置引擎完成, 不依赖 nmap / subfinder / dirsearch。
  实测宿主上没有这些工具, 如果按"调外部命令"实现, 插件装上去就是个空壳。
  外部工具存在时仅作为可选加速(见 core/util.has_tool), 不改变结果结构。
"""
import concurrent.futures as cf
import json
import random
import re
import socket
import string
import time

from core import store
from core import util

# 单次运行的硬上限, 防止误填大字典把机器拖死
MAX_SUB_THREADS = 24
MAX_PORT_THREADS = 48
MAX_DIR_THREADS = 16
PORT_CONNECT_TIMEOUT = 1.2
HTTP_TIMEOUT = 6

WEB_PORTS = {80, 443, 8000, 8008, 8080, 8081, 8088, 8090, 8443, 8888, 9000, 9001, 9090, 9443, 10000}

STOP = {}          # run_id -> True 表示请求停止


def _stopped(run_id):
    return bool(STOP.get(run_id))


# ---------------------------------------------------------------- 引擎

def _passive_subs(host):
    """被动子域: hackertarget(实测可通)。crt.sh 在部分网络下不可达, 给短超时后跳过。"""
    out = set()
    s = util.session()
    try:
        r = s.get("https://api.hackertarget.com/hostsearch/", params={"q": host}, timeout=8)
        if r.status_code == 200 and "error" not in (r.text or "")[:40].lower():
            for line in (r.text or "").splitlines():
                p = line.split(",")
                if len(p) >= 2 and p[0].endswith("." + host):
                    out.add((p[0].strip().lower(), p[1].strip()))
    except Exception:
        pass
    try:
        r = s.get("https://crt.sh/", params={"q": "%." + host, "output": "json"}, timeout=5)
        if r.status_code == 200:
            for item in r.json() or []:
                for name in (item.get("name_value") or "").split("\n"):
                    name = name.strip().lower().lstrip("*.")
                    if name.endswith("." + host):
                        out.add((name, ""))
    except Exception:
        pass
    return out


def _brute_subs(host, run_id, budget):
    """DNS 爆破: 用本地解析器, 不依赖 dnsx。"""
    words = util.SUB_WORDS[:budget]
    found = []

    def probe(w):
        if _stopped(run_id):
            return None
        name = "%s.%s" % (w, host)
        try:
            ip = socket.gethostbyname(name)
            return (name, ip)
        except Exception:
            return None
        finally:
            store.run_incr(run_id)

    with cf.ThreadPoolExecutor(max_workers=MAX_SUB_THREADS) as ex:
        for r in ex.map(probe, words):
            if r:
                found.append(r)
    return found


def _banner(host, port):
    """探测端口上的服务。返回 (banner 文本, 是否真的是 HTTP 服务)。

    ★ 为什么要返回 http_ok:
      Cloudflare 这类中间设备对**任意端口**都会完成 TCP 握手, 于是 8080/8443
      在 connect 扫描里显示"开放", 但发 HTTP 请求拿不到任何响应。
      只看 connect 结果会把这些误判成 Web 资产, 检测模块再去核查就全是
      "目标不可达"的噪音。用一次真实 HTTP 探测来区分。
    """
    if port in WEB_PORTS:
        try:
            s = util.session()
            scheme = "https" if port in (443, 8443, 9443) else "http"
            r = s.head("%s://%s:%d/" % (scheme, host, port), timeout=4,
                       allow_redirects=False, verify=False)
            srv = r.headers.get("Server", "")
            return (srv or "HTTP %d" % r.status_code)[:80], True
        except Exception:
            pass
    try:
        with socket.create_connection((host, port), timeout=2.0) as sk:
            sk.settimeout(1.5)
            try:
                data = sk.recv(96)
                txt = re.sub(rb"[^\x20-\x7e]+", b" ", data).decode("ascii", "ignore").strip()
                return txt[:80], False
            except Exception:
                return "", False
    except Exception:
        return "", False


def _scan_ports(host, ips, run_id, task_id, budget, only_port=0):
    """TCP connect 扫描。返回 (open_list, done_count)。

    [only_port] 非 0 时只探测这一个端口 —— 目标是 `host:8080` 这种写法时，
    用户想看的是那个服务，不是把整台机器的 78 个端口再扫一遍。
    """
    ports = [only_port] if only_port else util.TOP_PORTS[:budget]
    # 优先 IPv4: 很多站点 IPv6 路由不通/被丢包, 拿 IPv6 当扫描目标会整片超时
    v4 = [x for x in ips if ":" not in x]
    target_ip = (v4[0] if v4 else (ips[0] if ips else host))
    opened = []

    def probe(p):
        if _stopped(run_id):
            return None
        try:
            with socket.create_connection((target_ip, p), timeout=PORT_CONNECT_TIMEOUT):
                return p
        except Exception:
            return None

    with cf.ThreadPoolExecutor(max_workers=MAX_PORT_THREADS) as ex:
        futs = {ex.submit(probe, p): p for p in ports}
        for f in cf.as_completed(futs):
            store.run_incr(run_id)
            p = f.result()
            if p:
                opened.append(p)
    opened.sort()
    return opened, target_ip


def _dir_baseline(base):
    """通配符基线: 先请求一个随机路径, 判断站点是不是"什么都返回 200"。"""
    rand = "".join(random.choice(string.ascii_lowercase) for _ in range(12))
    try:
        r = util.session().get("%s/%s" % (base.rstrip("/"), rand), timeout=HTTP_TIMEOUT,
                               allow_redirects=False, verify=False)
        return {"status": r.status_code, "len": len(r.content or b"")}
    except Exception:
        return None


def _probe_dirs(base, host, port, run_id, task_id, budget):
    words = util.DIR_WORDS[:budget]
    base = base.rstrip("/")
    wild = _dir_baseline(base)
    hits = []

    def probe(w):
        if _stopped(run_id):
            return None
        url = "%s/%s" % (base, w.lstrip("/"))
        try:
            r = util.session().get(url, timeout=HTTP_TIMEOUT, allow_redirects=False, verify=False)
        except Exception:
            return None
        code = r.status_code
        ln = len(r.content or b"")
        # 404 不要; 与通配符基线一致的不要(伪 200)
        if code == 404:
            return None
        if wild and code == wild["status"] and abs(ln - wild["len"]) < 32:
            return None
        if code not in (200, 201, 204, 301, 302, 307, 308, 401, 403, 405, 500, 502, 503):
            return None
        loc = r.headers.get("Location", "")
        return {"path": w, "url": url, "code": code, "len": ln, "loc": loc}

    with cf.ThreadPoolExecutor(max_workers=MAX_DIR_THREADS) as ex:
        futs = {ex.submit(probe, w): w for w in words}
        for f in cf.as_completed(futs):
            store.run_incr(run_id)
            r = f.result()
            if r:
                hits.append(r)
    hits.sort(key=lambda x: (x["code"], x["path"]))
    return hits


_FP_BODY = [
    ("wp-content", "WordPress"), ("wp-includes", "WordPress"),
    ("__NEXT_DATA__", "Next.js"), ("_nuxt", "Nuxt"),
    ("csrfmiddlewaretoken", "Django"), ("laravel_session", "Laravel"),
    ("ThinkPHP", "ThinkPHP"), ("/static/js/app.", "SPA 前端"),
    ("data-reactroot", "React"), ("ng-version", "Angular"),
    ("vue.js", "Vue"), ("jquery", "jQuery"), ("bootstrap", "Bootstrap"),
    ("Shiro", "Apache Shiro"), ("rememberMe=deleteMe", "Apache Shiro"),
    ("Whitelabel Error Page", "Spring Boot"),
    ("{\"timestamp\":", "Spring Boot"), ("swagger", "Swagger UI"),
    ("grafana", "Grafana"), ("jenkins", "Jenkins"), ("GitLab", "GitLab"),
    ("phpMyAdmin", "phpMyAdmin"), ("Index of /", "目录列举"),
]


def _fingerprint(base, host, port, run_id, task_id):
    s = util.session()
    info = {"url": base, "server": "", "powered": "", "title": "", "tech": [], "cookies": [], "code": 0}
    try:
        r = s.get(base + "/", timeout=HTTP_TIMEOUT, allow_redirects=True, verify=False)
        info["code"] = r.status_code
        h = r.headers
        info["server"] = h.get("Server", "")
        info["powered"] = h.get("X-Powered-By", "")
        for k in ("Via", "X-Cache", "CF-Ray", "X-Generator", "X-AspNet-Version", "X-Drupal-Cache"):
            if h.get(k):
                info["tech"].append("%s: %s" % (k, h[k]))
        info["cookies"] = list((h.get("Set-Cookie") or "")[:200].split(";"))[:1]
        body = (r.text or "")[:120000]
        low = body.lower()
        for key, name in _FP_BODY:
            if key.lower() in low and name not in info["tech"]:
                info["tech"].append(name)
        m = re.search(r"<title[^>]*>(.*?)</title>", body, re.I | re.S)
        if m:
            info["title"] = re.sub(r"\s+", " ", m.group(1)).strip()[:80]
    except Exception as e:
        info["error"] = str(e)[:120]
    return info


# ---------------------------------------------------------------- 主流程

def _stack_text(info):
    parts = []
    if info.get("server"):
        parts.append(info["server"])
    if info.get("powered"):
        parts.append(info["powered"])
    for t in info.get("tech", [])[:4]:
        if t not in parts:
            parts.append(t)
    return " / ".join(parts)[:160]


def _scan_target(run_id, task_id, tgt, modes, budget, label=""):
    """扫描单个目标。返回 (成功?, 错误信息)。批量时每个目标独立 try/except。"""
    host = tgt["host"]
    base = tgt["base"]
    port = tgt["port"]
    try:
        store.run_patch(run_id, status="running", stage=label + "解析目标")
        ok, reason, ips = util.scope_check(host)
        if not ok:
            store.run_log(run_id, "范围策略拦截 %s: %s" % (base, reason))
            return False, reason
        store.run_log(run_id, "目标 %s → %s" % (base, ",".join(ips) or "(未解析)"))

        # 记下目标解析结果(不单独成行, 见收尾处的兜底)
        resolved = {"ips": ips}

        # ---- 1) 子域
        if modes.get("subdomain") and not tgt["is_ip"]:
            store.run_patch(run_id, stage=label + "子域枚举")
            subs = _passive_subs(host)
            store.run_log(run_id, "被动源命中 %d 个" % len(subs))
            subs |= set(_brute_subs(host, run_id, budget["sub"]))
            n = 0
            for name, ip in sorted(subs):
                if _stopped(run_id):
                    break
                if name == host:
                    continue
                src = "被动" if ip else "爆破"
                store.asset_upsert(task_id, name, 0, "Sub", ip or "未解析", src,
                                   json.dumps({"ip": ip}))
                n += 1
            store.run_patch(run_id, stats=dict(store.run_get(run_id)["stats"], sub=n))
            store.run_log(run_id, "子域共 %d 个" % n)

        # ---- 2) 端口
        if modes.get("port") and not _stopped(run_id):
            store.run_patch(run_id, stage=label + "端口扫描")
            opened, ip = _scan_ports(host, ips, run_id, task_id, budget["port"], only_port=port)
            for p in opened:
                banner, http_ok = _banner(host, p)
                kind = "Web" if http_ok else "Service"
                if not banner:
                    # 连得上但没有任何响应: 中间设备接管或端口被过滤, 留个说明
                    banner = "TCP 可达，无响应"
                store.asset_upsert(task_id, host, p, kind, banner, "端口扫描",
                                   json.dumps({"ip": ip, "banner": banner, "http": http_ok}))
            store.run_patch(run_id, stats=dict(store.run_get(run_id)["stats"], port=len(opened)))
            store.run_log(run_id, "开放端口 %d 个: %s%s" % (
                len(opened), ",".join(str(x) for x in opened[:20]) or "无",
                "（仅探测指定端口）" if port else ""))

        # ---- 3) 指纹
        if modes.get("fingerprint") and not _stopped(run_id):
            store.run_patch(run_id, stage=label + "技术栈指纹")
            info = _fingerprint(base, host, port, run_id, task_id)
            stack = _stack_text(info)
            if not stack:
                # 至少把 HTTP 状态码留下 —— 空着看不出这个端口是活的还是死的
                stack = "HTTP %s" % (info.get("code") or "?")
            fp_port = port or (443 if base.startswith("https") else 80)
            info["ips"] = ips
            store.asset_upsert(task_id, host, fp_port, "Web", stack, "指纹识别",
                               json.dumps(info, ensure_ascii=False))
            store.run_incr(run_id)
            store.run_patch(run_id, stats=dict(store.run_get(run_id)["stats"], stack=stack))
            store.run_log(run_id, "指纹: %s" % stack)

        # ---- 4) 目录
        if modes.get("dir") and not _stopped(run_id):
            store.run_patch(run_id, stage=label + "目录探测")
            hits = _probe_dirs(base, host, port, run_id, task_id, budget["dir"])
            for h in hits:
                store.asset_upsert(task_id, "%s/%s" % (host, h["path"].lstrip("/")),
                                   port, "Path", "%d · %dB" % (h["code"], h["len"]),
                                   "目录探测", json.dumps(h, ensure_ascii=False))
            store.run_patch(run_id, stats=dict(store.run_get(run_id)["stats"], path=len(hits)))
            store.run_log(run_id, "隐藏路径 %d 条" % len(hits))

        # 兜底: 一个资产都没产出(全端口关闭/全部探测失败)时, 至少留下目标本身,
        # 否则用户看到的是空表, 分不清"没扫到"和"没扫过"。
        mine = [a for a in store.asset_list(task_id) if a["addr"].startswith(host)]
        if not mine:
            store.asset_upsert(task_id, host, port, "Host", "无开放端口 / 未识别",
                               "目标", json.dumps(resolved))
            store.run_log(run_id, "未发现资产, 仅记录目标本身")

        store.task_touch(task_id)
        return True, ""
    except Exception as e:
        store.run_log(run_id, "目标 %s 异常: %s" % (host, e))
        return False, str(e)[:160]


def _worker_multi(run_id, task_id, targets, modes, budget):
    """批量：逐个目标扫描。单个目标失败不影响其它目标。"""
    n = len(targets)
    failed = []
    try:
        for i, tgt in enumerate(targets, 1):
            if _stopped(run_id):
                store.run_log(run_id, "已停止，剩余 %d 个目标未扫" % (n - i + 1))
                break
            label = ("[%d/%d] " % (i, n)) if n > 1 else ""
            store.run_log(run_id, "开始 %s%s" % (label, tgt["base"]))
            ok, err = _scan_target(run_id, task_id, tgt, modes, budget, label)
            if not ok:
                failed.append({"target": tgt["host"], "reason": err})
    finally:
        cur = store.run_get(run_id) or {}
        done_all = cur.get("done") or 0
        total_all = cur.get("total") or done_all
        status = "completed" if not failed or done_all else "failed"
        store.run_patch(run_id, status=status,
                        stage="完成" if not failed else "完成（%d 个目标失败）" % len(failed),
                        ended_at=store.now(), done=max(done_all, total_all if not failed else done_all),
                        stats=dict(cur.get("stats") or {}, failed_targets=failed))
        store.run_log(run_id, "批量侦察结束：%d 个目标，失败 %d 个" % (n, len(failed)))
        STOP.pop(run_id, None)


def _parse_targets(raw):
    """把输入拆成目标列表。支持换行 / 逗号 / 分号 / 空格分隔。"""
    if isinstance(raw, (list, tuple)):
        parts = [str(x) for x in raw]
    else:
        parts = re.split(r"[\s,;，；]+", str(raw or ""))
    out, seen = [], set()
    for x in parts:
        x = x.strip()
        if not x:
            continue
        tgt = util.normalize_target(x)
        if not tgt:
            continue
        key = tgt["base"]
        if key in seen:
            continue
        seen.add(key)
        out.append(tgt)
    return out[:20]        # 一次最多 20 个，再多该拆任务了


def start(task_id, raw_target, modes, intensity):
    """启动侦察。立即返回 run_id, 后台线程执行(接口默认超时 15s, 不能同步跑)。"""
    targets = _parse_targets(raw_target)
    if not targets:
        raise ValueError("目标为空或格式不对")

    # 同一任务同时只允许一个侦察在跑
    last = store.run_latest(task_id, "recon")
    if last and last["status"] in ("queued", "running"):
        raise ValueError("该任务已有侦察在进行中(%s), 等它结束或先停止" % last["id"])

    budget = {
        "fast":   {"sub": 60,  "port": 40,  "dir": 60},
        "normal": {"sub": 110, "port": 78,  "dir": 120},
        "deep":   {"sub": 150, "port": len(util.TOP_PORTS), "dir": len(util.DIR_WORDS)},
    }.get(intensity or "normal", {"sub": 110, "port": 78, "dir": 120})

    per = 0
    if modes.get("port"):
        per += budget["port"]
    if modes.get("dir"):
        per += budget["dir"]
    if modes.get("fingerprint"):
        per += 1
    total = 0
    for tgt in targets:
        total += per + (budget["sub"] if (modes.get("subdomain") and not tgt["is_ip"]) else 0)

    rid = store.run_new(task_id, "recon", total)
    store.run_patch(rid, stage="排队" if len(targets) == 1 else "排队（%d 个目标）" % len(targets))
    import threading
    t = threading.Thread(target=_worker_multi, args=(rid, task_id, targets, modes, budget),
                         daemon=True, name="atk-recon-%s" % rid)
    t.start()
    return rid


def stop(run_id):
    STOP[run_id] = True
    store.run_log(run_id, "收到停止请求")
    store.run_patch(run_id, stage="停止中")
    return True
