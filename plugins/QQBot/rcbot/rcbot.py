#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""rcbot —— RainCough 自研 QQ 机器人核心。

只做五件事：模型提供商、人格、会话管理、上下文压缩、运行日志。
QQ 收发走 SnowLuma 的 OneBot 11 正向 WS（默认 ws://127.0.0.1:3001）。

2026-11-01：支持多 QQ 号 —— 每个号一条 OneBot 连接，由 accounts.py 编排。
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from aiohttp import web  # noqa: E402

from rcbot import accounts as accmod  # noqa: E402
from rcbot import api, bot as botmod, config, logbuf, store  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))


async def main():
    logbuf.setup(os.path.join(ROOT, 'logs', 'rcbot.log'),
                 os.environ.get('RCBOT_LOG_LEVEL', 'INFO'))
    logbuf.info('main', 'rcbot 启动')

    cfg = config.load()
    await store.init()
    await store.ensure_columns()

    # 账号连接管理器：每个 QQ 号一条 OneBot WS
    mgr = accmod.AccountManager(config.load, None)
    b = botmod.Bot()
    mgr.on_event = b.on_account_event
    # 把 Bot 给 Manager：OneBot 连上时用它拉群名/好友名缓存
    mgr.bot = b
    mgr.start()

    async def warm():
        """连上后补一次群名（事件驱动的补充手段）。

        ★ 主力是 AccountManager.on_connected —— 每次连上都会拉一次。
          这里只兜底：万一连接就绪的回调没赶上（比如热更后立刻连上），
          这里再拉一次。失败就算了。
        """
        for _ in range(60):
            await asyncio.sleep(2)
            for acc in list(mgr.accounts.values()):
                if acc.ob.connected:
                    await asyncio.sleep(1)
                    await b.fill_group_names(acc.ob)
            if mgr.accounts and all(a.ob.connected for a in mgr.accounts.values()):
                return
    asyncio.create_task(warm())

    # 历史会话补账号前缀（一次性、幂等）
    try:
        dacc = config.default_account(config.load())
        if dacc:
            if await store.migrate_account_prefix(dacc.get('id')):
                logbuf.info('main', '历史会话已补账号前缀：%s' % dacc.get('id'))
            await store.upsert_account(dacc.get('id'), uin=dacc.get('uin') or '')
    except Exception as e:
        logbuf.warn('main', '会话迁移失败：%s' % str(e)[:200])

    app = api.make_app(mgr, b)
    runner = web.AppRunner(app)
    await runner.setup()
    host = (cfg.get('http') or {}).get('host') or '127.0.0.1'
    port = int((cfg.get('http') or {}).get('port') or 6710)
    site = web.TCPSite(runner, host, port)
    await site.start()
    logbuf.info('main', 'HTTP API 监听 http://%s:%d' % (host, port))

    try:
        await asyncio.Event().wait()
    finally:
        mgr.stop()
        await runner.cleanup()
        await store.close()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
