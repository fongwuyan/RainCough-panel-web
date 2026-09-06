#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ocrqr 插件后端(接口库 v4) — 复用同目录旧 server.py 的 OCR/QR 逻辑。

图片输入: 前端以 base64(data_url) 传参, 后端落 session 临时文件后处理。
二维码图片经 /api/plugins/ocrqr/cache/<name> 由主系统代发。
"""
import base64
import hashlib
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
import server as M  # 旧后端全量逻辑(仅 import, 不启动)


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _decode_image(params, key='image'):
    raw = str(_p(params).get(key, '') or '').strip()
    if not raw:
        _err('请上传图片')
    if raw.startswith('data:'):
        raw = raw.split(',', 1)[1]
    try:
        return base64.b64decode(raw)
    except Exception:
        _err('图片 base64 解码失败')


@rc.interface("ocrqr.ocr.check")
def ocrqr_ocr_check(params):
    models_ok = os.path.isdir(M.OCR_MODEL_DIR) and any(
        f.endswith('.onnx') for f in os.listdir(M.OCR_MODEL_DIR))
    try:
        import rapidocr  # noqa
        pkg_ok = True
    except Exception:
        pkg_ok = False
    return {'ok': models_ok and pkg_ok, 'models': models_ok,
            'package': pkg_ok, 'model_dir': M.OCR_MODEL_DIR}


@rc.interface("ocrqr.ocr")
def ocrqr_ocr(params):
    if not os.path.isdir(M.OCR_MODEL_DIR):
        _err('OCR 模型未下载')
    data = _decode_image(params)
    session = M.new_session()
    path = os.path.join(session, 'input.png')
    with open(path, 'wb') as f:
        f.write(data)
    try:
        engine = M._get_ocr()
        out = engine(path)
        lines = out.to_json() if hasattr(out, 'to_json') else []
        text = '\n'.join(item.get('txt', '') for item in lines)
        shutil.rmtree(session, ignore_errors=True)
        return {'ok': True, 'text': text, 'lines': lines, 'elapse': getattr(out, 'elapse', None)}
    except Exception as e:
        shutil.rmtree(session, ignore_errors=True)
        _err(str(e))


@rc.interface("ocrqr.qr.gen")
def ocrqr_qr_gen(params):
    text = str(_p(params).get('text', '') or '').strip()
    if not text:
        _err('内容不能为空')
    try:
        size = int(_p(params).get('size') or 300)
    except (TypeError, ValueError):
        size = 300
    size = max(120, min(size, 1024))
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M
    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    img = img.resize((size, size))
    os.makedirs(os.path.join(M.PLUGIN_DIR, 'cache'), exist_ok=True)
    name = hashlib.md5(text.encode()).hexdigest() + '.png'
    img.save(os.path.join(M.PLUGIN_DIR, 'cache', name))
    return {'ok': True, 'url': '/api/plugins/ocrqr/cache/' + name}


@rc.interface("ocrqr.qr.decode")
def ocrqr_qr_decode(params):
    data = _decode_image(params)
    session = M.new_session()
    path = os.path.join(session, 'input.png')
    with open(path, 'wb') as f:
        f.write(data)
    try:
        import cv2
        img = cv2.imread(path)
        if img is None:
            shutil.rmtree(session, ignore_errors=True)
            _err('无法读取图片')
        detector = cv2.QRCodeDetector()
        data_txt, points, _ = detector.detectAndDecode(img)
        results = []
        if data_txt:
            results.append({'data': data_txt, 'points': points.tolist() if points is not None else None})
        else:
            ok, decoded, pts, _ = detector.detectAndDecodeMulti(img)
            if ok:
                for d, p in zip(decoded, pts):
                    if d:
                        results.append({'data': d, 'points': p.tolist() if p is not None else None})
        shutil.rmtree(session, ignore_errors=True)
        return {'ok': True, 'results': results}
    except Exception as e:
        shutil.rmtree(session, ignore_errors=True)
        _err(str(e))


@rc.interface("ocrqr.info")
def ocrqr_info(params):
    return {'name': 'ocrqr', 'label': '识别二维码', 'version': '2.0.0', 'lang': 'python',
            'description': 'OCR 识别与二维码生成/解码'}


if __name__ == "__main__":
    # 启动时后台预热 OCR 引擎(首调用不再等待模型初始化 >15s)
    import threading

    def _warmup():
        try:
            M._get_ocr()
            print('[ocrqr] rapidocr 预热完成')
        except Exception as e:
            print('[ocrqr] rapidocr 预热失败:', e)

    threading.Thread(target=_warmup, daemon=True).start()
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="ocrqr",
        version="2.0.0",
        manifest={"label": "识别二维码", "description": "OCR 与二维码工具"},
        frontend={"pages": [{"path": "", "title": "OCR / 二维码"}]},
        iface_ids=["ocrqr.ocr.check", "ocrqr.ocr", "ocrqr.qr.gen", "ocrqr.qr.decode", "ocrqr.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )