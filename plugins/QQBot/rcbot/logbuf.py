# -*- coding: utf-8 -*-
"""运行日志：内存环形缓冲 + 滚动文件。"""
import collections
import os
import sys
import time
import threading

_lock = threading.Lock()
_buf = collections.deque(maxlen=3000)
_logfile = None
_level = 'INFO'

LEVELS = {'DEBUG': 10, 'INFO': 20, 'WARN': 30, 'ERROR': 40}


def setup(path=None, level='INFO'):
    global _logfile, _level
    _level = (level or 'INFO').upper()
    if path:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        _logfile = path


def _fmt(level, tag, msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    return '%s [%s] [%s] %s' % (ts, level, tag, msg)


def _write(level, tag, msg):
    line = _fmt(level, tag, msg)
    with _lock:
        _buf.append(line)
        if _logfile:
            try:
                # 超过 8MB 就滚一次
                if os.path.exists(_logfile) and os.path.getsize(_logfile) > 8 * 1024 * 1024:
                    os.replace(_logfile, _logfile + '.1')
                with open(_logfile, 'a', encoding='utf-8') as f:
                    f.write(line + '\n')
            except Exception:
                pass
    if LEVELS.get(level, 20) >= LEVELS.get(_level, 20):
        try:
            sys.stdout.write(line + '\n')
            sys.stdout.flush()
        except Exception:
            pass


def debug(tag, msg):
    _write('DEBUG', tag, msg)


def info(tag, msg):
    _write('INFO', tag, msg)


def warn(tag, msg):
    _write('WARN', tag, msg)


def error(tag, msg):
    _write('ERROR', tag, msg)


def tail(n=300, kw=''):
    with _lock:
        lines = list(_buf)
    if kw:
        k = kw.lower()
        lines = [l for l in lines if k in l.lower()]
    return lines[-int(n):]
