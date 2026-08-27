#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mcserver 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

多实例 Minecraft 服务器: 实时控制台、监控、RCON、玩家/世界/Mod 管理、崩溃守护、
完整 server.properties 配置、核心(vanilla/paper/folia/purpur/fabric/forge/neoforge)安装切换。
数据存 /opt/touchgal/data/mc.json(与旧面板一致)。上传(世界导入/Mod 上传)经 multipart
解析; /stream 以 SSE 流式输出控制台日志。路由契约与旧面板 api.js 完全一致。
"""
import os
import re
import json
import time
import gzip
import glob
import shutil
import struct
import socket
import random
import string
import base64
import tempfile
import zipfile
import subprocess
import threading
import urllib.request
import urllib.error
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

DATA_DIR = '/opt/touchgal/data'
CONFIG_PATH = os.path.join(DATA_DIR, 'mc.json')
DEFAULT_JAR = 'fabric-server-launcher.jar'
DEFAULT_JAVA = '/opt/envs/java-21/bin/java'
HOST_IP = '192.168.2.200'
SUDO_PASS = os.environ.get('TOUCHGAL_SUDO_PASS', '1')
ENVS_JSON = os.path.join(DATA_DIR, 'envs.json')
AGENT_URL = 'http://127.0.0.1:3100'
AGENT_TOKEN = 'folia-agent-token-2026'


def _agent_get(path):
    """调用 folia-agent, 返回 (ok, data)。"""
    try:
        req = urllib.request.Request(AGENT_URL + path,
                                     headers={'X-Agent-Token': AGENT_TOKEN})
        with urllib.request.urlopen(req, timeout=20) as r:
            return True, json.loads(r.read().decode('utf-8', 'ignore'))
    except Exception as e:
        return False, {'error': str(e)}


def _installed_java():
    """读取环境包注册，返回已安装的 JDK 列表 [{name, version, java_home, bin}]。"""
    try:
        if not os.path.isfile(ENVS_JSON):
            return []
        with open(ENVS_JSON, 'r', encoding='utf-8') as f:
            reg = json.load(f)
    except Exception:
        return []
    out = []
    for name, meta in reg.items():
        if meta.get('type') not in ('java',) or meta.get('status') != 'installed':
            continue
        root = meta.get('root', '')
        if not root or not os.path.isdir(root):
            continue
        jhome = meta.get('java_home') or root
        bindir = os.path.join(jhome, 'bin')
        java_bin = os.path.join(bindir, 'java')
        if not os.path.isfile(java_bin):
            # 兜底查找
            for base, dirs, files in os.walk(root):
                if 'java' in files and os.path.isfile(os.path.join(base, 'java')):
                    java_bin = os.path.join(base, 'java')
                    bindir = base
                    break
            else:
                continue
        out.append({'name': name, 'version': meta.get('version', ''),
                    'java_home': jhome, 'bin': java_bin})
    return out


_LOCK = threading.Lock()
_STORE = None
_SAMPLES = {'cpu': 0.0, 'mem_used': 0.0, 'mem_total': 0.0, 'mem_percent': 0.0,
            'jvm_cpu': 0.0, 'jvm_rss': 0, 'disk_total': 0, 'disk_free': 0,
            'hist_cpu': [], 'hist_mem': [], 'hist_players': []}
_ONLINE = {}
_REBOOTING = set()
_last_backup_ts = {}


# ---------------- 配置持久化 ----------------
def _default_store():
    return {'active': '', 'instances': {}}


def get_store():
    global _STORE
    if _STORE is not None:
        return _STORE
    with _LOCK:
        if _STORE is not None:
            return _STORE
        if os.path.isfile(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                for k, v in _default_store().items():
                    loaded.setdefault(k, v)
                if not isinstance(loaded.get('instances'), dict):
                    loaded['instances'] = {}
                # 迁移：移除从未改动的默认 default 实例
                dflt = loaded.get('instances', {}).get('default')
                if isinstance(dflt, dict) and dflt.get('label', '') == '主服务器' \
                        and dflt.get('dir', '') == '/opt/mcserver' \
                        and dflt.get('session', '') == 'mcserver' \
                        and 'started' not in dflt:
                    loaded['instances'].pop('default', None)
                # 清掉指向不存在实例的 active
                if loaded.get('active') not in loaded.get('instances', {}):
                    loaded['active'] = ''
                _STORE = loaded
            except Exception:
                _STORE = _default_store()
        else:
            _STORE = _default_store()
        _save()
    return _STORE


def _save():
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(_STORE, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


# ---------------- 基础进程工具 ----------------
def _run(args, timeout=30, cwd=None):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=timeout, cwd=cwd)
    except subprocess.TimeoutExpired:
        return None


def _run_sudo(args, timeout=30):
    """以 sudo 运行命令，密码经 stdin 传入（用于创建 /opt 下由 root 拥有的目录）。"""
    try:
        return subprocess.run(['sudo', '-S', '-p', ''] + list(args),
                              input=SUDO_PASS + '\n', capture_output=True,
                              text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return None


def _ensure_dir(path):
    """创建实例目录并授予 touchgal 运行用户写权限。目录/父目录由 root 拥有时用 sudo。"""
    path = os.path.abspath(os.path.expanduser(path))
    if not os.path.isdir(path):
        r = _run_sudo(['mkdir', '-p', path], timeout=30)
        if r is None or r.returncode != 0:
            try:
                os.makedirs(path, exist_ok=True)
            except OSError:
                return False
    # 授写权限给当前运行用户（touchgal 用户，如 f）
    uid = os.getuid() if hasattr(os, 'getuid') else None
    if uid is not None:
        try:
            r = _run_sudo(['chown', '-R', str(uid), path], timeout=30)
            if r is not None and r.returncode != 0:
                os.chown(path, uid, -1)
        except OSError:
            try:
                os.chown(path, uid, -1)
            except OSError:
                pass
    return os.path.isdir(path)


def _tmux_has(inst):
    r = _run(['tmux', 'has-session', '-t', inst['session']], timeout=8)
    return r is not None and r.returncode == 0


def _tmux_capture(inst, lines=200):
    r = _run(['tmux', 'capture-pane', '-p', '-t', inst['session'], '-S', '-%d' % lines], timeout=15)
    if r is None or r.returncode != 0:
        return ''
    return r.stdout.rstrip('\n')


def _tmux_send(inst, cmd):
    r = _run(['tmux', 'send-keys', '-t', inst['session'], cmd, 'Enter'], timeout=10)
    return r is not None and r.returncode == 0


def _pid(inst):
    if not _tmux_has(inst):
        return None
    jar = inst.get('jar', DEFAULT_JAR)
    r = _run(['pgrep', '-f', re.escape(jar)])
    if r and r.returncode == 0:
        pids = [l.strip() for l in r.stdout.splitlines() if l.strip()]
        return pids[0] if pids else None
    return None


def _running(inst):
    return _tmux_has(inst)


def _start_cmdline(inst):
    # 自定义完整启动命令优先
    custom = inst.get('start_cmd')
    if custom and custom.strip():
        return custom.strip()
    jvm = inst.get('jvm_args') or ''
    if jvm and not jvm.strip():
        jvm = ''
    return ('%s -Xms%s -Xmx%s %s -jar %s nogui' % (
        inst.get('java', DEFAULT_JAVA),
        inst.get('mem_min', '2G'),
        inst.get('mem_max', '4G'),
        jvm.strip(),
        inst.get('jar', DEFAULT_JAR),
    )).replace('  ', ' ').replace('  ', ' ').strip()


def _paper_config_files(inst):
    d = inst.get('dir', '') or ''
    return [
        os.path.join(d, 'config', 'paper-global.yml'),
        os.path.join(d, 'config', 'paper-world-defaults.yml'),
        os.path.join(d, 'world', 'paper-world-defaults.yml'),
        os.path.join(d, 'world_nether', 'paper-world-defaults.yml'),
        os.path.join(d, 'world_the_end', 'paper-world-defaults.yml'),
    ]


def _clear_paper_config(inst):
    """移除由旧核心/旧版本生成的 Paper 配置，让当前 jar 启动时按自身 schema 重新生成。
    不同 Paper 版本对这些数值键的 `default` 字面量支持不同，混用会导致启动即崩溃
    (NumberFormatException:  For input string: "default")。"""
    for p in _paper_config_files(inst):
        try:
            if os.path.isfile(p):
                os.remove(p)
        except OSError:
            pass


def _maybe_reset_cfg_for_jar(inst):
    """若记录的 config 生成 jar 与当前 jar 不一致，清掉旧 Paper 配置并更新记录。"""
    jar = inst.get('jar', DEFAULT_JAR)
    prev = inst.get('paper_config_jar', '')
    if prev != jar:
        _clear_paper_config(inst)
    try:
        store = get_store()
        i = store['instances'].get(inst.get('id'))
        if i is not None:
            i['paper_config_jar'] = jar
            _save()
    except Exception:
        pass


def _launch(inst):
    jar = os.path.join(inst['dir'], inst.get('jar', DEFAULT_JAR))
    if not inst.get('start_cmd') and not os.path.isfile(jar):
        return False, '找不到 %s' % jar
    # 切换过核心/版本后清掉不兼容的 Paper 配置，避免启动即崩溃并被守护反复拉起
    _maybe_reset_cfg_for_jar(inst)
    # 自动同意 EULA，避免 eula=false 导致启动即崩溃并被守护反复拉起
    _ensure_eula(inst)
    r = _run(['tmux', 'new-session', '-d', '-s', inst['session'], '-c', inst['dir'], _start_cmdline(inst)], timeout=15)
    if r is None or r.returncode != 0:
        return False, r.stderr if r else 'timeout'
    return True, ''


def _scan_inst_jars(inst):
    """扫描实例目录下 *.jar, 返回 [{name,size,time,version}]。"""
    d = inst.get('dir', '') or ''
    out = []
    if not d or not os.path.isdir(d):
        return out
    m_re = re.compile(r'^(?:paper|folia|spigot|purpur|fabric|vanilla|paperspigot|bukkit|settings)-'
                      r'?([0-9]+(?:\.[0-9]+)*[a-zA-Z0-9.\-]*)\.jar$')
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.jar'):
            continue
        fp = os.path.join(d, fn)
        try:
            st = os.stat(fp)
        except OSError:
            continue
        mm = m_re.match(fn)
        ver = (mm.group(1) if mm else fn[:-4])
        out.append({'name': fn, 'size': st.st_size,
                    'time': int(st.st_mtime), 'version': ver})
    return out


def _switch_inst_core(inst, jar):
    """按实例切换核心(重启生效): 校验存在 -> 停服 -> 更新 jar/start_cmd -> 保存 -> 启动。"""
    if not jar.endswith('.jar'):
        return {'ok': False, 'msg': 'jar 名必须以 .jar 结尾'}
    fp = os.path.join(inst['dir'], jar)
    if not os.path.isfile(fp):
        return {'ok': False, 'msg': 'jar 不存在: %s' % jar}
    was_running = _tmux_has(inst)
    if was_running:
        _tmux_send(inst, 'save-all')
        _tmux_send(inst, 'stop')
        for _ in range(60):
            if not _tmux_has(inst):
                break
            time.sleep(0.5)
    else:
        time.sleep(1)
    # 更新 jar 与 start_cmd
    sc = inst.get('start_cmd') or ''
    if sc.strip():
        # 自定义命令: 仅替换其中 .jar 文件名
        inst['start_cmd'] = re.sub(r'\S+\.jar', jar, sc, count=1)
    else:
        inst['start_cmd'] = ''
    inst['jar'] = jar
    store = get_store()
    store['instances'][inst['id']] = inst
    _save()
    time.sleep(1)
    if was_running:
        ok, err = _launch(inst)
        return {'ok': ok, 'msg': '已切换到 %s' % jar, 'was_running': True,
                'err': err if not ok else ''}
    return {'ok': True, 'msg': '已切换 %s（服务器已停止）' % jar, 'was_running': False}


# ---------------- properties ----------------
def _props_path(inst):
    return os.path.join(inst['dir'], 'server.properties')


def _read_props(inst):
    path = _props_path(inst)
    if not os.path.isfile(path):
        return None, None
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()
    props = {}
    for line in text.splitlines():
        if line.startswith('#') or '=' not in line:
            continue
        k, _, v = line.partition('=')
        props[k.strip()] = v.strip()
    return text, props


def _write_props(inst, updates):
    path = _props_path(inst)
    text, _ = _read_props(inst)
    if text is None:
        return False
    lines = text.splitlines()
    seen = set()
    out = []
    for line in lines:
        if '=' in line and not line.startswith('#'):
            k = line.partition('=')[0].strip()
            if k in updates:
                out.append('%s=%s' % (k, updates[k]))
                seen.add(k)
                continue
        out.append(line)
    for k, v in updates.items():
        if k not in seen:
            out.append('%s=%s' % (k, v))
    if not out:
        out.append('')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')
    return True


# ---------------- RCON ----------------
def _rcon_packet(pktid, ptype, data):
    payload = data.encode('utf-8') + b'\x00\x00'
    # length field counts: id(4) + type(4) + payload(含2字节终止符)
    return struct.pack('<iii', 8 + len(payload), pktid, ptype) + payload


def _rcon_send(inst, cmd, timeout=5):
    if not inst.get('rcon_enabled'):
        return None
    port = int(inst.get('rcon_port') or 25575)
    pw = inst.get('rcon_password') or ''
    try:
        s = socket.create_connection(('127.0.0.1', port), timeout=timeout)
        s.settimeout(timeout)
    except OSError:
        return None
    try:
        s.sendall(_rcon_packet(10, 3, pw))
        try:
            s.recv(512)
        except socket.timeout:
            return None
        s.sendall(_rcon_packet(11, 2, cmd))
        out = b''
        while True:
            try:
                r = s.recv(4096)
            except socket.timeout:
                break
            if not r:
                break
            out += r
        result = ''
        i = 0
        while i + 4 <= len(out):
            size = struct.unpack('<i', out[i:i + 4])[0]
            if size < 10 or i + 4 + size > len(out):
                break
            body = out[i + 4:i + 4 + size]
            if len(body) < 10:
                break
            payload = body[8:]
            if payload:
                result += payload.decode('utf-8', 'replace').replace('\x00', '').rstrip()
            i += 4 + size
        return result
    except OSError:
        return None
    finally:
        try:
            s.close()
        except Exception:
            pass


def _command(inst, cmd):
    ret = _rcon_send(inst, cmd, timeout=6)
    if ret is not None:
        return True, ret
    if not _tmux_has(inst):
        return False, '服务器未运行'
    if not _tmux_send(inst, cmd):
        return False, '发送命令失败'
    time.sleep(0.6)
    return True, _tmux_capture(inst, 20)


# ---------------- RCON 写入 properties ----------------
def _apply_rcon(inst):
    st = get_store()['instances'].get(inst['id'], inst)
    enabled = bool(st.get('rcon_enabled', False))
    if not os.path.isfile(_props_path(inst)):
        return
    port = int(st.get('rcon_port') or 25575)
    if enabled and not st.get('rcon_password'):
        st['rcon_password'] = _gen_pw()
    updates = {
        'enable-rcon': 'true' if enabled else 'false',
        'rcon.port': str(port),
    }
    if enabled:
        updates['rcon.password'] = st['rcon_password']
    elif st.get('rcon_password'):
        updates['rcon.password'] = st['rcon_password']
    _write_props(inst, updates)
    _save()


def _gen_pw():
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(12))


# ---------------- 在线玩家 / TPS / uptime ----------------
def _online_players(inst):
    names = []
    ret = _rcon_send(inst, 'list', timeout=4)
    if ret:
        m = re.search(r'are (\d+) of a max of \d+ [^:]*:\s?(.*)$', ret)
        if m and m.group(2).strip():
            names = [x.strip() for x in m.group(2).split(',') if x.strip()]
        if not names:
            for ln in ret.splitlines():
                mm = re.search(r'online', ln, re.I)
                if mm:
                    i = ln.rfind(':')
                    tail = ln[i + 1:].strip()
                    if tail:
                        names = [x.strip() for x in tail.split(',') if x.strip()]
    if not names and _tmux_has(inst):
        for line in _tmux_capture(inst, 200).splitlines():
            m = re.search(r'(\w{1,16}) joined the game', line)
            if m and m.group(1) not in names:
                names.append(m.group(1))
    now = time.time()
    for n in names:
        _ONLINE.setdefault(n, now)
    for n in list(_ONLINE):
        if n not in names:
            del _ONLINE[n]
    return names


def _tps(inst):
    ret = _rcon_send(inst, 'forge tps', timeout=4) or _rcon_send(inst, 'tps', timeout=4)
    if ret:
        m = re.search(r'([\d.]+)\s*TPS|avg[/Tt]{1}:\s*([\d.]+)', ret)
        if m:
            val = m.group(1) or m.group(2)
            try:
                return float(val)
            except ValueError:
                pass
    return None


def _ensure_eula(inst):
    """确保 eula.txt 存在且 eula=true，避免首次启动因未同意 EULA 而崩溃。"""
    path = os.path.join(inst['dir'], 'eula.txt')
    try:
        if os.path.isfile(path):
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                if re.search(r'^\s*eula\s*=\s*true\s*$', f.read(), re.M):
                    return
        os.makedirs(inst['dir'], exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write('#By changing the setting below to TRUE you are indicating your\n'
                    '#agreement to our EULA (https://aka.ms/MinecraftEULA).\n'
                    'eula=true\n')
    except Exception:
        pass


def _uptime(inst):
    pid = _pid(inst)
    if not pid:
        return None
    r = _run(['ps', '-o', 'etimes=', '-p', pid], timeout=5)
    if r and r.returncode == 0 and r.stdout.strip():
        try:
            return int(r.stdout.strip())
        except ValueError:
            pass
    return None


# ---------------- NBT 精简解析 ----------------
def _nbt_compound(data, pos, name=True):
    if name:
        nlen = struct.unpack('>H', data[pos[0]:pos[0] + 2])[0]
        pos[0] += 2 + nlen
    result = {}
    while True:
        t = data[pos[0]]
        pos[0] += 1
        if t == 0:
            break
        nlen = struct.unpack('>H', data[pos[0]:pos[0] + 2])[0]
        nm = data[pos[0] + 2:pos[0] + 2 + nlen].decode('utf-8', 'replace')
        pos[0] += 2 + nlen
        result[nm] = _nbt_value(data, pos, t)
    return result


def _nbt_value(data, pos, t):
    if t == 1:
        v = data[pos[0]]; pos[0] += 1; return v - 256 if v > 127 else v
    if t == 2:
        v = struct.unpack('>h', data[pos[0]:pos[0] + 2])[0]; pos[0] += 2; return v
    if t == 3:
        v = struct.unpack('>i', data[pos[0]:pos[0] + 4])[0]; pos[0] += 4; return v
    if t == 4:
        v = struct.unpack('>q', data[pos[0]:pos[0] + 8])[0]; pos[0] += 8; return v
    if t == 5:
        v = struct.unpack('>f', data[pos[0]:pos[0] + 4])[0]; pos[0] += 4; return v
    if t == 6:
        v = struct.unpack('>d', data[pos[0]:pos[0] + 8])[0]; pos[0] += 8; return v
    if t == 7:
        n = struct.unpack('>i', data[pos[0]:pos[0] + 4])[0]; pos[0] += 4
        arr = list(struct.unpack('>%db' % n, data[pos[0]:pos[0] + n])); pos[0] += n; return arr
    if t == 8:
        n = struct.unpack('>H', data[pos[0]:pos[0] + 2])[0]; pos[0] += 2
        v = data[pos[0]:pos[0] + n].decode('utf-8', 'replace'); pos[0] += n; return v
    if t == 9:
        et = data[pos[0]]; pos[0] += 1
        n = struct.unpack('>i', data[pos[0]:pos[0] + 4])[0]; pos[0] += 4
        arr = []
        for _ in range(n):
            arr.append(_nbt_value(data, pos, et))
        return arr
    if t == 10:
        return _nbt_compound(data, pos, name=False)
    if t == 11:
        n = struct.unpack('>i', data[pos[0]:pos[0] + 4])[0]; pos[0] += 4
        arr = list(struct.unpack('>%di' % n, data[pos[0]:pos[0] + n * 4])); pos[0] += n * 4; return arr
    if t == 12:
        n = struct.unpack('>i', data[pos[0]:pos[0] + 4])[0]; pos[0] += 4
        arr = list(struct.unpack('>%dq' % n, data[pos[0]:pos[0] + n * 8])); pos[0] += n * 8; return arr
    _skip_nbt(data, pos, t)
    return None


def _skip_nbt(data, pos, t):
    if t in (1,):
        pos[0] += 1
    elif t in (2,):
        pos[0] += 2
    elif t in (3, 5, 7, 11):
        pos[0] += 4
    elif t in (4, 6, 12):
        pos[0] += 8
    elif t == 8:
        n = struct.unpack('>H', data[pos[0]:pos[0] + 2])[0]; pos[0] += 2 + n
    elif t == 9:
        elem = data[pos[0]]; pos[0] += 1
        n = struct.unpack('>i', data[pos[0]:pos[0] + 4])[0]; pos[0] += 4
        for _ in range(n):
            _skip_nbt(data, pos, elem)
    elif t == 10:
        _nbt_compound(data, pos, name=False)


def _read_nbt_file(path):
    try:
        with gzip.open(path, 'rb') as f:
            data = f.read()
    except (OSError, EOFError):
        try:
            with open(path, 'rb') as f:
                data = f.read()
        except Exception:
            return None
    pos = [0]
    try:
        t = data[pos[0]]
        pos[0] += 1
        nlen = struct.unpack('>H', data[pos[0]:pos[0] + 2])[0]
        pos[0] += 2 + nlen
        return _nbt_compound(data, pos, name=False)
    except Exception:
        return None


# ---------------- 属性全量定义 ----------------
PROPERTY_DEFS = [
    {'key': 'server-port', 'label': '服务端口', 'group': '网络', 'type': 'int'},
    {'key': 'server-ip', 'label': '绑定 IP', 'group': '网络', 'type': 'text'},
    {'key': 'motd', 'label': '服务器描述 (MOTD)', 'group': '基础', 'type': 'text'},
    {'key': 'max-players', 'label': '最大玩家数', 'group': '基础', 'type': 'int'},
    {'key': 'level-name', 'label': '世界名', 'group': '世界', 'type': 'text'},
    {'key': 'gamemode', 'label': '游戏模式', 'group': '游戏', 'type': 'choice', 'options': ['survival', 'creative', 'adventure', 'spectator']},
    {'key': 'difficulty', 'label': '难度', 'group': '游戏', 'type': 'choice', 'options': ['peaceful', 'easy', 'normal', 'hard']},
    {'key': 'pvp', 'label': 'PVP', 'group': '游戏', 'type': 'bool'},
    {'key': 'online-mode', 'label': '正版验证', 'group': '安全', 'type': 'bool'},
    {'key': 'white-list', 'label': '白名单', 'group': '安全', 'type': 'bool'},
    {'key': 'enforce-whitelist', 'label': '强制白名单', 'group': '安全', 'type': 'bool'},
    {'key': 'enable-command-block', 'label': '命令方块', 'group': '游戏', 'type': 'bool'},
    {'key': 'allow-flight', 'label': '允许飞行', 'group': '游戏', 'type': 'bool'},
    {'key': 'spawn-monsters', 'label': '生成怪物', 'group': '世界', 'type': 'bool'},
    {'key': 'spawn-animals', 'label': '生成动物', 'group': '世界', 'type': 'bool'},
    {'key': 'spawn-npcs', 'label': '村庄NPC', 'group': '世界', 'type': 'bool'},
    {'key': 'spawn-protection', 'label': '出生点保护', 'group': '世界', 'type': 'int'},
    {'key': 'view-distance', 'label': '视距', 'group': '性能', 'type': 'int'},
    {'key': 'simulation-distance', 'label': '模拟距离', 'group': '性能', 'type': 'int'},
    {'key': 'enable-query', 'label': '启用 Query', 'group': '网络', 'type': 'bool'},
    {'key': 'query.port', 'label': 'Query 端口', 'group': '网络', 'type': 'int'},
    {'key': 'enable-rcon', 'label': '启用 RCON', 'group': '网络', 'type': 'bool'},
    {'key': 'rcon.port', 'label': 'RCON 端口', 'group': '网络', 'type': 'int'},
    {'key': 'rcon.password', 'label': 'RCON 密码', 'group': '网络', 'type': 'text'},
    {'key': 'enable-status', 'label': '启用状态查询', 'group': '网络', 'type': 'bool'},
    {'key': 'force-gamemode', 'label': '强制游戏模式', 'group': '游戏', 'type': 'bool'},
    {'key': 'hardcore', 'label': '极限模式', 'group': '游戏', 'type': 'bool'},
    {'key': 'max-build-height', 'label': '最大建筑高度', 'group': '世界', 'type': 'int'},
    {'key': 'player-idle-timeout', 'label': '挂机踢出(分钟)', 'group': '游戏', 'type': 'int'},
    {'key': 'max-tick-time', 'label': '最大 Tick 时间', 'group': '性能', 'type': 'int'},
    {'key': 'network-compression-threshold', 'label': '网络压缩阈值', 'group': '性能', 'type': 'int'},
    {'key': 'allow-nether', 'label': '允许下界', 'group': '世界', 'type': 'bool'},
    {'key': 'sync-chunk-writes', 'label': '同步区块写入', 'group': '性能', 'type': 'bool'},
    {'key': 'rate-limit', 'label': '封禁速率限制', 'group': '安全', 'type': 'int'},
    {'key': 'use-native-transport', 'label': '原生传输', 'group': '性能', 'type': 'bool'},
    {'key': 'enforce-secure-profile', 'label': '强制安全档案', 'group': '安全', 'type': 'bool'},
    {'key': 'enable-jmx-monitoring', 'label': 'JMX 监控', 'group': '性能', 'type': 'bool'},
    {'key': 'initial-disabled-packs', 'label': '禁用数据包', 'group': '世界', 'type': 'text'},
    {'key': 'prevent-proxy-connections', 'label': '禁止代理连接', 'group': '安全', 'type': 'bool'},
    {'key': 'use-native-transport', 'label': '原生传输', 'group': '性能', 'type': 'bool'},
    {'key': 'bossbar', 'label': 'BossBar', 'group': '游戏', 'type': 'text'},
]


# ---------------- 服务核心清单 ----------------
_UA = 'TouchGal/1.0 (touchgal@192.168.2.200)'
FORGE_BASES = {
    'forge': 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml',
    'neoforge': 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml',
}
_CORE_CACHE = {}
_CORE_TTL = 300
_UNSUPPORTED = set()
_UNKNOWN = set()


def _http_json(url, timeout=4):
    req = urllib.request.Request(url, headers={'User-Agent': _UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def _http_get(url, timeout=15):
    req = urllib.request.Request(url, headers={'User-Agent': _UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _core_versions(core):
    """返回 {versions:[...], latest:...}，失败返回 None"""
    if core in _UNKNOWN:
        return None
    now = time.time()
    cached = _CORE_CACHE.get(core)
    if cached and now - cached[0] < _CORE_TTL:
        return cached[1]
    data = _fetch_core(core)
    if data is None:
        _UNKNOWN.add(core)
        return None
    _CORE_CACHE[core] = (now, data)
    return data


def _fetch_core(core):
    try:
        if core == 'vanilla':
            j = _http_json('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
            rel = [v['id'] for v in j['versions'] if v['type'] == 'release']
            return {'name': 'Vanilla', 'versions': rel, 'latest': j['latest'].get('release')}
        if core in ('paper', 'folia'):
            j = _http_json('https://fill.papermc.io/v3/projects/%s' % core)
            vers = []
            for group in sorted(j['versions'].keys(), reverse=True):
                for v in j['versions'][group]:
                    if v not in vers and '-' not in v:
                        vers.append(v)
            return {'name': j['project']['name'], 'versions': vers, 'latest': (vers or [None])[0]}
        if core == 'purpur':
            j = _http_json('https://api.purpurmc.org/v2/purpur')
            vers = [v for v in j['versions'] if '-' not in v]
            return {'name': 'Purpur', 'versions': vers, 'latest': j['metadata'].get('current')}
        if core == 'fabric':
            j = _http_json('https://meta.fabricmc.net/v2/versions/game')
            vers = [v['version'] for v in j if v.get('stable')]
            return {'name': 'Fabric', 'versions': vers, 'latest': vers[0] if vers else None}
        if core in ('forge', 'neoforge'):
            base = FORGE_BASES[core]
            text = _http_get(base).decode('utf-8', 'replace')
            raw = re.findall(r'<version>([^<]+)</version>', text)
            # 按 MC 版本分组，取每个 MC 最新构建；按 MC 新→旧排列
            per_mc = {}
            for v in raw:
                if '-' not in v:
                    continue
                mc, _, rest = v.partition('-')
                per_mc.setdefault(mc, []).append(v)
            groups = []
            for mc in sorted(per_mc.keys(), reverse=True):
                builds = sorted(per_mc[mc], key=_forge_build_key, reverse=True)
                groups.append({'mc': mc, 'versions': builds})
            flat = []
            for g in groups:
                flat.append(g['versions'][0])   # 每 MC 最新一个示例
                flat.extend(g['versions'][1:4]) # 补充该 MC 最近几个
            return {'name': ('Forge' if core == 'forge' else 'NeoForge'),
                    'versions': flat, 'latest': (groups[0]['versions'][0] if groups else None)}
    except Exception:
        return None
    return None


def _forge_build_key(v):
    """Forge/NeoForge 版本形如 <mc>-<build>，build 可能含 -beta/alpha。取最后整数段作为排序键。"""
    mc = v.split('-')[0]
    tail = v.split('-', 1)[1] if '-' in v else '0'
    m = re.search(r'(\d+(?:\.\d+)*)', tail)
    nums = [int(x) for x in (m.group(1).split('.') if m else ['0'])]
    return (nums or [0])


def _core_jar_url(core, version):
    """返回 (下载URL, 期望文件名, 安装类型)。安装类型: file(直接jar) / installer(需运行安装)。失败返回 (None,None,None)。"""
    try:
        if core == 'vanilla':
            j = _http_json('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
            for v in j['versions']:
                if v['id'] == version:
                    vj = _http_json(v['url'])
                    return vj['downloads']['server']['url'], 'server.jar', 'file'
            return None, None, None
        if core in ('paper', 'folia'):
            builds = _http_json('https://fill.papermc.io/v3/projects/%s/versions/%s/builds' % (core, version))
            stable = [b for b in builds if b.get('channel') == 'STABLE']
            pick = stable[0] if stable else (builds[0] if builds else None)
            if pick:
                dl = pick['downloads'].get('server:default')
                if dl:
                    return dl['url'], dl['name'], 'file'
            return None, None, None
        if core == 'purpur':
            j = _http_json('https://api.purpurmc.org/v2/purpur/%s' % version)
            builds = j.get('builds', {})
            latest = builds.get('latest')
            if not latest:
                return None, None, None
            return ('https://api.purpurmc.org/v2/purpur/%s/%s/download' % (version, latest)), ('purpur-%s-%s.jar' % (version, latest)), 'file'
        if core == 'fabric':
            # 需要 loader + installer 两段版本，生成 server jar
            loaders = _http_json('https://meta.fabricmc.net/v2/versions/loader/%s' % version)
            if not loaders:
                return None, None, None
            lv = loaders[0]['loader']['version']
            installers = _http_json('https://meta.fabricmc.net/v2/versions/installer')
            iv = installers[0]['version'] if installers else '1.0.1'
            return ('https://meta.fabricmc.net/v2/versions/loader/%s/%s/%s/server/jar' % (version, lv, iv)), 'fabric-server-launcher.jar', 'file'
        if core == 'forge':
            # <mc>-<build>，下载 installer，需运行安装
            _, build = version.rsplit('-', 1) if '-' in version else (version, '')
            return ('https://maven.minecraftforge.net/net/minecraftforge/forge/%s/forge-%s-installer.jar' % (version, version)), 'forge-installer.jar', 'installer'
        if core == 'neoforge':
            return ('https://maven.neoforged.net/releases/net/neoforged/neoforge/%s/neoforge-%s-installer.jar' % (version, version)), 'neoforge-installer.jar', 'installer'
    except Exception:
        return None, None, None
    return None, None, None


# ---------------- 服务核心清单(旧类属性迁移为模块级) ----------------
CORES = ['vanilla', 'paper', 'folia', 'purpur', 'fabric', 'forge', 'neoforge']
CORE_LABELS = {
    'vanilla': '原版',
    'paper': 'Paper',
    'folia': 'Folia',
    'purpur': 'Purpur',
    'fabric': 'Fabric',
    'forge': 'Forge',
    'neoforge': 'NeoForge',
}


# ---------------- 辅助 ----------------
def _safe_name(s):
    return bool(s) and '/' not in s and '\\' not in s and '..' not in s


def _dir_size(path):
    total = 0
    for root, dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def _read_bans(inst, filename):
    fp = os.path.join(inst['dir'], filename)
    if not os.path.isfile(fp):
        return []
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def _trim_backups(inst):
    keep = max(1, int(inst.get('backup_keep', 10)))
    bdir = os.path.join(inst['dir'], 'backups')
    files = sorted(glob.glob(os.path.join(bdir, 'world_*.zip')), reverse=True)
    for f in files[keep:]:
        try:
            os.remove(f)
        except Exception:
            pass


def _backup_name(inst):
    if _running(inst):
        _command(inst, 'save-all')
        time.sleep(1)
    world = os.path.join(inst['dir'], 'world')
    if not os.path.isdir(world):
        return None
    bdir = os.path.join(inst['dir'], 'backups')
    os.makedirs(bdir, exist_ok=True)
    fname = 'world_%s.zip' % time.strftime('%Y%m%d_%H%M%S')
    out = os.path.join(bdir, fname)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(world):
            for f2 in files:
                fp = os.path.join(root, f2)
                zf.write(fp, 'world/' + os.path.relpath(fp, world))
    _trim_backups(inst)
    return fname


def _sample(inst):
    import psutil
    pid = _pid(inst)
    vm = psutil.virtual_memory()
    S = _SAMPLES
    S['mem_used'] = vm.used / 1024 / 1024
    S['mem_total'] = vm.total / 1024 / 1024
    S['mem_percent'] = vm.percent
    S['cpu'] = psutil.cpu_percent(interval=None)
    jcpu, jrss = 0.0, 0
    if pid:
        try:
            p = psutil.Process(int(pid))
            jcpu = p.cpu_percent(interval=None) / max(1, os.cpu_count())
            jrss = p.memory_info().rss
        except Exception:
            pass
    S['jvm_cpu'] = jcpu
    S['jvm_rss'] = jrss
    on = len(_online_players(inst)) if _running(inst) else 0
    S['hist_players'].append(on)
    S['hist_cpu'].append(jcpu)
    S['hist_mem'].append(vm.percent)
    for k in ('hist_cpu', 'hist_mem', 'hist_players'):
        if len(S[k]) > 60:
            S[k] = S[k][-60:]
    try:
        du = psutil.disk_usage(inst['dir'])
        S['disk_total'] = du.total
        S['disk_free'] = du.free
    except Exception:
        pass


def _stream_events(inst, q, headers):
    """SSE 日志流生成器(旧插件 _stream_logs 的 generate(), 请求对象改显式参数)。"""
    path = os.path.join(inst['dir'], 'logs', 'latest.log')
    try:
        from_seq = int(headers.get('Last-Event-ID') or q.get('seq') or 0)
    except (TypeError, ValueError):
        from_seq = 0

    def _enc(text):
        return base64.b64encode(text.encode('utf-8')).decode('ascii')

    def _event(seq, text):
        return 'id: %d\ndata: %s\n\n' % (seq, _enc(text))

    def generate():
        if not os.path.isfile(path):
            yield _event(0, '暂无日志文件')
            yield 'event: closed\ndata: {}\n\n'
            return
        seq = from_seq
        r = _run(['tail', '-60', path], timeout=10)
        if r and r.returncode == 0:
            seq += 1
            yield _event(seq, r.stdout.rstrip('\n'))
        proc = None
        try:
            proc = subprocess.Popen(['tail', '-F', '-n0', path],
                                    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                    text=True, bufsize=1)
        except Exception:
            proc = None
        try:
            if proc:
                for line in proc.stdout:
                    if line.strip():
                        seq += 1
                        yield _event(seq, line.rstrip('\n'))
                    else:
                        yield ': ping\n\n'
            else:
                yield 'event: closed\ndata: {}\n\n'
        finally:
            if proc:
                try:
                    proc.kill()
                except Exception:
                    pass

    return generate()


# ---------------- 计划循环 ----------------
def _scheduler_loop():
    while True:
        try:
            s = get_store()
            now_t = time.strftime('%H:%M')
            for iid, inst in s.get('instances', {}).items():
                if inst.get('managed_by_agent'):
                    continue
                running = _tmux_has(inst)
                # 崩溃守护：期望运行但 tmux 已死 → 自动重启
                if iid not in _REBOOTING and _wanted(iid) and running is False:
                    _launch(inst)
                # 定时重启
                ra = inst.get('restart_at')
                if ra and iid == s.get('active') and running and now_t == ra:
                    _command(inst, 'save-all')
                    _tmux_send(inst, 'stop')
                    time.sleep(5)
                    _backup_name(inst)
                    _launch(inst)
                    time.sleep(3)
                # 定时备份
                iv = int(inst.get('backup_interval_hours', 0))
                if iv > 0 and running and iid == s.get('active'):
                    now = time.time()
                    if now - _last_backup_ts.get(iid, 0) >= iv * 3600:
                        _backup_name(inst)
                        _last_backup_ts[iid] = now
        except Exception:
            pass
        time.sleep(15)


# 崩溃守护辅助：记录期望运行状态
_WANTED = {}


def _set_wanted(iid, val):
    _WANTED[iid] = val
    try:
        store = get_store()
        for inst in store.get('instances', {}).values():
            if inst.get('id') == iid:
                inst['started'] = val
        _save()
    except Exception:
        pass
    return val


def _wanted(iid):
    if iid in _WANTED:
        return _WANTED[iid]
    try:
        return bool(get_store().get('instances', {}).get(iid, {}).get('started', False))
    except Exception:
        return False


threading.Thread(target=_scheduler_loop, daemon=True).start()


# ---------------- multipart 解析(替代 Flask request.files) ----------------
def _parse_multipart(raw, ctype):
    try:
        m = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', ctype or '')
        if not m:
            return {}
        boundary = (m.group(1) or m.group(2) or '').strip()
        if not boundary:
            return {}
        delim = ('--' + boundary).encode()
        fields = {}
        for part in raw.split(delim):
            part = part.strip(b'\r\n')
            if not part or part.startswith(b'--') or part == b'':
                continue
            header, _, content = part.partition(b'\r\n\r\n')
            if not header:
                continue
            hdr_text = header.decode('utf-8', 'replace')
            nm = re.search(r'name="([^"]*)"', hdr_text)
            fm = re.search(r'filename="([^"]*)"', hdr_text)
            name = nm.group(1) if nm else ''
            if not name:
                continue
            if fm:
                fields[name] = {'filename': fm.group(1), 'data': content}
            else:
                fields[name] = content.decode('utf-8', 'replace')
        return fields
    except Exception:
        return {}


def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "mcserver/2.0"

    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _file(self, path, ctype, as_attach=False):
        try:
            with open(path, 'rb') as f:
                data = f.read()
        except Exception:
            self._json(404, {'error': '文件不存在'})
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        if as_attach:
            self.send_header("Content-Disposition", 'attachment; filename="%s"' % os.path.basename(path))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def _q(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    # POST 请求体: JSON 或 multipart(上传), 每请求仅解析一次
    def _parse_post(self):
        raw = self._body()
        ctype = self.headers.get("Content-Type", "")
        if 'multipart/form-data' in ctype:
            self._fields = _parse_multipart(raw, ctype)
            self._body_obj = {}
        else:
            self._fields = {}
            try:
                self._body_obj = json.loads(raw or b'{}')
            except Exception:
                self._body_obj = {}

    def _inst(self):
        inst_key = self._q().get('inst')
        if not inst_key and self._body_obj:
            inst_key = (self._body_obj or {}).get('inst')
        store = get_store()
        if not inst_key:
            inst_key = store.get('active', '')
        return store.get('instances', {}).get(inst_key) if inst_key else None

    def _ban_cmd(self, cmd, key):
        inst = self._inst()
        data = self._body_obj or {}
        target = str(data.get(key) or data.get('name') or data.get('ip') or '').strip()
        if not target:
            return 400, {'error': '需要玩家名/IP'}
        ok, echo = _command(inst, '%s %s' % (cmd, target))
        if not ok:
            return 500, {'error': echo}
        return 200, {'ok': True, 'echo': echo}

    # ---------- 实例管理 ----------
    def _rt_instances(self):
        s = get_store()
        active = s.get('active', '')
        out = []
        running_count = 0
        for k, i in s.get('instances', {}).items():
            run = _tmux_has(i)
            if run:
                running_count += 1
            out.append({
                'id': k,
                'label': i.get('label', k),
                'running': run,
                'active': k == active,
                'dir': i.get('dir', ''),
                'port': i.get('port', 25565),
                'jar': i.get('jar', ''),
                'mem_max': i.get('mem_max', '4G'),
                'version': _read_props(i)[1].get('version', '') if _read_props(i)[1] else '',
                'start_cmd': i.get('start_cmd', ''),
            })
        return 200, {'active': active, 'instances': out,
                     'total': len(out), 'running_count': running_count}

    def _rt_core_jars(self, q):
        inst = self._inst()
        if not inst:
            return 400, {'error': '未指定或未找到实例'}
        if inst.get('managed_by_agent'):
            ok, data = _agent_get('/api/core?action=list')
            if not ok:
                return 502, {'error': '无法连接 folia-agent: %s' % data.get('error', '')}
            return 200, data
        return 200, {'ok': True, 'current': inst.get('jar', ''),
                     'jars': _scan_inst_jars(inst)}

    def _rt_core_switch(self, body):
        inst = self._inst()
        if not inst:
            return 400, {'error': '未指定或未找到实例'}
        jar = str(body.get('jar') or '').strip()
        if not jar:
            return 400, {'error': '缺少 jar 参数'}
        if inst.get('managed_by_agent'):
            ok, res = _agent_get('/api/core?action=switch&jar=%s' % jar)
            if not ok:
                return 502, {'error': '无法连接 folia-agent: %s' % res.get('error', '')}
            if not res.get('ok'):
                return 400, {'error': res.get('msg', '切换失败')}
            return 200, res
        res = _switch_inst_core(inst, jar)
        if not res.get('ok'):
            return 400, {'error': res.get('msg', '切换失败')}
        return 200, res

    def _rt_javas(self):
        return 200, {'javas': _installed_java()}

    def _rt_instance_clear_active(self):
        s = get_store()
        s['active'] = ''
        _save()
        return 200, {'ok': True}

    def _rt_instance_add(self, body):
        data = body or {}
        iid = str(data.get('id') or '').strip()
        if not iid or re.search(r'[\s/\\\\]', iid):
            return 400, {'error': '实例 ID 不能包含空格或 / \\\\'}
        s = get_store()
        if iid in s.get('instances', {}):
            return 400, {'error': '实例已存在'}
        s['instances'][iid] = {
            'id': iid,
            'label': str(data.get('label') or iid),
            'dir': os.path.expanduser(str(data.get('dir') or '/opt/mcserver').strip()),
            'jar': str(data.get('jar') or DEFAULT_JAR).strip() or DEFAULT_JAR,
            'session': str(data.get('session') or iid).strip(),
            'port': int(data.get('port') or 25565),
            'java': str(data.get('java') or DEFAULT_JAVA).strip(),
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
        _ensure_dir(s['instances'][iid]['dir'])
        _save()
        return 200, {'ok': True, 'id': iid}

    def _rt_instance_update(self, body):
        data = body or {}
        iid = str(data.get('id') or '')
        s = get_store()
        if iid not in s.get('instances', {}):
            return 404, {'error': '实例不存在'}
        i = s['instances'][iid]
        for field in ('label', 'dir', 'jar', 'session', 'java', 'mem_min', 'mem_max'):
            if data.get(field) is not None and str(data[field]).strip():
                i[field] = str(data[field]).strip()
        # 允许清空的自定义开服参数
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
        if i.get('start_cmd'):
            custom = i['start_cmd']
            # 尝试解析 custom cmd 的 -Xmx/-Xms 与 jar，但保持原样
            pass
        _save()
        return 200, {'ok': True, 'id': iid}

    def _rt_instance_remove(self, body):
        data = body or {}
        iid = str(data.get('id') or '')
        s = get_store()
        if iid not in s.get('instances', {}):
            return 404, {'error': '实例不存在'}
        if iid == s.get('active') and s.get('active'):
            if len(s.get('instances', {})) > 1:
                return 400, {'error': '请先切换到其他实例再删除，或将当前实例设空'}
        if _tmux_has(s['instances'][iid]):
            return 400, {'error': '请先停止该实例'}
        del s['instances'][iid]
        if s.get('active') == iid:
            s['active'] = ''
        _save()
        return 200, {'ok': True}

    def _rt_instance_set(self, body):
        data = body or {}
        iid = str(data.get('id') or '')
        s = get_store()
        if iid not in s.get('instances', {}):
            return 404, {'error': '实例不存在'}
        s['active'] = iid
        _save()
        return 200, {'ok': True, 'active': iid}

    def _rt_instance_detail(self):
        inst = self._inst()
        if inst is None:
            return 200, {}
        return 200, {
            'id': inst.get('id'),
            'label': inst.get('label', inst.get('id')),
            'dir': inst.get('dir', ''),
            'jar': inst.get('jar', ''),
            'session': inst.get('session', ''),
            'port': inst.get('port', 25565),
            'java': inst.get('java', ''),
            'mem_min': inst.get('mem_min', '2G'),
            'mem_max': inst.get('mem_max', '4G'),
            'jvm_args': inst.get('jvm_args', ''),
            'start_cmd': inst.get('start_cmd', ''),
            'rcon_enabled': bool(inst.get('rcon_enabled', False)),
            'rcon_port': inst.get('rcon_port', 25575),
            'auto_restart': bool(inst.get('auto_restart', False)),
            'install_state': inst.get('install_state'),
            'install_error': bool(inst.get('install_error', False)),
            'install_done': bool(inst.get('install_done', False)),
        }

    # ---------- 状态 ----------
    def _rt_status(self):
        inst = self._inst()
        if inst is None:
            return 200, {'running': False, 'inst': None, 'inst_label': '', 'port': '', 'host': HOST_IP,
                         'players': [], 'player_count': 0}
        running = _running(inst)
        props = {}
        _, p = _read_props(inst)
        if p:
            props = p
        players = _online_players(inst) if running else []
        return 200, {
            'running': running,
            'pid': _pid(inst) if running else None,
            'players': players,
            'player_count': len(players),
            'max_players': props.get('max-players', '20'),
            'port': props.get('server-port') or inst.get('port', 25565),
            'host': HOST_IP,
            'version': props.get('version', ''),
            'motd': props.get('motd', ''),
            'online_mode': props.get('online-mode', 'true'),
            'whitelist_enabled': props.get('white-list', 'false'),
            'game_mode': props.get('gamemode', 'survival'),
            'difficulty': props.get('difficulty', 'easy'),
            'inst': inst.get('id'),
            'inst_label': inst.get('label', inst.get('id')),
            'tps': _tps(inst) if running else None,
            'uptime': _uptime(inst),
        }

    # ---------- 启停/重启 ----------
    def _rt_start(self, body):
        inst = self._inst()
        if _tmux_has(inst):
            return 200, {'ok': True, 'message': '服务器已在运行'}
        _apply_rcon(inst)
        ok, err = _launch(inst)
        _set_wanted(inst['id'], True)
        if not ok:
            return 500, {'error': err}
        return 200, {'ok': True, 'message': '服务器启动中，等待加载世界...'}

    def _rt_stop(self, body):
        data = body or {}
        inst = self._inst()
        force = bool(data.get('force', False))
        _set_wanted(inst['id'], False)
        if not _tmux_has(inst):
            return 200, {'ok': True, 'message': '服务器未运行'}
        _REBOOTING.discard(inst['id'])
        if force:
            r = _run(['tmux', 'kill-session', '-t', inst['session']], timeout=10)
            if r is None or r.returncode != 0:
                return 500, {'error': '强杀失败'}
            return 200, {'ok': True, 'message': '已强制停止'}
        if not _tmux_send(inst, 'stop'):
            return 500, {'error': '发送 stop 失败'}
        return 200, {'ok': True, 'message': '已发送停止命令，正在保存存档...'}

    def _rt_restart(self, body):
        inst = self._inst()
        _set_wanted(inst['id'], True)
        if _tmux_has(inst):
            _REBOOTING.add(inst['id'])
            _tmux_send(inst, 'stop')
            for _ in range(30):
                time.sleep(1)
                if not _tmux_has(inst):
                    break
            _REBOOTING.discard(inst['id'])
        ok, err = _launch(inst)
        if not ok:
            return 500, {'error': '重启失败: %s' % err}
        _REBOOTING.discard(inst['id'])
        return 200, {'ok': True, 'message': '服务器重启中'}

    # ---------- 控制台 ----------
    def _rt_console_get(self, q):
        inst = self._inst()
        try:
            lines = int(q.get('lines', 200))
        except (TypeError, ValueError):
            lines = 200
        if not _tmux_has(inst):
            return 200, {'running': False, 'log': '服务器未运行'}
        return 200, {'running': True, 'log': _tmux_capture(inst, lines)}

    def _rt_console_send(self, body):
        inst = self._inst()
        data = body or {}
        cmd = str(data.get('command', '')).strip()
        if not cmd:
            return 400, {'error': '命令为空'}
        ok, echo = _command(inst, cmd)
        if not ok:
            return 500, {'error': echo}
        return 200, {'ok': True, 'echo': echo}

    def _rt_stream(self, q):
        inst = self._inst()
        gen = _stream_events(inst, q, self.headers)
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Accel-Buffering', 'no')
        self.send_header('Connection', 'keep-alive')
        self.end_headers()
        for chunk in gen:
            if isinstance(chunk, str):
                chunk = chunk.encode('utf-8', 'replace')
            try:
                self.wfile.write(chunk)
                self.wfile.flush()
            except Exception:
                break
        self.close_connection = True
        return None

    # ---------- 系统监控 ----------
    def _rt_metrics(self):
        inst = self._inst()
        _sample(inst)
        S = _SAMPLES
        return 200, {
            'running': _running(inst),
            'cpu': round(S['cpu'], 1),
            'mem_used': round(S['mem_used'], 1),
            'mem_total': round(S['mem_total'], 1),
            'mem_percent': round(S['mem_percent'], 1),
            'jvm_cpu': round(S['jvm_cpu'], 1),
            'jvm_rss_mb': round(S['jvm_rss'] / 1024 / 1024, 1),
            'disk_total': S['disk_total'],
            'disk_free': S['disk_free'],
            'hist_cpu': S['hist_cpu'][-30:],
            'hist_mem': S['hist_mem'][-30:],
            'hist_players': S['hist_players'][-30:],
        }

    # ---------- 完整配置 ----------
    def _rt_config_get(self):
        inst = self._inst()
        _, props = _read_props(inst)
        groups = {}
        for d in PROPERTY_DEFS:
            kd = dict(d)
            kd['value'] = (props or {}).get(kd['key'], '')
            groups.setdefault(kd['group'], []).append(kd)
        ordered = ['网络', '基础', '游戏', '世界', '安全', '性能']
        result = [{'group': g, 'items': groups[g]} for g in ordered if g in groups]
        return 200, {'groups': result, 'inst': inst.get('id')}

    def _rt_config_set(self, body):
        inst = self._inst()
        data = body or {}
        updates = {}
        for d in PROPERTY_DEFS:
            k = d['key']
            if k in data and data[k] is not None:
                v = str(data[k]).strip()
                if re.fullmatch(r'(true|false)', v, re.I):
                    v = v.lower()
                updates[k] = v
        if not _write_props(inst, updates):
            return 500, {'error': 'server.properties 尚未生成（请先启动一次服务器）'}
        if 'enable-rcon' in updates or 'rcon.port' in updates:
            _apply_rcon(inst)
        return 200, {'ok': True, 'message': '配置已保存（重启服务器生效）'}

    # ---------- 玩家 ----------
    def _rt_players(self):
        inst = self._inst()
        online = _online_players(inst) if _running(inst) else []
        online_set = set(online)
        playerdir = os.path.join(inst['dir'], 'world', 'playerdata')
        name_map = {}
        uc = os.path.join(inst['dir'], 'usercache.json')
        if os.path.isfile(uc):
            try:
                for u in json.load(open(uc, 'r', encoding='utf-8')):
                    name_map[u.get('uuid', '')] = u.get('name', '')
            except Exception:
                pass
        entries = []
        seen = set()
        if os.path.isdir(playerdir):
            for fp in glob.glob(os.path.join(playerdir, '*.dat')):
                u = os.path.basename(fp)[:-4]
                if u in seen:
                    continue
                seen.add(u)
                st = os.stat(fp)
                nm = name_map.get(u, '')
                entry = {
                    'uuid': u, 'name': nm or u, 'online': u in online_set,
                    'last_seen': int(st.st_mtime), 'size': st.st_size,
                    'pos': None, 'dimension': None,
                }
                nb = _read_nbt_file(fp)
                if nb:
                    pos = nb.get('Pos')
                    if isinstance(pos, list) and len(pos) >= 3:
                        try:
                            entry['pos'] = [round(float(x)) for x in pos[:3]]
                        except (TypeError, ValueError):
                            pass
                    dm = nb.get('Dimension')
                    if isinstance(dm, str):
                        entry['dimension'] = dm.split(':')[-1]
                    elif isinstance(dm, int):
                        entry['dimension'] = {0: 'overworld', -1: 'nether', 1: 'end'}.get(dm, str(dm))
                entries.append(entry)
        for n in online:
            if n not in {e['name'] for e in entries}:
                entries.append({'uuid': '', 'name': n, 'online': True,
                                'last_seen': int(time.time()), 'size': 0,
                                'pos': None, 'dimension': None})
        entries.sort(key=lambda e: (not e['online'], e['name'].lower()))
        return 200, entries

    def _rt_kick(self, body):
        inst = self._inst()
        data = body or {}
        name = str(data.get('name', '')).strip()
        reason = str(data.get('reason', '')).strip()
        if not name:
            return 400, {'error': '需要玩家名'}
        ok, echo = _command(inst, 'kick %s %s' % (name, reason or '被管理员踢出'))
        if not ok:
            return 500, {'error': echo}
        return 200, {'ok': True, 'echo': echo}

    def _rt_whitelist_get(self):
        inst = self._inst()
        if not _running(inst):
            return 200, []
        _, echo = _command(inst, 'whitelist list')
        names = []
        for line in echo.splitlines():
            m = re.search(r'whitelisted players?\s?\:?\s?(.*)', line, re.I)
            if m and m.group(1).strip():
                tail = m.group(1).strip()
                if tail and 'from a list' not in tail and 'There are 0' not in line:
                    names = [x.strip() for x in tail.split(',') if x.strip()]
                break
        return 200, names

    def _rt_whitelist_set(self, body):
        inst = self._inst()
        data = body or {}
        action = data.get('action', '')
        name = str(data.get('name', '')).strip()
        if action not in ('add', 'remove') or not name:
            return 400, {'error': '需要 action(add/remove) 与 name'}
        ok, echo = _command(inst, 'whitelist %s %s' % (action, name))
        if not ok:
            return 500, {'error': echo}
        return 200, {'ok': True, 'echo': echo}

    def _rt_ops_get(self):
        inst = self._inst()
        ops_file = os.path.join(inst['dir'], 'ops.json')
        if not os.path.isfile(ops_file):
            return 200, []
        try:
            with open(ops_file, 'r', encoding='utf-8') as f:
                return 200, [o.get('name', '') for o in json.load(f) if o.get('name')]
        except Exception:
            return 200, []

    def _rt_ops_set(self, body):
        inst = self._inst()
        data = body or {}
        action = data.get('action', '')
        name = str(data.get('name', '')).strip()
        if action not in ('add', 'remove') or not name:
            return 400, {'error': '需要 action(add/remove) 与 name'}
        cmd = '%s %s' % (('op' if action == 'add' else 'deop'), name)
        ok, echo = _command(inst, cmd)
        if not ok:
            return 500, {'error': echo}
        return 200, {'ok': True, 'echo': echo}

    def _rt_bans(self):
        inst = self._inst()
        return 200, {
            'players': _read_bans(inst, 'banned-players.json'),
            'ips': _read_bans(inst, 'banned-ips.json'),
        }

    def _rt_ban(self):
        return self._ban_cmd('ban', 'name')

    def _rt_unban(self):
        return self._ban_cmd('pardon', 'name')

    def _rt_ban_ip(self):
        return self._ban_cmd('ban-ip', 'ip')

    def _rt_pardon_ip(self):
        return self._ban_cmd('pardon-ip', 'ip')

    # ---------- 世界 ----------
    def _rt_world_info(self):
        inst = self._inst()
        world = os.path.join(inst['dir'], 'world')
        info = {'exists': os.path.isdir(world), 'size': 0, 'regions': 0, 'playerdata': 0,
                'seed': None, 'world_name': None, 'gamemode': None}
        if os.path.isdir(world):
            info['size'] = _dir_size(world)
            info['regions'] = len(glob.glob(os.path.join(world, 'region', '*.mca')))
            info['playerdata'] = len(glob.glob(os.path.join(world, 'playerdata', '*.dat')))
            nb = _read_nbt_file(os.path.join(world, 'level.dat'))
            if nb and isinstance(nb.get('Data'), dict):
                d = nb['Data']
                info['seed'] = d.get('RandomSeed')
                info['world_name'] = d.get('LevelName') or d.get('DataVersion')
                info['gamemode'] = d.get('GameType')
        return 200, info

    def _rt_world_backup(self, body):
        inst = self._inst()
        name = _backup_name(inst)
        if not name:
            return 500, {'error': 'world 目录不存在'}
        bdir = os.path.join(inst['dir'], 'backups')
        files = sorted(glob.glob(os.path.join(bdir, 'world_*.zip')), reverse=True)
        size = os.path.getsize(os.path.join(bdir, name)) if name else 0
        return 200, {'ok': True, 'name': name, 'size': size}

    def _rt_world_backups(self):
        inst = self._inst()
        bdir = os.path.join(inst['dir'], 'backups')
        out = []
        if os.path.isdir(bdir):
            for fp in sorted(glob.glob(os.path.join(bdir, 'world_*.zip')), reverse=True):
                st = os.stat(fp)
                out.append({'name': os.path.basename(fp), 'size': st.st_size,
                            'time': int(st.st_mtime), 'downloadable': True})
        return 200, out

    def _rt_world_backup_delete(self, body):
        inst = self._inst()
        data = body or {}
        safe = os.path.basename(str(data.get('name', '')))
        if not _safe_name(safe):
            return 400, {'error': '无效备份名'}
        fp = os.path.join(inst['dir'], 'backups', safe)
        if not os.path.isfile(fp):
            return 404, {'error': '文件不存在'}
        try:
            os.remove(fp)
            return 200, {'ok': True}
        except Exception as e:
            return 500, {'error': str(e)}

    def _rt_world_download(self, q):
        inst = self._inst()
        name = q.get('name', '')
        safe = os.path.basename(name)
        if not _safe_name(safe):
            return 400, {'error': '无效文件名'}
        fp = os.path.join(inst['dir'], 'backups', safe)
        if not os.path.isfile(fp):
            return 404, {'error': '文件不存在'}
        self._file(fp, 'application/zip', as_attach=True)
        return None

    def _rt_world_restore(self, body):
        inst = self._inst()
        if _running(inst):
            return 400, {'error': '请先停止服务器再恢复'}
        data = body or {}
        name = str(data.get('name', '')).strip()
        safe = os.path.basename(name)
        if not _safe_name(safe):
            return 400, {'error': '无效备份名'}
        src = os.path.join(inst['dir'], 'backups', safe)
        if not os.path.isfile(src):
            return 404, {'error': '备份不存在'}
        world = os.path.join(inst['dir'], 'world')
        bak = world + '_bak'
        if os.path.isdir(bak):
            shutil.rmtree(bak, ignore_errors=True)
        if os.path.isdir(world):
            os.rename(world, bak)
        try:
            with zipfile.ZipFile(src, 'r') as zf:
                zf.extractall(inst['dir'])
            if os.path.isdir(bak):
                shutil.rmtree(bak, ignore_errors=True)
            return 200, {'ok': True, 'message': '世界已恢复'}
        except Exception as e:
            if os.path.isdir(bak) and not os.path.isdir(world):
                os.rename(bak, world)
            return 500, {'error': '恢复失败: %s' % e}

    def _rt_world_import(self):
        inst = self._inst()
        if _running(inst):
            return 400, {'error': '请先停止服务器再导入世界'}
        f = (self._fields or {}).get('file')
        if not f or not f.get('data'):
            return 400, {'error': '缺少上传文件'}
        tmp = tempfile.mkdtemp(prefix='mcimport_')
        world = os.path.join(inst['dir'], 'world')
        bak = world + '_bak'
        try:
            zpath = os.path.join(tmp, 'upload.zip')
            with open(zpath, 'wb') as _fh:
                _fh.write(f['data'])
            exdir = os.path.join(tmp, 'x')
            os.makedirs(exdir)
            with zipfile.ZipFile(zpath, 'r') as zf:
                zf.extractall(exdir)
            if os.path.isdir(bak):
                shutil.rmtree(bak, ignore_errors=True)
            if os.path.isdir(world):
                os.rename(world, bak)
            found = None
            for root, dirs, files in os.walk(exdir):
                if 'level.dat' in files:
                    found = root
                    break
            if not found:
                if os.path.isdir(bak):
                    os.rename(bak, world)
                return 400, {'error': 'zip 中未找到 world（缺少 level.dat）'}
            shutil.copytree(found, world)
            if os.path.isdir(bak):
                shutil.rmtree(bak, ignore_errors=True)
            return 200, {'ok': True, 'message': '世界已导入'}
        except Exception as e:
            if os.path.isdir(bak) and not os.path.isdir(world):
                os.rename(bak, world)
            return 500, {'error': '导入失败: %s' % e}
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    # ---------- Mod ----------
    def _rt_mods(self):
        inst = self._inst()
        moddir = os.path.join(inst['dir'], 'mods')
        out = []
        if os.path.isdir(moddir):
            for fn in sorted(os.listdir(moddir)):
                fp = os.path.join(moddir, fn)
                if os.path.isfile(fp):
                    st = os.stat(fp)
                    out.append({'name': fn, 'size': st.st_size, 'time': int(st.st_mtime)})
        return 200, {'running': _running(inst), 'mods': out}

    def _rt_mods_upload(self):
        inst = self._inst()
        if _running(inst):
            return 400, {'error': '请先停止服务器再安装 Mod'}
        f = (self._fields or {}).get('file')
        if not f or not f.get('data'):
            return 400, {'error': '缺少上传文件'}
        name = os.path.basename(f.get('filename') or '')
        if not name.endswith('.jar'):
            return 400, {'error': '仅支持 .jar 文件'}
        moddir = os.path.join(inst['dir'], 'mods')
        os.makedirs(moddir, exist_ok=True)
        with open(os.path.join(moddir, name), 'wb') as _fh:
            _fh.write(f['data'])
        return 200, {'ok': True, 'message': 'Mod 已上传：%s' % name}

    def _rt_mods_delete(self, body):
        inst = self._inst()
        if _running(inst):
            return 400, {'error': '请先停止服务器再删除 Mod'}
        data = body or {}
        name = os.path.basename(str(data.get('name', '')))
        if not _safe_name(name):
            return 400, {'error': '无效文件名'}
        fp = os.path.join(inst['dir'], 'mods', name)
        if not os.path.isfile(fp):
            return 404, {'error': 'Mod 不存在'}
        os.remove(fp)
        return 200, {'ok': True, 'message': '已删除：%s' % name}

    # ---------- 计划 ----------
    def _rt_schedule_get(self):
        inst = self._inst()
        return 200, {
            'auto_restart': bool(inst.get('auto_restart', True)),
            'backup_interval_hours': int(inst.get('backup_interval_hours', 0)),
            'backup_keep': int(inst.get('backup_keep', 10)),
            'restart_at': inst.get('restart_at', ''),
        }

    def _rt_schedule_set(self, body):
        inst = self._inst()
        data = body or {}
        if 'auto_restart' in data:
            inst['auto_restart'] = bool(data['auto_restart'])
        if 'backup_interval_hours' in data:
            try:
                inst['backup_interval_hours'] = int(data['backup_interval_hours'])
            except (TypeError, ValueError):
                pass
        if 'backup_keep' in data:
            try:
                inst['backup_keep'] = int(data['backup_keep'])
            except (TypeError, ValueError):
                pass
        if 'restart_at' in data:
            v = str(data.get('restart_at', '') or '')
            if v and not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', v):
                return 400, {'error': '时间格式应为 HH:MM'}
            inst['restart_at'] = v
        _save()
        return 200, {'ok': True}

    # ---------- 服务核心 ----------
    def _rt_cores(self):
        out = []
        for c in CORES:
            data = None
            cached = _CORE_CACHE.get(c)
            if cached and time.time() - cached[0] < _CORE_TTL:
                data = cached[1]
            if not data:
                # 无缓存: 不阻塞网络(先返回占位, 前端可刷新/安装时再取)
                out.append({'id': c, 'name': CORE_LABELS.get(c, c),
                            'version_count': 0, 'latest': '', 'versions': [],
                            'loading': True})
                continue
            out.append({
                'id': c,
                'name': CORE_LABELS.get(c, c),
                'version_count': len(data['versions']),
                'latest': data.get('latest', ''),
                'versions': data['versions'][:200],
                'loading': False,
            })
        return 200, {'cores': out}

    def _rt_core_install(self, body):
        inst = self._inst()
        if inst is None:
            return 404, {'error': '实例不存在'}
        if _running(inst):
            return 400, {'error': '请先停止服务器再安装核心'}
        data = body or {}
        core = str(data.get('core', ''))
        version = str(data.get('version', ''))
        if core not in CORES or not version:
            return 400, {'error': '无效的核心或版本'}
        # 解析下载地址（可能失败）
        try:
            url, fname, itype = _core_jar_url(core, version)
        except Exception:
            return 502, {'error': '解析下载地址失败，请稍后再试'}
        if not url:
            return 404, {'error': '该版本暂无 %s 下载，请换版本' % CORE_LABELS.get(core, core)}
        if inst.get('install_state') and not inst.get('install_done'):
            return 400, {'error': '已有安装任务进行中，请等待完成'}

        if not _ensure_dir(inst['dir']):
            return 500, {'error': '无法创建实例目录 %s（权限不足）' % inst['dir']}
        dest = os.path.join(inst['dir'], fname)
        inst['install_state'] = '下载 %s %s…' % (CORE_LABELS.get(core, core), version)
        inst['install_error'] = False
        inst['install_done'] = False
        _save()

        def _task(_core, _ver, _url, _fname, _itype, _dest):
            try:
                inst['install_state'] = '下载中…'
                _save()
                tmp = _dest + '.download'
                body = _http_get(_url, timeout=300)
                with open(tmp, 'wb') as f:
                    f.write(body)
                os.replace(tmp, _dest)
                if _itype == 'installer':
                    inst['install_state'] = '运行安装器…'
                    _save()
                    jv = inst.get('java', DEFAULT_JAVA)
                    r = _run([jv, '-jar', _dest, '--installServer'], timeout=900, cwd=inst['dir'])
                    if r and r.returncode != 0:
                        inst['install_state'] = '安装失败: ' + (r.stderr or '').strip()[-300:]
                        inst['install_error'] = True
                        return
                    # 现代 Forge/NeoForge 安装器会把真正的 server jar 放进 libraries/，
                    # 并生成官方 run.sh（内部用 @unix_args.txt 提供 classpath+主类），
                    # 不再依赖 `java -jar` 单 jar，因此以 run.sh 作为启动入口。
                    runsh = os.path.join(inst['dir'], 'run.sh')
                    if os.path.isfile(runsh):
                        # run.sh 默认 `exec java` 用的是系统 PATH 里的 java，可能过旧。
                        # 改写成实例配置的 java 路径，并注入内存到 user_jvm_args.txt。
                        try:
                            with open(runsh, 'r', encoding='utf-8', errors='replace') as _f:
                                _txt = _f.read()
                            _jv = inst.get('java', DEFAULT_JAVA)
                            _mx = inst.get('mem_max', '4G')
                            _txt = _txt.replace('exec java', 'exec %s' % _jv)
                            _txt = _txt.replace('"$@"', '"$@"')  # 保留透传参数
                            with open(runsh, 'w', encoding='utf-8') as _f:
                                _f.write(_txt)
                            _ujp = os.path.join(inst['dir'], 'user_jvm_args.txt')
                            if os.path.isfile(_ujp):
                                _uj = open(_ujp, 'r', encoding='utf-8', errors='replace').read()
                                _memline = '-Xmx' + _mx + '\n'
                                if '-Xmx' not in _uj:
                                    _uj += '\n' + _memline
                                    with open(_ujp, 'w', encoding='utf-8') as _f:
                                        _f.write(_uj)
                        except Exception:
                            pass
                        try:
                            os.chmod(runsh, 0o755)
                        except Exception:
                            pass
                        inst['jar'] = 'run.sh'
                        inst['start_cmd'] = 'sh run.sh --nogui'
                    else:
                        # 旧版安装器在实例根目录直接生成 forge-<ver>(-server).jar
                        if _core == 'neoforge':
                            pat = os.path.join(inst['dir'], 'neoforge-' + _ver + '.jar')
                        else:
                            pat = os.path.join(inst['dir'], 'forge-' + _ver + '.jar')
                        _server = pat if os.path.isfile(pat) else _dest
                        jv = inst.get('java', DEFAULT_JAVA)
                        mx = inst.get('mem_max', '4G')
                        inst['jar'] = os.path.basename(_server)
                        inst['start_cmd'] = '%s -Xmx%s -jar %s nogui' % (jv, mx, os.path.basename(_server))
                else:
                    inst['jar'] = os.path.basename(_dest)
                    jv = inst.get('java', DEFAULT_JAVA)
                    mx = inst.get('mem_max', '4G')
                    inst['start_cmd'] = '%s -Xmx%s -jar %s nogui' % (jv, mx, os.path.basename(_dest))
                inst['install_state'] = '%s %s 安装完成' % (CORE_LABELS.get(_core, _core), _ver)
            except urllib.error.HTTPError as e:
                inst['install_state'] = '下载失败 (HTTP %s)' % e.code
                inst['install_error'] = True
            except Exception as e:
                inst['install_state'] = '安装失败: %s' % e
                inst['install_error'] = True
            finally:
                inst['install_done'] = True
                _save()

        def _thread():
            try:
                _task(core, version, url, fname, itype, dest)
            except Exception:
                pass

        threading.Thread(target=_thread, daemon=True).start()
        return 200, {'ok': True, 'async': True,
                     'message': '已开始安装 %s %s' % (CORE_LABELS.get(core, core), version)}

    def _rt_core_install_status(self):
        inst = self._inst()
        if inst is None:
            return 200, {'state': None, 'error': False, 'done': False, 'jar': ''}
        return 200, {
            'state': inst.get('install_state'),
            'error': bool(inst.get('install_error', False)),
            'done': bool(inst.get('install_done', False)),
            'jar': inst.get('jar', ''),
        }

    # ---------- 日志 ----------
    def _rt_logs(self, q):
        inst = self._inst()
        if not inst:
            return 200, {'logs': '', 'error': '未选择实例'}
        try:
            lines = int(q.get('lines', 300))
        except (TypeError, ValueError):
            lines = 300
        path = os.path.join(inst['dir'], 'logs', 'latest.log')
        if not os.path.isfile(path):
            return 200, {'logs': '暂无日志文件'}
        r = _run(['tail', '-%d' % lines, path], timeout=15)
        if r is None or r.returncode != 0:
            return 500, {'error': '读取日志失败'}
        return 200, {'logs': r.stdout.rstrip('\n')}

    # ---------- 新体系插件元数据 ----------
    def _rt_info(self):
        return 200, {'name': 'mcserver', 'label': 'MC 服务器', 'version': '2.0.0',
                     'lang': 'python',
                     'description': '多实例 Minecraft 服务器：实时控制台、监控、RCON、玩家/世界/Mod 管理、崩溃守护、完整配置'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            self._body_obj = {}
            self._fields = {}
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/instances":
                return self._json(*self._rt_instances())
            if p == "/core/jars":
                return self._json(*self._rt_core_jars(q))
            if p == "/instance/javas":
                return self._json(*self._rt_javas())
            if p == "/instance/detail":
                return self._json(*self._rt_instance_detail())
            if p == "/status":
                return self._json(*self._rt_status())
            if p == "/console":
                return self._json(*self._rt_console_get(q))
            if p == "/stream":
                return self._rt_stream(q)
            if p == "/metrics":
                return self._json(*self._rt_metrics())
            if p == "/config":
                return self._json(*self._rt_config_get())
            if p == "/players":
                return self._json(*self._rt_players())
            if p == "/whitelist":
                return self._json(*self._rt_whitelist_get())
            if p == "/ops":
                return self._json(*self._rt_ops_get())
            if p == "/bans":
                return self._json(*self._rt_bans())
            if p == "/world/info":
                return self._json(*self._rt_world_info())
            if p == "/world/backups":
                return self._json(*self._rt_world_backups())
            if p == "/world/download":
                r = self._rt_world_download(q)
                if r:
                    return self._json(*r)
                return
            if p == "/mods":
                return self._json(*self._rt_mods())
            if p == "/schedule":
                return self._json(*self._rt_schedule_get())
            if p == "/cores":
                return self._json(*self._rt_cores())
            if p == "/core/install/status":
                return self._json(*self._rt_core_install_status())
            if p == "/logs":
                return self._json(*self._rt_logs(q))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            self._parse_post()
            if p == "/core/switch":
                return self._json(*self._rt_core_switch(self._body_obj))
            if p == "/instance/clear-active":
                return self._json(*self._rt_instance_clear_active())
            if p == "/instance/add":
                return self._json(*self._rt_instance_add(self._body_obj))
            if p == "/instance/update":
                return self._json(*self._rt_instance_update(self._body_obj))
            if p == "/instance/remove":
                return self._json(*self._rt_instance_remove(self._body_obj))
            if p == "/instance/set":
                return self._json(*self._rt_instance_set(self._body_obj))
            if p == "/start":
                return self._json(*self._rt_start(self._body_obj))
            if p == "/stop":
                return self._json(*self._rt_stop(self._body_obj))
            if p == "/restart":
                return self._json(*self._rt_restart(self._body_obj))
            if p == "/console":
                return self._json(*self._rt_console_send(self._body_obj))
            if p == "/kick":
                return self._json(*self._rt_kick(self._body_obj))
            if p == "/whitelist":
                return self._json(*self._rt_whitelist_set(self._body_obj))
            if p == "/ops":
                return self._json(*self._rt_ops_set(self._body_obj))
            if p == "/ban":
                return self._json(*self._rt_ban())
            if p == "/unban":
                return self._json(*self._rt_unban())
            if p == "/ban-ip":
                return self._json(*self._rt_ban_ip())
            if p == "/pardon-ip":
                return self._json(*self._rt_pardon_ip())
            if p == "/config":
                return self._json(*self._rt_config_set(self._body_obj))
            if p == "/world/backup":
                return self._json(*self._rt_world_backup(self._body_obj))
            if p == "/world/backup/delete":
                return self._json(*self._rt_world_backup_delete(self._body_obj))
            if p == "/world/restore":
                return self._json(*self._rt_world_restore(self._body_obj))
            if p == "/world/import":
                return self._json(*self._rt_world_import())
            if p == "/mods/upload":
                return self._json(*self._rt_mods_upload())
            if p == "/mods/delete":
                return self._json(*self._rt_mods_delete(self._body_obj))
            if p == "/schedule":
                return self._json(*self._rt_schedule_set(self._body_obj))
            if p == "/core/install":
                return self._json(*self._rt_core_install(self._body_obj))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("mcserver ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()