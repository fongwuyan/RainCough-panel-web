#!/usr/bin/env python3
"""构建 RainCough 面板的「离线环境包」(Debian 12 / x86_64)。

产物: 内嵌 Python(python-build-standalone) + 全部面板依赖 的 tar.gz,
供面板在无外网/环境不足时自动拉取并解压为 runtime/ 使用。

用法(在 Debian 12 x86_64 上):
    python3 tools/build_env_offline.py
输出: dist/env-offline-linux-x86_64-<version>.tar.gz
上传该文件为 RainCough-panel-web 的 GitHub Release 资产即可。
"""
import os
import sys
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
# python-build-standalone 具体版本号可在 GitHub Releases 中确认
PBS_VERSION = '3.12.10+20250305'
PBS_ARCH = 'x86_64-unknown-linux-gnu'


def pbs_url():
    # install_only 变体: 仅 Python 运行时, 不含 build 工具链, 体积最小
    return ('https://github.com/astral-sh/python-build-standalone/releases/download/'
            '{v}/cpython-{v}-{a}-{v2}-install_only_stripped.tar.gz'.format(
                v=PBS_VERSION, a=PBS_ARCH, v2=PBS_VERSION))


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
        download(pbs_url(), py_tar)

        staging = os.path.join(tmp, 'staging')
        os.makedirs(staging)
        with tarfile.open(py_tar, 'r:gz') as tf:
            # 去掉顶层目录(cpython-.../), 使 python/ 直接位于 staging 下
            for m in tf.getmembers():
                parts = m.name.split('/', 1)
                if len(parts) > 1:
                    m.name = parts[1]
                tf.extract(m, staging)

        py_root = os.path.join(staging, 'python', 'install')
        if not os.path.isdir(py_root):
            py_root = os.path.join(staging, 'python')
        pybin = os.path.join(py_root, 'bin', 'python3')
        if not os.path.isfile(pybin):
            raise SystemExit('解压后未找到 python3: ' + pybin)
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

        # 清理缓存减小体积
        shutil.rmtree(os.path.join(py_root, 'lib', 'python3.12', 'site-packages', 'pip'), ignore_errors=True)
        for cache in ('__pycache__',):
            for rootd, dirs, files in os.walk(staging):
                if cache in dirs:
                    shutil.rmtree(os.path.join(rootd, cache))

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


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default='0.1.0')
    a = ap.parse_args()
    build(a.version)
