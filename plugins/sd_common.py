import os
import json
import struct
import time
import random
import threading
from datetime import datetime

os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')

DEFAULT_MODEL_DIR = '/opt/touchgal/models/aigen'
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
    return datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))
