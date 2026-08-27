#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""uptime 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

数据: 插件目录下 data/uptime.json(磁盘 JSON, 与旧插件一致)
功能: 站点探活监控, 定时检测 HTTP 目标在线状态、响应时间与可用率。
路由契约与旧面板一致(targets/create/update/delete/test/history/status24, status, info)。
"""
import os
import json
import time
import threading
import requests
import http.server


PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())
DATA_DIR = os.path.join(PLUGIN_DIR, 'data')
STORE_FILE = os.path.join(DATA_DIR, 'uptime.json')

HISTORY_LIMIT = 2880
TICK_SECONDS = 2

_lock = threading.RLock()
_loaded = False
_targets = {}


def _load():
    global _targets, _loaded
    with _lock:
        if _loaded:
            return _targets
        _loaded = True
        if os.path.isfile(STORE_FILE):
            try:
                with open(STORE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                _targets = data if isinstance(data, dict) else {}
            except Exception:
                _targets = {}
        else:
            _targets = {}
        return _targets


def _save():
    with _lock:
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(STORE_FILE, 'w', encoding='utf-8') as f:
                json.dump(_targets, f, ensure_ascii=False, indent=2)
        except Exception:
            pass


def _window_uptime(name):
    t = _targets.get(name)
    if not t:
        return None
    history = t.get('history', [])
    if not history:
        return None
    cutoff = time.time() - 86400
    recent = [h for h in history if h.get('ts', 0) >= cutoff]
    if not recent:
        return None
    ok = sum(1 for h in recent if h.get('ok'))
    return round(ok * 100.0 / len(recent), 1)


def _probe(name):
    t = _targets.get(name)
    if not t:
        return None
    method = t.get('method', 'GET')
    timeout = float(t.get('timeout', 10))
    expected = int(t.get('expected_status', 200))
    start = time.time()
    try:
        r = requests.request(method, t['url'], timeout=timeout,
                             allow_redirects=True,
                             headers={'User-Agent': 'uptime-monitor/1.0'})
        ok = r.status_code == expected
        ms = round((time.time() - start) * 1000)
    except Exception:
        ok = False
        ms = round((time.time() - start) * 1000)
    now = time.time()
    with _lock:
        t = _targets.get(name)
        if t:
            hist = t.setdefault('history', [])
            hist.append({'ts': int(now), 'ok': ok, 'ms': ms})
            if len(hist) > HISTORY_LIMIT:
                del hist[:len(hist) - HISTORY_LIMIT]
            t['last_check'] = int(now)
            t['last_ms'] = ms
            t['last_ok'] = ok
            if ok:
                t['last_up'] = int(now)
            else:
                t['last_down'] = int(now)
            t['uptime'] = _window_uptime(name)
        _save()
    return ok, ms


def _checker_loop():
    while True:
        time.sleep(TICK_SECONDS)
        now = time.time()
        targets = dict(_targets)
        for name, t in targets.items():
            interval = max(int(t.get('interval', 60)), 5)
            last = t.get('last_check', 0)
            if now - last >= interval:
                try:
                    _probe(name)
                except Exception:
                    pass


def _sanitize(name):
    t = _targets.get(name)
    if not t:
        return None
    return {
        'name': name,
        'url': t.get('url', ''),
        'method': t.get('method', 'GET'),
        'timeout': t.get('timeout', 10),
        'interval': t.get('interval', 60),
        'expected_status': t.get('expected_status', 200),
        'last_check': t.get('last_check'),
        'last_ms': t.get('last_ms'),
        'last_ok': t.get('last_ok'),
        'last_up': t.get('last_up'),
        'last_down': t.get('last_down'),
        'uptime': t.get('uptime'),
        'history_count': len(t.get('history', [])),
    }


def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "uptime/2.0"

    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def _q(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    # ---- 路由: GET /targets ----
    def _rt_targets(self):
        _load()
        result = [_sanitize(n) for n in _targets]
        result.sort(key=lambda x: x['name'])
        return 200, result

    # ---- 路由: POST /targets/create ----
    def _rt_create(self, body):
        data = body or {}
        name = str(data.get('name', '')).strip()
        url = str(data.get('url', '')).strip()
        if not name or not url:
            return 400, {'error': 'name 与 url 必填'}
        _load()
        if name in _targets:
            return 400, {'error': '目标已存在'}
        if not url.startswith(('http://', 'https://')):
            return 400, {'error': 'url 需以 http(s):// 开头'}
        try:
            timeout = int(data.get('timeout', 10))
            interval = int(data.get('interval', 60))
            expected = int(data.get('expected_status', 200))
        except (TypeError, ValueError):
            return 400, {'error': 'timeout/interval/expected_status 需为数字'}
        if interval < 5:
            interval = 5
        method = str(data.get('method', 'GET')).upper()
        if method not in ('GET', 'HEAD'):
            method = 'GET'
        with _lock:
            _targets[name] = {
                'url': url,
                'method': method,
                'timeout': timeout,
                'interval': interval,
                'expected_status': expected,
                'history': [],
                'created': int(time.time()),
            }
            _save()
        return 200, _sanitize(name)

    # ---- 路由: POST /targets/update ----
    def _rt_update(self, body):
        data = body or {}
        name = str(data.get('name', '')).strip()
        _load()
        if name not in _targets:
            return 404, {'error': '目标不存在'}
        t = _targets[name]
        url = str(data.get('url', '')).strip()
        if url:
            if not url.startswith(('http://', 'https://')):
                return 400, {'error': 'url 需以 http(s):// 开头'}
            t['url'] = url
        if data.get('method'):
            method = str(data['method']).upper()
            if method in ('GET', 'HEAD'):
                t['method'] = method
        for key in ('timeout', 'interval', 'expected_status'):
            if key in data and data[key] not in (None, ''):
                try:
                    val = int(data[key])
                except (TypeError, ValueError):
                    return 400, {'error': '%s 需为数字' % key}
                if key == 'interval' and val < 5:
                    val = 5
                t[key] = val
        with _lock:
            _save()
        return 200, _sanitize(name)

    # ---- 路由: POST /targets/delete ----
    def _rt_delete(self, body):
        data = body or {}
        name = str(data.get('name', '')).strip()
        _load()
        if name not in _targets:
            return 404, {'error': '目标不存在'}
        with _lock:
            del _targets[name]
            _save()
        return 200, {'ok': True}

    # ---- 路由: POST /targets/test ----
    def _rt_test(self, body):
        data = body or {}
        name = str(data.get('name', '')).strip()
        _load()
        if name not in _targets:
            return 404, {'error': '目标不存在'}
        t = _targets[name]
        try:
            r = requests.request(t.get('method', 'GET'), t['url'],
                                 timeout=float(t.get('timeout', 10)),
                                 allow_redirects=True,
                                 headers={'User-Agent': 'uptime-monitor/1.0'})
            ok = r.status_code == int(t.get('expected_status', 200))
            ms = int(r.elapsed.total_seconds() * 1000)
            code = r.status_code
        except requests.exceptions.Timeout:
            return 200, {'name': name, 'ok': False, 'ms': int(t.get('timeout', 10) * 1000), 'error': '连接超时'}
        except Exception as e:
            return 200, {'name': name, 'ok': False, 'ms': 0, 'error': str(e)}
        return 200, {'name': name, 'ok': ok, 'ms': ms, 'status_code': code,
                     'expected': int(t.get('expected_status', 200))}

    # ---- 路由: GET /targets/history ----
    def _rt_history(self, q):
        name = q.get('name', '')
        _load()
        t = _targets.get(name)
        if not t:
            return 200, []
        return 200, t.get('history', [])

    # ---- 路由: GET /targets/status24 ----
    def _rt_status24(self, q):
        name = q.get('name', '')
        _load()
        t = _targets.get(name)
        if not t:
            return 200, []
        hist = t.get('history', [])
        bucket = 300
        buckets = 288
        now = int(time.time())
        start = now - buckets * bucket
        cells = [None] * buckets
        prev = None
        for h in hist:
            ts = h.get('ts', 0)
            if ts < start:
                continue
            idx = (ts - start) // bucket
            if 0 <= idx < buckets:
                ok = 1 if h.get('ok') else 0
                cells[idx] = ok
                prev = ok
        result = []
        for c in cells:
            if c is None:
                c = prev
            result.append(c)
        return 200, result

    # ---- 路由: GET /status ----
    def _rt_status(self):
        _load()
        total = len(_targets)
        online = sum(1 for n in _targets if _targets[n].get('last_ok'))
        offline = total - online
        u = [t.get('uptime') for t in _targets.values() if t.get('uptime') is not None]
        avg = round(sum(u) / len(u), 1) if u else None
        return 200, {'total': total, 'online': online, 'offline': offline,
                     'avg_uptime': avg}

    # ---- 路由: GET /info ----
    def _rt_info(self):
        return 200, {'name': 'uptime', 'label': 'Uptime 监控', 'version': '2.0.0',
                     'lang': 'python',
                     'description': '站点探活监控：定时检测 HTTP 目标在线状态、响应时间与可用率'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/targets":
                return self._json(*self._rt_targets())
            if p == "/targets/history":
                return self._json(*self._rt_history(q))
            if p == "/targets/status24":
                return self._json(*self._rt_status24(q))
            if p == "/status":
                return self._json(*self._rt_status())
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            try:
                body = json.loads(self._body() or b'{}')
            except Exception:
                body = {}
            if p == "/targets/create":
                return self._json(*self._rt_create(body))
            if p == "/targets/update":
                return self._json(*self._rt_update(body))
            if p == "/targets/delete":
                return self._json(*self._rt_delete(body))
            if p == "/targets/test":
                return self._json(*self._rt_test(body))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    _load()
    threading.Thread(target=_checker_loop, daemon=True).start()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("uptime ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()