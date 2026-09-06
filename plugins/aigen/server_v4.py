#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""aigen 插件后端(接口库 v4) — 直接复用同目录旧 server.py 的全量逻辑。

本地 SD1.5 文生图/图生图(EasyNegative/VAE/Real-ESRGAN)。模型/输出仍在插件目录,
输出图片由主系统经 /api/plugins/aigen/output/<file> 代发。
"""
import os
import random
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
import server as L  # 旧后端全量逻辑(仅 import, 不启动)


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


@rc.interface("aigen.ping")
def aigen_ping(params):
    cfg = L.load_config()
    model_dir = cfg.get('model_dir') or L.DEFAULT_MODEL_DIR
    listing = L.list_models(model_dir)
    st = L.pipe_state()
    return {'ok': bool(listing['models']), 'models': listing,
            'pipe_loaded': st['pipe'] is not None, 'current_model': st['model'],
            'output_dir': cfg.get('output_dir'), 'config': cfg}


@rc.interface("aigen.models")
def aigen_models(params):
    model_dir = L.load_config().get('model_dir') or L.DEFAULT_MODEL_DIR
    return L.list_models(model_dir)


def _make_job(data, mode):
    prompt = str(_p(data).get('prompt') or '').strip()
    if not prompt:
        _err('请输入提示词')
    if mode == 'img2img' and not data.get('image'):
        _err('请上传输入图片')
    jid = datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))
    return {
        'id': jid, 'mode': mode, 'status': 'queued', 'progress': 0,
        'created': time.time(), 'prompt': prompt,
        'negative_prompt': data.get('negative_prompt'),
        'width': data.get('width'), 'height': data.get('height'),
        'steps': data.get('steps'), 'cfg': data.get('cfg'),
        'seed': data.get('seed', -1), 'count': data.get('count', 1),
        'lora': data.get('lora'), 'model': data.get('model'),
        'upscale': data.get('upscale'),
        'use_easy_negative': data.get('use_easy_negative', True),
    }


@rc.interface("aigen.generate")
def aigen_generate(params):
    job = _make_job(params, 'text2img')
    L._manager.enqueue(job)
    return {'job_id': job['id'], 'status': 'queued'}


@rc.interface("aigen.img2img")
def aigen_img2img(params):
    job = _make_job(params, 'img2img')
    job['image'] = params.get('image')
    job['strength'] = params.get('strength', 0.6)
    L._manager.enqueue(job)
    return {'job_id': job['id'], 'status': 'queued'}


@rc.interface("aigen.status")
def aigen_status(params):
    jid = str(_p(params).get('job_id', '')).strip()
    if not jid:
        _err('缺少任务ID')
    j = L._manager.get(jid)
    if not j:
        _err('任务不存在')
    return {k: j.get(k) for k in ('id', 'status', 'progress', 'images', 'error', 'mode', 'created')}


@rc.interface("aigen.cancel")
def aigen_cancel(params):
    jid = str(_p(params).get('job_id', '')).strip()
    if not jid:
        _err('缺少任务ID')
    r = L._manager.cancel(jid)
    if r is None:
        _err('任务不存在')
    if r == 'cancelled':
        return {'message': '已取消', 'status': 'cancelled'}
    if r == 'cancelling':
        return {'message': '正在取消…', 'status': 'cancelling'}
    return {'message': '任务已结束，无法取消', 'status': r}


@rc.interface("aigen.gallery")
def aigen_gallery(params):
    outdir = L.load_config().get('output_dir') or L.DEFAULT_OUTPUT_DIR
    limit, offset = 120, 0
    try:
        limit = max(1, min(500, int(_p(params).get('limit', 120))))
        offset = max(0, int(_p(params).get('offset', 0)))
    except Exception:
        pass
    exts = ('.png', '.jpg', '.jpeg', '.webp', '.gif')
    items = []
    try:
        names = os.listdir(outdir)
    except Exception:
        names = []
    for n in names:
        if not n.lower().endswith(exts):
            continue
        p = os.path.join(outdir, n)
        if not os.path.isfile(p):
            continue
        try:
            st = os.stat(p)
            items.append({'name': n, 'size': st.st_size, 'mtime': int(st.st_mtime),
                          'url': '/api/plugins/aigen/output/' + n})
        except Exception:
            continue
    items.sort(key=lambda x: x['mtime'], reverse=True)
    total = len(items)
    items = items[offset:offset + limit]
    return {'items': items, 'total': total, 'limit': limit, 'offset': offset}


@rc.interface("aigen.gallery.delete")
def aigen_gallery_delete(params):
    name = os.path.basename(str(_p(params).get('name', '')))
    outdir = L.load_config().get('output_dir') or L.DEFAULT_OUTPUT_DIR
    base = os.path.abspath(outdir)
    if not name:
        _err('缺少文件名')
    p = os.path.join(base, name)
    if not os.path.isfile(p) or not os.path.abspath(p).startswith(base + os.sep):
        _err('文件不存在')
    try:
        os.remove(p)
        return {'ok': True, 'name': name}
    except Exception as e:
        _err(str(e))


@rc.interface("aigen.config.get")
def aigen_config_get(params):
    return L.load_config()


@rc.interface("aigen.config.save")
def aigen_config_save(params):
    new_cfg = _p(params)
    cfg = L.load_config()
    if 'storage_paths' in new_cfg:
        paths = [p for p in new_cfg['storage_paths'] if isinstance(p, str) and p.strip()]
        outdir = new_cfg.get('output_dir') or cfg.get('output_dir')
        if outdir and outdir not in paths:
            paths.insert(0, outdir)
        cfg['storage_paths'] = paths
        if new_cfg.get('active_path') not in paths:
            cfg['active_path'] = paths[0]
        else:
            cfg['active_path'] = new_cfg['active_path']
    for k in ('model_dir', 'output_dir', 'default_steps', 'default_cfg',
              'default_width', 'default_height', 'upscale_default'):
        if k in new_cfg:
            cfg[k] = new_cfg[k]
    for k in ('easy_negative', 'fix_vae'):
        if k in new_cfg:
            cfg[k] = bool(new_cfg[k])
    L.save_config(cfg)
    return {'message': '设置已保存', 'config': L.load_config()}


@rc.interface("aigen.settings")
def aigen_settings(params):
    return L.get_settings()


@rc.interface("aigen.info")
def aigen_info(params):
    return {'name': 'aigen', 'label': 'AI 生图', 'version': '2.0.0', 'lang': 'python',
            'description': '本地 SD1.5 文生图/图生图，支持 EasyNegative、VAE 修复、Real-ESRGAN 超分'}


if __name__ == "__main__":
    cfg = L.load_config()
    os.makedirs(cfg.get('output_dir') or L.DEFAULT_OUTPUT_DIR, exist_ok=True)
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="aigen",
        version="2.0.0",
        manifest={"label": "AI 生图", "description": "本地 SD1.5 文生图/图生图"},
        frontend={"pages": [{"path": "", "title": "AI 生图"}]},
        iface_ids=[
            "aigen.ping", "aigen.models", "aigen.generate", "aigen.img2img",
            "aigen.status", "aigen.cancel", "aigen.gallery", "aigen.gallery.delete",
            "aigen.config.get", "aigen.config.save", "aigen.settings", "aigen.info",
        ],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )