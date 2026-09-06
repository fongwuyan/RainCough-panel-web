#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""touchgal 插件后端(接口库 v4) — 由 v3 server.py 迁移。

上游: touchgal.ink 官方 API + animetrace 识图(curl_cffi impersonate)。
"""
import os
import sys
import json
import concurrent.futures
from curl_cffi import requests as cr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc

TOUCHGAL_API = 'https://www.touchgal.ink/api'
ANIMETRACE_API = 'https://api.animetrace.com/v1/search'

HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'X-Requested-With': 'kun-fetch',
    'Origin': 'https://www.touchgal.ink',
    'Referer': 'https://www.touchgal.ink/',
}


def _p(params):
    return params if isinstance(params, dict) else {}


@rc.interface("touchgal.search")
def tg_search(params):
    try:
        data = _p(params)
        keyword = data.get('keyword', '')
        limit = data.get('limit', 15)
        nsfw = data.get('nsfw', False)
        payload = {
            'queryString': json.dumps([{'type': 'keyword', 'name': keyword}]),
            'limit': limit, 'page': 1, 'selectedType': 'all',
            'selectedLanguage': 'all', 'selectedPlatform': 'all',
            'sortField': 'resource_update_time', 'sortOrder': 'desc',
            'selectedYears': ['all'], 'selectedMonths': ['all'],
            'minRatingCount': 0,
            'searchOption': {'searchInIntroduction': True, 'searchInAlias': True, 'searchInTag': True},
        }
        cookie = 'kun-patch-setting-store|state|data|kunNsfwEnable=all' if nsfw else 'kun-patch-setting-store|state|data|kunNsfwEnable=sfw'
        r = cr.post('%s/search' % TOUCHGAL_API, json=payload,
                    headers={**HEADERS, 'Cookie': cookie}, impersonate='chrome120', timeout=30)
        return r.json()
    except Exception as e:
        raise rc.RCError(3000, str(e))


@rc.interface("touchgal.resource")
def tg_resource(params):
    try:
        patch_id = str(_p(params).get('patchId', ''))
        r = cr.get('%s/patch/resource?patchId=%s' % (TOUCHGAL_API, patch_id),
                   headers=HEADERS, impersonate='chrome120', timeout=30)
        data = r.json()
        normalized = []
        for item in data if isinstance(data, list) else []:
            links = item.get('links', [])
            first_link = links[0] if links else {}
            platform_list = item.get('platform', [])
            if isinstance(platform_list, list):
                platform_list = ', '.join(platform_list)
            language_list = item.get('language', [])
            if isinstance(language_list, list):
                language_list = ', '.join(language_list)
            normalized.append({
                'name': item.get('name', '未知资源'),
                'platform': platform_list if platform_list else '未知平台',
                'language': language_list if language_list else '未知语言',
                'size': first_link.get('size', item.get('size', '未知大小')),
                'content': first_link.get('content', ''),
                'code': first_link.get('code', '无'),
                'password': first_link.get('password', '无'),
                'note': item.get('note', '无备注'),
            })
        return {'resources': normalized}
    except Exception as e:
        raise rc.RCError(3000, str(e))


@rc.interface("touchgal.recognize")
def tg_recognize(params):
    try:
        data = _p(params)
        image_url = data.get('imageUrl', '')
        model = data.get('model', 'pre_stable')
        q = {'url': image_url, 'is_multi': '1', 'model': model, 'ai_detect': '0'}
        r = cr.post(ANIMETRACE_API, data=q, impersonate='chrome120', timeout=30)
        return r.json()
    except Exception as e:
        raise rc.RCError(3000, str(e))


@rc.interface("touchgal.recognize.dual")
def tg_recognize_dual(params):
    try:
        image_url = str(_p(params).get('imageUrl', ''))

        def do_recognize(model):
            q = {'url': image_url, 'is_multi': '1', 'model': model, 'ai_detect': '0'}
            r = cr.post(ANIMETRACE_API, data=q, impersonate='chrome120', timeout=30)
            return r.json()

        with concurrent.futures.ThreadPoolExecutor() as executor:
            anime_future = executor.submit(do_recognize, 'pre_stable')
            gal_future = executor.submit(do_recognize, 'full_game_model_kira')
            anime_result = anime_future.result()
            gal_result = gal_future.result()
        return {'anime': anime_result, 'gal': gal_result}
    except Exception as e:
        raise rc.RCError(3000, str(e))


@rc.interface("touchgal.info")
def tg_info(params):
    return {'name': 'touchgal', 'label': 'TouchGal 游戏查找', 'version': '2.0.0', 'lang': 'python',
            'description': '搜索 Galgame 游戏资源、获取下载链接、图片识别'}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="touchgal",
        version="2.0.0",
        manifest={"label": "TouchGal 游戏查找", "description": "Galgame 资源搜索/识别"},
        frontend={"pages": [{"path": "", "title": "游戏查找"}]},
        iface_ids=["touchgal.search", "touchgal.resource", "touchgal.recognize",
                   "touchgal.recognize.dual", "touchgal.info"],
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )