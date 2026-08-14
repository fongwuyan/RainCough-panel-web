"""插件市场 + 面板更新/安装 + 环境自检。

RainCough 面板的远程能力:
  - 从私有插件仓 RainCough-Plugin 拉取 registry 并安装/更新/卸载插件
  - 从程序仓 RainCough-panel-web 拉取面板本体并安装/更新
  - 安装前确认设备环境; 环境不足时自动拉取离线环境包(runtime)并切换解释器

依赖: curl_cffi(requests 兼容), 与面板其余部分一致。
"""
import os
import io
import re
import sys
import json
import time
import base64
import shutil
import socket
import secrets
import tarfile
import zipfile
import tempfile
import importlib.util
import threading

from flask import Blueprint, jsonify, request
from curl_cffi import requests as crequests

store = Blueprint('store', __name__, url_prefix='/api/store')

# 运行期注入(app.py 调用 init_store 绑定)
_manager = None
_PLUGINS_DIR = None
_BASE_DIR = None
_DATA_DIR = None
_SECRET_FILE = None


def init_store(manager, plugins_dir):
    global _manager, _PLUGINS_DIR, _BASE_DIR, _DATA_DIR, _SECRET_FILE
    _manager = manager
    _PLUGINS_DIR = plugins_dir
    _BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    _DATA_DIR = os.path.join(_BASE_DIR, 'data')
    _SECRET_FILE = os.path.join(_DATA_DIR, '.store_secret')
    os.makedirs(_DATA_DIR, exist_ok=True)


CONFIG_FILE = lambda: os.path.join(_DATA_DIR, 'store_config.json')
RUNTIME_DIR = lambda: os.path.join(_BASE_DIR, 'runtime')
ENV_ASSET_PREFIX = 'env-offline-linux-x86_64'

DEFAULT_CONFIG = {
    'machine_label': '',
    'port': 3000,
    'bind': '0.0.0.0',
    'plugin_repo': {'owner': 'fongwuyan', 'repo': 'RainCough-Plugin', 'branch': 'main'},
    'panel_repo': {'owner': 'fongwuyan', 'repo': 'RainCough-panel-web', 'branch': 'main'},
    'github_token_enc': '',
}


# ---------------------------------------------------------------------------
# 配置持久化 + Token 加密(复用 AES-256-GCM 思路)
# ---------------------------------------------------------------------------
def _secret():
    if not os.path.exists(_SECRET_FILE):
        with open(_SECRET_FILE, 'wb') as f:
            f.write(secrets.token_bytes(32))
    with open(_SECRET_FILE, 'rb') as f:
        return f.read()


def _gcm():
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    return AESGCM(_secret())


def _enc(s):
    if not s:
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


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    cfg['plugin_repo'] = dict(DEFAULT_CONFIG['plugin_repo'])
    cfg['panel_repo'] = dict(DEFAULT_CONFIG['panel_repo'])
    try:
        if os.path.isfile(CONFIG_FILE()):
            with open(CONFIG_FILE(), encoding='utf-8') as f:
                saved = json.load(f)
            for k in ('machine_label', 'port', 'bind'):
                if k in saved:
                    cfg[k] = saved[k]
            for k in ('plugin_repo', 'panel_repo'):
                if isinstance(saved.get(k), dict):
                    cfg[k].update(saved[k])
            if 'github_token_enc' in saved:
                cfg['github_token_enc'] = saved['github_token_enc']
    except Exception:
        pass
    return cfg


def save_config(cfg):
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = CONFIG_FILE() + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CONFIG_FILE())
    try:
        os.chmod(CONFIG_FILE(), 0o600)
    except OSError:
        pass


def config_out(cfg):
    out = dict(cfg)
    out['github_token_enc'] = ''
    out['has_token'] = bool(cfg.get('github_token_enc'))
    return out


# ---------------------------------------------------------------------------
# GitHub 请求助手(私有仓需 token)
# ---------------------------------------------------------------------------
def _headers(cfg):
    token = _dec(cfg.get('github_token_enc', ''))
    h = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'RainCough-panel',
    }
    if token:
        h['Authorization'] = 'Bearer ' + token
    return h


def _gh_get(cfg, path, timeout=30):
    url = 'https://api.github.com' + path
    r = crequests.get(url, headers=_headers(cfg), timeout=timeout)
    if r.status_code == 404:
        raise RuntimeError('GitHub 资源不存在(检查仓库/Tag/权限)')
    if r.status_code == 401:
        raise RuntimeError('GitHub Token 无效或已过期')
    if r.status_code == 403:
        raise RuntimeError('GitHub 访问被拒绝(可能达到速率限制)')
    if r.status_code != 200:
        raise RuntimeError('GitHub 请求失败 HTTP %d' % r.status_code)
    return r.json()


def _repo(cfg, key):
    r = cfg.get(key) or {}
    return {
        'owner': (r.get('owner') or '').strip(),
        'repo': (r.get('repo') or '').strip(),
        'branch': (r.get('branch') or 'main').strip(),
    }


# ---------------------------------------------------------------------------
# 环境自检
# ---------------------------------------------------------------------------
def _writable(path):
    try:
        probe = os.path.join(path, '.wtest')
        with open(probe, 'w') as f:
            f.write('1')
        os.remove(probe)
        return True
    except Exception:
        return False


def _disk_free_mb(path):
    try:
        return shutil.disk_usage(path).free // (1024 * 1024)
    except Exception:
        return 0


def _port_available(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('0.0.0.0', int(port)))
        return True
    except OSError:
        return False
    finally:
        s.close()


def _reachable(cfg, timeout=8):
    try:
        r = crequests.get('https://api.github.com', headers=_headers(cfg),
                          timeout=timeout)
        return r.status_code < 500
    except Exception:
        return False


REQUIRED_IMPORTS = ['flask', 'flask_cors', 'curl_cffi', 'psutil', 'cryptography']


def _dep_ok():
    missing = []
    for mod in REQUIRED_IMPORTS:
        try:
            __import__(mod)
        except Exception:
            missing.append(mod)
    return missing


def check_env(include_net=True):
    """返回 {items:[{name,ok,detail}], ok}。"""
    cfg = load_config()
    items = []
    pyv = '%d.%d.%d' % sys.version_info[:3]
    items.append({'name': 'python_version', 'label': 'Python 版本',
                  'ok': sys.version_info >= (3, 9), 'detail': pyv})
    missing = _dep_ok()
    items.append({'name': 'deps', 'label': '核心依赖',
                  'ok': not missing,
                  'detail': ('缺失: ' + ', '.join(missing)) if missing else 'flask / curl_cffi / psutil / cryptography'})
    free = _disk_free_mb(_BASE_DIR)
    items.append({'name': 'disk', 'label': '磁盘空间',
                  'ok': free >= 512, 'detail': '%d MB 可用' % free})
    writable = _writable(_BASE_DIR)
    items.append({'name': 'writable', 'label': '安装目录可写',
                  'ok': writable, 'detail': _BASE_DIR if writable else '目录只读'})
    port = int(cfg.get('port') or 3000)
    pa = _port_available(port)
    items.append({'name': 'port', 'label': '端口 %d' % port,
                  'ok': pa, 'detail': '可用' if pa else '已被占用'})
    if include_net:
        net = _reachable(cfg)
        items.append({'name': 'network', 'label': 'GitHub 连通性',
                      'ok': net, 'detail': '可达' if net else '无法访问 api.github.com'})
    return {'items': items, 'ok': all(x['ok'] for x in items)}


def _current_runtime_python():
    """若已装离线环境包则返回其解释器路径, 否则返回当前 sys.executable。"""
    runtime = RUNTIME_DIR()
    if os.path.isdir(runtime):
        for cand in (os.path.join(runtime, 'bin', 'python3'),
                     os.path.join(runtime, 'python', 'bin', 'python3'),
                     os.path.join(runtime, 'install', 'bin', 'python3')):
            if os.path.isfile(cand):
                return cand
    return sys.executable


# ---------------------------------------------------------------------------
# 离线环境包
# ---------------------------------------------------------------------------
def _find_offline_asset(cfg):
    repo = _repo(cfg, 'panel_repo')
    rel = _gh_get(cfg, '/repos/%s/%s/releases/latest' % (repo['owner'], repo['repo']))
    for a in rel.get('assets', []):
        if a.get('name', '').startswith(ENV_ASSET_PREFIX) and a.get('name', '').endswith('.tar.gz'):
            return a
    return None


def _download_asset(cfg, asset, dest):
    url = asset['browser_download_url']
    h = _headers(cfg)
    r = crequests.get(url, headers=h, timeout=300)
    if r.status_code != 200:
        raise RuntimeError('下载离线环境包失败 HTTP %d' % r.status_code)
    with open(dest, 'wb') as f:
        f.write(r.content)


def _install_offline_env(cfg, update=None, tid=None):
    """下载离线环境包并解压到 runtime/, 返回解释器路径。"""
    def up(msg, prog):
        if tid:
            from tasks import update as task_update
            task_update(tid, phase='env', progress=prog, message=msg)
        elif update:
            update(msg, prog)

    asset = _find_offline_asset(cfg)
    if not asset:
        raise RuntimeError('未找到离线环境包 Release 资产(%s.tar.gz)' % ENV_ASSET_PREFIX)
    up('找到离线环境包: %s (%d MB)' % (asset['name'], asset['size'] // 1024 // 1024), 20)
    with tempfile.TemporaryDirectory() as tmp:
        tgz = os.path.join(tmp, 'env.tar.gz')
        _download_asset(cfg, asset, tgz)
        up('下载完成, 解压中…', 60)
        runtime = RUNTIME_DIR()
        if os.path.isdir(runtime):
            shutil.rmtree(runtime)
        os.makedirs(runtime, exist_ok=True)
        with tarfile.open(tgz, 'r:gz') as tf:
            # 保留顶层目录 python/ 或 install/ 结构
            members = []
            top = None
            for m in tf.getmembers():
                parts = m.name.split('/', 1)
                if top is None:
                    top = parts[0]
                if len(parts) > 1:
                    m.name = parts[1]
                    members.append(m)
            tf.extractall(runtime, members=members)
    py = _current_runtime_python()
    if not os.path.isfile(py):
        raise RuntimeError('解压后未找到 Python 解释器')
    up('验证离线环境…', 85)
    # 用新解释器验证依赖
    code = ('import flask,flask_cors,curl_cffi,psutil,cryptography;'
            'import sys;print(sys.version.split()[0])')
    import subprocess
    r = subprocess.run([py, '-c', code], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError('离线环境依赖验证失败: %s' % r.stderr.strip()[:300])
    up('离线环境就绪 (%s)' % r.stdout.strip(), 100)
    return py


# ---------------------------------------------------------------------------
# 插件市场
# ---------------------------------------------------------------------------
def fetch_registry(cfg):
    repo = _repo(cfg, 'plugin_repo')
    if not repo['owner'] or not repo['repo']:
        raise RuntimeError('请先在设置页填写插件仓库')
    data = _gh_get(cfg, '/repos/%s/%s/contents/registry.json?ref=%s'
                    % (repo['owner'], repo['repo'], repo['branch']))
    raw = base64.b64decode(data.get('content', '')).decode('utf-8')
    reg = json.loads(raw)
    return reg


def _installed_version(name):
    d = os.path.join(_PLUGINS_DIR, name)
    if not os.path.isdir(d):
        return None
    ver = None
    for f in ('VERSION', 'info.prop'):
        p = os.path.join(d, f)
        if os.path.isfile(p):
            try:
                with open(p, encoding='utf-8', errors='replace') as fh:
                    content = fh.read()
                m = re.search(r'(?:version|ver)\s*=\s*([\w.]+)', content, re.I)
                if m:
                    ver = m.group(1)
                    break
            except Exception:
                pass
    return ver or 'local'


def _load_plugin_dir(name):
    """动态加载 plugins/<name>/plugin.py 并注册。返回插件实例或抛错。"""
    plugin_file = os.path.join(_PLUGINS_DIR, name, 'plugin.py')
    spec = importlib.util.spec_from_file_location('plugins.%s.plugin' % name, plugin_file)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    from plugins.base import Plugin
    for attr in dir(mod):
        cls = getattr(mod, attr)
        if isinstance(cls, type) and cls.__name__ != 'Plugin' and issubclass(cls, Plugin):
            inst = cls()
            _manager.register(inst)
            return inst
    raise RuntimeError('插件 "%s" 中未找到 Plugin 子类' % name)


def _download_repo_zipball(cfg, key):
    repo = _repo(cfg, key)
    url = 'https://api.github.com/repos/%s/%s/zipball/%s' % (repo['owner'], repo['repo'], repo['branch'])
    r = crequests.get(url, headers=_headers(cfg), allow_redirects=True, timeout=300)
    if r.status_code != 200:
        raise RuntimeError('下载仓库失败 HTTP %d' % r.status_code)
    return r.content


def _extract_plugin_src(zip_bytes, name, dest):
    """从整仓 zipball 中取 <name>/ 子目录到 dest。"""
    found = False
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            parts = info.filename.split('/')
            if len(parts) < 2 or parts[1] != name:
                continue
            found = True
            rel = '/'.join(parts[2:])
            target = os.path.join(dest, rel)
            if info.is_dir():
                os.makedirs(target, exist_ok=True)
                continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with zf.open(info) as src, open(target, 'wb') as dst:
                shutil.copyfileobj(src, dst)
    if not found:
        raise RuntimeError('仓库中未找到插件目录: %s' % name)


PROTECTED_RUNTIME_DIRS = ('downloads', 'cache', 'work', 'data', 'img')


def _install_from_src(name, src_dir, tid):
    from tasks import update as task_update
    dst = os.path.join(_PLUGINS_DIR, name)
    if not os.path.isdir(dst):
        os.makedirs(dst)
    for entry in os.listdir(src_dir):
        s = os.path.join(src_dir, entry)
        t = os.path.join(dst, entry)
        if os.path.isdir(s) and entry in PROTECTED_RUNTIME_DIRS and os.path.exists(t):
            # 保留运行态数据目录, 仅覆盖其中非运行态文件
            shutil.copytree(s, t, dirs_exist_ok=True)
        else:
            if os.path.isdir(t):
                shutil.rmtree(t)
            shutil.copytree(s, t) if os.path.isdir(s) else shutil.copy2(s, t)
    task_update(tid, phase='loading', progress=90, message='加载插件…')
    _load_plugin_dir(name)


@store.route('/settings', methods=['GET'])
def store_settings_get():
    return jsonify({'status': True, 'config': config_out(load_config())})


@store.route('/settings', methods=['POST'])
def store_settings_set():
    b = request.get_json(silent=True) or {}
    cfg = load_config()
    if 'machine_label' in b:
        cfg['machine_label'] = str(b['machine_label'] or '')
    if 'port' in b:
        try:
            cfg['port'] = int(b['port'])
        except Exception:
            pass
    if 'bind' in b:
        cfg['bind'] = str(b['bind'] or '0.0.0.0')
    for key in ('plugin_repo', 'panel_repo'):
        if isinstance(b.get(key), dict):
            r = cfg.get(key) or {}
            for fld in ('owner', 'repo', 'branch'):
                if fld in b[key]:
                    r[fld] = str(b[key][fld] or '').strip()
            cfg[key] = r
    if 'github_token' in b:
        cfg['github_token_enc'] = _enc(b['github_token'])
    save_config(cfg)
    return jsonify({'status': True, 'config': config_out(cfg)})


@store.route('/ping', methods=['POST'])
def store_ping():
    cfg = load_config()
    if not cfg.get('github_token_enc'):
        return jsonify({'status': False, 'ok': False, 'error': '未填写 GitHub Token'})
    try:
        r = crequests.get('https://api.github.com/user',
                          headers=_headers(cfg), timeout=15)
        if r.status_code == 200:
            data = r.json()
            return jsonify({'status': True, 'ok': True,
                            'user': data.get('login')})
        return jsonify({'status': False, 'ok': False,
                        'error': 'Token 无效 (HTTP %d)' % r.status_code})
    except Exception as e:
        return jsonify({'status': False, 'ok': False, 'error': str(e)})


@store.route('/registry', methods=['GET'])
def store_registry():
    cfg = load_config()
    try:
        reg = fetch_registry(cfg)
    except Exception as e:
        return jsonify({'status': False, 'error': str(e)}), 400
    plugins = reg.get('plugins', [])
    for p in plugins:
        name = p.get('name', '')
        ver = _installed_version(name)
        p['installed'] = ver is not None
        p['installed_version'] = ver
    return jsonify({'status': True, 'plugins': plugins,
                    'updated': reg.get('updated', '')})


@store.route('/plugin/install', methods=['POST'])
def store_plugin_install():
    b = request.get_json(silent=True) or {}
    name = (b.get('name') or '').strip()
    if not name or not re.match(r'^[A-Za-z0-9_\-]+$', name):
        return jsonify({'error': '无效的插件名'}), 400
    if os.path.isdir(os.path.join(_PLUGINS_DIR, name)):
        return jsonify({'error': '插件 "%s" 已安装, 请使用更新' % name}), 409
    from tasks import begin, finish
    tid = begin('store', '安装插件 %s' % name, kind='install')

    def _work():
        try:
            cfg = load_config()
            update = lambda m, p: (lambda: None)
            from tasks import update as task_update
            task_update(tid, phase='downloading', progress=15, message='拉取插件源码…')
            zip_bytes = _download_repo_zipball(cfg, 'plugin_repo')
            task_update(tid, phase='extracting', progress=50, message='解压提取…')
            with tempfile.TemporaryDirectory() as tmp:
                src_dir = os.path.join(tmp, name)
                os.makedirs(src_dir, exist_ok=True)
                _extract_plugin_src(zip_bytes, name, src_dir)
                task_update(tid, phase='installing', progress=75, message='安装到插件目录…')
                _install_from_src(name, src_dir, tid)
            finish(tid, True, message='插件 %s 安装完成' % name)
        except Exception as e:
            finish(tid, False, error=str(e))

    threading.Thread(target=_work, daemon=True).start()
    return jsonify({'status': True, 'message': '已开始安装 %s, 可在任务队列查看进度' % name, 'task': tid})


@store.route('/plugin/update', methods=['POST'])
def store_plugin_update():
    b = request.get_json(silent=True) or {}
    name = (b.get('name') or '').strip()
    if not name or not re.match(r'^[A-Za-z0-9_\-]+$', name):
        return jsonify({'error': '无效的插件名'}), 400
    if not os.path.isdir(os.path.join(_PLUGINS_DIR, name)):
        return jsonify({'error': '插件 "%s" 未安装' % name}), 404
    from tasks import begin, finish
    tid = begin('store', '更新插件 %s' % name, kind='install')

    def _work():
        try:
            cfg = load_config()
            from tasks import update as task_update
            task_update(tid, phase='downloading', progress=15, message='拉取插件源码…')
            zip_bytes = _download_repo_zipball(cfg, 'plugin_repo')
            task_update(tid, phase='extracting', progress=50, message='解压提取…')
            with tempfile.TemporaryDirectory() as tmp:
                src_dir = os.path.join(tmp, name)
                os.makedirs(src_dir, exist_ok=True)
                _extract_plugin_src(zip_bytes, name, src_dir)
                task_update(tid, phase='installing', progress=75, message='覆盖更新…')
                _install_from_src(name, src_dir, tid)
            finish(tid, True, message='插件 %s 更新完成' % name)
        except Exception as e:
            finish(tid, False, error=str(e))

    threading.Thread(target=_work, daemon=True).start()
    return jsonify({'status': True, 'message': '已开始更新 %s, 可在任务队列查看进度' % name, 'task': tid})


@store.route('/plugin/remove', methods=['POST'])
def store_plugin_remove():
    b = request.get_json(silent=True) or {}
    name = (b.get('name') or '').strip()
    d = os.path.join(_PLUGINS_DIR, name)
    if not os.path.isdir(d):
        return jsonify({'error': '插件不存在'}), 404
    shutil.rmtree(d)
    _manager.remove(name)
    return jsonify({'status': True, 'message': '已卸载插件: %s' % name})


# ---------------------------------------------------------------------------
# 面板更新 / 安装
# ---------------------------------------------------------------------------
@store.route('/project/status', methods=['GET'])
def store_project_status():
    cfg = load_config()
    local_ver = '0.0.0'
    vfile = os.path.join(_BASE_DIR, 'VERSION')
    if os.path.isfile(vfile):
        with open(vfile, encoding='utf-8') as f:
            local_ver = f.read().strip() or '0.0.0'
    remote = None
    try:
        repo = _repo(cfg, 'panel_repo')
        data = _gh_get(cfg, '/repos/%s/%s/contents/VERSION?ref=%s'
                       % (repo['owner'], repo['repo'], repo['branch']))
        remote = base64.b64decode(data.get('content', '')).decode('utf-8').strip()
    except Exception:
        remote = None
    return jsonify({'status': True, 'local': local_ver, 'remote': remote,
                    'runtime_python': _current_runtime_python()})


@store.route('/project/check', methods=['POST'])
def store_project_check():
    body = request.get_json(silent=True) or {}
    result = check_env(include_net=bool(body.get('net', True)))
    try:
        result['offline_env_available'] = _find_offline_asset(load_config()) is not None
    except Exception:
        result['offline_env_available'] = None
    return jsonify(result)


def _run_install(tid, dry_run=False):
    """核心安装/更新流程。dry_run 时只校验环境与可达性, 不改动文件。"""
    from tasks import update as task_update
    cfg = load_config()
    repo = _repo(cfg, 'panel_repo')
    if not repo['owner'] or not repo['repo']:
        raise RuntimeError('请先在设置页填写程序仓库')
    task_update(tid, phase='check', progress=5, message='确认设备环境…')
    env = check_env()
    env_ok = env['ok']
    if not env_ok:
        if not _find_offline_asset(cfg):
            raise RuntimeError('环境不满足且无离线环境包: %s'
                               % ', '.join(x['label'] for x in env['items'] if not x['ok']))
        task_update(tid, phase='env', progress=15, message='环境不足, 拉取离线环境包…')
        _install_offline_env(cfg, tid=tid)
    task_update(tid, phase='download', progress=30, message='拉取面板源码…')
    zip_bytes = _download_repo_zipball(cfg, 'panel_repo')
    if dry_run:
        task_update(tid, phase='done', progress=100, message='环境校验通过(dry-run)')
        return
    task_update(tid, phase='extract', progress=55, message='解压暂存…')
    backup = None
    try:
        with tempfile.TemporaryDirectory() as tmp:
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                top = zf.infolist()[0].filename.split('/')[0] if zf.infolist() else 'src'
                zf.extractall(tmp)
            src = os.path.join(tmp, top)
            if not os.path.isdir(src):
                src = tmp
            # 备份旧面板
            if os.path.isfile(os.path.join(_BASE_DIR, 'app.py')):
                backup = os.path.join(_BASE_DIR, '.panel.bak')
                if os.path.isdir(backup):
                    shutil.rmtree(backup)
                shutil.copytree(_BASE_DIR, backup,
                                ignore=shutil.ignore_patterns(
                                    'runtime', 'data', '__pycache__',
                                    'plugins/*/downloads', '*.pyc'))
            task_update(tid, phase='copy', progress=75, message='覆盖面板文件…')
            _replace_panel(src)
        task_update(tid, phase='restart', progress=95, message='文件就绪, 准备重启…')
        finish_code = _request_restart()
        task_update(tid, phase='restarting', progress=100,
                    message='面板更新完成%s' % (', 服务重启中…' if finish_code else ''))
    except Exception as e:
        if backup and os.path.isdir(backup):
            try:
                shutil.rmtree(_BASE_DIR)
                shutil.copytree(backup, _BASE_DIR)
            except Exception:
                pass
        raise e


def _replace_panel(src):
    """把新面板 src 覆盖到 BASE_DIR, 排除数据/运行态/密钥/已装插件。"""
    exclude_dirs = {'runtime', 'data', '__pycache__', '.git', 'web', 'node_modules'}
    for entry in os.listdir(src):
        s = os.path.join(src, entry)
        t = os.path.join(_BASE_DIR, entry)
        if entry in exclude_dirs:
            continue
        if entry == 'plugins':
            # 框架层文件覆盖, 插件目录保留
            framework = ('__init__.py', 'base.py', 'converter.py',
                         'llm_common.py', 'sd_common.py', 'yulotool_common.py')
            if not os.path.isdir(t):
                os.makedirs(t)
            for f2 in framework:
                s2 = os.path.join(s, f2)
                if os.path.isfile(s2):
                    shutil.copy2(s2, t)
            continue
        if os.path.isdir(t):
            shutil.rmtree(t)
        if os.path.isdir(s):
            shutil.copytree(s, t, ignore=shutil.ignore_patterns('__pycache__'))
        else:
            if entry not in ('.term_secret', '.term_token'):
                shutil.copy2(s, t)


def _request_restart():
    """尝试优雅重启: 优先 systemctl, 其次 supervisor/initd。Windows 下提示手动。"""
    if os.name == 'nt':
        return False
    import subprocess
    for cmd in (
        ['sudo', '-n', 'systemctl', 'restart', 'touchgal.service'],
        ['systemctl', 'restart', 'touchgal.service'],
        ['sudo', '-n', 'supervisorctl', 'restart', 'touchgal'],
    ):
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=15)
            if r.returncode == 0:
                return True
        except Exception:
            continue
    return False


@store.route('/project/install', methods=['POST'])
def store_project_install():
    b = request.get_json(silent=True) or {}
    dry_run = bool(b.get('dry_run'))
    from tasks import begin, finish
    tid = begin('store', ('面板环境校验' if dry_run else '面板更新'), kind='install')

    def _work():
        try:
            _run_install(tid, dry_run=dry_run)
            if not dry_run:
                finish(tid, True, message='面板更新完成')
        except Exception as e:
            finish(tid, False, error=str(e))

    threading.Thread(target=_work, daemon=True).start()
    return jsonify({'status': True, 'message': '已开始, 可在任务队列查看进度', 'task': tid})
