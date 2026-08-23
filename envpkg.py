import os
import sys
import re
import json
import time
import shutil
import threading
import subprocess
from flask import Blueprint, request, jsonify

envpkg = Blueprint('envpkg', __name__, url_prefix='/api/envpkg')

# 路径允许通过环境变量覆盖(默认宿主部署路径); 便于本机开发与其他挂载布局
DATA_DIR = os.environ.get('TOUCHGAL_DATA_DIR', '/opt/touchgal/data')
REG_FILE = os.path.join(DATA_DIR, 'envs.json')
TASKS_FILE = os.path.join(DATA_DIR, 'tasks.json')
ENV_ROOT = os.environ.get('TOUCHGAL_ENV_ROOT', '/opt/envs')
RUN_ROOT = os.environ.get('TOUCHGAL_RUN_ROOT', '/run/envs')
TMP_ROOT = os.environ.get('TOUCHGAL_TMP_ROOT', os.path.join(ENV_ROOT, '.tmp'))

_LOCK = threading.Lock()
_TASKS = {}
_running = set()


def _load_tasks():
    if not os.path.isfile(TASKS_FILE):
        return {}
    try:
        with open(TASKS_FILE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


RETAIN_FINISHED = 60  # 保留最近 N 条已结束任务，其余清理；活跃任务始终保留


def _save_tasks():
    os.makedirs(DATA_DIR, exist_ok=True)
    _prune_tasks()
    # 内部字段(以下划线开头, 如进度节流标记)不落盘
    payload = {tid: {k: v for k, v in t.items() if not k.startswith('_')}
               for tid, t in _TASKS.items()}
    with open(TASKS_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _prune_tasks():
    """清理超量已结束任务，控制 tasks.json 体积。活跃（进行中/排队）任务不清理。"""
    finished = [tid for tid, t in _TASKS.items()
                if t.get('status') in ('installed', 'error', 'interrupted')]
    if len(finished) <= RETAIN_FINISHED:
        return
    def _ts(tid):
        return _TASKS[tid].get('created') or 0
    keep = set(sorted(finished, key=_ts, reverse=True)[:RETAIN_FINISHED])
    for tid in finished:
        if tid not in keep:
            _TASKS.pop(tid, None)


_TASKS = _load_tasks()


def _recover_stale_tasks():
    with _LOCK:
        for tid, t in _TASKS.items():
            if t.get('status') not in ('installed', 'error'):
                t['status'] = 'interrupted'
                t['message'] = '安装被中断（服务重启），可重新安装'
        _save_tasks()


_recover_stale_tasks()


def _clean_tmp(max_age=86400):
    """清理 /opt/envs/.tmp 下载/编译残留。有进行中任务时只清超龄项, 否则全清。"""
    if not os.path.isdir(TMP_ROOT):
        return 0
    with _LOCK:
        active = bool(_running)
    now = time.time()
    cutoff = now - max_age if active else 0
    removed = 0
    for entry in os.listdir(TMP_ROOT):
        full = os.path.join(TMP_ROOT, entry)
        try:
            st = os.lstat(full)
            if active and st.st_mtime > cutoff:
                continue
            if os.path.isdir(full) and not os.path.islink(full):
                shutil.rmtree(full, ignore_errors=True)
            else:
                os.remove(full)
            removed += 1
        except OSError:
            continue
    return removed


# 启动时清一次下载/编译残留(重启即中断了所有任务)
_clean_tmp()


# sudo 密码不再硬编码: 由 systemd EnvironmentFile(TOUCHGAL_SUDO_PW) 注入;
# 未设置时改用 sudo -n(免密), 适合已配置 NOPASSWD 的主机
SUDO_PW = os.environ.get('TOUCHGAL_SUDO_PW', '')
SUDO = ['sudo', '-S'] if SUDO_PW else ['sudo', '-n']

# ---------------- 版本目录（官方/镜像源） ----------------
_UA = 'TouchGal/1.0'
_CATALOG_CACHE = {}
_CATALOG_TTL = 1800  # 30 分钟缓存


def _get(url, timeout=40):
    import requests
    r = requests.get(url, headers={'User-Agent': _UA}, timeout=timeout)
    r.raise_for_status()
    return r


def _json(url, timeout=40):
    return _get(url, timeout).json()


def _list_java():
    """Adoptium Temurin 所有功能版本（含 LTS），每版取最新 GA 构建。"""
    info = _json('https://api.adoptium.net/v3/info/available_releases')
    lts = set(info.get('available_lts_releases', []))
    vers = []
    for major in info.get('available_releases', []):
        label = 'Java %d (LTS)' % major if major in lts else 'Java %d' % major
        vers.append({'version': str(major), 'label': label, 'type': 'java',
                     'size_hint': '~200MB', 'archive': 'tar.gz'})
    return vers


def _list_node():
    """Node.js 官方 dist 全部版本。"""
    d = _json('https://nodejs.org/dist/index.json')
    vers = []
    for it in d[:120]:
        v = it['version'][1:]
        lts = it.get('lts')
        label = ('Node %s (LTS)' % v) if lts else ('Node %s' % v)
        vers.append({'version': v, 'label': label, 'type': 'node',
                     'size_hint': '~25MB', 'archive': 'tar.xz'})
    return vers


def _list_go():
    """Go 官方 release json，全部版本。"""
    d = _json('https://go.dev/dl/?mode=json&include=all')
    vers = []
    for it in d[:80]:
        v = it['version'][2:]
        if 'rc' in v or 'beta' in v:
            continue
        vers.append({'version': v, 'label': 'Go %s' % v, 'type': 'go',
                     'size_hint': '~100MB', 'archive': 'tar.gz'})
    return vers


def _list_python():
    """Python 官方 ftp 目录，每祖版本取最新。"""
    html = _get('https://www.python.org/ftp/python/').text
    vers = set(re.findall(r'>(\d+\.\d+\.\d+)/', html))
    out = []
    for v in sorted(vers, reverse=True):
        out.append({'version': v, 'label': 'Python %s' % v, 'type': 'python',
                    'size_hint': '~25MB 源码 + 编译', 'archive': 'tar.xz', 'compile': True})
    return out


def _list_php():
    """PHP 官方 releases json（按大版本取最新）。"""
    d = _json('https://www.php.net/releases/?json')
    out = []
    for major in sorted(d.keys(), reverse=True):
        v = d[major].get('version')
        if v:
            out.append({'version': v, 'label': 'PHP %s' % v, 'type': 'php',
                        'size_hint': '~12MB 源码 + 编译', 'archive': 'tar.gz', 'compile': True})
    return out


def _list_maven():
    """Maven 官方仓库 maven-metadata.xml 全部版本（取 3.x）。"""
    xml = _get('https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/maven-metadata.xml').text
    raw = re.findall(r'<version>([^<]+)</version>', xml)
    out = []
    for v in raw:
        if not v.startswith('3.'):
            continue
        out.append({'version': v, 'label': 'Maven %s' % v, 'type': 'maven',
                    'size_hint': '~9MB', 'archive': 'tar.gz'})
    return out


def _list_cpp():
    return [{'version': 'system', 'label': 'C/C++ 工具链 (build-essential)', 'type': 'cpp',
             'size_hint': '系统 apt 安装', 'archive': 'tar.gz', 'compile': False}]


_RUNTIMES = {
    'java': _list_java, 'node': _list_node, 'go': _list_go,
    'python': _list_python, 'php': _list_php, 'maven': _list_maven,
    'cpp': _list_cpp,
}

CPP_TOOLCHAIN = 'build-essential g++ make autoconf automake libtool pkg-config'

# 每类可安装项：静态兜底（源不可达时仍可安装）
FALLBACK = {
    'java': [{'version': '21', 'label': 'Java 21 (LTS)', 'type': 'java'}],
    'node': [{'version': '22.11.0', 'label': 'Node 22.11.0', 'type': 'node'}],
    'go': [{'version': '1.24.0', 'label': 'Go 1.24.0', 'type': 'go'}],
    'python': [{'version': '3.12.7', 'label': 'Python 3.12.7', 'type': 'python', 'compile': True}],
    'php': [{'version': '8.3.14', 'label': 'PHP 8.3.14', 'type': 'php', 'compile': True}],
    'maven': [{'version': '3.9.9', 'label': 'Maven 3.9.9', 'type': 'maven'}],
    'cpp': [{'version': 'system', 'label': 'C/C++ 工具链 (build-essential)', 'type': 'cpp'}],
}


def _runtime_catalog(rtype):
    if rtype in _CATALOG_CACHE:
        entry, ts = _CATALOG_CACHE[rtype]
        if time.time() - ts < _CATALOG_TTL:
            return entry
    try:
        vers = _RUNTIMES[rtype]()
    except Exception:
        vers = FALLBACK.get(rtype, [])
    _CATALOG_CACHE[rtype] = (vers, time.time())
    return vers


def _catalog_async(rtype):
    """返回目录，未缓存时立即返回兜底并在后台拉取，绝不阻塞请求。"""
    if rtype in _CATALOG_CACHE:
        entry, ts = _CATALOG_CACHE[rtype]
        if time.time() - ts < _CATALOG_TTL:
            return entry
    got = FALLBACK.get(rtype, [])

    def _worker():
        try:
            _runtime_catalog(rtype)
        except Exception:
            pass

    threading.Thread(target=_worker, daemon=True).start()
    return got


def _resolve_latest_build(major):
    """Java 安装指定 major 的最新 GA 构建。返回 (url, fname)。"""
    j = _json('https://api.adoptium.net/v3/assets/feature_releases/%d/ga?architecture=x64&image_type=jdk&os=linux&vendor=eclipse&page_size=1' % int(major))
    if not j:
        return None, None
    b = None
    for release in j:
        for bd in release.get('binaries', []):
            if bd.get('package'):
                b = bd
                break
        if b:
            break
    if not b:
        return None, None
    pkg = b['package']
    return pkg['link'], pkg['name']


def _mirror_build(major):
    """从 Adoptium API 取最新 GA 构建的文件名，拼清华镜像 URL。返回 (url, fname, archive, compile)。失败返回 None。"""
    try:
        j = _json('https://api.adoptium.net/v3/assets/feature_releases/%d/ga?architecture=x64&image_type=jdk&os=linux&vendor=eclipse&page_size=1' % int(major))
        fname = None
        for release in j or []:
            for bd in release.get('binaries', []):
                pkg = bd.get('package')
                if pkg:
                    fname = pkg['name']
                    break
            if fname:
                break
        if not fname:
            return None
        mirror = 'https://mirrors.tuna.tsinghua.edu.cn/Adoptium/%d/jdk/x64/linux/%s' % (int(major), fname)
        return mirror, fname, 'tar.gz', False
    except Exception:
        return None


def _url_alive(url, timeout=12):
    """探测下载 URL 是否可达（HEAD 优先，回退 GET range）。"""
    try:
        import requests
        try:
            r = requests.head(url, headers={'User-Agent': _UA}, timeout=timeout, allow_redirects=True)
        except Exception:
            r = requests.get(url, headers={'User-Agent': _UA}, timeout=timeout,
                             allow_redirects=True, stream=True)
        return r.status_code == 200
    except Exception:
        return False


def _runtime_download(runtime, version):
    """返回 (url, fname, archive, compile)。失败抛异常。"""
    t = runtime
    if t == 'java':
        major = version.split('.')[0]
        res = _mirror_build(major)
        if res and _url_alive(res[0]):
            return res
        url, fname = _resolve_latest_build(major)
        return url, fname, 'tar.gz', False
    if t == 'node':
        return ('https://nodejs.org/dist/v%s/node-v%s-linux-x64.tar.xz' % (version, version)), \
            'node-v%s-linux-x64.tar.xz' % version, 'tar.xz', False
    if t == 'go':
        mirror = 'https://mirrors.huaweicloud.com/go/go%s/go%s.linux-amd64.tar.gz' % (version, version)
        if _url_alive(mirror):
            return mirror, 'go%s.linux-amd64.tar.gz' % version, 'tar.gz', False
        return ('https://go.dev/dl/go%s.linux-amd64.tar.gz' % version), \
            'go%s.linux-amd64.tar.gz' % version, 'tar.gz', False
    if t == 'python':
        return ('https://www.python.org/ftp/python/%s/Python-%s.tar.xz' % (version, version)), \
            'Python-%s.tar.xz' % version, 'tar.xz', True
    if t == 'php':
        return ('https://www.php.net/distributions/php-%s.tar.gz' % version), \
            'php-%s.tar.gz' % version, 'tar.gz', True
    if t == 'maven':
        return ('https://archive.apache.org/dist/maven/maven-3/%s/binaries/apache-maven-%s-bin.tar.gz' % (version, version)), \
            'apache-maven-%s-bin.tar.gz' % version, 'tar.gz', False
    if t == 'cpp':
        return None, None, 'tar.gz', False
    raise RuntimeError('未知运行时')


RECIPES = {
    'java-17': {
        'type': 'java', 'version': '17',
        'url': 'https://mirrors.tuna.tsinghua.edu.cn/Adoptium/17/jdk/x64/linux/OpenJDK17U-jdk_x64_linux_hotspot_17.0.20_8.tar.gz',
        'archive': 'tar.gz', 'size_hint': '~190MB',
    },
    'java-21': {
        'type': 'java', 'version': '21',
        'url': 'https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12_8.tar.gz',
        'archive': 'tar.gz', 'size_hint': '~200MB',
    },
    'node-22': {
        'type': 'node', 'version': '22.11.0',
        'url': 'https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/v22.11.0/node-v22.11.0-linux-x64.tar.xz',
        'archive': 'tar.xz', 'size_hint': '~25MB',
    },
    'maven-3.9': {
        'type': 'maven', 'version': '3.9.9',
        'url': 'https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.tar.gz',
        'archive': 'tar.gz', 'size_hint': '~9MB',
    },
    'php-8.2': {
        'type': 'php', 'version': '8.2.20',
        'url': 'https://www.php.net/distributions/php-8.2.20.tar.gz',
        'archive': 'tar.gz', 'compile': True, 'size_hint': '~12MB 源码 + 编译',
    },
}

PHP_BUILD_DEPS = [
    'build-essential', 'autoconf', 'bison', 're2c', 'libtool',
    'libxml2-dev', 'libsqlite3-dev', 'pkg-config', 'zlib1g-dev',
    'libcurl4-openssl-dev', 'libonig-dev', 'libzip-dev', 'libpng-dev',
    'libssl-dev',
]


def _sudo(args, timeout=600, input_pw=True):
    cmd = SUDO + args
    pw = (SUDO_PW + '\n').encode() if (input_pw and SUDO_PW) else None
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=timeout, input=pw)
        return {'ok': p.returncode == 0, 'rc': p.returncode,
                'out': p.stdout.decode('utf-8', 'replace'),
                'err': p.stderr.decode('utf-8', 'replace')}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'rc': -1, 'out': '', 'err': '执行超时'}
    except Exception as e:
        return {'ok': False, 'rc': -1, 'out': '', 'err': str(e)}


def _load_reg():
    if not os.path.isfile(REG_FILE):
        return {}
    try:
        with open(REG_FILE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _save_reg(reg):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(REG_FILE, 'w', encoding='utf-8') as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)


def _download(url, dest, task_id):
    import requests
    last_err = None
    for attempt in range(3):
        try:
            r = requests.get(url, headers={'User-Agent': 'curl/8.0.1'},
                             timeout=(15, 1800), stream=True, allow_redirects=True)
            r.raise_for_status()
            total = int(r.headers.get('content-length') or 0)
            done = 0
            with open(dest, 'wb') as f:
                for chunk in r.iter_content(1 << 20):
                    if chunk:
                        f.write(chunk)
                        done += len(chunk)
                        if total and task_id in _TASKS:
                            _TASKS[task_id]['progress'] = int(done / total * 100)
            return os.path.getsize(dest)
        except Exception as e:
            last_err = e
            if attempt < 2:
                time.sleep(3 * (attempt + 1))
    raise last_err


def _extract(archive, dest, fmt=None):
    os.makedirs(dest, exist_ok=True)
    if fmt == 'tar.xz' or archive.endswith('.tar.xz'):
        p = subprocess.run(['tar', '-xJf', archive, '-C', dest],
                           capture_output=True, timeout=600)
    elif fmt == 'tar.gz' or archive.endswith('.tar.gz') or archive.endswith('.tgz'):
        p = subprocess.run(['tar', '-xzf', archive, '-C', dest],
                           capture_output=True, timeout=600)
    else:
        raise RuntimeError('未知压缩格式: ' + archive)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    entries = [os.path.join(dest, e) for e in os.listdir(dest)
               if not e.startswith('.')]
    if len(entries) == 1 and os.path.isdir(entries[0]):
        inner = entries[0]
        for name in os.listdir(inner):
            shutil.move(os.path.join(inner, name), os.path.join(dest, name))
        shutil.rmtree(inner, ignore_errors=True)


def _find_bin(root, names):
    for name in names:
        p = os.path.join(root, name)
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    for base, dirs, files in os.walk(root):
        if '/node_modules/' in base or '/.git' in base:
            continue
        for f in files:
            if f in names:
                p = os.path.join(base, f)
                if os.access(p, os.X_OK):
                    return p
    return None


def _run_task(pkg_name, recipe, task_id):
    def work():
        with _LOCK:
            _running.add(task_id)
        try:
            _install(pkg_name, recipe, task_id)
        except Exception as e:
            with _LOCK:
                if task_id in _TASKS:
                    _TASKS[task_id]['status'] = 'error'
                    _TASKS[task_id]['error'] = str(e)
                    _save_tasks()
        finally:
            with _LOCK:
                _running.discard(task_id)
    threading.Thread(target=work, daemon=True).start()


def _install(pkg_name, recipe, task_id):
    _persist = {'ts': 0.0, 'progress': -1}

    def upd(**kw):
        with _LOCK:
            t = _TASKS.get(task_id)
            if not t:
                return
            t.update(kw)
            now = time.time()
            status = t.get('status')
            # 状态变更或进度跨 2% / 距上次落盘超 3s 才写盘, 避免下载中高频 IO
            force = status in ('installed', 'error', 'interrupted') or                 kw.get('status') is not None or                 (now - _persist['ts'] >= 3) or                 (t.get('progress', 0) - _persist['progress'] >= 2)
            if force:
                _persist['ts'] = now
                _persist['progress'] = t.get('progress', 0)
                _save_tasks()

    upd(status='downloading', progress=0, message='开始下载')
    os.makedirs(TMP_ROOT, exist_ok=True)
    archive = os.path.join(TMP_ROOT, pkg_name + '.archive')
    try:
        size = _download(recipe['url'], archive, task_id)
    except Exception as e:
        upd(status='error', error=f'下载失败: {e}')
        return
    upd(status='extracting', progress=100, message=f'下载完成 ({size/1024/1024:.1f}MB)，解压中')

    dest = os.path.join(ENV_ROOT, pkg_name)
    if os.path.exists(dest):
        shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest, exist_ok=True)

    if recipe.get('compile'):
        src = os.path.join(TMP_ROOT, pkg_name + '.src')
        if os.path.exists(src):
            shutil.rmtree(src, ignore_errors=True)
        os.makedirs(src, exist_ok=True)
        try:
            _extract(archive, src, recipe['archive'])
        except Exception as e:
            upd(status='error', error=f'解压失败: {e}')
            return
    else:
        try:
            _extract(archive, dest, recipe['archive'])
        except Exception as e:
            upd(status='error', error=f'解压失败: {e}')
            return
        os.remove(archive)

    if recipe.get('compile'):
        upd(status='compiling', progress=50, message='编译 %s（源码编译，需数十秒~数分钟）' % recipe['type'])
        src = os.path.join(TMP_ROOT, pkg_name + '.src')
        if not _build_source(recipe['type'], pkg_name, dest, src, upd):
            return

    root_bin = _find_bin(dest, ['php', 'java', 'node', 'mvn', 'gradle', 'go', 'python3', 'python'])
    bin_paths = []
    for name in ['java', 'node', 'npm', 'npx', 'mvn', 'gradle', 'php', 'php-fpm', 'go', 'python3', 'python']:
        b = _find_bin(dest, [name])
        if b:
            bin_paths.append(b)
    meta = {
        'name': pkg_name,
        'type': recipe['type'],
        'version': recipe['version'],
        'root': dest,
        'bins': bin_paths,
        'installed': int(time.time()),
        'size': size,
        'compile': bool(recipe.get('compile')),
        'status': 'installed',
        'java_home': dest if recipe['type'] == 'java' else None,
    }
    with _LOCK:
        reg = _load_reg()
        reg[pkg_name] = meta
        _save_reg(reg)
    upd(status='installed', progress=100, message='安装完成', meta=meta)

    if recipe.get('compile'):
        _start_php_fpm(pkg_name, meta)


