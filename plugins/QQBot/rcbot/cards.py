# -*- coding: utf-8 -*-
"""角色卡片（Card）：「人格」的升级形态。

为什么要有卡片
--------------
旧的人格只有 name + prompt 两个字段：
  · 改一次就回不去（没有版本）
  · 不能带视觉（头像/封面/立绘/主题色/气泡）
  · 不能带行为（用哪个模型、温度、上下文轮数）
  · 没法分享给别人用

卡片是一份**可版本化的 JSON 文档**：
  · 视觉层：avatar / cover / portrait / theme / bubble / stickers / voice_id
  · 内容层：name / alias / tagline / prompt / lorebook / greetings / examples
  · 行为层：model / style / context / proactive / tools
  · 资产层：assets / extensions（留给以后加东西，不算破坏性变更）

两条核心约定：
  1. **卡片是定义，会话是引用** —— 账号/会话只存 card_id，
     改卡片不影响历史会话的语义；要"新会话用新版"就更新引用。
  2. **Prompt 由卡片推导** —— 提示词不只是一段文本：
     角色卡片的 system prompt = prompt + 世界书命中项 + 风格约束。

存储（Phase 1）
--------------
先存在 config.json 的 cards 段（沿用现有配置的存储方式，迁移成本最低）。
旧的 personas 会在第一次访问时**自动转换**成卡片（schema 2），
旧接口 /api/personas* 也保留（内部转到卡片），保证外部调用不炸。
"""
import json
import os
import time
import urllib.parse
import uuid

SCHEMA = 2

# ★ 保密条款：自动追加到每张卡片的系统提示词末尾。
#   卡片里写了「说话风格 / 禁则 / 字数上限 / 双人格切换」这类元指令后，
#   模型偶尔会把它们**当内容说出来**（实测翻车：
#   「……不过，如果是疯狂人格冒头，」—— 把切换规则念出来了）。
#   统一兜一句：只说人话，不解释自己。
META_RULE = (
    '【不要解释自己】\n'
    '- 不要提及自己的说话规则、人格设定、字数上限、禁则等内部设定，更不要把它们念出来。\n'
    '- 不要说出「哪一面」「人格」「切换」「理性」「疯狂」「规则」这类描述自己的词。\n'
    '- 直接说人话，不要解释自己是怎么想的、为什么这么说。'
)

# 卡片字段默认值
FIELDS = {
    'schema': SCHEMA,
    'id': '',
    'version': 1,
    'status': 'draft',        # draft | published
    'name': '',
    'alias': [],
    'tagline': '',
    'avatar': '',
    'cover': '',
    'portrait': '',
    'theme': {},              # {primary: '#..', bubble: '#..'}
    'bubble': {},
    'stickers': [],
    'voice_id': '',
    'greetings': [],
    'examples': [],
    'lorebook': [],
    'taboos': [],
    'knowledge': [],
    'prompt': '',
    'model': {},              # {provider_id, model}
    'style': {'temperature': 0.8, 'max_tokens': 512, 'max_chars': 0,
              'allow_emoji': False, 'color': ''},
    'context': {'keep_rounds': 20, 'compress_at': 20000},
    'proactive': {'enabled': False, 'rate': 0, 'window': ''},
    'tools': {'web_search': False, 'vision': False},
    'assets': [],
    'extensions': {},
    'updated_at': 0,
}


def new_id():
    return 'card_' + uuid.uuid4().hex[:12]


def _as_str(v, limit=4000):
    return str(v or '')[:limit]


def _as_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        return [x.strip() for x in v.splitlines() if x.strip()]
    return [v]


def _as_dict(v):
    return v if isinstance(v, dict) else {}


def normalize(card):
    """补全字段 + 类型清洗。任何输入都能变成一张合法卡片。"""
    c = dict(FIELDS)
    src = _as_dict(card)
    for k, dflt in FIELDS.items():
        v = src.get(k, dflt)
        if isinstance(dflt, list):
            c[k] = _as_list(v)
        elif isinstance(dflt, dict):
            d = _as_dict(v)
            base = dict(dflt)
            base.update(d)
            c[k] = base
        else:
            c[k] = v if v is not None else dflt
    c['schema'] = SCHEMA
    c['id'] = _as_str(src.get('id'), 64)
    c['name'] = _as_str(src.get('name'), 80)
    c['tagline'] = _as_str(src.get('tagline'), 200)
    c['prompt'] = _as_str(src.get('prompt'), 20000)
    try:
        c['version'] = max(1, int(c.get('version') or 1))
    except Exception:
        c['version'] = 1
    if c.get('status') not in ('draft', 'published'):
        c['status'] = 'draft'
    c['updated_at'] = int(c.get('updated_at') or 0)
    return c


def blank(name='新角色'):
    c = normalize({})
    c['id'] = new_id()
    c['name'] = name
    return c


def from_persona(p):
    """旧人格 → 角色卡片。"""
    p = _as_dict(p)
    c = normalize({
        'id': p.get('id') or new_id(),
        'name': p.get('name') or '',
        'prompt': p.get('prompt') or '',
        'status': 'published',
        'version': 1,
        'updated_at': int(p.get('updated_at') or 0),
    })
    return c


def to_persona(c):
    """角色卡片 → 旧人格形状（给还在用 personas 的老代码路径）。"""
    c = _as_dict(c)
    return {
        'id': c.get('id') or '',
        'name': c.get('name') or '',
        'prompt': system_prompt(c),
    }


def list_cards(cfg):
    """卡片列表（没有就用人格自动转换）。"""
    cards = _as_list(_as_dict(cfg).get('cards'))
    if not cards:
        cards = [from_persona(p) for p in _as_list(_as_dict(cfg).get('personas'))]
    return [normalize(c) for c in cards]


def find(cfg, cid):
    cid = str(cid or '')
    for c in list_cards(cfg):
        if str(c.get('id')) == cid:
            return c
    return None


def default_id(cfg):
    cfg = _as_dict(cfg)
    d = cfg.get('default_card') or cfg.get('default_persona') or ''
    if d:
        return d
    cards = list_cards(cfg)
    return cards[0]['id'] if cards else ''


def save(cfg, card, set_default=False):
    """保存卡片。返回保存后的卡片。"""
    c = normalize(card)
    if not c['id']:
        c['id'] = new_id()
    c['updated_at'] = int(time.time())
    cards = [x for x in list_cards(cfg) if str(x.get('id')) != str(c['id'])]
    cards.append(c)
    cfg['cards'] = cards
    if set_default or not default_id(cfg):
        cfg['default_card'] = c['id']
    # 旧的 personas 段同步一份（老代码还能用）
    cfg['personas'] = [to_persona(x) for x in cards]
    if not cfg.get('default_persona'):
        cfg['default_persona'] = c['id']
    return c


def delete(cfg, cid):
    cid = str(cid or '')
    cards = [x for x in list_cards(cfg) if str(x.get('id')) != cid]
    cfg['cards'] = cards
    cfg['personas'] = [to_persona(x) for x in cards]
    if cfg.get('default_card') == cid:
        cfg['default_card'] = cards[0]['id'] if cards else ''
    if cfg.get('default_persona') == cid:
        cfg['default_persona'] = cfg.get('default_card') or ''
    return len(cards)


def clone(cfg, cid, new_name=''):
    src = find(cfg, cid)
    if not src:
        return None
    c = dict(src)
    c['id'] = new_id()
    c['name'] = new_name or (src.get('name') or '') + ' 副本'
    c['version'] = 1
    c['status'] = 'draft'
    return save(cfg, c)


