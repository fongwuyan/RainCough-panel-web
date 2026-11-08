# -*- coding: utf-8 -*-
"""全量聊天档案：写入、查询、撤回打标、导出。

与 store.messages 的区别（别搞混）：
  messages   喂给 LLM 的上下文，过滤后才写，图片压成 [图片]，可清空
  chat_logs  这里管 —— 全量、原始段 JSON、撤回标记、永久保留

为什么撤回只能靠"先存内容再打标"：
  OneBot 的 group_recall / friend_recall 事件只带 message_id，不带原文
  （实测协议端反编译出的类定义）。
  所以消息到达那一刻必须把内容存下来，撤回事件只负责按 msg_id 打标。
"""
import json
import os
import time

from . import logbuf, profile, store

MEDIA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'media')

# 媒体根目录覆盖（测试用；正常走 config.chat.media_dir）
_media_root_override = None


def set_media_root(path):
    """强制指定媒体根目录（测试与特殊部署用）。传 None 恢复默认。"""
    global _media_root_override
    _media_root_override = path

# 媒体段类型 → 落盘扩展名
_EXT_BY_TYPE = {
    'image': '.jpg',
    'record': '.mp3',
    'video': '.mp4',
    'file': '.bin',
    'face': '.gif',
}


def media_root(cfg=None):
    """媒体根目录：config.chat.media_dir > 默认 <包目录>/media。

    传入 cfg 时直接用它（不重读文件）—— 消息处理路径上会频繁调用。
    """
    if _media_root_override:
        return _media_root_override
    d = ''
    if cfg is not None:
        d = ((cfg.get('chat') or {}).get('media_dir') or '')
    else:
        try:
            from . import config as _cfg
            d = ((_cfg.load().get('chat') or {}).get('media_dir') or '')
        except Exception:
            pass
    return d or MEDIA_DIR


def _now():
    return int(time.time())


def _json(v, default=''):
    if isinstance(v, str):
        return v
    try:
        return json.dumps(v, ensure_ascii=False)
    except Exception:
        return default


# ---------------------------------------------------------------- 写入

async def record(account_id, kind, target_id, role, segs, sender_id='', sender_name='',
                  msg_id='', created_at=0, session_id=None, media=None,
                  sender_avatar=''):
    """写一条聊天档案。返回新行 id。

    segs  —— OneBot 原始消息段数组（list[dict]）
    media —— 媒体副本清单（list[dict]），由 media.py 填好后传进来
    sender_avatar —— 发言者头像 URL（按 QQ 号从 qlogo 取）
    """
    if session_id is None:
        session_id = store.session_key(kind, target_id, 'public', account_id)
    # ★ 同一条消息可能被记两次：
    #   · SnowLuma 开了 reportSelfMessage → 事件流里来一次 message_sent
    #   · 发送动作成功后 _record_own 兜底又记一次
    #   以前没有去重，自发消息要么一条没有、要么变两条。按 (账号, msg_id, role)
    #   判重；msg_id 为空时不去重（老数据/拿不到 id 的发送仍要记下来）。
    msg_id = str(msg_id or '')
    if msg_id:
        cur = await store._db.execute(
            'SELECT id FROM chat_logs WHERE account_id=? AND msg_id=? AND role=? LIMIT 1',
            (account_id or '', msg_id, role or 'user'))
        dup = await cur.fetchone()
        if dup:
            return dup['id']
    text = seg_text(segs)
    if not sender_avatar:
        sender_avatar = profile.avatar_url(sender_id)
    cur = await store._db.execute(
        'INSERT INTO chat_logs(account_id,session_id,kind,target_id,msg_id,sender_id,sender_name,'
        'sender_avatar,role,segs,text,media,recalled,recalled_by,recalled_at,created_at)'
        ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,\'\',0,?)',
        (account_id or '', session_id, kind or '', str(target_id or ''), str(msg_id or ''),
         str(sender_id or ''), str(sender_name or ''), str(sender_avatar or ''),
         role or 'user',
         _json(segs, '[]'), text, _json(media or [], '[]'),
         int(created_at or _now())))
    await store._db.commit()
    row_id = cur.lastrowid
    # 媒体索引同步落一份，媒体库直接查它
    try:
        await _index_media(row_id, account_id, session_id, msg_id, media or [],
                           sender_id, sender_name, int(created_at or _now()))
    except Exception as e:
        logbuf.debug('chat', '媒体索引写入失败：%s' % str(e)[:120])
    return row_id


async def _index_media(chat_id, account_id, session_id, msg_id, media,
                       sender_id='', sender_name='', created_at=0):
    """把媒体清单写进 media_files 索引表。"""
    for m in media:
        if not isinstance(m, dict):
            continue
        rel = m.get('rel') or ''
        if not rel:
            continue
        try:
            await store._db.execute(
                'INSERT OR REPLACE INTO media_files(account_id,session_id,msg_id,chat_id,'
                'kind,rel,bytes,mime,name,sender_id,sender_name,playable,transcode,created_at)'
                ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                (account_id or '', session_id or '', str(msg_id or ''), int(chat_id or 0),
                 m.get('kind') or '', rel, int(m.get('bytes') or 0),
                 m.get('mime') or '', m.get('name') or '',
                 str(sender_id or ''), str(sender_name or ''),
                 1 if m.get('playable', 1) else 0, m.get('transcode') or '',
                 int(created_at or 0)))
        except Exception as e:
            logbuf.debug('chat', '索引单条媒体失败：%s' % str(e)[:100])


