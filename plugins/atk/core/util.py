#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""通用工具: 目标归一化、范围策略、HTTP 会话、环境探测。

范围策略放在 data/scope.json —— 这是插件自己的配置, 不走宿主数据层。
默认 allow(全部允许): 本工具的主要场景是自查内网资产,
默认拒绝保留网段会废掉主用途(见 插件设计.md 11.2)。
"""
import ipaddress
import json
import os
import re
import shutil
import socket
import threading
import time

from . import store

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

SCOPE_FILE = os.path.join(store.DATA_DIR, "scope.json")
_SCOPE_LOCK = threading.Lock()

_SESSION = None
_SESSION_LOCK = threading.Lock()

# 常见端口: 按实际出现频率排序, 扫前 N 个即可覆盖大多数暴露面
TOP_PORTS = [
    21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 161, 389, 443, 445, 465,
    512, 513, 514, 587, 636, 873, 993, 995, 1080, 1433, 1521, 1723, 2049, 2181,
    2375, 2376, 3000, 3128, 3260, 3306, 3389, 4444, 4848, 5000, 5432, 5555,
    5601, 5672, 5900, 5984, 6379, 6443, 7001, 7002, 8000, 8008, 8009, 8080,
    8081, 8082, 8088, 8090, 8161, 8443, 8888, 8983, 9000, 9001, 9042, 9090,
    9092, 9200, 9300, 9418, 9443, 10000, 11211, 15672, 27017, 27018, 50000,
]

# 目录探测字典: 只放"出现概率高且有意义"的路径, 不是越大越好
DIR_WORDS = [
    "admin", "administrator", "login", "logout", "register", "signin", "signup",
    "api", "api/v1", "api/v2", "api/docs", "swagger", "swagger-ui", "swagger.json",
    "openapi.json", "docs", "doc", "redoc", "graphql", "graphiql",
    "backup", "bak", "backup.zip", "www.zip", "web.zip", "site.zip", "db.sql",
    "dump.sql", "backup.sql", "data.sql", "config.php.bak", "config.bak",
    ".git/config", ".git/HEAD", ".svn/entries", ".env", ".env.bak", ".DS_Store",
    "robots.txt", "sitemap.xml", "crossdomain.xml", "security.txt", ".well-known/security.txt",
    "phpinfo.php", "info.php", "test.php", "shell.php", "upload.php", "eval.php",
    "console", "manager", "manager/html", "jmx-console", "actuator", "actuator/env",
    "actuator/health", "actuator/heapdump", "env", "health", "metrics", "status",
    "server-status", "server-info", "nginx_status", "phpmyadmin", "pma", "adminer",
    "wp-admin", "wp-login.php", "wp-json/wp/v2/users", "xmlrpc.php",
    "user", "users", "account", "profile", "dashboard", "home", "index", "main",
    "upload", "uploads", "files", "file", "download", "static", "assets", "public",
    "images", "img", "css", "js", "media", "tmp", "temp", "cache", "log", "logs",
    "debug", "trace", "error", "errors", "install", "setup", "upgrade", "update",
    "config", "config.json", "config.yaml", "config.yml", "settings", "settings.py",
    "web.config", "app.config", "package.json", "composer.json", "Dockerfile",
    "docker-compose.yml", ".dockerignore", "Makefile", "README.md", "CHANGELOG.md",
]

# 子域爆破字典
SUB_WORDS = [
    "www", "mail", "webmail", "smtp", "pop", "pop3", "imap", "mx", "ns1", "ns2",
    "dns", "api", "api1", "api2", "gateway", "gw", "open", "openapi", "rest",
    "admin", "manage", "manager", "console", "portal", "oa", "crm", "erp", "hr",
    "test", "testing", "dev", "develop", "staging", "stage", "uat", "pre", "preview",
    "beta", "demo", "sandbox", "lab", "prod", "production", "release",
    "vpn", "ssl", "remote", "rdp", "ssh", "ftp", "sftp", "nas", "files", "file",
    "git", "gitlab", "github", "svn", "repo", "jenkins", "ci", "cd", "build",
    "docker", "registry", "harbor", "k8s", "kube", "grafana", "prometheus",
    "monitor", "zabbix", "nagios", "log", "logs", "kibana", "elastic", "elk",
    "db", "mysql", "redis", "mongo", "postgres", "oracle", "sql", "es",
    "static", "cdn", "img", "images", "image", "assets", "media", "video", "download",
    "blog", "news", "shop", "store", "pay", "payment", "order", "cart", "m",
    "app", "apps", "h5", "wap", "mobile", "ios", "android", "apk", "appdownload",
    "wiki", "help", "support", "kf", "service", "customer", "work", "office",
    "intranet", "inner", "internal", "extranet", "partner", "supplier", "vendor",
    "mail2", "email", "exchange", "autodiscover", "owa", "lync", "meet", "zoom",
]


def session():
    """复用连接的 requests.Session。每次新建 TCP+TLS 要 0.5~1s, 扫描时开销可观。"""
    global _SESSION
    with _SESSION_LOCK:
        if _SESSION is None:
            import requests
            s = requests.Session()
            s.headers.update({"User-Agent": UA, "Accept": "*/*"})
            ad = requests.adapters.HTTPAdapter(pool_connections=32, pool_maxsize=64, max_retries=0)
            s.mount("http://", ad)
            s.mount("https://", ad)
            _SESSION = s
        return _SESSION


def reset_session():
    global _SESSION
    with _SESSION_LOCK:
        try:
            if _SESSION is not None:
                _SESSION.close()
        except Exception:
            pass
        _SESSION = None


# ---------------------------------------------------------------- 目标

_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")


def normalize_target(raw):
    """把用户输入归一成 (host, base_url, is_ip)。

    接受 example.com / https://example.com/x?y / 1.2.3.4:8080 / example.com:8443
    """
    s = (raw or "").strip()
    if not s:
        return None
    scheme = ""
    if _SCHEME_RE.match(s):
        scheme, s = s.split("://", 1)
        scheme = scheme.lower()
        if scheme not in ("http", "https"):
            scheme = ""
    # 去掉路径/查询
    s = s.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    port = 0
    host = s
    if ":" in s and not s.startswith("["):
        h, p = s.rsplit(":", 1)
        if p.isdigit():
            host, port = h, int(p)
        else:
            host = s
    host = host.strip("[]").lower()
    if not host:
        return None
    try:
        ipaddress.ip_address(host)
        is_ip = True
    except ValueError:
        is_ip = False
    if not scheme:
        # 没写协议时的默认:
        #   裸 IP 一律按 http —— 内网服务绝大多数是 http, 猜 https 会连不上;
        #   域名按 https —— 公网站点现在基本都有 TLS, 且 http 常被 301 到 https。
        #   显式端口优先按端口判断。
        if port in (443, 8443, 9443):
            scheme = "https"
        elif port:
            scheme = "http"
        else:
            scheme = "http" if is_ip else "https"
    hp = host if not port else "%s:%d" % (host, port)
    return {"host": host, "port": port, "scheme": scheme,
            "base": "%s://%s" % (scheme, hp), "is_ip": is_ip}


def resolve(host):
    """域名 → IP 列表(去重)。失败返回空列表。"""
    out = []
    try:
        for item in socket.getaddrinfo(host, None):
            ip = item[4][0]
            if ip not in out:
                out.append(ip)
    except Exception:
        pass
    return out


def is_private_ip(ip):
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return a.is_private or a.is_loopback or a.is_link_local or a.is_reserved


# ---------------------------------------------------------------- 范围策略

def _read_scope():
    try:
        with open(SCOPE_FILE, "r", encoding="utf-8") as f:
            d = json.load(f)
            if d.get("scope") in ("all", "lan", "wan"):
                return d["scope"]
    except Exception:
        pass
    return "all"


def get_scope():
    return _read_scope()


def set_scope(v):
    if v not in ("all", "lan", "wan"):
        raise ValueError("scope 只能是 all / lan / wan")
    os.makedirs(store.DATA_DIR, exist_ok=True)
    with _SCOPE_LOCK:
        with open(SCOPE_FILE, "w", encoding="utf-8") as f:
            json.dump({"scope": v, "updated_at": int(time.time())}, f)
    return v


def scope_check(host, scope=None):
    """判断目标是否在允许范围内。返回 (ok, reason, ips)。

    all: 都允许; lan: 解析结果必须落在保留网段; wan: 必须都不是保留网段。
    解析不到 IP 的域名在 lan/wan 档下按"无法判定"拒绝。
    """
    scope = scope or _read_scope()
    ips = resolve(host)
    if scope == "all":
        return True, "", ips
    if not ips:
        return False, "无法解析 %s, 当前策略为「%s」, 无法判定归属" % (
            host, "仅内网" if scope == "lan" else "仅公网"), ips
    priv = [ip for ip in ips if is_private_ip(ip)]
    if scope == "lan":
        if not priv:
            return False, "%s 解析到公网地址 %s, 当前策略为「仅内网」" % (host, ",".join(ips[:3])), ips
        return True, "", ips
    if priv:
        return False, "%s 解析到保留地址 %s, 当前策略为「仅公网」" % (host, ",".join(priv[:3])), ips
    return True, "", ips


# ---------------------------------------------------------------- 环境

# 外部工具: 有就用(更快更全), 没有也不影响 —— 内置引擎是主力
EXT_TOOLS = [
    ("nmap", "端口扫描与服务识别", "内置引擎可替代(connect 扫描 + banner)"),
    ("subfinder", "被动子域枚举", "内置引擎可替代(hackertarget + DNS 爆破)"),
    ("dnsx", "批量 DNS 解析", "内置引擎可替代(socket 解析)"),
    ("dirsearch", "目录爆破", "内置引擎可替代(内置字典)"),
    ("ffuf", "模糊测试", "内置引擎可替代"),
    ("nuclei", "模板漏洞扫描", "未装: 检测模块用内置配置核查, 装了可扩展模板"),
    ("whatweb", "技术栈指纹", "内置引擎可替代(响应头 + 正文特征)"),
    ("sqlmap", "SQL 注入验证", "未装: 验证模块用内置载荷库"),
    ("tshark", "流量解析", "未装: 取证模块的 pcap 分析需要它"),
    ("exiftool", "元数据提取", "未装: 取证模块用 PIL 读 EXIF"),
]

BUILTIN = [
    ("端口扫描", "TCP connect + banner 抓取", True),
    ("子域枚举", "hackertarget 被动 + DNS 爆破", True),
    ("目录探测", "内置字典 + 通配符过滤", True),
    ("指纹识别", "响应头 / Cookie / 正文特征", True),
    ("配置核查", "安全响应头 / TLS / 暴露面", True),
    ("请求构造", "任意方法 / 头 / 体, 载荷库", True),
    ("编解码", "Base64/Hex/URL/Unicode/哈希", True),
    ("文件取证", "magic 识别 / 字符串 / EXIF", True),
]


def tool_status():
    ext = []
    for name, use, hint in EXT_TOOLS:
        path = shutil.which(name)
        ext.append({"name": name, "use": use, "ok": bool(path),
                    "path": path or "", "hint": "" if path else hint})
    return {
        "builtin": [{"name": n, "how": h, "ok": ok} for n, h, ok in BUILTIN],
        "external": ext,
        "external_ok": sum(1 for x in ext if x["ok"]),
        "external_total": len(ext),
        "python": _py_ver(),
        "scope": _read_scope(),
    }


def _py_ver():
    import sys
    return "%d.%d.%d" % sys.version_info[:3]


def has_tool(name):
    return bool(shutil.which(name))
