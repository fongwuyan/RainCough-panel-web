#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""imagetool 插件后端(接口库 v4) — 复用同目录旧 server.py 的图像工具逻辑。

图片相似度(dhash) / 图像处理(ImageMagick: resize/quality/rotate/format)。
输入输出均以 base64(data_url) 走接口, 无文件路由。
"""
import base64
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


def _b64(raw):
    if raw.startswith('data:'):
        raw = raw.split(',', 1)[1]
    return base64.b64decode(raw)


def _b64img(data, fmt='png'):
    return 'data:image/%s;base64,%s' % (fmt, base64.b64encode(data).decode())


@rc.interface("imagetool.similar")
def imagetool_similar(params):
    imgs = _p(params).get('images') or []
    if len(imgs) < 2:
        _err('请上传两张图片')
    try:
        ha = M._dhash_from_bytes(_b64(imgs[0]))
        hb = M._dhash_from_bytes(_b64(imgs[1]))
    except Exception as e:
        _err('图片解析失败: %s' % e)
    dist = M._hamming(ha, hb)
    pct = max(0, round((64 - dist) / 64 * 100, 1))
    return {'ok': True, 'hamming': dist, 'similarity': pct,
            'verdict': '高度相似' if dist <= 4 else ('相似' if dist <= 10 else '不同')}


@rc.interface("imagetool.process")
def imagetool_process(params):
    magick = M.find_tool('convert')
    if not magick:
        _err('未安装 ImageMagick')
    imgs = _p(params).get('images') or []
    if not imgs:
        _err('请上传图片')
    fmt = (_p(params).get('format') or '').lower()
    resize = str(_p(params).get('resize') or '').strip()
    quality = _p(params).get('quality')
    rotate = _p(params).get('rotate')

    session = M.new_session(M.PLUGIN)
    results = [] if isinstance(imgs, list) else []
    for idx, item in enumerate(imgs):
        name = item.get('name') if isinstance(item, dict) else ('img%d' % idx)
        data = item.get('data') if isinstance(item, dict) else item
        src = os.path.join(session, 'in_%d' % idx)
        with open(src, 'wb') as f:
            f.write(_b64(data))
        base = os.path.splitext(os.path.basename(name))[0]
        out_ext = fmt or 'png'
        out = os.path.join(session, '%s.%s' % (base, out_ext))
        cmd = [magick, src]
        if resize:
            cmd += ['-resize', resize]
        if quality:
            try:
                cmd += ['-quality', str(int(quality))]
            except (TypeError, ValueError):
                pass
        if rotate:
            try:
                cmd += ['-rotate', str(int(rotate))]
            except (TypeError, ValueError):
                pass
        cmd.append(out)
        r = M.run_cmd(cmd)
        ok = os.path.isfile(out)
        entry = {'name': os.path.basename(name), 'ok': ok,
                 'error': '' if ok else (r['error'] or '处理失败').strip()[:200]}
        if ok:
            with open(out, 'rb') as f:
                entry['output'] = _b64img(f.read(), fmt or 'png')
        results.append(entry)
    shutil.rmtree(session, ignore_errors=True)
    return {'ok': True, 'results': results}


@rc.interface("imagetool.info")
def imagetool_info(params):
    return {'name': 'imagetool', 'label': '图像工具', 'version': '2.0.0', 'lang': 'python',
            'description': '图片相似度与图像处理(ImageMagick)'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="imagetool",
        version="2.0.0",
        manifest={"label": "图像工具", "description": "相似度/图像处理"},
        frontend={"pages": [{"path": "", "title": "图像工具"}]},
        iface_ids=["imagetool.similar", "imagetool.process", "imagetool.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )