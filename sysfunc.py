# -*- coding: utf-8 -*-
"""系统级功能蓝图: 服务管理/防火墙/硬件/系统更新/crontab/磁盘/快照/用户密钥
全部只读优先; 有副作用的操作(服务启停/更新/写cron/写密钥)显式经 POST 且 sudo 统一包装。
"""
import json
import collections
import os
import re
import shutil
import subprocess
import sys
import time

from flask import Blueprint, request, jsonify, g, current_app

sysfunc = Blueprint('sysfunc', __name__)


def _sudo(args, timeout=120):
    pw = os.environ.get('TOUCHGAL_SUDO_PW', '')
    cmd = ['sudo', '-S'] + list(args) if pw else ['sudo', '-n'] + list(args)
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                           input=(pw + '\n') if pw else None)
        return {'ok': r.returncode == 0, 'rc': r.returncode,
                'out': r.stdout, 'err': r.stderr}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'rc': None, 'out': '', 'err': '超时'}
    except Exception as e:
        return {'ok': False, 'rc': None, 'out': '', 'err': str(e)}


def _sh(args, timeout=60):
    try:
        r = subprocess.run(list(args), capture_output=True, text=True, timeout=timeout)
        return {'ok': r.returncode == 0, 'out': r.stdout, 'err': r.stderr}
    except Exception as e:
        return {'ok': False, 'out': '', 'err': str(e)}


# ---------------- 1. systemd 服务管理 ----------------
@sysfunc.route('/service/list', methods=['GET'])
def service_list():
    r = _sh(['systemctl', 'list-units', '--type=service', '--all', '--no-legend', '--no-pager', '--plain'])
    units = []
    for line in r['out'].splitlines():
        parts = line.split(None, 4)
        if len(parts) < 4:
            continue
        units.append({'unit': parts[0], 'load': parts[1], 'active': parts[2],
                      'sub': parts[3], 'desc': parts[4] if len(parts) > 4 else ''})
    return jsonify({'ok': r['ok'], 'units': units[:500]})


@sysfunc.route('/service/action', methods=['POST'])
def service_action():
    data = request.get_json(silent=True) or {}
    unit = str(data.get('unit', '')).strip()
    action = str(data.get('action', '')).strip()
    if not unit or not re.match(r'^[A-Za-z0-9@._-]+\.service$', unit):
        return jsonify({'error': '无效服务单元'}), 400
    if action not in ('start', 'stop', 'restart', 'enable', 'disable'):
        return jsonify({'error': '无效动作'}), 400
    args = ['systemctl', action, unit]
    r = _sudo(args, timeout=90)
    if r['ok']:
        _record_event('service', action, unit)
    return jsonify({'ok': r['ok'], 'out': (r['out'] or '')[-400:], 'error': (r['err'] or '')[-300:]})


# ---------------- 2. 防火墙与监听 ----------------
@sysfunc.route('/fw/all', methods=['GET'])
def fw_all():
    fw = None
    ufw = _sudo(['ufw', 'status', 'verbose'], timeout=60)
    if ufw['ok'] and 'Status' in ufw['out']:
        fw = {'tool': 'ufw', 'text': ufw['out'][:4000]}
    else:
        nft = _sudo(['nft', 'list', 'ruleset'], timeout=60)
        if nft['ok'] and nft['out'].strip():
            fw = {'tool': 'nftables', 'text': nft['out'][:4000]}
        else:
            fw = {'tool': 'none', 'text': '未检测到 ufw/nftables 规则集(可能未启用)'}
    ss = _sh(['ss', '-lntup'])
    listen = []
    if ss['ok']:
        for line in ss['out'].splitlines()[1:]:
            parts = line.split()
            if len(parts) < 5:
                continue
            listen.append({'proto': parts[0], 'local': parts[3],
                           'peer': parts[4], 'proc': ' '.join(parts[5:]) if len(parts) > 5 else ''})
    return jsonify({'firewall': fw, 'listen': listen[:200]})


# ---------------- 3. 硬件仪表盘 ----------------
@sysfunc.route('/hardware', methods=['GET'])
def hardware():
    out = {}
    dm = _sudo(['dmidecode'], timeout=60)
    if dm['ok']:
        text = dm['out']
        def grab(sec, field):
            m = re.search(sec + r'\n((?:.*\n)*?)^\t' + field + r': (.+)$', text, re.M)
            return m.group(2).strip() if m else ''
        out['cpu'] = {'model': grab(r'Processor Information', r'Version'), 'cores': grab(r'Processor Information', r'Core Count')}
        mem = re.findall(r'Memory Device\n((?:.*\n)*?)(?=Memory Device|End of Table)', text)
        sticks = []
        for m in mem[:16]:
            size = re.search(r'Size: (\d+\s*[MG]B)', m)
            speed = re.search(r'Speed: (.+)', m)
            loc = re.search(r'Locator: (.+)', m)
            if size:
                sticks.append({'loc': loc.group(1).strip() if loc else '?',
                               'size': size.group(1), 'speed': speed.group(1).strip() if speed else ''})
        out['memory'] = {'sticks': sticks, 'total': grab(r'Physical Memory Array', r'Maximum Capacity')}
        out['board'] = {'vendor': grab(r'Base Board Information', r'Manufacturer'),
                        'model': grab(r'Base Board Information', r'Product Name')}
    else:
        out['dmidecode'] = '需要 root(dmidecode 未运行): ' + (dm['err'] or '')[:120]
    # hwmon 温度
    temps = []
    try:
        for hw in sorted(os.listdir('/sys/class/hwmon')):
            base = '/sys/class/hwmon/' + hw
            name = ''
            try:
                with open(base + '/name') as f:
                    name = f.read().strip()
            except Exception:
                pass
            vals = {}
            for ent in sorted(os.listdir(base)):
                if ent.startswith('temp') and ent.endswith('_input'):
                    try:
                        with open(base + '/' + ent) as f:
                            vals[ent.replace('_input', '')] = round(int(f.read().strip()) / 1000, 1)
                    except Exception:
                        pass
            if vals:
                temps.append({'chip': name or hw, 'values': vals})
    except Exception:
        pass
    out['temps'] = temps[:12]
    smarts = []
    for d in _sh(['ls', '/dev/sd*'])['out'].split():
        out2 = _sudo(['smartctl', '-H', d], timeout=30)
        status = 'OK' if 'PASSED' in out2['out'] else ('? ' + (out2['err'] or '')[:60])
        smarts.append({'dev': d, 'status': status})
    out['smart'] = smarts[:8]
    return jsonify(out)


# ---------------- 4. 系统更新中心 ----------------
@sysfunc.route('/updates/refresh', methods=['POST'])
def updates_refresh():
    r = _sudo(['apt-get', 'update'], timeout=600)
    return jsonify({'ok': r['ok'], 'out': (r['out'] or '')[-400:], 'error': (r['err'] or '')[-300:]})


@sysfunc.route('/updates/list', methods=['GET'])
def updates_list():
    r = _sh(['apt', 'list', '--upgradable', '-q'])
    pkgs = []
    for line in r['out'].splitlines():
        line = line.strip()
        if not line or '/' not in line:
            continue
        pkg, rest = line.split('/', 1)
        m = re.match(r'(\S+)\s+([\d.~+-]+)\s+', rest)
        if m:
            pkgs.append({'pkg': pkg, 'new': m.group(2), 'arch': m.group(1)})
    security = 0
    sim = _sudo(['apt-get', '-s', 'upgrade'], timeout=120)
    security = len(re.findall(r'security|updates/security', sim['out']))
    return jsonify({'ok': True, 'count': len(pkgs), 'security': security, 'packages': pkgs[:200]})


@sysfunc.route('/updates/run', methods=['POST'])
def updates_run():
    data = request.get_json(silent=True) or {}
    if data.get('confirm') != 'yes':
        return jsonify({'error': '需要 confirm=yes'}), 400
    r = _sudo(['apt-get', '-y', 'upgrade'], timeout=1800)
    if r['ok']:
        _record_event('updates', 'upgrade', '系统升级完成')
    return jsonify({'ok': r['ok'], 'out': (r['out'] or '')[-1200:], 'error': (r['err'] or '')[-400:]})


# ---------------- 5. crontab 管理 ----------------
@sysfunc.route('/cron/get', methods=['GET'])
def cron_get():
    user = request.args.get('user', '').strip() or None
    r = _sudo(['crontab', '-l', '-u', user] if user else ['crontab', '-l'], timeout=30)
    return jsonify({'ok': r['ok'] or 'no crontab for' not in (r['err'] or ''), 'content': r['out'], 'error': r['err'][:200]})


@sysfunc.route('/cron/save', methods=['POST'])
def cron_save():
    data = request.get_json(silent=True) or {}
    user = str(data.get('user', '')).strip()
    content = str(data.get('content', ''))
    if len(content) > 200000:
        return jsonify({'error': '内容过大'}), 400
    tmp = '/tmp/rc-cron-' + (user or 'root')
    try:
        with open(tmp, 'w') as f:
            f.write(content)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    r = _sudo(['crontab', tmp, '-u', user] if user else ['crontab', tmp], timeout=30)
    try:
        os.remove(tmp)
    except Exception:
        pass
    return jsonify({'ok': r['ok'], 'error': (r['err'] or '')[:200]})


# ---------------- 6. 磁盘与文件系统 ----------------
@sysfunc.route('/disks/fs', methods=['GET'])
def disks_fs():
    lsblk = _sh(['lsblk', '-J', '-o', 'NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL'])
    tree = None
    if lsblk['ok']:
        try:
            tree = json.loads(lsblk['out'])
        except Exception:
            tree = None
    df = _sh(['df', '-hT'])
    dfs = []
    if df['ok']:
        for line in df['out'].splitlines()[1:]:
            p = line.split()
            if len(p) >= 6:
                dfs.append({'fs': p[0], 'type': p[1], 'size': p[2], 'used': p[3], 'avail': p[4], 'use': p[5], 'mount': p[6]})
    return jsonify({'lsblk': tree, 'df': dfs[:60]})


# ---------------- 7. 系统快照(能力检测 + btrfs) ----------------
@sysfunc.route('/snapshot/cap', methods=['GET'])
def snapshot_cap():
    root = _sh(['findmnt', '-no', 'FSTYPE', '/'])
    fstype = root['out'].strip() if root['ok'] else ''
    r = {}
    if fstype == 'btrfs':
        r = {'supported': True, 'fstype': 'btrfs', 'hint': '可按需创建 COW 快照(readonly 由参数控制)'}
    elif fstype in ('ext4', 'xfs'):
        r = {'supported': False, 'fstype': fstype, 'hint': 'ext4/xfs 无在线快照; 建议结合 LVM 或 tarball 备份(backup 插件)'}
    else:
        r = {'supported': False, 'fstype': fstype or 'unknown', 'hint': '不支持在线快照'}
    return jsonify(r)


@sysfunc.route('/snapshot/create', methods=['POST'])
def snapshot_create():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()
    if not re.match(r'^[A-Za-z0-9._-]{1,60}$', name):
        return jsonify({'error': '快照名非法'}), 400
    r = _sudo(['btrfs', 'subvolume', 'snapshot', '-r', '/', '/@snap-' + name], timeout=120)
    if r['ok']:
        _record_event('snapshot', 'create', '创建快照 ' + name)
    return jsonify({'ok': r['ok'], 'out': (r['out'] or '')[-300:], 'error': (r['err'] or '')[-300:]})


@sysfunc.route('/snapshot/list', methods=['GET'])
def snapshot_list():
    r = _sudo(['btrfs', 'subvolume', 'list', '/'], timeout=60)
    snaps = []
    for line in r['out'].splitlines():
        if '@snap-' in line or 'snapshot' in line:
            snaps.append(line.strip()[:160])
    return jsonify({'ok': r['ok'], 'snapshots': snaps[:100], 'error': (r['err'] or '')[:200]})


# ---------------- 8. 用户与 SSH 密钥 ----------------
@sysfunc.route('/users', methods=['GET'])
def users():
    users = []
    r = _sh(['getent', 'passwd'])
    sudo_list = set(_sh(['getent', 'group', 'sudo'])['out'].split(':', 3)[3].split(',') if _sh(['getent', 'group', 'sudo'])['ok'] else [])
    for line in r['out'].splitlines():
        p = line.split(':')
        if len(p) < 7:
            continue
        try:
            uid = int(p[2])
        except Exception:
            uid = -1
        if uid < 1000 or p[6] in ('/usr/sbin/nologin', '/bin/false', '/sbin/nologin'):
            continue
        users.append({'name': p[0], 'uid': uid, 'home': p[5], 'shell': p[6],
                      'sudo': p[0] in sudo_list})
    return jsonify(users)


@sysfunc.route('/ssh/keys', methods=['GET'])
def ssh_keys():
    user = str(request.args.get('user', '')).strip()
    if not re.match(r'^[a-z_][a-z0-9_-]{0,31}$', user):
        return jsonify({'error': '用户非法'}), 400
    path = '/home/%s/.ssh/authorized_keys' % user
    try:
        with open(path, encoding='utf-8') as f:
            return jsonify({'ok': True, 'user': user, 'keys': f.read()})
    except Exception as e:
        return jsonify({'ok': False, 'user': user, 'keys': '', 'error': str(e)})


@sysfunc.route('/ssh/keys/save', methods=['POST'])
def ssh_keys_save():
    data = request.get_json(silent=True) or {}
    user = str(data.get('user', '')).strip()
    keys = str(data.get('keys', ''))
    if not re.match(r'^[a-z_][a-z0-9_-]{0,31}$', user):
        return jsonify({'error': '用户非法'}), 400
    if len(keys) > 200000:
        return jsonify({'error': '内容过大'}), 400
    hd = '/home/%s/.ssh' % user
    _sudo(['mkdir', '-p', hd, '&&', 'chmod', '700', hd], timeout=20)
    tmp = '/tmp/rc-ak-' + user
    try:
        with open(tmp, 'w') as f:
            f.write(keys)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    r = _sudo(['cp', tmp, hd + '/authorized_keys', '&&', 'chmod', '600', hd + '/authorized_keys', '&&', 'chown', user + ':' + user, hd + '/authorized_keys'], timeout=30)
    try:
        os.remove(tmp)
    except Exception:
        pass
    return jsonify({'ok': r['ok'], 'error': (r['err'] or '')[:200]})


# ================= 第二批: 清理/性能/网络/电源/内核/时间 =================
import threading as _th
import time as _time
import socket as _sock

try:
    import psutil as _ps
except Exception:
    _ps = None

_HIST_LOCK = _th.Lock()
_HIST = {'points': [], 'net': {'rx': 0, 'tx': 0, 'ts': 0.0}}
_NET_LAST = {'ts': 0.0, 'rx': 0, 'tx': 0}
_CLEAN_CACHE = {'ts': 0.0, 'dirs': [], 'items': []}
_SAMPLER_ON = False


def _sampler_loop():
    while True:
        try:
            if _ps:
                cpu = _ps.cpu_percent(interval=1)
                mem = _ps.virtual_memory()
                disk = _ps.disk_usage(os.sep)
                io = _ps.net_io_counters()
                now = _time.time()
                dt = max(1.0, now - _NET_LAST['ts'])
                rx = int((io.bytes_recv - _NET_LAST['rx']) / dt)
                tx = int((io.bytes_sent - _NET_LAST['tx']) / dt)
                _NET_LAST.update(ts=now, rx=io.bytes_recv, tx=io.bytes_sent)
                pt = {'t': int(now), 'cpu': round(cpu, 1),
                      'mem': round(mem.percent, 1), 'disk': round(disk.percent, 1),
                      'rx': rx, 'tx': tx}
                with _HIST_LOCK:
                    _HIST['points'].append(pt)
                    cutoff = now - 48 * 3600
                    _HIST['points'] = [x for x in _HIST['points'] if x['t'] >= cutoff]
                    _HIST['net'] = {'rx': rx, 'tx': tx, 'ts': now}
        except Exception:
            pass
        _time.sleep(60)


def _ensure_sampler():
    global _SAMPLER_ON
    if not _SAMPLER_ON and _ps:
        _SAMPLER_ON = True
        _th.Thread(target=_sampler_loop, daemon=True).start()


# ---------------- 1. 存储清理中心 ----------------
@sysfunc.route('/clean/scan', methods=['GET'])
def clean_scan():
    now = _time.time()
    with _HIST_LOCK:
        if now - _CLEAN_CACHE['ts'] < 90 and _CLEAN_CACHE['dirs']:
            return jsonify({'ok': True, 'dirs': _CLEAN_CACHE['dirs'],
                            'items': _CLEAN_CACHE['items'], 'cached': True})
    r = _sudo(['du', '-xh', '--exclude=/proc', '--exclude=/sys', '--exclude=/dev',
               '--exclude=/run', '--max-depth=3', os.sep], timeout=240)
    dirs = []
    if r['ok']:
        for line in r['out'].splitlines():
            parts = line.split(None, 1)
            if len(parts) == 2:
                dirs.append({'size': parts[0], 'path': parts[1]})
    items = []
    apt = _sudo(['du', '-sh', '/var/cache/apt/archives'], timeout=30)
    items.append({'key': 'apt', 'label': 'apt 下载缓存', 'size': apt['out'].strip().split()[0] if apt['ok'] else '?'})
    jr = _sudo(['journalctl', '--disk-usage'], timeout=30)
    jsize = '?'
    if jr['ok'] and jr['out'].strip():
        mj = re.search(r'(\d+(?:\.\d+)?\s*[KMG]?B?)', jr['out'])
        jsize = mj.group(1) if mj else jr['out'].strip().split()[-2]
    items.append({'key': 'journal', 'label': 'journald 日志', 'size': jsize})
    dr = _sudo(['docker', 'system', 'df'], timeout=30)
    items.append({'key': 'docker', 'label': 'docker 悬空/镜像', 'size': 'docker df', 'detail': dr['out'][:200] if dr['ok'] else '无 docker/未运行'})
    with _HIST_LOCK:
        _CLEAN_CACHE.update(ts=now, dirs=dirs[:15], items=items)
    return jsonify({'ok': True, 'dirs': dirs[:15], 'items': items, 'cached': False})


@sysfunc.route('/clean/do', methods=['POST'])
def clean_do():
    data = request.get_json(silent=True) or {}
    key = str(data.get('item', '')).strip()
    if key == 'apt':
        r = _sudo(['apt-get', '-y', 'autoclean'], timeout=600)
    elif key == 'journal':
        r = _sudo(['journalctl', '--vacuum-size=200M'], timeout=300)
    elif key == 'docker':
        r = _sudo(['docker', 'system', 'prune', '-f'], timeout=600)
    else:
        return jsonify({'error': '未知清理项'}), 400
    with _HIST_LOCK:
        _CLEAN_CACHE['ts'] = 0.0
    if r['ok']:
        _record_event('clean', key, '存储清理: ' + key)
    return jsonify({'ok': r['ok'], 'out': (r['out'] or '')[-800:], 'error': (r['err'] or '')[-300:]})


# ---------------- 2. 性能趋势 ----------------
@sysfunc.route('/perf/history', methods=['GET'])
def perf_history():
    _ensure_sampler()
    hours = max(1, min(int(request.args.get('hours', 24) or 24), 48))
    now = _time.time()
    with _HIST_LOCK:
        pts = [x for x in _HIST['points'] if x['t'] >= now - hours * 3600]
        net = dict(_HIST['net'])
    return jsonify({'ok': True, 'hours': hours, 'points': pts[-720:], 'net': net})


# ---------------- 3. 网络状态 ----------------
@sysfunc.route('/net/status', methods=['GET'])
def net_status():
    nics = []
    if _ps:
        addrs = _ps.net_if_addrs()
        stats = _ps.net_if_stats()
        for name, st in stats.items():
            ip = ''
            for a in addrs.get(name, []):
                if a.family == _sock.AF_INET:
                    ip = a.address
                    break
            nics.append({'name': name, 'up': st.isup, 'ip': ip, 'mtu': st.mtu})
    tcp = 0
    try:
        tcp += max(0, len(open('/proc/net/tcp').readlines()) - 1)
        tcp += max(0, len(open('/proc/net/tcp6').readlines()) - 1)
    except Exception:
        pass
    pub = None
    try:
        r = subprocess.run(['curl', '-s', '-m', '4', 'https://api.ipify.org'],
                           capture_output=True, text=True, timeout=6)
        if r.returncode == 0 and re.match(r'^\d{1,3}(\.\d{1,3}){3}$', r.stdout.strip()):
            pub = r.stdout.strip()
    except Exception:
        pass
    dns = ''
    try:
        with open('/etc/resolv.conf') as f:
            for line in f:
                line = line.strip()
                if line.startswith('nameserver'):
                    dns = line.split()[1]
                    break
    except Exception:
        pass
    return jsonify({'nics': nics, 'tcp_conns': tcp, 'public_ip': pub, 'dns': dns,
                    'rate': _HIST.get('net') if _ps else None})


# ---------------- 4. 计划关机/重启 ----------------
@sysfunc.route('/pwr/plan', methods=['POST'])
def pwr_plan():
    data = request.get_json(silent=True) or {}
    action = str(data.get('action', '')).strip()
    minutes = int(data.get('minutes', 0) or 0)
    if action not in ('shutdown', 'reboot'):
        return jsonify({'error': '动作需 shutdown|reboot'}), 400
    if not (1 <= minutes <= 1440):
        return jsonify({'error': '分钟需在 1-1440'}), 400
    r = _sudo(['shutdown'] + (['-r'] if action == 'reboot' else []) + ['+' + str(minutes), '面板计划操作'], timeout=30)
    if r['ok']:
        _record_event('power', action, '%s %s 分钟后' % (action, minutes))
    return jsonify({'ok': r['ok'], 'error': (r['err'] or '')[:200]})


@sysfunc.route('/pwr/cancel', methods=['POST'])
def pwr_cancel():
    r = _sudo(['shutdown', '-c'], timeout=30)
    if r['ok']:
        _record_event('power', 'cancel', '取消计划关机/重启')
    return jsonify({'ok': r['ok'], 'error': (r['err'] or '')[:200]})


@sysfunc.route('/pwr/state', methods=['GET'])
def pwr_state():
    info = {}
    try:
        with open('/run/systemd/shutdown/scheduled') as f:
            for line in f:
                line = line.strip()
                if '=' in line:
                    k, v = line.split('=', 1)
                    info[k] = v
    except Exception:
        pass
    return jsonify(info)


# ---------------- 5. 内核管理 ----------------
@sysfunc.route('/kernels', methods=['GET'])
def kernels():
    r = _sh(['dpkg', '-l', 'linux-image-*'])
    installed = []
    for line in r['out'].splitlines():
        p = line.split()
        if len(p) >= 2 and p[0] in ('ii', 'iU'):
            installed.append({'pkg': p[1], 'ver': p[2]})
    current = _sh(['uname', '-r'])['out'].strip()
    return jsonify({'ok': True, 'current': current, 'installed': installed})


@sysfunc.route('/kernels/remove', methods=['POST'])
def kernels_remove():
    data = request.get_json(silent=True) or {}
    pkg = str(data.get('pkg', '')).strip()
    if not re.match(r'^linux-image-[0-9][A-Za-z0-9._-]*$', pkg):
        return jsonify({'error': '包名非法'}), 400
    if data.get('confirm') != 'yes':
        return jsonify({'error': '需要 confirm=yes'}), 400
    r = _sudo(['apt-get', '-y', 'remove', pkg], timeout=900)
    if r['ok']:
        _record_event('kernel', 'remove', '卸载内核 ' + pkg)
    return jsonify({'ok': r['ok'], 'out': (r['out'] or '')[-600:], 'error': (r['err'] or '')[-300:]})


# ---------------- 6. 系统时间/NTP ----------------
@sysfunc.route('/time/status', methods=['GET'])
def time_status():
    r = _sh(['timedatectl'])
    lines = {}
    for line in r['out'].splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            lines[k.strip()] = v.strip()
    chrony = _sh(['systemctl', 'is-active', 'chrony'])['out'].strip()
    ntp = _sh(['systemctl', 'is-active', 'ntp'])['out'].strip()
    sync = 'chrony' if chrony == 'active' else ('ntp' if ntp == 'active' else ('systemd-timesyncd' if 'yes' in str(lines.get('NTP synchronized', '')).lower() else 'off'))
    return jsonify({'ok': True, 'fields': lines, 'sync': sync})


@sysfunc.route('/time/sync', methods=['POST'])
def time_sync():
    r1 = _sudo(['timedatectl', 'set-ntp', 'true'], timeout=60)
    r2 = _sudo(['chronyc', '-a', 'makestep'], timeout=60)
    if r1['ok'] and r2['ok']:
        _record_event('time', 'sync', 'NTP 同步')
    return jsonify({'ok': r1['ok'] and r2['ok'], 'error': ((r1['err'] or '') + (r2['err'] or ''))[:300]})

_ensure_sampler()


# ================= 第三批: 健康自检/事件时间线/logrotate =================
__import__('os')
_EVENTS_FILE = '/opt/touchgal/data/sysfunc_events.json'


def _record_event(scope, action, msg, level='info'):
    try:
        evs = []
        try:
            with open(_EVENTS_FILE, encoding='utf-8') as f:
                evs = json.load(f)
        except Exception:
            evs = []
        evs.append({'t': int(_time.time()), 'level': level, 'scope': scope,
                    'action': action, 'msg': str(msg)[:300]})
        evs = evs[-500:]
        os.makedirs(os.path.dirname(_EVENTS_FILE), exist_ok=True)
        with open(_EVENTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(evs, f, ensure_ascii=False)
    except Exception:
        pass


# ---------------- 1. 面板健康自检 ----------------
@sysfunc.route('/health/check', methods=['GET'])
def health_check():
    items = []

    def add(name, status, detail):
        items.append({'name': name, 'status': status, 'detail': str(detail)[:200]})

    # 磁盘
    try:
        u = _ps.disk_usage('/') if _ps else None
        pct = u.percent if u else -1
        add('磁盘 / 使用率', 'ok' if pct < 80 else ('warn' if pct < 92 else 'bad'),
            '%s%% 已用 (可用 %s)' % (pct, u.free // (1024 ** 3) if u else '?'))
    except Exception as e:
        add('磁盘 / 使用率', 'bad', e)
    # 写权限
    wt = '/opt/touchgal/data/.sfw'
    try:
        with open(wt, 'w') as f:
            f.write('ok')
        os.remove(wt)
        add('数据目录可写', 'ok', '/opt/touchgal/data')
    except Exception as e:
        add('数据目录可写', 'bad', str(e))
    # 依赖二进制
    for name, bins in [('ffmpeg', ['ffmpeg']), ('7z', ['7z', '7zz']), ('docker', ['docker']),
                       ('curl', ['curl']), ('openvpn', ['openvpn']), ('v2ray', ['v2ray', 'xray']),
                       ('sing-box', ['sing-box']), ('easy-rsa', ['/usr/share/easy-rsa/easyrsa'])]:
        found = shutil.which(bins[0]) or (os.path.exists(bins[0]) if bins[0].startswith('/') else None)
        add('依赖 %s' % name, 'ok' if found else 'warn', found or '未安装')
    # 关键服务
    for unit in ['touchgal', 'docker', 'mariadb', 'ssh', 'socat', 'websockify', 'mc-tunnel']:
        st = _sh(['systemctl', 'is-active', unit])['out'].strip()
        if st == 'active':
            add('服务 %s' % unit, 'ok', 'active')
        elif st in ('inactive', 'failed'):
            add('服务 %s' % unit, 'warn', st)
        else:
            add('服务 %s' % unit, 'ok', '未安装/未知')
    # 负载与内存
    try:
        la = float(open('/proc/loadavg').read().split()[0])
        ncpu = os.cpu_count() or 1
        add('负载 (1m)', 'ok' if la < ncpu else ('warn' if la < ncpu * 1.5 else 'bad'),
            '%.2f / %s 核' % (la, ncpu))
        if _ps:
            vm = _ps.virtual_memory()
            add('内存可用', 'ok' if vm.available > 1 * 1024 ** 3 else 'warn',
                '%s%% 已用, 可用 %sG' % (vm.percent, round(vm.available / (1024 ** 3), 1)))
    except Exception as e:
        add('负载/内存', 'warn', str(e))
    # 面板端口
    try:
        ss = _sh(['ss', '-lntp'])['out']
        for port in [3000, 2280, 23080, 6080]:
            ok = (':%d ' % port) in ss
            add('端口 %d' % port, 'ok' if ok else 'warn', '监听中' if ok else '未监听')
    except Exception:
        pass
    # 模型目录(可选)
    for mr in ['/opt/touchgal/models/rapidocr_models', os.environ.get('WD_MODEL_DIR', '')]:
        if mr and os.path.isdir(mr):
            add('模型目录', 'ok', mr)
    return jsonify({'ok': True, 'items': items, 'ts': int(_time.time())})


@sysfunc.route('/health/restart', methods=['POST'])
def health_restart():
    data = request.get_json(silent=True) or {}
    if data.get('confirm') != 'yes':
        return jsonify({'error': '需要 confirm=yes'}), 400
    _record_event('panel', 'restart', '面板服务重启(健康自检触发)')
    r = _sudo(['systemctl', 'restart', 'touchgal'], timeout=60)
    return jsonify({'ok': r['ok'], 'error': (r['err'] or '')[:200]})


# ---------------- 2. 系统事件时间线 ----------------
@sysfunc.route('/events/timeline', methods=['GET'])
def events_timeline():
    limit = max(10, min(int(request.args.get('limit', 100) or 100), 500))
    evs = []
    try:
        with open(_EVENTS_FILE, encoding='utf-8') as f:
            evs = json.load(f)
    except Exception:
        pass
    return jsonify({'ok': True, 'events': evs[-limit:][::-1]})


# ---------------- 3. logrotate 管理 ----------------
@sysfunc.route('/logrotate/list', methods=['GET'])
def logrotate_list():
    conf_dir = '/etc/logrotate.d'
    files = []
    try:
        for fn in sorted(os.listdir(conf_dir)):
            path = os.path.join(conf_dir, fn)
            try:
                with open(path, encoding='utf-8') as f:
                    files.append({'name': fn, 'content': f.read()})
            except Exception as e:
                files.append({'name': fn, 'content': '', 'error': str(e)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    main = ''
    try:
        with open('/etc/logrotate.conf', encoding='utf-8') as f:
            main = f.read()
    except Exception:
        pass
    status = ''
    try:
        r = _sudo(['logrotate', '-d', '/etc/logrotate.conf'], timeout=60)
        status = (r['out'] or '')[-400:] + (r['err'] or '')[-200:]
    except Exception:
        pass
    return jsonify({'ok': True, 'files': files, 'main_conf': main, 'debug': status})


@sysfunc.route('/logrotate/save', methods=['POST'])
def logrotate_save():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', '')).strip()
    content = str(data.get('content', ''))
    if not re.match(r'^[A-Za-z0-9_.-]{1,64}$', name):
        return jsonify({'error': '文件名非法'}), 400
    if len(content) > 50000:
        return jsonify({'error': '内容过大'}), 400
    path = '/etc/logrotate.d/' + name
    tmp = '/tmp/rc-lr-' + name
    try:
        with open(tmp, 'w') as f:
            f.write(content)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    r = _sudo(['install', '-m', '644', tmp, path], timeout=30)
    try:
        os.remove(tmp)
    except Exception:
        pass
    if r['ok']:
        _record_event('logrotate', 'save', '保存日志轮转配置 ' + name)
    return jsonify({'ok': r['ok'], 'error': (r['err'] or '')[:200]})

# 事件埋点: 注入到既有写操作
def _patch_events():
    pass


# ================= 第四批: 启动/关机历史 =================
@sysfunc.route('/boot/history', methods=['GET'])
def boot_history():
    r = _sudo(['last', '-x', '-n', '40'], timeout=30)
    rows = []
    for line in r['out'].splitlines():
        line = line.strip()
        if not line or 'wtmp begins' in line:
            continue
        if any(k in line for k in ('reboot', 'shutdown')):
            parts = line.split()
            if len(parts) >= 2:
                rows.append({'action': parts[0], 'when': ' '.join(parts[1:])[:80]})
    if not rows:
        return jsonify({'ok': True, 'rows': [], 'note': (r['out'] or r['err'] or '')[:200]})
    ups = []
    r2 = _sudo(['uptime', '-s'], timeout=20)
    return jsonify({'ok': True, 'rows': rows[:30], 'boot_started': r2['out'].strip()})


# ================= 第五批: 接口监控(文件存储, 兼容 gunicorn 多 worker) =================
_CALL_FILE = '/opt/touchgal/data/api_calls.jsonl'
_CALL_FILE_MAX = 3000


def before_request_handler():
    try:
        g._rc_start = time.time()
    except Exception:
        pass
    return None


def after_request_handler(resp):
    try:
        path = request.path or ''
        if path.startswith('/assets') or path.startswith('/static/'):
            return resp
        start = getattr(g, '_rc_start', None)
        ms = int((time.time() - (start or time.time())) * 1000)
        rec = {'t': int(time.time()),
               'ts': time.strftime('%H:%M:%S', time.localtime()),
               'method': request.method or '',
               'path': path[:160],
               'code': resp.status_code,
               'ms': ms,
               'ip': (request.headers.get('X-Forwarded-For') or request.remote_addr or '').split(',')[0].strip()}
        _append_call(rec)
    except Exception as _e:
        import traceback; traceback.print_exc()
    return resp


def _append_call(rec):
    try:
        line = json.dumps(rec, ensure_ascii=False)
        with open(_CALL_FILE, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
        # 超限截断: 保留最近半
        if os.path.getsize(_CALL_FILE) > 3000000:
            head = _read_calls(0, 2000000)
            with open(_CALL_FILE, 'w', encoding='utf-8') as f:
                for r in head[-1500:]:
                    f.write(json.dumps(r, ensure_ascii=False) + '\n')
    except Exception as _e:
        import traceback; traceback.print_exc()


def _read_calls(limit=900):
    out = []
    try:
        with open(_CALL_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except Exception:
                    continue
    except Exception:
        pass
    return out[-limit:]


@sysfunc.route('/api-monitor/stats', methods=['GET'])
def api_monitor_stats():
    rules = []
    try:
        rules = list(current_app.url_map.iter_rules())
    except Exception:
        pass
    paths = set()
    methods = {}
    for r in rules:
        if r.rule.startswith('/static'):
            continue
        paths.add(r.rule)
        for m in (r.methods or ()):
            if m not in ('HEAD', 'OPTIONS'):
                methods[m] = methods.get(m, 0) + 1
    calls = _read_calls(3000)
    total = len(calls)
    ok = sum(1 for x in calls if x.get('code', 0) < 400)
    e4 = sum(1 for x in calls if 400 <= x.get('code', 0) < 500)
    e5 = sum(1 for x in calls if x.get('code', 0) >= 500)
    return jsonify({'routes_total': len(paths),
                    'methods': methods,
                    'calls_total': total, 'calls_ok': ok,
                    'calls_4xx': e4, 'calls_5xx': e5,
                    'recent': len(_read_calls(900)), 'sample': sorted(paths)[:40]})


@sysfunc.route('/api-monitor/calls', methods=['GET'])
def api_monitor_calls():
    limit = max(10, min(int(request.args.get('limit', 300) or 300), 900))
    items = _read_calls(limit)[::-1]
    return jsonify({'calls': items, 'left': len(items)})


@sysfunc.route('/api-monitor/clear', methods=['POST'])
def api_monitor_clear():
    try:
        with open(_CALL_FILE, 'w', encoding='utf-8') as f:
            f.write('')
    except Exception:
        pass
    return jsonify({'ok': True})
