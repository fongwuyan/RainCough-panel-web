#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""filehash 插件后端(接口库 v4) — 复用同目录旧 server.py 的哈希/目录分析逻辑。

输入: base64 文件列表 {files:[{name,data}]}; 生成物经 /api/plugins/filehash/work/<session>/<name> 下载。
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


def _save_files(params, session):
    files = _p(params).get('files') or []
    saved = []
    for it in files:
        name = it.get('name') if isinstance(it, dict) else 'file'
        data = it.get('data') if isinstance(it, dict) else it
        if data.startswith('data:'):
            data = data.split(',', 1)[1]
        raw = base64.b64decode(data)
        safe = os.path.basename(name)
        dest = os.path.join(session, safe)
        with open(dest, 'wb') as f:
            f.write(raw)
        saved.append({'field': 'files', 'filename': safe, 'path': dest})
    return saved


def _src_files(params, session):
    """返回 (saved, unpacked_root); zip 自动解压, 返回根目录。"""
    saved = _save_files(params, session)
    if not saved:
        _err('请上传文件或压缩包')
    unpacked = []
    for item in saved:
        p = item['path']
        if p.lower().endswith('.zip'):
            try:
                import zipfile
                with zipfile.ZipFile(p, 'r') as zf:
                    zf.extractall(os.path.join(session, 'unpack'))
                unpacked.append(p)
            except Exception as e:
                _err('解压失败 %s: %s' % (item['filename'], e))
    root = os.path.join(session, 'unpack') if unpacked else session
    return saved, root


@rc.interface("filehash.da.stats")
def filehash_da_stats(params):
    session = M.new_session(M.PLUGIN)
    try:
        _, root = _src_files(params, session)
        total_files = 0
        total_size = 0
        type_count = {}
        type_size = {}
        for fp in M.walk_files(root):
            if not os.path.isfile(fp):
                continue
            total_files += 1
            size = os.path.getsize(fp)
            total_size += size
            cat = M.classify_ext(os.path.splitext(fp)[1])
            type_count[cat] = type_count.get(cat, 0) + 1
            type_size[cat] = type_size.get(cat, 0) + size
        categories = []
        for name in ['图片', '视频', '音频', '文档', '压缩包', '代码', '其他']:
            categories.append({'name': name, 'count': type_count.get(name, 0),
                               'size': type_size.get(name, 0)})
        files = [{'name': os.path.relpath(fp, root), 'size': os.path.getsize(fp),
                  'type': M.classify_ext(os.path.splitext(fp)[1])}
                 for fp in M.walk_files(root) if os.path.isfile(fp)]
        return {'ok': True, 'total_files': total_files, 'total_size': total_size,
                'categories': categories, 'files': files}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("filehash.da.duplicate")
def filehash_da_duplicate(params):
    session = M.new_session(M.PLUGIN)
    try:
        _, root = _src_files(params, session)
        size_groups = {}
        for fp in M.walk_files(root):
            if not os.path.isfile(fp):
                continue
            size_groups.setdefault(os.path.getsize(fp), []).append(fp)
        duplicates = []
        for size, files in size_groups.items():
            if len(files) < 2:
                continue
            hash_groups = {}
            for p in files:
                hash_groups.setdefault(M.md5_file(p), []).append(p)
            for h, paths in hash_groups.items():
                if len(paths) < 2:
                    continue
                duplicates.append({'hash': h, 'size': size,
                                   'files': [{'name': os.path.relpath(p, root), 'size': size} for p in paths]})
        return {'ok': True, 'total_groups': len(duplicates), 'duplicates': duplicates}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("filehash.h.calc")
def filehash_h_calc(params):
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传文件')
        results = []
        for item in saved:
            p = item['path']
            results.append({'name': item['filename'], 'size': os.path.getsize(p),
                            'md5': M.hash_file(p, 'md5'),
                            'sha1': M.hash_file(p, 'sha1'),
                            'sha256': M.hash_file(p, 'sha256')})
        return {'ok': True, 'results': results}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("filehash.h.generate")
def filehash_h_generate(params):
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传文件')
        algo = str(_p(params).get('algo') or 'sha256').lower()
        if algo not in M.ALGOS:
            algo = 'sha256'
        lines = []
        for item in saved:
            h = M.hash_file(item['path'], algo)
            name = item['filename']
            lines.append('%s  %s' % (h, name) if algo != 'md5' else '%s *%s' % (h, name))
        out_path = os.path.join(session, 'checksums.%s' % algo)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        return {'ok': True, 'count': len(lines), 'algo': algo,
                'download': '/api/plugins/filehash/work/%s/%s' % (os.path.basename(session), os.path.basename(out_path))}
    finally:
        pass  # 保留 session 供下载; 由前端/清理策略回收


@rc.interface("filehash.h.verify")
def filehash_h_verify(params):
    session = M.new_session(M.PLUGIN)
    try:
        saved = _save_files(params, session)
        if not saved:
            _err('请上传校验文件与数据文件')
        check_file = None
        data_files = []
        for item in saved:
            base = item['filename'].lower()
            if base.endswith(('.md5', '.sha1', '.sha256')):
                check_file = item
            else:
                data_files.append(item)
        if not check_file:
            _err('缺少校验文件 (.md5/.sha1/.sha256)')
        algo = os.path.splitext(check_file['filename'])[1][1:].lower()
        content = open(check_file['path'], 'r', encoding='utf-8', errors='replace').read()
        by_name = {f['filename']: f['path'] for f in data_files}
        import re
        results = []
        for line in content.splitlines():
            line = line.strip()
            if not line:
                continue
            m = re.match(r'^([a-fA-F0-9]+)\s+[\* ](.+)$', line)
            if not m:
                continue
            expected = m.group(1).lower()
            name = m.group(2).strip()
            fpath = by_name.get(name)
            if not fpath or not os.path.isfile(fpath):
                results.append({'file': name, 'status': 'missing', 'expected': expected})
                continue
            actual = M.hash_file(fpath, algo)
            results.append({'file': name, 'status': 'ok' if actual == expected else 'mismatch',
                            'expected': expected, 'actual': actual})
        ok = sum(1 for r in results if r['status'] == 'ok')
        return {'ok': True, 'total': len(results), 'passed': ok,
                'failed': len(results) - ok, 'algo': algo, 'results': results}
    finally:
        shutil.rmtree(session, ignore_errors=True)


@rc.interface("filehash.info")
def filehash_info(params):
    return {'name': 'filehash', 'label': '文件校验', 'version': '2.0.0', 'lang': 'python',
            'description': '哈希/生成/校验与目录统计查重'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="filehash",
        version="2.0.0",
        manifest={"label": "文件校验", "description": "哈希/校验/查重"},
        frontend={"pages": [{"path": "", "title": "文件校验"}]},
        iface_ids=["filehash.da.stats", "filehash.da.duplicate", "filehash.h.calc",
                   "filehash.h.generate", "filehash.h.verify", "filehash.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )