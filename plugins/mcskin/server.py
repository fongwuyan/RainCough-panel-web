#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mcskin 插件子进程 — 完整复用旧插件后端(plugin.py 全量迁移)。

将旧面板 plugins.sd_common / plugins.llm_common / plugins.yulotool_common
/ plugins.mcskin.skin_render 中本插件用到的函数与类一并内联,使子进程完全独立:
- sd_common: JobManager/get_pipe/get_img2img/resolve_model/list_models/new_job_id
- llm_common: llm_generate/extract_json/enqueue_llm/... (threading 驱动, 与旧一致)
- yulotool_common: new_session(落插件目录 work/); save_uploads 改为 multipart 本地解析
- skin_render: render_skin 原样内联

multipart 上传由 Handler._multipart() 解析(替代 Flask request.files)。
数据: 插件目录下 cache/ work/ history.json, 与旧插件一致。
路由契约与旧面板 api.js 完全一致(detect/convert/paint/paint/models/paint/status/
paint/cancel/text2skin/text2skin/models/text2skin/styles/text2skin/status/
text2skin/regenerate/text2skin/history/text2skin/feedback)。
"""
import os
import io
import re
import json
import time
import uuid
import struct
import random
import hashlib
import shutil
import base64
import threading
import http.server
import numpy as np
from PIL import Image, ImageEnhance

try:
    from torch import inference_mode as _no_grad_ctx
except Exception:
    _no_grad_ctx = None

try:
    import cv2
    HAVE_CV2 = True
except Exception:
    HAVE_CV2 = False


PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())
CACHE_DIR = os.path.join(PLUGIN_DIR, 'cache')

TEX = 64

DEFAULT_P = {
    'center_x': 50.0,
    'head_top': 5.0, 'head_bot': 17.0, 'body_bot': 55.0, 'leg_bot': 92.0,
    'head_half_w': 25.0, 'body_half_w': 36.0, 'arm_half_w': 9.0,
    'arm_w': 8.0, 'leg_w': 17.0,
    'lighting': 40.0,
    'overlay_alpha': 160.0,
    'bg_removal': True,
}


# ---- 会话/work 目录(旧 yulotool_common.new_session, 落插件目录) ----
def work_dir():
    d = os.path.join(PLUGIN_DIR, 'work')
    os.makedirs(d, exist_ok=True)
    return d


def new_session():
    d = os.path.join(work_dir(), uuid.uuid4().hex)
    os.makedirs(d, exist_ok=True)
    return d


# ---- SD 公共(sd_common 内联) ----
DEFAULT_MODEL_DIR = os.environ.get("RAINCOUGH_MODEL_DIR") or os.path.join(PLUGIN_DIR, 'models')
VAE_FILE = 'vae-ft-mse-840000-ema-pruned.safetensors'
EASY_FILE = 'EasyNegative.safetensors'
SD15_CONFIG_DIR = os.path.join(DEFAULT_MODEL_DIR, 'sd15-config')


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
    from datetime import datetime
    return datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))


# ---- LLM 公共(llm_common 内联) ----
DEFAULT_LLM_DIR = os.environ.get("RAINCOUGH_LLM_DIR") or os.path.join(PLUGIN_DIR, 'llm')
DEFAULT_MODEL_NAME = 'Qwen2.5-1.5B-Instruct'

_llm_state = {'model': None, 'pipe': None, 'tokenizer': None}
_llm_lock = threading.Lock()
_llm_gen_lock = threading.Lock()

_llm_jobs = {}
_llm_queue = []
_llm_current = None
_llm_worker = None
_llm_runner = None


def set_llm_runner(fn):
    global _llm_runner
    _llm_runner = fn


def list_llm_models():
    models = []
    if os.path.isdir(DEFAULT_LLM_DIR):
        for name in sorted(os.listdir(DEFAULT_LLM_DIR)):
            p = os.path.join(DEFAULT_LLM_DIR, name)
            if os.path.isdir(p) and os.path.isfile(os.path.join(p, 'config.json')):
                models.append({'name': name, 'type': 'llm'})
    if not models:
        models.append({'name': DEFAULT_MODEL_NAME, 'type': 'llm'})
    return {'models': models}


def llm_state():
    return {k: ('<loaded>' if (isinstance(v, str) and v) else None)
            for k, v in _llm_state.items()}


def _load_llm(model_name=None):
    model_name = model_name or DEFAULT_MODEL_NAME
    model_dir = os.path.join(DEFAULT_LLM_DIR, model_name)
    if not os.path.isdir(model_dir):
        model_dir = DEFAULT_LLM_DIR
    st = _llm_state
    if st['pipe'] is not None and st['model'] == model_dir:
        return st['pipe'], st['tokenizer']
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    torch.set_num_threads(4)
    tok = AutoTokenizer.from_pretrained(model_dir, trust_remote_code=True)
    try:
        model = AutoModelForCausalLM.from_pretrained(
            model_dir, torch_dtype=torch.float32, trust_remote_code=True,
            low_cpu_mem_usage=True)
    except TypeError:
        model = AutoModelForCausalLM.from_pretrained(
            model_dir, dtype=torch.float32, trust_remote_code=True,
            low_cpu_mem_usage=True)
    model.eval()
    st.update(pipe=model, tokenizer=tok, model=model_dir)
    return model, tok


def llm_generate(system_prompt, user_prompt, max_new_tokens=1200, temperature=0.7):
    with _llm_gen_lock:
        import torch
        model, tok = _load_llm()
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ]
        text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tok(text, return_tensors='pt')
        with torch.inference_mode():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                top_p=0.9,
                do_sample=True,
                pad_token_id=tok.pad_token_id or tok.eos_token_id,
            )
        out = tok.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
        return out.strip()


def extract_json(text):
    if not text:
        return None
    m = re.search(r'\{[\s\S]*\}', text)
    if not m:
        return None
    cand = m.group(0)
    try:
        return json.loads(cand)
    except Exception:
        pass
    for start in range(len(text)):
        if text[start] == '{':
            depth = 0
            for i in range(start, len(text)):
                if text[i] == '{':
                    depth += 1
                elif text[i] == '}':
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i + 1])
                        except Exception:
                            break
    return None


def _ensure_llm_worker_locked():
    global _llm_worker
    if _llm_worker is None or not _llm_worker.is_alive():
        _llm_worker = threading.Thread(target=_llm_worker_loop, daemon=True)
        _llm_worker.start()


def _llm_worker_loop():
    global _llm_current
    while True:
        with _llm_lock:
            if not _llm_queue:
                _llm_current = None
                break
            job = _llm_queue.pop(0)
            _llm_current = job
        try:
            if job['status'] == 'cancelled':
                continue
            if _llm_runner:
                _llm_runner(job)
            else:
                job['status'] = 'error'
                job['error'] = 'LLM runner 未注册'
        except Exception as e:
            import traceback
            traceback.print_exc()
            job['status'] = 'error'
            job['error'] = str(e)
        finally:
            with _llm_lock:
                _llm_current = None


def enqueue_llm(job):
    with _llm_lock:
        _llm_jobs[job['id']] = job
        _llm_queue.append(job)
        _ensure_llm_worker_locked()
    return job['id']


def get_llm_job(jid):
    with _llm_lock:
        j = _llm_jobs.get(jid)
        return dict(j) if j else None


def cancel_llm_job(jid):
    with _llm_lock:
        j = _llm_jobs.get(jid)
        if not j:
            return None
        if j['status'] in ('queued', 'loading'):
            j['status'] = 'cancelled'
            return 'cancelled'
        if j['status'] == 'running':
            j['_cancel'] = True
            return 'cancelling'
        return j['status']


def new_llm_job_id():
    from datetime import datetime
    return datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))


# ---- skin_render 内联(与旧 plugins.mcskin.skin_render 一致) ----
HEX_RE = None


def _hex(c):
    if not isinstance(c, str):
        c = '#888888'
    c = c.strip().lstrip('#')
    if len(c) == 3:
        c = ''.join(ch * 2 for ch in c)
    if len(c) != 6:
        c = '888888'
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    except Exception:
        return (136, 136, 136, 255)


def _shade(rgb, f):
    return tuple(max(0, min(255, int(v * f))) for v in rgb[:3]) + (255,)


def _box_uvs(u, v, w, h, d):
    """Same UV layout as mcskin plugin: standard 64x64 (legacy + overlay rows)."""
    return {
        'top': (u + d, v, w, d),
        'bottom': (u + w + d, v, w, d),
        'left': (u, v + d, d, h),
        'front': (u + d, v + d, w, h),
        'right': (u + w + d, v + d, d, h),
        'back': (u + w + d * 2, v + d, w, h),
    }


def _fill(img, uv, color, pattern=None, accent=None):
    x, y, w, h = uv
    if pattern is None:
        pattern = 'solid'
    base = _hex(color)
    acc = _hex(accent) if accent else _shade(base, 1.2)
    px = img.load()
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            c = base
            if pattern == 'stripe_v':
                c = acc if ((xx - x) % 2 == 0) else base
            elif pattern == 'stripe_h':
                c = acc if ((yy - y) % 2 == 0) else base
            elif pattern == 'grid':
                c = acc if (((xx - x) % 2 == 0) or ((yy - y) % 2 == 0)) else base
            elif pattern == 'jacket':
                c = acc if (yy - y) >= max(1, h - 2) else base
            elif pattern == 'collar':
                if (yy - y) < 2 and (xx - x) in (w // 2 - 1, w // 2):
                    c = _hex('#FFFFFF') if not accent else acc
            px[xx, yy] = c


def _draw_face(img, head_front_uv, eye_color='#1A1A1A', mouth=True):
    """Pixel eyes + optional mouth on the 8x8 head front face."""
    x, y, w, h = head_front_uv
    eye = _hex(eye_color)
    px = img.load()
    # classic 8x8 face: eyes at rows 3-4, cols 1 and 5
    for ex in (x + 1, x + 2):
        for ey in (y + 3, y + 4):
            px[ex, ey] = eye
    for ex in (x + 5, x + 6):
        for ey in (y + 3, y + 4):
            px[ex, ey] = eye
    if mouth:
        for mx in (x + 3, x + 4):
            px[mx, y + 6] = eye


def _hair_top(img, head_top_uv, hair_color):
    x, y, w, h = head_top_uv
    c = _hex(hair_color)
    px = img.load()
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            px[xx, yy] = c


def render_skin(spec, model='wide'):
    """Render a 64x64 RGBA skin from an LLM spec dict."""
    if not isinstance(spec, dict):
        spec = {}
    pal = spec.get('palette') or {}
    head = spec.get('head') or {}
    torso = spec.get('torso') or {}
    arms = spec.get('arms') or {}
    legs = spec.get('legs') or {}

    img = Image.new('RGBA', (TEX, TEX), (0, 0, 0, 0))

    aw = 3 if model == 'slim' else 4

    head_uv = _box_uvs(0, 0, 8, 8, 8)
    head2_uv = _box_uvs(32, 0, 8, 8, 8)
    rleg_uv = _box_uvs(0, 16, 4, 12, 4)
    rleg2_uv = _box_uvs(0, 32, 4, 12, 4)
    body_uv = _box_uvs(16, 16, 8, 12, 4)
    body2_uv = _box_uvs(16, 32, 8, 12, 4)
    rarm_uv = _box_uvs(40, 16, aw, 12, 4)
    rarm2_uv = _box_uvs(40, 32, aw, 12, 4)
    larm_uv = _box_uvs(32, 48, aw, 12, 4)
    larm2_uv = _box_uvs(48, 48, aw, 12, 4)
    lleg_uv = _box_uvs(16, 48, 4, 12, 4)
    lleg2_uv = _box_uvs(0, 48, 4, 12, 4)

    skin_c = pal.get('skin', '#E8B98A')
    hair_c = pal.get('hair', '#4A3620')
    shirt_c = pal.get('shirt', '#3366CC')
    sleeve_c = pal.get('sleeve', shirt_c)
    pants_c = pal.get('pants', '#223366')
    shoes_c = pal.get('shoes', '#222222')
    accent_c = pal.get('accent', '#FFFFFF')
    eye_c = pal.get('eye', '#1A1A1A')

    # head base
    for face, uv in head_uv.items():
        _fill(img, uv, skin_c, 'solid')
    # hair style
    hstyle = (head.get('hair_style') or 'full').lower()
    if hstyle in ('full', 'fringe', 'spiky'):
        _hair_top(img, head_uv['top'], hair_c)
        if hstyle == 'full':
            for face in ('back', 'left', 'right'):
                _fill(img, head_uv[face], hair_c, 'solid')
        elif hstyle == 'fringe':
            x, y, w, h = head_uv['back']
            _fill(img, (x, y, w, 3), hair_c, 'solid')
        elif hstyle == 'spiky':
            _hair_top(img, head_uv['top'], hair_c)
            for face in ('back', 'left', 'right'):
                _fill(img, head_uv[face], hair_c, 'solid')
    if hstyle in ('fringe',):
        # fringe overlay on front top
        x, y, w, h = head_uv['front']
        _fill(img, (x, y, w, 2), hair_c, 'solid')
    # face
    fstyle = (head.get('face') or 'default').lower()
    _draw_face(img, head_uv['front'], eye_c, mouth=(fstyle != 'serious'))

    # torso
    tpat = (torso.get('pattern') or 'solid').lower()
    tacc = torso.get('accent') or accent_c
    for face, uv in body_uv.items():
        if face == 'front' and tpat == 'collar':
            _fill(img, uv, shirt_c, 'collar', tacc)
        else:
            _fill(img, uv, shirt_c, tpat, tacc)
    if torso.get('belt'):
        for uv in (body_uv['front'], body_uv['back']):
            x, y, w, h = uv
            _fill(img, (x, y + h - 2, w, 1), pal.get('belt', '#111111') or '#111111', 'solid')

    # arms
    apat = (arms.get('pattern') or 'solid').lower()
    arm_c = sleeve_c if arms.get('sleeve') else skin_c
    aacc = arms.get('accent') or accent_c
    for uv in (rarm_uv, rarm2_uv, larm_uv, larm2_uv):
        for face, fuv in uv.items():
            _fill(img, fuv, arm_c, apat, aacc)

    # legs
    lpat = (legs.get('pattern') or 'solid').lower()
    lacc = legs.get('accent') or accent_c
    for uv in (rleg_uv, rleg2_uv, lleg_uv, lleg2_uv):
        for face, fuv in uv.items():
            _fill(img, fuv, pants_c, lpat, lacc)
        if legs.get('shoes'):
            x, y, w, h = uv['front']
            _fill(img, (x, y + h - 2, w, 2), shoes_c, 'solid')
            x, y, w, h = uv['back']
            _fill(img, (x, y + h - 2, w, 2), shoes_c, 'solid')

    # simple ambient shading on sides/tops for depth
    img = _apply_shading(img, head_uv, body_uv, rarm_uv, rleg_uv)

    return img


def _apply_shading(img, head_uv, body_uv, rarm_uv, rleg_uv):
    """Light top, dark bottom/side for subtle depth (like legacy shading)."""
    arr = np.array(img).astype(np.float32)
    a = arr[..., 3]
    shade = np.ones_like(a)
    for uv in (head_uv, body_uv, rarm_uv, rleg_uv):
        x, y, w, h = uv['top']
        shade[y:y + h, x:x + w] *= 1.12
        x, y, w, h = uv['bottom']
        shade[y:y + h, x:x + w] *= 0.82
        x, y, w, h = uv['left']
        shade[y:y + h, x:x + w] *= 0.95
        x, y, w, h = uv['back']
        shade[y:y + h, x:x + w] *= 0.9
    mask = (a > 0)[..., None]
    arr[..., :3] = np.clip(arr[..., :3] * shade[..., None], 0, 255)
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


# ---- 旧 plugin.py 全部模块级逻辑(原样) ----
def _has_real_alpha(src):
    """True if the image has meaningful transparency variation (not all 255)."""
    a = src.getchannel('A')
    hist = a.histogram()
    total = sum(hist)
    if total == 0:
        return False
    nopaque = sum(hist[:240])
    return nopaque / float(total) > 0.01


def _remove_bg(src):
    """Remove background when image has no usable alpha (opaque/white bg)."""
    if not HAVE_CV2:
        return src
    if _has_real_alpha(src):
        return src
    img = np.array(src.convert('RGB'))
    h, w = img.shape[:2]
    if w < 8 or h < 8:
        return src
    # downscale for speed if large
    scale = 1.0
    work = img
    if w * h > 900 * 900:
        scale = min(1.0, (900.0 / max(w, h)))
        work = cv2.resize(img, (int(w * scale), int(h * scale)))
    mask = np.zeros(work.shape[:2], np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    rw, rh = work.shape[1], work.shape[0]
    rect = (max(1, int(rw * 0.02)), max(1, int(rh * 0.02)),
            max(2, int(rw * 0.96)), max(2, int(rh * 0.96)))
    try:
        cv2.grabCut(work, mask, rect, bgd, fgd, 3, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        # flood-fill edges to kill border-ish background kept by grabcut
        fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        # re-open holes
        fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    except Exception:
        return src
    if scale != 1.0:
        fg = cv2.resize(fg, (w, h), interpolation=cv2.INTER_NEAREST)
    alpha = fg
    rgb = img
    out = np.dstack([rgb, alpha])
    return Image.fromarray(out, 'RGBA')


def _silhouette_rows(src):
    """Return per-row: (width, mid) for opaque pixels."""
    W, H = src.size
    a = src.getchannel('A')
    arr = np.asarray(a)
    step = max(1, H // 400)
    widths, mids = [], []
    for y in range(0, H, step):
        row = arr[y, :]
        cols = np.nonzero(row > 60)[0]
        if cols.size:
            widths.append(int(cols[-1] - cols[0]))
            mids.append(float((cols[0] + cols[-1]) / 2.0))
        else:
            widths.append(0)
            mids.append(W / 2.0)
    return widths, mids, step


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def _tight_box(src, box):
    x0, y0, x1, y1 = box
    crop = src.crop((x0, y0, x1, y1))
    bbox = crop.getchannel('A').getbbox()
    if bbox is None:
        return box
    ox, oy, ex, ey = bbox
    return (x0 + ox, y0 + oy, x0 + ex, y0 + ey)


def _crop_cover(src, box, tw, th):
    box = _tight_box(src, box)
    x0, y0, x1, y1 = box
    bw = max(1, x1 - x0)
    bh = max(1, y1 - y0)
    region = src.crop((x0, y0, x1, y1))
    scale = max(tw / bw, th / bh)
    nw = max(1, int(round(bw * scale)))
    nh = max(1, int(round(bh * scale)))
    region = region.resize((nw, nh), Image.LANCZOS)
    cx = (nw - tw) // 2
    cy = (nh - th) // 2
    return region.crop((cx, cy, cx + tw, cy + th))


def _bright(img, factor):
    return ImageEnhance.Brightness(img).enhance(factor)


def _alpha(img, factor):
    a = img.split()[3].point(lambda v: int(v * factor))
    r, g, b = img.split()[:3]
    return Image.merge('RGBA', (r, g, b, a))


def _regions(src, p):
    W, H = src.size
    cx = int(W * p['center_x'] / 100.0)
    hw = int(W * p['head_half_w'] / 200.0)
    bw = int(W * p['body_half_w'] / 200.0)
    aw = int(W * p['arm_w'] / 200.0) if p.get('arm_w') else int(W * p['arm_half_w'] / 200.0)
    lw = int(W * p['leg_w'] / 200.0) if p.get('leg_w') else int(bw * 3 // 5)
    head_box = (cx - hw, int(H * p['head_top'] / 100.0), cx + hw, int(H * p['head_bot'] / 100.0))
    ty0 = int(H * p['head_bot'] / 100.0)
    ty1 = int(H * p['body_bot'] / 100.0)
    torso_box = (cx - bw, ty0, cx + bw, ty1)
    arm_l_box = (cx - bw - aw, ty0, cx - bw, ty1)
    arm_r_box = (cx + bw, ty0, cx + bw + aw, ty1)
    ly0 = int(H * p['body_bot'] / 100.0)
    ly1 = int(H * p['leg_bot'] / 100.0)
    leg_l_box = (cx - lw, ly0, cx, ly1)
    leg_r_box = (cx, ly0, cx + lw, ly1)
    return {
        'head': head_box, 'torso': torso_box,
        'arm_l': arm_l_box, 'arm_r': arm_r_box,
        'leg_l': leg_l_box, 'leg_r': leg_r_box,
    }


def _auto_detect(src):
    W, H = src.size
    widths, mids, step = _silhouette_rows(src)
    maxw = max(widths) or 1
    # smooth
    k = max(1, len(widths) // 60)
    sm = []
    for i in range(len(widths)):
        lo, hi = max(0, i - k), min(len(widths), i + k + 1)
        sm.append(sum(widths[lo:hi]) / (hi - lo))
    # body bbox from alpha
    b = src.getchannel('A').getbbox()
    body_h = (b[3] - b[1]) if b else H
    body_cx = (b[0] + b[2]) / 2.0 if b else W / 2.0
    body_ymin = b[1] if b else 0
    body_ymax = b[3] if b else H
    # head: first row wide enough (>0.30*maxw) until shoulders (>0.62*maxw)
    head_top = int(H * 0.05)
    head_bot = head_top
    got_top = False
    for i, w in enumerate(sm):
        y = i * step
        if not got_top:
            if w > maxw * 0.30:
                head_top = y
                got_top = True
            continue
        if w > maxw * 0.62:
            head_bot = y
            break
        head_bot = y
    if head_bot - head_top < int(H * 0.04):
        head_bot = head_top + int(H * 0.12)
    # torso: from head_bot, first sustained narrowing below 0.58*maxw after +10%
    body_bot = int(H * 0.68)
    narrow_run = 0
    for i, w in enumerate(sm):
        y = i * step
        if y <= head_bot + int(H * 0.10):
            continue
        if w < maxw * 0.58:
            narrow_run += 1
        else:
            narrow_run = 0
        if narrow_run * step > int(H * 0.04):
            body_bot = y
            break
    # leg: last row with meaningful width
    leg_bot = int(H * 0.97)
    for i in range(len(sm) - 1, -1, -1):
        if sm[i] > maxw * 0.35:
            leg_bot = i * step
            break
    if b:
        leg_bot = min(leg_bot, b[3])
    bw = (b[2] - b[0]) / 2.0 if b else maxw / 2.0
    body_half_w = bw / W * 100.0

    # arm width: max of left/right protrusion vs torso within torso band
    arm_w = body_half_w * 0.26
    leg_w = body_half_w * 0.5
    if HAVE_CV2 and b:
        a = np.asarray(src.getchannel('A'))
        y0 = int(head_bot)
        y1 = int(body_bot)
        y0 = max(0, min(H - 1, y0))
        y1 = max(y0 + 1, min(H, y1))
        band = a[y0:y1, :]
        if band.shape[0] > 0 and band.shape[1] > 0:
            proj = (band > 60).sum(axis=0)
            cx = int(round(body_cx))
            lo = max(0, cx - int(bw))
            hi = min(W, cx + int(bw) + 1)
            max_in = proj[lo:hi].max() if hi > lo else 0
            l_out = proj[max(0, cx - int(bw * 1.8)):lo].max() if lo > 0 else 0
            r_out = proj[hi:min(W, cx + int(bw * 1.8))].max() if hi < W else 0
            out = max(l_out, r_out)
            if max_in > 0:
                arm_w = body_half_w * min(1.2, float(out) / max_in + 0.05)
    return {
        'center_x': _clamp(body_cx / W * 100.0, 20, 80),
        'head_top': _clamp(head_top / H * 100.0, 1, 40),
        'head_bot': _clamp(head_bot / H * 100.0, 8, 55),
        'body_bot': _clamp(body_bot / H * 100.0, 25, 85),
        'leg_bot': _clamp(leg_bot / H * 100.0, 55, 100),
        'head_half_w': _clamp(min(22.0, body_half_w * 0.45), 8, 30),
        'body_half_w': _clamp(body_half_w, 18, 45),
        'arm_half_w': _clamp(body_half_w * 0.26, 5, 14),
        'arm_w': _clamp(arm_w, 5, 22),
        'leg_w': _clamp(leg_w, 10, 30),
        '_body_h': _clamp(body_h / H * 100.0, 20, 100),
    }


def _build_skin(src, model, p=None):
    W, H = src.size
    slim = model == 'slim'
    p = p or dict(DEFAULT_P)
    regs = _regions(src, p)

    aw = 3 if slim else 4

    def split_h(box, k):
        x0, y0, x1, y1 = box
        mid = x0 + (x1 - x0) * k
        return (x0, y0, int(mid), y1), (int(mid), y0, x1, y1)

    def split_v(box, k):
        x0, y0, x1, y1 = box
        mid = y0 + (y1 - y0) * k
        return (x0, y0, x1, int(mid)), (x0, int(mid), x1, y1)

    def srcs_of(box):
        l, r = split_h(box, 0.5)
        t, b = split_v(box, 0.5)
        return {
            'front': box, 'back': box,
            'left': l, 'right': r,
            'top': t, 'bottom': b,
        }

    head_srcs = srcs_of(regs['head'])
    body_srcs = srcs_of(regs['torso'])
    arm_r_srcs = srcs_of(regs['arm_r'])
    arm_l_srcs = srcs_of(regs['arm_l'])
    leg_r_srcs = srcs_of(regs['leg_r'])
    leg_l_srcs = srcs_of(regs['leg_l'])

    # Standard 64x64 layout (matches skinview3d setSkinUVs)
    def box_uvs(u, v, w, h, d):
        return {
            'top': (u + d, v, w, d),
            'bottom': (u + w + d, v, w, d),
            'left': (u, v + d, d, h),
            'front': (u + d, v + d, w, h),
            'right': (u + w + d, v + d, d, h),
            'back': (u + w + d * 2, v + d, w, h),
        }

    head_uv = box_uvs(0, 0, 8, 8, 8)
    head2_uv = box_uvs(32, 0, 8, 8, 8)
    rleg_uv = box_uvs(0, 16, 4, 12, 4)
    rleg2_uv = box_uvs(0, 32, 4, 12, 4)
    body_uv = box_uvs(16, 16, 8, 12, 4)
    body2_uv = box_uvs(16, 32, 8, 12, 4)
    rarm_uv = box_uvs(40, 16, aw, 12, 4)
    rarm2_uv = box_uvs(40, 32, aw, 12, 4)
    larm_uv = box_uvs(32, 48, aw, 12, 4)
    larm2_uv = box_uvs(48, 48, aw, 12, 4)
    lleg_uv = box_uvs(16, 48, 4, 12, 4)
    lleg2_uv = box_uvs(0, 48, 4, 12, 4)

    img = Image.new('RGBA', (TEX, TEX), (0, 0, 0, 0))

    FACE_BRIGHT = {
        'front': 1.0,
        'right': 1.06,
        'left': 0.92,
        'top': 1.12,
        'bottom': 0.78,
        'back': 0.85,
    }
    # lighting: 0 => pure source colors, 100 => full legacy shading
    lighting = _clamp(float(p.get('lighting', 40.0)), 0, 100) / 100.0

    def bright_of(face, base):
        if lighting <= 0.01:
            return base
        return base * (1.0 - lighting) + base * FACE_BRIGHT.get(face, 1.0) * lighting

    overlay_alpha = _clamp(float(p.get('overlay_alpha', 160.0)), 0, 255)

    def paint(srcs, uv_map, target, alpha=255, base_bright=1.0):
        for face, uv in uv_map.items():
            u, v, w, h = uv
            tile = _crop_cover(src, srcs[face], w, h)
            tile = _bright(tile, bright_of(face, base_bright))
            if alpha < 255:
                tile = _alpha(tile, alpha / 255.0)
            target.paste(tile, (u, v))

    paint(head_srcs, head_uv, img, base_bright=1.0)
    paint(body_srcs, body_uv, img, base_bright=0.95)
    paint(arm_r_srcs, rarm_uv, img, base_bright=0.95)
    paint(leg_r_srcs, rleg_uv, img, base_bright=0.9)

    oa = overlay_alpha
    paint(head_srcs, head2_uv, img, alpha=oa, base_bright=1.08)
    paint(body_srcs, body2_uv, img, alpha=oa, base_bright=1.0)
    paint(arm_r_srcs, rarm2_uv, img, alpha=oa, base_bright=1.0)
    paint(leg_r_srcs, rleg2_uv, img, alpha=oa, base_bright=0.95)
    paint(leg_l_srcs, lleg_uv, img, alpha=oa, base_bright=0.9)
    paint(leg_l_srcs, lleg2_uv, img, alpha=oa, base_bright=0.95)
    paint(arm_l_srcs, larm_uv, img, alpha=oa, base_bright=0.95)
    paint(arm_l_srcs, larm2_uv, img, alpha=oa, base_bright=1.0)

    return img


PAINT_REGIONS = ['head', 'torso', 'arm_l', 'arm_r', 'leg_l', 'leg_r']


def _compose_on_white(region, size):
    """Composite region onto white and upscale to a square for img2img."""
    white = Image.new('RGBA', region.size, (255, 255, 255, 255))
    flat = Image.alpha_composite(white, region).convert('RGB')
    return flat.resize((size, size), Image.LANCZOS)


def _paint_region(pipe2, region, prompt, neg, steps, cfg, strength, seed, size=512):
    init = _compose_on_white(region, size)
    import torch
    generator = None
    if seed >= 0:
        generator = torch.Generator().manual_seed(seed)
    res = pipe2(
        prompt=prompt or '',
        negative_prompt=neg or None,
        image=init,
        strength=max(0.05, min(0.95, float(strength or 0.45))),
        num_inference_steps=max(1, int(steps or 20)),
        guidance_scale=float(cfg or 7),
        generator=generator,
    )
    out = res.images[0].convert('RGBA')
    w, h = region.size
    out = out.resize((w, h), Image.LANCZOS)
    a = region.split()[3]
    r, g, b = out.split()[:3]
    return Image.merge('RGBA', (r, g, b, a))


def _run_paint(job):
    try:
        jid = job['id']
        src_path = job['_src_path']
        src = Image.open(src_path).convert('RGBA')
        if job.get('bg_removal'):
            src = _remove_bg(src)
        p = job['params']
        model_dir = job.get('model_dir') or DEFAULT_MODEL_DIR
        model_path = resolve_model(model_dir, job.get('model'))
        if not model_path:
            raise ValueError('未找到可用的 SD 模型，请检查模型目录')

        cfg = {'easy_negative': False, 'fix_vae': True}
        job['status'] = 'loading'
        pipe = get_pipe(model_path, None, model_dir, cfg)
        pipe2 = get_img2img(pipe)

        regs = _regions(src, p)
        painted = src.copy()
        total = len(PAINT_REGIONS)
        job['status'] = 'running'
        job['progress'] = 5
        for i, name in enumerate(PAINT_REGIONS):
            job['region'] = name
            box = regs[name]
            tight = _tight_box(src, box)
            region = src.crop(tight)
            if region.getchannel('A').getbbox() is None:
                job['progress'] = 5 + int((i + 1) / total * 90)
                continue
            new_region = _paint_region(
                pipe2, region,
                job.get('prompt'), job.get('negative_prompt'),
                job.get('steps'), job.get('cfg'),
                job.get('strength'), job.get('seed', -1),
            )
            painted.paste(new_region, tight)
            job['progress'] = 5 + int((i + 1) / total * 90)

        body = (job.get('body') or 'wide').lower()
        if body not in ('wide', 'slim'):
            body = 'wide'
        skin = _build_skin(painted, body, p)
        os.makedirs(CACHE_DIR, exist_ok=True)
        name = jid + '.png'
        out_path = os.path.join(CACHE_DIR, name)
        skin.save(out_path, 'PNG')
        buf = io.BytesIO()
        skin.save(buf, 'PNG')
        job['url'] = '/api/plugins/mcskin/cache/' + name
        job['size'] = list(skin.size)
        job['png'] = base64.b64encode(buf.getvalue()).decode()
        job['progress'] = 100
        job['status'] = 'done'
    except Exception as e:
        import traceback
        traceback.print_exc()
        job['status'] = 'error'
        job['error'] = str(e)
    finally:
        try:
            if job.get('_src_path') and os.path.isfile(job['_src_path']):
                os.remove(job['_src_path'])
        except Exception:
            pass


class _PaintManager(JobManager):
    def _run(self, job):
        _run_paint(job)


_paint_manager = _PaintManager()

HISTORY_FILE = os.path.join(CACHE_DIR, 'history.json')

TEXT2SKIN_STYLES = {
    'cyberpunk': '赛博朋克：霓虹灯、机械装甲、发光线条、科技感',
    'cute': '可爱：圆润、粉嫩、萌系、柔和',
    'mecha': '机甲：金属装甲、机械结构、硬朗',
    'ancient': '古风：汉服、飘逸、水墨、传统纹样',
    'animal': '动物：毛茸茸、兽耳、尾巴、自然色',
    'star': '星空：深蓝夜空、星光点缀、梦幻',
    'magic': '魔法：法袍、符文、神秘紫蓝、奇幻',
    'modern': '现代：休闲装、街头、简约、潮流',
}

TEXT2SKIN_TONES = {
    'any': '色调不限，自由发挥',
    'warm': '使用暖色调（橙、红、黄、棕）',
    'cool': '使用冷色调（蓝、青、紫、灰）',
    'bw': '使用黑白灰单色系',
}

TEXT2SKIN_SPEC_SCHEMA = '''请严格输出一个 JSON 对象（不要输出任何其他文字），描述 Minecraft 64x64 皮肤的配色与图案。schema：
{
  "palette": {"skin":"#肤色", "hair":"#发色", "shirt":"#上衣色", "pants":"#裤色", "shoes":"#鞋色", "sleeve":"#袖色", "accent":"#点缀色", "eye":"#眼睛色"},
  "head": {"hair_style":"full|fringe|spiky|bald", "face":"default|happy|serious"},
  "torso": {"pattern":"solid|stripe_v|stripe_h|grid|jacket|collar", "accent":"#点缀色", "belt":true或false},
  "arms": {"pattern":"solid|stripe_v|grid", "sleeve":true或false},
  "legs": {"pattern":"solid|stripe_v|grid", "shoes":true或false}
}'''


def _build_spec_prompt(prompt, style, tone, strength):
    style_desc = TEXT2SKIN_STYLES.get(style, '')
    tone_desc = TEXT2SKIN_TONES.get(tone, TEXT2SKIN_TONES['any'])
    strength_note = ''
    s = int(strength or 3)
    if s >= 4:
        strength_note = '风格要非常强烈、特征鲜明夸张。'
    elif s <= 2:
        strength_note = '风格要含蓄克制、尽量贴近普通休闲装。'
    user = '角色描述：%s\n风格要求：%s\n%s\n%s\n请只输出 JSON。' % (prompt, style_desc, tone_desc, strength_note)
    return TEXT2SKIN_SPEC_SCHEMA, user


def _render_candidate(spec, model='wide'):
    try:
        img = render_skin(spec, model)
    except Exception as e:
        img = render_skin({}, model)
    os.makedirs(CACHE_DIR, exist_ok=True)
    name = '%s_%s.png' % (new_llm_job_id(), random.randint(1000, 9999))
    out = os.path.join(CACHE_DIR, name)
    img.save(out, 'PNG')
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    return {
        'url': '/api/plugins/mcskin/cache/' + name,
        'png': base64.b64encode(buf.getvalue()).decode(),
        'feedback': None,
    }


def _load_history():
    if os.path.isfile(HISTORY_FILE):
        try:
            return json.load(open(HISTORY_FILE, 'r', encoding='utf-8'))
        except Exception:
            return []
    return []


def _save_history(items):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def _run_text2skin(job):
    try:
        job['status'] = 'loading'
        job['progress'] = 5
        system_p, user_p = _build_spec_prompt(
            job.get('prompt') or '一个普通的角色', job.get('style'),
            job.get('tone'), job.get('strength'))
        job['status'] = 'running'
        raw = llm_generate(system_p, user_p, max_new_tokens=900, temperature=0.9)
        spec = extract_json(raw)
        if not spec:
            raise ValueError('LLM 未返回有效规格: %s' % (raw or '')[:200])
        job['spec'] = spec
        job['progress'] = 55
        cand = _render_candidate(spec, job.get('body') or 'wide')
        job['progress'] = 90
        item = {
            'id': job['id'],
            'created': time.time(),
            'prompt': job.get('prompt'),
            'style': job.get('style'),
            'tone': job.get('tone'),
            'strength': job.get('strength'),
            'model': job.get('body') or 'wide',
            'spec': spec,
            'candidates': [cand],
        }
        history = _load_history()
        history.insert(0, item)
        _save_history(history[:200])
        job['candidate'] = cand
        job['progress'] = 100
        job['status'] = 'done'
    except Exception as e:
        import traceback
        traceback.print_exc()
        job['status'] = 'error'
        job['error'] = str(e)


set_llm_runner(_run_text2skin)


# ---- HTTP 分发(替代 Flask/Plugin 壳, 逻辑与路由与旧插件一致) ----
def _tail(prefix, path):
    idx = path.find(prefix)
    if idx < 0:
        return ''
    return path[idx + len(prefix):].lstrip('/')


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "mcskin/2.0"

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
        self.send_header("Cache-Control", "public, max-age=0")
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def _q(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return {k: v[0] for k, v in q.items()}

    def _json_body(self):
        try:
            return json.loads(self._body() or b'{}')
        except Exception:
            return {}

    # ---- multipart 解析(替代 Flask request.files / request.form) ----
    def _multipart(self):
        """Parse multipart/form-data once; return (form_dict, files_list).
        files_list items: (field, filename, raw_bytes)."""
        if getattr(self, '_mp_parsed', None) is not None:
            return self._mp_parsed
        ctype = self.headers.get('Content-Type') or ''
        form = {}
        files = []
        m = re.search(r'boundary=([^;\s]+)', ctype)
        body = self._body()
        if m and body:
            boundary = m.group(1).strip().strip('"')
            delim = b'--' + boundary.encode()
            for part in body.split(delim):
                if not part or part.strip(b'\r\n') in (b'', b'--'):
                    continue
                if b'\r\n\r\n' in part:
                    head, content = part.split(b'\r\n\r\n', 1)
                elif b'\n\n' in part:
                    head, content = part.split(b'\n\n', 1)
                else:
                    continue
                content = content.rstrip(b'\r\n')
                head = head.decode('utf-8', 'replace')
                mname = re.search(r'name="([^"]*)"', head)
                mfile = re.search(r'filename="([^"]*)"', head)
                name = mname.group(1) if mname else ''
                if mfile:
                    files.append((name, mfile.group(1), content))
                else:
                    try:
                        form[name] = content.decode('utf-8')
                    except Exception:
                        form[name] = content.decode('latin-1')
        self._mp_parsed = (form, files)
        return self._mp_parsed

    def _save_uploads(self, session_dir, fields):
        """旧 yulotool_common.save_uploads 的本地实现."""
        _, files = self._multipart()
        saved = []
        for field in fields:
            for fname, filename, data in files:
                if fname != field or not filename:
                    continue
                safe = os.path.basename(filename)
                dest = os.path.join(session_dir, safe)
                with open(dest, 'wb') as f:
                    f.write(data)
                saved.append({'field': field, 'filename': safe, 'path': dest})
        return saved

    # ---- 路由: POST /detect ----
    def _rt_detect(self):
        session = new_session()
        saved = self._save_uploads(session, ('file', 'files'))
        if not saved:
            shutil.rmtree(session, ignore_errors=True)
            return 400, {'ok': False, 'error': '请上传图片'}
        path = saved[0]['path']
        form, _ = self._multipart()
        try:
            src = Image.open(path).convert('RGBA')
            if form.get('bg_removal', '1') not in ('0', 'false', 'False'):
                src = _remove_bg(src)
            p = _auto_detect(src)
        except Exception as e:
            shutil.rmtree(session, ignore_errors=True)
            return 500, {'ok': False, 'error': str(e)}
        shutil.rmtree(session, ignore_errors=True)
        return 200, {'ok': True, 'params': p}

    # ---- 路由: POST /convert ----
    def _rt_convert(self):
        session = new_session()
        saved = self._save_uploads(session, ('file', 'files'))
        if not saved:
            shutil.rmtree(session, ignore_errors=True)
            return 400, {'ok': False, 'error': '请上传图片'}
        form, _ = self._multipart()
        model = (form.get('model') or 'wide').lower()
        if model not in ('wide', 'slim'):
            model = 'wide'
        path = saved[0]['path']
        try:
            src = Image.open(path).convert('RGBA')
        except Exception as e:
            shutil.rmtree(session, ignore_errors=True)
            return 400, {'ok': False, 'error': '无法解析图片: %s' % e}
        if form.get('bg_removal', '1') not in ('0', 'false', 'False'):
            src = _remove_bg(src)
        p = dict(DEFAULT_P)
        for k in p:
            if k == 'bg_removal':
                continue
            v = form.get('p_' + k)
            if v is not None and v != '':
                try:
                    p[k] = _clamp(float(v), 0, 255)
                except (TypeError, ValueError):
                    pass
        try:
            skin = _build_skin(src, model, p)
        except Exception as e:
            shutil.rmtree(session, ignore_errors=True)
            return 500, {'ok': False, 'error': '转换失败: %s' % e}
        os.makedirs(CACHE_DIR, exist_ok=True)
        name = hashlib.md5(('%s-%s-%d' % (saved[0]['filename'], model, time.time())).encode()).hexdigest()[:16] + '.png'
        out = os.path.join(CACHE_DIR, name)
        skin.save(out, 'PNG')
        shutil.rmtree(session, ignore_errors=True)
        buf = io.BytesIO()
        skin.save(buf, 'PNG')
        return 200, {
            'ok': True,
            'size': list(skin.size),
            'model': model,
            'has_overlay': True,
            'params': p,
            'url': '/api/plugins/mcskin/cache/' + name,
            'filename': '皮肤_%s_%s.png' % (model, time.strftime('%Y%m%d%H%M%S')),
            'png': base64.b64encode(buf.getvalue()).decode(),
        }

    # ---- 路由: GET /paint/models ----
    def _rt_paint_models(self):
        return 200, {'ok': True, 'models': list_models(DEFAULT_MODEL_DIR)}

    # ---- 路由: POST /paint ----
    def _rt_paint(self):
        session = new_session()
        saved = self._save_uploads(session, ('file', 'files'))
        if not saved:
            shutil.rmtree(session, ignore_errors=True)
            return 400, {'ok': False, 'error': '请上传图片'}
        path = saved[0]['path']
        src_path = os.path.join(CACHE_DIR, 'paint_%d.png' % int(time.time() * 1000))
        os.makedirs(CACHE_DIR, exist_ok=True)
        try:
            shutil.copyfile(path, src_path)
        except Exception as e:
            shutil.rmtree(session, ignore_errors=True)
            return 500, {'ok': False, 'error': str(e)}
        shutil.rmtree(session, ignore_errors=True)
        form, _ = self._multipart()
        p = dict(DEFAULT_P)
        for k in p:
            if k == 'bg_removal':
                continue
            v = form.get('p_' + k)
            if v is not None and v != '':
                try:
                    p[k] = _clamp(float(v), 0, 255)
                except (TypeError, ValueError):
                    pass
        body = (form.get('body') or 'wide').lower()
        if body not in ('wide', 'slim'):
            body = 'wide'
        jid = new_job_id()
        job = {
            'id': jid, 'status': 'queued', 'progress': 0, 'created': time.time(),
            '_src_path': src_path,
            'params': p,
            'bg_removal': form.get('bg_removal', '1') not in ('0', 'false', 'False'),
            'model': form.get('model'),
            'body': body,
            'prompt': form.get('prompt'),
            'negative_prompt': form.get('negative_prompt'),
            'steps': form.get('steps'),
            'cfg': form.get('cfg'),
            'strength': form.get('strength'),
            'seed': int(form.get('seed') or -1),
        }
        _paint_manager.enqueue(job)
        return 200, {'ok': True, 'job_id': jid, 'status': 'queued'}

    # ---- 路由: GET /paint/status/<jid> ----
    def _rt_paint_status(self, jid):
        if not jid:
            return 400, {'ok': False, 'error': '缺少任务ID'}
        j = _paint_manager.get(jid)
        if not j:
            return 404, {'ok': False, 'error': '任务不存在'}
        return 200, {k: j.get(k) for k in (
            'id', 'status', 'progress', 'region', 'error', 'created',
            'url', 'size', 'png')}

    # ---- 路由: POST /paint/cancel/<jid> ----
    def _rt_paint_cancel(self, jid):
        if not jid:
            return 400, {'ok': False, 'error': '缺少任务ID'}
        r = _paint_manager.cancel(jid)
        if r is None:
            return 404, {'ok': False, 'error': '任务不存在'}
        return 200, {'ok': True, 'status': r}

    # ---- 路由: GET /text2skin/models ----
    def _rt_text2skin_models(self):
        return 200, {'ok': True, 'models': list_llm_models()}

    # ---- 路由: GET /text2skin/styles ----
    def _rt_text2skin_styles(self):
        return 200, {'ok': True, 'styles': TEXT2SKIN_STYLES, 'tones': TEXT2SKIN_TONES}

    # ---- 路由: POST /text2skin ----
    def _rt_text2skin(self, body):
        data = body or {}
        prompt = (data.get('prompt') or '').strip()
        if not prompt:
            return 400, {'ok': False, 'error': '请输入角色描述'}
        jid = new_llm_job_id()
        job = {
            'id': jid, 'status': 'queued', 'progress': 0, 'created': time.time(),
            'prompt': prompt,
            'style': (data.get('style') or 'modern'),
            'tone': (data.get('tone') or 'any'),
            'strength': data.get('strength', 3),
            'body': (data.get('body') or 'wide'),
        }
        enqueue_llm(job)
        return 200, {'ok': True, 'job_id': jid, 'status': 'queued'}

    # ---- 路由: GET /text2skin/status/<jid> ----
    def _rt_text2skin_status(self, jid):
        if not jid:
            return 400, {'ok': False, 'error': '缺少任务ID'}
        j = get_llm_job(jid)
        if not j:
            return 404, {'ok': False, 'error': '任务不存在'}
        return 200, {k: j.get(k) for k in (
            'id', 'status', 'progress', 'error', 'created', 'spec', 'candidate')}

    # ---- 路由: POST /text2skin/regenerate/<jid> ----
    def _rt_text2skin_regenerate(self, jid):
        if not jid:
            return 400, {'ok': False, 'error': '缺少任务ID'}
        history = _load_history()
        item = next((h for h in history if h.get('id') == jid), None)
        if not item:
            return 404, {'ok': False, 'error': '历史不存在'}
        njid = new_llm_job_id()
        job = {
            'id': njid, 'status': 'queued', 'progress': 0, 'created': time.time(),
            'prompt': item.get('prompt'), 'style': item.get('style'),
            'tone': item.get('tone'), 'strength': item.get('strength'),
            'body': item.get('model') or 'wide',
        }
        enqueue_llm(job)
        return 200, {'ok': True, 'job_id': njid, 'status': 'queued'}

    # ---- 路由: GET /text2skin/history ----
    def _rt_text2skin_history(self):
        return 200, {'ok': True, 'history': _load_history()}

    # ---- 路由: POST /text2skin/feedback/<jid> ----
    def _rt_text2skin_feedback(self, jid, body):
        data = body or {}
        like = data.get('like')
        history = _load_history()
        item = next((h for h in history if h.get('id') == jid), None)
        if not item:
            return 404, {'ok': False, 'error': '历史不存在'}
        for c in item.get('candidates', []):
            c['feedback'] = 'like' if like else 'dislike'
        _save_history(history)
        return 200, {'ok': True, 'status': 'like' if like else 'dislike'}

    # ---- 路由: GET /cache/<name>(旧面板静态直链的本地等价, 供 url 字段直取) ----
    def _rt_cache(self, name):
        if not name or '/' in name or '\\' in name or '..' in name:
            return 400, {'error': '文件名非法'}
        p = os.path.join(CACHE_DIR, name)
        if os.path.isfile(p):
            self._file(p, 'image/png')
            return None
        return 404, {'error': '文件不存在'}

    # ---- 路由: GET /info ----
    def _rt_info(self):
        from datetime import datetime
        return 200, {'name': 'mcskin', 'label': '图片转皮肤', 'version': '2.0.0',
                     'lang': 'python',
                     'description': '图片转 MC Java 皮肤：全身立绘映射、底+叠层、Steve/Alex 模型、3D 预览'}

    # ---- 分发 ----
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            if p == "/__health":
                return self._json(200, {"ok": True})
            if p == "/info":
                return self._json(*self._rt_info())
            if p == "/paint/models":
                return self._json(*self._rt_paint_models())
            if p.startswith("/paint/status/"):
                return self._json(*self._rt_paint_status(_tail('/paint/status/', p)))
            if p == "/text2skin/models":
                return self._json(*self._rt_text2skin_models())
            if p == "/text2skin/styles":
                return self._json(*self._rt_text2skin_styles())
            if p == "/text2skin/history":
                return self._json(*self._rt_text2skin_history())
            if p.startswith("/text2skin/status/"):
                return self._json(*self._rt_text2skin_status(_tail('/text2skin/status/', p)))
            if p.startswith("/cache/"):
                r = self._rt_cache(_tail('/cache/', p))
                if r:
                    return self._json(*r)
                return
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            if p == "/detect":
                return self._json(*self._rt_detect())
            if p == "/convert":
                return self._json(*self._rt_convert())
            if p == "/paint":
                return self._json(*self._rt_paint())
            if p.startswith("/paint/cancel/"):
                return self._json(*self._rt_paint_cancel(_tail('/paint/cancel/', p)))
            if p == "/text2skin":
                return self._json(*self._rt_text2skin(self._json_body()))
            if p.startswith("/text2skin/regenerate/"):
                return self._json(*self._rt_text2skin_regenerate(_tail('/text2skin/regenerate/', p)))
            if p.startswith("/text2skin/feedback/"):
                return self._json(*self._rt_text2skin_feedback(_tail('/text2skin/feedback/', p), self._json_body()))
            return self._json(404, {'error': 'not found'})
        except Exception as e:
            return self._json(500, {'error': str(e)})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("mcskin ready on %d" % PORT, file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()