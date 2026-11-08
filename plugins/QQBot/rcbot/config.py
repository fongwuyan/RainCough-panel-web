# -*- coding: utf-8 -*-
"""配置：JSON 文件 + 默认值深合并 + 原子写。

账号相关（2026-11-01 新增）：
  onebot.accounts[]  —— 每个 QQ 号一条 OneBot 连接
  旧的 onebot.ws_url / access_token / self_id 单值字段保留兼容：
  读配置时若 accounts 为空但 ws_url 有值，自动包装成单个账号，
  这样升级后现有部署不需要改任何配置就能跑起来。
"""
import copy
import json
import os
import threading

_lock = threading.RLock()

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(DIR)
CFG_FILE = os.path.join(ROOT, 'data', 'config.json')

DEFAULT = {
    'onebot': {
        # ★ 默认值里**不放** ws_url/access_token/self_id 这三个旧单值字段。
        #   它们只是兼容老配置的读取入口，一旦有值，
        #   _normalize_accounts 就会在 accounts[] 为空时自动包装出一个
        #   id=a_default 的空账号 —— 界面上多一个没有 QQ 号的条目，
        #   还持续去连 6700 刷"连接失败"警告。
        #   新装机器一律通过 accounts[] 配置；老配置读的时候仍兼容。
        'accounts': [],
    },
    'http': {
        'host': '127.0.0.1',
        'port': 6710,
    },
    'bot': {
        'enabled': True,
        'group_need_at': True,        # 群里必须 @ 才回
        'private_always_reply': True,  # 私聊全部回复
        'reply_with_mention': False,   # 回复时 @ 对方
        'wake_prefix': ['/'],          # 群里的唤醒前缀（发了就回，不用 @）
        'rate_limit': {'window': 60, 'max': 30},
        'allowed_groups': [],          # 空 = 不限
        'blocked_groups': [],
    },
    'context': {
        'max_tokens': 128000,
        'keep_recent_ratio': 0.15,
        'compress_enabled': True,
        'compress_provider': '',       # 空 = 用默认提供商
        'max_history_messages': 200,
        'max_output_tokens': 4096,
    },
    'session_mode': {
        'group': 'public',             # public=群共享 / private=群内每人独立
        'private': 'private',
    },
    'features': {
        'web_search': {'enabled': False, 'max_results': 5},
        'vision': {'enabled': False, 'max_images': 3},
        # ★ #sl 状态指令：任意群/私聊发这个关键词，机器人回一条 SnowLuma 状态。
        #   默认开；关掉后 #sl 当成普通消息走正常的应答流程。
        #   cooldown 是同一会话的冷却秒数，防止群里刷屏。
        'sl_status': {
            'enabled': True,
            'keyword': '#sl',
            'cooldown': 10,
        },
        # ★ 随机挑消息回（消息页 🎲）
        #   scope:
        #     enabled_groups —— 只在「已启用」的群聊里挑（默认）
        #     all_groups     —— 所有群聊
        #     session        —— 只在当前会话里挑（前端临时切换）
        'random_pick': {
            'enabled': True,
            'scope': 'enabled_groups',
        },
    },
    # ★ 聊天记录（全量档案，与喂模型的上下文表分离）
    'chat': {
        'enabled': True,               # 总开关：关掉则完全不记录
        'media_enabled': True,         # 媒体副本开关（关掉只记元数据）
        'download_concurrency': 4,     # 并发下载数（太高压 QQ CDN 会风控）
        'download_timeout': 20,
        'max_media_bytes': 200 * 1024 * 1024,  # 单个媒体上限 200MB
        'media_dir': '',               # 空 = <数据目录同级>/media
        'export_dir': '',              # 空 = <数据目录同级>/exports
    },
    # ★ QQ 框架后端：只用 SnowLuma（Docker 整包，镜像自带 QQ + Xvfb + noVNC）
    #   2026-11-07 起统一为 SnowLuma 单后端；kind 保留字段只为兼容老配置读取。
    'backend': {
        'kind': 'snowluma',
        # noVNC 对外主机名；空则由前端用当前页面 host 拼（推荐）
        'snowluma_public_host': '',
    },
    # ★ 媒体处理
    'media': {
        'ffmpeg': '',                  # ffmpeg 路径（空 = 找系统 PATH 里的）
        'silk_decoder': '',            # silk_v3_decoder 可执行文件路径（仅 silk 语音需要）
        'audio_format': 'mp3',
        'keep_silk_source': True,      # 转码后是否保留原始 .silk
        'transcode_video': True,       # 视频转 H.264（HEVC 浏览器放不了）
    },
    'providers': [],
    'default_provider': '',
    'personas': [],        # 旧的人格（自动同步自 cards，保留兼容）
    'default_persona': '',
    'cards': [],           # 角色卡片（新形态，cards.py 管）
    'default_card': '',
}


def _merge(base, patch):
    if not isinstance(base, dict) or not isinstance(patch, dict):
        return patch
    out = dict(base)
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load():
    with _lock:
        try:
            with open(CFG_FILE, 'r', encoding='utf-8') as f:
                raw = json.load(f) or {}
        except Exception:
            raw = {}
        cfg = _merge(copy.deepcopy(DEFAULT), raw)
        _normalize_accounts(cfg)
        return cfg


def save(cfg):
    with _lock:
        os.makedirs(os.path.dirname(CFG_FILE), exist_ok=True)
        tmp = CFG_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
        os.replace(tmp, CFG_FILE)
    return cfg


def patch(part):
    """局部更新（深合并），返回新配置。"""
    with _lock:
        cfg = load()
        cfg = _merge(cfg, part)
        return save(cfg)


# ---------------------------------------------------------------- 账号

def account_id(uin):
    """账号 id 规则：a<uin>。用 a 前缀是为了跟旧的会话 id 区分开。"""
    u = str(uin or '').strip()
    return ('a%s' % u) if u else ''


def _normalize_accounts(cfg):
    """把 onebot 段整理成统一的 accounts[] 形态（兼容旧的单值字段）。"""
    ob = cfg.get('onebot')
    if not isinstance(ob, dict):
        ob = {}
        cfg['onebot'] = ob
    accs = ob.get('accounts')
    if not isinstance(accs, list):
        accs = []
    ob['accounts'] = accs

    # 旧格式兜底：没有 accounts 但有 ws_url → 包装成单账号
    if not accs and (ob.get('ws_url') or '').strip():
        ob['accounts'] = [{
            'id': account_id(ob.get('self_id')) or 'a_default',
            'uin': str(ob.get('self_id') or ''),
            'ws_url': (ob.get('ws_url') or '').strip(),
            'access_token': ob.get('access_token') or '',
            'enabled': True,
        }]

    # 补全每项的 id / enabled
    seen = set()
    for i, a in enumerate(accs):
        if not isinstance(a, dict):
            accs[i] = {'id': 'a%d' % i, 'uin': '', 'ws_url': '', 'enabled': True}
            a = accs[i]
        uin = str(a.get('uin') or '').strip()
        aid = str(a.get('id') or '').strip() or (account_id(uin) or ('a%d' % i))
        a['id'] = aid
        a['uin'] = uin
        a['enabled'] = bool(a.get('enabled', True))
        a['ws_url'] = (a.get('ws_url') or '').strip()
        if aid in seen:
            # id 撞了：补后缀，避免两个账号共用一份状态
            n = 2
            while ('%s-%d' % (aid, n)) in seen:
                n += 1
            a['id'] = '%s-%d' % (aid, n)
        seen.add(a['id'])
    return cfg


def get_accounts(cfg):
    """返回启用中的账号列表（每项都带 id / uin）。

    ★ 单账户（2026-11-02 从多账户回退）：最多只返回一条。
      配置里若有多条（多账户时代留下的），取第一条 ——
      机器人只会连一个 QQ 号，多条会让事件归属和聊天记录都串掉。
    """
    _normalize_accounts(cfg)
    accs = [a for a in (cfg.get('onebot') or {}).get('accounts') or [] if a.get('enabled')]
    return accs[:1]


def find_account(cfg, aid):
    """按 id 或 uin 找账号。"""
    _normalize_accounts(cfg)
    for a in (cfg.get('onebot') or {}).get('accounts') or []:
        if a.get('id') == aid:
            return a
        if aid and str(a.get('uin') or '') == str(aid):
            return a
    return None


def default_account(cfg):
    """默认账号（第一个启用的）。老部署迁移时用它给历史会话补前缀。"""
    accs = get_accounts(cfg)
    return accs[0] if accs else None


# ---------------------------------------------------------------- 账号级覆盖

def resolve_bot_cfg(cfg, acct=None):
    """账号级触发规则 = 全局 bot 段 + 账号的 bot 覆盖（账号覆盖优先）。

    这样能表达「A 号只服务客服群、B 号在另一个群做娱乐」，
    又不用把全局配置复制一遍。
    """
    base = dict(cfg.get('bot') or {})
    over = (acct or {}).get('bot') or {}
    if isinstance(over, dict):
        for k, v in over.items():
            if v is not None:
                base[k] = v
    return base


def get_provider(cfg, pid=None, acct=None):
    """提供商优先级：会话级 > 账号级 > 全局默认 > 第一个启用的。"""
    pid = pid or (acct or {}).get('provider_id') or cfg.get('default_provider') or ''
    for p in cfg.get('providers') or []:
        if p.get('id') == pid:
            return p
    provs = [p for p in (cfg.get('providers') or []) if p.get('enable', True)]
    return provs[0] if provs else None


def provider_chain(cfg, pid=None, acct=None):
    """按优先级返回**所有可用提供商**（第一个是首选），用于故障转移。

    免 key 的公共端点随时会限流/下线，多配几个自动兜底比卡在一家强。
    """
    chain = []
    first = get_provider(cfg, pid, acct)
    if first:
        chain.append(first)
    for p in (cfg.get('providers') or []):
        if not p.get('enable', True):
            continue
        if first and p.get('id') == first.get('id'):
            continue
        chain.append(p)
    return chain


def get_persona(cfg, pid=None, acct=None):
    """人格优先级：会话级 > 账号级 > 全局默认 > 第一个。

    ★ 现在人格的本体是「角色卡片」（cards.py），这里返回的是**兼容形状**
      （{id, name, prompt}），prompt 由卡片推导（含风格约束与世界书）。
      老的调用方（机器人回复、试聊）不用改。
    """
    from . import cards as _cards
    pid = pid or (acct or {}).get('persona_id') or (acct or {}).get('card_id') \
        or cfg.get('default_card') or cfg.get('default_persona') or ''
    c = _cards.find(cfg, pid)
    if c:
        return _cards.to_persona(c)
    for p in cfg.get('personas') or []:
        if p.get('id') == pid:
            return p
    return (cfg.get('personas') or [None])[0]
