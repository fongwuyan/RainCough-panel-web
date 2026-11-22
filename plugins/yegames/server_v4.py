#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""叶酱游戏（yegames）插件后端 v1.1 —— 接口库 v4。

v1.1 相对 v1.0 的变化：
  1. 多源挖掘：83youxi / sncyyx / zfsya（WordPress REST）+ mgamehub（ZBlog HTML 搜索），
     每个源独立进度、独立解压密码；合并时按作品名去重，保留全部来源。
  2. 真实挖掘 + 实时进度：挖掘跑在后台线程，前端轮询 mine.status 拿
     阶段 / 已完成 / 总数 / 百分比 / 明细日志（每个源、每个桶都上报）。
  3. 卡片库持久化：library.json 保存已挖到的卡片；重新挖掘做 upsert，
     内容变化的卡片标记 updated，本轮没再出现的标记 stale（保留不删）。
  4. 内置下载器：dl.start 起后台下载（Range 断点续传、限速并发、可取消），
     dl.status 给实时字节/速度/ETA，完成后落盘并回报路径。
  5. 解压密码：每个源声明密码，卡片与下载器窗口都会显示。

只用标准库；不内置任何游戏文件。
"""
import hashlib
import json
import os
import re
import shutil
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rcplugin as rc

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(PLUGIN_DIR, 'config.json')
LIBRARY_FILE = os.path.join(PLUGIN_DIR, 'library.json')
INDEX_FILE = os.path.join(PLUGIN_DIR, 'alist_index.json')
BINDINGS_FILE = os.path.join(PLUGIN_DIR, 'bindings.json')
DOWNLOADS_FILE = os.path.join(PLUGIN_DIR, 'downloads.json')

NAME = 'yegames'
LABEL = '叶酱游戏'
VERSION = '1.3.2'

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')

# ---- 默认源（都是实测可用的公开搜索接口） ----------------------------------
DEFAULT_SOURCES = [
    {'id': '83youxi', 'label': '83youxi', 'kind': 'wp',
     'base': 'https://www.83youxi.com', 'search': '叶酱', 'password': 'gacg',
     'enabled': True},
    {'id': 'sncyyx', 'label': 'sncyyx（日式SLG/RPG）', 'kind': 'wp',
     'base': 'https://www.sncyyx.com', 'search': '叶酱', 'password': 'www.facg.ru',
     'enabled': True},
    {'id': 'zfsya', 'label': '宅方社（云翻）', 'kind': 'wp',
     'base': 'https://www.zfsya.moe', 'search': '叶酱', 'password': '见资源页',
     'enabled': True},
    {'id': 'mgamehub', 'label': 'mgamehub', 'kind': 'zblog',
     'base': 'https://www.mgamehub.com', 'search': '叶酱', 'password': '见资源页',
     'enabled': True},
    {'id': 'nwweb', 'label': 'nw-web', 'kind': 'html',
     'base': 'https://www.nw-web.com', 'search': '叶酱', 'password': '见资源页',
     'search_tpl': '/?s={q}', 'enabled': True},
    {'id': 'speardhub', 'label': 'speardhub', 'kind': 'zblog',
     'base': 'https://www.speardhub.com', 'search': '叶酱', 'password': '见资源页',
     'enabled': True},
    {'id': 'galgamezywz', 'label': 'galgamezywz（直链友好）', 'kind': 'html',
     'base': 'https://game.galgamezywz.org', 'search': '叶酱', 'password': '见资源页',
     'search_tpl': '/?s={q}', 'enabled': True},
]

DEFAULT_CONFIG = {
    'alist_host': 'h.suyunm.com',
    'alist_hosts': ['h.suyunm.com', 'm.mydizhi.com'],
    'index_ttl_min': 720,
    'max_items': 400,
    'show_cover': True,
    'timeout_sec': 25,
    'sources': DEFAULT_SOURCES,
    'download_dir': os.path.join(PLUGIN_DIR, 'downloads'),
    'max_parallel_dl': 2,
    'dl_segments': 4,
    'dl_min_split_mb': 16,
    'dl_stall_sec': 45,
    'verify_zblog_pages': 15,
    'cover_backfill_pages': 30,
    'force_ipv4': True,
    # 直链猎手：需要登录/会员才能看到网盘链接的源，把浏览器里的 Cookie 粘进来即可复用登录态
    'cookies': {},
    # TouchGal 公开 API（需要 curl_cffi 的 TLS 指纹，装了就自动启用）
    'touchgal': {'enabled': True, 'api': 'https://www.touchgal.ink/api', 'nsfw': True},
}

# ---- 已人工核对的作品 → 镜像目录 --------------------------------------------
ALIASES = [
    (('青之结纳', '青の結納'), '/A1w-1w1/QingZhiJieNa-v1-03'),
    (('洛丽塔的救世主',), '/A6-7QIAN/LuoLiTa-v1-08'),
    (('繁育人生',), '/A6-7QIAN/FanYuRenSheng-v1-15'),
    (('姐妹罗盘',), '/A6-7QIAN/JieMeiLuoPan-v1-02'),
    (('房车之家', 'Motor home'), '/A4-5QIAN/Motor-home-ver1_16'),
    (('小小神明的创造方法', '小さな神さま'), '/A6-7QIAN/XiaoXiaoShenMing-v1-07'),
    (('双子沉眠',), '/A3-4QIAN/ShuangZisShuiMian-Ver1_01'),
    (('白泳衣食者', 'シロスクイーター'), '/A4-5QIAN/BaiYongYiShiZhe-Ver1-05'),
    (('悠露子的校园露出生活', '悠露子'), '/A4-5QIAN/YouLuZiLuChu'),
    (('挑战勇者试炼',), ['/A5-6QIAN/YongZheShiLian-v2-0f1', '/A4-5QIAN/TiaoZhanYongZhe-V1-6']),
    (('想要一场模版化的恋爱', 'テンプレートな恋'), '/A6-7QIAN/MoBanHuaLianAi'),
    (('黑皮小恶魔学妹柚木', 'ゆずき'), '/A6-7QIAN/HeiPiXueMei-YouMu'),
    (('抓捕器', 'キャッチャー'), '/A6-7QIAN/UOHCatcher'),
    (('爱宠奴隶', '愛玩奴隷', '爱玩奴隶'), '/A7-8QIAN/AiChongNuLi'),
    (('白色死库水', '白スクRPG'), '/A4-5QIAN/BaiSeSiKuShuiRPG-ver2-01'),
    (('卡牌皇后',), '/A4-5QIAN/KaPaiHuangHou-Ver1-12'),
    (('和妹妹一起看家！2', '一起看家！2'), '/A3-4QIAN/HeMeiMeiYiQiKanJia-2'),
    (('爱丽丝与恶魔的牢狱', 'アリスと悪魔の牢獄'), '/A5-6QIAN/AiLiSi-LaoYu-v1-0-0'),
    (('侵蚀馆', '侵蝕済み'), '/A9-1WAN/QinShiGuan'),
    (('不服输的库库鲁',), '/A4-5QIAN/BuFuShuDeKuKuLu-Ver1-00'),
    (('好想被伊莉雅打败',), '/A4-5QIAN/BeiYiLiYaDaBai-ver1_17'),
    (('斯特拉的漂流日记', 'ステラの漂流日記'), '/A5-6QIAN/SiTeLaDePiaoLiuRiJi'),
    (('莉莉逃脱', 'リリエスケープ'), '/A5-6QIAN/LiLiTaoTuo-v1-03'),
    (('无知萝莉与怪物', '無知ロリと化け物'), '/A5-6QIAN/WuZhiLuoLiYuGuaiWu'),
    (('催眠NTR',), '/A6-7QIAN/CuiMian-NTR-v1-0-7'),
    (('健康检查',), '/A8-9QIAN/LuoLiJianCha-v1-02'),
    (('罗丽诱拐', '绑架恶作剧'), '/A6-7QIAN/LuoLiYouGuai-ErzuoJu'),
    (('阿尔姆利亚',), '/A4-5QIAN/AEMuLiYa-MoWang'),
    (('嘴馋的傲慢天使酱', '嘴馋'), '/A7-8QIAN/ZuiChanTianShiJiang'),
    (('爱惟酱', '不思議な館'), '/A1w-1w1/AiWeiJiang-v1-1'),
    (('奴隶少女与调教之村', '調教の村'), '/A7-8QIAN/ShaoNvTiaoJiaoCun-v1-5'),
    (('勇者米娅', '米娅与傲娇猫耳魅魔'), '/A5-6QIAN/MiYa-MaoErMeiMo'),
    (('最讨厌哥哥',), '/A4-5QIAN/ZuiTaoYanGeGeLa'),
    (('白的渴望', '白の渇望'), '/A4-5QIAN/BaiDeKeWang-Ver1-04'),
    (('求生吧', '无人岛'), '/A6-7QIAN/WuRenDao-XingCun-v1-0'),
    (('被寝取的幼妻', '寝取らせ幼妻'), '/A5-6QIAN/BeiJinQuDeYouQi'),
    (('在水族馆向海星许愿',), '/A4-5QIAN/Aquarium-ver1-00'),
    (('Little sister', '失忆少女'), '/A4-5QIAN/Little-sister-Ver1-00'),
    (('喵孕', '育爱日常'), '/A4-5QIAN/MaoYun-YuAiRiChang'),
    (('见习冒险者', '哥布林们'), '/A6-7QIAN/MaoXianZhe-GeBuLin'),
]

RE_SIZE = re.compile(r'([0-9]+(?:\.[0-9]+)?)\s*([GMKT])\s*B?', re.I)
RE_VER = re.compile(r'(?:ver\.?|v)\s?([0-9]+(?:\.[0-9]+)+(?:[a-z][0-9]*)?)', re.I)
RE_BRACKET = re.compile(r'【[^】]*】')
RE_IMG = re.compile(
    r'(?:data-src|data-original|src)="((?:https?:)?//[^"]+?\.(?:jpg|jpeg|png|webp))"', re.I)
RE_OG_IMAGE = re.compile(
    r'<meta[^>]+(?:property|name)="(?:og:image|twitter:image)"[^>]+content="([^"]+)"', re.I)
# 封面挑图时要跳过的：占位图、logo、头像、图标、loading 之类
COVER_SKIP = re.compile(
    r'(thumbnail|placeholder|logo|avatar|/img/|icon|loading|lazyload|spinner|blank|'
    r'default|noimage|no-image|1x1|pixel|\.gif$)', re.I)
RE_ZBLOG_HREF = re.compile(
    r'href="(https?://[^"]+?/\d{4}/[a-z]+(?:/\d{1,2})?/\d+\.html)"', re.I)
RE_TITLE_TAG = re.compile(r'<title[^>]*>(.*?)</title>', re.I | re.S)
RE_OG_TITLE = re.compile(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', re.I)
COVER_HOST_OK = ('gimg.tukuimg.com', 'pic.gtuku.com', 'nqtu.', 'wp-content/uploads', 'fang.yongacg.top')


# ---- 基础工具 ---------------------------------------------------------------
# ---- 网络：强制 IPv4 --------------------------------------------------------
# 实测（生产 192.168.2.200）：这台机器有公网 IPv6，但到 Cloudflare R2 / Backblaze B2
# 的 v6 路径极慢——同一 64KB Range 请求默认 17~34 秒才拿到首字节，强制 IPv4 只要 1 秒。
# 浏览器/curl 有 Happy Eyeballs 会秒切 v4，Python urllib 不会，于是“浏览器能下、
# 插件迟迟不开始”。这里把 getaddrinfo 收敛到 AF_INET（找不到 A 记录时再退回默认）。
_IPV4_PATCHED = False


def install_ipv4_only():
    global _IPV4_PATCHED
    if _IPV4_PATCHED or getattr(socket, '_rc_ipv4_patched', False):
        return True
    orig = socket.getaddrinfo

    def patched(host, port, family=0, type=0, proto=0, flags=0):
        try:
            res = orig(host, port, socket.AF_INET, type, proto, flags)
            if res:
                return res
        except Exception:
            pass
        return orig(host, port, family, type, proto, flags)

    socket.getaddrinfo = patched
    socket._rc_ipv4_patched = True
    _IPV4_PATCHED = True
    return True


def apply_net_policy(cfg=None):
    cfg = cfg or load_config()
    if cfg.get('force_ipv4', True):
        install_ipv4_only()


def _read_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def _write_json(path, data):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def http_json(url, payload=None, timeout=25):
    data = None
    headers = {'User-Agent': UA, 'Accept': 'application/json'}
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8', 'replace'))


def http_text(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', 'replace')


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    saved = _read_json(CONFIG_FILE, {}) or {}
    cfg.update(saved)
    return normalize_config(cfg)


def normalize_config(cfg):
    out = dict(DEFAULT_CONFIG)
    out.update(cfg or {})
    hosts = out.get('alist_hosts') or DEFAULT_CONFIG['alist_hosts']
    if not isinstance(hosts, list):
        hosts = DEFAULT_CONFIG['alist_hosts']
    hosts = [str(h).strip().strip('/') for h in hosts if str(h).strip()]
    out['alist_hosts'] = hosts or list(DEFAULT_CONFIG['alist_hosts'])
    if out.get('alist_host') not in out['alist_hosts']:
        out['alist_host'] = out['alist_hosts'][0]
    for k, lo, hi in (('index_ttl_min', 5, 1440), ('max_items', 20, 1000),
                      ('timeout_sec', 5, 120), ('max_parallel_dl', 1, 4),
                      ('verify_zblog_pages', 0, 40), ('cover_backfill_pages', 0, 120),
                      ('dl_stall_sec', 10, 300), ('dl_segments', 1, 16),
                      ('dl_min_split_mb', 1, 512)):
        try:
            out[k] = max(lo, min(hi, int(out.get(k))))
        except Exception:
            out[k] = DEFAULT_CONFIG[k]
    for k in ('show_cover',):
        out[k] = bool(out.get(k))
    out['force_ipv4'] = bool(out.get('force_ipv4', True))
    dl = str(out.get('download_dir') or '').strip()
    out['download_dir'] = dl or os.path.join(PLUGIN_DIR, 'downloads')
    srcs = out.get('sources')
    if not isinstance(srcs, list) or not srcs:
        srcs = [dict(s) for s in DEFAULT_SOURCES]
    clean = []
    for s in srcs:
        if not isinstance(s, dict) or not s.get('id') or not s.get('base'):
            continue
        item = {
            'id': str(s['id']), 'label': str(s.get('label') or s['id']),
            'kind': str(s.get('kind') or 'wp') if str(s.get('kind')) in ('wp', 'zblog', 'html') else 'wp',
            'base': str(s['base']).rstrip('/'),
            'search': str(s.get('search') or '叶酱'),
            'password': str(s.get('password') or ''),
            'search_tpl': str(s.get('search_tpl') or '/search.php?q={q}'),
            'verify_pages': int(s.get('verify_pages') or 0),
            'enabled': bool(s.get('enabled', True)),
        }
        clean.append(item)
    # 配置里已有的源（可能被用户改过）优先；新版本新增的内置源自动补进来
    have = set(x['id'] for x in clean)
    for d in DEFAULT_SOURCES:
        if d['id'] in have:
            continue
        clean.append({
            'id': d['id'], 'label': d['label'], 'kind': d['kind'],
            'base': d['base'].rstrip('/'), 'search': d['search'],
            'password': d.get('password') or '',
            'search_tpl': d.get('search_tpl') or '/search.php?q={q}',
            'verify_pages': int(d.get('verify_pages') or 0),
            'enabled': bool(d.get('enabled', True)),
        })
    out['sources'] = clean or [dict(s) for s in DEFAULT_SOURCES]
    return out


def save_config(cfg):
    _write_json(CONFIG_FILE, cfg)


def _norm_name(text):
    t = str(text or '')
    t = RE_BRACKET.sub(' ', t)
    t = re.sub(r'(叶酱|汉化版|内嵌|AI汉化|汉化|版|\s|\[|\]|【|】|\(|\)|（|）|～|~|！|!|。|，|,|/|\|)', ' ', t)
    return re.sub(r'\s+', '', t).lower()


def uid_of(item):
    return hashlib.sha1(_norm_name(item.get('name') or item.get('title')).encode('utf-8')).hexdigest()[:16]


# ---- 解析 -------------------------------------------------------------------
def parse_size_mb(title):
    m = re.search(r'/([0-9.]+)([GM])\s*(?:】|$|\))', title, re.I)
    if not m:
        cands = list(RE_SIZE.finditer(title))
        m = cands[-1] if cands else None
    if not m:
        return None
    try:
        val = float(m.group(1))
    except Exception:
        return None
    return int(val * (1024 if m.group(2).upper() == 'G' else 1))


def parse_platforms(title):
    if 'PC+安卓' in title or '安卓+PC' in title or ('PC' in title and '安卓' in title):
        return 'PC+安卓'
    if '安卓' in title:
        return '安卓'
    return 'PC'


def _pick_cover(html, prefer_hosts=None):
    """从 HTML 里挑一张像封面的图：先看 og:image，再看正文图；过滤占位图。"""
    html = str(html or '')
    cands = []
    m = RE_OG_IMAGE.search(html)
    if m:
        cands.append(m.group(1))
    for mm in RE_IMG.finditer(html):
        cands.append(mm.group(1))
    cleaned = []
    for url in cands:
        if not url:
            continue
        if url.startswith('//'):
            url = 'https:' + url
        if not url.startswith('http'):
            continue
        if COVER_SKIP.search(url):
            continue
        if prefer_hosts and not any(h in url for h in prefer_hosts):
            # og:image 与正文图都留着，只是优先级降低
            cleaned.append(url)
            continue
        cleaned.append(url)
    if not cleaned:
        return ''
    # 首选已知图床，其次 og:image，最后任意
    if prefer_hosts:
        for u in cleaned:
            if any(h in u for h in prefer_hosts):
                return u
    return cleaned[0]


def parse_item(post, source):
    raw = re.sub(r'<[^>]+>', '', (post.get('title') or {}).get('rendered', ''))
    title = re.sub(r'\s+', ' ', raw).strip()
    content = (post.get('content') or {}).get('rendered', '') or ''
    gtype = ''
    head = re.search(r'【([^】]*?(?:RPG|SLG|ACT|ADV|AVG|GAL)[^】]*?)】', title, re.I)
    if head:
        for t in ('RPG', 'SLG', 'ACT', 'ADV', 'AVG', 'GAL'):
            if t.lower() in head.group(1).lower():
                gtype = t.upper()
                break
    body = re.sub(r'\s+', ' ', RE_BRACKET.sub(' ', title)).strip()
    mv = RE_VER.search(title)
    cover = _pick_cover(content, COVER_HOST_OK)
    role = []
    for kw, lab in (('原创发布', '原创发布'), ('联合', '合作'), ('精翻', '精翻'),
                    ('内嵌', '内嵌汉化'), ('AI汉化', 'AI 汉化'), ('个人汉化', '个人汉化'),
                    ('移植', '安卓移植'), ('+存档', '含存档'), ('云翻', '云翻')):
        if kw in title:
            role.append(lab)
    return {
        'name': body or title,
        'title': title,
        'type': gtype or 'RPG',
        'version': mv.group(1) if mv else '',
        'platform': parse_platforms(title),
        'size_mb': parse_size_mb(title),
        'cover': cover,
        'source_url': post.get('link') or '',
        'date': (post.get('date') or '')[:10],
        'tags': sorted(set(role)),
        'source': source['id'],
        'source_label': source['label'],
        'password': source.get('password') or '',
    }


def fetch_source_items(cfg, source, progress):
    """抓一个源，返回条目列表；progress 用于上报真实进度。"""
    if source['kind'] in ('zblog', 'html'):
        return _fetch_html(cfg, source, progress)
    return _fetch_wp(cfg, source, progress)


def _fetch_wp(cfg, source, progress):
    q = urllib.parse.urlencode({'search': source['search'], 'per_page': 100,
                                '_fields': 'id,link,title,date,content'})
    url = '%s/wp-json/wp/v2/posts?%s' % (source['base'], q)
    progress.log('GET %s' % url)
    posts = http_json(url, timeout=cfg['timeout_sec'])
    if not isinstance(posts, list):
        return []
    out = []
    for i, p in enumerate(posts, 1):
        try:
            out.append(parse_item(p, source))
        except Exception:
            continue
        progress.log('  · %s' % (RE_BRACKET.sub('', (p.get('title') or {}).get('rendered', ''))[:48],
                                 ), quiet=True)
    progress.log('%s: %d 条' % (source['label'], len(out)))
    return out


RE_DETAIL_HREF = re.compile(
    r'href="(https?://[^"]+?/(?:'
    r'\d{4}/[a-z]+(?:/\d{1,2})?/\d+\.html'
    r'|yxzx/\d+\.html|softjc/\d+\.html|gamegl/\d+\.html'
    r'|game/\d+|archives/\d+|p/\d+|\d{4,6}\.html'
    r'))"', re.I)


def _fetch_html(cfg, source, progress):
    """HTML 搜索型源（ZBlog 的 search.php、ripro 的 ?s= 等）：搜索页只给链接，
    标题与内容逐页取，并要求关键词真的出现在标题或正文里，避免把导航/侧栏当结果。"""
    tpl = source.get('search_tpl') or '/search.php?q={q}'
    url = source['base'] + tpl.format(q=urllib.parse.quote(source['search']),
                                      kw=source['search'])
    progress.log('GET %s' % url)
    html = http_text(url, timeout=cfg['timeout_sec'])
    links, seen = [], set()
    for m in RE_DETAIL_HREF.finditer(html):
        link = m.group(1)
        if link in seen:
            continue
        seen.add(link)
        links.append(link)
    progress.log('%s: 搜索命中 %d 条（逐页核实标题与内容）' % (source['label'], len(links)))
    out = []
    cap = int(source.get('verify_pages') or 0) or cfg['verify_zblog_pages']
    limit = min(len(links), max(cap, 0))
    progress.set(done=0, total=max(limit, 1))
    for i, link in enumerate(links[:limit], 1):
        try:
            page = http_text(link, timeout=cfg['timeout_sec'])
        except Exception as e:
            progress.log('  打开失败 %s：%s' % (link, e))
            page = ''
        title = ''
        m = RE_OG_TITLE.search(page) or RE_TITLE_TAG.search(page)
        if m:
            title = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', m.group(1))).strip()
        title = re.split(r'\s+[-\u2013\u2014]\s+', title)[0] if title else ''
        if not title:
            progress.log('  跳过（取不到标题）：%s' % link)
            continue
        if source['search'] not in (title + page):
            progress.log('  跳过（页面无「%s」）：%s' % (source['search'], title[:36]))
            progress.set(done=i, total=limit)
            continue
        cover = _pick_cover(page, COVER_HOST_OK)
        mv = RE_VER.search(title)
        out.append({
            'name': re.sub(r'\s+', ' ', RE_BRACKET.sub(' ', title)).strip() or title,
            'title': title, 'type': _guess_type(title),
            'version': mv.group(1) if mv else '',
            'platform': parse_platforms(title), 'size_mb': parse_size_mb(title),
            'cover': cover, 'source_url': link, 'date': '',
            'tags': ['页面核实'], 'source': source['id'],
            'source_label': source['label'], 'password': source.get('password') or '',
        })
        progress.log('  ✓ %s' % title[:44], quiet=True)
        progress.set(done=i, total=limit)
    progress.log('%s: 采纳 %d 条' % (source['label'], len(out)))
    return out


def _guess_type(title):
    for t in ('RPG', 'SLG', 'ACT', 'ADV', 'AVG', 'GAL'):
        if t.lower() in title.lower():
            return t.upper()
    return 'RPG'


# ---- AList 镜像 -------------------------------------------------------------
def alist_list(host, path, timeout=25, page=1, per_page=200):
    data = http_json('https://%s/api/fs/list' % host,
                     {'path': path, 'password': '', 'page': page,
                      'per_page': per_page, 'refresh': False}, timeout=timeout)
    if data.get('code') != 200:
        return [], 0
    d = data.get('data') or {}
    return d.get('content') or [], int(d.get('total') or 0)


def alist_get(host, path, timeout=25):
    data = http_json('https://%s/api/fs/get' % host, {'path': path, 'password': ''},
                     timeout=timeout)
    if data.get('code') != 200:
        return None
    return data.get('data') or {}


def _swap_bucket(path, to_b):
    """h.suyunm.com 用 /A* 桶，m.mydizhi.com 用 /B* 桶；目录名一一对应。"""
    segs = str(path or '').split('/')
    if len(segs) > 1 and segs[1]:
        name = segs[1]
        if to_b and name.startswith('A'):
            segs[1] = 'B' + name[1:]
        elif (not to_b) and name.startswith('B'):
            segs[1] = 'A' + name[1:]
    return '/'.join(segs)


def canon_path(path):
    """卡片里统一存 A 形式的规范路径。"""
    return _swap_bucket(path, False)


def host_path(path, host):
    """把规范路径换成目标主机上的实际路径。"""
    return _swap_bucket(path, str(host or '').startswith('m.mydizhi'))


def load_index(cfg):
    idx = _read_json(INDEX_FILE, None)
    ttl = cfg['index_ttl_min'] * 60
    if idx and idx.get('host') == cfg['alist_host'] and time.time() - float(idx.get('ts') or 0) < ttl:
        return idx
    return None


def build_index(cfg, progress=None):
    host = cfg['alist_host']
    dirs = []
    root, _ = alist_list(host, '/', cfg['timeout_sec'])
    buckets = [b for b in root if b.get('is_dir')]
    if progress:
        progress.log('镜像 %s：%d 个桶' % (host, len(buckets)))
        progress.set(done=0, total=max(len(buckets), 1))
    for bi, bucket in enumerate(buckets, 1):
        bpath = '/' + bucket['name']
        page = 1
        while page <= 12:
            chunk, total = alist_list(host, bpath, cfg['timeout_sec'], page=page)
            if not chunk:
                break
            for it in chunk:
                if it.get('is_dir'):
                    dirs.append({'path': canon_path(bpath + '/' + it['name']),
                                 'name': it['name']})
            if page * 200 >= total:
                break
            page += 1
        if progress:
            progress.set(done=bi, total=len(buckets))
            progress.log('  桶 %s：累计 %d 个目录' % (bucket['name'], len(dirs)), quiet=True)
    idx = {'host': host, 'ts': time.time(), 'dirs': dirs}
    try:
        _write_json(INDEX_FILE, idx)
    except Exception:
        pass
    if progress:
        progress.log('索引完成：%d 个目录' % len(dirs))
    return idx


def load_bindings():
    data = _read_json(BINDINGS_FILE, {})
    return data if isinstance(data, dict) else {}


def _ver_key(text):
    t = str(text or '').lower().replace('.', '-').replace('_', '-').replace('v', '')
    return re.sub(r'[^0-9a-z\-]', '', t)


def match_folder(item, index_paths, bindings):
    bound = bindings.get(item.get('uid') or '')
    if bound:
        return canon_path(bound), 'manual'
    title = (item.get('title') or '') + ' ' + (item.get('name') or '')
    ver = _ver_key(item.get('version'))
    for tokens, paths in ALIASES:
        if not any(t and t in title for t in tokens):
            continue
        cand = [p for p in (paths if isinstance(paths, list) else [paths])
                if (not index_paths) or canon_path(p) in index_paths]
        if not cand:
            continue
        if ver:
            for p in cand:
                if ver in _ver_key(p):
                    return canon_path(p), 'alias'
        return canon_path(cand[0]), 'alias'
    return '', ''


def folder_files(cfg, folder):
    host = cfg['alist_host']
    real = host_path(canon_path(folder), host)
    items, _ = alist_list(host, real, cfg['timeout_sec'])
    out = []
    for it in items:
        if it.get('is_dir'):
            continue
        rel = real + '/' + it['name']
        try:
            got = alist_get(host, rel, cfg['timeout_sec']) or {}
        except Exception:
            got = {}
        out.append({'name': it['name'],
                    'size_mb': round((it.get('size') or 0) / 1048576.0, 1),
                    'url': got.get('raw_url') or ''})
    return out


# ---- 进度（挖掘任务） -------------------------------------------------------
class Progress:
    def __init__(self):
        self.lock = threading.Lock()
        self.reset('idle')

    def reset(self, phase_id, label=''):
        with self.lock:
            self.state = {
                'phase': phase_id, 'phase_label': label,
                'done': 0, 'total': 0, 'percent': 0,
                'started_at': time.time(), 'updated_at': time.time(),
                'elapsed': 0, 'log': [], 'running': phase_id not in ('idle', 'done', 'error', 'cancelled'),
                'error': '', 'stats': {},
            }

    def log(self, msg, quiet=False):
        with self.lock:
            if quiet and self.state['phase'] in ('idle', 'done', 'error', 'cancelled'):
                return
            self.state['log'].append({'t': round(time.time() - self.state['started_at'], 1),
                                      'msg': str(msg)[:300]})
            if len(self.state['log']) > 400:
                self.state['log'] = self.state['log'][-400:]
            self.state['updated_at'] = time.time()

    def set(self, **kw):
        with self.lock:
            self.state.update(kw)
            total = self.state.get('total') or 0
            done = self.state.get('done') or 0
            self.state['percent'] = int(min(100, (done / total) * 100)) if total else 0
            self.state['elapsed'] = round(time.time() - self.state['started_at'], 1)
            self.state['updated_at'] = time.time()

    def phase(self, pid, label, total=0):
        with self.lock:
            self.state['phase'] = pid
            self.state['phase_label'] = label
            self.state['done'] = 0
            self.state['total'] = total
            self.state['percent'] = 0
            self.state['running'] = True
            self.state['elapsed'] = round(time.time() - self.state['started_at'], 1)
        self.log('▶ %s' % label)

    def snapshot(self):
        with self.lock:
            s = dict(self.state)
            s['log'] = list(self.state['log'])[-200:]
            s['running'] = bool(self.state.get('running'))
            return s


PROG = Progress()
_mine_lock = threading.Lock()
_mine_thread = None
_cancel = threading.Event()


def mine_worker(cfg, rebuild_index=False):
    try:
        PROG.reset('sources', '抓取发布源')
        sources = [s for s in cfg['sources'] if s.get('enabled')]
        PROG.set(total=max(len(sources), 1))
        collected = []
        for i, src in enumerate(sources, 1):
            if _cancel.is_set():
                PROG.phase('cancelled', '已取消')
                PROG.set(running=False)
                return
            PROG.set(done=i - 1, total=len(sources))
            PROG.phase('source:%s' % src['id'], '源 %s（%d/%d）' % (src['label'], i, len(sources)))
            try:
                got = fetch_source_items(cfg, src, PROG)
            except Exception as e:
                PROG.log('源 %s 失败：%s' % (src['label'], e))
                got = []
            collected.extend(got)
            PROG.set(done=i, total=len(sources))
            PROG.log('累计 %d 条（去重前）' % len(collected))

        # 补封面：对没有封面、又有源页地址的条目，去源页取 og:image / 首图
        missing = [x for x in collected if not x.get('cover') and x.get('source_url')]
        cap = min(len(missing), cfg['cover_backfill_pages'])
        if cap:
            PROG.phase('covers', '补齐封面（%d/%d）' % (cap, len(missing)), total=cap)
            for i, x in enumerate(missing[:cap], 1):
                if _cancel.is_set():
                    break
                try:
                    page = http_text(x['source_url'], timeout=cfg['timeout_sec'])
                    cv = _pick_cover(page, COVER_HOST_OK)
                    if cv:
                        x['cover'] = cv
                        PROG.log('  + 封面 %s' % x['name'][:32], quiet=True)
                    else:
                        PROG.log('  - 仍无封面 %s' % x['name'][:32], quiet=True)
                except Exception as e:
                    PROG.log('  封面失败 %s：%s' % (x['source_url'][:48], e))
                PROG.set(done=i, total=cap)
            PROG.log('封面补齐：%d 条里补上 %d 条'
                     % (cap, sum(1 for x in missing[:cap] if x.get('cover'))))

        PROG.phase('index', '构建镜像目录索引')
        idx = load_index(cfg) if not rebuild_index else None
        if idx:
            PROG.log('复用索引缓存：%d 个目录' % len(idx.get('dirs') or []))
        else:
            idx = build_index(cfg, PROG)

        PROG.phase('match', '匹配镜像目录并合并卡片库', total=max(len(collected), 1))
        paths = set(d['path'] for d in (idx.get('dirs') or []))
        bindings = load_bindings()

        # 去重合并：同一 uid 视为同一部作品，合并来源与标签
        merged = {}
        for it in collected:
            it['uid'] = uid_of(it)
            cur = merged.get(it['uid'])
            if not cur:
                it['sources_detail'] = [{'id': it['source'], 'label': it['source_label'],
                                         'url': it['source_url'], 'password': it['password']}]
                merged[it['uid']] = it
                continue
            cur['sources_detail'].append({'id': it['source'], 'label': it['source_label'],
                                          'url': it['source_url'], 'password': it['password']})
            if len(it['title']) > len(cur['title']):
                cur['title'] = it['title']
            if not cur.get('cover') and it.get('cover'):
                cur['cover'] = it['cover']
            if not cur.get('version') and it.get('version'):
                cur['version'] = it['version']
            if not cur.get('size_mb') and it.get('size_mb'):
                cur['size_mb'] = it['size_mb']
            cur['tags'] = sorted(set(cur.get('tags') or []) | set(it.get('tags') or []))

        library = _read_json(LIBRARY_FILE, {}) or {}
        cards = library.get('cards') or {}
        now = time.time()
        seen_ids = set()
        new_cnt = upd_cnt = same_cnt = 0
        for i, (uid, it) in enumerate(merged.items(), 1):
            folder, how = match_folder(it, paths, bindings)
            it['folder'] = folder
            it['matched_by'] = how
            it['passwords'] = sorted(set([it.get('password') or ''] +
                                         [s['password'] for s in it['sources_detail'] if s.get('password')]))
            it['passwords'] = [p for p in it['passwords'] if p]
            seen_ids.add(uid)
            old = cards.get(uid)
            if old:
                changed = []
                for f in ('title', 'version', 'platform', 'size_mb', 'folder', 'cover'):
                    if (old.get(f) or '') != (it.get(f) or ''):
                        changed.append(f)
                it['first_seen'] = old.get('first_seen') or now
                it['last_seen'] = now
                it['state'] = 'updated' if changed else 'active'
                it['changed'] = changed
                if changed:
                    upd_cnt += 1
                else:
                    same_cnt += 1
            else:
                it['first_seen'] = now
                it['last_seen'] = now
                it['state'] = 'new'
                it['changed'] = []
                new_cnt += 1
            cards[uid] = it
            PROG.set(done=i, total=len(merged))

        stale_cnt = 0
        for uid, card in cards.items():
            if uid in seen_ids:
                continue
            if card.get('kind') == 'touchgal':
                continue  # TouchGal 的卡由 tg.mine 维护，别被叶酱这轮标过期
            if card.get('state') != 'stale':
                card['state'] = 'stale'
                card['stale_since'] = now
                stale_cnt += 1

        _write_json(LIBRARY_FILE, {'ts': now, 'host': cfg['alist_host'],
                                   'sources': [s['id'] for s in sources], 'cards': cards})
        PROG.set(stats={'total': len(cards), 'new': new_cnt, 'updated': upd_cnt,
                        'same': same_cnt, 'stale': stale_cnt, 'index_dirs': len(paths)})
        PROG.phase('done', '完成')
        PROG.log('卡片库：共 %d 张（新增 %d / 更新 %d / 未变 %d / 过期 %d）'
                 % (len(cards), new_cnt, upd_cnt, same_cnt, stale_cnt))
        PROG.set(running=False)
    except Exception as e:
        PROG.log('挖掘异常：%s' % e)
        PROG.phase('error', '出错：%s' % e)
        PROG.set(running=False, error=str(e))
    finally:
        global _mine_thread
        try:
            _mine_lock.release()
        except Exception:
            pass


# ---- 下载器 -----------------------------------------------------------------
_dl_lock = threading.RLock()
_dl_jobs = {}
_dl_threads = []
_dl_sem = None
_downloads_state = None


def _dl_load():
    global _downloads_state
    if _downloads_state is None:
        _downloads_state = _read_json(DOWNLOADS_FILE, {}) or {}
    return _downloads_state


def _dl_sweep_interrupted():
    """插件重启后，落盘里还标着“进行中”的任务其实已经没有线程了：
    统一标成 error（保留 .part，重下会续传），避免界面一直显示排队/下载中。"""
    jobs = _dl_load()
    changed = False
    for job in jobs.values():
        if job.get('state') in ('queued', 'connecting', 'downloading', 'cancelling'):
            job['state'] = 'error'
            job['error'] = '插件重启，任务已中断（重新下载会从 .part 续传）'
            job['finished_at'] = job.get('finished_at') or time.time()
            job['interrupted'] = True
            changed = True
    if changed:
        _dl_save()
    return changed


def _dl_save():
    try:
        _write_json(DOWNLOADS_FILE, _dl_load())
    except Exception:
        pass


def _safe_name(text, limit=80):
    t = re.sub(r'[\\/:*?"<>|\r\n\t]+', '_', str(text or '')).strip(' .')
    return (t[:limit] or 'item')


def _dl_progress(job):
    with _dl_lock:
        total = job.get('total') or 0
        got = job.get('received') or 0
        job['percent'] = int(min(100, got * 100 / total)) if total else 0
        job['elapsed'] = round(time.time() - job['started_at'], 1)
        sp = job.get('speed') or 0
        if sp > 0 and total > got:
            job['eta'] = int((total - got) / sp)
    return job


class _DlCancelled(Exception):
    pass


def _dl_probe_range(url, stall):
    """探测是否支持 Range 以及总大小。返回 (total, 支持分段)。"""
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Range': 'bytes=0-0'})
    with urllib.request.urlopen(req, timeout=stall) as r:
        code = r.getcode()
        if code != 206:
            return (int(r.headers.get('Content-Length') or 0), False)
        cr = r.headers.get('Content-Range') or ''
        m = re.search(r'bytes\s+\d+-\d+/(\d+)', cr)
        total = int(m.group(1)) if m else 0
        try:
            r.read(1)
        except Exception:
            pass
        return (total, bool(total))


def _seg_state_path(part):
    return part + '.segments.json'


def _load_seg_state(part, total, url, segs):
    """读取（或初始化）分段进度；URL/大小/线程数变了就重来。"""
    st = _read_json(_seg_state_path(part), None)
    if (isinstance(st, dict) and st.get('url') == url and int(st.get('total') or 0) == total
            and len(st.get('parts') or []) == segs):
        return st
    parts = []
    size = total // segs
    for i in range(segs):
        start = i * size
        end = total - 1 if i == segs - 1 else (start + size - 1)
        parts.append({'start': start, 'end': end, 'done': 0})
    st = {'url': url, 'total': total, 'parts': parts, 'ts': time.time()}
    _write_json(_seg_state_path(part), st)
    return st


def _dl_tick(job, added):
    """多线程共用：累计字节 + 速度（0.8s 窗口）。"""
    now = time.time()
    with _dl_lock:
        job['received'] = (job.get('received') or 0) + added
        last = job.get('_t_speed') or now
        if now - last >= 0.8:
            base = job.get('_t_bytes') or 0
            job['speed'] = int(max(0, (job['received'] - base)) / (now - last))
            job['_t_speed'] = now
            job['_t_bytes'] = job['received']
    _dl_progress(job)


def _fetch_segment(job, st, idx, stall, part, errors):
    p = st['parts'][idx]
    start = p['start'] + p['done']
    end = p['end']
    if start > end:
        return
    try:
        req = urllib.request.Request(
            job['url'], headers={'User-Agent': UA, 'Range': 'bytes=%d-%d' % (start, end)})
        with urllib.request.urlopen(req, timeout=stall) as resp:
            if resp.getcode() not in (200, 206):
                raise RuntimeError('分段 %d 返回 %s' % (idx, resp.getcode()))
            f = open(part, 'r+b')
            try:
                f.seek(start)
                while start <= end:
                    if job.get('cancel'):
                        raise _DlCancelled()
                    chunk = resp.read(min(256 * 1024, end - start + 1))
                    if not chunk:
                        raise RuntimeError('分段 %d 提前结束（还差 %d 字节）'
                                           % (idx, end - start + 1))
                    f.write(chunk)
                    start += len(chunk)
                    p['done'] += len(chunk)
                    _dl_tick(job, len(chunk))
            finally:
                f.close()
    except _DlCancelled:
        return
    except Exception as e:
        errors.append('分段 %d: %s' % (idx, e))


def _dl_segmented(job, total, stall, part, segs):
    st = _load_seg_state(part, total, job['url'], segs)
    # 预分配到目标大小（resume 时已有文件就只补长度）
    cur = os.path.getsize(part) if os.path.isfile(part) else 0
    with open(part, 'ab') as f:
        if cur < total:
            f.truncate(total)
    with _dl_lock:
        job.update({'state': 'downloading', 'total': total,
                    'segments': segs,
                    'received': sum(p['done'] for p in st['parts']),
                    '_t_speed': time.time(), '_t_bytes': sum(p['done'] for p in st['parts'])})
    _dl_progress(job)

    errors = []
    threads = [threading.Thread(target=_fetch_segment, args=(job, st, i, stall, part, errors),
                                daemon=True) for i in range(segs)]
    for t in threads:
        t.start()
    last_save = 0.0
    while any(t.is_alive() for t in threads):
        if job.get('cancel'):
            with _dl_lock:
                job['state'] = 'cancelling'
        if time.time() - last_save > 2:
            st['ts'] = time.time()
            _write_json(_seg_state_path(part), st)
            last_save = time.time()
        time.sleep(0.2)
    for t in threads:
        t.join(timeout=1)
    _write_json(_seg_state_path(part), st)
    done = sum(p['done'] for p in st['parts'])
    if job.get('cancel'):
        with _dl_lock:
            job['state'] = 'cancelled'
        _dl_save()
        return
    if errors or done < total:
        raise RuntimeError('分段下载未完成（%d/%d 字节）：%s'
                           % (done, total, '; '.join(errors[:2]) or '部分线程异常'))
    os.replace(part, job['path'])
    try:
        os.remove(_seg_state_path(part))
    except OSError:
        pass
    with _dl_lock:
        job.update({'state': 'done', 'received': total, 'total': total,
                    'percent': 100, 'finished_at': time.time(), 'speed': 0, 'eta': 0})
    _dl_save()


def _download_worker(job):
    """调度：能分段就多线程分段，否则退回单连接流式。"""
    url = job['url']
    part = job['path'] + '.part'
    stall = int(job.get('stall_sec') or 45)
    segs = max(1, int(job.get('segments') or 1))
    min_split = int(job.get('min_split_mb') or 16) * 1048576
    os.makedirs(os.path.dirname(job['path']), exist_ok=True)
    with _dl_lock:
        job['state'] = 'connecting'
        job['started_at'] = job.get('started_at') or time.time()
    _dl_progress(job)
    try:
        total, can_range = (0, False)
        if segs > 1:
            try:
                total, can_range = _dl_probe_range(url, stall)
            except Exception as e:
                PROG.log('分段探测失败，退回单线程：%s' % e, quiet=True)
        single_stream = (not can_range) or total <= 0 or total < min_split or segs <= 1
        job['mode'] = 'single' if single_stream else 'segments'
        if single_stream:
            job['segments'] = 1
            _dl_single(job, stall, part)
        else:
            _dl_segmented(job, total, stall, part, segs)
    except _DlCancelled:
        with _dl_lock:
            job['state'] = 'cancelled'
        _dl_save()
    except Exception as e:
        msg = str(e)[:300]
        if 'timed out' in msg.lower() or 'timeout' in msg.lower():
            msg = ('连接停滞：%d 秒没收到数据（镜像/存储可能很慢或不可达）。'
                   '已下载的部分保留在 .part，稍后重试会断点续传。' % stall)
        with _dl_lock:
            job['state'] = 'error'
            job['error'] = msg
            job['finished_at'] = time.time()
        _dl_save()
    finally:
        try:
            _dl_sem.release()
        except Exception:
            pass


def _dl_single(job, stall, part):
    """单连接顺序下载（不支持 Range 或文件较小时走这里）。"""
    url = job['url']
    have = os.path.getsize(part) if os.path.isfile(part) else 0
    headers = {'User-Agent': UA}
    job['resumed_from'] = have
    if have:
        headers['Range'] = 'bytes=%d-' % have
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=stall) as resp:
        code = resp.getcode()
        ctype = (resp.headers.get('Content-Type') or '').lower()
        length = int(resp.headers.get('Content-Length') or 0)
        if code == 206:
            cr = resp.headers.get('Content-Range') or ''
            m = re.search(r'/(\d+)', cr)
            total = int(m.group(1)) if m else (have + length)
        else:
            total = length
            have = 0
        if 'json' in ctype and total < 8192:
            snippet = resp.read(300).decode('utf-8', 'replace')
            raise RuntimeError('直链可能已过期（镜像返回 JSON）：' + snippet[:160])
        with _dl_lock:
            job.update({'total': total, 'received': have, 'state': 'downloading',
                        'first_byte_at': time.time(),
                        '_t_speed': time.time(), '_t_bytes': have})
        mode = 'ab' if have else 'wb'
        last = time.time()
        last_bytes = have
        with open(part, mode) as f:
            while True:
                if job.get('cancel'):
                    raise _DlCancelled()
                chunk = resp.read(256 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                have += len(chunk)
                now = time.time()
                with _dl_lock:
                    job['received'] = have
                    if now - last >= 0.8:
                        job['speed'] = int((have - last_bytes) / (now - last))
                        last, last_bytes = now, have
                _dl_progress(job)
        os.replace(part, job['path'])
        with _dl_lock:
            fin_total = job.get('total') or have
            job.update({'state': 'done', 'received': have, 'total': fin_total,
                        'percent': 100, 'finished_at': time.time(), 'speed': 0, 'eta': 0})
        _dl_save()


def _dl_start(cfg, url, filename, title):
    global _dl_sem
    apply_net_policy(cfg)
    if _dl_sem is None:
        _dl_sem = threading.Semaphore(cfg['max_parallel_dl'])
    if not _dl_sem.acquire(blocking=False):
        raise rc.RCError(3006, '同时下载数已达上限（%d），等前面的下完再试' % cfg['max_parallel_dl'])
    job_id = 'dl%d' % int(time.time() * 1000)
    folder = os.path.join(cfg['download_dir'], _safe_name(title))
    path = os.path.join(folder, _safe_name(filename, 120))
    job = {'id': job_id, 'url': url, 'name': filename, 'title': title,
           'path': path, 'state': 'queued', 'total': 0, 'received': 0,
           'percent': 0, 'speed': 0, 'eta': 0, 'error': '',
           'created_at': time.time(), 'started_at': 0, 'finished_at': 0,
           'first_byte_at': 0, 'stall_sec': int(cfg.get('dl_stall_sec') or 45),
           'segments': max(1, int(cfg.get('dl_segments') or 1)),
           'min_split_mb': int(cfg.get('dl_min_split_mb') or 16),
           'mode': 'pending', 'cancel': False}
    with _dl_lock:
        _dl_jobs[job_id] = job
        _dl_load()[job_id] = {k: v for k, v in job.items()
                              if k != 'cancel' and not k.startswith('_')}
    _dl_save()
    t = threading.Thread(target=_download_worker, args=(job,), daemon=True)
    t.start()
    _dl_threads.append(t)
    return job


def _dl_public(job):
    with _dl_lock:
        return {k: v for k, v in job.items() if k != 'cancel' and not k.startswith('_')}


# ---- 接口实现 ---------------------------------------------------------------
@rc.interface('yegames.info')
def yg_info(params):
    cfg = load_config()
    return {
        'name': NAME, 'label': LABEL, 'version': VERSION, 'lang': 'python',
        'description': '多源挖掘叶酱汉化作品、卡片库持久化、内置下载器',
        'sources': [{'id': s['id'], 'label': s['label'], 'kind': s['kind'],
                     'password': s['password'], 'enabled': s['enabled']}
                    for s in cfg['sources']],
        'download_dir': cfg['download_dir'],
        'tips': '镜像包解压密码通常为 gacg；各源密码见卡片与下载窗口。',
    }


@rc.interface('yegames.config.get')
def yg_config_get(params):
    return load_config()


@rc.interface('yegames.config.save')
def yg_config_save(params):
    data = params if isinstance(params, dict) else {}
    cfg = normalize_config({**load_config(), **data})
    save_config(cfg)
    return {'message': '设置已保存', 'config': cfg}


@rc.interface('yegames.library.list')
def yg_library_list(params):
    data = params if isinstance(params, dict) else {}
    lib = _read_json(LIBRARY_FILE, {}) or {}
    cards = list((lib.get('cards') or {}).values())
    state = str(data.get('state') or '')
    if state == 'active':
        cards = [c for c in cards if c.get('state') != 'stale']
    elif state:
        cards = [c for c in cards if c.get('state') == state]
    cards.sort(key=lambda c: (c.get('last_seen') or 0), reverse=True)
    counts = {'all': 0, 'new': 0, 'updated': 0, 'active': 0, 'stale': 0, 'linked': 0,
              'yegames': 0, 'touchgal': 0}
    for c in (lib.get('cards') or {}).values():
        counts['all'] += 1
        st = c.get('state') or 'active'
        counts[st] = counts.get(st, 0) + 1
        kind = c.get('kind') or 'yegames'
        counts[kind] = counts.get(kind, 0) + 1
        if c.get('folder') or c.get('tg_id'):
            counts['linked'] += 1
    return {'items': cards, 'updated_at': lib.get('ts') or 0, 'counts': counts,
            'max_items': load_config()['max_items']}


@rc.interface('yegames.mine.start')
def yg_mine_start(params):
    global _mine_thread
    data = params if isinstance(params, dict) else {}
    if PROG.snapshot().get('running'):
        raise rc.RCError(3007, '挖掘正在进行中')
    if not _mine_lock.acquire(blocking=False):
        raise rc.RCError(3007, '挖掘正在进行中')
    cfg = load_config()
    apply_net_policy(cfg)
    _cancel.clear()
    _mine_thread = threading.Thread(target=mine_worker,
                                    args=(cfg, bool(data.get('rebuild_index'))), daemon=True)
    _mine_thread.start()
    time.sleep(0.2)
    return {'message': '已开始挖掘', 'progress': PROG.snapshot()}


@rc.interface('yegames.mine.status')
def yg_mine_status(params):
    return PROG.snapshot()


@rc.interface('yegames.mine.cancel')
def yg_mine_cancel(params):
    _cancel.set()
    return {'message': '已请求取消', 'progress': PROG.snapshot()}


@rc.interface('yegames.item.links')
def yg_item_links(params):
    data = params if isinstance(params, dict) else {}
    cfg = load_config()
    uid = str(data.get('uid') or '')
    lib = _read_json(LIBRARY_FILE, {}) or {}
    card = (lib.get('cards') or {}).get(uid)
    if not card:
        raise rc.RCError(3004, '卡片库里没有这部作品，先挖掘一次')
    folder = str(data.get('folder') or card.get('folder') or '')
    if not folder:
        raise rc.RCError(3004, '还没对上镜像目录，可以先手动绑定一个路径')
    files = folder_files(cfg, folder)
    if not files:
        raise rc.RCError(3005, '目录为空或镜像不可达：%s' % folder)
    canon = canon_path(folder)
    host = cfg['alist_host']
    others = [x for x in cfg['alist_hosts'] if x != host]
    mirror = others[0] if others else host
    # 备用线路：同目录在另一台镜像上的直链（B2 慢的时候可以切 R2/CF）
    alt_map = {}
    if others and data.get('with_alt', True):
        try:
            alt_real = host_path(canon, mirror)
            items2, _ = alist_list(mirror, alt_real, cfg['timeout_sec'])
            for it in items2:
                if it.get('is_dir'):
                    continue
                g2 = alist_get(mirror, alt_real + '/' + it['name'], cfg['timeout_sec']) or {}
                if g2.get('raw_url'):
                    alt_map[it['name']] = g2['raw_url']
        except Exception as e:
            PROG.log('备用线路取链失败：%s' % e, quiet=True)
    for f in files:
        f['alt_url'] = alt_map.get(f['name'], '')
        f['alt_host'] = mirror if f['alt_url'] else ''
    return {'uid': uid, 'title': card.get('title'), 'folder': canon,
            'entry_url': 'https://%s%s/' % (host, host_path(canon, host)),
            'mirror_entry': 'https://%s%s/' % (mirror, host_path(canon, mirror)),
            'passwords': card.get('passwords') or [],
            'download_dir': cfg['download_dir'],
            'files': files}


@rc.interface('yegames.item.bind')
def yg_item_bind(params):
    data = params if isinstance(params, dict) else {}
    uid = str(data.get('uid') or '')
    folder = str(data.get('folder') or '').strip()
    if not uid:
        raise rc.RCError(3002, '缺少 uid')
    if folder and not folder.startswith('/'):
        folder = '/' + folder
    folder = canon_path(folder) if folder else ''
    bindings = load_bindings()
    if folder:
        bindings[uid] = folder
    else:
        bindings.pop(uid, None)
    _write_json(BINDINGS_FILE, bindings)
    lib = _read_json(LIBRARY_FILE, {}) or {}
    card = (lib.get('cards') or {}).get(uid)
    if card:
        card['folder'] = folder
        card['matched_by'] = 'manual' if folder else ''
        _write_json(LIBRARY_FILE, lib)
    return {'message': '已绑定' if folder else '已解绑', 'uid': uid, 'folder': folder}


@rc.interface('yegames.folder.list')
def yg_folder_list(params):
    data = params if isinstance(params, dict) else {}
    cfg = load_config()
    folder = str(data.get('folder') or '').strip()
    if not folder.startswith('/'):
        folder = '/' + folder
    canon = canon_path(folder)
    host = cfg['alist_host']
    return {'folder': canon, 'files': folder_files(cfg, canon),
            'entry_url': 'https://%s%s/' % (host, host_path(canon, host))}


@rc.interface('yegames.index.stats')
def yg_index_stats(params):
    cfg = load_config()
    idx = load_index(cfg) or _read_json(INDEX_FILE, {}) or {}
    dirs = idx.get('dirs') or []
    return {'host': idx.get('host') or cfg['alist_host'], 'dirs': len(dirs),
            'age_min': int((time.time() - float(idx.get('ts') or 0)) / 60) if idx.get('ts') else -1,
            'fresh': bool(load_index(cfg))}


@rc.interface('yegames.dl.start')
def yg_dl_start(params):
    data = params if isinstance(params, dict) else {}
    url = str(data.get('url') or '')
    name = str(data.get('name') or '')
    if not url.startswith('http'):
        raise rc.RCError(3002, '缺少可下载的直链（可能已过期，重新取一次）')
    cfg = load_config()
    job = _dl_start(cfg, url, name or url.rsplit('/', 1)[-1] or 'file.bin',
                    str(data.get('title') or 'yegames'))
    return {'job': _dl_public(job)}


@rc.interface('yegames.dl.status')
def yg_dl_status(params):
    data = params if isinstance(params, dict) else {}
    job_id = str(data.get('id') or '')
    with _dl_lock:
        job = _dl_jobs.get(job_id)
        if job:
            return _dl_progress(job)
    saved = _dl_load().get(job_id)
    if saved:
        return saved
    raise rc.RCError(3004, '没有这个下载任务')


@rc.interface('yegames.dl.list')
def yg_dl_list(params):
    with _dl_lock:
        jobs = [_dl_public(j) for j in _dl_jobs.values()]
    if not jobs:
        jobs = list(_dl_load().values())
    jobs.sort(key=lambda j: j.get('created_at') or 0, reverse=True)
    return {'jobs': jobs[:50]}


@rc.interface('yegames.dl.cancel')
def yg_dl_cancel(params):
    data = params if isinstance(params, dict) else {}
    job_id = str(data.get('id') or '')
    with _dl_lock:
        job = _dl_jobs.get(job_id)
        if job:
            job['cancel'] = True
            job['state'] = 'cancelling'
            return {'message': '已请求取消', 'job': _dl_public(job)}
        # 不在内存里 = 进程重启前的旧任务（只存在于 downloads.json）
        saved = _dl_load().get(job_id)
        if saved:
            saved['state'] = 'cancelled'
            saved['cancel'] = True
            saved['finished_at'] = time.time()
            _dl_save()
            return {'message': '已取消（这是重启前的旧任务，已清理标记）', 'job': saved}
    raise rc.RCError(3004, '没有这个下载任务')


@rc.interface('yegames.dl.remove')
def yg_dl_remove(params):
    """把任务从列表里移除（进行中的会先取消；已下载的文件不动）。"""
    data = params if isinstance(params, dict) else {}
    job_id = str(data.get('id') or '')
    with _dl_lock:
        job = _dl_jobs.get(job_id)
        if job:
            job['cancel'] = True
            _dl_jobs.pop(job_id, None)
        removed = _dl_load().pop(job_id, None) is not None
        if removed:
            _dl_save()
    if not job and not removed:
        raise rc.RCError(3004, '没有这个下载任务')
    return {'message': '已从列表移除', 'id': job_id}


# ---- 直链猎手：从资源页里把网盘直链挖出来 --------------------------------
# 覆盖：夸克 / UC / 百度 / 123 / 迅雷 / 微云 / 蓝奏 / 阿里 / 天翼 / PikPak / 115 / 坚果云
PAN_RE = re.compile(
    r'https?://(?:pan\.quark\.cn|drive\.uc\.cn|pan\.baidu\.com|yun\.baidu\.com|'
    r'(?:www\.)?123(?:pan|684)\.com|pan\.xunlei\.com|share\.weiyun\.com|'
    r'www\.lanzou[a-z]\.com|(?:www\.)?ali(?:yundrive|pan)\.com|caiyun\.139\.com|'
    r'cloud\.189\.cn|mypikpak\.com/s/|115\.com/s/|www\.jianguoyun\.com)'
    r'[^\s"\'<>\)\]\\]+', re.I)
PWD_RE = re.compile(r'(?:提取码|访问码|访问密码|密码|pwd)\s*[:：=]?\s*([0-9a-zA-Z]{4,8})', re.I)
B64_CAND = re.compile(r'[A-Za-z0-9+/]{28,}={0,2}')
PAN_HOSTS = (
    ('pan.quark.cn', '夸克'), ('drive.uc.cn', 'UC'), ('pan.baidu.com', '百度'),
    ('123pan.com', '123'), ('123684.com', '123'), ('pan.xunlei.com', '迅雷'),
    ('share.weiyun.com', '微云'), ('lanzou', '蓝奏'), ('alipan.com', '阿里'),
    ('aliyundrive.com', '阿里'), ('caiyun.139.com', '移动云'), ('cloud.189.cn', '天翼'),
    ('mypikpak.com', 'PikPak'), ('115.com', '115'), ('jianguoyun.com', '坚果云'),
)


def _pan_kind(url):
    low = url.lower()
    for token, label in PAN_HOSTS:
        if token in low:
            return label
    return '网盘'


def _scan_pan(text, base_url=''):
    """从一个文本里挖网盘链接；先把 HTML 实体、JS 转义、base64 都还原一遍。"""
    import html as _html
    found = {}

    def add(blob, ctx=''):
        for m in PAN_RE.finditer(blob or ''):
            u = m.group(0).rstrip('.,;)]}\'"')
            if u.startswith('//'):
                u = 'https:' + u
            if not u.startswith('http'):
                continue
            code = ''
            tail = (blob[m.end():m.end() + 60] if blob else '') + ' ' + ctx
            mc = PWD_RE.search(tail)
            if mc:
                code = mc.group(1)
            if u not in found:
                found[u] = {'url': u, 'code': code, 'kind': _pan_kind(u)}

    variants = [text or '']
    variants.append(_html.unescape(text or ''))
    variants.append((text or '').replace('\\/', '/').replace('\\u002F', '/').replace('\\u002f', '/'))
    variants.append((text or '').replace('&amp;', '&').replace('\\/', '/'))
    for v in variants:
        add(v)
    # base64：常用来藏链接
    for m in B64_CAND.finditer(text or ''):
        tok = m.group(0)
        try:
            import base64 as _b64
            raw = _b64.b64decode(tok + '=' * (-len(tok) % 4), validate=False)
            dec = raw.decode('utf-8', 'ignore')
        except Exception:
            continue
        if 'http' not in dec:
            continue
        add(dec, ctx=(text or '')[max(0, m.start() - 80):m.start()])
    return list(found.values())


def hunt_page(url, cookie='', timeout=25):
    """抓一个资源页并挖网盘链接（带上 Cookie 就能复用登录/会员态）。"""
    if not str(url or '').startswith('http'):
        raise rc.RCError(3002, '缺少页面地址')
    headers = {'User-Agent': UA, 'Referer': url, 'Accept-Language': 'zh-CN,zh;q=0.9'}
    if cookie:
        headers['Cookie'] = cookie
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read().decode('utf-8', 'replace')
    links = _scan_pan(body, url)
    note = ''
    if not links:
        low = body.lower()
        if 'ripay' in low or '会员' in body or '付费' in body or '购买' in body:
            note = ('页面里没有裸链接：这类站把直链藏在付费/会员块里（83youxi 的 ripay），'
                    '正文只有 AList 地址，去镜像取（本插件的「直链 / 下载」就是干这个的）。')
        elif '登录' in body or 'login' in low:
            note = '页面可能需要登录才能看到链接：在设置里填该源的 Cookie，再抓一次。'
    return {'page': url, 'found': links, 'note': note, 'cookie_used': bool(cookie)}


def _cookie_for(cfg, source_id):
    cookies = cfg.get('cookies') or {}
    return str(cookies.get(source_id) or '')


# ---- TouchGal：公开 galgame 资源 API（有下载 links） -------------------------
# 站点用 TLS 指纹挡普通 urllib（403），所以只有在装了 curl_cffi 时才启用这条线。
_TG_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': UA,
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'X-Requested-With': 'kun-fetch',
    'Origin': 'https://www.touchgal.ink',
    'Referer': 'https://www.touchgal.ink/',
}
_TG_AVAILABLE = None


def tg_available():
    global _TG_AVAILABLE
    if _TG_AVAILABLE is None:
        try:
            import curl_cffi  # noqa: F401
            _TG_AVAILABLE = True
        except Exception:
            _TG_AVAILABLE = False
    return _TG_AVAILABLE


def _tg_cfg(cfg):
    t = cfg.get('touchgal') or {}
    return {'enabled': bool(t.get('enabled', True)),
            'api': str(t.get('api') or 'https://www.touchgal.ink/api'),
            'nsfw': bool(t.get('nsfw', True))}


def tg_search(cfg, keyword, limit=5, page=1):
    if not (tg_available() and _tg_cfg(cfg)['enabled']):
        return []
    from curl_cffi import requests as cr
    tcfg = _tg_cfg(cfg)
    payload = {
        'queryString': json.dumps([{'type': 'keyword', 'name': keyword}], ensure_ascii=False),
        'limit': limit, 'page': page, 'selectedType': 'all', 'selectedLanguage': 'all',
        'selectedPlatform': 'all', 'sortField': 'resource_update_time', 'sortOrder': 'desc',
        'selectedYears': ['all'], 'selectedMonths': ['all'], 'minRatingCount': 0,
        'searchOption': {'searchInIntroduction': True, 'searchInAlias': True, 'searchInTag': True},
    }
    cookie = 'kun-patch-setting-store|state|data|kunNsfwEnable=' + ('all' if tcfg['nsfw'] else 'sfw')
    r = cr.post(tcfg['api'] + '/search', json=payload,
                headers={**_TG_HEADERS, 'Cookie': cookie}, impersonate='chrome120', timeout=30)
    data = r.json() if r.status_code == 200 else {}
    if isinstance(data, dict):
        for key in ('galgames', 'items', 'list'):
            if isinstance(data.get(key), list):
                return data[key]
        body = data.get('data')
        if isinstance(body, dict):
            for key in ('galgames', 'items', 'list'):
                if isinstance(body.get(key), list):
                    return body[key]
        elif isinstance(body, list):
            return body
    return []


def tg_links(cfg, patch_id):
    if not (tg_available() and _tg_cfg(cfg)['enabled']):
        return []
    from curl_cffi import requests as cr
    tcfg = _tg_cfg(cfg)
    r = cr.get('%s/patch/resource?patchId=%s' % (tcfg['api'], patch_id),
               headers=_TG_HEADERS, impersonate='chrome120', timeout=30)
    data = r.json() if r.status_code == 200 else []
    rows = data if isinstance(data, list) else (data.get('data') if isinstance(data, dict) else [])
    out = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        for l in (row.get('links') or []):
            if not isinstance(l, dict):
                url = l if isinstance(l, str) else ''
                code = ''
            else:
                url = l.get('content') or l.get('url') or ''
                code = str(l.get('code') or l.get('password') or '')
            if not isinstance(url, str) or not url.startswith('http'):
                continue
            out.append({'url': url, 'code': code, 'kind': _pan_kind(url),
                        'from': 'touchgal', 'row': str(row.get('name') or '')[:60],
                        'size': str(l.get('size') or '') if isinstance(l, dict) else ''})
    return out


def _tg_site(cfg):
    return str((cfg.get('touchgal') or {}).get('site') or 'https://www.touchgal.ink')


def tg_card(cfg, item):
    """把 TouchGal 的搜索结果整成和叶酱卡片同构的一张卡（kind=touchgal）。"""
    pid = item.get('id')
    uniq = item.get('uniqueId') or ''
    name = str(item.get('name') or '').strip() or ('TouchGal-%s' % pid)
    site = _tg_site(cfg)
    langs = item.get('language') or []
    plats = item.get('platform') or []
    lang_map = {'zh-Hans': '简中', 'zh-Hant': '繁中', 'ja': '日文', 'en': '英文', 'other': '其他'}
    plat_map = {'windows': 'PC', 'apk': '安卓', 'ipa': 'iOS', 'macos': 'Mac',
                'linux': 'Linux', 'emulator': '模拟器', 'android': '安卓', 'other': '其他'}
    return {
        'uid': 'tg%s' % pid, 'kind': 'touchgal', 'tg_id': pid, 'tg_unique': uniq,
        'name': name, 'title': name, 'type': 'GAL',
        'version': '', 'platform': '/'.join(plat_map.get(p, p) for p in plats) or 'PC',
        'size_mb': None, 'cover': str(item.get('banner') or ''),
        'source_url': '%s/%s' % (site, uniq) if uniq else site,
        'date': str(item.get('created') or '')[:10],
        'tags': [lang_map.get(l, l) for l in langs][:3] +
                (['评分 %.1f' % float(item['averageRating'])] if item.get('averageRating') else []),
        'rating': item.get('averageRating') or 0,
        'downloads': item.get('download') or 0,
        'sources_detail': [{'id': 'touchgal', 'label': 'TouchGal',
                            'url': '%s/%s' % (site, uniq) if uniq else site, 'password': ''}],
        'passwords': [], 'folder': '', 'matched_by': '',
    }


def tg_mine(cfg, pages=5, keyword='', limit=24):
    """把 TouchGal 的资源拉进卡片库（kind=touchgal），与叶酱卡片并列展示。"""
    if not tg_available():
        raise rc.RCError(3010, '没装 curl_cffi，TouchGal 通道不可用')
    pages = max(1, min(int(pages or 1), 20))
    got, seen_pid = [], set()
    for page in range(1, pages + 1):
        if _cancel.is_set():
            break
        PROG.phase('tg:%d' % page, 'TouchGal 第 %d/%d 页' % (page, pages), total=pages)
        try:
            items = tg_search(cfg, keyword, limit=limit, page=page)
        except Exception as e:
            PROG.log('TouchGal 第 %d 页失败：%s' % (page, e))
            items = []
        for it in items:
            pid = it.get('id') if isinstance(it, dict) else None
            if not pid or pid in seen_pid:
                continue
            seen_pid.add(pid)
            try:
                got.append(tg_card(cfg, it))
            except Exception:
                continue
        PROG.log('  第 %d 页：累计 %d 部' % (page, len(got)), quiet=True)
        PROG.set(done=page, total=pages)
    return got


@rc.interface('yegames.tg.list')
def yg_tg_list(params):
    data = params if isinstance(params, dict) else {}
    cfg = load_config()
    apply_net_policy(cfg)
    if not tg_available():
        raise rc.RCError(3010, '没装 curl_cffi，TouchGal 通道不可用')
    page = max(1, int(data.get('page') or 1))
    limit = max(1, min(int(data.get('limit') or 24), 50))
    items = tg_search(cfg, str(data.get('keyword') or ''), limit=limit, page=page)
    return {'items': [tg_card(cfg, it) for it in items if isinstance(it, dict)],
            'page': page, 'limit': limit, 'total_hint': 4183}


@rc.interface('yegames.tg.mine')
def yg_tg_mine(params):
    data = params if isinstance(params, dict) else {}
    cfg = load_config()
    apply_net_policy(cfg)
    if PROG.snapshot().get('running'):
        raise rc.RCError(3007, '已有任务在跑（挖掘或 TouchGal 导入）')
    if not _mine_lock.acquire(blocking=False):
        raise rc.RCError(3007, '已有任务在跑')
    try:
        _cancel.clear()
        PROG.reset('tg', 'TouchGal 导入')
        cards = tg_mine(cfg, int(data.get('pages') or cfg.get('touchgal', {}).get('mine_pages') or 5),
                        str(data.get('keyword') or ''))
        lib = _read_json(LIBRARY_FILE, {}) or {}
        all_cards = lib.get('cards') or {}
        now = time.time()
        new = upd = same = 0
        for c in cards:
            old = all_cards.get(c['uid'])
            if old:
                changed = [k for k in ('name', 'rating', 'downloads', 'cover')
                           if (old.get(k) or '') != (c.get(k) or '')]
                c['first_seen'] = old.get('first_seen') or now
                c['state'] = 'updated' if changed else 'active'
                c['changed'] = changed
                upd += 1 if changed else 0
                same += 0 if changed else 1
            else:
                c['first_seen'] = now
                c['state'] = 'new'
                c['changed'] = []
                c['kind'] = 'touchgal'
                new += 1
            c['last_seen'] = now
            c['kind'] = 'touchgal'
            all_cards[c['uid']] = c
        lib['cards'] = all_cards
        lib['ts'] = now
        _write_json(LIBRARY_FILE, lib)
        PROG.set(stats={'total': len(all_cards), 'new': new, 'updated': upd,
                        'same': same, 'stale': 0, 'imported': len(cards)})
        PROG.log('TouchGal 导入：%d 部（新增 %d / 更新 %d）' % (len(cards), new, upd))
        PROG.phase('done', '完成')
        PROG.set(running=False)
        return {'message': 'TouchGal 导入 %d 部（新增 %d）' % (len(cards), new),
                'imported': len(cards), 'stats': PROG.snapshot().get('stats')}
    except Exception as e:
        PROG.phase('error', '出错：%s' % e)
        PROG.set(running=False, error=str(e))
        raise rc.RCError(3011, 'TouchGal 导入失败：%s' % e)
    finally:
        try:
            _mine_lock.release()
        except Exception:
            pass


@rc.interface('yegames.tg.links')
def yg_tg_links(params):
    data = params if isinstance(params, dict) else {}
    cfg = load_config()
    apply_net_policy(cfg)
    pid = data.get('id') or data.get('patch_id')
    if not pid:
        uid = str(data.get('uid') or '')
        lib = _read_json(LIBRARY_FILE, {}) or {}
        card = (lib.get('cards') or {}).get(uid) or {}
        pid = card.get('tg_id')
    if not pid:
        raise rc.RCError(3002, '缺少 patchId')
    if not tg_available():
        raise rc.RCError(3010, '没装 curl_cffi，TouchGal 通道不可用')
    rows = tg_links(cfg, pid)
    if rows:
        lib = _read_json(LIBRARY_FILE, {}) or {}
        for c in (lib.get('cards') or {}).values():
            if str(c.get('tg_id') or '') == str(pid):
                c['pan_links'] = rows
                _write_json(LIBRARY_FILE, lib)
                break
    return {'patch_id': pid, 'links': rows,
            'site_url': '%s/%s' % (_tg_site(cfg), data.get('unique') or ''),
            'message': ('%d 条网盘链接' % len(rows)) if rows else '这个资源页没有链接'}
def _sim(a, b):
    import difflib
    na = re.sub(r'[\s\u3000【】\[\]()（）!！?？~～・/\\|｜,，.。:：;；\'"“”]', '', str(a or '')).lower()
    nb = re.sub(r'[\s\u3000【】\[\]()（）!！?？~～・/\\|,，.。:：;；\'"“”]', '', str(b or '')).lower()
    if not na or not nb:
        return 0.0
    if na in nb or nb in na:
        return 1.0
    return round(difflib.SequenceMatcher(None, na, nb).ratio(), 3)


def tg_hunt(cfg, name, limit=3):
    """按作品名在 TouchGal 搜一遍，取候选资源链接并打分，避免张冠李戴。"""
    if not (tg_available() and _tg_cfg(cfg)['enabled']):
        return [], '未安装 curl_cffi，TouchGal 通道不可用', []
    min_score = float((cfg.get('touchgal') or {}).get('min_score') or 0.62)
    accepted, candidates, err = [], [], ''
    try:
        items = tg_search(cfg, name, limit=limit)
    except Exception as e:
        return [], 'TouchGal 搜索失败：%s' % e, []
    for it in items[:limit]:
        if not isinstance(it, dict):
            continue
        pid = it.get('id') or it.get('patchId') or it.get('uniqueId')
        hit_name = str(it.get('name') or '')
        score = _sim(name, hit_name)
        if not pid:
            continue
        try:
            got = tg_links(cfg, pid)
        except Exception as e:
            err = 'TouchGal 资源失败：%s' % e
            continue
        for f in got:
            f['hit'] = hit_name[:60]
            f['score'] = score
        if score >= min_score:
            accepted.extend(got)
        else:
            candidates.extend(got[:2])
    return accepted, err, candidates


@rc.interface('yegames.hunt.url')
def yg_hunt_url(params):
    data = params if isinstance(params, dict) else {}
    cfg = load_config()
    apply_net_policy(cfg)
    url = str(data.get('url') or '').strip()
    cookie = str(data.get('cookie') or '').strip()
    res = hunt_page(url, cookie, cfg['timeout_sec'])
    res['message'] = ('挖到 %d 条网盘链接' % len(res['found'])) if res['found'] else (res['note'] or '没挖到链接')
    return res


@rc.interface('yegames.hunt.item')
def yg_hunt_item(params):
    """对卡片库里的某张卡：把它所有来源页都抓一遍，挖网盘直链并回写卡片。"""
    data = params if isinstance(params, dict) else {}
    cfg = load_config()
    apply_net_policy(cfg)
    uid = str(data.get('uid') or '')
    lib = _read_json(LIBRARY_FILE, {}) or {}
    card = (lib.get('cards') or {}).get(uid)
    if not card:
        raise rc.RCError(3004, '卡片库里没有这部作品')
    pages = [s.get('url') for s in (card.get('sources_detail') or []) if s.get('url')]
    if data.get('url'):
        pages.insert(0, str(data['url']))
    links, notes, seen = [], [], set()
    for page in pages[:4]:
        src_id = next((s.get('id') for s in (card.get('sources_detail') or [])
                       if s.get('url') == page), '')
        ck = str(data.get('cookie') or '') or _cookie_for(cfg, src_id)
        try:
            r = hunt_page(page, ck, cfg['timeout_sec'])
        except Exception as e:
            notes.append('%s：抓取失败 %s' % (page[:48], e))
            continue
        if r['note']:
            notes.append('%s：%s' % (page[:48], r['note']))
        for f in r['found']:
            if f['url'] in seen:
                continue
            seen.add(f['url'])
            f['from'] = page
            links.append(f)
    # 页面里没有 → 换 TouchGal 的公开资源 API 找（它存的是真下载链）
    candidates = []
    if not links:
        tg, tg_err, candidates = tg_hunt(cfg, card.get('name') or card.get('title') or '')
        for f in tg:
            if f['url'] in seen:
                continue
            seen.add(f['url'])
            links.append(f)
        if tg:
            notes.append('TouchGal 命中 %d 条（%s，相似度 %.2f）'
                         % (len(tg), tg[0].get('hit') or '', float(tg[0].get('score') or 0)))
        elif tg_err:
            notes.append(tg_err)
        elif candidates:
            notes.append('TouchGal 只有相近结果（%s，相似度 %.2f），未自动采用'
                         % (candidates[0].get('hit') or '', float(candidates[0].get('score') or 0)))
        else:
            notes.append('TouchGal 也没搜到这部')
    if links:
        card['pan_links'] = links
        lib['cards'][uid] = card
        _write_json(LIBRARY_FILE, lib)
    return {'uid': uid, 'links': links, 'notes': notes, 'candidates': candidates[:6],
            'message': ('挖到 %d 条网盘链接' % len(links)) if links
                       else ('没挖到直链，但有 %d 条相近候选' % len(candidates) if candidates else '没挖到网盘链接')}

IFACE_IDS = [
    'yegames.info', 'yegames.config.get', 'yegames.config.save',
    'yegames.library.list', 'yegames.mine.start', 'yegames.mine.status',
    'yegames.mine.cancel', 'yegames.item.links', 'yegames.item.bind',
    'yegames.folder.list', 'yegames.index.stats',
    'yegames.dl.start', 'yegames.dl.status', 'yegames.dl.list',
    'yegames.dl.cancel', 'yegames.dl.remove',
    'yegames.hunt.url', 'yegames.hunt.item',
    'yegames.tg.list', 'yegames.tg.mine', 'yegames.tg.links',
]


if __name__ == '__main__':
    _cfg = load_config()
    os.makedirs(_cfg['download_dir'], exist_ok=True)
    apply_net_policy(_cfg)
    try:
        _dl_sweep_interrupted()
    except Exception:
        pass
    rc.serve(
        endpoint=os.environ.get('RC_ENDPOINT', ''),
        name=NAME, version=VERSION,
        manifest={'label': LABEL,
                  'description': '多源挖掘叶酱汉化作品 + 卡片库 + 内置下载器'},
        frontend={'pages': [{'path': '', 'title': LABEL}]},
        iface_ids=IFACE_IDS,
        plugin_dir=PLUGIN_DIR,
    )
