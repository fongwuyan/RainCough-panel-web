#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""vpn 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

统一模型: 通道(Channel) = v2ray/sing-box 代理通道 | wireguard 隧道 | openvpn 隧道。
数据: 插件目录下 data/*.json 磁盘文件(vpn.conf / nodes.json / subs.json /
      wg_server.json / ovpn_server.json / run/), 密钥文件 0600, 与旧插件一致。
路由契约与旧面板一致(env/overview/logs/stop-all/v2/* /wg/* /ovpn/* /info)。
"""
import os
import re
import json
import time
import base64
import socket
import shutil
import subprocess
import urllib.parse
import http.server


PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())
ROOT = PLUGIN_DIR
DATA = os.path.join(PLUGIN_DIR, 'data')
CONF = os.path.join(PLUGIN_DIR, 'vpn.conf')
RUN = os.path.join(DATA, 'run')
NODES = os.path.join(DATA, 'nodes.json')
SUBS = os.path.join(DATA, 'subs.json')
WG_SRV = os.path.join(DATA, 'wg_server.json')
OVPN_SRV = os.path.join(DATA, 'ovpn_server.json')
WG_ETC = '/etc/wireguard'
OVPN_CLIENT = '/etc/openvpn/client'
OVPN_SERVER = '/etc/openvpn/server'
EASY_RSA = '/usr/share/easy-rsa/easyrsa'
DIRECT_URL = 'https://api.ipify.org'
SPEED_URL = 'https://speed.cloudflare.com/__down?bytes=10000000'


def _read_conf():
    cfg = {}
    try:
        with open(CONF, 'r', encoding='utf-8') as f:
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
    try:
        with open(CONF, 'w', encoding='utf-8') as f:
            for k, v in cfg.items():
                f.write('%s=%s\n' % (k, v))
        os.chmod(CONF, 0o600)
    except Exception:
        pass


def _load_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, type(default)) else default
    except Exception:
        return default


def _save_json(path, data):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.chmod(path, 0o600)
    except Exception:
        pass


def _sudo(args, timeout=120):
    pw = os.environ.get('TOUCHGAL_SUDO_PW') or _read_conf().get('sudo_pw', '') or ''
    cmd = ['sudo', '-S'] + list(args) if pw else ['sudo', '-n'] + list(args)
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                           input=(pw + '\n') if pw else None)
        return {'ok': r.returncode == 0, 'rc': r.returncode,
                'out': r.stdout, 'err': r.stderr}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'rc': None, 'out': '', 'err': '命令超时(max %ss)' % timeout}
    except Exception as e:
        return {'ok': False, 'rc': None, 'out': '', 'err': str(e)}


def _sh(args, timeout=60):
    try:
        r = subprocess.run(list(args), capture_output=True, text=True, timeout=timeout)
        return {'ok': r.returncode == 0, 'rc': r.returncode,
                'out': r.stdout, 'err': r.stderr}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'rc': None, 'out': '', 'err': '命令超时'}
    except Exception as e:
        return {'ok': False, 'rc': None, 'out': '', 'err': str(e)}


def _lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return ''


def _which(*names):
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


def _sanitize(s, length=24):
    return re.sub(r'[^A-Za-z0-9_-]+', '-', str(s or ''))[:length].strip('-') or 'chan'


def _run_unit(name, binpath, args, extra=()):
    """通过 systemd-run 启动本地通道进程(自动清场)。"""
    unit = 'rcvpn-' + _sanitize(name)
    args = [binpath] + list(args)
    cmd = ['systemd-run', '--unit=' + unit, '--collect',
           '-p', 'Restart=on-failure', '-p', 'User=%s' % (os.environ.get('USER') or 'f')] + list(extra)
    cmd += list(args)
    return _sudo(cmd, timeout=30)


def _stop_unit(name):
    unit = 'rcvpn-' + _sanitize(name)
    _sudo(['systemctl', 'stop', unit], timeout=30)
    _sudo(['systemctl', 'reset-failed', unit], timeout=20)


def _unit_active(name):
    unit = 'rcvpn-' + _sanitize(name)
    r = _sh(['systemctl', 'is-active', unit])
    return r['out'].strip() == 'active'


def _proxy_bind():
    return '127.0.0.1'


def _mode_status(port):
    return {'mode': 'local', 'bind': _proxy_bind(), 'lan_ip': _lan_ip(),
            'local_ip': '127.0.0.1', 'port': port}


def _socks_probe(port, timeout=10):
    try:
        r = subprocess.run(
            ['curl', '-s', '-m', str(timeout), '-x', 'socks5h://127.0.0.1:%d' % port, DIRECT_URL],
            capture_output=True, text=True, timeout=timeout + 5)
        ip = (r.stdout or '').strip()
        return ip if re.match(r'^\d{1,3}(\.\d{1,3}){3}$', ip) else ''
    except Exception:
        return ''


def _direct_ip(timeout=8):
    try:
        r = subprocess.run(['curl', '-s', '-m', str(timeout), DIRECT_URL],
                           capture_output=True, text=True, timeout=timeout + 5)
        ip = (r.stdout or '').strip()
        return ip if re.match(r'^\d{1,3}(\.\d{1,3}){3}$', ip) else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 节点解析(订阅)
# ---------------------------------------------------------------------------
def _b64d(s):
    try:
        s = s.strip()
        s += '=' * (-len(s) % 4)
        return base64.urlsafe_b64decode(s.encode()).decode('utf-8', 'replace')
    except Exception:
        return ''


def _parse_nodelink(link):
    """返回节点 dict 或 None。支持 ss:// vmess:// vless:// anytls://"""
    link = (link or '').strip()
    try:
        if link.startswith('vmess://'):
            raw = _b64d(link[8:].split('#')[0])
            d = json.loads(raw)
            mid = base64.b64encode(raw.encode(errors='ignore')).decode()
            import hashlib
            _id = 'vmess-%s.%s' % (re.sub(r'[^a-z0-9]', '', str(d.get('add', '')))[:32], d.get('port'))
            n = {'_id': _id, 'name': _id, 'protocol': 'vmess',
                 'addr': str(d.get('add', '')), 'port': int(d.get('port') or 0),
                 'uuid': d.get('id'), 'alter_id': int(d.get('aid') or 0),
                 'network': d.get('net', 'tcp'), 'path': d.get('path', ''),
                 'tls': d.get('tls') == 'tls', 'sni': d.get('host', ''), 'raw': link,
                 'imported': int(time.time())}
            return n
        if link.startswith('vless://') or link.startswith('anytls://'):
            p = urllib.parse.urlparse(link)
            host = p.hostname or ''
            port = p.port or 443
            q = urllib.parse.parse_qs(p.query)
            proto = p.scheme
            _id = '%s-%s-%s' % (proto, re.sub(r'[^a-z0-9]', '', host)[:32], port)
            n = {'_id': _id, 'name': _id, 'protocol': proto,
                 'addr': host, 'port': int(port),
                 'uuid': p.username or (q.get('id') or [''])[0] if proto == 'vless' else (p.password or (q.get('password') or [''])[0]),
                 'security': (q.get('security') or [''])[0],
                 'network': (q.get('type') or ['tcp'])[0], 'path': (q.get('path') or [''])[0],
                 'sni': (q.get('sni') or [''])[0], 'flow': (q.get('fp') or [''])[0],
                 'raw': link, 'imported': int(time.time())}
            return n
        if link.startswith('ss://'):
            rest = link[5:].split('#')[0]
            if '@' in rest:
                p = urllib.parse.urlparse('ss://' + rest)
                auth = urllib.parse.unquote(p.username or '')
                method, _, password = auth.partition(':')
                n = {'_id': 'ss-%s-%s' % (re.sub(r'[^a-z0-9]', '', p.hostname or '')[:32], p.port),
                     'name': 'ss', 'protocol': 'ss', 'addr': p.hostname or '', 'port': int(p.port or 0),
                     'method': method or 'aes-256-gcm', 'password': password,
                     'raw': link, 'imported': int(time.time())}
                return n
            raw = _b64d(rest)
            if '@' in raw:
                method, _, passhost = raw.partition(':')
                host, _, port = (passhost or '').rpartition(':')
                return {'_id': 'ss-%s-%s' % (re.sub(r'[^a-z0-9]', '', host)[:32], port),
                        'name': 'ss', 'protocol': 'ss', 'addr': host, 'port': int(port or 0),
                        'method': method or 'aes-256-gcm', 'password': '',
                        'raw': link, 'imported': int(time.time())}
    except Exception:
        pass
    return None


def _engine_for(proto):
    return 'sing-box' if proto in ('anytls',) else 'v2ray'


# ---------------------------------------------------------------------------
# 配置生成
# ---------------------------------------------------------------------------
def _v2ray_outbound(node):
    u = node
    if u['protocol'] == 'vmess':
        ob = {'protocol': 'vmess', 'tag': 'proxy',
              'settings': {'vnext': [{'address': u['addr'], 'port': u['port'],
                                      'users': [{'id': u.get('uuid'), 'alterId': u.get('alter_id', 0)}]}]}}
    elif u['protocol'] == 'vless':
        flow = u.get('flow', '') or ''
        vuser = {'id': u.get('uuid'), 'encryption': 'none'}
        if flow:
            vuser['flow'] = flow
        ob = {'protocol': 'vless', 'tag': 'proxy',
              'settings': {'vnext': [{'address': u['addr'], 'port': u['port'],
                                      'users': [vuser]}]}}
    else:
        ob = {'protocol': 'shadowsocks', 'tag': 'proxy',
              'settings': {'servers': [{'address': u['addr'], 'port': u['port'],
                                        'method': u.get('method', 'aes-256-gcm'),
                                        'password': u.get('password', '')}]}}
    net = u.get('network', 'tcp')
    stream = {'network': net}
    if net in ('ws', 'grpc'):
        stream['security'] = 'tls' if u.get('tls') else 'none'
        if net == 'ws':
            stream['wsSettings'] = {'path': u.get('path', '/'), 'headers': {'Host': u.get('sni', '')}}
        else:
            stream['grpcSettings'] = {'serviceName': u.get('path', '')}
    else:
        stream['security'] = 'tls' if u.get('tls') else 'none'
        if u.get('sni'):
            stream['tlsSettings'] = {'serverName': u['sni'], 'allowInsecure': True}
    ob['streamSettings'] = stream
    ob['mux'] = {'enabled': False}
    return ob


def _build_v2ray_config(node, port):
    out = _v2ray_outbound(node)
    out['tag'] = 'proxy'
    cfg = {'log': {'loglevel': 'warning'},
           'inbounds': [{'tag': 'socks-in', 'listen': _proxy_bind(), 'port': port,
                         'protocol': 'socks',
                         'settings': {'auth': 'noauth', 'udp': True}}],
           'outbounds': [out, {'protocol': 'freedom', 'tag': 'direct'}],
           'routing': {'rules': []}}   # 统计/API 路由由 _inject_stats 追加; 不用 geosite(需数据文件)
    return cfg


def _singbox_outbound(node):
    """anytls 走 sing-box(该版本 anytls 无 transport 字段)。"""
    u = node
    return {'type': 'anytls', 'tag': 'proxy',
            'server': u['addr'], 'server_port': u['port'],
            'password': u.get('password') or u.get('uuid') or '',
            'tls': {'enabled': True,
                    'server_name': u.get('sni') or u['addr']}}


def _build_singbox_config(node, port):
    cfg = {'log': {'level': 'warn'},
           'inbounds': [{'type': 'socks', 'tag': 'socks-in',
                         'listen': _proxy_bind(), 'listen_port': port, 'users': []}],
           'outbounds': [_singbox_outbound(node), {'type': 'direct', 'tag': 'direct'}],
           'route': {'rules': [{'rule_set': [], 'outbound': 'proxy'}]}}
    return cfg


def _save_channel_cfg(name, cfg, engine):
    path = os.path.join(RUN, _sanitize(name) + '.' + engine + '.json')
    _save_json(path, cfg)
    return path


def _ping(host):
    r = _sh(['ping', '-c', '1', '-W', '2', host])
    if not r['ok']:
        return None
    m = re.search(r'time[=<]([\d.]+)\s*ms', r['out'])
    return float(m.group(1)) if m else 0.0


def _inject_stats(cfg, name):
    cfg['stats'] = {}
    cfg['policy'] = {'system': {'statsInboundUplink': True, 'statsInboundDownlink': True,
                                'statsOutboundUplink': True, 'statsOutboundDownlink': True}}
    cfg['api'] = {'tag': 'api', 'services': ['StatsService']}
    inbounds = list(cfg.get('inbounds') or [])
    inbounds.append({'tag': 'api', 'listen': '127.0.0.1',
                     'port': 10085 + (sum(ord(ch) for ch in name) % 200),
                     'protocol': 'dokodemo-door',
                     'settings': {'address': '127.0.0.1'}})
    cfg['inbounds'] = inbounds
    rules = list((cfg.get('routing') or {}).get('rules') or [])
    rules.append({'type': 'field', 'inboundTag': ['api'], 'outboundTag': 'api'})
    cfg['routing'] = {'rules': rules}
    return cfg


def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "vpn/2.0"

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

    # ---- 路由: GET /env ----
    def _rt_env(self):
        wg = _which('wg', 'wg-quick')
        v2 = _which('v2ray', 'xray')
        sb = _which('sing-box')
        ovpn = shutil.which('openvpn') or ('/usr/sbin/openvpn' if os.path.exists('/usr/sbin/openvpn') else None)
        return 200, {
            'wireguard': bool(wg), 'wg_tool': wg,
            'v2ray': bool(v2), 'v2ray_tool': v2,
            'sing_box': bool(sb), 'sing_box_tool': sb,
            'openvpn': bool(ovpn), 'openvpn_tool': ovpn,
            'easyrsa': os.path.exists(EASY_RSA),
            'sudo': _sudo(['true'], timeout=10).get('ok', False),
        }

    # ---- 路由: GET /overview ----
    def _rt_overview(self):
        cfg = _read_conf()
        port = int(cfg.get('v2port', 1080) or 1080)
        active = cfg.get('active_name', '')
        v2_on = _unit_active('v2-' + active) if active else False
        proxy_ip = _socks_probe(port) if v2_on else None
        wg_ifaces = _sh(['wg', 'show', 'interfaces'])['out'].strip().splitlines()
        ovpn_procs = []
        r = _sh(['pgrep', '-af', 'openvpn --config'])
        ovpn_procs = [ln.split(' ', 1)[-1][:120] for ln in r['out'].splitlines()[:5]] if r['ok'] else []
        return 200, {
            'direct_ip': _direct_ip(),
            'proxy_ip': proxy_ip,
            'channels': {
                'proxy': {'running': v2_on, 'name': active or '', 'port': port},
                'wireguard': {'running': bool(wg_ifaces), 'interfaces': wg_ifaces},
                'openvpn': {'running': bool(ovpn_procs), 'detail': ovpn_procs},
            },
            'nodes': len(_load_json(NODES, [])),
            'subs': len(_load_json(SUBS, [])),
            'mode': _mode_status(port),
        }

    # ---- 路由: GET /logs ----
    def _rt_logs(self, q):
        lines = max(10, min(int(q.get('lines', 60) or 60), 500))
        parts = []
        r = _sh(['journalctl', '-u', 'rcvpn-*', '-n', str(lines), '--no-pager'])
        if r['ok'] and r['out'].strip():
            parts.append(r['out'].strip())
        r = _sh(['wg', 'show'])
        if r['ok'] and r['out'].strip():
            parts.append('-- wireguard --\n' + r['out'].strip())
        return 200, {'log': '\n'.join(parts[-lines * 4:])}

    # ---- 路由: POST /stop-all ----
    def _rt_stop_all(self):
        _sudo(['systemctl', 'stop', 'rcvpn-*'], timeout=60)
        for i in _sh(['wg', 'show', 'interfaces'])['out'].split():
            _sudo(['wg-quick', 'down', i], timeout=60)
        for ln in _sh(['pgrep', '-af', 'openvpn --config'])['out'].splitlines():
            pid = ln.split()[0]
            if pid.isdigit():
                _sudo(['kill', pid], timeout=20)
        cfg = _read_conf()
        cfg.pop('active_name', None)
        _write_conf(cfg)
        return 200, {'ok': True}

    # ---------------- v2ray/sing-box 代理 ----------------
    # ---- 路由: /v2/subs GET/POST/DELETE ----
    def _rt_subs_get(self):
        store = _load_json(SUBS, [])
        return 200, store

    def _rt_subs_post(self, body):
        store = _load_json(SUBS, [])
        data = body or {}
        url = str(data.get('url', '')).strip()
        name = str(data.get('name', '')).strip() or ('sub-%d' % int(time.time()))
        if not url.startswith('http'):
            return 400, {'error': '订阅地址需 http(s)'}
        if any(s.get('url') == url for s in store):
            return 409, {'error': '订阅已存在'}
        store.append({'name': name, 'url': url, 'added': int(time.time()),
                      'last_ok': None, 'nodes': 0, 'error': None})
        _save_json(SUBS, store)
        return 200, {'ok': True, 'store': store}

    def _rt_subs_delete(self, q):
        store = _load_json(SUBS, [])
        name = q.get('name', '')
        store = [s for s in store if s.get('name') != name]
        _save_json(SUBS, store)
        return 200, {'ok': True, 'left': len(store)}

    # ---- 路由: POST /v2/subs/refresh ----
    def _rt_subs_refresh(self):
        store = _load_json(SUBS, [])
        all_nodes = _load_json(NODES, [])
        total = len(all_nodes)
        for s in store:
            ok = False
            try:
                r = subprocess.run(['curl', '-sL', '-m', '30', s['url']],
                                   capture_output=True, timeout=35)
                text = (r.stdout or b'').decode('utf-8', 'replace')
                raw = text
                if '://' not in raw:
                    raw = _b64d(text)
                new = 0
                for line in raw.splitlines():
                    for m in re.findall(r'(vless|vmess|ss|anytls)://\S+', line):
                        n = _parse_nodelink(m)
                        if n and not any(x['_id'] == n['_id'] for x in all_nodes):
                            all_nodes.append(n)
                            new += 1
                s['last_ok'] = True
                s['nodes'] = new
                s['error'] = None
                total += new
                ok = True
            except Exception as e:
                s['error'] = str(e)[:160]
            s['last_ok'] = ok
        _save_json(NODES, all_nodes)
        _save_json(SUBS, store)
        return 200, {'ok': True, 'subs': store, 'total_nodes': total, 'added': total}

    # ---- 路由: GET /v2/nodes ----
    def _rt_nodes(self, q):
        qtext = q.get('q', '')
        nodes = _load_json(NODES, [])
        if qtext:
            nodes = [n for n in nodes if qtext.lower() in str(n.get('name', '')).lower()
                     or qtext.lower() in str(n.get('addr', '')).lower()
                     or qtext.lower() in (n.get('protocol') or '')]
        for n in nodes:
            n['engine'] = _engine_for(n.get('protocol', ''))
        return 200, nodes

    # ---- 路由: POST /v2/nodes/delete ----
    def _rt_nodes_delete(self, body):
        data = body or {}
        ids = data.get('ids') if isinstance(data.get('ids'), list) else [data.get('id')]
        nodes = _load_json(NODES, [])
        keep = [n for n in nodes if n.get('_id') not in ids]
        _save_json(NODES, keep)
        return 200, {'ok': True, 'left': len(keep)}

    # ---- 路由: POST /v2/nodes/test ----
    def _rt_nodes_test(self, body):
        data = body or {}
        ids = data.get('ids') if isinstance(data.get('ids'), list) else [data.get('id')]
        nodes = _load_json(NODES, [])
        out = []
        for n in nodes:
            if n.get('_id') not in ids:
                continue
            lat = _ping(n.get('addr') or '')
            n['latency'] = lat
            out.append({'_id': n['_id'], 'latency': lat,
                        'error': None if lat is not None else 'ping 失败'})
        for n in nodes:
            if n.get('latency') is not None:
                pass
        _save_json(NODES, nodes)
        return 200, {'ok': True, 'results': out}

    # ---- 路由: POST /v2/connect ----
    def _rt_v2_connect(self, body):
        cfg = _read_conf()
        port = int(cfg.get('v2port', 1080) or 1080)
        data = body or {}
        action = data.get('action', '')
        if action == 'disconnect':
            name = cfg.get('active_name', '')
            if name:
                _stop_unit('v2-' + name)
            cfg.pop('active_name', None)
            _write_conf(cfg)
            return 200, {'ok': True, 'connected': False}

        node = None
        if data.get('id'):
            nodes = _load_json(NODES, [])
            node = next((n for n in nodes if n['_id'] == data['id']), None)
        elif data.get('text'):
            node = _parse_nodelink(data['text'])
        if not node:
            return 404, {'error': '节点不存在或链接无法解析'}
        engine = _engine_for(node.get('protocol', ''))
        name = _sanitize(node['_id'])
        if engine == 'sing-box':
            binp = _which('sing-box')
            if not binp:
                return 400, {'error': '该协议需要 sing-box, 未安装'}
            cfgj = _build_singbox_config(node, port)
            path = _save_channel_cfg('v2-' + name, cfgj, 'sing')
            r = _run_unit('v2-' + name, binp, ['run', '-c', path])
        else:
            binp = _which('v2ray', 'xray')
            if not binp:
                return 400, {'error': '需要 v2ray/xray'}
            cfgj = _build_v2ray_config(node, port)
            cfgj = _inject_stats(cfgj, name)
            path = _save_channel_cfg('v2-' + name, cfgj, 'v2')
            r = _run_unit('v2-' + name, binp, ['-config', path])
        if not r['ok']:
            return 500, {'error': '启动失败: %s' % r['err'][-300:]}
        time.sleep(2)
        cfg['active_name'] = name
        cfg['active_node'] = node.get('_id', '')
        cfg['active_proto'] = node.get('protocol', '')
        _write_conf(cfg)
        proxy_ip = _socks_probe(port, timeout=12)
        return 200, {'ok': True, 'engine': engine, 'proxy_ip': proxy_ip or None,
                     'connected': bool(proxy_ip), 'mode': _mode_status(port)}

    # ---- 路由: GET /v2/status ----
    def _rt_v2_status(self):
        cfg = _read_conf()
        port = int(cfg.get('v2port', 1080) or 1080)
        name = cfg.get('active_name', '')
        on = _unit_active('v2-' + name) if name else False
        return 200, {'connected': on, 'name': name or '', 'port': port,
                     'proxy_ip': _socks_probe(port) if on else None,
                     'mode': _mode_status(port)}

    # ---------------- WireGuard ----------------
    # ---- 路由: GET /wg/status ----
    def _rt_wg_status(self):
        r = _sh(['sudo', '-n', 'wg', 'show'] if not os.environ.get('TOUCHGAL_SUDO_PW') else ['wg', 'show'])
        return 200, {'ok': r['ok'], 'text': r['out'][:2000], 'err': r['err'][:200]}

    # ---- 路由: POST /wg/import ----
    def _rt_wg_import(self, body):
        data = body or {}
        name = _sanitize(data.get('name', ''))
        text = str(data.get('text', '')).strip()
        if not name or not text:
            return 400, {'error': '缺少名称或配置'}
        os.makedirs(WG_ETC, exist_ok=True)
        path = os.path.join(WG_ETC, name + '.conf')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        os.chmod(path, 0o600)
        return 200, {'ok': True, 'path': path}

    # ---- 路由: POST /wg/up ----
    def _rt_wg_up(self, body):
        data = body or {}
        name = _sanitize(data.get('name', ''))
        r = _sudo(['wg-quick', 'up', name], timeout=60)
        return 200, {'ok': r['ok'], 'err': r['err'][:300]}

    # ---- 路由: POST /wg/down ----
    def _rt_wg_down(self, body):
        data = body or {}
        name = _sanitize(data.get('name', ''))
        r = _sudo(['wg-quick', 'down', name], timeout=60)
        return 200, {'ok': r['ok'], 'err': r['err'][:300]}

    # ---- 路由: /wg/server GET/POST ----
    def _rt_wg_server_get(self):
        return 200, _load_json(WG_SRV, {})

    def _rt_wg_server_post(self, body):
        data = body or {}
        _save_json(WG_SRV, data)
        return 200, {'ok': True}

    # ---------------- OpenVPN ----------------
    # ---- 路由: GET /ovpn/status ----
    def _rt_ovpn_status(self):
        r = _sh(['pgrep', '-af', 'openvpn --config'])
        procs = []
        if r['ok']:
            for ln in r['out'].splitlines():
                parts = ln.split(' ', 1)
                if len(parts) > 1:
                    procs.append(parts[1][:120])
        return 200, {'running': bool(procs), 'procs': procs}

    # ---- 路由: POST /ovpn/import ----
    def _rt_ovpn_import(self, body):
        data = body or {}
        name = _sanitize(data.get('name', ''))
        text = str(data.get('text', '')).strip()
        if not name or not text:
            return 400, {'error': '缺少名称或配置'}
        os.makedirs(OVPN_CLIENT, exist_ok=True)
        path = os.path.join(OVPN_CLIENT, name + '.conf')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        return 200, {'ok': True, 'path': path}

    # ---- 路由: POST /ovpn/up ----
    def _rt_ovpn_up(self, body):
        data = body or {}
        name = _sanitize(data.get('name', ''))
        conf = os.path.join(OVPN_CLIENT, name + '.conf')
        if not os.path.isfile(conf):
            return 404, {'error': '配置不存在: %s' % conf}
        binp = shutil.which('openvpn') or '/usr/sbin/openvpn'
        r = _run_unit('ovpn-' + name, binp, ['--config', conf, '--daemon', 'off'])
        return 200, {'ok': r['ok'], 'err': (r.get('err') or '')[:300]}

    # ---- 路由: POST /ovpn/down ----
    def _rt_ovpn_down(self, body):
        data = body or {}
        name = _sanitize(data.get('name', ''))
        _stop_unit('ovpn-' + name)
        return 200, {'ok': True}

    # ---- 路由: GET /info ----
    def _rt_info(self):
        return 200, {'name': 'vpn', 'label': 'VPN 网络', 'version': '2.0.0',
                     'lang': 'python',
                     'description': ('WireGuard/OpenVPN/v2ray(代理): 客户端+服务端、节点订阅、'
                                     '一键连接与健康探测; 代理仅本机 127.0.0.1, 不开放内网共享')}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/env":
                return self._json(*self._rt_env())
            if p == "/overview":
                return self._json(*self._rt_overview())
            if p == "/logs":
                return self._json(*self._rt_logs(q))
            if p == "/v2/subs":
                return self._json(*self._rt_subs_get())
            if p == "/v2/nodes":
                return self._json(*self._rt_nodes(q))
            if p == "/v2/status":
                return self._json(*self._rt_v2_status())
            if p == "/wg/status":
                return self._json(*self._rt_wg_status())
            if p == "/wg/server":
                return self._json(*self._rt_wg_server_get())
            if p == "/ovpn/status":
                return self._json(*self._rt_ovpn_status())
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
            if p == "/stop-all":
                return self._json(*self._rt_stop_all())
            if p == "/v2/subs":
                return self._json(*self._rt_subs_post(body))
            if p == "/v2/subs/refresh":
                return self._json(*self._rt_subs_refresh())
            if p == "/v2/nodes/delete":
                return self._json(*self._rt_nodes_delete(body))
            if p == "/v2/nodes/test":
                return self._json(*self._rt_nodes_test(body))
            if p == "/v2/connect":
                return self._json(*self._rt_v2_connect(body))
            if p == "/wg/import":
                return self._json(*self._rt_wg_import(body))
            if p == "/wg/up":
                return self._json(*self._rt_wg_up(body))
            if p == "/wg/down":
                return self._json(*self._rt_wg_down(body))
            if p == "/wg/server":
                return self._json(*self._rt_wg_server_post(body))
            if p == "/ovpn/import":
                return self._json(*self._rt_ovpn_import(body))
            if p == "/ovpn/up":
                return self._json(*self._rt_ovpn_up(body))
            if p == "/ovpn/down":
                return self._json(*self._rt_ovpn_down(body))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_DELETE(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/v2/subs":
                return self._json(*self._rt_subs_delete(q))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("vpn ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()