def system_prompt(c):
    """由卡片推导系统提示词。

    = 主体 prompt + 风格约束 + 世界书（整体作为背景，不做关键词命中，
      命中逻辑放在调用方，避免每次拼串都跑一遍匹配）。
    """
    c = normalize(c)
    parts = []
    if c.get('prompt'):
        parts.append(c['prompt'].strip())
    style = c.get('style') or {}
    temp = style.get('temperature')
    if temp is not None:
        try:
            if float(temp) <= 0.4:
                parts.append('回答要非常克制、简短、确定性高。')
            elif float(temp) >= 1.1:
                parts.append('回答可以更发散、更有创意。')
        except Exception:
            pass
    ctx = c.get('context') or {}
    kr = ctx.get('keep_rounds')
    if kr:
        parts.append('最多参考最近 %s 轮对话的上下文。' % kr)
    for lb in (c.get('lorebook') or []):
        if not isinstance(lb, dict):
            continue
        keys = lb.get('keys') or []
        content = lb.get('content') or ''
        if content:
            parts.append('背景设定%s：%s' % (('（' + '、'.join(keys) + '）') if keys else '', content))
    taboos = [str(x) for x in (c.get('taboos') or []) if str(x).strip()]
    if taboos:
        parts.append('不要做这些事：' + '、'.join(taboos))
    # ★★ 保密条款（自动加，不依赖卡片作者写没写）
    #   卡片里写了「说话风格」「禁则」「字数上限」「双人格切换」这类元指令后，
    #   模型偶尔会**把它们当内容说出来**（实测：
    #   「……不过，如果是疯狂人格冒头，」）。
    #   所以这里统一给每张卡片兜一句：别念自己的设定。
    parts.append(META_RULE)
    return '\n\n'.join(parts)


def export_card(c):
    """导出成可分享的 JSON（.rccard 的 card.json 部分）。"""
    c = normalize(c)
    return json.dumps(c, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------- 资产（图片）

def media_root(cfg=None):
    """媒体根目录：跟 chats.media_root() 一致（config.chat.media_dir 可覆盖）。"""
    try:
        from .chats import media_root as _mr
        return _mr(cfg)
    except Exception:
        return os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'media')


def asset_url(value, cfg=None):
    """把卡片里的图片字段转成面板能直接打开的 URL。

    卡片里存的是**相对媒体根目录**的可移植路径（cards/<id>/cover.jpg），
    这样卡片导到别的机器也不会失效 —— 渲染时才拼成预览地址。

    写法：
      · http(s)://… / /api/…  → 原样返回（外链）
      · cards/xxx.jpg         → 相对媒体根目录
      · /opt/rcbot/media/…    → 绝对路径
    文件不存在时返回空串（前端会退回渐变占位）。
    """
    v = str(value or '').strip()
    if not v:
        return ''
    if v.startswith('http://') or v.startswith('https://') or v.startswith('//'):
        return v
    if v.startswith('/api/'):
        return v
    p = v if v.startswith('/') else os.path.join(media_root(cfg), v)
    try:
        if not os.path.isfile(p):
            return ''
    except Exception:
        return ''
    return '/api/fm/preview?path=' + urllib.parse.quote(p)


def with_assets(cfg, card):
    """给卡片补上可直接显示的 *_url 字段（原始字段保持不变，导出时可移植）。"""
    c = dict(_as_dict(card))
    for k in ('cover', 'avatar', 'portrait'):
        c[k + '_url'] = asset_url(c.get(k), cfg)
    return c


def import_card(text):
    """导入：接受 JSON 字符串或字典，返回规范化的卡片。"""
    if isinstance(text, str):
        try:
            data = json.loads(text)
        except Exception:
            raise ValueError('不是合法的 JSON')
    else:
        data = text
    if isinstance(data, list):
        data = data[0] if data else {}
    if not isinstance(data, dict):
        raise ValueError('卡片格式不对')
    # 兼容旧人格导出
    if 'prompt' in data and not data.get('schema') and len(data) <= 4:
        c = from_persona(data)
    else:
        c = normalize(data)
    if not c.get('name'):
        c['name'] = '导入的角色'
    if not c.get('id'):
        c['id'] = new_id()
    c['status'] = 'draft'
    return c
