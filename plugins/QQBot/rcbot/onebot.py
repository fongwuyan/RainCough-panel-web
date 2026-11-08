# -*- coding: utf-8 -*-
"""OneBot 11 正向 WS 客户端：连 SnowLuma、收事件、调 API。

一个实例 = 一条连接 = 一个 QQ 号（2026-11-01 多账号改造）。
多账号的编排在 accounts.py，这里保持"只管自己那条连接"的职责。
"""
import asyncio
import json

import aiohttp

from . import logbuf


class OneBot:
    def __init__(self, cfg_getter, on_event, account_id=''):
        self.cfg_getter = cfg_getter
        self.on_event = on_event          # async def (event) -> None
        # 连上后的回调（async def () -> None）——
        # 用来在连接就绪时拉群名/好友名缓存（那两个接口要登录后才有数据）
        self.on_ready = None
        self.account_id = account_id
        self.ws = None
        self.connected = False
        self.self_id = ''
        self._pending = {}
        self._n = 0
        self._backoff = 1.0
        self._stop = False
        self._ready_fired = False

    def stop(self):
        """请求停止重连循环（账号被移除时用）。"""
        self._stop = True
        try:
            if self.ws and not self.ws.closed:
                asyncio.create_task(self.ws.close())
        except Exception:
            pass

    # ---------------- 连接

    async def run(self):
        while not self._stop:
            cfg = self.cfg_getter().get('onebot') or {}
            url = (cfg.get('ws_url') or '').strip()
            if not url:
                logbuf.warn('onebot', '账号 %s 没配 ws_url，5 秒后重试'
                            % (self.account_id or '?'))
                await asyncio.sleep(5)
                continue
            headers = {}
            tok = (cfg.get('access_token') or '').strip()
            if tok:
                headers['Authorization'] = 'Bearer ' + tok
            try:
                await self._session(url, headers)
                self._backoff = 1.0
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logbuf.warn('onebot', '账号 %s 连接失败：%s（%.0fs 后重连）'
                            % (self.account_id or '?', str(e)[:160], self._backoff))
            if self._stop:
                break
            self.connected = False
            self.ws = None
            await asyncio.sleep(self._backoff)
            self._backoff = min(30.0, self._backoff * 1.8)

    async def _session(self, url, headers):
        async with aiohttp.ClientSession() as sess:
            async with sess.ws_connect(url, headers=headers, heartbeat=25,
                                       timeout=aiohttp.ClientWSTimeout(ws_close=5)) as ws:
                self.ws = ws
                self.connected = True
                self._backoff = 1.0
                logbuf.info('onebot', '账号 %s 已连上 %s' % (self.account_id or '?', url))
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        try:
                            self._handle(json.loads(msg.data))
                        except Exception as e:
                            logbuf.warn('onebot', '解析消息失败：%s' % str(e)[:160])
                    elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        break
        logbuf.warn('onebot', '账号 %s 连接断开' % (self.account_id or '?'))

    def _handle(self, data):
        echo = data.get('echo')
        if echo and echo in self._pending:
            fut = self._pending.pop(echo)
            if not fut.done():
                fut.set_result(data)
            return
        post = data.get('post_type')
        if post == 'meta_event':
            if data.get('meta_event_type') == 'lifecycle':
                sid = data.get('self_id')
                if sid:
                    self.self_id = str(sid)
                    logbuf.info('onebot', '账号 %s 已就绪（uin=%s）'
                                % (self.account_id or '?', sid))
                # 连接就绪 → 通知上层去拉群名/好友名缓存（只触发一次）
                if not self._ready_fired and self.on_ready:
                    self._ready_fired = True
                    asyncio.create_task(self._safe_ready())
            return
        if self.on_event:
            asyncio.create_task(self._safe_event(data))

    async def _safe_ready(self):
        try:
            if self.on_ready:
                await self.on_ready()
        except Exception as e:
            logbuf.debug('onebot', 'on_ready 回调出错：%s' % str(e)[:120])

    async def _safe_event(self, data):
        try:
            await self.on_event(data)
        except Exception as e:
            logbuf.error('bot', '处理事件出错：%s' % str(e)[:300])

    # ---------------- 调 API

    async def call(self, action, params=None, timeout=20):
        ws = self.ws
        if ws is None or ws.closed:
            raise RuntimeError('还没连上 QQ 框架')
        self._n += 1
        echo = 'rc-%d' % self._n
        fut = asyncio.get_event_loop().create_future()
        self._pending[echo] = fut
        try:
            await ws.send_json({'action': action, 'params': params or {}, 'echo': echo})
            return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError:
            raise RuntimeError('调用 %s 超时' % action)
        finally:
            self._pending.pop(echo, None)

    async def send_text(self, kind, target, text, mention=None):
        """发文本。返回 OneBot 响应（含 message_id，撤回打标要用）。"""
        segs = []
        if mention:
            segs.append({'type': 'at', 'data': {'qq': str(mention)}})
            segs.append({'type': 'text', 'data': {'text': ' '}})
        segs.append({'type': 'text', 'data': {'text': text}})
        if kind == 'group':
            return await self.call('send_group_msg',
                                   {'group_id': int(target), 'message': segs})
        return await self.call('send_private_msg',
                               {'user_id': int(target), 'message': segs})

    async def status(self):
        out = {'connected': self.connected, 'self_id': self.self_id,
               'account_id': self.account_id}
        try:
            r = await self.call('get_login_info', timeout=8)
            out['login'] = r.get('data') or {}
            out['online'] = r.get('status') == 'ok'
        except Exception as e:
            out['online'] = False
            out['error'] = str(e)[:160]
        return out
