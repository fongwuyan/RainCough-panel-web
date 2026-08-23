import os
import sys
import json
import time
import shutil
import threading
import subprocess
from flask import Blueprint, request, jsonify

scheduler_api = Blueprint('scheduler', __name__, url_prefix='/api/scheduler')

# 允许通过环境变量覆盖(默认宿主部署路径)
DATA_DIR = os.environ.get('TOUCHGAL_DATA_DIR', '/opt/touchgal/data')
JOBS_FILE = os.path.join(DATA_DIR, 'scheduler.json')
PLUGINS_DIR = os.environ.get('TOUCHGAL_PLUGINS_DIR', '/opt/touchgal/plugins')
LOCK = threading.Lock()

_manager = None
_flask_app = None

_jobs = {}
_last = {}
_history = {}

HIST_MAX = 15

from apscheduler.schedulers.background import BackgroundScheduler
_sched = BackgroundScheduler(daemon=True)
_sched.start()


def init_scheduler(manager, flask_app):
    global _manager, _flask_app
    _manager = manager
    _flask_app = flask_app
    _load_persisted()


def _mod(pkg):
    return sys.modules.get('plugins.%s.plugin' % pkg)


def _action_gen_img(params):
    mod = _mod('aigen')
    if not mod:
        return 'aigen 插件未加载'
    jid = time.strftime('%Y%m%d%H%M%S') + str(int(time.time() * 1000) % 10000)
    job = {
        'id': jid,
        'mode': 'text2img',
        'status': 'queued',
        'progress': 0,
        'created': time.time(),
        'prompt': params.get('prompt', ''),
        'negative_prompt': params.get('negative_prompt', ''),
        'width': int(params.get('width', 512)),
        'height': int(params.get('height', 512)),
        'steps': int(params.get('steps', 20)),
        'cfg': float(params.get('cfg', 7.0)),
        'seed': int(params.get('seed', -1)),
        'count': int(params.get('count', 1)),
        'lora': params.get('lora', ''),
        'model': params.get('model', ''),
        'upscale': params.get('upscale', ''),
        'use_easy_negative': True,
    }
    mod._manager.enqueue(job)
    return '已入队生图任务: ' + jid


def _action_grab_setu(params):
    if _manager is None:
        return '调度器未初始化'
    plugin = _manager.get_plugin('laizhangsetu')
    if not plugin:
        return 'laizhangsetu 插件未加载'
    payload = {}
    if params.get('tag'):
        payload['tag'] = params['tag']
    with _flask_app.test_request_context('/x', method='POST', json=payload):
        resp = plugin.dispatch('fetch', 'POST')
        if isinstance(resp, tuple):
            data = resp[0].get_json()
        else:
            data = resp.get_json()
    return json.dumps(data, ensure_ascii=False)[:300]


def _action_rebuild_library(params):
    mod = _mod('JMComic')
    if not mod:
        return 'JMComic 插件未加载'
    mod.rebuild_library()
    return '媒体库索引已重建'


def _action_clean_tmp(params):
    target = params.get('dir', PLUGINS_DIR)
    try:
        days = int(params.get('days', 3))
    except (TypeError, ValueError):
        days = 3
    if not os.path.isdir(target):
        return '目录不存在: ' + target
    cutoff = time.time() - days * 86400
    removed = []
    for entry in os.listdir(target):
        full = os.path.join(target, entry)
        is_tmp = entry.startswith('_tmp') or entry.endswith('.tmp')
        if not is_tmp:
            continue
        try:
            if os.path.isdir(full) and not os.path.islink(full):
                st = os.lstat(full)
                if st.st_mtime > cutoff:
                    continue
                shutil.rmtree(full, ignore_errors=True)
                removed.append(entry)
            elif os.path.isfile(full):
                st = os.lstat(full)
                if st.st_mtime > cutoff:
                    continue
                os.remove(full)
                removed.append(entry)
        except OSError:
            continue
    return '清理临时文件 %d 个: %s' % (len(removed), ', '.join(removed[:10]))


