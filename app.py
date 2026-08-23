import os
import re
import sys
import json
import base64
import secrets
import zipfile
import tempfile
import shutil
import importlib.util
from flask import Flask, send_from_directory, jsonify, request
from plugins.base import PluginManager, Plugin
from plugins.converter import convert_java_plugin, is_java_plugin
from filemanager import fm
from terminal import tm
from system import sys as sys_api
from media import media
from scheduler import scheduler_api, init_scheduler
from envpkg import envpkg
from store import store as store_bp, init_store
from tasks import _make_blueprint as tasks_blueprint, register_all as tasks_register_all

app = Flask(__name__, static_folder='public')
# 上传体积上限: 100GB (前端分块上传 8MB/片; 提升以支持超大文件, 旧接口单请求也放行)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024 * 1024

app.register_blueprint(fm)
app.register_blueprint(tm)
app.register_blueprint(sys_api)
app.register_blueprint(media)
app.register_blueprint(scheduler_api)
app.register_blueprint(envpkg)
app.register_blueprint(tasks_blueprint())
app.register_blueprint(store_bp)

PLUGINS_DIR = os.path.join(os.path.dirname(__file__), 'plugins')

manager = PluginManager()

init_store(manager, PLUGINS_DIR)

_net_last = {'ts': 0.0, 'sent': 0, 'recv': 0}
_net_iface_last = {}
# /api/system 结果缓存 1.5s(psutil 全量采集较贵, 前端高频轮询时显著降载)
_sys_cache = {'ts': 0.0, 'data': None}


def discover_plugins():
    for entry in os.listdir(PLUGINS_DIR):
        if entry == 'filemanager':
            continue
        plugin_dir = os.path.join(PLUGINS_DIR, entry)
        plugin_file = os.path.join(plugin_dir, 'plugin.py')
        if os.path.isfile(plugin_file) and entry != '__pycache__':
            try:
                spec = importlib.util.spec_from_file_location(
                    f'plugins.{entry}.plugin', plugin_file
                )
                mod = importlib.util.module_from_spec(spec)
                sys.modules[spec.name] = mod
                spec.loader.exec_module(mod)
                for attr in dir(mod):
                    cls = getattr(mod, attr)
                    if isinstance(cls, type) and cls.__name__ != 'Plugin' and issubclass(cls, Plugin):
                        name = getattr(cls, 'name', None)
                        if name and not manager.get_plugin(name):
                            instance = cls()
                            manager.register(instance)
                            print(f'[plugin] loaded: {instance.label}')
            except Exception as e:
                print(f'[plugin] failed to load {entry}: {e}')
        else:
            # 多语言插件: 目录内提供 plugin.json(无 plugin.py)时, 走桥接加载
            manifest_file = os.path.join(plugin_dir, 'plugin.json')
            if os.path.isfile(manifest_file) and entry != '__pycache__':
                try:
                    from plugins.bridge import BridgePlugin
                    with open(manifest_file, encoding='utf-8') as f:
                        manifest = json.load(f)
                    if not isinstance(manifest, dict) or not manifest.get('name'):
                        print(f'[plugin] invalid manifest {entry}')
                        continue
                    if manifest['name'] and not manager.get_plugin(manifest['name']):
                        instance = BridgePlugin(manifest, plugin_dir)
                        manager.register(instance)
                        print(f'[plugin] loaded(bridge): {instance.label} lang={manifest.get("lang","")} '
                              f'alive={instance.alive()}')
                except Exception as e:
                    print(f'[plugin] failed to load bridge {entry}: {e}')


discover_plugins()

init_scheduler(manager, app)
tasks_register_all()


# Serve plugin cache files (must be before the generic dispatch route)
@app.route('/api/plugins/<name>/cache/<path:filename>', methods=['GET'])
def plugin_cache(name, filename):
    cache_dir = os.path.join(PLUGINS_DIR, name, 'cache')
    if not os.path.isdir(cache_dir):
        return jsonify({'error': 'not found'}), 404
    return send_from_directory(cache_dir, filename)


# Serve plugin work-dir download files (toolchain plugins)
@app.route('/api/plugins/<name>/file/<session_id>/<path:filename>', methods=['GET'])
def plugin_file(name, session_id, filename):
    work_dir = os.path.join(PLUGINS_DIR, name, 'work', session_id)
    safe = os.path.basename(filename)
    if not os.path.isfile(os.path.join(work_dir, safe)):
        return jsonify({'error': '文件不存在或已过期'}), 404
    return send_from_directory(work_dir, safe, as_attachment=True, max_age=0)


# Plugin dispatch route (works with both static and dynamically added plugins)
@app.route('/api/plugins/<name>/settings', methods=['GET'])
def plugin_settings_get(name):
    """可插拔设置: 返回插件设置 schema 与当前值。"""
    plugin = manager.get_plugin(name)
    if not plugin:
        return jsonify({'error': 'plugin not found'}), 404
    try:
        return jsonify({'status': True, 'name': name,
                        'schema': plugin.get_setting_schema(),
                        'values': plugin.get_settings()})
    except Exception as e:
        return jsonify({'status': False, 'error': str(e)}), 500


@app.route('/api/plugins/<name>/settings', methods=['POST'])
def plugin_settings_set(name):
    """可插拔设置: 保存插件配置。"""
    plugin = manager.get_plugin(name)
    if not plugin:
        return jsonify({'error': 'plugin not found'}), 404
    data = request.get_json(silent=True) or {}
    try:
        ok, msg = plugin.save_settings(data)
        if not ok:
            return jsonify({'status': False, 'error': msg or '保存失败'}), 400
        return jsonify({'status': True, 'values': plugin.get_settings()})
    except Exception as e:
        return jsonify({'status': False, 'error': str(e)}), 500


@app.route('/api/plugins/<name>/<path:subpath>', methods=['GET', 'POST', 'DELETE'])
def plugin_dispatch(name, subpath):
    plugin = manager.get_plugin(name)
    if not plugin:
        return jsonify({'error': 'plugin not found'}), 404
    res = plugin.dispatch(subpath, request.method)
    # 兜底: 插件未注册 /info 路由时, 返回通用插件信息(与 /api/plugins/<name> 一致)
    if subpath == 'info' and isinstance(res, tuple) and len(res) == 2 and res[1] == 404:
        return jsonify(plugin.get_info())
    return res


@app.route('/api/plugins/<name>', methods=['GET'])
def plugin_info(name):
    plugin = manager.get_plugin(name)
    if not plugin:
        return jsonify({'error': 'plugin not found'}), 404
    return jsonify(plugin.get_info())


@app.route('/api/plugins')
def list_plugins():
    return jsonify(manager.list_plugins())


@app.route('/api/terminal/ws_token')
def terminal_ws_token():
    """返回 PHP 终端 WebSocket 服务的访问令牌。"""
    import secrets
    token_file = os.path.join(os.path.dirname(__file__), '.term_token')
    token = ''
    try:
        with open(token_file, 'r', encoding='utf-8') as f:
            token = f.read().strip()
    except OSError:
        pass
    if not token:
        token = secrets.token_urlsafe(24)
        try:
            with open(token_file, 'w', encoding='utf-8') as f:
                f.write(token)
            os.chmod(token_file, 0o600)
        except OSError:
            return jsonify({'error': '无法写入令牌文件'}), 500
    return jsonify({'token': token, 'port': 23080, 'host': request.host.split(':')[0]})


# ---------------------------------------------------------------------------
# 终端「保存服务器 / 常用命令」CRUD + 凭据 AES-256-GCM 落盘加密
# ---------------------------------------------------------------------------
_term_datadir = os.path.join(os.path.dirname(__file__), 'data')
_term_hosts = os.path.join(_term_datadir, 'terminal_hosts.json')
_term_cmds = os.path.join(_term_datadir, 'terminal_commands.json')
_SECRET_FIELDS = ('password', 'pkey', 'passphrase')


def _term_secret():
    sk = os.path.join(os.path.dirname(__file__), '.term_secret')
    if not os.path.exists(sk):
        with open(sk, 'wb') as f:
            f.write(secrets.token_bytes(32))
        os.chmod(sk, 0o600)
    with open(sk, 'rb') as f:
        return f.read()


def _gcm():
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    return AESGCM(_term_secret())


def _enc(s):
    if s is None or s == '':
        return ''
    nonce = secrets.token_bytes(12)
    ct = _gcm().encrypt(nonce, s.encode('utf-8'), None)
    return base64.b64encode(nonce + ct).decode('ascii')


def _dec(v):
    if not v:
        return ''
    try:
        raw = base64.b64decode(v)
        return _gcm().decrypt(raw[:12], raw[12:], None).decode('utf-8')
    except Exception:
        return ''


def _load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, encoding='utf-8') as f:
                d = json.load(f)
            if isinstance(d, list):
                return d
        except Exception:
            pass
    return default


def _save_json(path, data):
    os.makedirs(_term_datadir, exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)
    os.chmod(path, 0o600)


def _hosts_out(hosts):
    out = []
    for h in hosts:
        item = dict(h)
        for fld in _SECRET_FIELDS:
            if fld in item:
                item[fld] = _dec(item.get(fld, ''))
        out.append(item)
    return out


@app.route('/api/terminal/hosts', methods=['GET'])
def term_hosts_list():
    return jsonify(_hosts_out(_load_json(_term_hosts, [])))


@app.route('/api/terminal/hosts', methods=['POST'])
def term_hosts_create():
    b = request.get_json(silent=True) or {}
    host = (b.get('host') or '').strip()
    if not host:
        return jsonify({'error': '服务器IP不能为空'}), 400
    hosts = _load_json(_term_hosts, [])
    if any(h.get('host') == host for h in hosts):
        return jsonify({'error': '服务器已存在'}), 400
    item = {'host': host, 'port': str(b.get('port') or '22'),
            'username': (b.get('username') or '').strip(), 'ps': (b.get('ps') or '').strip()}
    for fld in _SECRET_FIELDS:
        item[fld] = _enc(b.get(fld, ''))
    hosts.append(item)
    _save_json(_term_hosts, hosts)
    return jsonify({'status': True, 'hosts': _hosts_out(hosts)})


@app.route('/api/terminal/hosts', methods=['PUT'])
def term_hosts_update():
    b = request.get_json(silent=True) or {}
    old = (b.get('old_host') or '').strip()
    host = (b.get('host') or '').strip()
    if not old:
        return jsonify({'error': '缺少服务器标识'}), 400
    hosts = _load_json(_term_hosts, [])
    found = next((h for h in hosts if h.get('host') == old), None)
    if found is None:
        return jsonify({'error': '服务器不存在'}), 404
    found['host'] = host
    # 仅更新请求中出现的字段, 缺失字段保持原值(避免部分更新误清数据)
    if 'port' in b:
        found['port'] = str(b.get('port') or '22')
    if 'username' in b:
        found['username'] = (b.get('username') or '').strip()
    if 'ps' in b:
        found['ps'] = (b.get('ps') or '').strip()
    for fld in _SECRET_FIELDS:
        if fld in b:
            v = b[fld]
            if v is None:
                # 显式 null => 清空该密钥字段
                found[fld] = _enc('')
            elif v:
                # 非空 => 更新(重新加密)
                found[fld] = _enc(str(v))
            # 空串 => 保留原加密值; 如需清空请传 null
    _save_json(_term_hosts, hosts)
    return jsonify({'status': True, 'hosts': _hosts_out(hosts)})


@app.route('/api/terminal/hosts', methods=['DELETE'])
def term_hosts_delete():
    host = (request.args.get('host') or '').strip()
    hosts = _load_json(_term_hosts, [])
    hosts = [h for h in hosts if h.get('host') != host]
    _save_json(_term_hosts, hosts)
    return jsonify({'status': True, 'hosts': _hosts_out(hosts)})


@app.route('/api/terminal/hosts/set_sort', methods=['POST'])
def term_hosts_sort():
    b = request.get_json(silent=True) or {}
    sort_list = b.get('sort_list') or {}
    hosts = _load_json(_term_hosts, [])
    for h in hosts:
        if h.get('host') in sort_list:
            h['sort'] = int(sort_list[h['host']])
    hosts.sort(key=lambda h: h.get('sort', 999))
    _save_json(_term_hosts, hosts)
    return jsonify({'status': True, 'hosts': _hosts_out(hosts)})


@app.route('/api/terminal/commands', methods=['GET'])
def term_cmds_list():
    return jsonify(_load_json(_term_cmds, []))


@app.route('/api/terminal/commands', methods=['POST'])
def term_cmds_create():
    b = request.get_json(silent=True) or {}
    title = (b.get('title') or '').strip()
    shell = (b.get('shell') or '').strip()
    if not title or not shell:
        return jsonify({'error': '命令名称与内容均不能为空'}), 400
    cmds = _load_json(_term_cmds, [])
    if any(c.get('title') == title for c in cmds):
        return jsonify({'error': '命令已存在'}), 400
    cmds.append({'title': title, 'shell': shell})
    _save_json(_term_cmds, cmds)
    return jsonify({'status': True, 'commands': cmds})


@app.route('/api/terminal/commands', methods=['PUT'])
def term_cmds_update():
    b = request.get_json(silent=True) or {}
    old = (b.get('old_title') or '').strip()
    title = (b.get('title') or '').strip()
    shell = (b.get('shell') or '').strip()
    cmds = _load_json(_term_cmds, [])
    found = next((c for c in cmds if c.get('title') == old), None)
    if found is None:
        return jsonify({'error': '命令不存在'}), 404
    found['title'] = title
    found['shell'] = shell
    _save_json(_term_cmds, cmds)
    return jsonify({'status': True, 'commands': cmds})


@app.route('/api/terminal/commands', methods=['DELETE'])
def term_cmds_delete():
    title = (request.args.get('title') or '').strip()
    cmds = [c for c in _load_json(_term_cmds, []) if c.get('title') != title]
    _save_json(_term_cmds, cmds)
    return jsonify({'status': True, 'commands': cmds})


@app.route('/api/system')
def system_info():
    import time  # 必须在缓存检查前引入, 避免 UnboundLocalError
    _now = time.time()
    if _sys_cache['data'] is not None and _now - _sys_cache['ts'] < 1.5:
        return jsonify(_sys_cache['data'])
    import platform
    import socket
    import psutil
    import time
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    try:
        disk = psutil.disk_usage(os.path.dirname(__file__))
    except Exception:
        disk = None

    def _disk_info(mount):
        try:
            u = psutil.disk_usage(mount)
            return {'mountpoint': mount, 'total': u.total, 'used': u.used,
                    'free': u.free, 'percent': u.percent}
        except Exception:
            return None

    disks = []
    seen = set()
    for part in psutil.disk_partitions(all=False):
        if part.fstype in ('', 'swap', 'squashfs', 'iso9660'):
            continue
        info = _disk_info(part.mountpoint)
        if info and info['mountpoint'] not in seen:
            seen.add(info['mountpoint'])
            disks.append(info)
    if not disks and disk:
        disks.append({'mountpoint': '/', 'total': disk.total, 'used': disk.used,
                      'free': disk.free, 'percent': disk.percent})

    try:
        load = psutil.getloadavg()
    except Exception:
        load = (0.0, 0.0, 0.0)
    try:
        per_cpu = psutil.cpu_percent(interval=None, percpu=True)
    except Exception:
        per_cpu = []
    try:
        net = psutil.net_io_counters()
        net_sent, net_recv = net.bytes_sent, net.bytes_recv
    except Exception:
        net_sent = net_recv = 0
    now = time.time()
    net_up_rate = net_down_rate = 0
    if _net_last['ts'] > 0:
        dt = now - _net_last['ts']
        if dt > 0:
            net_up_rate = max(0, (net_sent - _net_last['sent']) / dt)
            net_down_rate = max(0, (net_recv - _net_last['recv']) / dt)
    _net_last.update(ts=now, sent=net_sent, recv=net_recv)
    try:
        net_if_stats = {k: v for k, v in psutil.net_if_stats().items()}
    except Exception:
        net_if_stats = {}
    try:
        net_if_counters = psutil.net_io_counters(pernic=True)
    except Exception:
        net_if_counters = {}
    try:
        net_if_addrs = psutil.net_if_addrs()
    except Exception:
        net_if_addrs = {}
    iface_rates = []
    for name, v in net_if_stats.items():
        cnt = net_if_counters.get(name)
        if not cnt:
            continue
        prev = _net_iface_last.get(name)
        up_rate = down_rate = 0
        if prev and _net_last['ts'] > 0:
            dt = now - _net_last['ts']
            if dt > 0:
                up_rate = max(0, (cnt.bytes_sent - prev['sent']) / dt)
                down_rate = max(0, (cnt.bytes_recv - prev['recv']) / dt)
        _net_iface_last[name] = {'sent': cnt.bytes_sent, 'recv': cnt.bytes_recv, 'ts': now}
        addr = ''
        for a in net_if_addrs.get(name, []):
            if a.family == socket.AF_INET:
                addr = a.address
                break
        iface_rates.append({
            'name': name, 'up': v.isup, 'speed': v.speed,
            'up_rate': round(up_rate, 1), 'down_rate': round(down_rate, 1),
            'addr': addr,
        })
    iface_rates.sort(key=lambda x: (x['up_rate'] + x['down_rate']), reverse=True)
    try:
        with open('/proc/cpuinfo', 'r', encoding='utf-8', errors='replace') as f:
            cpu_model = ''
            for line in f:
                if line.startswith('model name'):
                    cpu_model = line.split(':', 1)[1].strip()
                    break
    except Exception:
        cpu_model = ''
    try:
        proc_count = len(psutil.pids())
        thread_count = sum(p.info['num_threads'] or 0
                           for p in psutil.process_iter(['num_threads']))
    except Exception:
        proc_count = thread_count = 0
    try:
        boot_time = psutil.boot_time()
        uptime = int(time.time() - boot_time)
    except Exception:
        boot_time = uptime = 0
    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = ''
    try:
        import subprocess
        with open('/etc/os-release', 'r', encoding='utf-8') as f:
            osrel = dict(l.split('=', 1) for l in f if '=' in l)
        platform_name = osrel.get('PRETTY_NAME', osrel.get('NAME', '')).strip('"')
    except Exception:
        platform_name = platform.platform()

    payload = {
        'cpu_percent': psutil.cpu_percent(interval=None),
        'cpu_count': os.cpu_count() or 1,
        'cpu_per_core': per_cpu,
        'cpu_model': cpu_model,
        'load_avg': list(load),
        'memory_total': mem.total,
        'memory_used': mem.used,
        'memory_available': mem.available,
        'memory_percent': mem.percent,
        'swap_total': swap.total,
        'swap_used': swap.used,
        'swap_percent': swap.percent,
        'disk_total': disk.total if disk else 0,
        'disk_used': disk.used if disk else 0,
        'disk_percent': disk.percent if disk else 0,
        'disks': disks,
        'net_sent': net_sent,
        'net_recv': net_recv,
        'net_up_rate': round(net_up_rate, 1),
        'net_down_rate': round(net_down_rate, 1),
        'net_interfaces': iface_rates,
        'process_count': proc_count,
        'thread_count': thread_count,
        'hostname': hostname,
        'platform': platform_name,
        'arch': platform.machine(),
        'python_version': platform.python_version(),
        'boot_time': boot_time,
        'uptime': uptime,
        'current_time': int(time.time()),
    }
    _sys_cache.update(ts=time.time(), data=payload)
    return jsonify(payload)


def _lsblk_disks():
    """Parse lsblk JSON into a flat disk/partition list with usage."""
    import json
    import subprocess
    try:
        out = subprocess.run(
            ['lsblk', '-J', '-b', '-o',
             'NAME,TYPE,FSTYPE,SIZE,MOUNTPOINT,LABEL,HOTPLUG,TRAN,MODEL,VENDOR,RO,RM'],
            capture_output=True, timeout=10,
        )
        data = json.loads(out.stdout.decode('utf-8', 'replace'))
    except Exception:
        return []

    disks = []
    for dev in data.get('blockdevices', []):
        if dev.get('type') not in ('disk', 'loop'):
            continue
        disk = {
            'name': dev.get('name'),
            'path': '/dev/' + dev.get('name', ''),
            'type': dev.get('type'),
            'size': dev.get('size') or 0,
            'model': (dev.get('model') or '').strip() or (dev.get('vendor') or '').strip(),
            'tran': dev.get('tran'),
            'hotplug': bool(dev.get('hotplug')),
            'removable': bool(dev.get('rm')),
            'readonly': bool(dev.get('ro')),
            'pttype': dev.get('pttype'),
            'partitions': [],
        }
        for part in dev.get('children') or []:
            mp = part.get('mountpoint')
            disk['partitions'].append({
                'name': part.get('name'),
                'path': '/dev/' + part.get('name', ''),
                'type': part.get('type'),
                'fstype': part.get('fstype'),
                'size': part.get('size') or 0,
                'mountpoint': mp,
                'mounted': bool(mp) and str(mp) != '[SWAP]',
                'label': part.get('label'),
                'readonly': bool(part.get('ro')),
            })
        # raw disk with fs (e.g. whole-disk FAT)
        if not disk['partitions'] and dev.get('fstype'):
            disk['partitions'].append({
                'name': dev.get('name'), 'path': '/dev/' + dev.get('name', ''),
                'type': 'part', 'fstype': dev.get('fstype'),
                'size': dev.get('size') or 0, 'mountpoint': dev.get('mountpoint'),
                'mounted': bool(dev.get('mountpoint')),
                'label': dev.get('label'), 'readonly': bool(dev.get('ro')),
            })
        disks.append(disk)
    disks.sort(key=lambda d: (not d['hotplug'], d['name']))
    return disks


@app.route('/api/disks')
def disks_info():
    return jsonify({'disks': _lsblk_disks()})


def _sudo_cmd(args):
    """按 TOUCHGAL_SUDO_PW(EnvironmentFile 注入) 构造 sudo 命令; 未配置时尝试免密 sudo -n。"""
    pw = os.environ.get('TOUCHGAL_SUDO_PW', '') or ''
    if pw:
        return ['sudo', '-S'] + args, (pw + '\n').encode()
    return ['sudo', '-n'] + args, None


@app.route('/api/disks/unmount', methods=['POST'])
def disk_unmount():
    data = request.json or {}
    dev = str(data.get('device', '')).strip()
    # whitelist: /dev/sdX or /dev/sdXn (and nvme, mmcblk, vd, loop)
    if not re.match(r'^/dev/(sd[a-z]|hd[a-z]|vd[a-z]|nvme\d+n\d+|mmcblk\d+|loop\d+)(p?\d+)?$', dev):
        return jsonify({'error': '无效的设备路径'}), 400
    try:
        import subprocess
        cmd, inp = _sudo_cmd(['udisksctl', 'unmount', '-b', dev])
        rc = subprocess.run(cmd, capture_output=True, timeout=30, input=inp)
        if rc.returncode == 0:
            return jsonify({'message': f'已卸载 {dev}'})
        err = (rc.stderr or b'').decode('utf-8', 'replace').strip()
        # fallback to plain umount for system-managed mounts
        if 'Not authorized' in err or 'busy' not in err:
            cmd2, inp2 = _sudo_cmd(['umount', dev])
            rc2 = subprocess.run(cmd2, capture_output=True, timeout=30, input=inp2)
            if rc2.returncode == 0:
                return jsonify({'message': f'已卸载 {dev}'})
        return jsonify({'error': f'卸载失败: {err or "未知错误"}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/storage')
def storage_info():
    """Aggregate storage path configs from plugins for the global settings page."""
    import psutil

    def _path_stats(path):
        try:
            u = psutil.disk_usage(path)
            return {'path': path, 'total': u.total, 'used': u.used,
                    'free': u.free, 'percent': u.percent, 'exists': os.path.isdir(path)}
        except Exception:
            return {'path': path, 'total': 0, 'used': 0, 'free': 0,
                    'percent': 0, 'exists': os.path.isdir(path)}

    result = {}
    for name, plugin in manager.get_plugins().items():
        provider = getattr(plugin, 'storage_provider', None)
        if provider:
            cfg = provider()
            result[cfg['name']] = {
                'label': cfg.get('label', cfg['name']),
                'paths': [_path_stats(p) for p in cfg.get('paths', [])],
                'active_path': cfg.get('active_path'),
                'auto_switch_full': cfg.get('auto_switch_full'),
                'full_threshold_mb': cfg.get('full_threshold_mb'),
            }
    return jsonify(result)


@app.route('/api/plugins/install', methods=['POST'])
def install_plugin():
    if 'file' not in request.files:
        return jsonify({'error': '请上传插件文件'}), 400
    file = request.files['file']
    if not file.filename.endswith('.zip'):
        return jsonify({'error': '仅支持 .zip 格式'}), 400

    from tasks import begin, update, finish, read_async
    tid = begin('plugins', '安装插件 %s' % file.filename, kind='install')

    def _work():
        try:
            with tempfile.TemporaryDirectory() as tmp:
                update(tid, phase='uploading', progress=10, message='解压并识别插件…')
                zip_path = os.path.join(tmp, 'plugin.zip')
                file.save(zip_path)
                try:
                    with zipfile.ZipFile(zip_path, 'r') as zf:
                        for m in zf.namelist():
                            norm = m.replace('\\', '/')
                            if norm.startswith('/') or '..' in norm.split('/'):
                                finish(tid, False, error='ZIP 包含非法路径, 已拒绝安装')
                                return
                        zf.extractall(tmp)
                except zipfile.BadZipFile:
                    finish(tid, False, error='无效的 ZIP 文件')
                    return

                if is_java_plugin(tmp):
                    result = install_java_plugin(tmp, zip_path)
                else:
                    extracted = [d for d in os.listdir(tmp)
                                 if os.path.isdir(os.path.join(tmp, d)) and d != '__pycache__']
                    if not extracted:
                        finish(tid, False, error='ZIP 中未找到插件目录')
                        return
                    installed = []
                    for dirname in extracted:
                        if dirname == 'filemanager':
                            continue
                        src = os.path.join(tmp, dirname)
                        dst = os.path.join(PLUGINS_DIR, dirname)
                        if os.path.exists(dst):
                            finish(tid, False, error='插件 "%s" 已存在 (跳过)' % dirname)
                            continue
                        plugin_file = os.path.join(src, 'plugin.py')
                        if not os.path.isfile(plugin_file):
                            continue
                        update(tid, phase='installing', progress=60, message='复制插件目录…')
                        shutil.copytree(src, dst)
                        installed.append(dirname)
                    if not installed:
                        finish(tid, False, error='未找到有效的插件')
                        return
                    result = load_plugins(installed)
                if isinstance(result, tuple):
                    finish(tid, False, error=result[0].get_json().get('error', '安装失败'))
                else:
                    data = result.get_json()
                    if data.get('error'):
                        finish(tid, False, error=data['error'])
                    else:
                        finish(tid, True, message=data.get('message', '插件安装完成'))
        except Exception as e:
            finish(tid, False, error=str(e))

    import threading
    threading.Thread(target=_work, daemon=True).start()
    return jsonify({'message': '已开始安装插件，可在任务队列查看进度', 'task': tid})


def install_java_plugin(tmp, zip_path):
    extracted = [d for d in os.listdir(tmp) if os.path.isdir(os.path.join(tmp, d)) and d != '__pycache__']
    if not extracted:
        return jsonify({'error': 'ZIP 中未找到插件目录'}), 400

    dirname = extracted[0]
    src = os.path.join(tmp, dirname)
    dst = os.path.join(PLUGINS_DIR, dirname)

    if dirname == 'filemanager':
        return jsonify({'error': 'filemanager 为系统模块，不可安装'}), 400

    if os.path.exists(dst):
        return jsonify({'error': f'插件 "{dirname}" 已存在'}), 409

    try:
        result = convert_java_plugin(zip_path, tmp, dirname)
    except Exception as e:
        return jsonify({'error': f'转换插件失败: {e}'}), 500

    shutil.copytree(src, dst)
    return load_plugins([dirname])


def load_plugins(plugin_names):
    installed = []
    for name in plugin_names:
        try:
            plugin_file = os.path.join(PLUGINS_DIR, name, 'plugin.py')
            spec = importlib.util.spec_from_file_location(f'plugins.{name}.plugin', plugin_file)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = mod
            spec.loader.exec_module(mod)
            loaded = False
            for attr in dir(mod):
                cls = getattr(mod, attr)
                if isinstance(cls, type) and cls.__name__ != 'Plugin' and issubclass(cls, Plugin):
                    instance = cls()
                    manager.register(instance)
                    print(f'[plugin] installed: {instance.label}')
                    installed.append(name)
                    loaded = True
            if not loaded:
                return jsonify({'error': f'插件 "{name}" 中未找到 Plugin 子类'}), 500
        except Exception as e:
            return jsonify({'error': f'加载插件 "{name}" 失败: {e}'}), 500

    return jsonify({'message': f'已安装 {len(installed)} 个插件', 'plugins': installed})


@app.route('/api/plugins/<name>', methods=['DELETE'])
def remove_plugin(name):
    if name == 'filemanager':
        return jsonify({'error': 'filemanager 为系统模块，不可删除'}), 400
    plugin_dir = os.path.join(PLUGINS_DIR, name)
    if not os.path.isdir(plugin_dir):
        return jsonify({'error': '插件不存在'}), 404
    plugin = manager.get_plugin(name)
    if plugin and hasattr(plugin, 'stop'):
        try:
            plugin.stop()
        except Exception:
            pass
    shutil.rmtree(plugin_dir)
    manager.remove(name)
    return jsonify({'message': f'已移除插件: {name}'})


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f'Plugin Runner running at http://localhost:{port}')
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
