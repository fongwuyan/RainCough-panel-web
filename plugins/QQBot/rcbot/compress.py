# -*- coding: utf-8 -*-
"""上下文压缩：token 估算 + 保留最近 + 旧消息用 LLM 摘要。

策略（可配）：
  1. 拉最近 max_history_messages 条
  2. 估算 token，没超预算就直接用
  3. 超了：按 keep_recent_ratio 保留最近一段，更旧的交给 LLM 压成摘要（增量合并旧摘要）
  4. 压缩失败就硬截断，绝不阻塞回复
"""
from . import logbuf, llm, store

SAFE_MARGIN = 512


def est(text):
    """粗估 token：中文约 1.5 字/token，其它约 4 字符/token。"""
    if not text:
        return 0
    cjk = 0
    for ch in text:
        if '\u4e00' <= ch <= '\u9fff':
            cjk += 1
    other = len(text) - cjk
    return int(cjk / 1.5 + other / 4.0) + 1


def est_msgs(msgs):
    return sum(est(m.get('content') or '') for m in msgs)


def to_llm_messages(msgs, summary=''):
    out = []
    if summary:
        out.append({'role': 'user', 'content': '【此前对话的摘要】\n' + summary})
        out.append({'role': 'assistant', 'content': '好的，我已经了解之前的上下文。'})
    for m in msgs:
        role = 'assistant' if m.get('role') == 'assistant' else 'user'
        c = m.get('content') or ''
        name = m.get('name') or ''
        if role == 'user' and name:
            c = '%s：%s' % (name, c)
        out.append({'role': role, 'content': c})
    return out


COMPRESS_PROMPT = """把下面的对话历史压缩成一段简洁摘要，供后续对话继续使用。

要求：
- 保留用户身份、偏好、明确表达过的事实
- 保留已经做出的决定、结论、承诺
- 保留未完成的事项
- 不要编造，不要评价，不要写"用户说"以外的推测
- 第三人称，300 字以内，纯文本

{old}

新增对话：
{new}

只输出摘要正文。"""


async def _compress(provider, old_summary, msgs):
    lines = []
    for m in msgs:
        role = '助手' if m.get('role') == 'assistant' else (m.get('name') or '用户')
        lines.append('%s：%s' % (role, (m.get('content') or '')[:1500]))
    old = ('已有摘要：\n' + old_summary) if old_summary else '（没有旧摘要）'
    prompt = COMPRESS_PROMPT.format(old=old, new='\n'.join(lines)[:24000])
    text = await llm.chat(provider, [{'role': 'user', 'content': prompt}],
                          system=None, max_tokens=2048, temperature=0.2)
    return text.strip()


async def build_context(cfg, sid, system_prompt, provider):
    """返回 (system, messages, meta)"""
    ctx = cfg.get('context') or {}
    max_ctx = int(ctx.get('max_tokens') or 128000)
    out_budget = int(ctx.get('max_output_tokens') or 2048)
    hist_limit = int(ctx.get('max_history_messages') or 200)
    keep_ratio = float(ctx.get('keep_recent_ratio') or 0.15)
    compress_on = bool(ctx.get('compress_enabled', True))

    msgs = await store.recent_messages(sid, hist_limit)
    if not msgs:
        return system_prompt, [], {'compressed': False, 'tokens': est(system_prompt)}

    summ = await store.get_summary(sid)
    summary = (summ or {}).get('content') or ''

    budget = max_ctx - out_budget - est(system_prompt) - SAFE_MARGIN
    if budget < 2000:
        budget = 2000

    total = est(summary) + est_msgs(msgs)
    meta = {'compressed': False, 'tokens': total, 'budget': budget,
            'dropped': 0, 'summary_len': len(summary)}

    if total <= budget:
        return system_prompt, to_llm_messages(msgs, summary), meta

    # 保留最近一段
    keep_tokens = max(800, int(budget * keep_ratio))
    keep, drop = [], []
    acc = 0
    for m in reversed(msgs):
        t = est(m.get('content') or '')
        if acc + t <= keep_tokens or not keep:
            keep.insert(0, m)
            acc += t
        else:
            drop.insert(0, m)

    if not drop:
        return system_prompt, to_llm_messages(keep, summary), meta

    new_summary = summary
    if compress_on:
        cprovider = provider
        cpid = (ctx.get('compress_provider') or '').strip()
        if cpid:
            cprovider = None
            for p in cfg.get('providers') or []:
                if p.get('id') == cpid:
                    cprovider = p
                    break
            cprovider = cprovider or provider
        try:
            new_summary = await _compress(cprovider, summary, drop)
            await store.set_summary(sid, new_summary, drop[-1]['id'])
            logbuf.info('ctx', '会话 %s 压缩 %d 条 → 摘要 %d 字'
                        % (sid, len(drop), len(new_summary)))
        except Exception as e:
            logbuf.warn('ctx', '压缩失败，改为硬截断：%s' % str(e)[:200])
            new_summary = summary
            meta['compress_error'] = str(e)[:200]
    else:
        # 关掉压缩：把被裁掉的部分并进摘要（只记个占位，保证不失忆太狠）
        tail = '（省略了更早的 %d 条对话）' % len(drop)
        new_summary = (summary + '\n' + tail).strip() if summary else tail
        await store.set_summary(sid, new_summary, drop[-1]['id'])

    meta['compressed'] = True
    meta['dropped'] = len(drop)
    meta['summary_len'] = len(new_summary)
    meta['tokens'] = est(new_summary) + est_msgs(keep)
    return system_prompt, to_llm_messages(keep, new_summary), meta
