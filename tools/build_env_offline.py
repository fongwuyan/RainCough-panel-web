#!/usr/bin/env python3
"""构建 RainCough 面板的「离线环境包」(Debian 12 / x86_64)。

产物: 内嵌 Python(python-build-standalone) + 全部面板依赖 的 tar.gz,
供面板在无外网/环境不足时自动拉取并解压为 runtime/ 使用。

用法(在 Debian 12 x86_64 上):
    python3 tools/build_env_offline.py
输出: dist/env-offline-linux-x86_64-<version>.tar.gz
上传该文件为 RainCough-panel-web 的 GitHub Release 资产即可。

环境变量(可选, 弱网/离线构建用):
    PBS_LOCAL      预先下载好的 python-build-standalone 包路径(跳过联网下载)
    PBS_BASE       下载镜像前缀, 如 https://gh-proxy.com/https://github.com
    PIP_INDEX_URL  pip 源(构建机访问 pypi 慢时可用镜像, 如清华源)
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
# python-build-standalone 的 release 标签是纯日期(如 20260924),
# 资产命名 cpython-<版本>+<标签>-<架构>-install_only_stripped.tar.gz
PBS_TAG = '20260924'
PBS_PY = '3.12.14'
PBS_ARCH = 'x86_64-unknown-linux-gnu'
PBS_ASSET = 'cpython-%s+%s-%s-install_only_stripped.tar.gz' % (PBS_PY, PBS_TAG, PBS_ARCH)


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

        subprocess.run([pybin, '-m', 'pip', 'install', '--no-cache-dir', '--upgrade', 'pip'],
                       check=True, cwd=ROOT)
        subprocess.run([pybin, '-m', 'pip', 'install', '--no-cache-dir'] + reqs,
                       check=True, cwd=ROOT)

        code = ('import sys;'
                'import flask,flask_cors,curl_cffi,psutil,cryptography,apscheduler;'
                'print(sys.version.split()[0])')
        r = subprocess.run([pybin, '-c', code], capture_output=True, text=True, cwd=ROOT)
        if r.returncode != 0:
            raise SystemExit('依赖验证失败: ' + r.stderr)
        print('依赖验证通过:', r.stdout.strip())

        # 清理缓存减小体积(兼容任意 python3.x 目录名)
        for sp in glob.glob(os.path.join(py_root, 'lib', 'python*', 'site-packages')):
            shutil.rmtree(os.path.join(sp, 'pip'), ignore_errors=True)
        for rootd, dirs, files in os.walk(staging):
            if '__pycache__' in dirs:
                shutil.rmtree(os.path.join(rootd, '__pycache__'), ignore_errors=True)
                dirs.remove('__pycache__')

        out = os.path.join(OUT_DIR, '%s-%s.tar.gz' % (ASSET_PREFIX, version))
        with tarfile.open(out, 'w:gz') as tf:
            for rootd, dirs, files in os.walk(staging):
                for fn in files:
                    full = os.path.join(rootd, fn)
                    arc = os.path.relpath(full, os.path.dirname(staging))
                    info = tf.gettarinfo(full, arcname=arc)
                    with open(full, 'rb') as fh:
                        tf.addfile(info, fh)
        print('完成:', out)
        print('大小: %.1f MB' % (os.path.getsize(out) / 1024 / 1024))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default='0.1.0')
    a = ap.parse_args()
    build(a.version)
