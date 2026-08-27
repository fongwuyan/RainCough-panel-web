#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""kvm 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

数据: 磁盘文件(插件目录下 kvm.conf / kvm_notes.json, 与旧插件一致)
上游: 系统 virsh/qemu-img/cloud-localds(Linux libvirt 环境)
路由契约与旧面板 api.js 完全一致(config/info/domains/domain/domain/stats/domain/note/
domain/action/domain/autostart/domain/vnc/images/storage)。
"""
import json
import os
import re
import shutil
import subprocess
import time
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

CONF_PATH = os.path.join(PLUGIN_DIR, 'kvm.conf')
NOTES_PATH = os.path.join(PLUGIN_DIR, 'kvm_notes.json')
IMAGE_DIR = '/var/lib/libvirt/images'
VNC_TOKEN_DIR = '/var/lib/libvirt/tokens'
VNC_BASE_PORT = 5900
NO_VNC_WSPORT = 6080

VIRSH = shutil.which('virsh') or '/usr/bin/virsh'
QEMU_IMG = shutil.which('qemu-img') or '/usr/bin/qemu-img'
CLOUD_LOCALDS = shutil.which('cloud-localds') or '/usr/bin/cloud-localds'

CONN = 'qemu:///system'


def _read_conf():
    cfg = {}
    try:
        with open(CONF_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                cfg[k.strip()] = v.strip()
    except Exception:
        pass
    return cfg


def _write_conf(cfg):
    with open(CONF_PATH, 'w', encoding='utf-8') as f:
        for k, v in cfg.items():
            f.write('%s=%s\n' % (k, v))
    try:
        os.chmod(CONF_PATH, 0o600)
    except Exception:
        pass


def _load_notes():
    try:
        with open(NOTES_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_notes(notes):
    try:
        with open(NOTES_PATH, 'w', encoding='utf-8') as f:
            json.dump(notes, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _run(args, timeout=30, sudo=False):
    cmd = [VIRSH, '-c', CONN] + args
    if sudo:
        cmd = ['sudo', '-S'] + cmd
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                           input=(_read_conf().get('sudo_pw', '') + '\n') if sudo else None)
        return r
    except subprocess.TimeoutExpired:
        return None
    except Exception:
        return None


def _virsh(args, timeout=30):
    r = _run(args, timeout, sudo=False)
    if r is None:
        return {'ok': False, 'error': 'virsh 命令超时'}
    if r.returncode != 0:
        r2 = _run(args, timeout, sudo=True)
        if r2 is not None and r2.returncode == 0:
            return {'ok': True, 'out': r2.stdout, 'via_sudo': True}
        return {'ok': False, 'error': (r.stderr or r.stdout or '').strip()[-500:]}
    return {'ok': True, 'out': r.stdout}


def _qemu_img(args, timeout=120):
    try:
        r = subprocess.run(['sudo', '-S', QEMU_IMG] + args, capture_output=True, text=True,
                           timeout=timeout, input=(_read_conf().get('sudo_pw', '') + '\n'))
        if r.returncode == 0:
            return {'ok': True, 'out': r.stdout}
        return {'ok': False, 'error': (r.stderr or '').strip()[-500:]}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': 'qemu-img 命令超时'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def _sudo_run(cmd, timeout=120):
    try:
        r = subprocess.run(['sudo', '-S'] + cmd, capture_output=True, text=True, timeout=timeout,
                           input=(_read_conf().get('sudo_pw', '') + '\n'))
        if r.returncode == 0:
            return {'ok': True, 'out': r.stdout}
        return {'ok': False, 'error': (r.stderr or '').strip()[-500:]}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': '命令超时'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def _err(msg):
    return 500, {'error': msg}


def _state_cn(s):
    s = (s or '').strip().lower()
    return {
        'running': '运行中', 'blocked': '阻塞', 'paused': '已暂停',
        'shutdown': '关机中', 'shut off': '已关闭', 'crashed': '崩溃',
        'dying': '关闭中', 'pmsuspended': '休眠',
    }.get(s, s or '未知')


def _parse_dom_list(text):
    result = []
    for line in text.splitlines():
        line = line.rstrip()
        if not line.strip():
            continue
        if 'Id' in line and ('名称' in line or '状态' in line or 'Name' in line):
            continue
        if re.match(r'^[\-\s]+$', line):
            continue
        m = re.match(r'^[ -]?\s*(\S+)\s+(\S+)\s+(.*)$', line)
        if not m:
            continue
        domid = m.group(1)
        name = m.group(2).strip()
        state = m.group(3).strip()
        if name in ('', '名称', '状态'):
            continue
        result.append({'id': domid, 'state': state, 'state_cn': _state_cn(state), 'name': name})
    return result


def _dumpxml(name, timeout=30):
    r = _virsh(['dumpxml', name], timeout)
    if not r['ok']:
        return None
    return r['out']


def _xml_field(xml, tag):
    m = re.search(r'<%s\b[^>]*>([^<]*)</%s>' % (tag, tag), xml)
    return m.group(1) if m else ''


def _xml_attr(xml, tag, attr):
    m = re.search(r'<%s\b[^>]*%s="([^"]*)"' % (tag, attr), xml) \
        or re.search(r"<%s\b[^>]*%s='([^']*)'" % (tag, attr), xml)
    return m.group(1) if m else ''


def _domain_detail(name):
    xml = _dumpxml(name)
    if xml is None:
        return None
    disks = []
    for m in re.finditer(r'<disk\b[^>]*>(.*?)</disk>', xml, re.S):
        block = m.group(1)
        dm = re.search(r"<target\b[^>]*dev='([^']+)'", block) or re.search(r'<target\b[^>]*dev="([^"]+)"', block)
        dev = dm.group(1) if dm else ''
        sm = re.search(r'<source\b[^>]*file="([^"]*)"', block) or re.search(r"<source\b[^>]*file='([^']*)'", block)
        src = sm.group(1) if sm else ''
        tm = re.search(r'<driver\b[^>]*type="([^"]*)"', block) or re.search(r"<driver\b[^>]*type='([^']*)'", block)
        dtype = tm.group(1) if tm else ''
        typ = re.search(r"<disk\b[^>]*device='([^']+)'", m.group(0)) or re.search(r'<disk\b[^>]*device="([^"]+)"', m.group(0))
        devtype = typ.group(1) if typ else ''
        disks.append({'dev': dev, 'src': src, 'type': dtype, 'device': devtype})
    ifaces = []
    for m in re.finditer(r'<interface\b[^>]*>(.*?)</interface>', xml, re.S):
        block = m.group(1)
        mm = re.search(r'<mac\b[^>]*address="([^"]*)"', block) or re.search(r"<mac\b[^>]*address='([^']*)'", block)
        mac = mm.group(1) if mm else ''
        nm = re.search(r'<source\b[^>]*network="([^"]*)"', block) or re.search(r"<source\b[^>]*network='([^']*)'", block)
        net = nm.group(1) if nm else ''
        ifaces.append({'mac': mac, 'network': net})
    gx = re.search(r'<graphics\b[^>]*type="vnc"[^>]*>', xml) or re.search(r"<graphics\b[^>]*type='vnc'[^>]*>", xml)
    vnc = None
    if gx:
        g = gx.group(0)
        pm = re.search(r'port="(\d+)"', g) or re.search(r"port='(\d+)'", g)
        am = re.search(r'autoport="([^"]*)"', g) or re.search(r"autoport='([^']*)'", g)
        vnc = {
            'port': pm.group(1) if pm else '',
            'autoport': am.group(1) if am else 'yes',
            'listen': _xml_attr(g, 'graphics', 'listen'),
        }
    return {
        'name': name,
        'uuid': _xml_field(xml, 'uuid'),
        'vcpu': _xml_field(xml, 'vcpu') or _xml_attr(xml, 'vcpu', 'current'),
        'memory_mb': str(int(_xml_field(xml, 'memory') or 0) // 1024),
        'autostart': False,
        'disks': disks,
        'ifaces': ifaces,
        'vnc': vnc,
        'title': _xml_field(xml, 'title'),
    }


def _ensure_vnc_xml(xml):
    if re.search(r"<graphics\b[^>]*type='vnc'", xml) or re.search(r'<graphics\b[^>]*type="vnc"', xml):
        return xml, True
    inject = ("<graphics type='vnc' port='-1' autoport='yes' listen='127.0.0.1'>"
              "<listen type='address' address='127.0.0.1'/></graphics>")
    if '</devices>' in xml:
        xml = xml.replace('</devices>', inject + '</devices>', 1)
    return xml, False


def _token_write(name, port):
    token_file = os.path.join(VNC_TOKEN_DIR, 'tokens')
    lines = {}
    r = _sudo_run(['cat', token_file], timeout=10)
    if r['ok']:
        for line in r['out'].splitlines():
            line = line.strip()
            if ':' in line:
                parts = line.split(':', 1)
                lines[parts[0].strip()] = parts[1].strip()
    lines[name] = '127.0.0.1:%d' % port
    body = ''.join('%s: %s\n' % (k, v) for k, v in lines.items())
    r = _sudo_run(['bash', '-c',
                   'mkdir -p %s && printf "%s" > %s.tmp && chmod 644 %s.tmp && mv %s.tmp %s'
                   % (VNC_TOKEN_DIR, body.replace('%', '%%').replace('"', '\\"'),
                      token_file, token_file, token_file, token_file)], timeout=10)
    return r['ok']


def _parse_domstats(text):
    stats = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('Domain:'):
            continue
        if '=' in line:
            key, _, val = line.partition('=')
        else:
            parts = line.split()
            if len(parts) < 2:
                continue
            key, val = parts[-2], parts[-1]
        if key and val.strip().isdigit():
            stats[key.strip()] = int(val.strip())
    return stats


def _domain_stats(name):
    rl = _virsh(['list'], timeout=20)
    running = bool(rl['ok'] and any(d['name'] == name for d in _parse_dom_list(rl['out'])))
    if not running:
        return {'running': False}

    # CPU + memory: sample cpu.time twice ~1s apart
    s0 = _virsh(['domstats', name, '--cpu-total', '--balloon'], timeout=20)
    if not s0['ok']:
        return {'running': True, 'error': s0['error']}
    st0 = _parse_domstats(s0['out'])
    time.sleep(1.0)
    s1 = _virsh(['domstats', name, '--cpu-total', '--balloon'], timeout=20)
    st1 = _parse_domstats(s1['out']) if s1['ok'] else st0

    cpu_pct = 0
    if 'cpu.time' in st0 and 'cpu.time' in st1:
        dt = (st1['cpu.time'] - st0['cpu.time']) / 1e9  # seconds of CPU used in ~1s
        cpu_pct = round(max(0.0, min(100.0, dt * 100.0)), 1)

    mem = {}
    if 'balloon.current' in st1:
        mem['current_kb'] = st1['balloon.current']
    if 'balloon.maximum' in st1:
        mem['maximum_kb'] = st1['balloon.maximum']
    if 'balloon.rss' in st1:
        mem['rss_kb'] = st1['balloon.rss']
    if 'balloon.available' in st1:
        mem['available_kb'] = st1['balloon.available']

    # network: per-interface rx/tx bytes (rates via two samples)
    net = []
    rf = _virsh(['domiflist', name], timeout=20)
    ifaces = []
    if rf['ok']:
        for line in rf['out'].splitlines()[2:]:
            parts = line.split()
            if parts and len(parts) >= 5:
                ifaces.append(parts[0])
    ifs0 = {}
    ifs1 = {}
    for iface in ifaces:
        r0 = _virsh(['domifstat', name, iface], timeout=20)
        if r0['ok']:
            p = _parse_domstats(r0['out'])
            ifs0[iface] = {'rx_bytes': p.get('rx_bytes', 0), 'tx_bytes': p.get('tx_bytes', 0)}
    if ifs0:
        time.sleep(1.0)
        for iface in ifaces:
            r1 = _virsh(['domifstat', name, iface], timeout=20)
            if r1['ok']:
                p = _parse_domstats(r1['out'])
                ifs1[iface] = {'rx_bytes': p.get('rx_bytes', 0), 'tx_bytes': p.get('tx_bytes', 0)}
    for iface in ifaces:
        a = ifs0.get(iface, {})
        b = ifs1.get(iface, a)
        net.append({
            'iface': iface,
            'rx_bytes': b.get('rx_bytes', 0),
            'tx_bytes': b.get('tx_bytes', 0),
            'rx_bps': max(0, b.get('rx_bytes', 0) - a.get('rx_bytes', 0)),
            'tx_bps': max(0, b.get('tx_bytes', 0) - a.get('tx_bytes', 0)),
        })

    # disk: per-device rd/wr bytes
    disk = []
    rd = _virsh(['domblklist', name], timeout=20)
    devs = []
    if rd['ok']:
        for line in rd['out'].splitlines()[2:]:
            parts = line.split()
            if parts and parts[0] not in ('目标', 'Target'):
                devs.append(parts[0])
    ds0 = {}
    ds1 = {}
    for dev in devs:
        r0 = _virsh(['domblkstat', name, dev], timeout=20)
        if r0['ok']:
            p = _parse_domstats(r0['out'])
            ds0[dev] = {'rd_bytes': p.get('rd_bytes', 0), 'wr_bytes': p.get('wr_bytes', 0)}
    if ds0:
        time.sleep(1.0)
        for dev in devs:
            r1 = _virsh(['domblkstat', name, dev], timeout=20)
            if r1['ok']:
                p = _parse_domstats(r1['out'])
                ds1[dev] = {'rd_bytes': p.get('rd_bytes', 0), 'wr_bytes': p.get('wr_bytes', 0)}
    for dev in devs:
        a = ds0.get(dev, {})
        b = ds1.get(dev, a)
        disk.append({
            'dev': dev,
            'rd_bytes': b.get('rd_bytes', 0),
            'wr_bytes': b.get('wr_bytes', 0),
            'rd_bps': max(0, b.get('rd_bytes', 0) - a.get('rd_bytes', 0)),
            'wr_bps': max(0, b.get('wr_bytes', 0) - a.get('wr_bytes', 0)),
        })

    return {
        'running': True,
        'cpu_pct': cpu_pct,
        'mem': mem,
        'net': net,
        'disk': disk,
    }


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "kvm/2.0"

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

    def _ws_url(self, name):
        host = (self.headers.get('Host') or '').split(':')[0] if self.headers.get('Host') else 'localhost'
        return 'ws://%s:%d/websockify?token=%s' % (host, NO_VNC_WSPORT, name)

    # ---- 路由: GET /config ----
    def _rt_config_get(self):
        return 200, _read_conf()

    # ---- 路由: POST /config ----
    def _rt_config_set(self, body):
        data = body or {}
        cfg = _read_conf()
        if 'sudo_pw' in data:
            cfg['sudo_pw'] = str(data.get('sudo_pw', '')).strip()
        _write_conf(cfg)
        return 200, {'ok': True}

    # ---- 路由: GET /info ----
    def _rt_info(self):
        rv = _run(['--version'], timeout=20)
        version = rv.stdout.strip() if rv and rv.returncode == 0 else None
        rd = _virsh(['list'], timeout=20)
        ra = _virsh(['list', '--all'], timeout=20)
        running = _parse_dom_list(rd['out']) if rd['ok'] else []
        all_list = _parse_dom_list(ra['out']) if ra['ok'] else []
        qemu_ver = None
        rr = _run(['version'], timeout=20)
        if rr and rr.returncode == 0:
            for line in rr.stdout.splitlines():
                if 'qemu' in line.lower() or 'emulator' in line.lower():
                    qemu_ver = line.strip()
                    break
        data = {
            'libvirt': version,
            'qemu': qemu_ver,
            'domains_total': len(all_list),
            'domains_running': len(running),
            'pools': len(_virsh(['pool-list'], timeout=20)['out'].splitlines()) - 2 if _virsh(['pool-list'], timeout=20)['ok'] else 0,
            'images_dir': IMAGE_DIR,
        }
        data.update({
            'name': 'kvm', 'label': 'KVM 虚拟机', 'version': '2.0.0',
            'lang': 'python', 'description': 'KVM/QEMU 虚拟机管理：列表、启停、详情、创建、VNC 控制台、存储池与镜像',
        })
        return 200, data

    # ---- 路由: GET /domains ----
    def _rt_domains(self):
        r = _virsh(['list', '--all'], timeout=20)
        if not r['ok']:
            return _err(r['error'])
        notes = _load_notes()
        items = _parse_dom_list(r['out'])
        for it in items:
            it['note'] = notes.get(it['name'], '')
        return 200, items

    # ---- 路由: GET /domain ----
    def _rt_domain(self, q):
        name = q.get('name', '')
        if not name:
            return _err('缺少 name')
        detail = _domain_detail(name)
        if detail is None:
            return _err('获取虚拟机信息失败')
        ra = _virsh(['domautostart', name], timeout=20)
        detail['autostart'] = bool(ra['ok'] and 'enable' in ra['out'])
        detail['note'] = _load_notes().get(name, '')
        return 200, detail

    # ---- 路由: GET /domain/stats ----
    def _rt_domain_stats(self, q):
        name = q.get('name', '')
        if not name:
            return _err('缺少 name')
        return 200, _domain_stats(name)

    # ---- 路由: GET /domain/note ----
    def _rt_domain_note_get(self, q):
        name = q.get('name', '')
        if not name:
            return _err('缺少 name')
        return 200, {'note': _load_notes().get(name, '')}

    # ---- 路由: POST /domain/note ----
    def _rt_domain_note_set(self, body):
        data = body or {}
        name = str(data.get('name', '')).strip()
        note = str(data.get('note', '')).strip()
        if not name:
            return _err('缺少 name')
        notes = _load_notes()
        if note:
            notes[name] = note
        else:
            notes.pop(name, None)
        _save_notes(notes)
        return 200, {'ok': True}

    # ---- 路由: POST /domain/action ----
    def _rt_domain_action(self, body):
        data = body or {}
        name = data.get('name', '')
        action = data.get('action', '')
        if not name:
            return _err('缺少 name')
        valid = ('start', 'shutdown', 'reboot', 'suspend', 'resume', 'destroy', 'undefine')
        if action not in valid:
            return _err('不支持的操作: %s' % action)
        args = [action, name]
        if action == 'undefine':
            args += ['--remove-all-storage']
            r = _virsh(args, timeout=120)
            if not r['ok']:
                return _err(r['error'])
            notes = _load_notes()
            if name in notes:
                notes.pop(name, None)
                _save_notes(notes)
            # ensure disk images gone (remove-all-storage may skip backing files)
            disk_path = os.path.join(IMAGE_DIR, name + '.qcow2')
            chk = _sudo_run(['ls', disk_path], timeout=10)
            if chk['ok']:
                _sudo_run(['rm', '-f', disk_path], timeout=30)
            for extra in (name + '-seed.iso', name + '-seed.img'):
                ep = os.path.join(IMAGE_DIR, extra)
                c2 = _sudo_run(['ls', ep], timeout=10)
                if c2['ok']:
                    _sudo_run(['rm', '-f', ep], timeout=30)
            return 200, {'ok': True}
        r = _virsh(args, timeout=120)
        if not r['ok']:
            return _err(r['error'])
        return 200, {'ok': True, 'via_sudo': r.get('via_sudo', False)}

    # ---- 路由: POST /domain/autostart ----
    def _rt_autostart(self, body):
        data = body or {}
        name = data.get('name', '')
        if not name:
            return _err('缺少 name')
        on = bool(data.get('on', True))
        r = _virsh(['autostart', '--' + ('enable' if on else 'disable'), name], timeout=20)
        if not r['ok']:
            return _err(r['error'])
        return 200, {'ok': True}

    # ---- 路由: POST /domain/vnc ----
    def _rt_vnc_enable(self, body):
        data = body or {}
        name = data.get('name', '')
        if not name:
            return _err('缺少 name')
        xml = _dumpxml(name)
        if xml is None:
            return _err('获取虚拟机 XML 失败')
        detail0 = _domain_detail(name)
        if detail0 is None:
            return _err('获取虚拟机信息失败')
        has_vnc = bool(detail0.get('vnc') and detail0['vnc'].get('port'))
        running = False
        rl = _virsh(['list'], timeout=20)
        if rl['ok']:
            running = any(d['name'] == name for d in _parse_dom_list(rl['out']))
        if not has_vnc:
            new_xml, _ = _ensure_vnc_xml(xml)
            tmp = '/tmp/%s.xml' % name
            with open(tmp, 'w', encoding='utf-8') as f:
                f.write(new_xml)
            r = _virsh(['define', tmp], timeout=30)
            os.remove(tmp)
            if not r['ok']:
                return _err(r['error'])
            if running:
                return 200, {'ok': True, 'need_reboot': True,
                             'message': 'VNC 已配置到持久 XML，运行中的虚拟机需重启后生效。'}
        detail = _domain_detail(name)
        port = None
        if detail and detail.get('vnc') and detail['vnc'].get('port'):
            port = detail['vnc']['port']
        if not port:
            rv = _virsh(['vncdisplay', name], timeout=20)
            if rv['ok']:
                mm = re.search(r':(\d+)', rv['out'])
                if mm:
                    port = str(VNC_BASE_PORT + int(mm.group(1)))
        if not port:
            return _err('未能获取 VNC 端口（虚拟机可能未运行或需重启）')
        if not _token_write(name, int(port)):
            return _err('写入 VNC token 失败')
        return 200, {'ok': True, 'port': port, 'ws': self._ws_url(name)}

    # ---- 路由: GET /domain/vnc ----
    def _rt_vnc_get(self, q):
        name = q.get('name', '')
        if not name:
            return _err('缺少 name')
        detail = _domain_detail(name)
        if detail is None:
            return _err('获取虚拟机信息失败')
        port = None
        if detail.get('vnc') and detail['vnc'].get('port'):
            port = detail['vnc']['port']
        else:
            rv = _virsh(['vncdisplay', name], timeout=20)
            if rv['ok']:
                mm = re.search(r':(\d+)', rv['out'])
                if mm:
                    port = str(VNC_BASE_PORT + int(mm.group(1)))
        if not port:
            return 200, {'ok': False, 'vnc': False}
        return 200, {'ok': True, 'vnc': True, 'port': port,
                     'ws': self._ws_url(name)}

    # ---- 路由: GET /images ----
    def _rt_images(self):
        r = _sudo_run(['bash', '-c', 'ls -1 "%s"' % IMAGE_DIR], timeout=20)
        if not r['ok']:
            return _err(r['error'])
        items = []
        for line in r['out'].splitlines():
            line = line.strip()
            if not line or line in ('.', '..'):
                continue
            items.append({'name': line})
        # attach sizes
        rs = _sudo_run(['bash', '-c', 'du -sb %s/* 2>/dev/null' % IMAGE_DIR], timeout=30)
        sizes = {}
        if rs['ok']:
            for line in rs['out'].splitlines():
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        sizes[os.path.basename(parts[1])] = int(parts[0])
                    except Exception:
                        pass
        for it in items:
            it['size'] = sizes.get(it['name'], 0)
        return 200, items

    # ---- 路由: GET /storage ----
    def _rt_storage(self):
        r = _virsh(['pool-list', '--all'], timeout=20)
        pools = []
        if r['ok']:
            for line in r['out'].splitlines()[2:]:
                line = line.strip()
                if not line or line.startswith('-'):
                    continue
                parts = line.split()
                if len(parts) >= 3:
                    pools.append({'name': parts[0], 'state': parts[1], 'autostart': parts[2]})
        vols = {}
        for p in pools:
            rv = _virsh(['vol-list', '--pool', p['name']], timeout=20)
            if rv['ok']:
                items = []
                for line in rv['out'].splitlines()[2:]:
                    line = line.strip()
                    if not line or '名称' in line or 'Name' in line or line.startswith('-'):
                        continue
                    parts = line.split()
                    if len(parts) >= 2:
                        items.append({'name': parts[0], 'path': parts[1]})
                vols[p['name']] = items
        return 200, {'pools': pools, 'volumes': vols}

    # ---- 路由: POST /domains(创建虚拟机) ----
    def _rt_create(self, body):
        data = body or {}
        name = str(data.get('name', '')).strip()
        if not name or not re.match(r'^[A-Za-z0-9_\-\.]{1,64}$', name):
            return _err('虚拟机名称不合法')
        vcpu = int(data.get('vcpu') or 2)
        mem = int(data.get('memory_mb') or 2048)
        template = str(data.get('template', '')).strip()
        iso = str(data.get('iso', '')).strip()
        seed_user = str(data.get('seed_user', '')).strip()
        seed_pw = str(data.get('seed_pw', '')).strip()
        start_now = bool(data.get('start', True))
        net = str(data.get('network', 'default')).strip() or 'default'

        existing = _virsh(['list', '--all'], timeout=20)
        if existing['ok'] and any(d['name'] == name for d in _parse_dom_list(existing['out'])):
            return _err('虚拟机 %s 已存在' % name)

        disk_path = os.path.join(IMAGE_DIR, name + '.qcow2')
        if template:
            tpath = os.path.join(IMAGE_DIR, template)
            fmt = 'qcow2' if tpath.endswith('.qcow2') else 'raw'
            r = _qemu_img(['create', '-f', 'qcow2', '-F', fmt, '-b', tpath, disk_path])
            if not r['ok']:
                return _err(r['error'])
        else:
            r = _qemu_img(['create', '-f', 'qcow2', disk_path, '8G'])
            if not r['ok']:
                return _err(r['error'])

        cdrom = ''
        seed_iso = os.path.join(IMAGE_DIR, name + '-seed.iso')
        if seed_user and seed_pw:
            ud = '#!/bin/bash\n'
            ud += 'useradd -m -s /bin/bash %s\n' % seed_user
            ud += 'echo %s:%s | chpasswd\n' % (seed_user, seed_pw)
            ud += 'usermod -aG sudo %s\n' % seed_user
            ud += 'printf "%%s ALL=(ALL) NOPASSWD:ALL\\n" %s > /etc/sudoers.d/99-%s\n' % (seed_user, seed_user)
            md = 'instance-id: %s\nlocal-hostname: %s\n' % (name, name)
            try:
                with open('/tmp/%s.md' % name, 'w', encoding='utf-8') as f:
                    f.write(md)
                with open('/tmp/%s.ud' % name, 'w', encoding='utf-8') as f:
                    f.write(ud)
            except Exception as e:
                return _err('写入 seed 文件失败: %s' % e)
            r = _sudo_run([CLOUD_LOCALDS, '-f', seed_iso,
                           '-u', '/tmp/%s.ud' % name, '/tmp/%s.md' % name], timeout=120)
            for tmp in ('/tmp/%s.md' % name, '/tmp/%s.ud' % name):
                try:
                    os.remove(tmp)
                except Exception:
                    pass
            if not r['ok']:
                return _err('生成 seed 失败: ' + r['error'])
            cdrom = "<disk type='file' device='cdrom'><driver name='qemu' type='raw'/>" \
                    "<source file='%s'/><target dev='hda' bus='ide'/><readonly/></disk>" % seed_iso
        elif iso:
            cdrom = "<disk type='file' device='cdrom'><driver name='qemu' type='raw'/>" \
                    "<source file='%s'/><target dev='hda' bus='ide'/><readonly/></disk>" % os.path.join(IMAGE_DIR, iso)

        mem_kb = mem * 1024
        xml = """<domain type='kvm'>
  <name>%s</name>
  <memory unit='KiB'>%d</memory>
  <currentMemory unit='KiB'>%d</currentMemory>
  <vcpu placement='static'>%d</vcpu>
  <os>
    <type arch='x86_64' machine='pc-i440fx-7.2'>hvm</type>
    <boot dev='hd'/>
  </os>
  <features><acpi/><apic/><pae/></features>
  <cpu mode='host-passthrough'/>
  <clock offset='utc'/>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>restart</on_crash>
  <devices>
    <emulator>/usr/bin/qemu-system-x86_64</emulator>
    <disk type='file' device='disk'>
      <driver name='qemu' type='qcow2'/>
      <source file='%s'/>
      <target dev='vda' bus='virtio'/>
    </disk>
    %s
    <interface type='network'>
      <source network='%s'/>
      <model type='virtio'/>
    </interface>
    <graphics type='vnc' port='-1' autoport='yes' listen='127.0.0.1'>
      <listen type='address' address='127.0.0.1'/>
    </graphics>
    <serial type='pty'><target port='0'/></serial>
    <console type='pty'><target type='serial' port='0'/></console>
  </devices>
