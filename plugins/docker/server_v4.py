#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docker 插件后端(接口库 v4) — 由 v3 server.py 迁移。

容器/镜像/卷/网络/日志/启停/创建/Compose/资源清理。
命令统一走 subprocess(list), 不做 shell 拼接; 输出统一 JSON。
daemon 未就绪时接口返回 RCError(3000, ...), 前端可提示一键启动。
"""
import json
import os
import shutil
import subprocess
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc

DOCKER = shutil.which('docker') or '/usr/bin/docker'
COMPOSE = shutil.which('docker-compose') or shutil.which('compose') or None


def _run(args, timeout=120):
    try:
        return subprocess.run([DOCKER] + args, capture_output=True, text=True, timeout=timeout)
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


def _p(params):
    return params if isinstance(params, dict) else {}


def _need(params, key, msg):
    v = str(_p(params).get(key, '')).strip()
    if not v:
        raise rc.RCError(3000, msg)
    return v


def _daemon_or_err(what='docker daemon 未就绪'):
    data, err = _daemon_ok()
    if data is None:
        raise rc.RCError(3000, '%s: %s' % (what, err or 'unknown'))
    return data


# ---- 接口实现(路由逐一对齐) ----

@rc.interface("docker.env")
def docker_env(params):
    return {'docker': bool(DOCKER), 'docker_tool': DOCKER,
            'compose': bool(COMPOSE), 'compose_tool': COMPOSE,
            'group': 'docker' in _getgroups(),
            'version': _docker_version()}


@rc.interface("docker.info")
def docker_info(params):
    data = _daemon_or_err()
    return {'server_version': data.get('ServerVersion'), 'os': data.get('OperatingSystem'),
            'arch': data.get('Architecture'), 'kernel': data.get('KernelVersion'),
            'drivers': data.get('Driver'), 'root_dir': data.get('DockerRootDir'),
            'cpus': data.get('NCPU'), 'mem': data.get('MemTotal'),
            'images': data.get('Images'), 'containers': data.get('Containers'),
            'containers_running': data.get('ContainersRunning'),
            'containers_paused': data.get('ContainersPaused'),
            'containers_stopped': data.get('ContainersStopped')}


@rc.interface("docker.status")
def docker_status(params):
    data = _daemon_or_err()
    df, derr = _j(['system', 'df', '--format', '{{json .}}'])
    disk = {}
    if derr is None and isinstance(df, list) and df:
        disk = {'total': df[0].get('TotalCount'), 'active': df[0].get('ActiveCount')}
    return {'version': data.get('ServerVersion'), 'images': data.get('Images'),
            'running': data.get('ContainersRunning'), 'paused': data.get('ContainersPaused'),
            'stopped': data.get('ContainersStopped'), 'disk': disk}


@rc.interface("docker.containers.list")
def containers_list(params):
    data, err = _many(['ps', '-a', '--format', '{{json .}}'])
    if data is None:
        raise rc.RCError(3000, str(err))
    return {'containers': [_ctr_summary(c) for c in data]}


@rc.interface("docker.containers.start")
def containers_start(params):
    cid = _need(params, 'id', '缺少 id')
    r = _ok(['start', cid])
    return {'ok': r['ok'], 'error': r.get('error', '')}


@rc.interface("docker.containers.stop")
def containers_stop(params):
    cid = _need(params, 'id', '缺少 id')
    t = str(_p(params).get('timeout', 10) or 10)
    r = _ok(['stop', '-t', t, cid])
    return {'ok': r['ok'], 'error': r.get('error', '')}


@rc.interface("docker.containers.restart")
def containers_restart(params):
    cid = _need(params, 'id', '缺少 id')
    r = _ok(['restart', cid])
    return {'ok': r['ok'], 'error': r.get('error', '')}


@rc.interface("docker.containers.remove")
def containers_remove(params):
    cid = _need(params, 'id', '缺少 id')
    args = ['rm']
    data = _p(params)
    if data.get('force'):
        args.append('-f')
    if data.get('volumes'):
        args.append('-v')
    args.append(cid)
    r = _ok(args)
    return {'ok': r['ok'], 'error': r.get('error', '')}


@rc.interface("docker.containers.logs")
def containers_logs(params):
    cid = _need(params, 'id', '缺少 id')
    try:
        tail = max(10, min(int(_p(params).get('tail', 200) or 200), 5000))
    except (TypeError, ValueError):
        tail = 200
    r = _ok(['logs', '--tail', str(tail), '-t', cid], timeout=60)
    return {'ok': r['ok'], 'log': r.get('out', ''), 'error': r.get('error', '')}


@rc.interface("docker.containers.stats")
def containers_stats(params):
    cid = _need(params, 'id', '缺少 id')
    r = _ok(['stats', '--no-stream', '--format', '{{json .}}', cid], timeout=60)
    if not r['ok']:
        return {'ok': False, 'error': r.get('error', '')}
    rows = _lines(r['out'])
    if not rows:
        return {'ok': False, 'error': '无统计'}
    d = rows[0]
    return {'ok': True, 'cpu': d.get('CPUPerc', ''), 'mem': d.get('MemUsage', ''),
            'net': d.get('NetIO', ''), 'block': d.get('BlockIO', '')}


@rc.interface("docker.containers.create")
def containers_create(params):
    data = _p(params)
    image = str(data.get('image', '')).strip()
    if not image:
        raise rc.RCError(3000, '缺少镜像')
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
    return {'ok': r['ok'], 'id': r.get('out', '')[:24], 'error': r.get('error', '')}


@rc.interface("docker.images.list")
def images_list(params):
    data, err = _many(['images', '--format', '{{json .}}'])
    if data is None:
        raise rc.RCError(3000, str(err))
    return {'images': [_img_summary(i) for i in data]}


@rc.interface("docker.images.pull")
def images_pull(params):
    name = _need(params, 'name', '缺少镜像名')

    def _work():
        r = _ok(['pull', name], timeout=1800)
        try:
            print('[docker] pull %s rc=%s %s' % (name, r['ok'], (r.get('error') or '')[:120]))
        except Exception:
            pass

    threading.Thread(target=_work, daemon=True).start()
    return {'ok': True, 'message': '拉取中(后台), 稍后刷新镜像列表'}


@rc.interface("docker.images.remove")
def images_remove(params):
    iid = _need(params, 'id', '缺少 id')
    args = ['rmi']
    if _p(params).get('force'):
        args.append('-f')
    args.append(iid)
    r = _ok(args)
    return {'ok': r['ok'], 'error': r.get('error', '')}


@rc.interface("docker.networks.list")
def networks_list(params):
    data, err = _many(['network', 'ls', '--format', '{{json .}}'])
    if data is None:
        raise rc.RCError(3000, str(err))
    return {'networks': [{'id': (n.get('ID') or '')[:12], 'name': n.get('Name') or '',
                          'driver': n.get('Driver') or '', 'scope': n.get('Scope') or ''} for n in data]}


@rc.interface("docker.volumes.list")
def volumes_list(params):
    data, err = _many(['volume', 'ls', '--format', '{{json .}}'])
    if data is None:
        raise rc.RCError(3000, str(err))
    return {'volumes': [{'name': v.get('Name') or '', 'driver': v.get('Driver') or ''} for v in data]}


@rc.interface("docker.volume.remove")
def volume_remove(params):
    vname = _need(params, 'name', '缺少卷名')
    r = _ok(['volume', 'rm', vname])
    return {'ok': r['ok'], 'error': r.get('error', '')}


@rc.interface("docker.system.prune")
def system_prune(params):
    data = _p(params)
    args = ['system', 'prune', '-f']
    if data.get('all'):
        args.append('-a')
    if data.get('volumes'):
        args.append('--volumes')
    r = _ok(args, timeout=600)
    return {'ok': r['ok'], 'out': r.get('out', ''), 'error': r.get('error', '')}


def _compose_args(params):
    path = str(_p(params).get('path', '')).strip()
    if not path or not os.path.isdir(path):
        raise rc.RCError(3000, '需要有效项目目录 path')
    return path


@rc.interface("docker.compose.up")
def compose_up(params):
    if not COMPOSE:
        raise rc.RCError(3000, '未安装 docker compose')
    path = _compose_args(params)
    try:
        r = subprocess.run([COMPOSE, '-f', os.path.join(path, 'docker-compose.yml'), 'up', '-d'],
                           capture_output=True, text=True, timeout=600, cwd=path)
        return {'ok': r.returncode == 0, 'out': (r.stdout or '')[-600:], 'error': (r.stderr or '')[-400:]}
    except Exception as ex:
        raise rc.RCError(3000, str(ex))


@rc.interface("docker.compose.down")
def compose_down(params):
    if not COMPOSE:
        raise rc.RCError(3000, '未安装 docker compose')
    path = _compose_args(params)
    try:
        r = subprocess.run([COMPOSE, '-f', os.path.join(path, 'docker-compose.yml'), 'down'],
                           capture_output=True, text=True, timeout=600, cwd=path)
        return {'ok': r.returncode == 0, 'out': (r.stdout or '')[-600:], 'error': (r.stderr or '')[-400:]}
    except Exception as ex:
        raise rc.RCError(3000, str(ex))


@rc.interface("docker.compose.ps")
def compose_ps(params):
    path = _compose_args(params)
    r = _ok(['compose', '-f', os.path.join(path, 'docker-compose.yml'), 'ps'], timeout=120)
    if not r['ok']:
        r2 = subprocess.run([COMPOSE, '-f', os.path.join(path, 'docker-compose.yml'), 'ps'],
                            capture_output=True, text=True, timeout=120, cwd=path)
        return {'ok': r2.returncode == 0, 'out': (r2.stdout or '')[-800:]}
    return {'ok': True, 'out': r['out'][-800:]}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="docker",
        version="2.0.0",
        manifest={"label": "Docker 管理", "description": "容器/镜像/卷/网络/Compose 管理"},
        frontend={"pages": [{"path": "", "title": "容器管理"}]},
        iface_ids=[
            "docker.env", "docker.info", "docker.status",
            "docker.containers.list", "docker.containers.start", "docker.containers.stop",
            "docker.containers.restart", "docker.containers.remove", "docker.containers.logs",
            "docker.containers.stats", "docker.containers.create",
            "docker.images.list", "docker.images.pull", "docker.images.remove",
            "docker.networks.list", "docker.volumes.list", "docker.volume.remove",
            "docker.system.prune", "docker.compose.up", "docker.compose.down", "docker.compose.ps",
        ],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )