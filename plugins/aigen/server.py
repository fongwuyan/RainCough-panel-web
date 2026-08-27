#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""aigen 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

本地 SD1.5 文生图/图生图, 支持 EasyNegative、VAE 修复、Real-ESRGAN 超分。
plugins.sd_common 内联(与旧面板解耦): get_pipe/get_img2img/list_models/resolve_model/
JobManager/pipe_state/new_job_id 原样搬入本文件。路由契约与旧面板一致
(ping/models/generate/img2img/status//cancel//output//gallery/gallery//config/info)。
"""
import os
import re
import json
import time
import random
import struct
import base64
import threading
import http.server
from datetime import datetime
from PIL import Image
from io import BytesIO

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())

DATA_FILE = os.path.join(PLUGIN_DIR, 'data.json')
DEFAULT_MODEL_DIR = os.path.join(PLUGIN_DIR, 'models')
DEFAULT_OUTPUT_DIR = os.path.join(PLUGIN_DIR, 'output')

VAE_FILE = 'vae-ft-mse-840000-ema-pruned.safetensors'
EASY_FILE = 'EasyNegative.safetensors'
ESRGAN_X2 = 'RealESRGAN_x2.pth'
ESRGAN_X4 = 'RealESRGAN_x4.pth'
SD15_CONFIG_DIR = os.path.join(DEFAULT_MODEL_DIR, 'sd15-config')


DEFAULT_CONFIG = {
    'model_dir': DEFAULT_MODEL_DIR,
    'output_dir': DEFAULT_OUTPUT_DIR,
    'storage_paths': [DEFAULT_OUTPUT_DIR],
    'active_path': DEFAULT_OUTPUT_DIR,
    'easy_negative': True,
    'fix_vae': True,
    'upscale_default': 'none',
    'default_steps': 20,
    'default_cfg': 7,
    'default_width': 512,
    'default_height': 512,
}


def path_stats(paths):
    """为存储路径列表生成 {path, exists, total, used, free, percent} 统计(旧 plugins.base 内联)。"""
    import shutil as _sh
    out = []
    for p in (paths or []):
        item = {'path': p, 'exists': False, 'total': 0, 'used': 0, 'free': 0, 'percent': 0}
        try:
            if os.path.isdir(p):
                item['exists'] = True
                u = _sh.disk_usage(p)
                item.update({'total': u.total, 'used': u.used, 'free': u.free,
                             'percent': round(u.used / u.total * 100, 1) if u.total else 0})
        except Exception:
            pass
        out.append(item)
    return out


def load_config():
    cfg = {}
    if os.path.isfile(DATA_FILE):
        try:
            cfg = json.load(open(DATA_FILE, 'r', encoding='utf-8'))
        except Exception:
            cfg = {}
    merged = dict(DEFAULT_CONFIG)
    merged.update(cfg)
    paths = merged.get('storage_paths') or []
    if DEFAULT_OUTPUT_DIR not in paths:
        paths.insert(0, DEFAULT_OUTPUT_DIR)
    merged['storage_paths'] = paths
    if merged.get('active_path') not in paths:
        merged['active_path'] = paths[0]
    return merged


def save_config(cfg):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def _load_input_image(image, outdir):
    if not image:
        return None
    try:
        if isinstance(image, str) and image.startswith('data:'):
            b64 = image.split(',', 1)[1]
            img = Image.open(BytesIO(base64.b64decode(b64)))
        else:
            p = os.path.join(outdir, os.path.basename(str(image)))
            img = Image.open(p)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        w = max(64, img.width - (img.width % 8))
        h = max(64, img.height - (img.height % 8))
        if (w, h) != (img.width, img.height):
            img = img.resize((w, h), Image.LANCZOS)
        return img
    except Exception:
        return None


def _clamp_dim(v, default):
    try:
        v = int(v)
    except Exception:
        v = default
    v = max(256, min(1024, v))
    return v - (v % 8)


def _upscale(src, scale, model_path):
    import torch
    from torch import nn
    from torch.nn import functional as F
    import numpy as np

    class _RDB5C(nn.Module):
        def __init__(self, num_feat=64, num_grow_ch=32):
            super(_RDB5C, self).__init__()
            self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
            self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch, 3, 1, 1)
            self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch, 3, 1, 1)
            self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch, 3, 1, 1)
            self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

        def forward(self, x):
            x1 = self.lrelu(self.conv1(x))
            x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
            x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
            x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
            x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
            return x5 * 0.2 + x

    class _RRDB(nn.Module):
        def __init__(self, num_feat=64, num_grow_ch=32):
            super(_RRDB, self).__init__()
            self.rdb1 = _RDB5C(num_feat, num_grow_ch)
            self.rdb2 = _RDB5C(num_feat, num_grow_ch)
            self.rdb3 = _RDB5C(num_feat, num_grow_ch)

        def forward(self, x):
            return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x

    class _RRDBNet(nn.Module):
        def __init__(self, num_in_ch=3, num_out_ch=3, scale=4, num_feat=64, num_block=23, num_grow_ch=32):
            super(_RRDBNet, self).__init__()
            self.scale = scale
            if scale == 2:
                num_in_ch *= 4
            elif scale == 1:
                num_in_ch *= 16
            self.conv_first = nn.Conv2d(num_in_ch, num_feat, 3, 1, 1)
            blocks = []
            for _ in range(num_block):
                blocks.append(_RRDB(num_feat, num_grow_ch))
            self.body = nn.Sequential(*blocks)
            self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

        def forward(self, x):
            if self.scale == 2:
                x = F.pixel_unshuffle(x, 2)
            elif self.scale == 1:
                x = F.pixel_unshuffle(x, 4)
            feat = self.conv_first(x)
            feat = feat + self.conv_body(self.body(feat))
            feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
            feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
            return self.conv_last(self.lrelu(self.conv_hr(feat)))

    sd = torch.load(model_path, map_location='cpu')
    if 'params_ema' in sd:
        sd = sd['params_ema']
    elif 'params' in sd:
        sd = sd['params']
    model = _RRDBNet(scale=scale)
    model.load_state_dict(sd, strict=True)
    model.eval()

    img = Image.open(src).convert('RGB')
    w, h = img.size
    if w * h > 1024 * 1024:
        ratio = (1024 * 1024 / float(w * h)) ** 0.5
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    x = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0).contiguous()
    with torch.no_grad():
        y = model(x).clamp_(0, 1)
    out = (y.squeeze(0).permute(1, 2, 0).numpy() * 255.0).round().astype(np.uint8)
    dst = src.rsplit('.', 1)[0] + '_x%d.png' % scale
    Image.fromarray(out).save(dst)
    return dst


class _JobCancelled(Exception):
    pass


def _run_job(job):
    jid = job['id']
    try:
        cfg = load_config()
        model_dir = cfg.get('model_dir') or DEFAULT_MODEL_DIR
        outdir = cfg.get('output_dir') or DEFAULT_OUTPUT_DIR
        os.makedirs(outdir, exist_ok=True)
        model_path = resolve_model(model_dir, job.get('model'))
        if not model_path:
            raise ValueError('未找到可用的主模型，请检查模型目录')
        lora = job.get('lora') or ''
        lora_path = os.path.join(model_dir, lora) if lora else None

        job['status'] = 'loading'
        pipe = get_pipe(model_path, lora_path, model_dir, cfg)

        job['status'] = 'running'
        job['progress'] = 0
        steps = max(1, int(job.get('steps') or cfg.get('default_steps') or 20))
        steps = min(60, steps)

        def cb(step, t, latents):
            if job.get('_cancel'):
                raise _JobCancelled()
            job['progress'] = int(step / max(1, t) * 100)
            return True

        seed = -1
        try:
            seed = int(job.get('seed') or -1)
        except Exception:
            seed = -1
        generator = None
        if seed >= 0:
            import torch
            generator = torch.Generator().manual_seed(seed)

        neg = (job.get('negative_prompt') or '').strip()
        if cfg.get('easy_negative', True) and job.get('use_easy_negative', True):
            neg = (neg + ', EasyNegative') if neg else 'EasyNegative'

        kwargs = dict(
            prompt=job.get('prompt') or '',
            negative_prompt=neg or None,
            width=_clamp_dim(job.get('width'), cfg.get('default_width') or 512),
            height=_clamp_dim(job.get('height'), cfg.get('default_height') or 512),
            num_inference_steps=steps,
            guidance_scale=float(job.get('cfg') or cfg.get('default_cfg') or 7),
            num_images_per_prompt=max(1, min(4, int(job.get('count') or 1))),
            generator=generator,
            callback=cb,
            callback_steps=1,
        )

        if job.get('mode') == 'img2img':
            img = _load_input_image(job.get('image'), outdir)
            if img is None:
                raise ValueError('无法解析输入图片')
            pipe2 = get_img2img(pipe)
            kwargs.update(image=img, strength=max(0.05, min(0.95, float(job.get('strength') or 0.6))))
            result = pipe2(**kwargs)
        else:
            result = pipe(**kwargs)

        if job.get('_cancel'):
            job['status'] = 'cancelled'
            return
        images = result.images
        urls = []
        upscale = job.get('upscale') or cfg.get('upscale_default') or 'none'
        for i, img in enumerate(images):
            rel = '%s_%d.png' % (jid, i)
            img.save(os.path.join(outdir, rel))
            url = '/api/plugins/aigen/output/' + rel
            if upscale in ('x2', 'x4'):
                scale = int(upscale[1])
                model_file = ESRGAN_X2 if scale == 2 else ESRGAN_X4
                model_path_u = os.path.join(model_dir, model_file)
                if os.path.isfile(model_path_u):
                    try:
                        up_path = _upscale(os.path.join(outdir, rel), scale, model_path_u)
                        url = '/api/plugins/aigen/output/' + os.path.basename(up_path)
                    except Exception:
                        pass
            urls.append(url)
        job['images'] = urls
        job['progress'] = 100
        job['status'] = 'done'
    except _JobCancelled:
        job['status'] = 'cancelled'
    except Exception as e:
        import traceback
        traceback.print_exc()
        job['status'] = 'error'
        job['error'] = str(e)


# ---- sd_common 内联(旧面板 plugins/sd_common.py 原样, 与插件解耦) ----
os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')


def sd15_single_file_config():
    if os.path.isfile(os.path.join(SD15_CONFIG_DIR, 'model_index.json')):
        return SD15_CONFIG_DIR
    return None


def safetensors_kind(path):
    try:
        with open(path, 'rb') as f:
            head = f.read(8)
            if len(head) < 8:
                return 'unknown'
            ln = struct.unpack('<Q', head)[0]
            if ln > 50_000_000:
                return 'unknown'
            hdr = json.loads(f.read(ln).decode('utf-8', 'replace'))
        names = [k for k in hdr.keys() if k != '__metadata__']
        if not names:
            return 'unknown'
        if any(k.startswith('lora_') for k in names):
            return 'lora'
        if any(k.startswith(('model.diffusion_model', 'cond_stage_model', 'first_stage_model')) for k in names):
            return 'checkpoint'
        if len(names) == 1:
            return 'embedding'
        return 'unknown'
    except Exception:
        return 'unknown'


def list_models(model_dir=None):
    model_dir = model_dir or DEFAULT_MODEL_DIR
    models = []
    loras = []
    aux = {'easy_negative': False, 'vae': False, 'esrgan_x2': False, 'esrgan_x4': False}
    if os.path.isdir(model_dir):
        for name in sorted(os.listdir(model_dir)):
            p = os.path.join(model_dir, name)
            if os.path.isdir(p) and os.path.isfile(os.path.join(p, 'model_index.json')) \
                    and os.path.abspath(p) != os.path.abspath(SD15_CONFIG_DIR):
                models.append({'name': name, 'type': 'diffusers'})
            elif name.endswith('.safetensors'):
                kind = safetensors_kind(p)
                if kind == 'checkpoint':
                    models.append({'name': name, 'type': 'single_file'})
                elif kind == 'lora':
                    loras.append(name)
    aux['easy_negative'] = os.path.isfile(os.path.join(model_dir, EASY_FILE))
    aux['vae'] = os.path.isfile(os.path.join(model_dir, VAE_FILE))
    aux['esrgan_x2'] = os.path.isfile(os.path.join(model_dir, 'RealESRGAN_x2.pth'))
    aux['esrgan_x4'] = os.path.isfile(os.path.join(model_dir, 'RealESRGAN_x4.pth'))
    return {'models': models, 'loras': loras, 'aux': aux}


def resolve_model(model_dir, model):
    if not model:
        listing = list_models(model_dir)
        for m in listing['models']:
            if m['type'] == 'single_file':
                return os.path.join(model_dir, m['name'])
        for m in listing['models']:
            if m['type'] == 'diffusers':
                return os.path.join(model_dir, m['name'])
        return None
    p = os.path.join(model_dir, model)
    if os.path.isdir(p) and os.path.isfile(os.path.join(p, 'model_index.json')):
        return p
    if os.path.isfile(p):
        return p
    return None


_pipe_state = {'pipe': None, 'model': None, 'lora': None, 'model_dir': None,
               'easy': None, 'vae': None, 'img2img': None}


def get_pipe(model_path, lora_path, model_dir, cfg):
    st = _pipe_state
    easy = bool(cfg.get('easy_negative', True))
    fix_vae = bool(cfg.get('fix_vae', True))
    if (st['pipe'] is not None and st['model'] == model_path and st['lora'] == lora_path
            and st['model_dir'] == model_dir and st['easy'] == easy and st['vae'] == fix_vae):
        return st['pipe']
    import torch
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler, AutoencoderKL
    torch.set_num_threads(2)
    is_dir_model = os.path.isdir(model_path)
    vae = None
    if fix_vae and not is_dir_model:
        vae_path = os.path.join(model_dir, VAE_FILE)
        if os.path.isfile(vae_path):
            try:
                vae = AutoencoderKL.from_single_file(
                    vae_path, config=os.path.join(SD15_CONFIG_DIR, 'vae/config.json'),
                    torch_dtype=torch.float32)
            except Exception:
                vae = None
    pipe_kwargs = dict(
        torch_dtype=torch.float32, safety_checker=None, requires_safety_checker=False)
    if vae is not None:
        pipe_kwargs['vae'] = vae
    if is_dir_model:
        pipe = StableDiffusionPipeline.from_pretrained(model_path, **pipe_kwargs)
    else:
        pipe = StableDiffusionPipeline.from_single_file(
            model_path, config=sd15_single_file_config(), **pipe_kwargs)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    if easy:
        en_path = os.path.join(model_dir, EASY_FILE)
        if os.path.isfile(en_path):
            try:
                pipe.load_textual_inversion(en_path)
            except Exception:
                pass
    if lora_path and os.path.isfile(lora_path):
        try:
            sd, alphas, md = pipe.lora_state_dict(
                lora_path, weight_name=os.path.basename(lora_path), return_lora_metadata=True)
            sd = {k.replace('text_encoder.text_model.', 'text_encoder.'): v for k, v in sd.items()}
            if alphas:
                alphas = {k.replace('text_encoder.text_model.', 'text_encoder.'): v for k, v in alphas.items()}
            pipe.load_lora_into_unet(sd, network_alphas=alphas, unet=pipe.unet,
                                     adapter_name='default', metadata=md, _pipeline=pipe)
            pipe.load_lora_into_text_encoder(sd, network_alphas=alphas, text_encoder=pipe.text_encoder,
                                             lora_scale=1.0, adapter_name='default', metadata=md, _pipeline=pipe)
        except Exception:
            pass
    st.update(pipe=pipe, model=model_path, lora=lora_path, model_dir=model_dir,
              easy=easy, vae=fix_vae, img2img=None)
    return pipe


def get_img2img(pipe):
    st = _pipe_state
    if st['img2img'] is None:
        from diffusers import StableDiffusionImg2ImgPipeline
        st['img2img'] = StableDiffusionImg2ImgPipeline(
            vae=pipe.vae, text_encoder=pipe.text_encoder, tokenizer=pipe.tokenizer,
            unet=pipe.unet, scheduler=pipe.scheduler, safety_checker=None,
            feature_extractor=None, requires_safety_checker=False)
    return st['img2img']


def pipe_loaded_model():
    return _pipe_state['model']


def pipe_state():
    return _pipe_state


class JobManager:
    """Generic async job queue with progress polling."""

    def __init__(self):
        self._lock = threading.Lock()
        self._queue = []
        self._jobs = {}
        self._current = None
        self._worker = None

    def _ensure_worker_locked(self):
        if self._worker is None or not self._worker.is_alive():
            self._worker = threading.Thread(target=self._worker_loop, daemon=True)
            self._worker.start()

    def enqueue(self, job):
        with self._lock:
            self._jobs[job['id']] = job
            self._queue.append(job)
            self._ensure_worker_locked()
        return job['id']

    def get(self, jid):
        with self._lock:
            j = self._jobs.get(jid)
            return dict(j) if j else None

    def cancel(self, jid):
        with self._lock:
            j = self._jobs.get(jid)
            if not j:
                return None
            if j['status'] in ('queued', 'loading'):
                j['status'] = 'cancelled'
                return 'cancelled'
            if j['status'] == 'running':
                j['_cancel'] = True
                return 'cancelling'
            return j['status']

    def _worker_loop(self):
        while True:
            with self._lock:
                if not self._queue:
                    self._current = None
                    break
                job = self._queue.pop(0)
                self._current = job
            try:
                if job['status'] == 'cancelled':
                    continue
                self._run(job)
            finally:
                with self._lock:
                    self._current = None

    def _run(self, job):
        raise NotImplementedError


def new_job_id():
    return datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))


class _GenManager(JobManager):
    def _run(self, job):
        _run_job(job)


_manager = _GenManager()


# ---- 旧 Plugin 基类方法迁移为模块级函数(设置页可插拔接口) ----
def storage_provider():
    cfg = load_config()
    return {
        'name': 'aigen',
        'label': 'AI 生图输出目录',
        'paths': cfg.get('storage_paths', [DEFAULT_OUTPUT_DIR]),
        'active_path': cfg.get('active_path'),
        'auto_switch_full': False,
        'full_threshold_mb': 0,
    }


def get_setting_schema():
    return [
        {'key': 'storage_paths', 'label': 'AI 生图输出目录', 'type': 'paths'},
    ]


def get_settings():
    cfg = load_config()
    return {'storage_paths': path_stats(cfg.get('storage_paths', [DEFAULT_OUTPUT_DIR])),
            'active_path': cfg.get('active_path')}


def save_settings(data):
    cfg = load_config()
    if 'storage_paths' in data:
        paths = [p for p in data['storage_paths'] if isinstance(p, str) and p.strip()]
        outdir = cfg.get('output_dir') or DEFAULT_OUTPUT_DIR
        if outdir and outdir not in paths:
            paths.insert(0, outdir)
        cfg['storage_paths'] = paths
        if data.get('active_path') not in paths:
            cfg['active_path'] = paths[0]
        else:
            cfg['active_path'] = data['active_path']
    save_config(cfg)
    return True, 'ok'


def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


def _guess_mime(filename):
    ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
    return {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'webp': 'image/webp', 'gif': 'image/gif',
    }.get(ext, 'image/png')


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "aigen/2.0"

    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _file(self, path, ctype):
        try:
            with open(path, 'rb') as f:
                data = f.read()
        except Exception:
            self._json(404, {'error': '文件不存在'})
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def _q(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    # ---- 路由: GET /ping ----
    def _rt_ping(self):
        cfg = load_config()
        model_dir = cfg.get('model_dir') or DEFAULT_MODEL_DIR
        listing = list_models(model_dir)
        st = pipe_state()
        return 200, {
            'ok': bool(listing['models']),
            'models': listing,
            'pipe_loaded': st['pipe'] is not None,
            'current_model': st['model'],
            'output_dir': cfg.get('output_dir'),
            'config': cfg,
        }

    # ---- 路由: GET /models ----
    def _rt_models(self):
        model_dir = load_config().get('model_dir') or DEFAULT_MODEL_DIR
        return 200, list_models(model_dir)

    # ---- 路由: POST /generate ----
    def _rt_generate(self, body):
        data = body or {}
        prompt = (data.get('prompt') or '').strip()
        if not prompt:
            return 400, {'error': '请输入提示词'}
        jid = datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))
        job = {
            'id': jid, 'mode': 'text2img', 'status': 'queued', 'progress': 0,
            'created': time.time(), 'prompt': prompt,
            'negative_prompt': data.get('negative_prompt'),
            'width': data.get('width'), 'height': data.get('height'),
            'steps': data.get('steps'), 'cfg': data.get('cfg'),
            'seed': data.get('seed', -1), 'count': data.get('count', 1),
            'lora': data.get('lora'), 'model': data.get('model'),
            'upscale': data.get('upscale'),
            'use_easy_negative': data.get('use_easy_negative', True),
        }
        _manager.enqueue(job)
        return 200, {'job_id': jid, 'status': 'queued'}

    # ---- 路由: POST /img2img ----
    def _rt_img2img(self, body):
        data = body or {}
        prompt = (data.get('prompt') or '').strip()
        if not prompt:
            return 400, {'error': '请输入提示词'}
        if not data.get('image'):
            return 400, {'error': '请上传输入图片'}
        jid = datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))
        job = {
            'id': jid, 'mode': 'img2img', 'status': 'queued', 'progress': 0,
            'created': time.time(), 'prompt': prompt,
            'image': data.get('image'), 'strength': data.get('strength', 0.6),
            'negative_prompt': data.get('negative_prompt'),
            'width': data.get('width'), 'height': data.get('height'),
            'steps': data.get('steps'), 'cfg': data.get('cfg'),
            'seed': data.get('seed', -1), 'count': data.get('count', 1),
            'lora': data.get('lora'), 'model': data.get('model'),
            'upscale': data.get('upscale'),
            'use_easy_negative': data.get('use_easy_negative', True),
        }
        _manager.enqueue(job)
        return 200, {'job_id': jid, 'status': 'queued'}

    # ---- 路由: GET /status/<jid> ----
    def _rt_status(self, jid):
        if not jid:
            return 400, {'error': '缺少任务ID'}
        j = _manager.get(jid)
        if not j:
            return 404, {'error': '任务不存在'}
        return 200, {k: j.get(k) for k in (
            'id', 'status', 'progress', 'images', 'error', 'mode', 'created')}

    # ---- 路由: POST /cancel/<jid> ----
    def _rt_cancel(self, jid):
        if not jid:
            return 400, {'error': '缺少任务ID'}
        r = _manager.cancel(jid)
        if r is None:
            return 404, {'error': '任务不存在'}
        if r == 'cancelled':
            return 200, {'message': '已取消', 'status': 'cancelled'}
        if r == 'cancelling':
            return 200, {'message': '正在取消…', 'status': 'cancelling'}
        return 200, {'message': '任务已结束，无法取消', 'status': r}

    # ---- 路由: GET /output/<filename> ----
    def _rt_output(self, tail):
        fn = os.path.basename(tail)
        outdir = load_config().get('output_dir') or DEFAULT_OUTPUT_DIR
        if not fn or not os.path.isfile(os.path.join(outdir, fn)):
            return 404, {'error': '文件不存在'}
        p = os.path.join(outdir, fn)
        self._file(p, _guess_mime(fn))
        return None

    # ---- 路由: GET /gallery ----
    def _rt_gallery(self, q):
        outdir = load_config().get('output_dir') or DEFAULT_OUTPUT_DIR
        limit, offset = 120, 0
        try:
            limit = max(1, min(500, int(q.get('limit', 120))))
            offset = max(0, int(q.get('offset', 0)))
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
                items.append({
                    'name': n,
                    'size': st.st_size,
                    'mtime': int(st.st_mtime),
                    'url': '/api/plugins/aigen/output/' + n,
                })
            except Exception:
                continue
        items.sort(key=lambda x: x['mtime'], reverse=True)
        total = len(items)
        items = items[offset:offset + limit]
        return 200, {'items': items, 'total': total, 'limit': limit, 'offset': offset}

    # ---- 路由: DELETE /gallery/<name> ----
    def _rt_gallery_delete(self, tail):
        name = os.path.basename(tail)
        outdir = load_config().get('output_dir') or DEFAULT_OUTPUT_DIR
        base = os.path.abspath(outdir)
        if not name:
            return 400, {'error': '缺少文件名'}
        p = os.path.join(base, name)
        if not os.path.isfile(p) or not os.path.abspath(p).startswith(base + os.sep):
            return 404, {'error': '文件不存在'}
        try:
            os.remove(p)
            return 200, {'ok': True, 'name': name}
        except Exception as e:
            return 500, {'error': str(e)}

    # ---- 路由: GET/POST /config ----
    def _rt_config(self, body, is_post):
        if is_post:
            new_cfg = body or {}
            cfg = load_config()
            if 'storage_paths' in new_cfg:
                paths = [p for p in new_cfg['storage_paths']
                         if isinstance(p, str) and p.strip()]
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
            save_config(cfg)
            return 200, {'message': '设置已保存', 'config': load_config()}
        return 200, load_config()

    # ---- 路由: GET /info (新体系插件元数据) ----
    def _rt_info(self):
        return 200, {'name': 'aigen', 'label': 'AI 生图', 'version': '2.0.0',
                     'lang': 'python',
                     'description': '本地 SD1.5 文生图/图生图，支持 EasyNegative、VAE 修复、Real-ESRGAN 超分'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            q = self._q()
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/ping":
                return self._json(*self._rt_ping())
            if p == "/models":
                return self._json(*self._rt_models())
            if p.startswith("/status/"):
                return self._json(*self._rt_status(_tail('/status/', p)))
            if p.startswith("/output/"):
                r = self._rt_output(_tail('/output/', p))
                if r:
                    return self._json(*r)
                return
            if p == "/gallery":
                return self._json(*self._rt_gallery(q))
            if p == "/config":
                return self._json(*self._rt_config({}, False))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            try:
                body = json.loads(self._body() or b'{}')
            except Exception:
                body = {}
            if p == "/generate":
                return self._json(*self._rt_generate(body))
            if p == "/img2img":
                return self._json(*self._rt_img2img(body))
            if p.startswith("/cancel/"):
                return self._json(*self._rt_cancel(_tail('/cancel/', p)))
            if p == "/config":
                return self._json(*self._rt_config(body, True))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_DELETE(self):
        try:
            p = self.path.split('?')[0]
            if p.startswith("/gallery/"):
                return self._json(*self._rt_gallery_delete(_tail('/gallery/', p)))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    os.makedirs(DEFAULT_OUTPUT_DIR, exist_ok=True)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("aigen ready on %d models=%s" % (PORT, list_models(load_config().get('model_dir') or DEFAULT_MODEL_DIR)),
          file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()