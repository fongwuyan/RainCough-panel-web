#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""texttool 插件后端(接口库 v4) — 复用同目录旧 server.py 的思路, 输入改为 JSON 文本。

文本工具: 正则查找 / 文本替换 / JSON<->YAML 转换 / 文本统计。
(原"上传文件替换并打包下载"简化为粘贴文本替换, 文件通道后续轮补)
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _s(params, key):
    return str(_p(params).get(key, '') or '')


@rc.interface("texttool.regex")
def texttool_regex(params):
    pattern = _s(params, 'pattern')
    text = _s(params, 'text')
    try:
        flags = int(_p(params).get('flags') or 0)
    except (TypeError, ValueError):
        flags = 0
    if not pattern:
        _err('正则表达式不能为空')
    try:
        rx = re.compile(pattern, flags)
    except re.error as e:
        _err('正则错误: %s' % e)
    matches = []
    for m in rx.finditer(text):
        matches.append({'start': m.start(), 'end': m.end(),
                        'match': m.group(0), 'groups': list(m.groups())})
    return {'ok': True, 'pattern': pattern, 'count': len(matches), 'matches': matches[:200]}


@rc.interface("texttool.replace")
def texttool_replace(params):
    content = _s(params, 'content')
    find = _s(params, 'find')
    replace = _s(params, 'replace')
    use_regex = bool(_p(params).get('regex', False))
    if not find:
        _err('查找内容不能为空')
    if use_regex:
        try:
            rx = re.compile(find)
        except re.error as e:
            _err('正则错误: %s' % e)
        new = rx.sub(replace, content)
    else:
        new = content.replace(find, replace)
    return {'ok': True, 'replaced': content != new, 'output': new}


@rc.interface("texttool.convert")
def texttool_convert(params):
    content = _s(params, 'content')
    action = _p(params).get('action') or 'json2yaml'
    if not content.strip():
        _err('内容不能为空')
    try:
        if action == 'json2yaml':
            import yaml
            out = yaml.safe_dump(json.loads(content), allow_unicode=True, sort_keys=False)
        elif action == 'yaml2json':
            import yaml
            out = json.dumps(yaml.safe_load(content), ensure_ascii=False, indent=2)
        elif action == 'jsonfmt':
            out = json.dumps(json.loads(content), ensure_ascii=False, indent=2)
        elif action == 'jsonmin':
            out = json.dumps(json.loads(content), ensure_ascii=False, separators=(',', ':'))
        else:
            _err('未知操作')
    except Exception as e:
        _err('转换失败: %s' % e)
    return {'ok': True, 'output': out}


@rc.interface("texttool.stats")
def texttool_stats(params):
    content = _s(params, 'content')
    chars = len(content)
    chars_no_space = len(re.sub(r'\s', '', content))
    words = re.findall(r'\w+', content, re.UNICODE)
    lines = content.splitlines()
    ch_freq = {}
    for ch in re.sub(r'\s', '', content):
        ch_freq[ch] = ch_freq.get(ch, 0) + 1
    top_chars = sorted(ch_freq.items(), key=lambda x: -x[1])[:20]
    return {'ok': True, 'chars': chars, 'chars_no_space': chars_no_space,
            'words': len(words), 'lines': len(lines),
            'bytes': len(content.encode('utf-8')),
            'top_chars': [{'char': c, 'count': n} for c, n in top_chars]}


@rc.interface("texttool.info")
def texttool_info(params):
    return {'name': 'texttool', 'label': '文本工具', 'version': '2.0.0', 'lang': 'python',
            'description': '正则替换/转换/统计'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="texttool",
        version="2.0.0",
        manifest={"label": "文本工具", "description": "正则/替换/转换/统计"},
        frontend={"pages": [{"path": "", "title": "文本工具"}]},
        iface_ids=["texttool.regex", "texttool.replace", "texttool.convert",
                   "texttool.stats", "texttool.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )