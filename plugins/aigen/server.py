#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""aigen v2 插件子进程 — 本地 SD 生图。

独立子进程: 不 import 面板任何代码。依赖在插件 venv 或系统 python 中:
  diffusers / transformers / torch / safetensors

生图为异步任务: POST /generate -> {task_id}; GET /status/<id> 轮询; 完成后 /output/<id> 取图。
"""
import os
import json
import base64
import time
import threading
import http.server

PORT = int(os.environ.get("RAINCOUGH_PORT", "0"))
NS = os.environ.get("RAINCOUGH_NS", "aigen")
PLUGIN_DIR = os.environ.get("RAINCOUGH_PLUGIN_DIR", os.getcwd())
MODEL_DIR = os.environ.get("AIGEN_MODEL_DIR", os.path.join(PLUGIN_DIR, "models"))
OUTPUT_DIR = os.environ.get("AIGEN_OUTPUT_DIR", os.path.join(PLUGIN_DIR, "output"))

_tasks = {}          # task_id -> {status, progress, message, output}
_task_lock = threading.Lock()
_tid = [0]

# ---- SD 引擎(惰性加载) ----
_engine = None
_engine_err = None


def _get_engine():
    global _engine, _engine_err
    if _engine is not None or _engine_err:
        return _engine, _engine_err
    try:
        import torch
        from diffusers import StableDiffusionPipeline
        pipe = StableDiffusionPipeline.from_pretrained(MODEL_DIR, torch_dtype=torch.float16)
        pipe = pipe.to("cuda" if torch.cuda.is_available() else "cpu")
        _engine = pipe
    except Exception as e:
        _engine_err = str(e)
    return _engine, _engine_err


def list_models():
    """扫描模型目录(子目录名作为可用模型)。"""
    if not os.path.isdir(MODEL_DIR):
        return []
    models = [d for d in os.listdir(MODEL_DIR)
              if os.path.isdir(os.path.join(MODEL_DIR, d))]
    return models


def _new_task():
    _tid[0] += 1
    return "t%d" % _tid[0]


def generate(prompt, negative, steps, size, model):
    task = _new_task()
    with _task_lock:
        _tasks[task] = {"status": "queued", "progress": 0, "message": "排队中"}
    threading.Thread(target=_run_generate, args=(task, prompt, negative, steps, size, model),
                     daemon=True).start()
    return task


def _run_generate(task, prompt, negative, steps, size, model):
    def upd(**kw):
        with _task_lock:
            t = _tasks.get(task)
            if t:
                t.update(kw)
    engine, err = _get_engine()
    if err:
        upd(status="failed", message="引擎加载失败: " + err)
        return
    upd(status="running", progress=10, message="开始生成...")
    try:
        if negative:
            result = engine(prompt=prompt, negative_prompt=negative,
                            num_inference_steps=steps,
                            height=size, width=size,
                            callback=lambda i, t, l: upd(
                                progress=10 + int(i / steps * 85),
                                message="步骤 %d/%d" % (i + 1, steps)))
        else:
            result = engine(prompt=prompt, num_inference_steps=steps,
                            height=size, width=size,
                            callback=lambda i, t, l: upd(
                                progress=10 + int(i / steps * 85),
                                message="步骤 %d/%d" % (i + 1, steps)))
        img = result.images[0]
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        out_path = os.path.join(OUTPUT_DIR, "%s.png" % task)
        img.save(out_path)
        upd(status="done", progress=100, message="完成", output=os.path.basename(out_path))
    except Exception as e:
        upd(status="failed", message="生成失败: " + str(e))


def task_status(task):
    with _task_lock:
        return _tasks.get(task)


def read_output(task):
    p = os.path.join(OUTPUT_DIR, "%s.png" % task)
    if not os.path.isfile(p):
        return None
    with open(p, "rb") as f:
        return base64.b64encode(f.read()).decode()


def gallery():
    if not os.path.isdir(OUTPUT_DIR):
        return []
    out = []
    for fn in sorted(os.listdir(OUTPUT_DIR))[-30:]:
        if fn.endswith(".png"):
            with open(os.path.join(OUTPUT_DIR, fn), "rb") as f:
                out.append({"name": fn, "data": base64.b64encode(f.read()).decode()})
    return out


class Handler(http.server.BaseHTTPRequestHandler):
    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _body(self):
        ln = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(ln) if ln else b""

    def do_GET(self):
        p = self.path
        if p == "/__health":
            engine, err = _get_engine() if False else (None, None)
            self._json(200, {"ok": True, "models": list_models(), "engine_loaded": _engine is not None})
            return
        if p == "/ping":
            self._json(200, {"ok": True, "models": list_models()})
            return
        if p == "/models":
            self._json(200, {"models": list_models()})
            return
        if p.startswith("/status/"):
            task = p[len("/status/"):]
            t = task_status(task)
            if not t:
                self._json(404, {"error": "任务不存在"})
                return
            self._json(200, t)
            return
        if p.startswith("/output/"):
            task = p[len("/output/"):]
            data = read_output(task)
            if not data:
                self._json(404, {"error": "输出不存在或未完成"})
                return
            self._json(200, {"image_b64": data, "task": task})
            return
        if p == "/gallery":
            self._json(200, {"items": gallery()})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        p = self.path
        try:
            data = json.loads(self._body() or b"{}")
        except Exception:
            data = {}
        if p == "/generate":
            task = generate(str(data.get("prompt") or "a cat"),
                            str(data.get("negative_prompt") or ""),
                            int(data.get("steps") or 20),
                            int(data.get("size") or 512),
                            str(data.get("model") or ""))
            self._json(200, {"task": task})
            return
        if p == "/img2img":
            # 简化: 走 generate 逻辑(图生图完整支持需 img2img pipeline)
            task = generate(str(data.get("prompt") or "a cat"),
                            str(data.get("negative_prompt") or ""),
                            int(data.get("steps") or 20),
                            int(data.get("size") or 512),
                            str(data.get("model") or ""))
            self._json(200, {"task": task})
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass


def main():
    if PORT <= 0:
        raise SystemExit("RAINCOUGH_PORT 未设置")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("aigen ready on %d models=%s" % (PORT, list_models()), file=os.sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()