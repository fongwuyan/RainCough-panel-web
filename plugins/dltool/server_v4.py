#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dltool 插件后端(接口库 v4) — 复用同目录旧 server.py 的下载/分片/重命名/文档转换逻辑。

输入: base64 文件 {files:[{name,data}]}; 下载任务沿用主系统任务队列。
产物经 work/ 路由下载。
"""
import base64
import os
import re
import shutil
import sys
import threading
import uuid

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


def _dl_url(session, name):
    return '/api/plugins/dltool/work/%s/%s' % (os.path.basename(session), name)


@rc.interface("dltool.doc.check")
def dltool_doc_check(params):
    pandoc = M.find_tool('pandoc')
    if not pandoc:
        return {'ok': False, 'error': '未安装 pandoc'}
    r = M.run_cmd([pandoc, '--version'])
    version = r['output'].splitlines()[0] if r['output'].splitlines() else ''
    r2 = M.run_cmd([pandoc, '--list-output-formats'])
    formats = r2['output'].split()
    return {'ok': True, 'version': version, 'formats': formats}


@rc.interface("dltool.doc.convert")
def dltool_doc_convert(params):
    pandoc = M.find_tool('pandoc')
    if not pandoc:
        _err('未安装 pandoc')
    to = str(_p(params).get('to') or 'html').strip()
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传文档')
        results = []
        outputs = []
        for item in saved:
            src = item['path']
            ext = os.path.splitext(item['filename'])[1][1:].lower()
            from_fmt = M.EXT_MAP.get(ext, 'markdown')
            base = os.path.splitext(item['filename'])[0]
            out = os.path.join(session, '%s.%s' % (base, to))
            r = M.run_cmd([pandoc, src, '-f', from_fmt, '-t', to, '-o', out], timeout=600)
            ok = os.path.isfile(out) and os.path.getsize(out) > 0
            results.append({'name': item['filename'], 'ok': ok,
                            'error': '' if ok else M.clean_err(r, session),
                            'output': os.path.basename(out) if ok else ''})
            if ok:
                outputs.append(out)
        if len(outputs) == 1:
            return {'ok': True, 'results': results, 'single': True,
                    'download': _dl_url(session, os.path.basename(outputs[0]))}
        zip_path = os.path.join(session, 'converted.zip')
        M.make_zip_from_files(outputs, zip_path)
        return {'ok': True, 'results': results, 'download': _dl_url(session, 'converted.zip')}
    finally:
        pass


@rc.interface("dltool.nt.download")
def dltool_nt_download(params):
    urls = [u for u in (_p(params).get('urls') or []) if isinstance(u, str) and u.strip()]
    if not urls:
        _err('请提供下载链接')
    pack = bool(_p(params).get('pack'))
    session = M.new_session(M.PLUGIN)

    def _work():
        tid = M._taskmod.begin('yulotool', '下载 %d 个文件' % len(urls), kind='download')
        import requests as reqs
        results = []
        success = 0
        total = len(urls)
        for i, url in enumerate(urls):
            if not url:
                continue
            M._taskmod.update(tid, phase='downloading %d/%d' % (i + 1, total),
                              message='正在下载 %s' % url[:60], progress=int(i / total * 100))
            try:
                from urllib.parse import urlparse, unquote
                path = urlparse(url).path
                name = unquote(os.path.basename(path)) if path else ''
                if not name:
                    name = 'download_%s' % uuid.uuid4().hex[:8]
                name = re.sub(r'[^\w.\-\u4e00-\u9fff]', '_', name)[:120]
                dest = os.path.join(session, name)
                resp = reqs.get(url, timeout=300, stream=True, headers={'User-Agent': 'Mozilla/5.0'})
                resp.raise_for_status()
                size = 0
                with open(dest, 'wb') as f:
                    for chunk in resp.iter_content(M.FILE_CHUNK):
                        if chunk:
                            f.write(chunk)
                            size += len(chunk)
                results.append({'url': url, 'ok': True, 'name': name, 'size': size})
                success += 1
            except Exception as e:
                results.append({'url': url, 'ok': False, 'error': str(e)[:200]})
        M._taskmod.update(tid, progress=100, phase='packing')
        try:
            if pack and success:
                tool = M.find_tool('7z')
                archive = os.path.join(session, 'downloaded.7z')
                files = [os.path.join(session, r['name']) for r in results if r['ok']]
                if tool and files:
                    M.run_cmd([tool, 'a', archive] + files)
                else:
                    archive = os.path.join(session, 'downloaded.zip')
                    M.make_zip_from_files(files, archive)
                M._taskmod.finish(tid, True, message='完成 %d/~%d' % (success, total), progress=100)
                return
        except Exception:
            pass
        M._taskmod.finish(tid, True, message='完成 %d/%d' % (success, total), progress=100)

    threading.Thread(target=_work, daemon=True).start()
    return {'ok': True, 'message': '已开始下载 %d 个文件，稍后在任务队列中查看进度' % len(urls)}


@rc.interface("dltool.nt.split")
def dltool_nt_split(params):
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传文件')
        try:
            chunk_mb = float(_p(params).get('chunkSize') or 100)
        except (TypeError, ValueError):
            chunk_mb = 100
        if chunk_mb <= 0:
            chunk_mb = 100
        chunk_size = max(1, int(chunk_mb * 1024 * 1024))
        parts = []
        for item in saved:
            src = item['path']
            base = os.path.join(session, os.path.splitext(item['filename'])[0])
            with open(src, 'rb') as fh:
                part = 0
                while True:
                    part += 1
                    out_path = '%s.part%03d' % (base, part)
                    written = 0
                    with open(out_path, 'wb') as out:
                        while written < chunk_size:
                            b = fh.read(min(M.FILE_CHUNK, chunk_size - written))
                            if not b:
                                break
                            out.write(b)
                            written += len(b)
                    parts.append(out_path)
                    if written < chunk_size:
                        break
        zip_path = os.path.join(session, 'parts.zip')
        M.make_zip_from_files(parts, zip_path)
        return {'ok': True, 'parts': len(parts), 'download': _dl_url(session, 'parts.zip')}
    finally:
        pass


@rc.interface("dltool.nt.join")
def dltool_nt_join(params):
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传分片文件')
        out_name = str(_p(params).get('name') or 'joined').strip() or 'joined'
        out = os.path.join(session, out_name)
        for item in sorted(saved, key=lambda s: s['filename']):
            with open(item['path'], 'rb') as src, open(out, 'ab') as dst:
                shutil.copyfileobj(src, dst, M.FILE_CHUNK)
        return {'ok': True, 'files': len(saved), 'size': os.path.getsize(out),
                'download': _dl_url(session, os.path.basename(out))}
    finally:
        pass


@rc.interface("dltool.nt.rename")
def dltool_nt_rename(params):
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传文件')
        mode = str(_p(params).get('mode') or 'prefix')
        value = str(_p(params).get('value') or '')
        value2 = str(_p(params).get('value2') or '')
        try:
            start_index = int(_p(params).get('index') or 1)
        except (TypeError, ValueError):
            start_index = 1
        results = []
        outputs = []
        for i, item in enumerate(saved):
            old = item['filename']
            base, ext = os.path.splitext(old)
            new_base = base
            if mode == 'prefix':
                new_base = value + base
            elif mode == 'suffix':
                new_base = base + value
            elif mode == 'replace':
                new_base = base.replace(value, value2)
            elif mode == 'case':
                new_base = base.upper() if value == 'upper' else base.lower()
            elif mode == 'regex':
                try:
                    new_base = re.sub(value, value2, base)
                except re.error:
                    new_base = base
            elif mode == 'number':
                width = 3
                try:
                    width = int(value2 or 3)
                except (TypeError, ValueError):
                    pass
                new_base = '%s%0*d' % (value, width, start_index + i)
            new_name = new_base + ext
            new_path = os.path.join(session, new_name)
            if new_path != item['path']:
                shutil.move(item['path'], new_path)
            results.append({'old': old, 'new': new_name, 'ok': True})
            outputs.append(new_path)
        zip_path = os.path.join(session, 'renamed.zip')
        M.make_zip_from_files(outputs, zip_path)
        return {'ok': True, 'results': results, 'download': _dl_url(session, 'renamed.zip')}
    finally:
        pass


@rc.interface("dltool.nt.delete")
def dltool_nt_delete(params):
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传要安全删除的文件')
        try:
            passes = int(_p(params).get('passes') or 3)
        except (TypeError, ValueError):
            passes = 3
        passes = max(1, min(passes, 35))
        results = []
        for item in saved:
            deleted = M.secure_wipe(item['path'], passes)
            results.append({'name': item['filename'], 'deleted': deleted})
        return {'ok': True, 'results': results}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("dltool.info")
def dltool_info(params):
    return {'name': 'dltool', 'label': '下载工具', 'version': '2.0.0', 'lang': 'python',
            'description': '下载/分片/重命名与文档转换'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="dltool",
        version="2.0.0",
        manifest={"label": "下载工具", "description": "下载/分片/重命名/文档转换"},
        frontend={"pages": [{"path": "", "title": "下载工具"}]},
        iface_ids=["dltool.doc.check", "dltool.doc.convert", "dltool.nt.download",
                   "dltool.nt.split", "dltool.nt.join", "dltool.nt.rename",
                   "dltool.nt.delete", "dltool.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )