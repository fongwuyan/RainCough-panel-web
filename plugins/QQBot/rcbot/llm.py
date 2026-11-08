# -*- coding: utf-8 -*-
"""LLM 调用：OpenAI 兼容 / Anthropic 两种协议，统一 chat()。"""
import asyncio
import json
import time

import aiohttp

from . import logbuf


class LLMError(Exception):
    pass


def _join(base, path):
    return (base or '').rstrip('/') + path


async def _post(session, url, headers, payload, timeout):
    try:
        async with session.post(url, headers=headers, json=payload,
                                timeout=aiohttp.ClientTimeout(total=timeout)) as r:
            body = await r.text()
            if r.status >= 400:
                raise LLMError('HTTP %s: %s' % (r.status, body[:400]))
            return json.loads(body)
    except aiohttp.ClientError as e:
        raise LLMError('连接失败：%s' % str(e)[:200])
    except asyncio.TimeoutError:
        raise LLMError('请求超时（%ss）' % timeout)


WEB_SEARCH_TOOL = {
    'type': 'function',
    'function': {
        'name': 'web_search',
        'description': ('搜索互联网获取实时信息。遇到新闻、价格、天气、赛事、'
                        '最近发生的事，或你不确定的事实时必须调用；'
                        '同一轮最多调用两次，拿到结果就直接回答，不要反复搜。'),
        'parameters': {
            'type': 'object',
            'properties': {
                'query': {'type': 'string', 'description': '搜索关键词，尽量精炼'},
            },
            'required': ['query'],
        },
    },
}


def web_tools(cfg):
    """按配置返回 (tools, runner)；没开联网就返回 (None, None)。"""
    fs = (cfg.get('features') or {}).get('web_search') or {}
    if not fs.get('enabled'):
        return None, None
    limit = max(1, min(10, int(fs.get('max_results') or 5)))

    async def runner(name, args):
        from . import search
        q = (args or {}).get('query') or (args or {}).get('q') or ''
        res = await search.query(q, limit=limit)
        logbuf.info('tool', '联网搜索「%s」→ %d 条' % (q[:60], len(res)))
        return {'query': q, 'results': res}

    return [WEB_SEARCH_TOOL], runner


def _plain(content):
    """把可能的多段 content 压成纯文本（用于错误提示/日志）。"""
    if isinstance(content, list):
        return ' '.join(p.get('text') or '' for p in content
                        if isinstance(p, dict) and p.get('type') == 'text')
    return content or ''


async def chat(provider, messages, system=None, max_tokens=2048, temperature=0.7,
               tools=None, tool_runner=None, max_rounds=3):
    """messages: [{'role':'user'|'assistant','content':str|list}] → 回复文本

    tools/tool_runner 给了就走 function calling（目前只有 OpenAI 兼容协议支持）。
    """
    if not provider:
        raise LLMError('没有可用的模型提供商')
    ptype = (provider.get('type') or 'openai').lower()
    key = (provider.get('api_key') or '').strip()
    base = (provider.get('api_base') or '').strip()
    model = (provider.get('model') or '').strip()
    timeout = int(provider.get('timeout') or 120)
    if not base:
        raise LLMError('提供商 %s 没有配置 api_base' % provider.get('id'))
    if not model:
        raise LLMError('提供商 %s 没有配置模型名' % provider.get('id'))

    async with aiohttp.ClientSession() as sess:
        if ptype == 'anthropic':
            url = _join(base, '/v1/messages') if not base.endswith('/v1') else _join(base, '/messages')
            headers = {'x-api-key': key, 'anthropic-version': '2023-06-01',
                       'content-type': 'application/json'}
            payload = {'model': model, 'max_tokens': max_tokens,
                       'temperature': temperature, 'messages': messages}
            if system:
                payload['system'] = system
            data = await _post(sess, url, headers, payload, timeout)
            blocks = data.get('content') or []
            text = ''.join(b.get('text', '') for b in blocks if isinstance(b, dict))
            if not text:
                raise LLMError('返回内容为空：%s' % json.dumps(data, ensure_ascii=False)[:300])
            return text

        # 默认按 OpenAI 兼容协议
        url = _join(base, '/chat/completions')
        headers = {'Content-Type': 'application/json'}
        # ★ api_key 为空就别发 Authorization —— 有些免 key 的端点
        #   （如 pollinations）收到空的 "Bearer " 会直接 401。
        if key:
            headers['Authorization'] = 'Bearer ' + key
        msgs = ([{'role': 'system', 'content': system}] if system else []) + list(messages)

        use_tools = bool(tools) and bool(tool_runner)
        last_data = {}
        for rnd in range(max_rounds + 1):
            payload = {'model': model, 'messages': msgs,
                       'max_tokens': max_tokens, 'temperature': temperature}
            if use_tools:
                payload['tools'] = tools
                payload['tool_choice'] = 'auto'
            data = await _post(sess, url, headers, payload, timeout)
            last_data = data
            choices = data.get('choices') or []
            if not choices:
                raise LLMError('返回没有 choices：%s'
                               % json.dumps(data, ensure_ascii=False)[:300])
            ch = choices[0]
            msg = ch.get('message') or {}
            calls = msg.get('tool_calls') or []

            # 还要调工具：执行完把结果塞回去，再问一次
            if calls and use_tools and rnd < max_rounds:
                msgs.append({'role': 'assistant',
                             'content': msg.get('content') or '',
                             'tool_calls': calls})
                for tc in calls:
                    fn = tc.get('function') or {}
                    name = fn.get('name') or ''
                    try:
                        args = json.loads(fn.get('arguments') or '{}')
                    except Exception:
                        args = {}
                    try:
                        res = await tool_runner(name, args)
                    except Exception as e:
                        res = {'error': str(e)[:300]}
                        logbuf.warn('tool', '工具 %s 失败：%s' % (name, str(e)[:160]))
                    msgs.append({'role': 'tool',
                                 'tool_call_id': tc.get('id') or name,
                                 'content': json.dumps(res, ensure_ascii=False)[:6000]})
                continue

            text = (msg.get('content') or '').strip()
            if text:
                return text
            if calls:
                # 轮数用完了还在调工具：直接把最后一次结果拼成文本兜底
                raise LLMError('模型连续 %d 轮都在调用工具，没有给出回答' % (max_rounds + 1))
            # 推理模型会先吐 reasoning_content / reasoning，
            # max_tokens 给小了就会被推理吃光、content 为空。
            reason = ((msg.get('reasoning_content') or '')
                      or (msg.get('reasoning') or '')).strip()
            fin = ch.get('finish_reason') or ''
            if fin == 'length':
                raise LLMError('输出被截断（finish_reason=length），把「最大输出 tokens」调大再试')
            if reason:
                raise LLMError('模型只返回了推理内容（%d 字），把「最大输出 tokens」调大再试'
                               % len(reason))
            raise LLMError('返回内容为空：%s'
                           % json.dumps(last_data, ensure_ascii=False)[:300])
        raise LLMError('调用轮数用尽')


async def chat_chain(providers, messages, system=None, **kw):
    """多个提供商依次尝试：前一个挂了（限流/超时/5xx/网络）自动换下一个。

    免 key 的公共端点（pollinations / OVH 免费推理）随时可能限流或下线，
    多配几个自动兜底，比卡在一家强得多。

    返回 (回复文本, 实际用上的提供商)。
    """
    provs = [p for p in (providers or []) if p]
    if not provs:
        raise LLMError('没有可用的模型提供商')
    errs = []
    for i, p in enumerate(provs):
        try:
            txt = await chat(p, messages, system=system, **kw)
            if i:
                logbuf.warn('llm', '已切换到提供商 %s（前面几个都失败了）' % p.get('id'))
            return txt, p
        except Exception as e:
            errs.append('%s：%s' % (p.get('id'), str(e)[:100]))
            logbuf.warn('llm', '提供商 %s 失败：%s' % (p.get('id'), str(e)[:140]))
    raise LLMError('所有模型提供商都失败了：%s' % '；'.join(errs[:3]))


async def test(provider):
    """测连通性：发一句最短的请求。

    注意 max_tokens 不能太小 —— 推理模型（deepseek-flash 之类）会先把预算花在
    reasoning_content 上，给 16 个 token 会导致 content 为空、误判成不通。
    """
    t0 = time.time()
    try:
        text = await chat(provider, [{'role': 'user', 'content': '只回复两个字：可用'}],
                          system=None, max_tokens=256, temperature=0)
        return {'ok': True, 'ms': int((time.time() - t0) * 1000), 'reply': text[:80]}
    except Exception as e:
        return {'ok': False, 'ms': int((time.time() - t0) * 1000), 'error': str(e)[:400]}


async def list_models(provider):
    """拉 /models（OpenAI 兼容才有）。"""
    base = (provider.get('api_base') or '').strip()
    key = (provider.get('api_key') or '').strip()
    if not base:
        raise LLMError('没有 api_base')
    async with aiohttp.ClientSession() as sess:
        try:
            headers = {'Authorization': 'Bearer ' + key} if key else {}
            async with sess.get(_join(base, '/models'),
                                headers=headers,
                                timeout=aiohttp.ClientTimeout(total=20)) as r:
                data = await r.json(content_type=None)
                items = data.get('data') if isinstance(data, dict) else data
                return [i.get('id') for i in (items or []) if isinstance(i, dict) and i.get('id')]
        except Exception as e:
            raise LLMError('拉模型列表失败：%s' % str(e)[:200])
