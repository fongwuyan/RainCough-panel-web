#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""webspy 插件后端(接口库 v4) — 直接复用同目录旧 server.py 的全量逻辑。"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc
import server as M  # 旧后端全量逻辑(仅 import, 不启动)


def _p(params):
    return params if isinstance(params, dict) else {}


def _qstr(params, key, defval=''):
    return str(_p(params).get(key, defval) or defval).strip()


def _err(msg):
    raise rc.RCError(3000, msg)


@rc.interface("webspy.search")
def webspy_search(params):
    query = _qstr(params, 'q')
    if not query:
        _err('搜索关键词不能为空')
    try:
        limit = int(_p(params).get('limit') or 10)
    except (TypeError, ValueError):
        limit = 10
    limit = max(1, min(limit, 20))
    return M._parse_bing(query, limit)


@rc.interface("webspy.urlcheck")
def webspy_urlcheck(params):
    urls = [u for u in (_p(params).get('urls') or []) if isinstance(u, str) and u.strip()]
    if not urls:
        _err('请提供 URL 列表')
    results = []
    for url in urls[:20]:
        started = time.time()
        entry = {'url': url}
        try:
            r = M.requests.get(url, headers={'User-Agent': M.USER_AGENT},
                               timeout=15, allow_redirects=True, verify=False)
            entry['status'] = r.status_code
            entry['ok'] = 200 <= r.status_code < 400
            entry['ms'] = round((time.time() - started) * 1000)
            entry['final_url'] = r.url
            entry['size'] = len(r.content)
        except Exception as e:
            entry['ok'] = False
            entry['status'] = 0
            entry['ms'] = round((time.time() - started) * 1000)
            entry['error'] = str(e)[:150]
        results.append(entry)
    return {'ok': True, 'results': results}


@rc.interface("webspy.rss.list")
def webspy_rss_list(params):
    return {'ok': True, 'feeds': M._load_feeds()}


@rc.interface("webspy.rss.add")
def webspy_rss_add(params):
    url = _qstr(params, 'url')
    name = _qstr(params, 'name')
    if not url:
        _err('RSS 地址不能为空')
    parsed = M._fetch_feed(url)
    if parsed.bozo and not parsed.entries:
        _err('无法解析该 RSS 地址')
    title = (name or parsed.feed.get('title') or url)[:120]
    feeds = M._load_feeds()
    for f in feeds:
        if f['url'] == url:
            _err('该订阅源已存在')
    feeds.append({'url': url, 'name': title, 'added': int(time.time())})
    M._save_feeds(feeds)
    return {'ok': True, 'feeds': feeds}


@rc.interface("webspy.rss.delete")
def webspy_rss_delete(params):
    idx = _p(params).get('idx')
    feeds = M._load_feeds()
    if idx is None or not isinstance(idx, int) or idx < 0 or idx >= len(feeds):
        _err('订阅源不存在')
    feeds.pop(idx)
    M._save_feeds(feeds)
    return {'ok': True, 'feeds': feeds}


@rc.interface("webspy.rss.fetch")
def webspy_rss_fetch(params):
    url = _qstr(params, 'url')
    if not url:
        _err('RSS 地址不能为空')
    parsed = M._fetch_feed(url)
    if parsed.bozo and not parsed.entries:
        _err('解析失败或源不可达')
    entries = []
    for e in parsed.entries[:20]:
        entries.append({
            'title': e.get('title', ''),
            'link': e.get('link', ''),
            'summary': (e.get('summary') or e.get('description') or '')[:500],
            'published': e.get('published', ''),
            'published_ts': time.mktime(e.get('published_parsed', time.localtime())),
        })
    feeds = M._load_feeds()
    for f in feeds:
        if f['url'] == url:
            f['last_fetched'] = int(time.time())
    M._save_feeds(feeds)
    return {'ok': True, 'feed_title': parsed.feed.get('title', url), 'entries': entries}


@rc.interface("webspy.readability")
def webspy_readability(params):
    url = _qstr(params, 'url')
    if not url:
        _err('URL 不能为空')
    try:
        resp = M._http_get(url)
    except Exception as e:
        _err('抓取失败: %s' % e)
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(resp.text, 'html.parser')
    for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
        tag.decompose()
    title = soup.title.get_text(strip=True) if soup.title else url
    body = soup.body if soup.body else soup
    text = body.get_text(separator='\n', strip=True)
    text = __import__('re').sub(r'\n{3,}', '\n\n', text).strip()
    return {'ok': True, 'url': url, 'title': title, 'length': len(text), 'text': text[:50000]}


@rc.interface("webspy.info")
def webspy_info(params):
    return {'name': 'webspy', 'label': '采集解析', 'version': '2.0.0', 'lang': 'python',
            'description': '搜索/链接检测/RSS/正文提取'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="webspy",
        version="2.0.0",
        manifest={"label": "采集解析", "description": "搜索/链接检测/RSS/正文提取"},
        frontend={"pages": [{"path": "", "title": "采集解析"}]},
        iface_ids=["webspy.search", "webspy.urlcheck", "webspy.rss.list", "webspy.rss.add",
                   "webspy.rss.delete", "webspy.rss.fetch", "webspy.readability", "webspy.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )