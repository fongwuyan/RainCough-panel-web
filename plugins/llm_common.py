import os
import re
import json
import time
import random
import threading
from datetime import datetime

os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')

DEFAULT_LLM_DIR = '/opt/touchgal/models/llm'
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
    return datetime.now().strftime('%Y%m%d%H%M%S') + str(random.randint(1000, 9999))
