# -*- coding: utf-8 -*-
"""合并转发展开。

QQ 的「合并转发」在消息里只是一个 forward 段（一个不透明的 id），
要看到里面的内容必须再调 OneBot 的 get_forward_msg。

这里做三件事：
  1. 调 OneBot 取节点（发送者、时间、原始段）
  2. 把节点里的图片/视频下载到媒体目录
     —— QQ 给的 URL 带 rkey，几十小时后就会失效，落盘才不会变破图
  3. 按 forward_id 缓存到数据库：以后再展开直接读缓存，不再打扰 QQ
"""
import hashlib
import json
import os
import time

from . import chats, logbuf, media, store

# 一次最多展开多少条节点（QQ 的转发最多 99 条，留点余量）
MAX_NODES = 200


def _safe(s):
    return ''.join(c if (c.isalnum() or c in '-_.') else '_'
                   for c in str(s or ''))[:60] or 'x'


def _text(segs):
    """节点的一行摘要（纯文本 / @）。"""
    out = []
    for s in segs or []:
        if not isinstance(s, dict):
            continue
        d = s.get('data') or {}
        if s.get('type') == 'text':
            out.append(str(d.get('text') or ''))
        elif s.get('type') == 'at':
            out.append('@' + str(d.get('name') or d.get('qq') or ''))
    return ''.join(out).strip()


async def _cache_get(account_id, forward_id):
    try:
        cur = await store._db.execute(
            'SELECT payload FROM forwards WHERE account_id=? AND forward_id=?',
            (account_id or '', forward_id))
        row = await cur.fetchone()
        if not row:
            return None
        return json.loads(row[0] or '{}')
    except Exception:
        return None


async def _cache_put(account_id, forward_id, payload):
    try:
        await store._db.execute(
            'INSERT OR REPLACE INTO forwards(account_id, forward_id, payload, created_at)'
            ' VALUES(?,?,?,?)',
            (account_id or '', forward_id,
             json.dumps(payload, ensure_ascii=False), int(time.time())))
        await store._db.commit()
    except Exception as e:
        logbuf.debug('forward', '缓存写入失败：%s' % str(e)[:120])


async def expand(bot, forward_id, account_id=''):
    """展开一个合并转发，返回 {nodes, total, truncated, cached}。"""
    fid = str(forward_id or '').strip()
    if not fid:
        raise RuntimeError('缺少 forward id')

    cached = await _cache_get(account_id, fid)
    if cached and cached.get('nodes'):
        out = dict(cached)
        out['cached'] = True
        return out

    ob = getattr(bot, 'ob', None)
    if ob is None:
        raise RuntimeError('QQ 还没连上')

    res = await ob.call('get_forward_msg', {'id': fid}, timeout=25)
    if not isinstance(res, dict) or res.get('status') != 'ok':
        raise RuntimeError('QQ 取不到转发内容：%s'
                           % str((res or {}).get('wording') or (res or {}).get('retcode') or res)[:120])

    msgs = (res.get('data') or {}).get('messages') or []
    root = chats.media_root()
    uin = str(getattr(ob, 'self_id', '') or 'unknown')
    tag = hashlib.sha1(fid.encode('utf-8', 'ignore')).hexdigest()[:10]
    dl = media.downloader()

    nodes = []
    for i, m in enumerate(msgs[:MAX_NODES]):
        if not isinstance(m, dict):
            continue
        segs = m.get('message') or []
        if isinstance(segs, str):
            segs = [{'type': 'text', 'data': {'text': segs}}]
        sender = m.get('sender') or {}
        ts = int(m.get('time') or time.time())
        try:
            entries = await media.save_media(
                segs, ob, root, uin, 'fwd%s_%d' % (tag, i), ts,
                dl=dl, account_id=account_id, allow_transcode=False)
        except Exception as e:
            logbuf.warn('forward', '节点媒体落盘失败：%s' % str(e)[:120])
            entries = []
        for e in entries:
            if e.get('rel'):
                e['abs'] = os.path.join(root, e['rel'])
        nodes.append({
            'sender_id': str(sender.get('user_id') or m.get('user_id') or ''),
            'sender_name': sender.get('card') or sender.get('nickname')
                           or str(m.get('user_id') or ''),
            'time': ts,
            'segs': segs,
            'text': _text(segs),
            'media': [e for e in entries if e.get('local')],
            # 转发里再套转发：只给个 id，不递归展开（避免无限套娃）
            'nested': next(((s.get('data') or {}).get('id')
                            for s in segs
                            if isinstance(s, dict) and s.get('type') == 'forward'), ''),
        })

    payload = {'nodes': nodes, 'total': len(msgs), 'truncated': len(msgs) > MAX_NODES}
    await _cache_put(account_id, fid, payload)
    out = dict(payload)
    out['cached'] = False
    return out
