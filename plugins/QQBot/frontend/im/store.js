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