</domain>""" % (name, mem_kb, mem_kb, vcpu, disk_path, cdrom, net)

        tmp = '/tmp/%s.xml' % name
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(xml)
        r = _virsh(['define', tmp], timeout=30)
        if not r['ok']:
            return _err(r['error'])
        os.remove(tmp)

        port = None
        if start_now:
            r = _virsh(['start', name], timeout=60)
            if not r['ok']:
                return _err(r['error'])
            time.sleep(2)
            rv = _virsh(['vncdisplay', name], timeout=20)
            if rv['ok']:
                mm = re.search(r':(\d+)', rv['out'])
                if mm:
                    port = str(VNC_BASE_PORT + int(mm.group(1)))
        return 200, {'ok': True, 'name': name, 'started': start_now, 'vnc_port': port}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/config":
                return self._json(*self._rt_config_get())
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/domains":
                return self._json(*self._rt_domains())
            if p == "/domain/note":
                return self._json(*self._rt_domain_note_get(q))
            if p == "/domain/stats":
                return self._json(*self._rt_domain_stats(q))
            if p == "/domain/vnc":
                return self._json(*self._rt_vnc_get(q))
            if p == "/domain":
                return self._json(*self._rt_domain(q))
            if p == "/images":
                return self._json(*self._rt_images())
            if p == "/storage":
                return self._json(*self._rt_storage())
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
            if p == "/config":
                return self._json(*self._rt_config_set(body))
            if p == "/domain/note":
                return self._json(*self._rt_domain_note_set(body))
            if p == "/domain/action":
                return self._json(*self._rt_domain_action(body))
            if p == "/domain/autostart":
                return self._json(*self._rt_autostart(body))
            if p == "/domain/vnc":
                return self._json(*self._rt_vnc_enable(body))
            if p == "/domains":
                return self._json(*self._rt_create(body))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("kvm ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()