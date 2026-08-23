# -*- coding: utf-8 -*-
"""多语言插件桥(Pluggable Language Bridge)。

允许插件不限于 Python: 插件目录内提供 plugin.json 描述 + 任意语言的可执行入口,
面板负责拉起子进程并代理 /api/plugins/<name>/* 请求。

插件目录约定 (plugin.json):
{
  "name": "hello", "label": "示例插件", "icon": "", "description": "...",
  "lang": "node",                       // 提示用: python|node|go|rust|php|...
  "cmd": ["node", "server.js"],         // 启动命令(相对插件目录); 也支持字符串
  "env": "node-22",                     // 可选: 通过面板环境包(envpkg)注入 PATH
  "timeout": 15                         // 可选: 就绪等待秒数(默认15)
}

子进程契约:
- 监听环境变量 RAINCOUGH_PORT 指定的 127.0.0.1 端口
- GET /__health -> 200 表示就绪
- 其余路径与 /api/plugins/<name>/* 的 subpath 一一对应(GET/POST/DELETE),
  请求体原样透传, 响应文本与状态码原样返回(前端按 JSON 解析)
- GET /info 建议实现为返回插件信息; 未实现时面板回退使用 manifest
"""
import os
import json
import time
import shlex
import socket
import subprocess
import threading
import urllib.request
import urllib.error
import atexit

from flask import request, jsonify
from plugins.base import Plugin

_children = {}
_children_lock = threading.Lock()


def _free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _kill_all():
    with _children_lock:
        procs = list(_children.values())
        _children.clear()
    for p in procs:
        try:
            p.terminate()
        except Exception:
            pass


atexit.register(_kill_all)


class BridgePlugin(Plugin):
    """加载 plugin.json 描述的多语言插件。"""

    def __init__(self, manifest, plugin_dir):
        self._manifest = manifest
        self._dir = plugin_dir
        self._proc = None
        self._port = _free_port()
        self._start_error = None
        self.name = manifest.get('name') or os.path.basename(plugin_dir)
        self.label = manifest.get('label') or self.name
        self.icon = manifest.get('icon') or ''
        self.description = manifest.get('description') or ''
        super().__init__()
        self._start()

    def _register_routes(self):
        # 桥接插件路由全部走 dispatch 代理
        pass

    def _build_env(self):
        env = dict(os.environ)
        pkg = self._manifest.get('env')
        if pkg:
            try:
                from envpkg import env_run_prefix
                e = env_run_prefix(pkg)
                if isinstance(e, dict):
                    env = e
            except Exception:
                pass
        env['RAINCOUGH_PORT'] = str(self._port)
        return env

    def _start(self):
        cmd = self._manifest.get('cmd') or []
        if isinstance(cmd, str):
            cmd = shlex.split(cmd)
        if not cmd:
            self._start_error = 'plugin.json 未提供 cmd'
            return
        try:
            self._proc = subprocess.Popen(
                cmd, cwd=self._dir, env=self._build_env(),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            self._proc = None
            self._start_error = '启动失败: %s' % e
            return
        with _children_lock:
            _children[self.name] = self._proc
        timeout = float(self._manifest.get('timeout', 15) or 15)
        t0 = time.time()
        while time.time() - t0 < timeout:
            if self._proc.poll() is not None:
                self._start_error = '子进程提前退出 (rc=%s)' % self._proc.returncode
                return
            try:
                with urllib.request.urlopen(
                        'http://127.0.0.1:%d/__health' % self._port, timeout=2) as r:
                    if r.status == 200:
                        return
            except Exception:
                pass
            time.sleep(0.4)
        self._start_error = '就绪超时(%ss)' % timeout

    def stop(self):
        with _children_lock:
            _children.pop(self.name, None)
        if self._proc:
            try:
                self._proc.terminate()
            except Exception:
                pass
            self._proc = None

    def alive(self):
        return self._proc is not None and self._proc.poll() is None

    def get_info(self):
        info = super().get_info()
        info['lang'] = self._manifest.get('lang', '')
        return info

    def dispatch(self, subpath, method):
        # 未使用子进程的 /info 回退: 由 app.py 兜底, 此处仍先尝试代理
        if not self.alive():
            if subpath == 'info':
                from flask import jsonify as _j
                return _j(self.get_info())
            return jsonify({'error': '插件子进程未就绪: %s' % (self._start_error or 'unknown')}), 502
        url = 'http://127.0.0.1:%d/%s' % (self._port, subpath.lstrip('/'))
        data = None
        if method in ('POST', 'PUT', 'DELETE'):
            data = request.get_data(cache=False)
        req = urllib.request.Request(
            url, data=data, method=method,
            headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read().decode('utf-8', 'replace')
                return body, r.status
        except urllib.error.HTTPError as e:
            body = ''
            if e.fp:
                body = e.fp.read().decode('utf-8', 'replace')
            return body, e.code
        except Exception as e:
            return jsonify({'error': '插件桥接失败: %s' % e}), 502
