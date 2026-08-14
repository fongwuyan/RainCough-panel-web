import os
import time
from flask import Blueprint, request, jsonify

sys = Blueprint('system', __name__, url_prefix='/api/sys')

LOG_FILE = '/var/log/touchgal.log'
TAIL_LIMIT = 2000


def _tail(path, lines=200, grep=None):
    if not os.path.isfile(path):
        return None
    try:
        with open(path, 'rb') as f:
            f.seek(0, 2)
            size = f.tell()
            block = 8192
            data = b''
            read = 0
            while size > 0 and read < 8 * 1024 * 1024:
                take = min(block, size)
                size -= take
                f.seek(size)
                chunk = f.read(take)
                data = chunk + data
                read += take
                if data.count(b'\n') >= lines + 1:
                    break
            text = data.decode('utf-8', errors='replace')
    except OSError:
        return None
    lines_arr = text.splitlines()[-lines:]
    if grep:
        gl = grep.lower()
        lines_arr = [ln for ln in lines_arr if gl in ln.lower()]
    return '\n'.join(lines_arr)


@sys.route('/logs', methods=['GET'])
def logs():
    lines = request.args.get('lines', 200)
    try:
        lines = min(max(int(lines), 10), TAIL_LIMIT)
    except (TypeError, ValueError):
        lines = 200
    grep = request.args.get('grep', '')
    data = _tail(LOG_FILE, lines, grep)
    if data is None:
        return jsonify({'error': f'日志文件不存在: {LOG_FILE}'}), 404
    return jsonify({'path': LOG_FILE, 'text': data})


def _proc_info(p):
    try:
        info = p.info
        mem = p.memory_info()
        return {
            'pid': p.pid,
            'name': info.get('name') or '',
            'status': info.get('status') or '',
            'cpu': p.cpu_percent(interval=None) or 0,
            'mem': mem.rss if mem else 0,
            'mem_percent': p.memory_percent() or 0,
            'username': info.get('username') or '',
            'cmdline': ' '.join(info.get('cmdline') or [])[:300] or p.name() or '',
            'create_time': int(p.create_time() or 0),
        }
    except Exception:
        return None


@sys.route('/processes', methods=['GET'])
def processes():
    import psutil
    sort = request.args.get('sort', 'cpu')
    try:
        procs = list(psutil.process_iter(['pid', 'name', 'status', 'username', 'cmdline', 'create_time']))
    except Exception:
        procs = list(psutil.process_iter(['pid']))
    items = []
    for p in procs:
        pi = _proc_info(p)
        if pi:
            items.append(pi)
    items.sort(key=lambda x: x.get(sort, 0) if sort in ('cpu', 'mem') else x.get('pid', 0),
               reverse=True)
    return jsonify({'processes': items})


@sys.route('/processes/kill', methods=['POST'])
def kill_process():
    import signal
    import psutil
    data = request.json or {}
    pid = data.get('pid')
    sig = data.get('sig', 'SIGTERM')
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return jsonify({'error': '无效的 PID'}), 400
    try:
        sig = getattr(signal, str(sig).upper(), signal.SIGTERM)
    except Exception:
        sig = signal.SIGTERM
    try:
        p = psutil.Process(pid)
        p.send_signal(sig)
        return jsonify({'ok': True, 'pid': pid, 'sig': sig.name})
    except psutil.NoSuchProcess:
        return jsonify({'error': '进程不存在'}), 404
    except psutil.AccessDenied:
        return jsonify({'error': '无权限操作该进程（非本用户进程）'}), 403
    except Exception as e:
        return jsonify({'error': str(e)}), 500
