# -*- coding: utf-8 -*-
"""HTTP API：给 RainCough 插件做转发用，只监听 127.0.0.1。

2026-11-01 新增：
  /api/accounts*  多账号（连接状态、账号级配置）
  /api/chat/*     全量聊天记录（会话、消息、导出、统计、清理）
"""
import json
import os
import time
import uuid

from aiohttp import web

from . import cards, chats, compress, config, forward, group_avatar, llm, logbuf, media, profile, search, store
from .bot import attach_images, strip_emoji, strip_meta_leak, truncate_chars

# ---------------- 随机挑回复的临时结果
# random_reply 生成后先存这儿，用户点「发送到 QQ」时凭 token 取回发送
# （不重新调模型 —— 页面看到什么，群里就是什么）。
_RND_CACHE = {}
_RND_TTL = 300      # 5 分钟过期
_RND_MAX = 50


def _put_random(token, item):
    now = int(time.time())
    for k in [k for k, v in _RND_CACHE.items() if now - (v.get('at') or 0) > _RND_TTL]:
        _RND_CACHE.pop(k, None)
    if len(_RND_CACHE) >= _RND_MAX:
        for k in sorted(_RND_CACHE, key=lambda x: _RND_CACHE[x].get('at') or 0)[:10]:
            _RND_CACHE.pop(k, None)
    _RND_CACHE[token] = item


def _take_random(token):
    """取回并作废（一条结果只发一次，避免重复点击发两遍）。"""
    item = _RND_CACHE.pop(token, None)
    if not item:
        return None
    if int(time.time()) - (item.get('at') or 0) > _RND_TTL:
        return None
    return item


def ok(data=None):
    return web.json_response({'ok': True, 'data': data})


def bad(msg, code=400):
    return web.json_response({'ok': False, 'error': str(msg)[:500]}, status=code)


async def _body(request):
    try:
        return await request.json()
    except Exception:
        return {}


def make_app(mgr, bot):
    app = web.Application(client_max_size=8 * 1024 * 1024)

    # ---------------- 状态

    async def status(request):
        cfg = config.load()
        accounts = await mgr.status_all()
        stats_ = await store.stats()
        prov = config.get_provider(cfg)
        persona = config.get_persona(cfg)
        # 单账号时保留旧的 onebot 字段，前端老代码不用改
        onebot = accounts[0] if len(accounts) == 1 else {
            'connected': any(a.get('online') for a in accounts),
            'self_id': accounts[0].get('self_id', '') if accounts else '',
            'accounts': accounts,
        }
        return ok({
            'onebot': onebot,
            'accounts': accounts,
            'stats': stats_,
            'bot': cfg.get('bot'),
            'provider': (prov or {}).get('id'),
            'provider_model': (prov or {}).get('model'),
            'persona': (persona or {}).get('id'),
            'context': cfg.get('context'),
            'features': cfg.get('features'),
            'last_error': bot.last_error,
            'ts': int(time.time()),
        })

    # ---------------- 账号

    async def get_accounts(request):
        cfg = config.load()
        items = await mgr.status_all()
        # 配置里有但还没连上的（刚加的号），也要显示出来
        live = {a.get('id') for a in items}
        for a in config.get_accounts(cfg):
            if a['id'] not in live:
                items.append({'id': a['id'], 'uin': a.get('uin') or '', 'online': False,
                              'connected': False, 'nick': a.get('nick') or '',
                              'avatar': a.get('avatar') or '', 'ws_url': a.get('ws_url') or '',
                              'webui': a.get('webui') or '', 'unit': a.get('unit') or '',
                              'enabled': bool(a.get('enabled', True)),
                              'persona_id': a.get('persona_id') or '',
                              'provider_id': a.get('provider_id') or '',
                              'instance_dir': a.get('instance_dir') or '',
                              'pending': True})
        return ok({'items': items, 'count': len(items)})

    async def post_accounts(request):
        """新增/修改/删除账号。action = add | update | remove | toggle"""
        b = await _body(request)
        action = (b.get('action') or 'update').lower()
        cfg = config.load()
        obcfg = cfg.setdefault('onebot', {})
        accs = obcfg.setdefault('accounts', [])
        aid = (b.get('id') or '').strip()

        def find(it):
            for i, a in enumerate(accs):
                if a.get('id') == aid:
                    return i, a
            return -1, None

        if action == 'add':
            uin = str(b.get('uin') or '').strip()
            if not uin:
                return bad('缺少 uin')
            new_id = config.account_id(uin)
            # 已存在就更新（幂等）—— 实例修复/重建时会重复调这里，
            # 直接报错会导致账号配置同步不上
            exist = None
            for i, a in enumerate(accs):
                if a.get('id') == new_id or str(a.get('uin') or '') == uin:
                    exist = i
                    break
            if exist is not None:
                accs[exist].update({
                    'ws_url': (b.get('ws_url') or accs[exist].get('ws_url') or '').strip(),
                    'webui': b.get('webui') or accs[exist].get('webui') or '',
                    'unit': b.get('unit') or accs[exist].get('unit') or '',
                    'instance_dir': b.get('instance_dir') or accs[exist].get('instance_dir') or '',
                    'enabled': True,
                })
                config.save(cfg)
                await store.upsert_account(new_id, uin=uin)
                return ok({'id': new_id, 'updated': True})
            acc = {
                'id': new_id,
                'uin': uin,
                'ws_url': (b.get('ws_url') or '').strip(),
                'access_token': b.get('access_token') or '',
                'enabled': True,
                'nick': b.get('nick') or '',
                'avatar': b.get('avatar') or '',
                'webui': b.get('webui') or '',
                'unit': b.get('unit') or '',
                'instance_dir': b.get('instance_dir') or '',
            }
            # ★ 单账户（2026-11-02 从多账户回退）：只保留一条。
            #   换号时新账号进来，旧的直接清掉 —— 否则机器人会同时挂着
            #   两条 OneBot 连接，事件归属和聊天记录都会串。
            if len(accs) > 0:
                for old in list(accs):
                    if old.get('id') != new_id:
                        try:
                            await store.upsert_account(old['id'], enabled=0)
                        except Exception:
                            pass
                        accs.remove(old)
            accs.append(acc)
            await store.upsert_account(new_id, uin=uin, nick=acc['nick'])
            config.save(cfg)
            return ok({'id': new_id})

        if action == 'remove':
            i, a = find(aid)
            if i < 0:
                return bad('没有这个账号', 404)
            accs.pop(i)
            config.save(cfg)
            return ok({'id': aid})

        i, a = find(aid)
        if i < 0:
            return bad('没有这个账号', 404)
        for k in ('ws_url', 'access_token', 'nick', 'avatar', 'webui', 'unit',
                  'instance_dir', 'persona_id', 'provider_id'):
            if k in b:
                a[k] = b[k]
        if 'enabled' in b:
            a['enabled'] = bool(b['enabled'])
        if isinstance(b.get('bot'), dict):
            a['bot'] = b['bot']
        config.save(cfg)
        db_fields = {k: a[k] for k in ('nick', 'avatar', 'persona_id', 'provider_id')
                     if k in a}
        db_fields['enabled'] = 1 if a.get('enabled', True) else 0
        if 'bot' in a:
            db_fields['bot_cfg'] = a['bot']
        await store.upsert_account(aid, **db_fields)
        return ok({'id': aid})

    # ---------------- 配置

    async def get_config(request):
        return ok(config.load())

    async def post_config(request):
        b = await _body(request)
        if not isinstance(b, dict):
            return bad('需要 JSON 对象')
        for k in ('providers', 'personas', 'default_provider', 'default_persona'):
            b.pop(k, None)     # 这两类走专用接口
        return ok(config.patch(b))

    # ---------------- 提供商

    async def get_providers(request):
        cfg = config.load()
        provs = cfg.get('providers') or []
        # 打码
        out = []
        for p in provs:
            q = dict(p)
            k = q.get('api_key') or ''
            q['key_hint'] = ('%s…%s' % (k[:6], k[-4:])) if len(k) > 12 else ('已设置' if k else '')
            q.pop('api_key', None)
            q['is_default'] = (p.get('id') == cfg.get('default_provider'))
            out.append(q)
        return ok({'items': out, 'default': cfg.get('default_provider')})

    async def post_providers(request):
        b = await _body(request)
        pid = (b.get('id') or '').strip()
        if not pid:
            return bad('缺少 id')
        cfg = config.load()
        arr = cfg.get('providers') or []
        cur = None
        for p in arr:
            if p.get('id') == pid:
                cur = p
                break
        if cur is None:
            cur = {'id': pid, 'enable': True, 'type': 'openai', 'timeout': 120}
            arr.append(cur)
        for k in ('label', 'type', 'api_base', 'model', 'timeout', 'enable'):
            if k in b:
                cur[k] = b[k]
        if b.get('api_key'):
            cur['api_key'] = b['api_key']
        if b.get('make_default'):
            cfg['default_provider'] = pid
        cfg['providers'] = arr
        if not cfg.get('default_provider'):
            cfg['default_provider'] = pid
        config.save(cfg)
        return ok({'id': pid})

    async def del_provider(request):
        b = await _body(request)
        pid = (b.get('id') or '').strip()
        cfg = config.load()
        cfg['providers'] = [p for p in (cfg.get('providers') or []) if p.get('id') != pid]
        if cfg.get('default_provider') == pid:
            cfg['default_provider'] = (cfg['providers'][0]['id'] if cfg['providers'] else '')
        config.save(cfg)
        return ok()

    async def test_provider(request):
        b = await _body(request)
        cfg = config.load()
        pid = (b.get('id') or '').strip()
        prov = None
        for p in cfg.get('providers') or []:
            if p.get('id') == pid:
                prov = dict(p)
                break
        if prov is None:
            prov = dict(b.get('provider') or {})
        if b.get('api_key'):
            prov['api_key'] = b['api_key']
        r = await llm.test(prov)
        return ok(r)

    async def provider_models(request):
        pid = request.query.get('id') or ''
        cfg = config.load()
        prov = None
        for p in cfg.get('providers') or []:
            if p.get('id') == pid:
                prov = p
                break
        if not prov:
            return bad('没有这个提供商')
        try:
            return ok(await llm.list_models(prov))
        except Exception as e:
            return bad(e)

    # ---------------- 人格

    async def get_personas(request):
        # 兼容层：人格的本体已经是「角色卡片」，这里返回兼容形状
        cfg = config.load()
        items = [cards.to_persona(c) for c in cards.list_cards(cfg)]
        return ok({'items': items, 'default': cards.default_id(cfg)})

    async def post_personas(request):
        b = await _body(request)
        pid = (b.get('id') or '').strip()
        if not pid:
            return bad('缺少 id')
        cfg = config.load()
        cur = cards.find(cfg, pid) or cards.normalize({'id': pid, 'name': pid})
        for k in ('name', 'prompt'):
            if k in b:
                cur[k] = b[k]
        if b.get('make_default'):
            cur['status'] = 'published'
        cards.save(cfg, cur, set_default=bool(b.get('make_default')))
        config.save(cfg)
        return ok({'id': cur['id']})

    async def del_persona(request):
        b = await _body(request)
        pid = (b.get('id') or '').strip()
        cfg = config.load()
        cards.delete(cfg, pid)
        config.save(cfg)
        return ok()

    # ---------------- 角色卡片
    async def get_cards(request):
        cfg = config.load()
        items = [cards.with_assets(cfg, c) for c in cards.list_cards(cfg)]
        return ok({'items': items, 'default': cards.default_id(cfg),
                   'schema': cards.SCHEMA})

    async def post_cards(request):
        """保存角色卡片。传 id 就是更新，不传就是新建。"""
        b = await _body(request)
        card = b.get('card') if isinstance(b.get('card'), dict) else b
        if not str(card.get('name') or '').strip():
            return bad('角色名字不能为空')
        cfg = config.load()
        saved = cards.save(cfg, card, set_default=bool(b.get('set_default')))
        config.save(cfg)
        return ok(cards.with_assets(cfg, saved))

    async def del_card(request):
        b = await _body(request)
        cid = (b.get('id') or '').strip()
        if not cid:
            return bad('缺少 id')
        cfg = config.load()
        n = cards.delete(cfg, cid)
        config.save(cfg)
        return ok({'left': n})

    async def clone_card(request):
        b = await _body(request)
        cid = (b.get('id') or '').strip()
        cfg = config.load()
        c = cards.clone(cfg, cid, (b.get('name') or '').strip())
        if not c:
            return bad('找不到这张卡片')
        config.save(cfg)
        return ok(cards.with_assets(cfg, c))

    async def import_card(request):
        b = await _body(request)
        try:
            c = cards.import_card(b.get('json') or b.get('card') or '')
        except Exception as e:
            return bad(str(e)[:200])
        cfg = config.load()
        saved = cards.save(cfg, c)
        config.save(cfg)
        return ok(cards.with_assets(cfg, saved))

    async def export_card(request):
        q = request.query
        cid = (q.get('id') or '').strip()
        cfg = config.load()
        c = cards.find(cfg, cid) if cid else None
        if not c:
            c = cards.find(cfg, cards.default_id(cfg))
        if not c:
            return bad('没有可导出的卡片')
        return ok({'json': cards.export_card(c), 'card': c})

    # ---------------- 会话

    async def get_sessions(request):
        account_id = request.query.get('account_id') or ''
        rows = await store.list_sessions(account_id)
        cfg = config.load()
        gnames = getattr(bot, '_group_names', {}) or {}
        fnames = getattr(bot, '_friend_names', {}) or {}
        for r in rows:
            tid = str(r.get('target_id') or '')
            if r.get('kind') == 'group':
                r['display'] = r.get('title') or gnames.get(tid, '')
            else:
                r['display'] = r.get('title') or fnames.get(tid, '')
            r['mode_label'] = '公共' if (r.get('kind') == 'group' and r.get('mode') != 'private') else '私有'
            # 聊过没有 —— 目录行（只是登记了，没消息）
            r['talked'] = 1 if (r.get('msg_count') or r.get('last_at')) else 0
        return ok({'items': rows, 'stats': await store.stats(),
                   'default_persona': cfg.get('default_persona'),
                   'default_provider': cfg.get('default_provider')})

    async def sync_catalog(request):
        """拉取账号的**全部**群聊与好友，登记成会话目录行（默认不启用）。

        为什么要这个：
          原来 sessions 表里只有「收到过消息」的会话，
          于是使用者没法提前配置某个群的称呼/人格/是否启用。
        目录行的 enabled 默认 0 —— 机器人不会在没说过话的群里主动开口，
        要开自己在「会话管理」里点开关。
        """
        b = await _body(request)
        only = (b.get('account_id') or '').strip()
        accounts = list(getattr(mgr, 'accounts', {}).values())
        if only:
            accounts = [a for a in accounts if a.id == only]
        if not accounts:
            return bad('没有已连接的账号')
        stat = {'groups': 0, 'friends': 0, 'new': 0, 'titled': 0,
                'exists': 0, 'accounts': []}
        for acc in accounts:
            ob = getattr(acc, 'ob', None)
            if ob is None or not getattr(ob, 'connected', False):
                stat['accounts'].append({'id': acc.id, 'ok': False, 'why': '未连接'})
                continue
            one = {'id': acc.id, 'ok': True}
            # 群
            try:
                r = await ob.call('get_group_list', timeout=25)
                items = r.get('data') or []
                for g in items:
                    gid = str(g.get('group_id') or '')
                    name = profile.clean_name(g.get('group_name'))
                    if not gid:
                        continue
                    stat['groups'] += 1
                    res = await store.sync_catalog('group', gid, name, acc.id)
                    stat[res] = stat.get(res, 0) + 1
                one['groups'] = len(items)
            except Exception as e:
                one['group_error'] = str(e)[:160]
            # 好友
            try:
                r = await ob.call('get_friend_list', timeout=25)
                items = r.get('data') or []
                for f in items:
                    fid = str(f.get('user_id') or '')
                    name = profile.clean_name(f.get('remark') or f.get('nickname') or '')
                    if not fid:
                        continue
                    stat['friends'] += 1
                    res = await store.sync_catalog('private', fid, name, acc.id)
                    stat[res] = stat.get(res, 0) + 1
                one['friends'] = len(items)
            except Exception as e:
                one['friend_error'] = str(e)[:160]
            stat['accounts'].append(one)
        logbuf.info('api', '会话目录同步：群 %d / 好友 %d，新增 %d'
                    % (stat['groups'], stat['friends'], stat.get('new', 0)))
        return ok(stat)

    async def bulk_sessions(request):
        """批量启用/停用会话。"""
        b = await _body(request)
        enabled = 1 if b.get('enabled') else 0
        ids = b.get('ids')
        if isinstance(ids, str):
            ids = [x for x in ids.split(',') if x]
        ids = [str(x) for x in (ids or [])]
        n = await store.bulk_set_enabled(enabled, ids=ids,
                                         kind=str(b.get('kind') or ''),
                                         account_id=str(b.get('account_id') or ''))
        logbuf.info('api', '批量%s会话 %d 个' % ('启用' if enabled else '停用', n))
        return ok({'changed': n})

    async def get_session(request):
        sid = request.match_info['sid']
        d = await store.session_detail(sid, int(request.query.get('limit') or 50))
        if not d:
            return bad('会话不存在', 404)
        summ = await store.get_summary(sid)
        d['summary_upto'] = (summ or {}).get('upto_msg_id')
        return ok(d)

    async def post_session(request):
        sid = request.match_info['sid']
        b = await _body(request)
        fields = {}
        for k in ('title', 'persona_id', 'provider_id', 'mode'):
            if k in b:
                fields[k] = b[k]
        if 'enabled' in b:
            fields['enabled'] = 1 if b['enabled'] else 0
        if not fields:
            return bad('没有要改的字段')
        await store.update_session(sid, fields)
        return ok(await store.get_session(sid))

    async def clear_session(request):
        sid = request.match_info['sid']
        await store.clear_session(sid)
        logbuf.info('api', '清空会话 %s' % sid)
        return ok()

    async def del_session(request):
        b = await _body(request)
        sid = (b.get('id') or '').strip()
        await store.delete_session(sid)
        logbuf.info('api', '删除会话 %s' % sid)
        return ok()

    # ---------------- 日志 / 统计

    async def get_logs(request):
        n = int(request.query.get('lines') or 300)
        kw = request.query.get('kw') or ''
        return ok({'lines': logbuf.tail(n, kw)})

    async def get_stats(request):
        return ok(await store.stats())

    # ---------------- 随机挑消息回

    async def random_reply(request):
        """从**已启用的群聊**里随机挑一条消息，让机器人对它回一句。

        「随机挑消息回」跟普通回复不一样：不是回当前这条，
        而是从历史里随机翻一条出来回应 —— 有点「翻牌」的意思。

        范围由设置页决定（features.random_pick.scope）：
          enabled_groups —— 只在「会话管理」里启用了的群聊里挑（默认）
          all_groups     —— 所有群聊
          session        —— 只在指定会话里挑（前端临时切换）

        返回里带 token —— 用户点「发送到 QQ」时凭它把这条回复发出去
        （不重新调模型，页面看到的就是群里会出现的）。
        """
        b = await _body(request)
        sid = (b.get('sid') or '').strip()
        cfg = config.load()
        rp = (cfg.get('features') or {}).get('random_pick') or {}
        if not rp.get('enabled', True):
            return bad('随机挑消息回已关闭（设置 → 能力 → 允许随机挑消息回）')
        scope = (b.get('scope') or rp.get('scope') or 'enabled_groups').strip()
        acct = config.default_account(cfg) or {}

        sql = ("SELECT id, account_id, session_id, kind, target_id, sender_id,"
               " sender_name, text, created_at FROM chat_logs"
               " WHERE role='user' AND text<>'' AND recalled=0")
        args = []
        if scope == 'session' and sid:
            sql += ' AND session_id=?'
            args.append(sid)
        elif scope in ('enabled_groups', 'all_groups'):
            # ★ 用子查询而不是 IN (?,?,…) —— 群多了参数会超 SQLite 上限
            if scope == 'enabled_groups':
                sql += (" AND session_id IN"
                        " (SELECT id FROM sessions WHERE enabled=1 AND kind='group')")
            else:
                sql += " AND session_id IN (SELECT id FROM sessions WHERE kind='group')"
        sql += ' ORDER BY RANDOM() LIMIT 1'
        cur = await store._db.execute(sql, args)
        row = await cur.fetchone()
        if not row:
            if scope == 'enabled_groups':
                return bad('没有已启用的群聊可挑 —— 先去「会话管理」把要用的群启用')
            return bad('没有可挑的消息')
        picked = dict(row)

        sess = await store.get_session(picked['session_id']) or {}
        persona = config.get_persona(cfg, sess.get('persona_id'), acct)
        chain = config.provider_chain(cfg, sess.get('provider_id'), acct)
        if not chain:
            return bad('没有可用的模型提供商')
        system = (persona or {}).get('prompt') or ''
        # 被挑中的那条当作用户输入；再给一句"这是随机挑的"的提示，
        # 让模型知道自己在接哪一句
        msgs = [{'role': 'user',
                 'content': picked['text']}]
        try:
            reply, used = await llm.chat_chain(
                chain, msgs, system=system,
                max_tokens=int((cfg.get('context') or {}).get('max_output_tokens') or 4096))
        except Exception as e:
            return bad(e)
        card = cards.find(cfg, sess.get('persona_id')
                          or cfg.get('default_card') or cfg.get('default_persona') or '')
        try:
            mc = int(((card or {}).get('style') or {}).get('max_chars') or 0)
        except Exception:
            mc = 0
        reply = strip_meta_leak(reply)
        if mc:
            reply = truncate_chars(reply, mc)
        if not ((card or {}).get('style') or {}).get('allow_emoji'):
            reply = strip_emoji(reply)
        # 附上这条消息来自哪个会话，页面上好显示
        title = sess.get('title') or picked.get('target_id') or ''
        # 暂存这次结果：用户点「发送到 QQ」时凭 token 发出去
        token = uuid.uuid4().hex[:16]
        _put_random(token, {
            'account_id': picked.get('account_id') or '',
            'session_id': picked.get('session_id') or '',
            'kind': picked.get('kind') or 'group',
            'target_id': picked.get('target_id') or '',
            'sender_id': picked.get('sender_id') or '',
            'sender_name': picked.get('sender_name') or '',
            'reply': reply,
            'at': int(time.time()),
        })
        return ok({
            'reply': reply,
            'provider': (used or {}).get('id'),
            'token': token,
            'picked': {
                'id': picked['id'],
                'session_id': picked['session_id'],
                'kind': picked['kind'],
                'target_id': picked['target_id'],
                'title': title,
                'sender_id': picked['sender_id'],
                'sender_name': picked['sender_name'],
                'text': picked['text'],
                'created_at': picked['created_at'],
            },
        })

    async def send_random_reply(request):
        """把刚才随机挑出来的那条回复**真的发到 QQ**。

        凭 random_reply 返回的 token 发送（不重新调模型），
        页面看到什么，群里就出现什么。
        """
        b = await _body(request)
        token = str(b.get('token') or '').strip()
        item = _take_random(token)
        if not item:
            return bad('这次的结果已过期，请重新挑一条')
        kind = item.get('kind') or 'group'
        target = str(item.get('target_id') or '')
        if not target:
            return bad('没有目标会话')
        acc_id = item.get('account_id') or ''
        acc = getattr(mgr, 'accounts', {}).get(acc_id)
        ob = getattr(acc, 'ob', None) if acc else None
        if ob is None or not getattr(ob, 'connected', False):
            return bad('账号没连上，稍后再试')
        text = item.get('reply') or ''
        if not text:
            return bad('没有可发送的内容')
        # 群里 @ 一下被挑中消息的说话人，让对方知道在回他
        mention = item.get('sender_id') if kind == 'group' else None
        try:
            r = await ob.send_text(kind, target, text, mention=mention or None)
        except Exception as e:
            return bad('发送失败：%s' % str(e)[:200])
        # 机器人自己的发言进聊天档案 + 喂模型的上下文
        data = (r or {}).get('data') or {}
        msg_id = str(data.get('message_id') or '')
        cfg = config.load()
        acct_cfg = config.find_account(cfg, acc_id) or {}
        nick = acct_cfg.get('nick') or '机器人'
        sid = str((data.get('sender') or {}).get('user_id')
                  or getattr(ob, 'self_id', '') or acct_cfg.get('uin') or '')
        try:
            segs = [{'type': 'text', 'data': {'text': text}}]
            await chats.record(acc_id, kind, target, 'assistant', segs,
                               sender_id=sid, sender_name=nick, msg_id=msg_id,
                               created_at=int(time.time()), media=[],
                               sender_avatar=profile.avatar_url(sid))
            if item.get('session_id'):
                await store.add_message(item['session_id'], 'assistant', text)
        except Exception as e:
            logbuf.warn('api', '记录随机回复的自身消息失败：%s' % str(e)[:120])
        logbuf.info('api', '随机挑回复已发到 %s/%s（msg_id=%s）' % (kind, target, msg_id))
        return ok({'sent': True, 'message_id': msg_id, 'target_id': target,
                   'kind': kind, 'at': mention or ''})

    # ---------------- 上下文预览

    async def preview_context(request):
        """给前端看某个会话现在会怎么拼上下文（不调模型）。"""
        sid = request.query.get('sid') or ''
        cfg = config.load()
        sess = await store.get_session(sid) if sid else None
        acct = config.find_account(cfg, (sess or {}).get('account_id')) or {}
        persona = config.get_persona(cfg, (sess or {}).get('persona_id'), acct)
        provider = config.get_provider(cfg, (sess or {}).get('provider_id'), acct)
        system = (persona or {}).get('prompt') or ''
        msgs = await store.recent_messages(sid, int((cfg.get('context') or {}).get('max_history_messages') or 200))
        summ = await store.get_summary(sid)
        summary = (summ or {}).get('content') or ''
        total = compress.est(system) + compress.est(summary) + compress.est_msgs(msgs)
        c = cfg.get('context') or {}
        budget = max(2000, int(c.get('max_tokens') or 128000)
                     - int(c.get('max_output_tokens') or 4096)
                     - compress.est(system) - compress.SAFE_MARGIN)
        return ok({
            'system': system,
            'summary': summary,
            'messages': msgs[-30:],
            'msg_count': len(msgs),
            'est_tokens': total,
            'budget': budget,
            'max_tokens': int(c.get('max_tokens') or 128000),
            'provider': (provider or {}).get('id'),
            'model': (provider or {}).get('model'),
        })

    # ---------------- 试聊（不经过 QQ，直接走完整链路）

    async def tools_search(request):
        q = (request.query.get('q') or '').strip()
        if not q:
            return bad('缺少 q')
        cfg = config.load()
        fs = (cfg.get('features') or {}).get('web_search') or {}
        try:
            res = await search.query(q, limit=int(fs.get('max_results') or 5))
        except Exception as e:
            return bad('搜索失败：%s' % str(e)[:300], 502)
        return ok({'query': q, 'results': res})

    async def test_chat(request):
        b = await _body(request)
        text = (b.get('text') or '').strip()
        if not text:
            return bad('缺少 text')
        cfg = config.load()
        sid = (b.get('sid') or '').strip()
        if not sid:
            dacc = config.default_account(cfg) or {}
            sid = store.session_key('private', '__test__', 'private',
                                    dacc.get('id') or '')
            await store.ensure_session('private', '__test__', title='试聊', mode='private',
                                       account_id=dacc.get('id') or '')
        sess = await store.get_session(sid)
        if not sess:
            return bad('会话不存在', 404)
        acct = config.find_account(cfg, (sess or {}).get('account_id')) or {}
        persona = config.get_persona(cfg, (sess or {}).get('persona_id'), acct)
        provider = config.get_provider(cfg, (sess or {}).get('provider_id'), acct)
        chain = config.provider_chain(cfg, (sess or {}).get('provider_id'), acct)
        if not provider or not chain:
            return bad('没有可用的模型提供商')
        system = (persona or {}).get('prompt') or ''
        await store.add_message(sid, 'user', text, name='测试')
        tools, runner = llm.web_tools(cfg)
        try:
            sys2, messages, meta = await compress.build_context(cfg, sid, system, provider)
            vis = (cfg.get('features') or {}).get('vision') or {}
            if b.get('images') and vis.get('enabled'):
                n = await attach_images(messages, b.get('images'),
                                        int(vis.get('max_images') or 3))
                if n:
                    meta['images'] = n
            reply, used = await llm.chat_chain(
                chain, messages, system=sys2,
                max_tokens=int((cfg.get('context') or {}).get('max_output_tokens') or 4096),
                tools=tools, tool_runner=runner)
            # 卡片的字数上限（和真实回复同一套逻辑）
            card = cards.find(cfg, (sess or {}).get('persona_id')
                              or cfg.get('default_card') or cfg.get('default_persona') or '')
            try:
                mc = int(((card or {}).get('style') or {}).get('max_chars') or 0)
            except Exception:
                mc = 0
            reply = strip_meta_leak(reply)
            if mc:
                reply = truncate_chars(reply, mc)
            if not ((card or {}).get('style') or {}).get('allow_emoji'):
                reply = strip_emoji(reply)
        except Exception as e:
            return bad(e)
        await store.add_message(sid, 'assistant', reply)
        meta['provider'] = (used or {}).get('id')
        return ok({'reply': reply, 'sid': sid, 'meta': meta,
                   'messages': len(messages)})

    # ---------------- 聊天记录（全量档案）

    async def chat_sessions(request):
        q = request.query
        rows = await chats.list_sessions(
            account_id=q.get('account_id') or '',
            kind=q.get('kind') or '',
            keyword=q.get('kw') or '',
            limit=int(q.get('limit') or 200))
        # 会话标题：群名/对方昵称 + 头像
        #
        # ★ 之前这里只读 bot._group_names，而那个缓存**从来没有被填过**
        #   （fill_group_names 没有调用点）→ 群名一直是裸群号。
        #   现在名字由 Bot.group_display / friend_display 提供，
        #   拿不到时退回 QQ 号，头像按 QQ 号从 qlogo 取。
        # 本机托管的真实群头像（从 QQ 客户端缓存捞出来的）优先
        local = await group_avatar.local_map()
        for r in rows:
            kind = str(r.get('kind') or '')
            tid = str(r.get('target_id') or '')
            if kind == 'group':
                name, av = bot.group_display(tid)
                p = local.get(tid)
                if p and os.path.isfile(p):
                    # 绝对路径交给插件层转成预览 URL
                    r['avatar_path'] = p
                    av = ''
            else:
                name, av = bot.friend_display(tid)
            r['display'] = name or tid
            r['avatar'] = av
        return ok({'items': rows})

    async def chat_messages(request):
        q = request.query
        sid = q.get('session_id') or ''
        if not sid:
            return bad('缺少 session_id')
        rows = await chats.list_messages(
            sid,
            before_id=int(q.get('before_id') or 0),
            limit=int(q.get('limit') or 50),
            keyword=q.get('kw') or '')
        return ok({'items': rows, 'count': len(rows)})

    async def chat_forward(request):
        """合并转发展开：按 forward id 取节点内容。

        节点里的图片会落盘到媒体目录（QQ 的 rkey 会过期），
        结果按 forward_id 缓存，第二次展开直接命中缓存。
        """
        q = request.query
        fid = str(q.get('id') or '')
        if not fid:
            return bad('缺少 id')
        acct = str(q.get('account_id') or '')
        try:
            data = await forward.expand(bot, fid, account_id=acct)
        except Exception as e:
            return bad(str(e)[:200])
        return ok(data)

    async def chat_session_ui(request):
        """会话 UI 状态：置顶 / 免打扰 / 已读位置 / 草稿。"""
        b = await _body(request)
        sid = str(b.get('session_id') or '')
        if not sid:
            return bad('缺少 session_id')
        try:
            data = await chats.save_session_ui(
                sid,
                pinned=b.get('pinned'),
                muted=b.get('muted'),
                last_read_id=b.get('last_read_id'),
                draft=b.get('draft'))
        except Exception as e:
            return bad(str(e)[:200])
        return ok(data)

    async def chat_recall(request):
        """撤回消息：调 OneBot delete_msg，成功后在库里打撤回标记。"""
        b = await _body(request)
        mid = str(b.get('msg_id') or '')
        if not mid:
            return bad('缺少 msg_id')
        try:
            r = await bot.recall(mid)
        except Exception as e:
            return bad(str(e)[:200])
        return ok(r)

    async def chat_stats(request):
        account_id = request.query.get('account_id') or ''
        cfg = config.load()
        root = chats.media_root(cfg)
        usage = media.dir_usage(root)
        disk = media.disk_free(root)
        st = await chats.stats(account_id)
        used_pct = 0
        if disk.get('total'):
            used_pct = int(disk['used'] * 100 / disk['total'])
        return ok({
            'chat': st,
            'media': usage,
            'disk': dict(disk, used_pct=used_pct),
            'media_dir': root,
        })

    async def chat_export(request):
        q = request.query
        doc, name = await chats.export(
            account_id=q.get('account_id') or '',
            session_id=q.get('session_id') or '',
            date_from=int(q.get('from') or 0),
            date_to=int(q.get('to') or 0))
        body = json.dumps(doc, ensure_ascii=False, indent=2).encode('utf-8')
        # 文件名只有 ASCII，去掉引号 —— Content-Disposition 里的引号没转义会让
        # aiohttp 抛 ValueError（500）
        safe = ''.join(ch for ch in name if ch.isalnum() or ch in '-_.').strip() or 'chat-export.json'
        # ★ content_type 里不能带 charset —— aiohttp 会抛
        #   "charset must not be in content_type argument"（这是 500 的真正原因）
        return web.Response(
            body=body,
            content_type='application/json',
            charset='utf-8',
            headers={'Content-Disposition': 'attachment; filename="%s"' % safe})

    async def chat_purge_media(request):
        """只清媒体文件，保留消息文本（永久保留是明确要求）。"""
        b = await _body(request)
        if b.get('confirm') is not True:
            return bad('需要 confirm=true')
        r = await chats.purge_media_only(
            account_id=b.get('account_id') or '',
            session_id=b.get('session_id') or '',
            date_from=int(b.get('from') or 0),
            date_to=int(b.get('to') or 0))
        return ok(r)

    async def chat_media_check(request):
        return ok(await chats.check_media_consistency())

    # ---------------- 查询（按用户 / 撤回状态 / 消息类型，可叠加）

    async def chat_query(request):
        q = request.query
        rows, total = await chats.query_messages(
            sender=q.get('sender') or '',
            recalled=q.get('recalled') or '',
            kind=q.get('kind') or '',
            keyword=q.get('kw') or '',
            session_id=q.get('session_id') or '',
            account_id=q.get('account_id') or '',
            date_from=int(q.get('from') or 0),
            date_to=int(q.get('to') or 0),
            limit=int(q.get('limit') or 50),
            before_id=int(q.get('before_id') or 0))
        return ok({'items': rows, 'count': len(rows), 'total': total})

    async def chat_senders(request):
        return ok({'items': await chats.query_senders(
            keyword=request.query.get('kw') or '')})

    # ---------------- 一键清空会话

    async def chat_clear_session(request):
        b = await _body(request)
        if b.get('confirm') is not True:
            return bad('需要 confirm=true')
        sid = str(b.get('session_id') or '').strip()
        if not sid:
            return bad('缺少 session_id')
        try:
            r = await chats.clear_session(
                sid,
                with_media=bool(b.get('with_media')),
                account_id=str(b.get('account_id') or ''))
        except ValueError as e:
            return bad(str(e))
        return ok(r)

    # ---------------- 媒体库

    async def chat_media_list(request):
        q = request.query
        items = await chats.list_media(
            kind=q.get('kind') or '',
            sender=q.get('sender') or '',
            keyword=q.get('kw') or '',
            session_id=q.get('session_id') or '',
            account_id=q.get('account_id') or '',
            limit=int(q.get('limit') or 100),
            offset=int(q.get('offset') or 0))
        st = await chats.media_stats(q.get('account_id') or '')
        return ok({'items': items, 'stats': st})

    async def chat_media_stats(request):
        return ok(await chats.media_stats(request.query.get('account_id') or ''))

    async def chat_media_delete(request):
        b = await _body(request)
        if b.get('confirm') is not True:
            return bad('需要 confirm=true')
        ids = b.get('ids') or []
        rels = b.get('rels') or []
        r = await chats.delete_media(
            ids=ids if isinstance(ids, list) else [],
            rels=rels if isinstance(rels, list) else [],
            kind=str(b.get('kind') or ''),
            session_id=str(b.get('session_id') or ''))
        return ok(r)

    async def chat_media_transcode(request):
        """把 HEVC / AMR 之类转成浏览器能播的格式。"""
        b = await _body(request)
        ids = b.get('ids') or []
        if not isinstance(ids, list):
            ids = []
        if not ids:
            ids = [x['id'] for x in await chats.media_need_transcode()]
        r = await chats.transcode_media(ids)
        return ok(r)

    async def chat_media_reindex(request):
        return ok(await chats.rebuild_media_index())

    async def chat_media_repair(request):
        """修复媒体引用（转码后消息里还指向旧文件名）。"""
        return ok(await chats.repair_media_refs())

    app.router.add_get('/api/status', status)
    app.router.add_get('/api/config', get_config)
    app.router.add_post('/api/config', post_config)

    app.router.add_get('/api/accounts', get_accounts)
    app.router.add_post('/api/accounts', post_accounts)

    app.router.add_get('/api/providers', get_providers)
    app.router.add_post('/api/providers', post_providers)
    app.router.add_post('/api/providers/delete', del_provider)
    app.router.add_post('/api/providers/test', test_provider)
    app.router.add_get('/api/providers/models', provider_models)

    app.router.add_get('/api/personas', get_personas)
    app.router.add_post('/api/personas', post_personas)
    app.router.add_post('/api/personas/delete', del_persona)

    app.router.add_get('/api/cards', get_cards)
    app.router.add_post('/api/cards', post_cards)
    app.router.add_post('/api/cards/delete', del_card)
    app.router.add_post('/api/cards/clone', clone_card)
    app.router.add_post('/api/cards/import', import_card)
    app.router.add_get('/api/cards/export', export_card)

    # ★ catalog / bulk 必须注册在 /api/sessions/{sid} 前面，
    #   否则 {sid} 会把 /api/sessions/catalog 当成会话 id 吃掉。
    app.router.add_post('/api/sessions/catalog', sync_catalog)
    app.router.add_post('/api/sessions/bulk', bulk_sessions)
    app.router.add_get('/api/sessions', get_sessions)
    app.router.add_get('/api/sessions/{sid}', get_session)
    app.router.add_post('/api/sessions/{sid}', post_session)
    app.router.add_post('/api/sessions/{sid}/clear', clear_session)
    app.router.add_post('/api/sessions/delete', del_session)

    app.router.add_get('/api/chat/sessions', chat_sessions)
    app.router.add_get('/api/chat/messages', chat_messages)
    app.router.add_get('/api/chat/stats', chat_stats)
    app.router.add_get('/api/chat/export', chat_export)
    app.router.add_post('/api/chat/recall', chat_recall)
    app.router.add_post('/api/chat/session-ui', chat_session_ui)
    app.router.add_get('/api/chat/forward', chat_forward)
    app.router.add_post('/api/chat/purge-media', chat_purge_media)
    app.router.add_get('/api/chat/media-check', chat_media_check)

    app.router.add_get('/api/chat/query', chat_query)
    app.router.add_get('/api/chat/senders', chat_senders)
    app.router.add_post('/api/chat/session-clear', chat_clear_session)
    app.router.add_get('/api/chat/media', chat_media_list)
    app.router.add_get('/api/chat/media/stats', chat_media_stats)
    app.router.add_post('/api/chat/media/delete', chat_media_delete)
    app.router.add_post('/api/chat/media/transcode', chat_media_transcode)
    app.router.add_post('/api/chat/media/reindex', chat_media_reindex)
    app.router.add_post('/api/chat/media/repair', chat_media_repair)

    app.router.add_get('/api/logs', get_logs)
    app.router.add_get('/api/stats', get_stats)
    app.router.add_post('/api/chat/random_reply', random_reply)
    app.router.add_post('/api/chat/random_reply/send', send_random_reply)
    app.router.add_get('/api/context', preview_context)
    app.router.add_get('/api/tools/search', tools_search)
    app.router.add_post('/api/test/chat', test_chat)

    return app
