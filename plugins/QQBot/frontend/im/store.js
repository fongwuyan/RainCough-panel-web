// 消息页数据层：接口调用 + 会话/消息状态
//
// ★ 只做"取数 + 缓存"，不掺渲染逻辑。
// ★ 后端接口复用既有的 qqbot.chat.* —— 消息页与「聊天记录」页读同一份数据，
//   避免出现两套真相。
import { reactive } from 'vue'

let CTX = null
export function setCtx(c) { CTX = c }

export async function call(iface, params) {
  if (!CTX || !CTX.invoke) throw new Error('插件运行时未就绪')
  return await CTX.invoke(iface, params || {})
}

export async function callData(iface, params) {
  const r = await call(iface, params)
  return (r && typeof r === 'object' && 'data' in r && r.data !== null && r.data !== undefined)
    ? r.data : r
}

export const S = reactive({
  ready: false,
  err: '',
  uin: '',
  sessions: [],
  sid: '',
  msgs: [],
  loading: false,
  loadingMore: false,
  hasMore: true,
  keyword: '',
  viewer: '',
  pageSize: 50,
  cap: 600,          // 单会话最多保留条数（DOM 上限，超出裁头）
  atBottom: true,
})

export async function loadSelf() {
  try {
    const d = await callData('qqbot.account.info')
    S.uin = String((d && (d.uin || d.self_id)) || '')
  } catch (e) { /* 取不到就算了，右侧判定走 role */ }
}

export async function loadSessions() {
  S.err = ''
  try {
    const d = await callData('qqbot.chat.sessions', { limit: 200 })
    const items = (d && d.items) || []
    // 只保留有消息的会话，按最后消息时间倒序（后端已排好）
    S.sessions = items.filter((x) => x && x.target_id)
    if (!S.sid && S.sessions.length) S.sid = S.sessions[0].session_id
    S.ready = true
  } catch (e) {
    S.err = String((e && e.message) || e)
  }
}

export async function openSession(sid) {
  if (!sid) return
  S.sid = sid
  S.msgs = []
  S.hasMore = true
  S.atBottom = true
  await loadMessages(false)
}

export async function loadMessages(append) {
  if (!S.sid) return
  if (append && (S.loadingMore || !S.hasMore)) return
  if (append) S.loadingMore = true
  else S.loading = true
  try {
    const params = { session_id: S.sid, limit: S.pageSize }
    if (append && S.msgs.length) params.before_id = S.msgs[0].id
    const d = await callData('qqbot.chat.messages', params)
    const items = (d && d.items) || []
    if (append) {
      S.msgs = items.concat(S.msgs)
      if (S.msgs.length > S.cap) S.msgs = S.msgs.slice(-S.cap)
    } else {
      S.msgs = items
    }
    S.hasMore = items.length >= S.pageSize
  } catch (e) {
    S.err = String((e && e.message) || e)
  } finally {
    S.loading = false
    S.loadingMore = false
  }
}

export function current() {
  return S.sessions.find((x) => x.session_id === S.sid) || null
}

/** 自己发的消息：机器人回复 或 发送者就是本账号 */
export function isMe(m) {
  if (!m) return false
  if (m.role === 'assistant') return true
  const sid = String(m.sender_id || '')
  return !!(S.uin && sid && sid === S.uin)
}


// ---------------------------------------------------------------- 发送
//
// 乐观更新：先插一条 _pending 的本地消息，成功用后端记录替换，
// 失败标记 _failed 并保留原文 —— 用户点一下就能重发。

let tmpSeq = 0

export async function sendText(text, replyId = '', quoteMeta = null) {
  const t = String(text || '')
  if (!S.sid || !t.trim()) return
  const tmp = {
    id: 'tmp-' + (++tmpSeq) + '-' + Date.now(),
    created_at: Math.floor(Date.now() / 1000),
    sender_id: S.uin,
    sender_name: '',
    role: 'assistant',
    segs: [{ type: 'text', data: { text: t } }],
    text: t,
    media: [],
    recalled: 0,
    _pending: true,
    _text: t,
  }
  S.msgs.push(tmp)
  try {
    const params = { session_id: S.sid, text: t }
    if (replyId) params.reply_id = String(replyId)
    const d = await callData('qqbot.chat.send', params)
    // 发送时带了引用：把引用摘要挂到返回记录上，本地立刻能显示（刷新后由后端解析）
    if (d && quoteMeta && replyId) d.quote = quoteMeta
    const i = S.msgs.findIndex((x) => x.id === tmp.id)
    if (i >= 0 && d && d.id) S.msgs.splice(i, 1, d)
    else if (i >= 0) { S.msgs[i]._pending = false; S.msgs[i]._failed = true }
    return d
  } catch (e) {
    const m = S.msgs.find((x) => x.id === tmp.id)
    if (m) {
      m._pending = false
      m._failed = true
      m._err = String((e && e.message) || e)
    }
    throw e
  }
}

/** 重发一条失败的消息：先移除失败的本地项，再走一次发送 */
export async function retrySend(m) {
  const i = S.msgs.findIndex((x) => x.id === (m && m.id))
  const text = (m && (m._text || m.text)) || ''
  if (i >= 0) S.msgs.splice(i, 1)
  return sendText(text)
}


// ---------------------------------------------------------------- 已读位置
//
// QQ 的"以下为新消息"分割线依赖"本地已读位置"。
// 这是**客户端本地状态**，不写消息表（换设备本来也会重新算），
// 所以放 localStorage，按会话记忆最后一次看过的消息 id。
const READ_KEY = 'rcq.im.read'

function readMap() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}') || {} } catch (e) { return {} }
}

export function lastRead(sid) {
  return Number(readMap()[sid] || 0)
}

export function markRead(sid, id) {
  if (!sid || !id) return
  const m = readMap()
  if (Number(m[sid] || 0) >= Number(id)) return
  m[sid] = Number(id)
  try { localStorage.setItem(READ_KEY, JSON.stringify(m)) } catch (e) {}
}
