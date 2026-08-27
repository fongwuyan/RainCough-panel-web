#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docker 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

容器/镜像/卷/网络/日志/启停/创建/Compose/资源清理。
命令统一走 subprocess(list), 不做 shell 拼接; 输出统一 JSON。
daemon 未启动时 /info 等返回明确的 503 状态与提示, 前端可一键启动。
路由契约与旧面板 api.js 完全一致(env/info/status/containers*/images*/networks/volumes/
volume/remove/system/prune/compose/*)。
注意: /info 是旧插件的功能路由(docker daemon 信息), 新前端 dkInfo() 依赖它, 予以保留。
"""
import json
import os
import shutil
import subprocess
import threading
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

DOCKER = shutil.which('docker') or '/usr/bin/docker'
COMPOSE = shutil.which('docker-compose') or shutil.which('compose') or None


def _run(args, timeout=120):
    try:
        r = subprocess.run([DOCKER] + args, capture_output=True, text=True, timeout=timeout)
        return r
    except subprocess.TimeoutExpired:
        return None


def _ok(args, timeout=120):
    r = _run(args, timeout)
    if r is None:
        return {'ok': False, 'error': 'docker 命令超时'}
    if r.returncode != 0:
        return {'ok': False, 'error': (r.stderr or r.stdout or '').strip()[-500:]}
    return {'ok': True, 'out': r.stdout.strip()}


def _j(args, timeout=120):
    r = _ok(args, timeout)
    if not r['ok']:
        return None, r['error']
    try:
        return json.loads(r['out'] or 'null'), None
    except Exception:
        return None, 'docker 输出非 JSON'


def _many(args, timeout=120):
    r = _ok(args, timeout)
    if not r['ok']:
        return None, r['error']
    return _lines(r['out']), None


def _lines(text):
    out = []
    for line in (text or '').splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except Exception:
            pass
    return out


def _ctr_summary(c):
    names = (c.get('Names') or '').replace('/', '')
    ports = [p.strip() for p in (c.get('Ports') or '').split(',') if p.strip() and p.strip() != 'Ports']
    return {
        'id': (c.get('ID') or '')[:12],
        'name': (names.split(',')[0] if names else ''),
        'image': c.get('Image') or '',
        'status': c.get('Status') or '',
        'state': c.get('State') or '',
        'ports': ports,
        'command': c.get('Command') or '',
        'created': c.get('CreatedAt') or '',
    }


def _img_summary(i):
    tags = (i.get('RepoTags') or [])
    if tags == ['<none>:<none>']:
        tags = []
    return {
        'id': (i.get('ID') or '').replace('sha256:', '')[:12],
        'tags': tags,
        'size': i.get('Size') or 0,
        'created': i.get('CreatedSince') or i.get('CreatedAt') or '',
    }


def _getgroups():
    """os.getgroups() 仅 POSIX; Windows 上不存在, 返回空。"""
    try:
        return os.getgroups() or []
    except Exception:
        return []


def _daemon_ok():
    return _j(['info', '--format', '{{json .}}'])


def _docker_version():
    try:
        if shutil.which('docker'):
            return os.popen('docker --version 2>/dev/null').read().strip() or ''
    except Exception:
        pass
    return ''


def _err(msg, code=500):
    return code, {'error': msg}


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "docker/2.0"

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

    def _json_body(self):
        try:
            return json.loads(self._body() or b'{}')
        except Exception:
            return {}

    # ---- 路由: GET /env ----
    def _rt_env(self):
        return 200, {
            'docker': bool(DOCKER), 'docker_tool': DOCKER,
            'compose': bool(COMPOSE), 'compose_tool': COMPOSE,
            'group': 'docker' in _getgroups(),
            'version': _docker_version(),
        }

    # ---- 路由: GET /info (docker daemon 信息, 新前端 dkInfo 依赖) ----
    def _rt_info(self):
        data, err = _daemon_ok()
        if data is None:
            return _err('docker daemon 未就绪: %s' % (err or 'unknown'), 503)
        return 200, {
            'server_version': data.get('ServerVersion'),
            'os': data.get('OperatingSystem'),
            'arch': data.get('Architecture'),
            'kernel': data.get('KernelVersion'),
            'drivers': data.get('Driver'),
            'root_dir': data.get('DockerRootDir'),
            'cpus': data.get('NCPU'),
            'mem': data.get('MemTotal'),
            'images': data.get('Images'),
            'containers': data.get('Containers'),
            'containers_running': data.get('ContainersRunning'),
            'containers_paused': data.get('ContainersPaused'),
            'containers_stopped': data.get('ContainersStopped'),
        }

    # ---- 路由: GET /status ----
    def _rt_status(self):
        data, err = _daemon_ok()
        if data is None:
            return _err('docker daemon 未就绪', 503)
        df, derr = _j(['system', 'df', '--format', '{{json .}}'])
        disk = {}
        if derr is None and isinstance(df, list) and df:
            disk = {'total': df[0].get('TotalCount'), 'active': df[0].get('ActiveCount')}
        return 200, {
            'version': data.get('ServerVersion'),
            'images': data.get('Images'),
            'running': data.get('ContainersRunning'),
            'paused': data.get('ContainersPaused'),
            'stopped': data.get('ContainersStopped'),
            'disk': disk,
        }

    # ---- 路由: GET /containers ----
    def _rt_containers(self):
        data, err = _many(['ps', '-a', '--format', '{{json .}}'])
        if data is None:
            return _err(str(err), 503)
        return 200, [_ctr_summary(c) for c in data]

    def _by_id(self, body):
        data = body or {}
        cid = str(data.get('id') or data.get('name') or '').strip()
        if not cid:
            return None, '缺少 id', data
        return cid, '', data

    # ---- 路由: POST /containers/start ----
    def _rt_c_start(self, body):
        cid, e, _ = self._by_id(body)
        if e:
            return _err(e, 400)
        r = _ok(['start', cid])
        return 200, {'ok': r['ok'], 'error': r.get('error', '')}

    # ---- 路由: POST /containers/stop ----
    def _rt_c_stop(self, body):
        cid, e, data = self._by_id(body)
        if e:
            return _err(e, 400)
        t = str(data.get('timeout', 10) or 10)
        r = _ok(['stop', '-t', t, cid])
        return 200, {'ok': r['ok'], 'error': r.get('error', '')}

    # ---- 路由: POST /containers/restart ----
    def _rt_c_restart(self, body):
        cid, e, _ = self._by_id(body)
        if e:
            return _err(e, 400)
        r = _ok(['restart', cid])
        return 200, {'ok': r['ok'], 'error': r.get('error', '')}

    # ---- 路由: POST /containers/remove ----
    def _rt_c_remove(self, body):
        cid, e, data = self._by_id(body)
        if e:
            return _err(e, 400)
        args = ['rm']
        if data.get('force'):
            args.append('-f')
        if data.get('volumes'):
            args.append('-v')
        args.append(cid)
        r = _ok(args)
        return 200, {'ok': r['ok'], 'error': r.get('error', '')}

    # ---- 路由: GET /containers/logs ----
    def _rt_c_logs(self, q):
        cid = q.get('id', '').strip()
        if not cid:
            return _err('缺少 id', 400)
        try:
            tail = max(10, min(int(q.get('tail', 200) or 200), 5000))
        except (TypeError, ValueError):
            tail = 200
        r = _ok(['logs', '--tail', str(tail), '-t', cid], timeout=60)
        return 200, {'ok': r['ok'], 'log': r.get('out', ''), 'error': r.get('error', '')}

    # ---- 路由: GET /containers/stats ----
    def _rt_c_stats(self, q):
        cid = q.get('id', '').strip()
        if not cid:
            return _err('缺少 id', 400)
        r = _ok(['stats', '--no-stream', '--format', '{{json .}}', cid], timeout=60)
        if not r['ok']:
            return 200, {'ok': False, 'error': r.get('error', '')}
        rows = _lines(r['out'])
        if not rows:
            return 200, {'ok': False, 'error': '无统计'}
        d = rows[0]
        return 200, {'ok': True, 'cpu': d.get('CPUPerc', ''), 'mem': d.get('MemUsage', ''),
                     'net': d.get('NetIO', ''), 'block': d.get('BlockIO', '')}

    # ---- 路由: POST /containers/create ----
    def _rt_c_create(self, body):
        data = body or {}
        image = str(data.get('image', '')).strip()
        if not image:
            return _err('缺少镜像', 400)
        args = ['run', '-d']
        name = str(data.get('name', '')).strip()
        if name:
            args += ['--name', name]
        if data.get('restart'):
            args += ['--restart', str(data['restart'])]
        if data.get('network'):
            args += ['--network', str(data['network'])]
        for p in (data.get('ports') or []):
            if str(p).strip():
                args += ['-p', str(p).strip()]
        for e in (data.get('env') or []):
            if str(e).strip():
                args += ['-e', str(e).strip()]
        for v in (data.get('volumes') or []):
            if str(v).strip():
                args += ['-v', str(v).strip()]
        args.append(image)
        args += [str(x) for x in (data.get('cmd') or [])]
        r = _ok(args, timeout=300)
        return 200, {'ok': r['ok'], 'id': r.get('out', '')[:24], 'error': r.get('error', '')}

    # ---- 路由: GET /images ----
    def _rt_images(self):
        data, err = _many(['images', '--format', '{{json .}}'])
        if data is None:
            return _err(str(err), 503)
        return 200, [_img_summary(i) for i in data]

    # ---- 路由: POST /images/pull ----
    def _rt_pull(self, body):
        data = body or {}
        name = str(data.get('name', '')).strip()
        if not name:
            return _err('缺少镜像名', 400)

        def _work():
            r = _ok(['pull', name], timeout=1800)
            try:
                print('[docker] pull %s rc=%s %s' % (name, r['ok'], (r.get('error') or '')[:120]))
            except Exception:
                pass

        threading.Thread(target=_work, daemon=True).start()
        return 200, {'ok': True, 'message': '拉取中(后台), 稍后刷新镜像列表'}

    # ---- 路由: POST /images/remove ----
    def _rt_remove_image(self, body):
        data = body or {}
        iid = str(data.get('id', '')).strip()
        if not iid:
            return _err('缺少 id', 400)
        args = ['rmi']
        if data.get('force'):
            args.append('-f')
        args.append(iid)
        r = _ok(args)
        return 200, {'ok': r['ok'], 'error': r.get('error', '')}

    # ---- 路由: GET /networks ----
    def _rt_networks(self):
        data, err = _many(['network', 'ls', '--format', '{{json .}}'])
        if data is None:
            return _err(str(err), 503)
        items = data
        return 200, [{'id': (n.get('ID') or '')[:12], 'name': n.get('Name') or '',
                      'driver': n.get('Driver') or '', 'scope': n.get('Scope') or ''} for n in items]

    # ---- 路由: GET /volumes ----
    def _rt_volumes(self):
        data, err = _many(['volume', 'ls', '--format', '{{json .}}'])
        if data is None:
            return _err(str(err), 503)
        return 200, [{'name': v.get('Name') or '', 'driver': v.get('Driver') or ''} for v in data]

    # ---- 路由: POST /volume/remove ----
    def _rt_volume_remove(self, body):
        data = body or {}
        vname = str(data.get('name', '')).strip()
        if not vname:
            return _err('缺少卷名', 400)
        r = _ok(['volume', 'rm', vname])
        return 200, {'ok': r['ok'], 'error': r.get('error', '')}

    # ---- 路由: POST /system/prune ----
    def _rt_prune(self, body):
        data = body or {}
        args = ['system', 'prune', '-f']
        if data.get('all'):
            args.append('-a')
        if data.get('volumes'):
            args.append('--volumes')
        r = _ok(args, timeout=600)
        return 200, {'ok': r['ok'], 'out': r.get('out', ''), 'error': r.get('error', '')}

    # ---- 路由: POST /compose/up ----
    def _rt_compose_up(self, body):
        if not COMPOSE:
            return _err('未安装 docker compose', 400)
        data = body or {}
        path = str(data.get('path', '')).strip()
        if not path or not os.path.isdir(path):
            return _err('需要有效项目目录 path', 400)
        try:
            r = subprocess.run([COMPOSE, '-f', os.path.join(path, 'docker-compose.yml'), 'up', '-d'],
                               capture_output=True, text=True, timeout=600, cwd=path)
            ok = r.returncode == 0
            return 200, {'ok': ok, 'out': (r.stdout or '')[-600:], 'error': (r.stderr or '')[-400:]}
        except Exception as ex:
            return _err(str(ex), 500)

    # ---- 路由: POST /compose/down ----
    def _rt_compose_down(self, body):
        if not COMPOSE:
            return _err('未安装 docker compose', 400)
        data = body or {}
        path = str(data.get('path', '')).strip()
        if not path or not os.path.isdir(path):
            return _err('需要有效项目目录 path', 400)
        try:
            r = subprocess.run([COMPOSE, '-f', os.path.join(path, 'docker-compose.yml'), 'down'],
                               capture_output=True, text=True, timeout=600, cwd=path)
            return 200, {'ok': r.returncode == 0, 'out': (r.stdout or '')[-600:], 'error': (r.stderr or '')[-400:]}
        except Exception as ex:
            return _err(str(ex), 500)

    # ---- 路由: POST /compose/ps ----
    def _rt_compose_ps(self, body):
        data = body or {}
        path = str(data.get('path', '')).strip()
        if not path or not os.path.isdir(path):
            return _err('需要有效项目目录 path', 400)
        r = _ok(['compose', '-f', os.path.join(path, 'docker-compose.yml'), 'ps'], timeout=120)
        if not r['ok']:
            r2 = subprocess.run([COMPOSE, '-f', os.path.join(path, 'docker-compose.yml'), 'ps'],
                                capture_output=True, text=True, timeout=120, cwd=path)
            return 200, {'ok': r2.returncode == 0, 'out': (r2.stdout or '')[-800:]}
        return 200, {'ok': True, 'out': r['out'][-800:]}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/env":
                return self._json(*self._rt_env())
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/status":
                return self._json(*self._rt_status())
            if p == "/containers/logs":
                return self._json(*self._rt_c_logs(q))
            if p == "/containers/stats":
                return self._json(*self._rt_c_stats(q))
            if p == "/containers":
                return self._json(*self._rt_containers())
            if p == "/images":
                return self._json(*self._rt_images())
            if p == "/networks":
                return self._json(*self._rt_networks())
            if p == "/volumes":
                return self._json(*self._rt_volumes())
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            body = self._json_body()
            if p == "/containers/start":
                return self._json(*self._rt_c_start(body))
            if p == "/containers/stop":
                return self._json(*self._rt_c_stop(body))
            if p == "/containers/restart":
                return self._json(*self._rt_c_restart(body))
            if p == "/containers/remove":
                return self._json(*self._rt_c_remove(body))
            if p == "/containers/create":
                return self._json(*self._rt_c_create(body))
            if p == "/images/pull":
                return self._json(*self._rt_pull(body))
            if p == "/images/remove":
                return self._json(*self._rt_remove_image(body))
            if p == "/volume/remove":
                return self._json(*self._rt_volume_remove(body))
            if p == "/system/prune":
                return self._json(*self._rt_prune(body))
            if p == "/compose/up":
                return self._json(*self._rt_compose_up(body))
            if p == "/compose/down":
                return self._json(*self._rt_compose_down(body))
            if p == "/compose/ps":
                return self._json(*self._rt_compose_ps(body))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("docker ready on %d (docker=%s compose=%s)" % (PORT, DOCKER, COMPOSE), file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()