def _action_shell(params):
    cmd = params.get('command', '').strip()
    if not cmd:
        return '未提供命令'
    try:
        timeout = int(params.get('timeout', 60))
    except (TypeError, ValueError):
        timeout = 60
    pkg, rest = None, cmd
    if cmd.startswith('env:'):
        rest = cmd[4:].strip()
        parts = rest.split(None, 1)
        if parts:
            pkg, rest = parts[0], (parts[1] if len(parts) > 1 else '')
    env = None
    if pkg:
        try:
            from envpkg import env_run_prefix
            env = env_run_prefix(pkg)
            if env is None:
                return '环境包 %s 未安装' % pkg
            rest = rest or ''
            cmd = 'bash -c "%s"' % rest.replace('"', '\\"')
        except ImportError:
            pass
    try:
        rc = subprocess.run(cmd, shell=True, capture_output=True, timeout=timeout,
                            text=True, cwd='/opt/touchgal', env=env)
        out = (rc.stdout or '').strip()
        err = (rc.stderr or '').strip()
        tail = (out + '\n' + err).strip()
        return 'exit=%d %s' % (rc.returncode, tail[-300:])
    except subprocess.TimeoutExpired:
        return '命令执行超时(%ds)' % timeout
    except Exception as e:
        return '执行失败: %s' % e


ACTIONS = {
    'gen_img': {'label': '定时生图', 'run': _action_gen_img},
    'grab_setu': {'label': '定时抓涩图', 'run': _action_grab_setu},
    'rebuild_library': {'label': '媒体索引重建', 'run': _action_rebuild_library},
    'clean_tmp': {'label': '临时文件清理', 'run': _action_clean_tmp},
    'shell': {'label': '执行命令', 'run': _action_shell},
}


def _fire(job_id):
    job = _jobs.get(job_id)
    if not job:
        return
    if job.get('paused'):
        return

    def run():
        action = job.get('action')
        params = job.get('params') or {}
        func = ACTIONS.get(action, {}).get('run')
        started = time.time()
        with LOCK:
            _last[job_id] = {'status': 'running', 'time': started, 'message': ''}
        try:
            message = func(params) if func else '未知动作: %s' % action
            status, msg = 'ok', str(message)
        except Exception as e:
            status, msg = 'error', str(e)
        ended = time.time()
        rec = {'status': status, 'time': ended, 'message': msg,
               'duration': round(ended - started, 1)}
        with LOCK:
            _last[job_id] = rec
            h = _history.setdefault(job_id, [])
            h.insert(0, rec)
            del h[HIST_MAX:]

    threading.Thread(target=run, daemon=True).start()


def _apply_schedule(job):
    job_id = job['id']
    trigger = job.get('trigger')
    if trigger == 'interval':
        _sched.add_job(lambda: _fire(job_id), 'interval', id=job_id,
                       seconds=int(job.get('interval', 3600)), replace_existing=True)
    else:
        cron = {k: (v if v is not None else '*') for k, v in {
            'minute': job.get('minute'),
            'hour': job.get('hour'),
            'day': job.get('day'),
            'month': job.get('month'),
            'day_of_week': job.get('day_of_week'),
        }.items()}
        _sched.add_job(lambda: _fire(job_id), 'cron', id=job_id, replace_existing=True, **cron)
    if job.get('paused'):
        try:
            _sched.pause_job(job_id)
        except Exception:
            pass


def _save():
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(JOBS_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(_jobs.values()), f, ensure_ascii=False)


def _load_persisted():
    if not os.path.isfile(JOBS_FILE):
        return
    try:
        with open(JOBS_FILE, encoding='utf-8') as f:
            jobs = json.load(f)
    except Exception:
        return
    for job in jobs:
        if not isinstance(job, dict) or 'id' not in job:
            continue
        _jobs[job['id']] = job
        _apply_schedule(job)


@scheduler_api.route('/actions', methods=['GET'])
def actions_info():
    return jsonify({'actions': [{'key': k, 'label': v['label']} for k, v in ACTIONS.items()]})


@scheduler_api.route('/jobs', methods=['GET'])
def list_jobs():
    result = []
    for job in _jobs.values():
        entry = dict(job)
        entry['next_run_time'] = None
        entry['last'] = dict(_last.get(job['id'], {}))
        entry['history'] = [dict(x) for x in _history.get(job['id'], [])]
        try:
            j = _sched.get_job(job['id'])
            entry['next_run_time'] = int(j.next_run_time.timestamp()) if j and j.next_run_time else None
        except Exception:
            pass
        result.append(entry)
    result.sort(key=lambda x: x.get('created', 0))
    return jsonify({'jobs': result})


@scheduler_api.route('/jobs', methods=['POST'])
def create_job():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    action = data.get('action', '')
    trigger = data.get('trigger', 'interval')
    if not name:
        return jsonify({'error': '任务名称不能为空'}), 400
    if action not in ACTIONS:
        return jsonify({'error': '无效的动作类型'}), 400
    if trigger not in ('interval', 'cron'):
        return jsonify({'error': '无效的触发类型'}), 400
    job_id = 'job_' + str(int(time.time() * 1000)) + str(int(time.time() * 1000) % 97)
    job = {
        'id': job_id,
        'name': name,
        'action': action,
        'trigger': trigger,
        'params': data.get('params') or {},
        'paused': False,
        'created': int(time.time()),
    }
    if trigger == 'interval':
        try:
            interval = max(10, int(data.get('interval', 3600)))
        except (TypeError, ValueError):
            interval = 3600
        job['interval'] = interval
    else:
        job['minute'] = str(data.get('minute', '0') or '0')
        job['hour'] = str(data.get('hour', '*') or '*')
        job['day'] = str(data.get('day', '*') or '*')
        job['month'] = str(data.get('month', '*') or '*')
        job['day_of_week'] = str(data.get('day_of_week', '*') or '*')
    _jobs[job_id] = job
    _apply_schedule(job)
    _save()
    return jsonify({'id': job_id})


@scheduler_api.route('/jobs/<job_id>', methods=['PUT'])
def update_job(job_id):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({'error': '任务不存在'}), 404
    data = request.json or {}
    if data.get('name'):
        job['name'] = str(data['name']).strip()
    if data.get('action') in ACTIONS:
        job['action'] = data['action']
    if data.get('params') is not None:
        job['params'] = data['params']
    if data.get('trigger') == 'interval' and data.get('interval') is not None:
        try:
            job['interval'] = max(10, int(data['interval']))
        except (TypeError, ValueError):
            pass
    elif data.get('trigger') == 'cron':
        job['trigger'] = 'cron'
        for k in ('minute', 'hour', 'day', 'month', 'day_of_week'):
            if data.get(k) is not None:
                job[k] = str(data[k])
    _apply_schedule(job)
    _save()
    return jsonify({'id': job_id})


@scheduler_api.route('/jobs/<job_id>', methods=['DELETE'])
def delete_job(job_id):
    if job_id not in _jobs:
        return jsonify({'error': '任务不存在'}), 404
    try:
        _sched.remove_job(job_id)
    except Exception:
        pass
    _jobs.pop(job_id, None)
    _last.pop(job_id, None)
    _history.pop(job_id, None)
    _save()
    return jsonify({'message': '已删除'})


@scheduler_api.route('/jobs/<job_id>/pause', methods=['POST'])
def pause_job(job_id):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({'error': '任务不存在'}), 404
    job['paused'] = True
    try:
        _sched.pause_job(job_id)
    except Exception:
        pass
    _save()
    return jsonify({'id': job_id, 'paused': True})


@scheduler_api.route('/jobs/<job_id>/resume', methods=['POST'])
def resume_job(job_id):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({'error': '任务不存在'}), 404
    job['paused'] = False
    try:
        _sched.resume_job(job_id)
    except Exception:
        pass
    _save()
    return jsonify({'id': job_id, 'paused': False})


@scheduler_api.route('/jobs/<job_id>/run', methods=['POST'])
def run_now(job_id):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({'error': '任务不存在'}), 404
    _fire(job_id)
    return jsonify({'message': '已触发执行'})
