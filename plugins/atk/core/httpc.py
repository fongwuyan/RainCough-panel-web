#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""纯标准库 HTTP 客户端(http.client + ssl + gzip + zlib)。

为什么不用 requests:
  插件要求**只用标准库**, 装到没有 pip 的机器上也能跑。requests 在这里能做的事,
  http.client 都能做, 只多几行样板。

对外接口刻意做成 requests 的子集(get / head / request), 调用方写法不变:
    s = session()
    r = s.get(url, timeout=6, allow_redirects=False, verify=False)
    r.status_code / r.headers / r.text / r.content / r.url / r.history

设计要点:
  · **按线程**缓存连接 —— 扫描是多线程的, http.client 的连接不是线程安全的,
    共用一个连接会串包。线程本地池 + 每个 (scheme,host,port) 一条。
  · 连接失效时丢池重连一次 —— keep-alive 被服务端关掉是常态, 不重试会误报"不可达"。
  · 不主动发 Accept-Encoding, 但**能解** gzip/deflate(有的服务端不看请求头就压)。
  · 证书一律不校验 —— 目标是任意主机(含自签/过期证书), 校验会让扫描大面积失败。
    需要证书信息时由 detect 模块单独用 ssl 取, 不复用这条连接。
"""
import gzip
import http.client
import socket
import ssl
import threading
import urllib.parse
import zlib

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

DEFAULT_TIMEOUT = 6.0
MAX_REDIRECTS = 5

_tls = threading.local()


class Resp:
    """极简响应对象(字段名与 requests 对齐, 便于调用方无感迁移)。"""

    __slots__ = ("status_code", "headers", "content", "url", "history")

    def __init__(self, status, headers, content, url, history=None):
        self.status_code = status
        self.headers = headers
        self.content = content
        self.url = url
        self.history = history or []

    @property
    def text(self):
        if not self.content:
            return ""
        enc = "utf-8"
        ct = ""
        try:
            ct = self.headers.get("Content-Type", "") or ""
        except Exception:
            pass
        low = ct.lower()
        if "charset=" in low:
            enc = low.split("charset=", 1)[1].split(";")[0].strip().strip('"\'')
        try:
            return self.content.decode(enc, "replace")
        except (LookupError, UnicodeDecodeError):
            return self.content.decode("utf-8", "replace")

    def __repr__(self):
        return "<Resp %s %s>" % (self.status_code, self.url)


def _pool():
    p = getattr(_tls, "pool", None)
    if p is None:
        p = _tls.pool = {}
    return p


def _drop(key):
    c = _pool().pop(key, None)
    if c is not None:
        try:
            c.close()
        except Exception:
            pass


def _connect(scheme, host, port, timeout):
    key = (scheme, host, port)
    c = _pool().get(key)
    if c is not None:
        # 复用前把超时更新成本次的(不同调用超时不同)
        try:
            c.timeout = timeout
            if getattr(c, "sock", None) is not None:
                c.sock.settimeout(timeout)
            return key, c
        except Exception:
            _drop(key)
    if scheme == "https":
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        # 老服务端可能只支持 TLS1.0/1.1, 放宽下限, 否则直接握手失败看不到页面
        try:
            ctx.minimum_version = ssl.TLSVersion.TLSv1
        except Exception:
            pass
        c = http.client.HTTPSConnection(host, port, timeout=timeout, context=ctx)
    else:
        c = http.client.HTTPConnection(host, port, timeout=timeout)
    _pool()[key] = c
    return key, c


def _decompress(resp_headers, data):
    if not data:
        return data
    enc = ""
    try:
        enc = (resp_headers.get("Content-Encoding", "") or "").lower()
    except Exception:
        pass
    try:
        if "gzip" in enc:
            return gzip.decompress(data)
        if "deflate" in enc:
            try:
                return zlib.decompress(data)
            except zlib.error:
                return zlib.decompress(data, -zlib.MAX_WBITS)
    except Exception:
        return data
    return data


def _split(url, params=None):
    if params:
        q = urllib.parse.urlencode(params, doseq=True)
        url = url + ("&" if "?" in url else "?") + q
    u = urllib.parse.urlsplit(url)
    scheme = (u.scheme or "http").lower()
    if scheme not in ("http", "https"):
        raise ValueError("只支持 http/https: " + url)
    host = u.hostname
    if not host:
        raise ValueError("URL 缺少主机: " + url)
    port = u.port or (443 if scheme == "https" else 80)
    path = u.path or "/"
    if u.query:
        path += "?" + u.query
    return scheme, host, port, path


def request(method, url, headers=None, data=None, timeout=DEFAULT_TIMEOUT,
            allow_redirects=True, params=None, max_redirects=MAX_REDIRECTS, **_ignored):
    """发一次请求。`verify` 等 requests 专有参数会被忽略(证书本来就不校验)。"""
    method = (method or "GET").upper()
    if isinstance(data, str):
        data = data.encode("utf-8")
    history = []
    cur = url
    last = None

    for _hop in range(max_redirects + 1):
        scheme, host, port, path = _split(cur, params if _hop == 0 else None)
        hdrs = {
            "User-Agent": UA,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Connection": "keep-alive",
        }
        if headers:
            hdrs.update({str(k): str(v) for k, v in headers.items()})
        if host not in hdrs.get("Host", ""):
            hdrs.setdefault("Host", host if port in (80, 443) else "%s:%d" % (host, port))

        key, conn = _connect(scheme, host, port, timeout)
        try:
            conn.request(method, path, body=data, headers=hdrs)
            raw = conn.getresponse()
            body = _decompress(raw.headers, raw.read())
            # ★ 服务端说"这条连接要关"(HTTP/1.0 或 Connection: close)就立刻出池。
            #   不这么做的话, 下一次请求会先在死连接上失败一次再重连 ——
            #   实测对 HTTP/1.0 服务端, 每次多付一次失败的连接开销(3.4ms vs 2.0ms)。
            if getattr(raw, "will_close", False):
                _drop(key)
        except (http.client.HTTPException, ConnectionError, socket.timeout, OSError, ssl.SSLError):
            # 连接过期/被对端关闭: 丢池重连一次
            _drop(key)
            key, conn = _connect(scheme, host, port, timeout)
            conn.request(method, path, body=data, headers=hdrs)
            raw = conn.getresponse()
            body = _decompress(raw.headers, raw.read())
            if getattr(raw, "will_close", False):
                _drop(key)

        last = Resp(raw.status, raw.headers, body, cur, history)

        loc = raw.getheader("Location")
        if allow_redirects and raw.status in (301, 302, 303, 307, 308) and loc:
            history.append(last)
            cur = urllib.parse.urljoin(cur, loc)
            # 301/302/303 对非 GET 要降级成 GET(浏览器行为), 307/308 保持原样
            if raw.status in (301, 302, 303) and method not in ("GET", "HEAD"):
                method, data = "GET", None
            continue
        return last

    return last


class Session:
    """requests.Session 的子集: get / head / post / request。"""

    def __init__(self, headers=None, timeout=DEFAULT_TIMEOUT):
        self.headers = dict(headers or {})
        self.timeout = timeout

    def _merge(self, headers):
        h = dict(self.headers)
        if headers:
            h.update(headers)
        return h

    def request(self, method, url, headers=None, data=None, json=None, timeout=None,
                allow_redirects=True, params=None, **kw):
        if json is not None:
            import json as _json
            data = _json.dumps(json).encode("utf-8")
            headers = dict(headers or {})
            headers.setdefault("Content-Type", "application/json")
        return request(method, url, headers=self._merge(headers), data=data,
                       timeout=timeout or self.timeout, allow_redirects=allow_redirects,
                       params=params, **kw)

    def get(self, url, **kw):
        return self.request("GET", url, **kw)

    def head(self, url, **kw):
        return self.request("HEAD", url, **kw)

    def post(self, url, **kw):
        return self.request("POST", url, **kw)

    def close(self):
        for k in list(_pool().keys()):
            _drop(k)


_session = None
_lock = threading.Lock()


def session():
    global _session
    with _lock:
        if _session is None:
            _session = Session()
        return _session


def reset():
    global _session
    with _lock:
        if _session is not None:
            _session.close()
        _session = None


# 模块级快捷方式: 少数场景不需要显式拿 session
def get(url, **kw):
    return session().get(url, **kw)


def head(url, **kw):
    return session().head(url, **kw)


def post(url, **kw):
    return session().post(url, **kw)
