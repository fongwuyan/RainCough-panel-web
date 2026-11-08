# -*- coding: utf-8 -*-
"""存储层（SQLite / aiosqlite）。

两张"消息表"，职责完全不同，别混：

  messages   —— 喂给 LLM 的上下文。只有触发了应答的消息才进来，图片被压成
                "[图片]" 纯文本，可以被清空/删除会话。
  chat_logs  —— 全量聊天档案。每一条收到的消息都进来，保留原始消息段 JSON
                与媒体清单，带撤回标记，**永久保留**，不参与会话清理。

账号维度（2026-11-01）：
  会话 id 统一带账号前缀（a<uin>:group:<gid> / a<uin>:private:<uid>），
  否则两个 QQ 号在同一个群里会共用一份上下文。
"""
import json
import os
import time

import aiosqlite

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(DIR)
DB_FILE = os.path.join(ROOT, 'data', 'rcbot.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  title       TEXT DEFAULT '',
  persona_id  TEXT DEFAULT '',
  provider_id TEXT DEFAULT '',
  enabled     INTEGER DEFAULT 1,
  mode        TEXT DEFAULT 'public',
  account_id  TEXT DEFAULT '',
  created_at  INTEGER DEFAULT 0,
  updated_at  INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  name       TEXT DEFAULT '',
  created_at INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_msg_sess ON messages(session_id, id);
CREATE TABLE IF NOT EXISTS summaries (
  session_id  TEXT PRIMARY KEY,
  content     TEXT DEFAULT '',
  upto_msg_id INTEGER DEFAULT 0,
  updated_at  INTEGER DEFAULT 0
);

-- ★ 全量聊天档案
CREATE TABLE IF NOT EXISTS chat_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   TEXT    NOT NULL,
  session_id   TEXT    NOT NULL,
  kind         TEXT    NOT NULL,
  target_id    TEXT    NOT NULL,
  msg_id       TEXT    DEFAULT '',
  sender_id    TEXT    DEFAULT '',
  sender_name  TEXT    DEFAULT '',
  sender_avatar TEXT   DEFAULT '',
  role         TEXT    NOT NULL,
  segs         TEXT    NOT NULL,
  text         TEXT    DEFAULT '',
  media        TEXT    DEFAULT '[]',
  recalled     INTEGER DEFAULT 0,
  recalled_by  TEXT    DEFAULT '',
  recalled_at  INTEGER DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_sess  ON chat_logs(session_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_acct  ON chat_logs(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_msgid ON chat_logs(account_id, msg_id);
CREATE INDEX IF NOT EXISTS idx_chat_time  ON chat_logs(created_at);

-- ★ 媒体索引（媒体库用）
-- 为什么要单独一张表：media 原本是 chat_logs 里的 JSON 字段，
-- 列媒体库要"按类型/时间/大小/发送者"筛选，靠 JSON 扫很慢也不好加索引。
-- 这里在媒体落盘时同步写一份扁平索引，媒体库直接查这张表。
CREATE TABLE IF NOT EXISTS media_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT    DEFAULT '',
  session_id  TEXT    DEFAULT '',
  msg_id      TEXT    DEFAULT '',
  chat_id     INTEGER DEFAULT 0,      -- 对应 chat_logs.id
  kind        TEXT    DEFAULT '',      -- image / video / record / face / file
  rel         TEXT    DEFAULT '',      -- 相对媒体根目录的路径
  bytes       INTEGER DEFAULT 0,
  mime        TEXT    DEFAULT '',
  name        TEXT    DEFAULT '',
  sender_id   TEXT    DEFAULT '',
  sender_name TEXT    DEFAULT '',
  playable    INTEGER DEFAULT 1,      -- 浏览器能不能直接放
  transcode   TEXT    DEFAULT '',      -- ''/pending/done/failed/skipped
  created_at  INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_media_kind  ON media_files(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_media_sess  ON media_files(session_id);
CREATE INDEX IF NOT EXISTS idx_media_msg   ON media_files(account_id, msg_id);
CREATE INDEX IF NOT EXISTS idx_media_sender ON media_files(sender_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_rel ON media_files(rel);

-- ★ 账号登记表
CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,
  uin         TEXT NOT NULL DEFAULT '',
  nick        TEXT DEFAULT '',
  avatar      TEXT DEFAULT '',
  enabled     INTEGER DEFAULT 1,
  persona_id  TEXT DEFAULT '',
  provider_id TEXT DEFAULT '',
  bot_cfg     TEXT DEFAULT '{}',
  created_at  INTEGER DEFAULT 0,
  updated_at  INTEGER DEFAULT 0
);

-- ★ 会话 UI 状态（置顶 / 免打扰 / 已读位置 / 草稿）
--   这些是"客户端状态"，但放服务端才有意义：换设备也能记住置顶与已读。
CREATE TABLE IF NOT EXISTS session_ui (
  session_id   TEXT PRIMARY KEY,
  account_id   TEXT    DEFAULT '',
  pinned       INTEGER DEFAULT 0,
  muted        INTEGER DEFAULT 0,
  collapsed    INTEGER DEFAULT 0,
  last_read_id INTEGER DEFAULT 0,
  draft        TEXT    DEFAULT '',
  updated_at   INTEGER DEFAULT 0
);

-- ★ 合并转发展开缓存
--   QQ 的合并转发在消息里只有一个不透明的 forward id，
--   展开要再问 OneBot。展开一次后把节点（含已落盘的图片路径）存下来，
--   以后直接读缓存 —— 也避免 QQ 给的 rkey 过期后图片全挂。
CREATE TABLE IF NOT EXISTS forwards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT    DEFAULT '',
  forward_id TEXT    DEFAULT '',
  payload    TEXT    DEFAULT '{}',
  created_at INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fwd_key ON forwards(account_id, forward_id);

-- ★ 迁移版本（幂等迁移用）
CREATE TABLE IF NOT EXISTS schema_version (
  k TEXT PRIMARY KEY,
  v TEXT DEFAULT ''
);
"""

_db = None


async def init():
    global _db
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    _db = await aiosqlite.connect(DB_FILE)
    _db.row_factory = aiosqlite.Row
    await _db.executescript(SCHEMA)
    await _db.commit()
    return _db


async def close():
    global _db
    if _db:
        await _db.close()
        _db = None


def _now():
    return int(time.time())


# ---------------------------------------------------------------- 会话 id

def session_key(kind, target_id, mode='public', account_id='', uid=''):
    """会话 id 规则：

    私聊        a<uin>:private:<uid>
    群公共      a<uin>:group:<gid>
    群私有      a<uin>:group:<gid>:<uid>

    账号前缀是必须的 —— 两个号在同一个群里，否则上下文会串。
    """
    pre = (account_id or '') + ':'
    if kind == 'private':
        return pre + 'private:%s' % target_id
    if mode == 'private':
        return pre + 'group:%s:%s' % (target_id, uid or '')
    return pre + 'group:%s' % target_id


def split_session(sid):
    """拆会话 id：('a1132096843', 'group', '12345', '789')。"""
    parts = (sid or '').split(':')
    acct = ''
    rest = parts
    if parts and parts[0][:1] == 'a' and parts[0][1:].isdigit():
        acct = parts[0]
        rest = parts[1:]
    kind = rest[0] if rest else ''
    target = rest[1] if len(rest) > 1 else ''
    uid = rest[2] if len(rest) > 2 else ''
    return acct, kind, target, uid


async def ensure_session(kind, target_id, title='', mode='public', account_id='', uid=''):
    sid = session_key(kind, target_id, mode, account_id, uid)
    cur = await _db.execute('SELECT id FROM sessions WHERE id=?', (sid,))
    row = await cur.fetchone()
    now = _now()
    if row is None:
        await _db.execute(
            'INSERT INTO sessions(id,kind,target_id,title,enabled,mode,account_id,created_at,updated_at)'
            ' VALUES(?,?,?,?,1,?,?,?,?)',
            (sid, kind, str(target_id), title or '', mode, account_id or '', now, now))
        await _db.commit()
    elif title:
        await _db.execute('UPDATE sessions SET title=?, updated_at=? WHERE id=? AND title=""',
                          (title, now, sid))
        await _db.commit()
    return sid


async def get_session(sid):
    cur = await _db.execute('SELECT * FROM sessions WHERE id=?', (sid,))
    row = await cur.fetchone()
    return dict(row) if row else None


async def list_sessions(account_id=''):
    if account_id:
        cur = await _db.execute(
            'SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.session_id=s.id) AS msg_count,'
            ' (SELECT MAX(created_at) FROM messages m WHERE m.session_id=s.id) AS last_at'
            ' FROM sessions s WHERE s.account_id=? ORDER BY s.updated_at DESC', (account_id,))
    else:
        cur = await _db.execute(
            'SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.session_id=s.id) AS msg_count,'
            ' (SELECT MAX(created_at) FROM messages m WHERE m.session_id=s.id) AS last_at'
            ' FROM sessions s ORDER BY s.updated_at DESC')
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def update_session(sid, fields):
    allow = ('title', 'persona_id', 'provider_id', 'enabled', 'mode')
    sets, vals = [], []
    for k in allow:
        if k in fields:
            sets.append('%s=?' % k)
            vals.append(fields[k])
    if not sets:
        return False
    sets.append('updated_at=?')
    vals.append(_now())
    vals.append(sid)
    await _db.execute('UPDATE sessions SET %s WHERE id=?' % ','.join(sets), vals)
    await _db.commit()
    return True


# ---------------- 会话目录（全部群聊 / 私聊）

async def sync_catalog(kind, target_id, title='', account_id='', mode='public'):
    """把一个群/好友登记进会话表（目录行）。

    ★ 新建的行 **enabled=0** —— 目录里的东西默认不启用。
      理由：机器人不该在从没说过话的群里突然冒出来搭话；
      要不要在某个群/私聊里开口，由使用者在「会话管理」里手动开。
      已存在的行**不动**（用户改过的 enabled 不能被同步覆盖）。

    返回 'new' / 'titled' / 'exists'。
    """
    tid = str(target_id or '').strip()
    if not tid:
        return 'skip'
    sid = session_key(kind, tid, mode, account_id)
    now = _now()
    cur = await _db.execute('SELECT id, title FROM sessions WHERE id=?', (sid,))
    row = await cur.fetchone()
    if row is None:
        await _db.execute(
            'INSERT INTO sessions(id,kind,target_id,title,enabled,mode,account_id,created_at,updated_at)'
            ' VALUES(?,?,?,?,0,?,?,?,?)',
            (sid, kind, tid, title or '', mode, account_id or '', now, now))
        await _db.commit()
        return 'new'
    if title and not (row['title'] or ''):
        await _db.execute('UPDATE sessions SET title=? WHERE id=?', (title, sid))
        await _db.commit()
        return 'titled'
    return 'exists'


async def bulk_set_enabled(enabled, ids=None, kind='', account_id=''):
    """批量启用/停用会话。ids 为空则按 kind/account_id 全表操作。"""
    val = 1 if enabled else 0
    if ids:
        for sid in ids:
            await _db.execute('UPDATE sessions SET enabled=? WHERE id=?', (val, sid))
        await _db.commit()
        return len(ids)
    sql = 'UPDATE sessions SET enabled=? WHERE 1=1'
    args = [val]
    if kind:
        sql += ' AND kind=?'
        args.append(kind)
    if account_id:
        sql += ' AND account_id=?'
        args.append(account_id)
    cur = await _db.execute(sql, args)
    await _db.commit()
    return cur.rowcount


async def delete_session(sid):
    await _db.execute('DELETE FROM messages WHERE session_id=?', (sid,))
    await _db.execute('DELETE FROM summaries WHERE session_id=?', (sid,))
    await _db.execute('DELETE FROM sessions WHERE id=?', (sid,))
    await _db.commit()


async def clear_session(sid):
    await _db.execute('DELETE FROM messages WHERE session_id=?', (sid,))
    await _db.execute('DELETE FROM summaries WHERE session_id=?', (sid,))
    await _db.execute('UPDATE sessions SET updated_at=? WHERE id=?', (_now(), sid))
    await _db.commit()


async def add_message(sid, role, content, name=''):
    now = _now()
    cur = await _db.execute(
        'INSERT INTO messages(session_id,role,content,name,created_at) VALUES(?,?,?,?,?)',
        (sid, role, content, name, now))
    await _db.execute('UPDATE sessions SET updated_at=? WHERE id=?', (now, sid))
    await _db.commit()
    return cur.lastrowid


async def recent_messages(sid, limit=200, after_id=0):
    cur = await _db.execute(
        'SELECT * FROM messages WHERE session_id=? AND id>? ORDER BY id DESC LIMIT ?',
        (sid, after_id, int(limit)))
    rows = await cur.fetchall()
    return [dict(r) for r in reversed(rows)]


async def count_messages(sid):
    cur = await _db.execute('SELECT COUNT(*) AS c FROM messages WHERE session_id=?', (sid,))
    row = await cur.fetchone()
    return row['c'] if row else 0


async def get_summary(sid):
    cur = await _db.execute('SELECT * FROM summaries WHERE session_id=?', (sid,))
    row = await cur.fetchone()
    return dict(row) if row else None


async def set_summary(sid, content, upto_msg_id):
    await _db.execute(
        'INSERT INTO summaries(session_id,content,upto_msg_id,updated_at) VALUES(?,?,?,?)'
        ' ON CONFLICT(session_id) DO UPDATE SET content=excluded.content,'
        ' upto_msg_id=excluded.upto_msg_id, updated_at=excluded.updated_at',
        (sid, content, int(upto_msg_id), _now()))
    await _db.commit()


async def session_detail(sid, limit=50):
    s = await get_session(sid)
    if not s:
        return None
    msgs = await recent_messages(sid, limit)
    summ = await get_summary(sid)
    s['messages'] = msgs
    s['summary'] = (summ or {}).get('content') or ''
    s['msg_count'] = await count_messages(sid)
    return s


async def stats():
    cur = await _db.execute('SELECT COUNT(*) AS c FROM sessions')
    n_sess = (await cur.fetchone())['c']
    cur = await _db.execute('SELECT COUNT(*) AS c FROM messages')
    n_msg = (await cur.fetchone())['c']
    cur = await _db.execute('SELECT COUNT(*) AS c FROM sessions WHERE enabled=1')
    n_on = (await cur.fetchone())['c']
    cur = await _db.execute('SELECT COUNT(*) AS c FROM chat_logs')
    n_log = (await cur.fetchone())['c']
    return {'sessions': n_sess, 'enabled': n_on, 'messages': n_msg, 'chat_logs': n_log}


# ---------------------------------------------------------------- 账号表

async def upsert_account(aid, **fields):
    """写账号登记信息（昵称/头像/人格/提供商/触发规则覆盖）。"""
    now = _now()
    allow = ('uin', 'nick', 'avatar', 'enabled', 'persona_id', 'provider_id', 'bot_cfg')
    cur = await _db.execute('SELECT id FROM accounts WHERE id=?', (aid,))
    row = await cur.fetchone()
    if row is None:
        vals = {'id': aid, 'uin': '', 'nick': '', 'avatar': '', 'enabled': 1,
                'persona_id': '', 'provider_id': '', 'bot_cfg': '{}'}
        vals.update({k: v for k, v in fields.items() if k in allow})
        await _db.execute(
            'INSERT INTO accounts(id,uin,nick,avatar,enabled,persona_id,provider_id,bot_cfg,created_at,updated_at)'
            ' VALUES(?,?,?,?,?,?,?,?,?,?)',
            (aid, vals['uin'], vals['nick'], vals['avatar'], vals['enabled'],
             vals['persona_id'], vals['provider_id'],
             vals['bot_cfg'] if isinstance(vals['bot_cfg'], str) else json.dumps(vals['bot_cfg'], ensure_ascii=False),
             now, now))
    else:
        sets, vals = [], []
        for k in allow:
            if k in fields:
                v = fields[k]
                if k == 'bot_cfg' and not isinstance(v, str):
                    v = json.dumps(v, ensure_ascii=False)
                sets.append('%s=?' % k)
                vals.append(v)
        if sets:
            sets.append('updated_at=?')
            vals.append(now)
            vals.append(aid)
            await _db.execute('UPDATE accounts SET %s WHERE id=?' % ','.join(sets), vals)
    await _db.commit()


async def list_accounts():
    cur = await _db.execute('SELECT * FROM accounts ORDER BY created_at')
    out = []
    for r in await cur.fetchall():
        d = dict(r)
        try:
            d['bot_cfg'] = json.loads(d.get('bot_cfg') or '{}')
        except Exception:
            d['bot_cfg'] = {}
        out.append(d)
    return out


# ---------------------------------------------------------------- 迁移

async def _migrated(key):
    cur = await _db.execute('SELECT v FROM schema_version WHERE k=?', (key,))
    row = await cur.fetchone()
    return row is not None


async def _mark_migrated(key, val='1'):
    await _db.execute('INSERT OR REPLACE INTO schema_version(k,v) VALUES(?,?)', (key, str(val)))
    await _db.commit()


async def migrate_account_prefix(account_id):
    """给历史会话/消息补账号前缀（一次性、幂等）。

    老会话 id 形如 private:123 / group:456 / group:456:789，
    新的要带 a<uin>: 前缀，否则多号下会串。

    幂等性不靠 schema_version 标记，而靠"新 id 一定以 a<uin>: 开头"这个事实：
    老 id 只可能是 private:% 或 group:% 开头，补前缀后就不再匹配条件，
    所以重复执行不会二次加前缀（schema_version 只作为额外保险）。
    """
    if not account_id:
        return False
    pre = account_id + ':'
    # 只匹配老格式（private:% / group:%），新格式 a<uin>:... 天然不匹配
    old_like = "id LIKE 'private:%' OR id LIKE 'group:%'"
    await _db.execute(
        'UPDATE sessions SET id=? || id WHERE (%s)' % old_like, (pre,))
    await _db.execute(
        'UPDATE messages SET session_id=? || session_id'
        ' WHERE session_id LIKE \'private:%\' OR session_id LIKE \'group:%\'', (pre,))
    await _db.execute(
        'UPDATE summaries SET session_id=? || session_id'
        ' WHERE session_id LIKE \'private:%\' OR session_id LIKE \'group:%\'', (pre,))
    await _db.execute('UPDATE sessions SET account_id=? WHERE account_id=? OR account_id=?',
                       (account_id, '', account_id))
    await _db.commit()
    await _mark_migrated('acct_prefix', account_id)
    return True


async def ensure_columns():
    """给已存在的旧库补列（ALTER TABLE ADD COLUMN 是幂等的，但要判存在）。"""
    for tbl, col, ddl in (
        ('sessions', 'account_id', "ALTER TABLE sessions ADD COLUMN account_id TEXT DEFAULT ''"),
        # 发言者头像。QQ 头像是按 QQ 号从 qlogo 服务取的，
        # 存下来是为了聊天记录页能直接显示，不用前端再拼。
        ('chat_logs', 'sender_avatar', "ALTER TABLE chat_logs ADD COLUMN sender_avatar TEXT DEFAULT ''"),
    ):
        cur = await _db.execute('PRAGMA table_info(%s)' % tbl)
        cols = [r['name'] for r in await cur.fetchall()]
        if col not in cols:
            await _db.execute(ddl)
    await _db.commit()
