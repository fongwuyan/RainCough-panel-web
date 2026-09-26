#!/usr/bin/env python3
"""构建 RainCough 面板的「离线环境包」(Debian 12 / x86_64)。

两种产物(均上传为 RainCough-panel-web 的 GitHub Release 资产):
  默认(核心)   dist/env-offline-linux-x86_64-<version>.tar.gz
      = 内嵌 Python(python-build-standalone) + 全部面板/插件依赖
        + wheels/ 离线轮子仓库(顶层 staging/wheels/)
      供 Python 面板无外网自举; GO 面板安装器用其 wheels/ 离线装 pip 依赖。
  --ai          dist/env-ai-offline-linux-x86_64-<version>.tar.gz
      = aigen 文生图 AI 依赖 wheels (torch CPU + diffusers + transformers),
        无 Python 运行时(顶层 staging/wheels/), 供安装器可选安装。

用法(在 Debian 12 x86_64 上):
    python3 tools/build_env_offline.py            # 核心包
    python3 tools/build_env_offline.py --ai       # AI 包

环境变量(可选, 弱网/离线构建用):
    PBS_LOCAL      预先下载好的 python-build-standalone 包路径(跳过联网下载)
    PBS_BASE       下载镜像前缀, 如 https://gh-proxy.com/https://github.com
    PIP_INDEX_URL  pip 源(构建机访问 pypi 慢时可用镜像, 如清华源)
    AI_INDEX       AI 包 torch CPU 源(默认依次尝试 pytorch 官方/阿里云镜像)
"""
import os
import sys
import glob
import argparse
import tarfile
import shutil
import subprocess
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQ = os.path.join(ROOT, 'requirements.txt')
OUT_DIR = os.path.join(ROOT, 'dist')
ASSET_PREFIX = 'env-offline-linux-x86_64'
AI_ASSET_PREFIX = 'env-ai-offline-linux-x86_64'
# python-build-standalone 的 release 标签是纯日期(如 20260924),
# 资产命名 cpython-<版本>+<标签>-<架构>-install_only_stripped.tar.gz
PBS_TAG = '20260924'
PBS_PY = '3.12.14'
PBS_ARCH = 'x86_64-unknown-linux-gnu'
PBS_ASSET = 'cpython-%s+%s-%s-install_only_stripped.tar.gz' % (PBS_PY, PBS_TAG, PBS_ARCH)
# AI 依赖(aigen 文生图): torch 必须走 CPU 源, 否则 CUDA 版超 GitHub Release 2GB 上限
AI_PKGS = ['torch', 'diffusers', 'transformers']
AI_INDEXES = ['https://download.pytorch.org/whl/cpu',
              'https://mirrors.aliyun.com/pytorch-wheels/cpu']


def pbs_url():
    base = (os.environ.get('PBS_BASE') or 'https://github.com').rstrip('/')
    return '%s/astral-sh/python-build-standalone/releases/download/%s/%s' % (
        base, PBS_TAG, PBS_ASSET)


def download(url, dest):
    print('  下载', url)
    req = urllib.request.Request(url, headers={'User-Agent': 'rain-cough-env-builder'})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, 'wb') as f:
        shutil.copyfileobj(r, f)


def read_reqs():
    with open(REQ, encoding='utf-8') as f:
        return [l.strip() for l in f if l.strip() and not l.startswith('#')]


def run(cmd, **kw):
    print('  $', ' '.join(cmd))
    subprocess.run(cmd, check=True, **kw)


def pip_download_wheels(pybin, dest, pkgs=None, req=None, ai_indexes=False, pyver=None):
    """下载轮子到 dest。

    ai_indexes=True 时两阶段:
      1) torch 走纯 CPU 源(--index-url, 无 extra, 避免 PyPI CUDA 版被选中);
      2) 其余(diffusers/transformers 等)走 PyPI 源。
    pyver="310" 等: 按目标 Python 版本下轮子(--only-binary, 供多版本共存,
      如 Ubuntu22.04=py3.10 与 Debian12=py3.11 同包离线通用)。
    """
    os.makedirs(dest, exist_ok=True)
    base = [pybin, '-m', 'pip', 'download', '--no-cache-dir', '-d', dest]
    extra = os.environ.get('PIP_INDEX_URL')
    if req:
        cmd = base + ['-r', req]
        if pyver:
            cmd += ['--python-version', pyver, '--only-binary=:all:']
        if extra:
            cmd += ['--extra-index-url', extra]
        run(cmd)
        return
    if not ai_indexes:
        cmd = base + list(pkgs)
        if extra:
            cmd += ['--extra-index-url', extra]
        run(cmd)
        return
    pypi = extra or 'https://pypi.org/simple'
    cpu_list = [p for p in pkgs if p.split('=')[0].strip() in ('torch', 'torchvision', 'torchaudio')]
    rest = [p for p in pkgs if p not in cpu_list]
    cpu_indexes = []
    env_idx = os.environ.get('AI_INDEX')
    if env_idx:
        cpu_indexes.append(env_idx)
    cpu_indexes += [i for i in AI_INDEXES if i not in cpu_indexes]
    if cpu_list:
        local_tw = os.environ.get('TORCH_WHEEL')
        if local_tw and os.path.isfile(local_tw):
            # 本地预下载的 torch CPU 轮子(弱网: CDN 慢时用镜像直链先下好)
            print('  使用本地 torch 轮子:', local_tw)
            for _p in cpu_list:
                shutil.copyfile(local_tw, os.path.join(dest, os.path.basename(local_tw)))
        else:
            last = None
            for idx in cpu_indexes:
                try:
                    # --no-deps 直取 CPU wheel: pytorch 索引上解析依赖会踩
                    # flit_core 缺失/typing-extensions 元数据不一致等坑
                    run(base + cpu_list + ['--no-deps', '--index-url', idx])
                    last = None
                    break
                except subprocess.CalledProcessError as e:
                    last = e
                    print('  CPU 源失败, 尝试下一个:', idx)
            if last is not None:
                raise last
    # torch 的通用依赖(纯 PyPI 包) + 其余 AI 包, 全部走 PyPI 源
    generic = ['filelock', 'typing-extensions', 'sympy', 'networkx',
               'jinja2', 'fsspec', 'setuptools'] if cpu_list else []
    want = list(rest) + generic
    if want:
        run(base + want + ['--index-url', pypi])


def package_staging(staging, out_path):
    with tarfile.open(out_path, 'w:gz') as tf:
        for rootd, dirs, files in os.walk(staging):
            for fn in files:
                full = os.path.join(rootd, fn)
                arc = os.path.relpath(full, os.path.dirname(staging))
                info = tf.gettarinfo(full, arcname=arc)
                with open(full, 'rb') as fh:
                    tf.addfile(info, fh)
    print('完成:', out_path)
    print('大小: %.1f MB' % (os.path.getsize(out_path) / 1024 / 1024))


def build_ai(version):
    """AI 环境包: 仅 wheels(torch CPU + diffusers + transformers)。"""
    print('构建 AI 环境包 v%s' % version)
    os.makedirs(OUT_DIR, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        staging = os.path.join(tmp, 'staging')
        wheels = os.path.join(staging, 'wheels')
        # torch 系用系统 python 下载即可(仅取轮子, 不安装)
        pip_download_wheels(sys.executable, wheels, pkgs=AI_PKGS, ai_indexes=True)
        out = os.path.join(OUT_DIR, '%s-%s.tar.gz' % (AI_ASSET_PREFIX, version))
        package_staging(staging, out)


def build(version):
    print('构建离线环境包 v%s' % version)
    os.makedirs(OUT_DIR, exist_ok=True)
    reqs = read_reqs()
    print('依赖:', reqs)

    with tempfile.TemporaryDirectory() as tmp:
        py_tar = os.path.join(tmp, 'python.tar.gz')
        local_pbs = os.environ.get('PBS_LOCAL')
        if local_pbs and os.path.isfile(local_pbs):
            print('  使用本地 python-build-standalone 包:', local_pbs)
            shutil.copyfile(local_pbs, py_tar)
        else:
            download(pbs_url(), py_tar)

        staging = os.path.join(tmp, 'staging')
        os.makedirs(staging)
        with tarfile.open(py_tar, 'r:gz') as tf:
            # install_only 包顶层即 python/, 原样解压(不做顶层剥离)
            tf.extractall(staging)

        # 定位 python 安装根(含 bin/python3): 兼容 python/install/ 与 python/ 两种布局
        py_root = None
        for cand in (os.path.join(staging, 'python', 'install'),
                     os.path.join(staging, 'python'),
                     staging):
            if os.path.isfile(os.path.join(cand, 'bin', 'python3')):
                py_root = cand
                break
        if py_root is None:
            raise SystemExit('解压后未找到 python3: ' + staging)
        pybin = os.path.join(py_root, 'bin', 'python3')
        print('解释器:', pybin)

        run([pybin, '-m', 'pip', 'install', '--no-cache-dir', '--upgrade', 'pip'])
        run([pybin, '-m', 'pip', 'install', '--no-cache-dir'] + reqs)

        code = ('import sys;'
                'import flask,flask_cors,curl_cffi,psutil,cryptography,apscheduler;'
                'print(sys.version.split()[0])')
        r = subprocess.run([pybin, '-c', code], capture_output=True, text=True, cwd=ROOT)
        if r.returncode != 0:
            raise SystemExit('依赖验证失败: ' + r.stderr)
        print('依赖验证通过:', r.stdout.strip())

        # wheels 离线轮子仓库: 面向【系统 python3】(Debian12=3.11, Ubuntu22.04=3.10),
        # 必须用系统解释器下载, 且按目标版本各下一套, 离线安装才跨发行版通用
        print('下载 wheels 轮子仓库(系统 python3.11)...')
        wheels_dir = os.path.join(staging, 'wheels')
        pip_download_wheels(sys.executable, wheels_dir, req=REQ)
        print('下载 wheels 轮子仓库(python3.10 兼容, Ubuntu22.04)...')
        pip_download_wheels(sys.executable, wheels_dir, req=REQ, pyver='310')

        # 清理缓存减小体积(兼容任意 python3.x 目录名)
        for sp in glob.glob(os.path.join(py_root, 'lib', 'python*', 'site-packages')):
            shutil.rmtree(os.path.join(sp, 'pip'), ignore_errors=True)
        for rootd, dirs, files in os.walk(staging):
            if '__pycache__' in dirs:
                shutil.rmtree(os.path.join(rootd, '__pycache__'), ignore_errors=True)
                dirs.remove('__pycache__')

        out = os.path.join(OUT_DIR, '%s-%s.tar.gz' % (ASSET_PREFIX, version))
        package_staging(staging, out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default='0.1.0')
    ap.add_argument('--ai', action='store_true', help='构建 AI 环境包(torch/diffusers/transformers)')
    a = ap.parse_args()
    if a.ai:
        build_ai(a.version)
    else:
        build(a.version)