async def update_media_entry(account_id, msg_id, entry):
    """回填转码结果（媒体转码是后台任务，完成后要更新库）。

    同时更新 chat_logs.media 里的那条记录和 media_files 索引。
    """
    if not msg_id or not entry:
        return 0
    seg = int(entry.get('seg') or 0)
    cur = await store._db.execute(
        'SELECT id, media FROM chat_logs WHERE account_id=? AND msg_id=?'
        ' ORDER BY id DESC LIMIT 1', (account_id or '', str(msg_id)))
    row = await cur.fetchone()
    if not row:
        return 0
    media = _loads(row['media'], [])
    changed = False
    old_rel = ''
    for m in media:
        if isinstance(m, dict) and int(m.get('seg') or 0) == seg:
            old_rel = m.get('rel') or ''
            m['rel'] = entry.get('rel') or m.get('rel')
            m['bytes'] = entry.get('bytes') or m.get('bytes')
            m['mime'] = entry.get('mime') or m.get('mime')
            m['playable'] = 1 if entry.get('playable') else 0
            m['transcode'] = entry.get('transcode') or ''
            changed = True
            break
    if changed:
        await store._db.execute('UPDATE chat_logs SET media=? WHERE id=?',
                                (_json(media, '[]'), row['id']))
    try:
        # ★ 必须按**旧 rel** 定位那一条 ——
        #   一个消息可能有多段媒体，只有一段转码了；
        #   如果按 msg_id 批量更新，会把其它段也改成同一个 rel。
        await store._db.execute(
            'UPDATE media_files SET rel=?, bytes=?, mime=?, playable=?, transcode=?'
            ' WHERE account_id=? AND msg_id=? AND rel=?',
            (entry.get('rel') or '', int(entry.get('bytes') or 0),
             entry.get('mime') or '', 1 if entry.get('playable') else 0,
             entry.get('transcode') or '', account_id or '', str(msg_id),
             old_rel or ''))
    except Exception as e:
        logbuf.debug('chat', '更新媒体索引失败：%s' % str(e)[:100])
    await store._db.commit()
    return 1 if changed else 0


async def _all_media_rels():
    """所有消息里引用到的媒体 rel 集合。

    ★ 为什么用 Python 解析而不是 SQL LIKE：
      json.dumps 的输出是 `"rel": "x.mp4"`（冒号后**有空格**），
      任何按 `'"rel":"x"'` 做的字符串匹配都对不上 ——
      我在这上面栽过：转码后索引更新静默失效、重建索引把索引全清空。
      JSON 结构一变，字符串匹配就全废。统一走解析。
    """
    cur = await store._db.execute('SELECT media FROM chat_logs')
    rels = set()
    for r in await cur.fetchall():
        for m in _loads(r['media'], []):
            if isinstance(m, dict) and m.get('rel'):
                rels.add(m['rel'])
    return rels


async def _rewrite_media(chat_id, mutate):
    """按 id 取出一行的 media，交给 mutate 改，再整体写回。

    mutate(media_list) -> bool（返回 True 表示有改动）
    这样改 JSON 不用在 SQL 里做字符串替换。
    """
    cur = await store._db.execute('SELECT media FROM chat_logs WHERE id=?', (chat_id,))
    row = await cur.fetchone()
    if not row:
        return False
    media = _loads(row['media'], [])
    if not mutate(media):
        return False
    await store._db.execute('UPDATE chat_logs SET media=? WHERE id=?',
                            (_json(media, '[]'), chat_id))
    return True


async def repair_media_refs():
    """修复媒体引用。

    场景：视频转码后文件名从 x.mp4 变成 x.h264.mp4，磁盘上只剩新的，
    但消息里还指向旧的 x.mp4 → 前端取不到文件 → 表现为"视频播不出来"。

    这里把指向已不存在文件的引用，改到同名的转码产物上。
    返回 {fixed, files}。
    """
    root = media_root()
    fixed = 0
    nfile = 0
    cur = await store._db.execute('SELECT id, media FROM chat_logs')
    for r in await cur.fetchall():
        media = _loads(r['media'], [])
        if not media:
            continue
        hit = False
        for m in media:
            if not isinstance(m, dict):
                continue
            rel = m.get('rel') or ''
            if not rel or not m.get('local'):
                continue
            if os.path.isfile(os.path.join(root, rel)):
                continue
            base, _ = os.path.splitext(rel)
            for cand, mime in ((base + '.h264.mp4', 'video/mp4'),
                               (base + '.mp3', 'audio/mpeg')):
                if os.path.isfile(os.path.join(root, cand)):
                    m['rel'] = cand
                    m['mime'] = mime
                    m['playable'] = 1
                    m['transcode'] = 'done'
                    try:
                        m['bytes'] = os.path.getsize(os.path.join(root, cand))
                    except Exception:
                        pass
                    hit = True
                    nfile += 1
                    break
        if hit:
            await store._db.execute('UPDATE chat_logs SET media=? WHERE id=?',
                                    (_json(media, '[]'), r['id']))
            fixed += 1
    # 索引同步
    await rebuild_media_index()
    await store._db.commit()
    logbuf.info('chat', '修复媒体引用：%d 条消息，%d 个文件' % (fixed, nfile))
    return {'fixed': fixed, 'files': nfile}


async def rebuild_media_index():
    """从 chat_logs.media 重建媒体索引（补齐历史数据 + 清僵尸行）。

    历史消息入库时还没有 media_files 表，索引是空的。
    转码后文件名会变，旧 rel 的索引行就成了"文件不存在"的僵尸 ——
    重建时按 chat_logs 里还在引用的 rel 清理掉。
    """
    cur = await store._db.execute(
        'SELECT id, account_id, session_id, msg_id, sender_id, sender_name,'
        ' media, created_at FROM chat_logs')
    rows = await cur.fetchall()
    n = 0
    for r in rows:
        media = _loads(r['media'], [])
        if not media:
            continue
        await _index_media(r['id'], r['account_id'], r['session_id'], r['msg_id'],
                           media, r['sender_id'], r['sender_name'], r['created_at'])
        n += len([m for m in media if isinstance(m, dict) and m.get('rel')])

    # 清理僵尸：rel 已经不被任何消息引用了
    refs = await _all_media_rels()
    cur = await store._db.execute('SELECT id, rel FROM media_files')
    zom = [r['id'] for r in await cur.fetchall()
           if (r['rel'] or '') not in refs]
    for zid in zom:
        await store._db.execute('DELETE FROM media_files WHERE id=?', (zid,))
    await store._db.commit()
    logbuf.info('chat', '重建媒体索引：%d 条，清理僵尸 %d 条' % (n, len(zom)))
    return {'indexed': n, 'messages': len(rows), 'cleaned': len(zom)}


def seg_text(segs):
    """从消息段里抽纯文本（图片/语音等转成占位，供搜索与降级渲染）。"""
    if isinstance(segs, str):
        return segs
    out = []
    for s in segs or []:
        if not isinstance(s, dict):
            continue
        t = s.get('type')
        d = s.get('data') or {}
        if t == 'text':
            out.append(d.get('text') or '')
        elif t == 'at':
            out.append('@%s' % (d.get('qq') or ''))
        elif t == 'image':
            out.append('[图片]')
        elif t == 'face':
            out.append('[表情]')
        elif t == 'record':
            out.append('[语音]')
        elif t == 'video':
            out.append('[视频]')
        elif t == 'file':
            out.append('[文件:%s]' % (d.get('name') or ''))
        elif t == 'reply':
            out.append('[引用]')
        elif t == 'json':
            out.append('[卡片]')
        elif t == 'xml':
            out.append('[XML]')
    return ''.join(out).strip()


# ---------------------------------------------------------------- 撤回

async def mark_recalled(account_id, msg_id, by='', kind='', target=''):
    """按 message_id 给已记录的消息打撤回标记。返回命中的行数。

    撤回事件只有 message_id，没有原文 —— 原文在消息到达时就存好了。
    target 是群号/对方 QQ 号：只用来给"没记到原文"的墓碑找对会话，
    不然会落到一个 target 为空的幽灵会话里（前端左侧多出一行空白）。
    """
    if not msg_id:
        return 0
    # account_id 为空表示"不限账号"（面板撤回时不知道账号，
    # 只按 message_id 定位）—— 原来写死 AND account_id=? 会命中 0 行。
    sql = ('UPDATE chat_logs SET recalled=1, recalled_by=?, recalled_at=?'
           ' WHERE msg_id=?')
    args = [str(by or ''), _now(), str(msg_id)]
    if account_id:
        sql += ' AND account_id=?'
        args.append(account_id)
    cur = await store._db.execute(sql, args)
    await store._db.commit()
    n = cur.rowcount or 0
    if n:
        logbuf.info('chat', '撤回 %s 条消息（msg_id=%s，账号 %s）' % (n, msg_id, account_id))
    else:
        # 没命中：这条消息我们没记录到（机器人离线期间撤的，或 msg_id 对不上）。
        # 补一条墓碑，让聊天记录里能看出"这里原本有东西被撤了"。
        await _tombstone(account_id, msg_id, by, kind, target)
    return n


async def _tombstone(account_id, msg_id, by, kind, target=''):
    """撤回但没记录到原文 → 写一条占位。"""
    if not target:
        # 找不到归属会话就干脆不写 —— 宁可少一条墓碑，
        # 也不要凭空造一个会话（之前就是这么冒出空会话的）。
        logbuf.debug('chat', '撤回墓碑跳过（不知道会话）：msg_id=%s' % msg_id)
        return
    sid = store.session_key(kind or 'private', str(target), 'public', account_id)
    # ★ 通知事件带的 message_id 可能和发送时返回的不是同一个
    #   （实测：自己通过面板撤回，delete_msg 回 652940071，而 friend_recall 通知是 1061180367）。
    #   这时 mark_recalled 按 id 找不到会补墓碑，结果同一条撤回出现两行。
    #   处理办法：该会话最近 30 秒内已经有一条"已撤回"记录，就不再补墓碑。
    try:
        cur0 = await store._db.execute(
            'SELECT 1 FROM chat_logs WHERE session_id=? AND recalled=1 AND created_at>?'
            ' ORDER BY id DESC LIMIT 1', (sid, _now() - 30))
        if await cur0.fetchone():
            logbuf.debug('chat', '撤回墓碑跳过（该会话刚撤回过）：msg_id=%s' % msg_id)
            return
    except Exception:
        pass
    try:
        await store._db.execute(
            'INSERT INTO chat_logs(account_id,session_id,kind,target_id,msg_id,sender_id,'
            'sender_name,sender_avatar,role,segs,text,media,recalled,recalled_by,recalled_at,created_at)'
            ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)',
            (account_id or '', sid, kind or '', str(target), str(msg_id or ''), '', '',
             '', 'system', '[]', '有人撤回了一条消息', '[]', str(by or ''), _now(), _now()))
        await store._db.commit()
    except Exception as e:
        logbuf.debug('chat', '墓碑写入失败：%s' % str(e)[:120])


# ---------------------------------------------------------------- 查询

async def save_session_ui(session_id, pinned=None, muted=None,
                          last_read_id=None, draft=None, account_id=''):
    """保存会话的置顶 / 免打扰 / 已读位置 / 草稿。

    只传要改的字段，其余保持原值。
    """
    sid = str(session_id or '')
    if not sid:
        raise ValueError('缺少 session_id')
    cur = await store._db.execute(
        'SELECT * FROM session_ui WHERE session_id=?', (sid,))
    row = await cur.fetchone()
    old = dict(row) if row else {}
    pinned_v = int(old.get('pinned') or 0) if pinned is None else (1 if pinned else 0)
    muted_v = int(old.get('muted') or 0) if muted is None else (1 if muted else 0)
    collapsed_v = int(old.get('collapsed') or 0)
    lr_v = int(old.get('last_read_id') or 0) if last_read_id is None else int(last_read_id)
    draft_v = old.get('draft') or '' if draft is None else str(draft)
    acc = account_id or old.get('account_id') or ''
    await store._db.execute(
        'INSERT OR REPLACE INTO session_ui(session_id, account_id, pinned, muted,'
        ' collapsed, last_read_id, draft, updated_at) VALUES(?,?,?,?,?,?,?,?)',
        (sid, acc, pinned_v, muted_v, collapsed_v, lr_v, draft_v, int(time.time())))
    await store._db.commit()
    return {'session_id': sid, 'pinned': pinned_v, 'muted': muted_v,
            'last_read_id': lr_v, 'draft': draft_v}


async def _attach_session_ui(rows):
    """给会话列表补上置顶 / 免打扰 / 未读数。

    未读 = 该会话里 id 大于 last_read_id 的消息条数。
    没有 last_read_id（从没打开过）就按 0 算 —— 免得第一次进来满屏红点。
    """
    if not rows:
        return
    sids = [r['session_id'] for r in rows]
    marks = ', '.join('?' * len(sids))
    try:
        cur = await store._db.execute(
            'SELECT session_id, pinned, muted, last_read_id, draft'
            ' FROM session_ui WHERE session_id IN (%s)' % marks, sids)
        ui = {r['session_id']: dict(r) for r in await cur.fetchall()}
    except Exception:
        ui = {}
    for r in rows:
        u = ui.get(r['session_id']) or {}
        lr = int(u.get('last_read_id') or 0)
        r['pinned'] = int(u.get('pinned') or 0)
        r['muted'] = int(u.get('muted') or 0)
        r['last_read_id'] = lr
        r['draft'] = u.get('draft') or ''
        r['unread'] = 0
        if lr:
            try:
                cur2 = await store._db.execute(
                    'SELECT COUNT(*) FROM chat_logs WHERE session_id=? AND id>?',
                    (r['session_id'], lr))
                row2 = await cur2.fetchone()
                r['unread'] = int(row2[0]) if row2 else 0
            except Exception:
                r['unread'] = 0
    # 置顶的排前面，其余按最后一条消息时间倒序
    rows.sort(key=lambda r: (-int(r.get('pinned') or 0), -int(r.get('last_at') or 0)))


async def list_sessions(account_id='', kind='', keyword='', limit=200):
    """会话列表（按最后一条消息时间倒序）。

    这是"聊天记录"页左侧的列表：按账号 → 群/私聊 → 会话。
    """
    sql = ('SELECT session_id, account_id, kind, target_id,'
           ' COUNT(*) AS msg_count, MAX(created_at) AS last_at,'
           ' SUM(recalled) AS recalled_count,'
           # 会话列表右侧要显示的"最后一条消息"摘要 + 发送者：
           # 取该会话 id 最大的一行，换行压成空格再截断。
           ' (SELECT substr(replace(replace(c2.text, char(10), \' \'), char(13), \' \'), 1, 60)'
           '    FROM chat_logs c2 WHERE c2.session_id = chat_logs.session_id'
           '    ORDER BY c2.id DESC LIMIT 1) AS preview,'
           ' (SELECT c2.sender_name FROM chat_logs c2 WHERE c2.session_id = chat_logs.session_id'
           '    ORDER BY c2.id DESC LIMIT 1) AS preview_who'
           " FROM chat_logs WHERE target_id<>''")
    args = []
    if account_id:
        sql += ' AND account_id=?'
        args.append(account_id)
    if kind:
        sql += ' AND kind=?'
        args.append(kind)
    sql += ' GROUP BY session_id ORDER BY last_at DESC LIMIT ?'
    args.append(int(limit))
    if keyword:
        # 关键词过滤放在这层：先按关键词筛出命中的会话，再取列表
        pass
    cur = await store._db.execute(sql, args)
    rows = [dict(r) for r in await cur.fetchall()]
    await _attach_session_ui(rows)
    if keyword:
        k = ('%' + keyword.lower() + '%')
        keep = []
        for r in rows:
            cur2 = await store._db.execute(
                'SELECT 1 FROM chat_logs WHERE session_id=? AND'
                ' (LOWER(text) LIKE ? OR LOWER(sender_name) LIKE ?) LIMIT 1',
                (r['session_id'], k, k))
            if await cur2.fetchone():
                keep.append(r)
        rows = keep
    return rows


async def list_messages(session_id, before_id=0, limit=50, keyword=''):
    """消息分页（倒序游标：给 before_id 取更早的）。

    前端向上滚动加载更多时用这个 —— 比 OFFSET 稳，插入新消息也不会错位。
    """
    sql = 'SELECT * FROM chat_logs WHERE session_id=?'
    args = [session_id]
    if before_id:
        sql += ' AND id<?'
        args.append(int(before_id))
    if keyword:
        sql += ' AND LOWER(text) LIKE ?'
        args.append('%' + keyword.lower() + '%')
    sql += ' ORDER BY id DESC LIMIT ?'
    args.append(int(limit))
    cur = await store._db.execute(sql, args)
    rows = [dict(r) for r in await cur.fetchall()]
    for r in rows:
        r['segs'] = _loads(r.get('segs'), [])
        r['media'] = _loads(r.get('media'), [])
        _abs_media(r['media'])

    # ★ 引用消息解析：OneBot 的 reply 段只给 message_id，不给原文。
    #   这里一次性把被引用的消息查出来（批量 IN，不做 N+1），
    #   前端就能直接显示"某某：……"，而不是干巴巴的占位。
    rids = []
    for r in rows:
        for s in (r.get('segs') or []):
            if isinstance(s, dict) and s.get('type') == 'reply':
                mid = str((s.get('data') or {}).get('id') or '')
                if mid:
                    rids.append(mid)
    if rids:
        rids = list(set(rids))
        q = ','.join('?' * len(rids))
        try:
            cur2 = await store._db.execute(
                'SELECT msg_id, sender_name, text FROM chat_logs WHERE msg_id IN (%s)' % q,
                rids)
            hit = {str(x['msg_id']): dict(x) for x in await cur2.fetchall()}
            for r in rows:
                for s in (r.get('segs') or []):
                    if isinstance(s, dict) and s.get('type') == 'reply':
                        mid = str((s.get('data') or {}).get('id') or '')
                        h = hit.get(mid)
                        # 被引用消息自身的 text 可能已经带 "[引用]..." 前缀
                        # （入库时把引用写进了正文），这里剥掉，避免套娃
                        qt = ((h or {}).get('text') or '')
                        if qt.startswith('[引用]'):
                            qt = qt[4:].lstrip()
                        r['quote'] = {
                            'msg_id': mid,
                            'sender': (h or {}).get('sender_name') or '',
                            'text': qt[:80],
                        }
        except Exception as e:
            logbuf.debug('chat', '引用解析失败：%s' % str(e)[:120])
    return list(reversed(rows))


def _loads(s, default):
    if isinstance(s, (list, dict)):
        return s
    try:
        return json.loads(s)
    except Exception:
        return default


async def stats(account_id=''):
    """统计：条数、撤回数、时间跨度。"""
    sql = 'SELECT COUNT(*) AS c, SUM(recalled) AS rc, MIN(created_at) AS t0, MAX(created_at) AS t1 FROM chat_logs'
    args = []
    if account_id:
        sql += ' WHERE account_id=?'
        args.append(account_id)
    cur = await store._db.execute(sql, args)
    row = await cur.fetchone()
    c = (row['c'] or 0) if row else 0
    return {
        'messages': c,
        'recalled': (row['rc'] or 0) if row else 0,
        'from': (row['t0'] or 0) if row else 0,
        'to': (row['t1'] or 0) if row else 0,
    }


# ---------------------------------------------------------------- 导出

async def export(account_id='', session_id='', date_from=0, date_to=0):
    """导出 JSON（按账号 / 会话 / 日期范围）。

    返回 (dict, 文件名)。字段与前端展示一致，含撤回标记与媒体相对路径。
    """
    sql = 'SELECT * FROM chat_logs WHERE 1=1'
    args = []
    if account_id:
        sql += ' AND account_id=?'
        args.append(account_id)
    if session_id:
        sql += ' AND session_id=?'
        args.append(session_id)
    if date_from:
        sql += ' AND created_at>=?'
        args.append(int(date_from))
    if date_to:
        sql += ' AND created_at<=?'
        args.append(int(date_to))
    sql += ' ORDER BY id ASC'
    cur = await store._db.execute(sql, args)
    rows = [dict(r) for r in await cur.fetchall()]

    sess = {}
    order = []
    for r in rows:
        sid = r['session_id']
        if sid not in sess:
            sess[sid] = {
                'session_id': sid,
                'account_id': r.get('account_id') or '',
                'kind': r.get('kind') or '',
                'target_id': r.get('target_id') or '',
                'messages': [],
            }
            order.append(sid)
        sess[sid]['messages'].append({
            'msg_id': r.get('msg_id') or '',
            'sender': {'id': r.get('sender_id') or '',
                       'name': r.get('sender_name') or '',
                       # 头像：库里存的是入库时按 QQ 号取到的 URL；
                       # 旧数据没有这一列 → 现算一个（QQ 号在就一定有头像）
                       'avatar': (r.get('sender_avatar') or ''
                                  or profile.avatar_url(r.get('sender_id') or ''))},
            'role': r.get('role') or 'user',
            'created_at': r.get('created_at') or 0,
            'text': r.get('text') or '',
            'segs': _loads(r.get('segs'), []),
            'media': _loads(r.get('media'), []),
            'recalled': bool(r.get('recalled')),
            'recalled_by': r.get('recalled_by') or '',
            'recalled_at': r.get('recalled_at') or 0,
        })

    accounts = []
    seen = set()
    for r in rows:
        aid = r.get('account_id') or ''
        if aid and aid not in seen:
            seen.add(aid)
            accounts.append({'id': aid, 'uin': aid[1:] if aid.startswith('a') else aid})

    doc = {
        'exported_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'version': 1,
        'accounts': accounts,
        'sessions': [sess[s] for s in order],
    }
    name = 'chat-export-%s.json' % time.strftime('%Y%m%d-%H%M%S')
    return doc, name


# ---------------------------------------------------------------- 清空会话

async def clear_session(session_id, with_media=False, account_id=''):
    """一键清空某个会话的全部消息。

    默认只删消息记录（聊天档案），媒体文件保留。
    with_media=True 时连媒体文件一起删 —— 索引行也会同步清掉。

    返回 {messages, files, bytes}。
    """
    if not session_id:
        raise ValueError('缺少 session_id')

    # 先收集要删的媒体（要先拿到 rel 才能删文件）
    files, nbytes = [], 0
    if with_media:
        cur = await store._db.execute(
            'SELECT rel, bytes FROM media_files WHERE session_id=?'
            + (' AND account_id=?' if account_id else ''),
            ([session_id, account_id] if account_id else [session_id]))
        for r in await cur.fetchall():
            if r['rel']:
                files.append(r['rel'])
                nbytes += int(r['bytes'] or 0)

    cur = await store._db.execute(
        'DELETE FROM chat_logs WHERE session_id=?'
        + (' AND account_id=?' if account_id else ''),
        ([session_id, account_id] if account_id else [session_id]))
    nmsg = cur.rowcount or 0

    await store._db.execute(
        'DELETE FROM media_files WHERE session_id=?'
        + (' AND account_id=?' if account_id else ''),
        ([session_id, account_id] if account_id else [session_id]))
    await store._db.commit()

    nfile = 0
    if with_media:
        root = media_root()
        for rel in files:
            try:
                p = os.path.join(root, rel)
                if os.path.isfile(p):
                    os.remove(p)
                    nfile += 1
            except Exception as e:
                logbuf.debug('chat', '删媒体文件失败 %s：%s' % (rel, str(e)[:80]))
        _rm_empty_dirs(root)

    logbuf.info('chat', '清空会话 %s：%d 条消息，%d 个媒体文件'
                % (session_id, nmsg, nfile))
    return {'messages': nmsg, 'files': nfile, 'bytes': nbytes}


def _rm_empty_dirs(root):
    """删完文件后把空目录清掉（媒体目录会越堆越多空壳）。"""
    if not root or not os.path.isdir(root):
        return
    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        if dirpath == root:
            continue
        try:
            if not os.listdir(dirpath):
                os.rmdir(dirpath)
        except Exception:
            pass


# ---------------------------------------------------------------- 查询

# 消息类型 → 判定条件
#   text   —— 纯文本（不含图片/语音/视频占位）
#   image / video / record / face / file —— 含对应类型的媒体段
_KIND_TEXT = 'text'


async def query_messages(sender='', recalled='', kind='', keyword='',
                         session_id='', account_id='', date_from=0, date_to=0,
                         limit=50, before_id=0):
    """按条件查消息。

    sender  —— QQ 号（数字，精确匹配 sender_id）或昵称（模糊匹配 sender_name）
    recalled—— '' 全部 / 'yes' 已撤回 / 'no' 未撤回
    kind    —— '' 全部 / text 文本 / image 图片 / video 视频 / record 语音
               / face 表情 / file 文件
    keyword —— 文本关键词（模糊）
    条件之间是「与」关系，可以叠加使用。
    """
    sql = 'SELECT * FROM chat_logs WHERE 1=1'
    args = []

    if account_id:
        sql += ' AND account_id=?'
        args.append(account_id)
    if session_id:
        sql += ' AND session_id=?'
        args.append(session_id)
    if sender:
        s = str(sender).strip()
        if s.isdigit():
            sql += ' AND sender_id=?'
            args.append(s)
        else:
            sql += ' AND sender_name LIKE ?'
            args.append('%' + s + '%')
    if recalled == 'yes':
        sql += ' AND recalled=1'
    elif recalled == 'no':
        sql += ' AND recalled=0'
    if date_from:
        sql += ' AND created_at>=?'
        args.append(int(date_from))
    if date_to:
        sql += ' AND created_at<=?'
        args.append(int(date_to))
    if keyword:
        sql += ' AND LOWER(text) LIKE ?'
        args.append('%' + str(keyword).lower() + '%')

    if kind and kind != 'all':
        if kind == _KIND_TEXT:
            # 纯文本：不含任何媒体占位符，也不含撤回墓碑
            sql += (" AND text!=''"
                    " AND text NOT LIKE '%[图片]%'"
                    " AND text NOT LIKE '%[语音]%'"
                    " AND text NOT LIKE '%[视频]%'"
                    " AND text NOT LIKE '%[表情]%'"
                    " AND text NOT LIKE '%[文件:%'"
                    " AND text NOT LIKE '%[卡片]%'"
                    " AND text NOT LIKE '%一条消息被撤回%'")
        else:
            # 含该类型媒体：用 media JSON 里的 kind 判定
            # ★ 这里不能用 '%s' 格式化 —— 模式串里的 % 会被当成格式符。
            #   模式串本身是参数，% 在 LIKE 里是通配符，安全。
            sql += ' AND media LIKE ?'
            # ★ 模式串前后都要 % —— 少了末尾的 % 就变成"必须匹配到结尾"，
            #   而 JSON 里 "kind": "video" 后面还有别的字段，永远匹配不上。
            args.append('%"kind": "' + str(kind) + '"%')

    if before_id:
        sql += ' AND id<?'
        args.append(int(before_id))

    sql += ' ORDER BY id DESC LIMIT ?'
    args.append(int(limit))

    cur = await store._db.execute(sql, args)
    rows = [dict(r) for r in await cur.fetchall()]
    for r in rows:
        r['segs'] = _loads(r.get('segs'), [])
        r['media'] = _loads(r.get('media'), [])
        _abs_media(r['media'])

    # 类型筛选做一次 Python 精确复核（SQL 的 LIKE 只是粗筛，
    # 万一 JSON 格式变了也不会漏掉/错判）
    if kind and kind != 'all' and kind != _KIND_TEXT:
        rows = [r for r in rows
                if any(isinstance(m, dict) and (m.get('kind') or '') == kind
                       for m in r['media'])]

    total = len(rows)
    return list(reversed(rows)), total


def _abs_media(media):
    """给媒体清单补绝对路径与存在性标记。

    前端要拿它拼面板的文件预览 URL（/api/fm/preview?path=…），
    媒体根目录是配置项，不能在前端硬编码。
    exists=0 表示文件已经不在了（被删/被清）—— 前端据此显示"已失效"，
    不该再去发请求（会刷一串 404）。
    """
    root = media_root()
    for m in media:
        if isinstance(m, dict) and m.get('rel'):
            p = os.path.join(root, m['rel'])
            m['abs'] = p
            try:
                m['exists'] = 1 if os.path.isfile(p) else 0
            except Exception:
                m['exists'] = 0
    return media


async def query_senders(keyword='', limit=200):
    """列出聊天里出现过的发送者（给查询界面做自动补全）。"""
    sql = ('SELECT sender_id, sender_name, COUNT(*) AS c, MAX(created_at) AS last_at'
           ' FROM chat_logs WHERE sender_id!=\'\' GROUP BY sender_id, sender_name'
           ' ORDER BY c DESC LIMIT ?')
    args = [int(limit)]
    if keyword:
        sql = ('SELECT sender_id, sender_name, COUNT(*) AS c, MAX(created_at) AS last_at'
               ' FROM chat_logs WHERE (sender_id LIKE ? OR sender_name LIKE ?)'
               ' AND sender_id!=\'\' GROUP BY sender_id, sender_name'
               ' ORDER BY c DESC LIMIT ?')
        args = ['%' + keyword + '%', '%' + keyword + '%', int(limit)]
    cur = await store._db.execute(sql, args)
    rows = [dict(r) for r in await cur.fetchall()]
    for r in rows:
        r['avatar'] = profile.avatar_url(r.get('sender_id') or '')
    return rows


# ---------------------------------------------------------------- 媒体库

async def list_media(kind='', sender='', keyword='', session_id='',
                     account_id='', limit=100, offset=0):
    """媒体库列表。"""
    sql = 'SELECT * FROM media_files WHERE 1=1'
    args = []
    if account_id:
        sql += ' AND account_id=?'
        args.append(account_id)
    if kind and kind != 'all':
        sql += ' AND kind=?'
        args.append(kind)
    if session_id:
        sql += ' AND session_id=?'
        args.append(session_id)
    if sender:
        s = str(sender).strip()
        if s.isdigit():
            sql += ' AND sender_id=?'
            args.append(s)
        else:
            sql += ' AND sender_name LIKE ?'
            args.append('%' + s + '%')
    if keyword:
        sql += ' AND (LOWER(name) LIKE ? OR LOWER(rel) LIKE ?)'
        args.append('%' + str(keyword).lower() + '%')
        args.append('%' + str(keyword).lower() + '%')

    cur = await store._db.execute(sql + ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
                                  args + [int(limit), int(offset)])
    rows = [dict(r) for r in await cur.fetchall()]
    root = media_root()
    for r in rows:
        r['avatar'] = profile.avatar_url(r.get('sender_id') or '')
        r['abs'] = os.path.join(root, r.get('rel') or '') if r.get('rel') else ''
        r['exists'] = 1
        try:
            r['exists'] = 1 if os.path.isfile(r['abs']) else 0
        except Exception:
            r['exists'] = 0
    return rows


async def media_stats(account_id=''):
    """媒体库统计：按类型分组的数量与占用。"""
    sql = ('SELECT kind, COUNT(*) AS c, SUM(bytes) AS b FROM media_files WHERE 1=1')
    args = []
    if account_id:
        sql += ' AND account_id=?'
        args.append(account_id)
    sql += ' GROUP BY kind'
    cur = await store._db.execute(sql, args)
    rows = await cur.fetchall()
    per = []
    total = 0
    files = 0
    for r in rows:
        b = int(r['b'] or 0)
        c = int(r['c'] or 0)
        total += b
        files += c
        per.append({'kind': r['kind'] or '', 'count': c, 'bytes': b})
    return {'items': per, 'total_bytes': total, 'total_files': files}


async def delete_media(ids=None, rels=None, kind='', session_id=''):
    """删除媒体文件（连磁盘文件一起删，并更新 chat_logs 里的引用）。

    ids  —— media_files.id 列表
    rels —— 相对路径列表（精确删）
    """
    root = media_root()
    targets = []
    if ids:
        q = ','.join('?' * len(ids))
        cur = await store._db.execute(
            'SELECT id, rel, bytes FROM media_files WHERE id IN (%s)' % q, list(ids))
        targets = await cur.fetchall()
    elif rels:
        for rel in rels:
            targets.append({'id': 0, 'rel': rel, 'bytes': 0})
    elif kind or session_id:
        sql = 'SELECT id, rel, bytes FROM media_files WHERE 1=1'
        args = []
        if kind and kind != 'all':
            sql += ' AND kind=?'
            args.append(kind)
        if session_id:
            sql += ' AND session_id=?'
            args.append(session_id)
        cur = await store._db.execute(sql, args)
        targets = await cur.fetchall()

    nfile = 0
    freed = 0
    for t in targets:
        rel = t['rel'] if isinstance(t, dict) else t[1]
        try:
            p = os.path.join(root, rel)
            if os.path.isfile(p):
                freed += os.path.getsize(p)
                os.remove(p)
                nfile += 1
        except Exception as e:
            logbuf.debug('chat', '删媒体失败 %s：%s' % (rel, str(e)[:80]))

    # 清理索引与 chat_logs 引用
    relset = set(t['rel'] if isinstance(t, dict) else t[1] for t in targets)
    for t in targets:
        rel = t['rel'] if isinstance(t, dict) else t[1]
        tid = t['id'] if isinstance(t, dict) else 0
        try:
            if tid:
                await store._db.execute('DELETE FROM media_files WHERE id=?', (tid,))
            else:
                await store._db.execute('DELETE FROM media_files WHERE rel=?', (rel,))
        except Exception as e:
            logbuf.debug('chat', '清理媒体索引失败：%s' % str(e)[:100])

    # 消息里的引用要改成空（用 Python 改 JSON，不用 SQL 字符串替换 ——
    #   json.dumps 的输出带空格，字符串匹配会静默失效）
    if relset:
        cur = await store._db.execute('SELECT id, media FROM chat_logs')
        for r in await cur.fetchall():
            media = _loads(r['media'], [])
            if not media:
                continue
            hit = False
            for m in media:
                if isinstance(m, dict) and (m.get('rel') or '') in relset:
                    m['rel'] = ''
                    m['local'] = 0
                    m['playable'] = 0
                    hit = True
            if hit:
                await store._db.execute('UPDATE chat_logs SET media=? WHERE id=?',
                                        (_json(media, '[]'), r['id']))
    await store._db.commit()
    _rm_empty_dirs(root)
    logbuf.info('chat', '删除媒体：%d 个文件，释放 %.1f MB'
                % (nfile, freed / 1048576.0))
    return {'files': nfile, 'bytes': freed, 'entries': len(targets)}


async def media_need_transcode():
    """待转码的媒体（历史遗留的 HEVC / AMR 等）。

    用于媒体库里的「一键转成可播放格式」。
    """
    root = media_root()
    out = []
    cur = await store._db.execute(
        "SELECT id, kind, rel, bytes FROM media_files WHERE transcode IN ('','failed')")
    for r in await cur.fetchall():
        if r['kind'] not in ('video', 'record'):
            continue
        p = os.path.join(root, r['rel'] or '')
        if not os.path.isfile(p):
            continue
        out.append({'id': r['id'], 'kind': r['kind'], 'rel': r['rel'],
                    'bytes': r['bytes'] or 0})
    return out