def _build_source(rtype, pkg_name, dest, src, upd):
    if rtype == 'php':
        return _build_php(pkg_name, dest, src, upd)
    if rtype == 'python':
        return _build_python(pkg_name, dest, src, upd)
    return _build_php(pkg_name, dest, src, upd)


def _build_php(pkg_name, dest, src, upd):
    upd(status='compiling', progress=55, message='安装编译依赖（apt）')
    res = _sudo(['apt-get', 'update'])
    if not res['ok']:
        res = _sudo(['apt-get', 'update'])
    if not res['ok']:
        upd(status='error', error=f'apt update 失败: {res["err"][-200:]}')
        return False
    res = _sudo(['apt-get', 'install', '-y'] + PHP_BUILD_DEPS)
    if not res['ok']:
        upd(status='error', error=f'安装编译依赖失败: {res["err"][-300:]}')
        return False
    entries = [os.path.join(src, e) for e in os.listdir(src) if not e.startswith('.')]
    if len(entries) == 1 and os.path.isdir(entries[0]):
        src = entries[0]

    upd(status='compiling', progress=60, message='configure')
    prefix = os.path.join(ENV_ROOT, pkg_name)
    cfg = subprocess.run(
        ['./configure', '--prefix=' + prefix, '--enable-fpm',
         '--with-fpm-user=www-data', '--with-fpm-group=www-data',
         '--enable-mbstring', '--with-curl', '--with-zlib', '--with-openssl',
         '--with-mysqli', '--enable-gd', '--with-pdo-mysql', '--enable-sockets'],
        capture_output=True, cwd=src, timeout=1800)
    if cfg.returncode != 0:
        upd(status='error', error=f'configure 失败: {cfg.stderr.decode("utf-8","replace")[-300:]}')
        return False

    upd(status='compiling', progress=70, message='make（编译中，约 15-20 分钟）')
    mk = subprocess.run(['make', '-j2'], capture_output=True, cwd=src, timeout=7200)
    if mk.returncode != 0:
        upd(status='error', error=f'make 失败: {mk.stderr.decode("utf-8","replace")[-300:]}')
        return False

    upd(status='compiling', progress=90, message='make install')
    inst = subprocess.run(['make', 'install'], capture_output=True, cwd=src, timeout=1800)
    if inst.returncode != 0:
        upd(status='error', error=f'make install 失败: {inst.stderr.decode("utf-8","replace")[-300:]}')
        return False
    shutil.rmtree(src, ignore_errors=True)
    return True


