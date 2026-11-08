# -*- coding: utf-8 -*-
"""联网搜索：抓 Bing 的 HTML 结果（服务器在国内，DuckDuckGo 不通）。

只做「给模型看的几条摘要」，不追求完整。失败就抛异常，由上层决定是否降级。
"""
import base64
import html as html_mod
import re
import urllib.parse

import aiohttp

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')

_BLOCK = re.compile(r'<li class="b_algo[^"]*".*?(?=<li class="b_algo|</ol>)', re.S)
_TITLE = re.compile(r'<h2[^>]*>.*?<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.S)
_SNIP = re.compile(r'<p[^>]*>(.*?)</p>', re.S)
_TAG = re.compile(r'<[^>]+>')


def _clean(s):
    s = _TAG.sub('', s or '')
    s = html_mod.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()


def _unwrap(url):
    """Bing 有时把结果包成 /ck/a?...&u=a1<base64>，还原真实地址。"""
    if 'bing.com/ck/a' not in url:
        return url
    try:
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        u = (qs.get('u') or [''])[0]
        if u.startswith('a1'):
            raw = u[2:]
            raw += '=' * (-len(raw) % 4)
            return base64.urlsafe_b64decode(raw).decode('utf-8', 'replace')
    except Exception:
        pass
    return url


async def bing(query, limit=5, timeout=15):
    url = 'https://cn.bing.com/search?q=' + urllib.parse.quote(query)
    headers = {'User-Agent': UA,
               'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
               'Accept': 'text/html,application/xhtml+xml'}
    async with aiohttp.ClientSession() as sess:
        async with sess.get(url, headers=headers,
                            timeout=aiohttp.ClientTimeout(total=timeout)) as r:
            if r.status >= 400:
                raise RuntimeError('Bing 返回 HTTP %s' % r.status)
            text = await r.text(errors='replace')

    out = []
    for blk in _BLOCK.findall(text):
        m = _TITLE.search(blk)
        if not m:
            continue
        link = _unwrap(m.group(1))
        title = _clean(m.group(2))
        if not title or not link.startswith('http'):
            continue
        sn = _SNIP.search(blk)
        out.append({'title': title[:120], 'url': link[:400],
                    'snippet': (_clean(sn.group(1)) if sn else '')[:280]})
        if len(out) >= limit:
            break
    return out


async def query(q, limit=5, timeout=15):
    q = (q or '').strip()
    if not q:
        raise RuntimeError('搜索关键词为空')
    res = await bing(q, limit=limit, timeout=timeout)
    if not res:
        raise RuntimeError('Bing 没有返回可用结果（可能被风控）')
    return res


def render(results):
    """把结果压成给模型看的纯文本。"""
    lines = []
    for i, r in enumerate(results or [], 1):
        lines.append('%d. %s\n   %s\n   %s' % (i, r.get('title'), r.get('url'),
                                              r.get('snippet') or ''))
    return '\n'.join(lines)
