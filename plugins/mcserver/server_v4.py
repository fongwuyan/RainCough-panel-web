#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mcserver 插件后端(接口库 v4) — 直接复用同目录旧 server.py 的全量逻辑。

覆盖核心: 实例管理/启停/重启/控制台/状态/监控/核心切换/Java。
未迁移(后续轮): SSE 流式控制台、世界打包下载/导入/恢复、mods 上传、core 安装、schedule。
"""
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
import server as M  # 旧后端全量逻辑(仅 import, 不启动)


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _inst(params):
    key = _p(params).get('inst')
    s = M.get_store()
    if not key:
        key = s.get('active', '')
    return s.get('instances', {}).get(key) if key else None


# ---------- 实例管理 ----------

@rc.interface("mcserver.instances.list")
def mc_instances_list(params):
    s = M.get_store()
    active = s.get('active', '')
    out = []
    running_count = 0
    for k, i in s.get('instances', {}).items():
        run = M._tmux_has(i)
        if run:
            running_count += 1
        _, props = M._read_props(i)
        out.append({'id': k, 'label': i.get('label', k), 'running': run, 'active': k == active,
                    'dir': i.get('dir', ''), 'port': i.get('port', 25565), 'jar': i.get('jar', ''),
                    'mem_max': i.get('mem_max', '4G'),
                    'version': props.get('version', '') if props else '',
                    'start_cmd': i.get('start_cmd', '')})
    return {'active': active, 'instances': out, 'total': len(out), 'running_count': running_count}


@rc.interface("mcserver.instance.detail")
def mc_instance_detail(params):
    inst = _inst(params)
    if inst is None:
        return {}
    return {'id': inst.get('id'), 'label': inst.get('label', inst.get('id')),
            'dir': inst.get('dir', ''), 'jar': inst.get('jar', ''), 'session': inst.get('session', ''),
            'port': inst.get('port', 25565), 'java': inst.get('java', ''),
            'mem_min': inst.get('mem_min', '2G'), 'mem_max': inst.get('mem_max', '4G'),
            'jvm_args': inst.get('jvm_args', ''), 'start_cmd': inst.get('start_cmd', ''),
            'rcon_enabled': bool(inst.get('rcon_enabled', False)),
            'rcon_port': inst.get('rcon_port', 25575),
            'auto_restart': bool(inst.get('auto_restart', False)),
            'install_state': inst.get('install_state'),
            'install_error': bool(inst.get('install_error', False)),
            'install_done': bool(inst.get('install_done', False))}


@rc.interface("mcserver.instance.add")
def mc_instance_add(params):
    data = _p(params)
    iid = str(data.get('id') or '').strip()
    if not iid or re.search(r'[\s/\\\\]', iid):
        _err('实例 ID 不能包含空格或 / \\')
    s = M.get_store()
    if iid in s.get('instances', {}):
        _err('实例已存在')
    s['instances'][iid] = {
        'id': iid,
        'label': str(data.get('label') or iid),
        'dir': os.path.expanduser(str(data.get('dir') or '/opt/mcserver').strip()),
        'jar': str(data.get('jar') or M.DEFAULT_JAR).strip() or M.DEFAULT_JAR,
        'session': str(data.get('session') or iid).strip(),
        'port': int(data.get('port') or 25565),
        'java': str(data.get('java') or M.DEFAULT_JAVA).strip(),
        'mem_min': str(data.get('mem_min') or '2G').strip() or '2G',
        'mem_max': str(data.get('mem_max') or '4G').strip() or '4G',
        'jvm_args': str(data.get('jvm_args') or '').strip(),
        'start_cmd': str(data.get('start_cmd') or '').strip(),
        'rcon_enabled': bool(data.get('rcon_enabled', False)),
        'rcon_port': int(data.get('rcon_port') or 25575),
        'rcon_password': str(data.get('rcon_password') or '').strip(),
        'auto_restart': bool(data.get('auto_restart', False)),
        'backup_interval_hours': int(data.get('backup_interval_hours') or 0),
        'backup_keep': int(data.get('backup_keep') or 10),
        'restart_at': str(data.get('restart_at') or '').strip(),
    }
    M._ensure_dir(s['instances'][iid]['dir'])
    M._save()
    return {'ok': True, 'id': iid}


@rc.interface("mcserver.instance.update")
def mc_instance_update(params):
    data = _p(params)
    iid = str(data.get('id') or '')
    s = M.get_store()
    if iid not in s.get('instances', {}):
        _err('实例不存在')
    i = s['instances'][iid]
    for field in ('label', 'dir', 'jar', 'session', 'java', 'mem_min', 'mem_max'):
        if data.get(field) is not None and str(data[field]).strip():
            i[field] = str(data[field]).strip()
    for field in ('jvm_args', 'start_cmd'):
        if data.get(field) is not None:
            i[field] = str(data[field]).strip()
    for field in ('rcon_password', 'restart_at'):
        if data.get(field) is not None and str(data[field]).strip():
            i[field] = str(data[field]).strip()
    for field in ('port', 'rcon_port', 'backup_interval_hours', 'backup_keep'):
        if data.get(field) is not None:
            try:
                i[field] = int(data[field])
            except (TypeError, ValueError):
                pass
    for field in ('rcon_enabled', 'auto_restart'):
        if data.get(field) is not None:
            i[field] = bool(data[field])
    M._save()
    return {'ok': True, 'id': iid}


@rc.interface("mcserver.instance.remove")
def mc_instance_remove(params):
    iid = str(_p(params).get('id') or '')
    s = M.get_store()
    if iid not in s.get('instances', {}):
        _err('实例不存在')
    if iid == s.get('active') and s.get('active'):
        if len(s.get('instances', {})) > 1:
            _err('请先切换到其他实例再删除，或将当前实例设空')
    if M._tmux_has(s['instances'][iid]):
        _err('请先停止该实例')
    del s['instances'][iid]
    if s.get('active') == iid:
        s['active'] = ''
    M._save()
    return {'ok': True}


@rc.interface("mcserver.instance.set")
def mc_instance_set(params):
    iid = str(_p(params).get('id') or '')
    s = M.get_store()
    if iid not in s.get('instances', {}):
        _err('实例不存在')
    s['active'] = iid
    M._save()
    return {'ok': True, 'active': iid}


@rc.interface("mcserver.instance.clear_active")
def mc_instance_clear_active(params):
    s = M.get_store()
    s['active'] = ''
    M._save()
    return {'ok': True}


@rc.interface("mcserver.javas")
def mc_javas(params):
    return {'javas': M._installed_java()}


# ---------- 状态/启停 ----------

@rc.interface("mcserver.status")
def mc_status(params):
    inst = _inst(params)
    if inst is None:
        return {'running': False, 'inst': None, 'inst_label': '', 'port': '', 'host': M.HOST_IP,
                'players': [], 'player_count': 0}
    running = M._running(inst)
    _, p = M._read_props(inst)
    props = p or {}
    players = M._online_players(inst) if running else []
    return {'running': running, 'pid': M._pid(inst) if running else None,
            'players': players, 'player_count': len(players),
            'max_players': props.get('max-players', '20'),
            'port': props.get('server-port') or inst.get('port', 25565), 'host': M.HOST_IP,
            'version': props.get('version', ''), 'motd': props.get('motd', ''),
            'online_mode': props.get('online-mode', 'true'),
            'whitelist_enabled': props.get('white-list', 'false'),
            'game_mode': props.get('gamemode', 'survival'),
            'difficulty': props.get('difficulty', 'easy'),
            'inst': inst.get('id'), 'inst_label': inst.get('label', inst.get('id')),
            'tps': M._tps(inst) if running else None, 'uptime': M._uptime(inst)}


@rc.interface("mcserver.start")
def mc_start(params):
    inst = _inst(params)
    if inst is None:
        _err('未指定或未找到实例')
    if M._tmux_has(inst):
        return {'ok': True, 'message': '服务器已在运行'}
    M._apply_rcon(inst)
    ok, err = M._launch(inst)
    M._set_wanted(inst['id'], True)
    if not ok:
        _err(err)
    return {'ok': True, 'message': '服务器启动中，等待加载世界...'}


@rc.interface("mcserver.stop")
def mc_stop(params):
    data = _p(params)
    inst = _inst(params)
    if inst is None:
        _err('未指定或未找到实例')
    force = bool(data.get('force', False))
    M._set_wanted(inst['id'], False)
    if not M._tmux_has(inst):
        return {'ok': True, 'message': '服务器未运行'}
    M._REBOOTING.discard(inst['id'])
    if force:
        r = M._run(['tmux', 'kill-session', '-t', inst['session']], timeout=10)
        if r is None or r.returncode != 0:
            _err('强杀失败')
        return {'ok': True, 'message': '已强制停止'}
    if not M._tmux_send(inst, 'stop'):
        _err('发送 stop 失败')
    return {'ok': True, 'message': '已发送停止命令，正在保存存档...'}


@rc.interface("mcserver.restart")
def mc_restart(params):
    inst = _inst(params)
    if inst is None:
        _err('未指定或未找到实例')
    M._set_wanted(inst['id'], True)
    if M._tmux_has(inst):
        M._REBOOTING.add(inst['id'])
        M._tmux_send(inst, 'stop')
        for _ in range(30):
            time.sleep(1)
            if not M._tmux_has(inst):
                break
        M._REBOOTING.discard(inst['id'])
    ok, err = M._launch(inst)
    if not ok:
        _err('重启失败: %s' % err)
    M._REBOOTING.discard(inst['id'])
    return {'ok': True, 'message': '服务器重启中'}


# ---------- 控制台(轮询替代 SSE) ----------

@rc.interface("mcserver.console.get")
def mc_console_get(params):
    inst = _inst(params)
    if inst is None or not M._tmux_has(inst):
        return {'running': False, 'log': '服务器未运行'}
    return {'running': True, 'log': M._tmux_capture(inst, lines)}


@rc.interface("mcserver.console.send")
def mc_console_send(params):
    inst = _inst(params)
    if inst is None:
        _err('未指定或未找到实例')
    cmd = str(_p(params).get('command', '')).strip()
    if not cmd:
        _err('命令为空')
    ok, echo = M._command(inst, cmd)
    if not ok:
        _err(echo)
    return {'ok': True, 'echo': echo}


@rc.interface("mcserver.metrics")
def mc_metrics(params):
    inst = _inst(params)
    M._sample(inst)
    S = M._SAMPLES
    return {'running': M._running(inst), 'cpu': round(S['cpu'], 1),
            'mem_used': round(S['mem_used'], 1), 'mem_total': round(S['mem_total'], 1),
            'mem_percent': round(S['mem_percent'], 1), 'jvm_cpu': round(S['jvm_cpu'], 1),
            'jvm_rss_mb': round(S['jvm_rss'] / 1024 / 1024, 1),
            'disk_total': S['disk_total'], 'disk_free': S['disk_free'],
            'hist_cpu': S['hist_cpu'][-30:], 'hist_mem': S['hist_mem'][-30:],
            'hist_players': S['hist_players'][-30:]}


# ---------- 核心切换 ----------

@rc.interface("mcserver.core.jars")
def mc_core_jars(params):
    inst = _inst(params)
    if not inst:
        _err('未指定或未找到实例')
    if inst.get('managed_by_agent'):
        ok, data = M._agent_get('/api/core?action=list')
        if not ok:
            _err('无法连接 folia-agent: %s' % data.get('error', ''))
        return data
    return {'ok': True, 'current': inst.get('jar', ''), 'jars': M._scan_inst_jars(inst)}


@rc.interface("mcserver.core.switch")
def mc_core_switch(params):
    inst = _inst(params)
    if not inst:
        _err('未指定或未找到实例')
    jar = str(_p(params).get('jar') or '').strip()
    if not jar:
        _err('缺少 jar 参数')
    if inst.get('managed_by_agent'):
        ok, res = M._agent_get('/api/core?action=switch&jar=%s' % jar)
        if not ok:
            _err('无法连接 folia-agent: %s' % res.get('error', ''))
        if not res.get('ok'):
            _err(res.get('msg', '切换失败'))
        return res
    res = M._switch_inst_core(inst, jar)
    if not res.get('ok'):
        _err(res.get('msg', '切换失败'))
    return res


@rc.interface("mcserver.info")
def mc_info(params):
    return {'name': 'mcserver', 'label': 'MC 服务器', 'version': '2.0.0', 'lang': 'python',
            'description': 'Minecraft Java 服务器管理: 多实例/启停/控制台/监控/核心切换'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="mcserver",
        version="2.0.0",
        manifest={"label": "MC 服务器", "description": "多实例 MC 服务器管理"},
        frontend={"pages": [{"path": "", "title": "MC 服务器"}]},
        iface_ids=[
            "mcserver.instances.list", "mcserver.instance.detail", "mcserver.instance.add",
            "mcserver.instance.update", "mcserver.instance.remove", "mcserver.instance.set",
            "mcserver.instance.clear_active", "mcserver.javas", "mcserver.status",
            "mcserver.start", "mcserver.stop", "mcserver.restart",
            "mcserver.console.get", "mcserver.console.send", "mcserver.metrics",
            "mcserver.core.jars", "mcserver.core.switch", "mcserver.info",
        ],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )