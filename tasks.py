"""统一任务队列：聚合所有插件与系统级后台任务，供前端"任务队列"选项卡展示。"""
import os
import sys
import time
import json
import threading
from flask import Blueprint, jsonify, request

_PROVIDERS = {}


def register_provider(source, fn):
    """注册一个任务收集器。fn() 返回归一化任务 dict 列表，见 _normalize。"""
    _PROVIDERS[source] = fn


def list_providers():
    return list(_PROVIDERS.keys())


# ---------------------------------------------------------------------------
# 归一化任务结构：
#   source  来源标识
#   id      来源方任务主键
#   kind    download | install | generate | repaint | batch | schedule | process
#   name    可展示标题
#   status  queued | running | done | error | cancelled | interrupted | idle
#   phase   子阶段（来源保留）
#   progress 0-100
#   message 人类可读说明
#   error   失败信息
#   created 创建时间戳
#   deep_link 前端跳转路径（/#/xxx）
# ---------------------------------------------------------------------------


def _normalize(source, t):
    t = dict(t) if isinstance(t, dict) else {}
    status = t.get('status', '')
    phase = t.get('phase', '') or t.get('message', '') or ''
    progress = t.get('progress') or 0
    kind = t.get('kind', '')
    return {
        'source': source,
        'id': t.get('id', ''),
        'kind': kind or _infer_kind(source, status, phase),
        'name': t.get('name', '') or t.get('title', '') or '',
        'status': status,
        'phase': phase,
        'progress': int(progress) if isinstance(progress, (int, float)) else 0,
        'message': t.get('message', ''),
        'error': t.get('error', ''),
        'created': t.get('created') or int(time.time()),
        'deep_link': t.get('deep_link', ''),
    }


def _infer_kind(source, status, phase):
    s = source + '|' + status + '|' + str(phase)
    if 'install' in s or 'envpkg' in s or 'core' in s:
        return 'install'
    if 'download' in s or 'jmcomic' in s or 'fetch' in s or 'pull' in s or 'yulotool' in s:
        return 'download'
    if 'gen' in s or 'paint' in s or 'text2skin' in s or 'aigen' in s or 'mcskin' in s:
        return 'generate'
    if 'schedule' in s or 'batch' in s:
        return 'batch'
    return 'process'


# ---------------------------------------------------------------------------
# 通用异步任务注册（供原同步阻塞型下载改造使用：docker pull / yulotool / 本地图 /
# 插件 zip 安装）。模块 import tasklog 后用 begin/update/finish 记录。
# ---------------------------------------------------------------------------

_ASYNC = {}
_ASYNC_LOCK = threading.Lock()


def _new_async_id(prefix):
    return '%s_%d_%d' % (prefix, int(time.time()), threading.get_ident())


def begin(source, name, kind='download', meta=None, days=1):
    tid = _new_async_id(source)
    t = {
        'id': tid, 'source': source, 'name': name, 'kind': kind,
        'status': 'running', 'phase': 'starting', 'progress': 0,
        'message': '准备中…', 'error': '', 'created': int(time.time()),
        'deep_link': '',
        'meta': meta or {}, '_expire': time.time() + days * 86400,
    }
    with _ASYNC_LOCK:
        _ASYNC[tid] = t
    return tid


def update(tid, **kw):
    with _ASYNC_LOCK:
        t = _ASYNC.get(tid)
        if not t:
            return
        t.update(kw)
        t['_expire'] = time.time() + 1 * 86400


def finish(tid, ok=True, message=None, error=None, progress=100, status=None):
    with _ASYNC_LOCK:
        t = _ASYNC.get(tid)
        if not t:
            return
        if ok:
            t.update(status='done', progress=progress,
                     message=message or t.get('message', ''), error='')
        else:
            t.update(status='error', error=error or '失败',
                     message=message or '', phase='failed')


def read_async(source=None):
    with _ASYNC_LOCK:
        now = time.time()
        items = []
        for tid in list(_ASYNC.keys()):
            t = _ASYNC[tid]
            if t['_expire'] < now:
                del _ASYNC[tid]
                continue
            if source and t['source'] != source:
                continue
            items.append(t)
        return [dict(x) for x in items]


def _cleanup():
    with _ASYNC_LOCK:
        now = time.time()
        for tid in list(_ASYNC.keys()):
            if _ASYNC[tid]['_expire'] < now:
                del _ASYNC[tid]


# ---------------------------------------------------------------------------
# 各来源收集器（懒加载读取模块内部状态）
# ---------------------------------------------------------------------------

def _mod(pkg):
    try:
        return sys.modules.get('plugins.%s.plugin' % pkg)
    except Exception:
        return None


