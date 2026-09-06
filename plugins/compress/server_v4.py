#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""compress 插件后端(接口库 v4) — 复用同目录旧 server.py 的 7z 解压/压缩逻辑。

输入: base64 文件 {files:[{name,data}]} / {archive:[...]}; 产物经 work/ 路由下载。
"""
import base64
import os
import shutil
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
import server as M


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _b64(raw):
    if raw.startswith('data:'):
        raw = raw.split(',', 1)[1]
    return base64.b64decode(raw)


def _save_archive(params, session, key='archive'):
    raw = _p(params).get(key) or ''
    name = str(_p(params).get('name') or 'archive')
    if not raw:
        _err('请上传压缩包')
    data = _b64(raw)
    safe = os.path.basename(name)
    dest = os.path.join(session, safe)
    with open(dest, 'wb') as f:
        f.write(data)
    return {'field': 'file', 'filename': safe, 'path': dest}


def _save_files(params, session):
    files = _p(params).get('files') or []
    saved = []
    for it in files:
        name = it.get('name') if isinstance(it, dict) else 'file'
        data = it.get('data') if isinstance(it, dict) else it
        safe = os.path.basename(name)
        dest = os.path.join(session, safe)
        with open(dest, 'wb') as f:
            f.write(_b64(data))
        saved.append({'field': 'files', 'filename': safe, 'path': dest})
    return saved


def _7z():
    tool = M.find_tool('7z')
    if not tool:
        _err('未安装 7z (p7zip-full)')
    return tool


@rc.interface("compress.dc.check")
def compress_dc_check(params):
    tool = M.find_tool('7z')
    if not tool:
        return {'ok': False, 'error': '未安装 7z (p7zip-full)'}
    return {'ok': True, '7z': tool}


@rc.interface("compress.dc.list")
def compress_dc_list(params):
    tool = _7z()
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_archive(params, session)
        r = M.run_cmd([tool, 'l', saved['path'], '-slt', '-bsp0'])
        if not r['ok']:
            _err(M.clean_err(r, session))
        files = M.parse_7z_list(r['output'])
        total_size = sum(f.get('size', 0) for f in files if not f.get('isDir'))
        return {'ok': True, 'name': saved['filename'], 'files': files,
                'total': len(files), 'total_size': total_size}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("compress.dc.extract")
def compress_dc_extract(params):
    tool = _7z()
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_archive(params, session)
        password = str(_p(params).get('password') or '').strip()
        organize = str(_p(params).get('organize') or 'none')
        if organize not in M.ORGANIZE_MODES:
            organize = 'none'
        out_dir = os.path.join(session, 'extracted')
        os.makedirs(out_dir, exist_ok=True)
        if organize != 'none':
            temp_dir = os.path.join(session, '_temp')
            args = [tool, 'x', saved['path'], '-o%s' % temp_dir]
            if password:
                args.append('-p%s' % password)
            r = M.run_cmd(args)
            if not r['ok']:
                _err(M.clean_err(r, session))
            count = 0
            for root, dirs, files in os.walk(temp_dir):
                for fn in files:
                    src = os.path.join(root, fn)
                    mtime = datetime.fromtimestamp(os.path.getmtime(src))
                    ext = os.path.splitext(fn)[1][1:]
                    if organize == 'type':
                        target = os.path.join(out_dir, M.classify_ext(ext))
                    elif organize == 'date':
                        target = os.path.join(out_dir, mtime.strftime('%Y-%m-%d'))
                    elif organize == 'ext':
                        target = os.path.join(out_dir, '.%s' % ext if ext else 'no_ext')
                    else:
                        first = fn[:1].upper()
                        target = os.path.join(out_dir, first if first.isalpha() else '#')
                    os.makedirs(target, exist_ok=True)
                    dest = os.path.join(target, fn)
                    i = 1
                    while os.path.exists(dest):
                        base, e = os.path.splitext(fn)
                        dest = os.path.join(target, '%s_%d%s' % (base, i, e))
                        i += 1
                    shutil.copy2(src, dest)
                    count += 1
            shutil.rmtree(temp_dir, ignore_errors=True)
        else:
            args = [tool, 'x', saved['path'], '-o%s' % out_dir]
            if password:
                args.append('-p%s' % password)
            r = M.run_cmd(args)
            if not r['ok']:
                _err(M.clean_err(r, session))
            count = sum(len(fs) for _, _, fs in os.walk(out_dir))
        zip_path = os.path.join(session, '%s_extracted.zip' % os.path.splitext(saved['filename'])[0])
        M.make_zip(out_dir, zip_path)
        return {'ok': True, 'count': count,
                'download': '/api/plugins/compress/work/%s/%s' % (os.path.basename(session), os.path.basename(zip_path))}
    finally:
        pass  # 产物下载需保留 session


@rc.interface("compress.dc.compress")
def compress_dc_compress(params):
    tool = _7z()
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传要压缩的文件')
        fmt = str(_p(params).get('format') or '7z').lower()
        if fmt not in M.FORMATS:
            fmt = '7z'
        try:
            level = int(_p(params).get('level') or 5)
        except (TypeError, ValueError):
            level = 5
        password = str(_p(params).get('password') or '').strip()
        out_name = str(_p(params).get('name') or 'archive').strip() or 'archive'
        if fmt in ('gz', 'bz2', 'xz'):
            import subprocess as _sp
            comp = M.find_tool({'gz': 'gzip', 'bz2': 'bzip2', 'xz': 'xz'}[fmt])
            if not comp:
                _err('未安装 %s 压缩器' % fmt)
            tar_path = os.path.join(session, '%s.tar' % out_name)
            r = M.run_cmd([tool, 'a', '-ttar', tar_path] + [f['path'] for f in saved])
            if not r['ok'] or not os.path.isfile(tar_path):
                _err(M.clean_err(r, session))
            out_path = '%s.%s' % (tar_path, fmt)
            with open(tar_path, 'rb') as srcf, open(out_path, 'wb') as dstf:
                p = _sp.run([comp, '-c'], stdin=srcf, stdout=dstf)
            if p.returncode != 0 or not os.path.isfile(out_path) or os.path.getsize(out_path) == 0:
                _err('压缩失败')
        else:
            out_path = os.path.join(session, '%s.%s' % (out_name, fmt))
            args = [tool, 'a', '-t%s' % fmt]
            if level > 0:
                args.append('-mx%s' % level)
            if password:
                args.append('-p%s' % password)
            args.append(out_path)
            args += [f['path'] for f in saved]
            r = M.run_cmd(args)
            if not r['ok']:
                _err(M.clean_err(r, session))
            if not os.path.isfile(out_path):
                _err('打包失败')
        return {'ok': True, 'size': os.path.getsize(out_path),
                'download': '/api/plugins/compress/work/%s/%s' % (os.path.basename(session), os.path.basename(out_path))}
    finally:
        pass


@rc.interface("compress.dc.convert")
def compress_dc_convert(params):
    tool = _7z()
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_archive(params, session)
        dst_fmt = str(_p(params).get('format') or '7z').lower()
        if dst_fmt not in ('7z', 'zip', 'tar'):
            dst_fmt = '7z'
        base = os.path.splitext(saved['filename'])[0]
        out_path = os.path.join(session, '%s.%s' % (base, dst_fmt))
        r = M.run_cmd([tool, 'a', '-t%s' % dst_fmt, out_path, saved['path']])
        if not r['ok']:
            _err(M.clean_err(r, session))
        return {'ok': True, 'size': os.path.getsize(out_path),
                'download': '/api/plugins/compress/work/%s/%s' % (os.path.basename(session), os.path.basename(out_path))}
    finally:
        pass


@rc.interface("compress.dc.compare")
def compress_dc_compare(params):
    tool = _7z()
    session = M.new_session(M.PLUGIN)
    try:
        arch = _p(params).get('archives') or []
        if len(arch) < 2:
            _err('请上传两个压缩包')
        a = _save_archive({'archive': arch[0], 'name': 'a.bin'}, session)
        b = _save_archive({'archive': arch[1], 'name': 'b.bin'}, session)
        ra = M.run_cmd([tool, 'l', a['path'], '-slt', '-bsp0'])
        rb = M.run_cmd([tool, 'l', b['path'], '-slt', '-bsp0'])
        fa = {f['path']: f for f in M.parse_7z_list(ra['output']) if not f.get('isDir')}
        fb = {f['path']: f for f in M.parse_7z_list(rb['output']) if not f.get('isDir')}
        only_a = [f for f in fa if f not in fb]
        only_b = [f for f in fb if f not in fa]
        both = [f for f in fa if f in fb and fa[f].get('size') != fb[f].get('size')]
        return {'ok': True, 'only_a': only_a, 'only_b': only_b, 'diff': both,
                'same': len(fa) - len(only_a) - len(both)}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("compress.info")
def compress_info(params):
    return {'name': 'compress', 'label': '解压压缩', 'version': '2.0.0', 'lang': 'python',
            'description': '解压/压缩/格式转换/对比'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="compress",
        version="2.0.0",
        manifest={"label": "解压压缩", "description": "7z 解压/压缩/转换/对比"},
        frontend={"pages": [{"path": "", "title": "解压压缩"}]},
        iface_ids=["compress.dc.check", "compress.dc.list", "compress.dc.extract",
                   "compress.dc.compress", "compress.dc.convert", "compress.dc.compare",
                   "compress.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )