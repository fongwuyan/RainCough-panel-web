# -*- coding: utf-8 -*-
"""多账号连接编排。

一个 QQ 号 = 一条 OneBot 连接 = 一个 SnowLuma 容器。
这个模块负责：按配置起/停连接、把事件按账号路由出去。

为什么不用单例（2026-11-01 改造前的 rcbot/onebot.py 是单例）：
  单例只有一条 ws_url / self_id，多号时两个账号的事件会混在一起，
  而且没法单独停掉其中一个号。

路由依据：OneBot 事件必带 self_id，但这里其实不需要靠它 ——
  每条连接只会收到自己账号的事件，天然无歧义。
  self_id 只用来在连接建立后回填账号的 uin（可能与配置里手填的不一致）。
"""
import asyncio

from . import config, logbuf, onebot, profile


class Account:
    """一个账号 = 一条连接 + 一份账号级配置。"""

    def __init__(self, cfg):
        self.id = cfg.get('id') or ''
        self.uin = str(cfg.get('uin') or '')
        self.cfg = cfg
        self.ob = onebot.OneBot(self._cfg_getter, None, self.id)
        self.ob.on_event = self._on_event
        self.ob.on_ready = self._on_ready
        self.task = None
        self._manager = None
        self.last_error = ''

    def _cfg_getter(self):
        # OneBot 读的键是 cfg['onebot']['ws_url'] / ['access_token']
        return {'onebot': self.cfg}

    async def _on_event(self, ev):
        if self._manager:
            await self._manager.dispatch(self, ev)

    async def _on_ready(self):
        """OneBot 连上了 → 让 Bot 去拉群名/好友名缓存。"""
        if self._manager:
            await self._manager.on_connected(self)

    def start(self, manager):
        self._manager = manager
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._run())
            logbuf.info('acc', '账号 %s 已接入（uin=%s，%s）'
                        % (self.id, self.uin or '?', self.cfg.get('ws_url') or '?'))

    async def _run(self):
        try:
            await self.ob.run()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            self.last_error = str(e)[:200]
            logbuf.error('acc', '账号 %s 连接异常：%s' % (self.id, self.last_error))

    def stop(self):
        self.ob.stop()
        if self.task and not self.task.done():
            self.task.cancel()
        self.task = None

    async def status(self):
        st = await self.ob.status()
        st['id'] = self.id
        st['uin'] = self.uin
        # 昵称/头像：优先用配置里存的值；没有就从 OneBot 的
        # get_login_info 现场取（它返回 {user_id, nickname}）。
        # 头像按 QQ 号从 qlogo 取 —— QQ 没给头像直链，但号有了就能显示。
        nick = self.cfg.get('nick') or ''
        avatar = self.cfg.get('avatar') or ''
        login = st.get('login') or {}
        if not nick:
            nick = login.get('nickname') or ''
        if not self.uin and login.get('user_id'):
            self.uin = str(login.get('user_id'))
        if not avatar:
            avatar = profile.avatar_url(self.uin)
        st['nick'] = nick
        st['avatar'] = avatar
        st['persona_id'] = self.cfg.get('persona_id') or ''
        st['provider_id'] = self.cfg.get('provider_id') or ''
        st['enabled'] = bool(self.cfg.get('enabled', True))
        st['webui'] = self.cfg.get('webui') or ''
        st['unit'] = self.cfg.get('unit') or ''
        st['instance_dir'] = self.cfg.get('instance_dir') or ''
        st['last_error'] = self.last_error
        return st

    def apply(self, cfg):
        """热更新配置。ws_url 变了要重连。"""
        old_url = self.cfg.get('ws_url')
        self.cfg.update(cfg)
        self.uin = str(self.cfg.get('uin') or self.uin)
        if old_url != self.cfg.get('ws_url'):
            logbuf.info('acc', '账号 %s 连接地址变化，重连' % self.id)
            self.stop()
            self.start(self._manager)


class AccountManager:
    """管理所有账号连接，并按账号分发事件。"""

    def __init__(self, cfg_getter, on_event):
        self.cfg_getter = cfg_getter
        self.on_event = on_event          # async def (account, event) -> None
        # Bot 实例（用来在连接就绪时拉群名/好友名缓存）
        self.bot = None
        self.accounts = {}                # id -> Account
        self._task = None
        self._stop = False

    # ---------------- 生命周期

    async def run(self):
        """常驻：定期对齐配置与实际连接（支持运行期增删账号）。"""
        while not self._stop:
            try:
                await self.sync()
            except Exception as e:
                logbuf.error('acc', '账号同步失败：%s' % str(e)[:200])
            await asyncio.sleep(3)

    def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run())

    def stop(self):
        self._stop = True
        for a in list(self.accounts.values()):
            a.stop()
        self.accounts = {}

    async def sync(self):
        """按配置对齐连接集合。"""
        cfg = self.cfg_getter() or {}
        want = {}
        for a in config.get_accounts(cfg):
            want[a['id']] = a

        # 移除已删掉的账号
        for aid in list(self.accounts):
            if aid not in want:
                acc = self.accounts.pop(aid)
                acc.stop()
                logbuf.info('acc', '账号 %s 已移除' % aid)

        # 新增/更新
        for aid, a in want.items():
            acc = self.accounts.get(aid)
            if acc is None:
                acc = Account(a)
                self.accounts[aid] = acc
                acc.start(self)
            else:
                acc.apply(a)

    # ---------------- 事件

    async def dispatch(self, account, ev):
        """按账号分发事件。"""
        if self.on_event:
            await self.on_event(account, ev)

    async def on_connected(self, account):
        """某账号的 OneBot 连上了。

        名字（群名/好友昵称）只能从 OneBot 拉，而那些接口要登录后才有数据，
        所以在连接就绪这一刻拉一次最合适 —— 之前没人调 fill_group_names，
        群名缓存永远是空的，聊天记录里群名显示成裸群号。
        """
        bot = self.bot
        if bot is None:
            return
        try:
            await bot.on_connected(account.ob, account.id)
        except Exception as e:
            logbuf.debug('acc', '拉名字缓存失败：%s' % str(e)[:120])

    def get(self, aid):
        return self.accounts.get(aid)

    def find(self, key):
        """按 id 或 uin 找账号对象。"""
        if not key:
            return None
        acc = self.accounts.get(key)
        if acc:
            return acc
        for a in self.accounts.values():
            if a.uin and a.uin == str(key):
                return a
        return None

    async def status_all(self):
        out = []
        for aid in sorted(self.accounts):
            acc = self.accounts[aid]
            try:
                out.append(await acc.status())
            except Exception as e:
                out.append({'id': aid, 'uin': acc.uin, 'online': False,
                            'error': str(e)[:160]})
        return out