async def transcode_media(ids):
    """把指定媒体转成浏览器可播放的格式。

    返回 {ok, failed, items}。
    """
    from . import ffmpeg, silk
    root = media_root()
    done = 0
    failed = 0
    items = []
    if not ids:
        return {'ok': 0, 'failed': 0, 'items': []}
    q = ','.join('?' * len(ids))
    cur = await store._db.execute(
        'SELECT id, kind, rel, bytes, mime, msg_id FROM media_files WHERE id IN (%s)' % q,
        list(ids))
    rows = await cur.fetchall()
    for r in rows:
        rel = r['rel'] or ''
        p = os.path.join(root, rel)
        if not os.path.isfile(p):
            failed += 1
            continue
        # ★ 用原子转码：先写临时文件，成功了才替换。
        #   历史语音文件后缀是 .mp3 但内容是 AMR，直接输出到同名文件会被
        #   ffmpeg 拒绝（输入输出同路径），失败清理还会把原件删掉。
        # ★ SILK（SnowLuma 的 QQ 原生语音）ffmpeg 解不了，得先过 pilk。
        if r['kind'] == 'record' and silk.is_silk(p):
            dst = os.path.splitext(p)[0] + '.mp3'
            if dst == p:
                dst = p + '.conv.mp3'
            ok = await silk.to_mp3(p, dst)
            new_path = dst if ok else ''
            new_mime = 'audio/mpeg' if ok else ''
        else:
            kind = 'audio' if r['kind'] == 'record' else 'video'
            new_path, new_mime = await ffmpeg.convert_atomic(p, kind)
            ok = bool(new_path)
        if ok:
            new_rel = os.path.relpath(new_path, root).replace(os.sep, '/')
            try:
                new_bytes = os.path.getsize(new_path)
            except Exception:
                new_bytes = 0
            # 转码成功后清掉原件（路径变了才删）
            try:
                if os.path.abspath(new_path) != os.path.abspath(p):
                    os.remove(p)
            except Exception:
                pass
        else:
            new_rel = rel
            new_mime = r['mime']
            new_bytes = r['bytes']

        if ok:
            await store._db.execute(
                'UPDATE media_files SET rel=?, bytes=?, mime=?, playable=1, transcode=?'
                ' WHERE id=?', (new_rel, new_bytes, new_mime, 'done', r['id']))
            # ★ 删掉旧 rel 的索引行：转码后文件名变了，旧行会变成"文件不存在"的僵尸条目。
            if new_rel != rel:
                await store._db.execute(
                    'DELETE FROM media_files WHERE rel=? AND id!=?', (rel, r['id']))

            # 消息里的引用同步更新（用 Python 改 JSON —— json.dumps 的输出带空格，
            #   按字符串匹配会静默失效）
            def _mut(media, rel=rel, new_rel=new_rel, new_mime=new_mime,
                     new_bytes=new_bytes):
                hit = False
                for m in media:
                    if isinstance(m, dict) and (m.get('rel') or '') == rel:
                        m['rel'] = new_rel
                        m['mime'] = new_mime
                        m['bytes'] = new_bytes
                        m['playable'] = 1
                        m['transcode'] = 'done'
                        hit = True
                return hit

            cur = await store._db.execute(
                'SELECT id, media FROM chat_logs WHERE msg_id=?', (str(r['msg_id'] or ''),))
            for row in await cur.fetchall():
                media = _loads(row['media'], [])
                if _mut(media):
                    await store._db.execute('UPDATE chat_logs SET media=? WHERE id=?',
                                            (_json(media, '[]'), row['id']))
            done += 1
            items.append({'id': r['id'], 'rel': new_rel, 'kind': r['kind'], 'ok': True})
        else:
            await store._db.execute(
                'UPDATE media_files SET transcode=? WHERE id=?', ('failed', r['id']))
            failed += 1
            items.append({'id': r['id'], 'rel': rel, 'kind': r['kind'], 'ok': False})
    await store._db.commit()
    return {'ok': done, 'failed': failed, 'items': items}


# ---------------------------------------------------------------- 清理

async def purge_media_only(account_id='', date_from=0, date_to=0, session_id=''):
    """只清媒体文件，保留消息文本（默认行为）。

    永久保留是明确要求，所以这里**只删媒体副本**：
    磁盘紧张时能腾出空间，但聊天记录本身一条不丢。
    """
    sql = 'SELECT id, media, session_id, created_at FROM chat_logs WHERE 1=1'
    args = []
    if account_id:
        sql += ' AND account_id=?'
        args.append(account_id)
    if session_id:
        sql += ' AND session_id=?'
        args.append(session_id)
    if date_from:
        sql += ' AND created_at>=?'
        args.append(int(date_from))
    if date_to:
        sql += ' AND created_at<=?'
        args.append(int(date_to))
    cur = await store._db.execute(sql, args)
    rows = await cur.fetchall()

    root = media_root()
    freed = 0
    nfile = 0
    touched = []
    for r in rows:
        media = _loads(r['media'], [])
        if not media:
            continue
        changed = False
        for m in media:
            if not m.get('local') or not m.get('rel'):
                continue
            p = os.path.join(root, m['rel'])
            try:
                if os.path.isfile(p):
                    freed += os.path.getsize(p)
                    os.remove(p)
                    nfile += 1
                m['local'] = 0
                changed = True
            except Exception as e:
                logbuf.debug('chat', '删媒体失败 %s：%s' % (m.get('rel'), str(e)[:80]))
        if changed:
            touched.append((r['id'], _json(media, '[]')))
    for mid, mj in touched:
        await store._db.execute('UPDATE chat_logs SET media=? WHERE id=?', (mj, mid))
    await store._db.commit()
    logbuf.info('chat', '清理媒体：%d 个文件，释放 %.1f MB（消息文本保留）'
                % (nfile, freed / 1048576.0))
    return {'files': nfile, 'bytes': freed, 'messages': len(touched)}


async def check_media_consistency():
    """巡检：库里标了有本地副本、但文件已不在的记录。

    磁盘被外部清理过（比如运维手动删了目录）时，靠这个找出来。
    """
    cur = await store._db.execute('SELECT id, media FROM chat_logs')
    root = media_root()
    missing = []
    total = 0
    for r in await cur.fetchall():
        media = _loads(r['media'], [])
        for m in media:
            if not m.get('local') or not m.get('rel'):
                continue
            total += 1
            if not os.path.isfile(os.path.join(root, m['rel'])):
                missing.append({'id': r['id'], 'rel': m['rel']})
    return {'total': total, 'missing': missing[:200], 'missing_count': len(missing)}
