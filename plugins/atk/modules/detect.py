#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检测: 对侦察产出的 Web 资产做配置与暴露面核查。

★ 不用 nuclei —— 宿主上没装, 装了也只是加分项。内置核查覆盖最常见的几类:
  安全响应头、TLS 配置、版本泄露、组件已知漏洞(小内置表)、暴露的敏感路径、目录列举。

产出的每一条都是"可验证的事实"(缺失哪个头、证书几天后过期、哪个路径返回了什么),
不是打分。验证模块可以据此直接复现。
"""
import concurrent.futures as cf
import json
import re
import socket
import ssl
import time

from core import store
from core import util

MAX_WORKERS = 8
HTTP_TIMEOUT = 6

# 响应头基线: 缺哪个记一条(合并成一条风险, detail 里列全)
SEC_HEADERS = [
    ("strict-transport-security", "HSTS", "中危", "HTTPS 站点未声明 HSTS, 可被降级到 HTTP"),
    ("content-security-policy", "CSP", "低危", "未配置 CSP, XSS 缺少一层浏览器侧兜底"),
    ("x-frame-options", "X-Frame-Options", "低危", "未禁止被 iframe 嵌入, 存在点击劫持风险"),
    ("x-content-type-options", "X-Content-Type-Options", "低危", "未设置 nosniff, 存在 MIME 嗅探风险"),
    ("referrer-policy", "Referrer-Policy", "低危", "未限制 Referer 外泄"),
]

# 组件已知漏洞: 只放"能靠版本号直接判定"的, 不做猜测
CVE_TABLE = [
    (r"Apache/2\.4\.(49|50)\b", "高危", "Apache 路径穿越",
     "CVE-2021-41773 / CVE-2021-42013: 路径穿越可读取任意文件甚至 RCE"),
    (r"Apache/2\.4\.(1[0-9]|2[0-9]|3[0-9]|4[0-8])\b", "中危", "Apache 版本过旧",
     "2.4.49 之前的版本存在多个已修复漏洞, 建议升级到 2.4.5x 以上"),
    (r"nginx/1\.(0|1|2|3|4|5|6|7|8|9)\b", "低危", "Nginx 版本过旧",
     "1.10 之前的版本存在多个已修复漏洞"),
    (r"PHP/5\.", "中危", "PHP 5 已停止维护", "PHP 5 全系 EOL, 不再有安全更新"),
    (r"PHP/7\.[0-3]\b", "低危", "PHP 版本已 EOL", "PHP 7.0-7.3 已停止维护"),
    (r"ThinkPHP[/ ]?5\.[01]", "高危", "ThinkPHP 5.x 已知 RCE",
     "5.0/5.1 存在多处远程代码执行, 需确认是否为受影响版本"),
    (r"Shiro|rememberMe", "高危", "Apache Shiro 反序列化",
     "CVE-2016-4437: rememberMe 默认密钥可致反序列化 RCE"),
    (r"Jenkins", "中危", "Jenkins 暴露", "CI 系统暴露在公网, 存在未授权脚本控制台风险"),
    (r"Spring Boot", "中危", "Spring Boot 端点", "确认 /actuator/env 等端点是否未授权可读"),
]

# 高危暴露路径: 命中即高危(目录探测已经找到的 Path 资产, 这里只做判定)
SENSITIVE_PATHS = [
    (r"\.git/(config|HEAD)$", "高危", "Git 仓库暴露", "可完整还原源码, 含历史凭证"),
    (r"\.svn/", "高危", "SVN 元数据暴露", "可还原源码"),
    (r"\.env", "高危", "环境变量文件暴露", "通常含数据库口令与密钥"),
    (r"(backup|www|web|site|db|dump|data)\.(zip|tar\.gz|rar|7z|sql)$", "高危", "备份文件暴露", "整站源码或数据库可直接下载"),
    (r"(phpinfo|info|test)\.php$", "中危", "调试页面暴露", "泄露环境变量、路径与扩展信息"),
    (r"actuator/(env|heapdump)$", "高危", "Actuator 敏感端点", "可读取配置或导出堆内存"),
    (r"(jmx-console|web-console)", "高危", "JMX 控制台暴露", "可部署 WAR 导致 RCE"),
    (r"swagger|openapi|graphiql", "低危", "接口文档暴露", "暴露全部接口定义, 便于攻击者构造请求"),
    (r"\.DS_Store$", "低危", "目录索引文件暴露", "泄露同目录文件名"),
    (r"server-status|nginx_status", "中危", "服务状态页暴露", "泄露后端地址与请求统计"),
]


def _tls_info(host, port):
    """取证书与协议信息。返回 dict 或 None。"""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((host, port), timeout=5) as raw:
            with ctx.wrap_socket(raw, server_hostname=host) as sk:
                cert = sk.getpeercert()
                ver = sk.version()
                cipher = sk.cipher()
    except Exception as e:
        return {"error": str(e)[:120]}
    out = {"version": ver, "cipher": cipher[0] if cipher else "", "not_after": "", "days_left": None,
           "self_signed": False, "subject": "", "issuer": ""}
    if cert:
        out["not_after"] = cert.get("notAfter", "")
        out["subject"] = str(cert.get("subject", ""))[:200]
        out["issuer"] = str(cert.get("issuer", ""))[:200]
        try:
            exp = ssl.cert_time_to_seconds(cert["notAfter"])
            out["days_left"] = int((exp - time.time()) // 86400)
        except Exception:
            pass
        out["self_signed"] = out["subject"] == out["issuer"]
    return out


def _check_web(asset):
    """对一个 Web 资产做核查, 返回风险列表。"""
    host = asset["addr"]
    port = asset["port"] or (443 if str(asset.get("extra", "")).find("https") >= 0 else 80)
    scheme = "https" if port in (443, 8443, 9443) else "http"
    url = "%s://%s%s/" % (scheme, host, "" if port in (80, 443) else ":%d" % port)
    out = []
    s = util.session()
    try:
        r = s.get(url, timeout=HTTP_TIMEOUT, allow_redirects=True, verify=False)
    except Exception as e:
        return [{"level": "低危", "kind": "目标不可达", "target": url,
                 "evidence": str(e)[:120], "detail": "连接失败, 后续核查跳过"}]

    h = {k.lower(): v for k, v in r.headers.items()}
    body = (r.text or "")[:60000]
    low = body.lower()

    # 1) 安全响应头(HTTPS 才要求 HSTS)
    missing = []
    for key, name, lv, why in SEC_HEADERS:
        if key == "strict-transport-security" and scheme != "https":
            continue
        if not h.get(key):
            missing.append((name, lv, why))
    if missing:
        worst = "中危" if any(x[1] == "中危" for x in missing) else "低危"
        out.append({
            "level": worst, "kind": "安全响应头缺失", "target": url,
            "evidence": "缺少 " + "、".join(x[0] for x in missing),
            "detail": "\n".join("- %s(%s): %s" % x for x in missing),
        })

    # 2) 版本泄露
    srv = h.get("server", "")
    powered = h.get("x-powered-by", "")
    ver_leak = []
    if re.search(r"\d+\.\d+", srv):
        ver_leak.append("Server: " + srv)
    if powered:
        ver_leak.append("X-Powered-By: " + powered)
    if ver_leak:
        out.append({"level": "低危", "kind": "版本信息泄露", "target": url,
                    "evidence": " / ".join(ver_leak)[:160],
                    "detail": "响应头直接暴露组件版本, 便于攻击者匹配已知漏洞"})

    # 3) 组件已知漏洞(基于响应头与正文特征)
    blob = srv + " " + powered + " " + body[:4000]
    for pat, lv, kind, why in CVE_TABLE:
        if re.search(pat, blob, re.I):
            m = re.search(pat, blob, re.I)
            out.append({"level": lv, "kind": kind, "target": url,
                        "evidence": "命中特征: " + m.group(0)[:60],
                        "detail": why})

    # 4) TLS
    if scheme == "https":
        ti = _tls_info(host, port)
        if ti.get("error"):
            out.append({"level": "中危", "kind": "TLS 握手异常", "target": url,
                        "evidence": ti["error"], "detail": "证书或协议配置有问题"})
        else:
            if ti.get("self_signed"):
                out.append({"level": "中危", "kind": "自签名证书", "target": url,
                            "evidence": "issuer == subject: " + ti.get("subject", "")[:80],
                            "detail": "自签证书无法防御中间人"})
            dl = ti.get("days_left")
            if dl is not None and dl < 0:
                out.append({"level": "高危", "kind": "证书已过期", "target": url,
                            "evidence": "notAfter=%s (已过期 %d 天)" % (ti.get("not_after"), -dl),
                            "detail": "证书过期会导致浏览器拦截"})
            elif dl is not None and dl <= 30:
                out.append({"level": "中危", "kind": "证书即将过期", "target": url,
                            "evidence": "notAfter=%s (剩 %d 天)" % (ti.get("not_after"), dl),
                            "detail": "30 天内到期"})
            if ti.get("version") in ("TLSv1", "TLSv1.1", "SSLv3", "SSLv2"):
                out.append({"level": "中危", "kind": "弱 TLS 协议", "target": url,
                            "evidence": "协商结果: " + str(ti.get("version")),
                            "detail": "应至少启用 TLS 1.2"})

    # 5) 目录列举
    if "Index of /" in body or "Directory listing for" in body:
        out.append({"level": "中危", "kind": "目录列举", "target": url,
                    "evidence": "页面包含目录索引",
                    "detail": "关闭 autoindex, 或限制目录访问"})
    return out


def _check_path(asset):
    """对侦察找到的 Path 资产做判定。"""
    addr = asset["addr"]
    out = []
    for pat, lv, kind, why in SENSITIVE_PATHS:
        if re.search(pat, addr, re.I):
            out.append({"level": lv, "kind": kind, "target": addr,
                        "evidence": "路径命中: " + addr, "detail": why})
            break
    # 状态码本身也是信息
    st = asset.get("stack", "")
    if st.startswith("401") or st.startswith("403"):
        out.append({"level": "低危", "kind": "受保护路径可枚举", "target": addr,
                    "evidence": st, "detail": "路径存在但拒绝访问, 可继续尝试绕过"})
    return out


def _worker(run_id, task_id):
    try:
        assets = store.asset_list(task_id)
        # 同一 host:port 只核查一次 —— 侦察会同时留下 Host(目标) 与 Web(指纹) 两条,
        # 不去重就会对同一个 URL 产出两份一样的风险。
        seen = set()
        webs = []
        for a in assets:
            if a["kind"] not in ("Web", "Host"):
                continue
            key = (a["addr"], a["port"])
            if key in seen:
                continue
            seen.add(key)
            webs.append(a)
        paths = [a for a in assets if a["kind"] == "Path"]
        store.run_patch(run_id, total=len(webs) + len(paths), status="running")
        store.run_log(run_id, "待核查: Web %d 个, 路径 %d 条" % (len(webs), len(paths)))

        # 清掉上一轮自动产出的风险(人工已确认/误报的保留)
        with store._LOCK:
            store.conn().execute(
                "DELETE FROM atk_risk WHERE task_id=? AND status='待确认'", (int(task_id),))
            store.conn().commit()

        n = 0
        with cf.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futs = {ex.submit(_check_web, a): a for a in webs}
            for f in cf.as_completed(futs):
                a = futs[f]
                try:
                    risks = f.result()
                except Exception as e:
                    risks = [{"level": "低危", "kind": "核查失败", "target": a["addr"],
                              "evidence": str(e)[:120], "detail": ""}]
                for r in risks:
                    store.risk_add(task_id, a["id"], r["level"], r["kind"], r["target"],
                                   r["evidence"], r.get("detail", ""))
                    n += 1
                store.run_incr(run_id)
                store.run_patch(run_id, stage="核查 %s" % a["addr"])

        for a in paths:
            for r in _check_path(a):
                store.risk_add(task_id, a["id"], r["level"], r["kind"], r["target"],
                               r["evidence"], r.get("detail", ""))
                n += 1
            store.run_incr(run_id)

        store.task_touch(task_id)
        store.run_patch(run_id, status="completed", stage="完成", ended_at=store.now(),
                        stats={"risks": n})
        store.run_log(run_id, "检测完成, 共 %d 条风险" % n)
    except Exception as e:
        store.run_patch(run_id, status="failed", error=str(e)[:200], ended_at=store.now())
        store.run_log(run_id, "异常: %s" % e)


def start(task_id):
    last = store.run_latest(task_id, "detect")
    if last and last["status"] in ("queued", "running"):
        raise ValueError("该任务已有检测在进行中")
    rid = store.run_new(task_id, "detect", 0)
    import threading
    threading.Thread(target=_worker, args=(rid, task_id), daemon=True,
                     name="atk-detect-%s" % rid).start()
    return rid
