#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""vpn 插件后端(接口库 v4) — 直接复用同目录旧 server.py 的全量逻辑。

v2ray/sing-box 代理 | wireguard | openvpn; 数据仍在插件 data/。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
import server as V  # 旧后端全量逻辑(仅 import, 不启动)


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _qstr(params, key, defval=''):
    return str(_p(params).get(key, defval) or defval).strip()


@rc.interface("vpn.env")
def vpn_env(params):
    wg = V._which('wg', 'wg-quick')
    v2 = V._which('v2ray', 'xray')
    sb = V._which('sing-box')
    ovpn = V._which('openvpn') or ('/usr/sbin/openvpn' if os.path.exists('/usr/sbin/openvpn') else None)
    return {'wireguard': bool(wg), 'wg_tool': wg, 'v2ray': bool(v2), 'v2ray_tool': v2,
            'sing_box': bool(sb), 'sing_box_tool': sb,
            'openvpn': bool(ovpn), 'openvpn_tool': ovpn,
            'easyrsa': os.path.exists(V.EASY_RSA),
            'sudo': V._sudo(['true'], timeout=10).get('ok', False)}


@rc.interface("vpn.overview")
def vpn_overview(params):
    cfg = V._read_conf()
    port = int(cfg.get('v2port', 1080) or 1080)
    active = cfg.get('active_name', '')
    v2_on = V._unit_active('v2-' + active) if active else False
    proxy_ip = V._socks_probe(port) if v2_on else None
    wg_ifaces = V._sh(['wg', 'show', 'interfaces'])['out'].strip().splitlines()
    ovpn_procs = []
    r = V._sh(['pgrep', '-af', 'openvpn --config'])
    ovpn_procs = [ln.split(' ', 1)[-1][:120] for ln in r['out'].splitlines()[:5]] if r['ok'] else []
    return {'direct_ip': V._direct_ip(), 'proxy_ip': proxy_ip,
            'channels': {
                'proxy': {'running': v2_on, 'name': active or '', 'port': port},
                'wireguard': {'running': bool(wg_ifaces), 'interfaces': wg_ifaces},
                'openvpn': {'running': bool(ovpn_procs), 'detail': ovpn_procs},
            },
            'nodes': len(V._load_json(V.NODES, [])),
            'subs': len(V._load_json(V.SUBS, [])),
            'mode': V._mode_status(port)}


@rc.interface("vpn.logs")
def vpn_logs(params):
    lines = max(10, min(int(_p(params).get('lines', 60) or 60), 500))
    parts = []
    r = V._sh(['journalctl', '-u', 'rcvpn-*', '-n', str(lines), '--no-pager'])
    if r['ok'] and r['out'].strip():
        parts.append(r['out'].strip())
    r = V._sh(['wg', 'show'])
    if r['ok'] and r['out'].strip():
        parts.append('-- wireguard --\n' + r['out'].strip())
    return {'log': '\n'.join(parts[-lines * 4:])}


@rc.interface("vpn.stop.all")
def vpn_stop_all(params):
    V._sudo(['systemctl', 'stop', 'rcvpn-*'], timeout=60)
    for i in V._sh(['wg', 'show', 'interfaces'])['out'].split():
        V._sudo(['wg-quick', 'down', i], timeout=60)
    for ln in V._sh(['pgrep', '-af', 'openvpn --config'])['out'].splitlines():
        pid = ln.split()[0]
        if pid.isdigit():
            V._sudo(['kill', pid], timeout=20)
    cfg = V._read_conf()
    cfg.pop('active_name', None)
    V._write_conf(cfg)
    return {'ok': True}


@rc.interface("vpn.v2.subs.list")
def vpn_v2_subs_list(params):
    return {'subs': V._load_json(V.SUBS, [])}


@rc.interface("vpn.v2.subs.save")
def vpn_v2_subs_save(params):
    store = V._load_json(V.SUBS, [])
    data = _p(params)
    url = _qstr(params, 'url')
    name = _qstr(params, 'name') or ('sub-%d' % int(__import__('time').time()))
    if not url.startswith('http'):
        _err('订阅地址需 http(s)')
    if any(s.get('url') == url for s in store):
        _err('订阅已存在')
    store.append({'name': name, 'url': url, 'added': int(__import__('time').time()),
                  'last_ok': None, 'nodes': 0, 'error': None})
    V._save_json(V.SUBS, store)
    return {'ok': True, 'store': store}


@rc.interface("vpn.v2.subs.delete")
def vpn_v2_subs_delete(params):
    store = V._load_json(V.SUBS, [])
    name = _qstr(params, 'name')
    store = [s for s in store if s.get('name') != name]
    V._save_json(V.SUBS, store)
    return {'ok': True, 'left': len(store)}


@rc.interface("vpn.v2.subs.refresh")
def vpn_v2_subs_refresh(params):
    import re
    import subprocess
    import time as _t  # noqa
    store = V._load_json(V.SUBS, [])
    all_nodes = V._load_json(V.NODES, [])
    total = len(all_nodes)
    for s in store:
        ok = False
        try:
            r = subprocess.run(['curl', '-sL', '-m', '30', s['url']],
                               capture_output=True, timeout=35)
            text = (r.stdout or b'').decode('utf-8', 'replace')
            raw = text
            if '://' not in raw:
                raw = V._b64d(text)
            new = 0
            for line in raw.splitlines():
                for m in re.findall(r'(vless|vmess|ss|anytls)://\S+', line):
                    n = V._parse_nodelink(m)
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
    V._save_json(V.NODES, all_nodes)
    V._save_json(V.SUBS, store)
    return {'ok': True, 'subs': store, 'total_nodes': total, 'added': total}


@rc.interface("vpn.v2.nodes.list")
def vpn_v2_nodes_list(params):
    qtext = _qstr(params, 'q')
    nodes = V._load_json(V.NODES, [])
    if qtext:
        nodes = [n for n in nodes if qtext.lower() in str(n.get('name', '')).lower()
                 or qtext.lower() in str(n.get('addr', '')).lower()
                 or qtext.lower() in (n.get('protocol') or '')]
    for n in nodes:
        n['engine'] = V._engine_for(n.get('protocol', ''))
    return {'nodes': nodes}


@rc.interface("vpn.v2.nodes.delete")
def vpn_v2_nodes_delete(params):
    data = _p(params)
    ids = data.get('ids') if isinstance(data.get('ids'), list) else [data.get('id')]
    nodes = V._load_json(V.NODES, [])
    keep = [n for n in nodes if n.get('_id') not in ids]
    V._save_json(V.NODES, keep)
    return {'ok': True, 'left': len(keep)}


@rc.interface("vpn.v2.nodes.test")
def vpn_v2_nodes_test(params):
    data = _p(params)
    ids = data.get('ids') if isinstance(data.get('ids'), list) else [data.get('id')]
    nodes = V._load_json(V.NODES, [])
    out = []
    for n in nodes:
        if n.get('_id') not in ids:
            continue
        lat = V._ping(n.get('addr') or '')
        n['latency'] = lat
        out.append({'_id': n['_id'], 'latency': lat,
                    'error': None if lat is not None else 'ping 失败'})
    V._save_json(V.NODES, nodes)
    return {'ok': True, 'results': out}


@rc.interface("vpn.v2.connect")
def vpn_v2_connect(params):
    import time
    cfg = V._read_conf()
    port = int(cfg.get('v2port', 1080) or 1080)
    data = _p(params)
    action = data.get('action', '')
    if action == 'disconnect':
        name = cfg.get('active_name', '')
        if name:
            V._stop_unit('v2-' + name)
        cfg.pop('active_name', None)
        V._write_conf(cfg)
        return {'ok': True, 'connected': False}
    node = None
    if data.get('id'):
        nodes = V._load_json(V.NODES, [])
        node = next((n for n in nodes if n['_id'] == data['id']), None)
    elif data.get('text'):
        node = V._parse_nodelink(data['text'])
    if not node:
        _err('节点不存在或链接无法解析')
    engine = V._engine_for(node.get('protocol', ''))
    name = V._sanitize(node['_id'])
    if engine == 'sing-box':
        binp = V._which('sing-box')
        if not binp:
            _err('该协议需要 sing-box, 未安装')
        cfgj = V._build_singbox_config(node, port)
        path = V._save_channel_cfg('v2-' + name, cfgj, 'sing')
        r = V._run_unit('v2-' + name, binp, ['run', '-c', path])
    else:
        binp = V._which('v2ray', 'xray')
        if not binp:
            _err('需要 v2ray/xray')
        cfgj = V._build_v2ray_config(node, port)
        cfgj = V._inject_stats(cfgj, name)
        path = V._save_channel_cfg('v2-' + name, cfgj, 'v2')
        r = V._run_unit('v2-' + name, binp, ['-config', path])
    if not r['ok']:
        _err('启动失败: %s' % r['err'][-300:])
    time.sleep(2)
    cfg['active_name'] = name
    cfg['active_node'] = node.get('_id', '')
    cfg['active_proto'] = node.get('protocol', '')
    V._write_conf(cfg)
    proxy_ip = V._socks_probe(port, timeout=12)
    return {'ok': True, 'engine': engine, 'proxy_ip': proxy_ip or None,
            'connected': bool(proxy_ip), 'mode': V._mode_status(port)}


@rc.interface("vpn.v2.status")
def vpn_v2_status(params):
    cfg = V._read_conf()
    port = int(cfg.get('v2port', 1080) or 1080)
    name = cfg.get('active_name', '')
    on = V._unit_active('v2-' + name) if name else False
    return {'connected': on, 'name': name or '', 'port': port,
            'proxy_ip': V._socks_probe(port) if on else None,
            'mode': V._mode_status(port)}


@rc.interface("vpn.wg.status")
def vpn_wg_status(params):
    r = V._sh(['sudo', '-n', 'wg', 'show'] if not os.environ.get('TOUCHGAL_SUDO_PW') else ['wg', 'show'])
    return {'ok': r['ok'], 'text': r['out'][:2000], 'err': r['err'][:200]}


@rc.interface("vpn.wg.import")
def vpn_wg_import(params):
    name = V._sanitize(_qstr(params, 'name'))
    text = _qstr(params, 'text')
    if not name or not text:
        _err('缺少名称或配置')
    os.makedirs(V.WG_ETC, exist_ok=True)
    path = os.path.join(V.WG_ETC, name + '.conf')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    os.chmod(path, 0o600)
    return {'ok': True, 'path': path}


@rc.interface("vpn.wg.up")
def vpn_wg_up(params):
    name = V._sanitize(_qstr(params, 'name'))
    r = V._sudo(['wg-quick', 'up', name], timeout=60)
    return {'ok': r['ok'], 'err': r['err'][:300]}


@rc.interface("vpn.wg.down")
def vpn_wg_down(params):
    name = V._sanitize(_qstr(params, 'name'))
    r = V._sudo(['wg-quick', 'down', name], timeout=60)
    return {'ok': r['ok'], 'err': r['err'][:300]}


@rc.interface("vpn.wg.server.get")
def vpn_wg_server_get(params):
    return V._load_json(V.WG_SRV, {})


@rc.interface("vpn.wg.server.save")
def vpn_wg_server_save(params):
    V._save_json(V.WG_SRV, _p(params))
    return {'ok': True}


@rc.interface("vpn.ovpn.status")
def vpn_ovpn_status(params):
    r = V._sh(['pgrep', '-af', 'openvpn --config'])
    procs = []
    if r['ok']:
        for ln in r['out'].splitlines():
            parts = ln.split(' ', 1)
            if len(parts) > 1:
                procs.append(parts[1][:120])
    return {'running': bool(procs), 'procs': procs}


@rc.interface("vpn.ovpn.import")
def vpn_ovpn_import(params):
    name = V._sanitize(_qstr(params, 'name'))
    text = _qstr(params, 'text')
    if not name or not text:
        _err('缺少名称或配置')
    os.makedirs(V.OVPN_CLIENT, exist_ok=True)
    path = os.path.join(V.OVPN_CLIENT, name + '.conf')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return {'ok': True, 'path': path}


@rc.interface("vpn.ovpn.up")
def vpn_ovpn_up(params):
    name = V._sanitize(_qstr(params, 'name'))
    conf = os.path.join(V.OVPN_CLIENT, name + '.conf')
    if not os.path.isfile(conf):
        _err('配置不存在: %s' % conf)
    binp = V._which('openvpn') or '/usr/sbin/openvpn'
    r = V._run_unit('ovpn-' + name, binp, ['--config', conf, '--daemon', 'off'])
    return {'ok': r['ok'], 'err': (r.get('err') or '')[:300]}


@rc.interface("vpn.ovpn.down")
def vpn_ovpn_down(params):
    name = V._sanitize(_qstr(params, 'name'))
    V._stop_unit('ovpn-' + name)
    return {'ok': True}


@rc.interface("vpn.info")
def vpn_info(params):
    return {'name': 'vpn', 'label': 'VPN 网络', 'version': '2.0.0', 'lang': 'python',
            'description': ('WireGuard/OpenVPN/v2ray(代理): 客户端+服务端、节点订阅、'
                            '一键连接与健康探测; 代理仅本机 127.0.0.1, 不开放内网共享')}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="vpn",
        version="2.0.0",
        manifest={"label": "VPN 网络", "description": "v2ray/wg/ovpn 网络管理"},
        frontend={"pages": [{"path": "", "title": "VPN 网络"}]},
        iface_ids=[
            "vpn.env", "vpn.overview", "vpn.logs", "vpn.stop.all",
            "vpn.v2.subs.list", "vpn.v2.subs.save", "vpn.v2.subs.delete", "vpn.v2.subs.refresh",
            "vpn.v2.nodes.list", "vpn.v2.nodes.delete", "vpn.v2.nodes.test",
            "vpn.v2.connect", "vpn.v2.status",
            "vpn.wg.status", "vpn.wg.import", "vpn.wg.up", "vpn.wg.down",
            "vpn.wg.server.get", "vpn.wg.server.save",
            "vpn.ovpn.status", "vpn.ovpn.import", "vpn.ovpn.up", "vpn.ovpn.down",
            "vpn.info",
        ],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )