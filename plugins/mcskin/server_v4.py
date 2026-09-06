#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mcskin 插件后端(接口库 v4) — 复用同目录旧 server.py 的皮肤转换/AI 上色逻辑。

图片输入 base64; 转换结果经 cache/ 路由或 base64 png 返回。
"""
import base64
import hashlib
import io
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
import server as M


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _b64img(raw):
    if raw.startswith('data:'):
        raw = raw.split(',', 1)[1]
    return base64.b64decode(raw)


def _save_image(params, session):
    raw = _p(params).get('image') or ''
    if not raw:
        _err('请上传图片')
    data = _b64img(raw)
    dest = os.path.join(session, 'input.png')
    with open(dest, 'wb') as f:
        f.write(data)
    return dest


def _clamp_params(params, p):
    for k in p:
        if k == 'bg_removal':
            continue
        v = _p(params).get('p_' + k)
        if v is not None and v != '':
            try:
                p[k] = M._clamp(float(v), 0, 255)
            except (TypeError, ValueError):
                pass
    return p


@rc.interface("mcskin.detect")
def mcskin_detect(params):
    session = M.new_session()
    try:
        path = _save_image(params, session)
        src = M.Image.open(path).convert('RGBA')
        if _p(params).get('bg_removal', '1') not in ('0', 'false', 'False'):
            src = M._remove_bg(src)
        p = M._auto_detect(src)
        return {'ok': True, 'params': p}
    except Exception as e:
        _err('识别失败: %s' % e)
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("mcskin.convert")
def mcskin_convert(params):
    session = M.new_session()
    try:
        path = _save_image(params, session)
        model = str(_p(params).get('model') or 'wide').lower()
        if model not in ('wide', 'slim'):
            model = 'wide'
        try:
            src = M.Image.open(path).convert('RGBA')
        except Exception as e:
            _err('无法解析图片: %s' % e)
        if _p(params).get('bg_removal', '1') not in ('0', 'false', 'False'):
            src = M._remove_bg(src)
        p = dict(M.DEFAULT_P)
        p = _clamp_params(params, p)
        try:
            skin = M._build_skin(src, model, p)
        except Exception as e:
            _err('转换失败: %s' % e)
        os.makedirs(M.CACHE_DIR, exist_ok=True)
        name = hashlib.md5(('%s-%s-%d' % (session, model, time.time())).encode()).hexdigest()[:16] + '.png'
        out = os.path.join(M.CACHE_DIR, name)
        skin.save(out, 'PNG')
        buf = io.BytesIO()
        skin.save(buf, 'PNG')
        return {'ok': True, 'size': list(skin.size), 'model': model,
                'has_overlay': True, 'params': p,
                'url': '/api/plugins/mcskin/cache/' + name,
                'filename': '皮肤_%s_%s.png' % (model, time.strftime('%Y%m%d%H%M%S')),
                'png': base64.b64encode(buf.getvalue()).decode()}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("mcskin.paint.models")
def mcskin_paint_models(params):
    return {'ok': True, 'models': M.list_models(M.DEFAULT_MODEL_DIR)}


@rc.interface("mcskin.paint")
def mcskin_paint(params):
    session = M.new_session()
    try:
        raw = _p(params).get('image') or ''
        if not raw:
            _err('请上传图片')
        src_path = os.path.join(M.CACHE_DIR, 'paint_%d.png' % int(time.time() * 1000))
        os.makedirs(M.CACHE_DIR, exist_ok=True)
        with open(src_path, 'wb') as f:
            f.write(_b64img(raw))
        p = dict(M.DEFAULT_P)
        p = _clamp_params(params, p)
        body = str(_p(params).get('body') or 'wide').lower()
        if body not in ('wide', 'slim'):
            body = 'wide'
        jid = M.new_job_id()
        job = {
            'id': jid, 'status': 'queued', 'progress': 0, 'created': time.time(),
            '_src_path': src_path, 'params': p,
            'bg_removal': _p(params).get('bg_removal', '1') not in ('0', 'false', 'False'),
            'model': _p(params).get('model'), 'body': body,
            'prompt': _p(params).get('prompt'),
            'negative_prompt': _p(params).get('negative_prompt'),
            'steps': _p(params).get('steps'), 'cfg': _p(params).get('cfg'),
            'strength': _p(params).get('strength'),
            'seed': int(_p(params).get('seed') or -1),
        }
        M._paint_manager.enqueue(job)
        return {'ok': True, 'job_id': jid, 'status': 'queued'}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("mcskin.paint.status")
def mcskin_paint_status(params):
    jid = str(_p(params).get('job_id', '')).strip()
    if not jid:
        _err('缺少任务ID')
    j = M._paint_manager.get(jid)
    if not j:
        _err('任务不存在')
    return {k: j.get(k) for k in ('id', 'status', 'progress', 'region', 'error', 'created', 'url', 'size', 'png')}


@rc.interface("mcskin.paint.cancel")
def mcskin_paint_cancel(params):
    jid = str(_p(params).get('job_id', '')).strip()
    if not jid:
        _err('缺少任务ID')
    r = M._paint_manager.cancel(jid)
    if r is None:
        _err('任务不存在')
    return {'ok': True, 'status': r}


@rc.interface("mcskin.text2skin.models")
def mcskin_t2s_models(params):
    return {'ok': True, 'models': M.list_llm_models()}


@rc.interface("mcskin.text2skin.styles")
def mcskin_t2s_styles(params):
    return {'ok': True, 'styles': M.TEXT2SKIN_STYLES, 'tones': M.TEXT2SKIN_TONES}


@rc.interface("mcskin.text2skin")
def mcskin_t2s(params):
    prompt = str(_p(params).get('prompt') or '').strip()
    if not prompt:
        _err('请输入角色描述')
    jid = M.new_llm_job_id()
    job = {
        'id': jid, 'status': 'queued', 'progress': 0, 'created': time.time(),
        'prompt': prompt, 'style': _p(params).get('style') or 'modern',
        'tone': _p(params).get('tone') or 'any',
        'strength': _p(params).get('strength', 3),
        'body': _p(params).get('body') or 'wide',
    }
    M.enqueue_llm(job)
    return {'ok': True, 'job_id': jid, 'status': 'queued'}


@rc.interface("mcskin.text2skin.status")
def mcskin_t2s_status(params):
    jid = str(_p(params).get('job_id', '')).strip()
    if not jid:
        _err('缺少任务ID')
    j = M.get_llm_job(jid)
    if not j:
        _err('任务不存在')
    return {k: j.get(k) for k in ('id', 'status', 'progress', 'error', 'created', 'spec', 'candidate')}


@rc.interface("mcskin.text2skin.history")
def mcskin_t2s_history(params):
    return {'ok': True, 'history': M._load_history()}


@rc.interface("mcskin.text2skin.regenerate")
def mcskin_t2s_regenerate(params):
    jid = str(_p(params).get('job_id', '')).strip()
    if not jid:
        _err('缺少任务ID')
    history = M._load_history()
    item = next((h for h in history if h.get('id') == jid), None)
    if not item:
        _err('历史不存在')
    njid = M.new_llm_job_id()
    job = {'id': njid, 'status': 'queued', 'progress': 0, 'created': time.time(),
           'prompt': item.get('prompt'), 'style': item.get('style'),
           'tone': item.get('tone'), 'strength': item.get('strength'),
           'body': item.get('model') or 'wide'}
    M.enqueue_llm(job)
    return {'ok': True, 'job_id': njid, 'status': 'queued'}


@rc.interface("mcskin.text2skin.feedback")
def mcskin_t2s_feedback(params):
    jid = str(_p(params).get('job_id', '')).strip()
    like = bool(_p(params).get('like'))
    history = M._load_history()
    item = next((h for h in history if h.get('id') == jid), None)
    if not item:
        _err('历史不存在')
    for c in item.get('candidates', []):
        c['feedback'] = 'like' if like else 'dislike'
    M._save_history(history)
    return {'ok': True, 'status': 'like' if like else 'dislike'}


@rc.interface("mcskin.info")
def mcskin_info(params):
    return {'name': 'mcskin', 'label': '图片转皮肤', 'version': '2.0.0', 'lang': 'python',
            'description': '图片转 MC Java 皮肤: 全身立绘映射、AI 上色、3D 预览'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="mcskin",
        version="2.0.0",
        manifest={"label": "图片转皮肤", "description": "皮肤转换/AI 上色"},
        frontend={"pages": [{"path": "", "title": "图片转皮肤"}]},
        iface_ids=[
            "mcskin.detect", "mcskin.convert", "mcskin.paint.models", "mcskin.paint",
            "mcskin.paint.status", "mcskin.paint.cancel",
            "mcskin.text2skin.models", "mcskin.text2skin.styles", "mcskin.text2skin",
            "mcskin.text2skin.status", "mcskin.text2skin.history",
            "mcskin.text2skin.regenerate", "mcskin.text2skin.feedback", "mcskin.info",
        ],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )