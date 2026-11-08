# -*- coding: utf-8 -*-
"""QQ 头像与昵称解析。

★ 为什么要单独一个模块：
  头像/昵称在三个地方都要用 —— 概览的账号卡片、QQ 账户列表、聊天记录里的
  发言者。之前每一处各自拼、各自取，结果是：
    · 概览只从 GetQuickLoginListNew 取（已登录才有），
      没登录就全空，界面上一片灰圆圈；
    · 聊天记录里的发言者根本没有头像字段，
      前端只能显示一个空白 div。

★ 头像从哪来：
  OneBot 的 get_login_info 只返回 {user_id, nickname}，**没有头像**；
  群成员信息（get_group_member_info）也没有。
  QQ 头像本身是独立服务，按 QQ 号就能取：
      https://q1.qlogo.cn/g?b=qq&nk=<QQ号>&s=<边长>
  实测 200 + image/jpeg，可以直接放进 <img src>。
  所以头像不需要等 QQ 登录，只要知道 QQ 号就能显示。

★ 昵称优先级：
  群名片(card) > 昵称(nickname) > QQ 号
  —— 群里别人看到的名字通常是群名片。
"""

import re

# 头像服务。q1/q2 是腾讯的 CDN，任选其一都能取到。
_AVA_HOSTS = ('https://q1.qlogo.cn', 'https://q2.qlogo.cn')

# ★ QQ 的"表情占位符"：群名里带自定义表情时，客户端存的是
#     <$ÿĀ\x11">名字<$ÿĀ\x11">
#   这种内部标记。OneBot 把它原样吐出来（SnowLuma 实测），
#   浏览器里就渲染成一串乱码 `<$ÿĀ">橙服①群<$ÿĀ">`。
#   这里把 <$...> 段和 C0 控制字符一起去掉，只留可读文本。
_QQ_MARKUP = re.compile(r'<\$[^>]{0,32}>')
_CTRL = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')

# ★ 不可见字符：BOM / 零宽空格 / 方向标记 / 软连字符 …
#   Python 的 str.split() 不认为它们是空白，所以 '\ufeff \ufeffjvwoOIAO'
#   这种昵称清洗后仍然是"看不见的开头"，界面上就像昵称丢了。
#   注意别动 U+200C/U+200D（ZWJ）—— emoji 家庭组合靠它连着。
_INVIS = re.compile(r'[\u200b\u200e\u200f\u2060\ufeff\u00ad\u180e]')


def clean_name(s, limit=80):
    """清洗 QQ 名字：去表情占位符 / 控制字符，压缩空白。"""
    out = _QQ_MARKUP.sub('', str(s or ''))
    out = _CTRL.sub('', out)
    out = _INVIS.sub('', out)
    # 落单的代理项（UTF-16 半个 emoji）会让 json 序列化炸掉，一并清掉
    out = ''.join(ch for ch in out if not (0xd800 <= ord(ch) <= 0xdfff))
    return ' '.join(out.split())[:limit]


def avatar_url(uin, size=100):
    """按 QQ 号拼头像 URL。QQ 号无效时返回空串。

    size 是方形边长（像素），腾讯支持 40/100/240 等。
    """
    u = str(uin or '').strip()
    if not u.isdigit():
        return ''
    if len(u) < 5 or len(u) > 12:
        return ''
    return '%s/g?b=qq&nk=%s&s=%d' % (_AVA_HOSTS[0], u, int(size))


def group_avatar_url(gid, owner='', size=100):
    """群头像 URL。

    ★ 群头像**不能**用个人头像接口：
        https://q1.qlogo.cn/g?b=qq&nk=<群号>
      群号也是 9~10 位数字，落在合法 QQ 号区间，qlogo 会返回**某个陌生人的头像**
      （实测每个群返回的图都不一样 —— 全是随机路人，界面上特别违和）。

    群头像的正确格式是 QQ 的群头像接口：
        https://p.qlogo.cn/gh/<群号>/<群主QQ号>/<尺寸>
      但实测（2026-11-06）对这些群 CDN 一律返回同一张默认占位图
      （1657 字节的"两个人"图标），换 UA / 加 Referer 也一样 —— 说明这些群的
      自定义群头像不对外公开。

    所以这里的取舍：**优先用群主的个人头像**
    （QQ 的老行为就是：群没自定义群头像时，群里显示的就是群主头像），
    至少是真的、和群相关的图；拿不到群主再退回官方群头像接口（占位图也比
    陌生人的照片强）。
    """
    g = str(gid or '').strip()
    o = str(owner or '').strip()
    if o.isdigit():
        return avatar_url(o, size)
    if g.isdigit():
        return 'https://p.qlogo.cn/gh/%s/%s/%d' % (g, g, int(size))
    return ''


def display_name(uin, nick='', card=''):
    """显示名：群名片 > 昵称 > QQ 号。

    card 是群里的名片（sender.card），nick 是个人昵称（sender.nickname）。
    """
    for v in (card, nick):
        s = clean_name(v)
        if s:
            return s
    return str(uin or '')


def sender_profile(sender):
    """从 OneBot 事件里的 sender 提取 (uin, name, avatar)。

    sender 结构（OneBot11）：
        {user_id, nickname, card, role, sex, age, title, level}
    群名片在 card，个人昵称在 nickname。
    """
    s = sender or {}
    uin = str(s.get('user_id') or s.get('uin') or '').strip()
    name = display_name(uin, s.get('nickname') or '', s.get('card') or '')
    return uin, name, avatar_url(uin)