def _start_php_fpm(pkg_name, meta):
    fpm = _find_bin(meta['root'], ['php-fpm'])
    if not fpm:
        return
    os.makedirs(RUN_ROOT, exist_ok=True)
    sock = os.path.join(RUN_ROOT, pkg_name + '.sock')
    conf = os.path.join(meta['root'], 'php-fpm.d', 'www.conf')
    os.makedirs(os.path.dirname(conf), exist_ok=True)
    ini = os.path.join(meta['root'], 'etc', 'php.ini')
    if not os.path.isfile(ini):
        ini = os.path.join(meta['root'], 'lib', 'php.ini')
    pidf = os.path.join(meta['root'], 'php-fpm.pid')
    with open(conf, 'w', encoding='utf-8') as f:
        f.write(f"[{pkg_name}]\n")
        f.write(f"user = www-data\n")
        f.write(f"group = www-data\n")
        f.write(f"listen = {sock}\n")
        f.write("listen.owner = www-data\n")
        f.write("listen.group = www-data\n")
        f.write("listen.mode = 0660\n")
        f.write("pm = dynamic\n")
        f.write("pm.max_children = 5\n")
        f.write("pm.start_servers = 2\n")
        f.write("pm.min_spare_servers = 1\n")
        f.write("pm.max_spare_servers = 3\n")
    _stop_pkg_fpm(pkg_name, meta)
    args = [fpm]
    if os.path.isfile(ini):
        args += ['-c', ini]
    args += ['-F', '--fpm-config', conf, '--pid', pidf]
    cmdline = ' '.join("'%s'" % a for a in args)
    _sudo(['systemd-run', '--collect', '--unit=envpkg-' + pkg_name,
           'bash', '-c', cmdline], timeout=60)
    time.sleep(2)
    meta['php_fpm_sock'] = sock
    meta['php_fpm'] = fpm
    with _LOCK:
        reg = _load_reg()
        if pkg_name in reg:
            reg[pkg_name]['php_fpm_sock'] = sock
            reg[pkg_name]['php_fpm'] = fpm
            _save_reg(reg)