def _collect_envpkg():
    try:
        import envpkg as m
    except Exception:
        return []
    tasks = list(getattr(m, '_TASKS', {}).values())
    out = []
    for t in tasks:
        st = t.get('status', '')
        if st == 'installed':
            st = 'done'
        phase = _envpkg_phase(st, t)
        if st == 'error':
            phase = t.get('error', '失败') or '失败'
        out.append({
            'id': t.get('id', ''), 'name': t.get('name', ''),
            'kind': 'install', 'status': st,
            'phase': phase, 'progress': t.get('progress', 0),
            'message': phase, 'error': t.get('error', ''),
            'created': t.get('created'), 'deep_link': '/#/envpkg',
        })
    return out


def _envpkg_phase(st, t):
    PHASE = {'queued': '排队中', 'downloading': '下载中', 'extracting': '解压中',
             'compiling': '编译中', 'done': '安装完成', 'error': '失败',
             'interrupted': '已中断'}
    return PHASE.get(st, st)


def _collect_mcserver():
    m = _mod('mcserver')
    if not m or not hasattr(m, 'get_store'):
        return []
    try:
        store = m.get_store()
        instances = dict(store.get('instances') or {})
    except Exception:
        return []
    out = []
    for name, inst in instances.items():
        state = inst.get('install_state')
        done = bool(inst.get('install_done', False))
        err = bool(inst.get('install_error', False))
        if not state and done:
            continue
        if err:
            status, progress = 'error', 100
        elif done:
            status = 'done'
            progress = 100
        else:
            status = 'running'
            progress = 40
        out.append({
            'id': 'mc-core-%s' % name, 'source_extra': name,
            'name': '%s 核心安装' % (inst.get('label') or name),
            'kind': 'install', 'status': status, 'phase': state or '',
            'progress': progress, 'message': state or '',
            'error': '' if not err else (state or '失败'),
            'created': inst.get('added') or int(time.time()),
            'deep_link': '/#/plugin/mcserver',
        })
    return out


def _collect_aigen():
    m = _mod('aigen')
    mgr = getattr(m, '_manager', None) if m else None
    if not mgr:
        return []
    jobs = list(getattr(mgr, '_jobs', {}).values())
    out = []
    for j in jobs:
        prompt = str(j.get('prompt') or j.get('name') or '').replace('\n', ' ')
        mode = '文生图' if j.get('mode') == 'text2img' else ('图生图' if j.get('mode') == 'img2img' else '生图')
        out.append({
            'id': j.get('id', ''), 'name': '%s：%s' % (mode, (prompt[:24] + '…') if len(prompt) > 24 else prompt),
            'kind': 'generate', 'status': j.get('status', ''), 'phase': '',
            'progress': j.get('progress', 0), 'message': '',
            'error': j.get('error', ''), 'created': j.get('created'),
            'deep_link': '/#/plugin/aigen',
        })
    return out


def _collect_mcskin_paint():
    m = _mod('mcskin')
    mgr = getattr(m, '_paint_manager', None) if m else None
    if not mgr:
        return []
    jobs = list(getattr(mgr, '_jobs', {}).values())
    out = []
    for j in jobs:
        out.append({
            'id': j.get('id', ''), 'name': '图片纹路重绘',
            'kind': 'repaint', 'status': j.get('status', ''),
            'phase': j.get('region', ''), 'progress': j.get('progress', 0),
            'message': j.get('region', ''), 'error': j.get('error', ''),
            'created': j.get('created'), 'deep_link': '/#/plugin/mcskin',
        })
    return out


def _collect_mcskin_text2skin():
    try:
        import plugins.llm_common as llm
    except Exception:
        return []
    jobs = dict(getattr(llm, '_llm_jobs', {}))
    out = []
    for j in jobs.values():
        prompt = str(j.get('prompt') or '').replace('\n', ' ')
        out.append({
            'id': j.get('id', ''), 'name': '文生皮肤：%s' % ((prompt[:24] + '…') if len(prompt) > 24 else prompt),
            'kind': 'generate', 'status': j.get('status', ''), 'phase': '',
            'progress': j.get('progress', 0), 'message': '',
            'error': j.get('error', ''), 'created': j.get('created'),
            'deep_link': '/#/plugin/mcskin',
        })
    return out


def _collect_jmcomic():
    m = _mod('JMComic')
    mgr = getattr(m, '_manager', None) if m else None
    if not mgr:
        return []
    out = []
    tasks = dict(getattr(mgr, '_tasks', {}))
    for aid, t in tasks.items():
        st = t.get('status', '')
        if st in ('completed', 'cached'):
            continue
        out.append({
            'id': 'jm-%s' % aid,
            'name': '下载：%s' % (t.get('name') or aid),
            'kind': 'download', 'status': st, 'phase': '',
            'progress': 50 if st == 'downloading' else (5 if st == 'queued' else 100),
            'message': '', 'error': '', 'created': int(time.time()),
            'deep_link': '/#/plugin/jmcomic',
        })
    b = dict(getattr(mgr, '_batch', {}))
    if b.get('running') or b.get('status') not in ('idle',):
        out.append({
            'id': 'jm-batch',
            'name': '批量下载：%s %s' % (b.get('mode', ''), b.get('keyword', '')),
            'kind': 'batch', 'status': ('running' if b.get('running') else 'error'),
            'phase': b.get('status', ''), 'progress': 0,
            'message': '已收集 %s，完成 %s' % (b.get('found', 0), b.get('done', 0)),
            'error': b.get('error', ''), 'created': int(time.time()),
            'deep_link': '/#/plugin/jmcomic',
        })
    return out


def _collect_scheduler():
    try:
        import scheduler as m
    except Exception:
        return []
    out = []
    last = dict(getattr(m, '_last', {}))
    for jid, rec in last.items():
        j = getattr(m, '_jobs', {}).get(jid, {})
        if rec.get('status') != 'running':
            continue
        out.append({
            'id': 'sched-%s' % jid,
            'name': '定时任务：%s' % (j.get('name', jid)),
            'kind': 'schedule', 'status': 'running',
            'phase': rec.get('status', 'running'), 'progress': 30,
            'message': rec.get('message', ''), 'error': '',
            'created': rec.get('time') or int(time.time()),
            'deep_link': '/#/scheduler',
        })
    return out


def register_all():
    register_provider('envpkg', _collect_envpkg)
    register_provider('mcserver-core', _collect_mcserver)
    register_provider('aigen', _collect_aigen)
    register_provider('mcskin-paint', _collect_mcskin_paint)
    register_provider('mcskin-text2skin', _collect_mcskin_text2skin)
    register_provider('jmcomic', _collect_jmcomic)
    register_provider('scheduler', _collect_scheduler)


# ---------------------------------------------------------------------------
# flask 视图
# ---------------------------------------------------------------------------
def _make_blueprint():
    bp = Blueprint('taskqueue', __name__, url_prefix='/api/tasks')

    def _snapshot(include_done, limit=0):
        _cleanup()
        items = []
        for source, fn in list(_PROVIDERS.items()):
            try:
                got = fn()
                if isinstance(got, dict):
                    got = got.get('tasks', []) if 'tasks' in got else [got]
                for t in got or []:
                    items.append(_normalize(source, t))
            except Exception as e:
                items.append({
                    'source': source, 'id': source, 'kind': 'process',
                    'name': source, 'status': 'error', 'phase': 'collector',
                    'progress': 0, 'message': '收集器异常: %s' % e,
                    'error': str(e), 'created': int(time.time()), 'deep_link': '',
                })
        for t in read_async():
            items.append(_normalize(t['source'], t))

        def _prio(x):
            order = {'running': 0, 'queued': 1, 'downloading': 0,
                     'collecting': 1, 'idle': 3, 'interrupted': 2,
                     'cancelled': 4, 'error': 4, 'done': 5, 'skipped': 5}
            p = order.get(x['status'], 3)
            if x['status'] in ('running', 'downloading') and x['phase'] in ('downloading', 'running', 'compiling', 'extracting'):
                p = -1
            return (p, -int(x.get('created') or 0))

        items.sort(key=_prio)
        if not include_done:
            items = [i for i in items if i['status'] not in ('done', 'skipped', 'cancelled')]
        if limit and len(items) > limit:
            items = items[:limit]
        total = len(items)
        running = sum(1 for i in items if i['status'] in ('running', 'downloading', 'collecting'))
        queued = sum(1 for i in items if i['status'] in ('queued', 'idle'))
        failed = sum(1 for i in items if i['status'] in ('error', 'interrupted', 'failed'))
        done = sum(1 for i in items if i['status'] in ('done', 'cancelled', 'skipped'))
        return {'tasks': items, 'total': total, 'running': running,
                'queued': queued, 'failed': failed, 'done': done}

    @bp.route('', methods=['GET'])
    @bp.route('/', methods=['GET'])
    @bp.route('/all', methods=['GET'])
    def list_all():
        include_done = (request.args.get('done', '') not in ('0', 'false', 'False'))
        try:
            limit = max(0, int(request.args.get('limit', '0') or 0))
        except ValueError:
            limit = 0
        return jsonify(_snapshot(include_done, limit))

    @bp.route('/purge', methods=['POST'])
    def purge_finished():
        """前端手动清理：仅刷新缓存快照（来源方按其保留策略裁剪）。"""
        include_done = (request.args.get('done', '') not in ('0', 'false', 'False'))
        data = _snapshot(include_done, 0)
        data['purged'] = True
        return jsonify(data)

    return bp