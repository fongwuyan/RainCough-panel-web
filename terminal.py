"""
系统终端后端（完整重写版）。

职责：
- 为每个会话创建一个 pty，运行用户的登录 shell。
- 通过 SSE 将 shell 输出实时推送给浏览器。
- 接收浏览器发来的输入 / 尺寸变更，写入 pty。

路由契约（与前端保持一致）：
    POST /api/terminal/open       -> {"sid": "tN"}
    GET  /api/terminal/stream?sid=..&seq=..  -> SSE (data=base64 / closed 事件)
    POST /api/terminal/input     {sid, data}
    POST /api/terminal/resize    {sid, rows, cols}
    POST /api/terminal/close     {sid}
    GET  /api/terminal/sessions  -> {"sessions": [{sid,user,host,age,idle}]}
"""

import base64
import codecs
import fcntl
import getpass
import os
import signal
import socket
import struct
import subprocess
import termios
import threading
import time
from collections import deque
from itertools import count

from flask import Blueprint, request, jsonify, Response

tm = Blueprint('terminal', __name__, url_prefix='/api/terminal')

SHELL = '/bin/bash'
IDLE_TTL = 30 * 60          # 空闲多久回收会话
REPLAY_CHUNKS = 300         # 新连接最多补发的历史块数
READ_SIZE = 8192
_HEARTBEAT = 15.0           # SSE 心跳间隔
_MAX_ROWS = 200
_MAX_COLS = 500

_sessions = {}
_lock = threading.Lock()
_sid_iter = count(1)


def _b64(s: str) -> str:
    return base64.b64encode(s.encode('utf-8')).decode('ascii')


def _decode_b64(s):
    return s


def _set_winsize(fd, rows, cols):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))


def _spawn_setup():
    """把子进程放入新会话并接管控制终端（模拟真实登录）。"""
    os.setsid()
    try:
        fcntl.ioctl(0, termios.TIOCSCTTY, 0)
    except OSError:
        pass


class Session:
    def __init__(self, sid, rows=24, cols=80):
        self.sid = sid
        try:
            self.user = getpass.getuser()
        except Exception:
            self.user = '?'
        try:
            self.host = socket.gethostname()
        except Exception:
            self.host = '?'

        rows = _clamp(rows, 2, _MAX_ROWS, 24)
        cols = _clamp(cols, 2, _MAX_COLS, 80)

        self.master, self.slave = os.openpty()
        _set_winsize(self.master, rows, cols)

        env = dict(os.environ)
        env['TERM'] = 'xterm-256color'
        env['COLUMNS'] = str(cols)
        env['LINES'] = str(rows)
        try:
            home = os.path.expanduser('~')
            if not home or not os.path.isdir(home):
                home = '/'
            env['HOME'] = home
            env['PWD'] = home
            cwd = home
        except Exception:
            cwd = '/'

        self.proc = subprocess.Popen(
            [SHELL],
            stdin=self.slave, stdout=self.slave, stderr=self.slave,
            close_fds=True, preexec_fn=_spawn_setup, env=env, bufsize=0, cwd=cwd,
        )
        try:
            os.close(self.slave)
        except OSError:
            pass

        self.buf = deque(maxlen=REPLAY_CHUNKS)     # (seq, text)
        self.seq = 0
        self.created = time.time()
        self.last_activity = time.time()
        self.closed = False
        self.decoder = codecs.getincrementaldecoder('utf-8')('replace')
        self.cond = threading.Condition()
        self.reader = threading.Thread(target=self._read_loop, daemon=True)
        self.reader.start()

    def _read_loop(self):
        """读 pty 输出，增量解码 utf-8，入队并广播。进程退出（EOF）时标记 closed。"""
        try:
            while not self.closed:
                try:
                    data = os.read(self.master, READ_SIZE)
                except OSError:
                    break
                if not data:
                    break
                text = self.decoder.decode(data)
                with self.cond:
                    if text:
                        self.seq += 1
                        self.buf.append((self.seq, text))
                    self.last_activity = time.time()
                    self.cond.notify_all()
        finally:
            self._close_internal()

    def write(self, data: str) -> bool:
        if self.closed:
            return False
        blob = data.encode('utf-8')
        try:
            view = memoryview(blob)
            while len(view):
                n = os.write(self.master, view)
                view = view[n:]
        except (OSError, ValueError):
            return False
        self.last_activity = time.time()
        return True

    def resize(self, rows, cols):
        if self.closed:
            return
        rows = _clamp(rows, 2, _MAX_ROWS, 24)
        cols = _clamp(cols, 2, _MAX_COLS, 80)
        _set_winsize(self.master, rows, cols)

    def _close_internal(self):
        if self.closed:
            return
        self.closed = True
        with self.cond:
            self.cond.notify_all()
        try:
            os.killpg(self.proc.pid, signal.SIGTERM)
        except OSError:
            pass
        try:
            os.close(self.master)
        except OSError:
            pass

    def wait_exit(self, timeout=2.0):
        try:
            self.proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(self.proc.pid, signal.SIGKILL)
            except OSError:
                pass
            try:
                self.proc.wait(timeout=2.0)
            except Exception:
                pass
        return self.proc.returncode


def _clamp(v, lo, hi, default):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


def _get(sid):
    with _lock:
        return _sessions.get(sid)


def _event(seq, text) -> str:
    return f'id: {seq}\ndata: {_b64(text)}\n\n'


@tm.route('/open', methods=['POST'])
def open_sess():
    data = request.json or {}
    with _lock:
        sid = f't{next(_sid_iter)}'
    sess = Session(sid, data.get('rows'), data.get('cols'))
    with _lock:
        _sessions[sid] = sess
    return jsonify({'sid': sid})


@tm.route('/stream', methods=['GET'])
def stream():
    sid = request.args.get('sid', '')
    sess = _get(sid)
    if not sess:
        return jsonify({'error': '会话不存在'}), 404

    try:
        from_seq = int(request.headers.get('Last-Event-ID') or request.args.get('seq') or 0)
    except (TypeError, ValueError):
        from_seq = 0

    def generate():
        last_sent = from_seq
        try:
            with sess.cond:
                backlog = [c for c in list(sess.buf) if c[0] > last_sent]
            for s, t in backlog:
                yield _event(s, t)
                last_sent = s

            while True:
                with sess.cond:
                    if not sess.closed:
                        sess.cond.wait(timeout=_HEARTBEAT)
                    fresh = [c for c in list(sess.buf) if c[0] > last_sent]
                for s, t in fresh:
                    yield _event(s, t)
                    last_sent = s
                if sess.closed:
                    yield 'event: closed\ndata: {}\n\n'
                    break
                yield ': ping\n\n'
        except GeneratorExit:
            pass

    resp = Response(generate(), mimetype='text/event-stream')
    resp.headers['Cache-Control'] = 'no-cache'
    resp.headers['X-Accel-Buffering'] = 'no'
    resp.headers['Connection'] = 'keep-alive'
    return resp


@tm.route('/input', methods=['POST'])
def input_data():
    data = request.json or {}
    sess = _get(data.get('sid', ''))
    if not sess or sess.closed:
        return jsonify({'error': '会话不存在或已关闭'}), 404
    raw = data.get('data', '')
    if raw and not sess.write(raw):
        return jsonify({'error': '写入失败'}), 500
    return jsonify({'ok': True})


@tm.route('/resize', methods=['POST'])
def resize():
    data = request.json or {}
    sess = _get(data.get('sid', ''))
    if not sess or sess.closed:
        return jsonify({'error': '会话不存在或已关闭'}), 404
    sess.resize(data.get('rows'), data.get('cols'))
    return jsonify({'ok': True})


@tm.route('/close', methods=['POST'])
def close():
    data = request.json or {}
    sid = data.get('sid', '')
    sess = _get(sid)
    if sess:
        sess.wait_exit()
        sess._close_internal()
        with _lock:
            _sessions.pop(sid, None)
    return jsonify({'ok': True})


@tm.route('/sessions', methods=['GET'])
def sessions():
    now = time.time()
    with _lock:
        items = [{
            'sid': s.sid,
            'user': s.user,
            'host': s.host,
            'age': int(now - s.created),
            'idle': int(now - s.last_activity),
        } for s in _sessions.values() if not s.closed]
    return jsonify({'sessions': items})


def _reaper():
    while True:
        time.sleep(30)
        now = time.time()
        with _lock:
            dead = [sid for sid, s in list(_sessions.items())
                    if s.closed or now - s.last_activity > IDLE_TTL]
        for sid in dead:
            sess = _get(sid)
            if sess:
                sess.wait_exit()
                sess._close_internal()
            with _lock:
                _sessions.pop(sid, None)


threading.Thread(target=_reaper, daemon=True).start()