def _stop_pkg_fpm(pkg_name, meta):
    res = _sudo(['systemctl', 'stop', 'envpkg-' + pkg_name], timeout=60)
    pidf = os.path.join(meta.get('root', ''), 'php-fpm.pid')
    if os.path.isfile(pidf):
        try:
            pid = int(open(pidf).read().strip())
            _sudo(['kill', str(pid)])
        except Exception:
            pass
    sock = meta.get('php_fpm_sock')
    if sock and os.path.exists(sock):
        try:
            os.remove(sock)
        except Exception:
            _sudo(['rm', '-f', sock])
    return res


def _build_python(pkg_name, dest, src, upd):
    upd(status='compiling', progress=55, message='安装编译依赖（apt）')
    res = _sudo(['apt-get', 'update'])
    if not res['ok']:
        res = _sudo(['apt-get', 'update'])
    if not res['ok']:
        upd(status='error', error=f'apt update 失败: {res["err"][-200:]}')
        return False
    deps = ['build-essential', 'libssl-dev', 'zlib1g-dev', 'libbz2-dev',
            'libreadline-dev', 'libsqlite3-dev', 'libffi-dev', 'libncursesw5-dev',
            'libgdbm-dev', 'liblzma-dev', 'tk-dev', 'uuid-dev']
    res = _sudo(['apt-get', 'install', '-y'] + deps)
    if not res['ok']:
        upd(status='error', error=f'安装编译依赖失败: {res["err"][-300:]}')
        return False
    entries = [os.path.join(src, e) for e in os.listdir(src) if not e.startswith('.')]
    if len(entries) == 1 and os.path.isdir(entries[0]):
        src = entries[0]
    upd(status='compiling', progress=60, message='configure')
    prefix = os.path.join(ENV_ROOT, pkg_name)
    cfg = subprocess.run(['./configure', '--prefix=' + prefix, '--enable-shared',
                          '--enable-optimizations'], capture_output=True, cwd=src, timeout=1800)
    if cfg.returncode != 0:
        upd(status='error', error=f'configure 失败: {cfg.stderr.decode("utf-8","replace")[-300:]}')
        return False
    upd(status='compiling', progress=70, message='make（编译中，约 3-8 分钟）')
    mk = subprocess.run(['make', '-j2'], capture_output=True, cwd=src, timeout=7200)
    if mk.returncode != 0:
        upd(status='error', error=f'make 失败: {mk.stderr.decode("utf-8","replace")[-300:]}')
        return False
    upd(status='compiling', progress=90, message='make install')
    inst = subprocess.run(['make', 'install'], capture_output=True, cwd=src, timeout=1800)
    if inst.returncode != 0:
        upd(status='error', error=f'make install 失败: {inst.stderr.decode("utf-8","replace")[-300:]}')
        return False
    shutil.rmtree(src, ignore_errors=True)
    return True


def _install_cpp():
    """安装 C/C++ 编译工具链（apt 系统级）。"""
    name = 'cpp-toolchain'
    reg = _load_reg()
    if name in reg and reg[name].get('status') == 'installed':
        return jsonify({'error': 'C/C++ 工具链已安装'}), 400
    res = _sudo(['apt-get', 'update'])
    if not res['ok']:
        res = _sudo(['apt-get', 'update'])
    if not res['ok']:
        return jsonify({'error': f'apt update 失败: {res["err"][-200:]}'}), 500
    res = _sudo(['apt-get', 'install', '-y'] + CPP_TOOLCHAIN.split())
    if not res['ok']:
        return jsonify({'error': f'安装失败: {res["err"][-300:]}'}), 500
    meta = {'name': name, 'type': 'cpp', 'version': 'system', 'root': '/usr',
            'bins': [], 'installed': int(time.time()), 'size': 0, 'compile': False,
            'status': 'installed', 'java_home': None,
            'cpp_toolchain': True}
    with _LOCK:
        reg = _load_reg()
        reg[name] = meta
        _save_reg(reg)
    return jsonify({'ok': True, 'name': name, 'message': 'C/C++ 工具链安装完成'})


@envpkg.route('/recipes', methods=['GET'])
def list_recipes():
    return jsonify({'recipes': [
        {'name': k, **{kk: vv for kk, vv in v.items() if kk != 'url'}}
        for k, v in RECIPES.items()
    ]})


@envpkg.route('/envs', methods=['GET'])
def list_envs():
    reg = _load_reg()
    result = {}
    for name, meta in reg.items():
        entry = dict(meta)
        entry['exists'] = os.path.isdir(entry.get('root', ''))
        entry['fpm_running'] = _fpm_running(entry)
        result[name] = entry
    return jsonify({'envs': result, 'tasks': list(_TASKS.values())})


def _fpm_running(meta):
    pidf = os.path.join(meta.get('root', ''), 'php-fpm.pid')
    if os.path.isfile(pidf):
        try:
            pid = int(open(pidf).read().strip())
            os.kill(pid, 0)
            return True
        except Exception:
            pass
    sock = meta.get('php_fpm_sock')
    if sock and os.path.exists(sock):
        return True
    return False


@envpkg.route('/catalog', methods=['GET'])
def env_catalog():
    out = {}
    installed = _load_reg()
    installed_meta = list(installed.values())
    for rtype in ('java', 'node', 'go', 'python', 'php', 'maven', 'cpp'):
        rows = _catalog_async(rtype)
        out[rtype] = [dict(r, installed=any(
            m.get('type') == rtype and m.get('version') == r['version'] for m in installed_meta))
            for r in rows]
    return jsonify({'catalog': out})


@envpkg.route('/install', methods=['POST'])
def install_pkg():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    rtype = str(data.get('type', '')).strip()
    version = str(data.get('version', '')).strip()

    if name:
        if name not in RECIPES:
            return jsonify({'error': '未知的环境包'}), 400
        recipe = dict(RECIPES[name])
    elif rtype and version:
        if rtype not in _RUNTIMES and rtype != 'cpp':
            return jsonify({'error': '未知的运行时类型'}), 400
        if rtype == 'cpp':
            return _install_cpp()
        try:
            url, fname, archive, compilef = _runtime_download(rtype, version)
        except Exception as e:
            return jsonify({'error': f'解析下载地址失败: {e}'}), 502
        if not url:
            return jsonify({'error': '该版本暂无下载地址'}), 404
        name = '%s-%s' % (rtype, version)
        recipe = {'type': rtype, 'version': version, 'url': url,
                  'archive': archive, 'compile': compilef}
    else:
        return jsonify({'error': '缺少 name 或 type+version'}), 400

    reg = _load_reg()
    if name in reg and reg[name].get('status') == 'installed':
        return jsonify({'error': f'{name} 已安装'}), 400
    with _LOCK:
        for tid, t in _TASKS.items():
            if t.get('name') == name and t.get('status') not in ('installed', 'error') and tid in _running:
                return jsonify({'error': f'{name} 正在安装中'}), 400
    os.makedirs(ENV_ROOT, exist_ok=True)
    task_id = 'task_' + str(int(time.time() * 1000))
    with _LOCK:
        _TASKS[task_id] = {'id': task_id, 'name': name, 'type': recipe['type'],
                           'status': 'queued', 'progress': 0, 'created': int(time.time())}
        _save_tasks()
    _run_task(name, recipe, task_id)
    return jsonify({'task_id': task_id, 'name': name})


@envpkg.route('/tasks/<task_id>', methods=['GET'])
def task_status(task_id):
    task = _TASKS.get(task_id)
    if not task:
        return jsonify({'error': '任务不存在'}), 404
    return jsonify(task)


@envpkg.route('/uninstall', methods=['POST'])
def uninstall_pkg():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    reg = _load_reg()
    if name not in reg:
        return jsonify({'error': '环境包不存在'}), 404
    meta = reg[name]
    root = meta.get('root')
    # 先停掉该包的 php-fpm(systemd-run 单元), 避免残留进程/套接字
    if meta.get('php_fpm') or meta.get('php_fpm_sock'):
        _stop_pkg_fpm(name, meta)
    if root and os.path.isdir(root):
        shutil.rmtree(root, ignore_errors=True)
    reg.pop(name, None)
    _save_reg(reg)
    _clean_tmp()
    return jsonify({'ok': True, 'message': f'已卸载 {name}'})


@envpkg.route('/start', methods=['POST'])
def start_pkg():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    reg = _load_reg()
    meta = reg.get(name)
    if not meta or not meta.get('php_fpm'):
        return jsonify({'error': '该包不支持独立启动'}), 400
    _start_php_fpm(name, meta)
    return jsonify({'ok': True, 'sock': meta.get('php_fpm_sock')})


@envpkg.route('/stop', methods=['POST'])
def stop_pkg():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    reg = _load_reg()
    meta = reg.get(name)
    if not meta:
        return jsonify({'error': '环境包不存在'}), 404
    _stop_pkg_fpm(name, meta)
    return jsonify({'ok': True, 'message': f'已停止 {name}'})


@envpkg.route('/run', methods=['POST'])
def run_in_env():
    """Run a command using an installed env package: {name, command}"""
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    command = str(data.get('command', '')).strip()
    reg = _load_reg()
    meta = reg.get(name)
    if not meta:
        return jsonify({'error': '环境包不存在'}), 404
    if not command:
        return jsonify({'error': '命令不能为空'}), 400
    env = dict(os.environ)
    if meta.get('java_home'):
        env['JAVA_HOME'] = meta['java_home']
        env['PATH'] = meta['java_home'] + '/bin:' + env.get('PATH', '')
    for b in meta.get('bins', []):
        d = os.path.dirname(b)
        if d not in env.get('PATH', ''):
            env['PATH'] = d + ':' + env.get('PATH', '')
    try:
        timeout = int(data.get('timeout') or 60)
    except (TypeError, ValueError):
        timeout = 60
    try:
        p = subprocess.run(['bash', '-c', command], capture_output=True, timeout=timeout, env=env)
        return jsonify({'ok': p.returncode == 0, 'rc': p.returncode,
                        'stdout': (p.stdout or b'').decode('utf-8', 'replace'),
                        'stderr': (p.stderr or b'').decode('utf-8', 'replace')})
    except subprocess.TimeoutExpired:
        return jsonify({'ok': False, 'rc': -1, 'stdout': '', 'stderr': '执行超时'})
    except Exception as e:
        return jsonify({'ok': False, 'rc': -1, 'stdout': '', 'stderr': str(e)})


def resolve_env_ref(cmd):
    """If cmd starts with 'env:<pkg> ', rewrite it to a run_in_env style prefix
    usable by the terminal/scheduler. Returns (env_prefix, rest)."""
    if cmd.startswith('env:'):
        rest = cmd[4:].strip()
        parts = rest.split(None, 1)
        if parts:
            return parts[0], (parts[1] if len(parts) > 1 else '')
    return None, cmd


def env_run_prefix(name):
    """Return an os.environ copy with the package's bins + JAVA_HOME on PATH,
    or None if the package is not installed."""
    reg = _load_reg()
    meta = reg.get(name)
    if not meta:
        return None
    env = dict(os.environ)
    if meta.get('java_home'):
        env['JAVA_HOME'] = meta['java_home']
        env['PATH'] = meta['java_home'] + '/bin:' + env.get('PATH', '')
    for b in meta.get('bins', []):
        d = os.path.dirname(b)
        if d not in env.get('PATH', ''):
            env['PATH'] = d + ':' + env.get('PATH', '')
    return env


# 启动后后台预热目录缓存，让首次页面加载更快
def _warm_catalog():
    try:
        for rtype in ('java', 'node', 'go', 'python', 'php', 'maven', 'cpp'):
            _runtime_catalog(rtype)
    except Exception:
        pass


threading.Thread(target=_warm_catalog, daemon=True).start()
