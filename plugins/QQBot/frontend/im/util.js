// 消息页工具函数：时间、媒体 URL、消息段归一化
//
// 说明：插件是自包含 IIFE，不能从 plugin.js 里 import 那些模块级函数，
// 所以这里保留一份最小实现（保持与主文件同规则，避免行为漂移）。

const p2 = (n) => (n < 10 ? '0' + n : '' + n)

export function fmtClock(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return p2(d.getHours()) + ':' + p2(d.getMinutes())
}

function dayStart(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/** 会话列表右上角的时间：今天 HH:MM / 昨天 / M月D日 / YYYY/M/D */
export function fmtListTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const today = dayStart(Date.now())
  const day = dayStart(d)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return fmtClock(ts)
  if (diff === 1) return '昨天'
  if (d.getFullYear() === new Date().getFullYear()) return (d.getMonth() + 1) + '月' + d.getDate() + '日'
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate()
}

/** 消息流里的时间分隔条文案 */
export function fmtDayLabel(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const diff = Math.round((dayStart(Date.now()) - dayStart(d)) / 86400000)
  const hm = fmtClock(ts)
  if (diff === 0) return hm
  if (diff === 1) return '昨天 ' + hm
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return (sameYear ? (d.getMonth() + 1) + '月' + d.getDate() + '日 ' : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ') + hm
}

/** 媒体文件 URL：走面板文件预览通道（支持 Range，视频能拖进度条） */
export function mediaUrl(m) {
  if (!m) return ''
  if (m._url) return m._url          // 本地乐观预览（blob URL）
  const p = m.abs || (m.rel ? '/opt/rcbot/media/' + m.rel : '')
  if (!p) return ''
  return '/api/fm/preview?path=' + encodeURIComponent(p)
}

export function mediaAlive(m) {
  if (!m || !m.local) return false
  return m.exists !== 0
}

/** QQ 经典表情：id → 官方表情图。取不到的由 <img onerror> 兜底 */
export function faceUrl(id) {
  // ★ 不能用 id || ''：表情 id 0 是老实的 0，被当成空值会返回空串 →
  //   面板第一个表情（惊讶）永远是破图。
  const n = String(id === 0 ? 0 : (id || '')).trim()
  if (!/^\d+$/.test(n)) return ''
  return 'https://qzonestyle.gtimg.cn/qzone/em/e' + n + '.gif'
}

export function bytes(n) {
  n = Number(n) || 0
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB'
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB'
  return n + ' B'
}

export function fmtNum(n) {
  n = Number(n) || 0
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万'
  return String(n)
}

/**
 * 把 OneBot 的 segs 归一化成渲染用的结构。
 *
 * 返回 { quote, parts, system }
 *   quote  —— 引用块文本（reply 段的目标摘要由后端补齐，这里只做占位）
 *   parts  —— 顺序排列的行内片段：{t:'text'|'at'|'face'|'unknown', v}
 *   system —— 是否系统消息（撤回墓碑等）
 *
 * ★ 未知类型不丢：落到 {t:'unknown', name}，渲染成"某种消息"占位，
 *   避免"新类型进来就整条消失"。
 */
export function partsOf(m) {
  const segs = Array.isArray(m && m.segs) ? m.segs : []
  const parts = []
  let quote = ''
  let system = false

  for (const s of segs) {
    const t = s && s.type
    const d = (s && s.data) || {}
    if (!t) continue
    if (t === 'reply') {
      quote = d.text || '[引用了一条消息]'
      continue
    }
    switch (t) {
      case 'text':
        if (d.text) parts.push({ t: 'text', v: d.text })
        break
      case 'at':
        parts.push({ t: 'at', v: d.qq === 'all' ? '@全体成员' : '@' + (d.name || d.qq || '某人') })
        break
      case 'face':
        parts.push({ t: 'face', v: d.id })
        break
      case 'markdown':
        parts.push({ t: 'text', v: d.content || '[Markdown 消息]' })
        break
      // 以下类型由 media[] 或专用组件渲染，这里只占位
      case 'image':
      case 'video':
      case 'record':
      case 'file':
      case 'mface':
      case 'json':
      case 'xml':
      case 'forward':
      case 'node':
      case 'location':
      case 'contact':
      case 'music':
      case 'rps':
      case 'dice':
      case 'shake':
      case 'poke':
        break
      default:
        parts.push({ t: 'unknown', name: t })
        break
    }
  }

  // 纯媒体消息：媒体本身会渲染成图片/视频/语音，气泡里不该再塞 "[图片]" 文字
  // （QQ 也不会在图片上方多一行占位）。只有"媒体丢了"时才需要占位提示。
  const media = Array.isArray(m && m.media) ? m.media : []
  if (!parts.length && !media.length && m && m.text) parts.push({ t: 'text', v: m.text })
  // 墓碑
  if (m && m.role === 'system') system = true
  return { quote, parts, system }
}

/** 按 kind 分组媒体，保持出现顺序 */
export function groupMedia(media) {
  const out = { image: [], video: [], record: [], file: [], face: [], other: [] }
  for (const m of (media || [])) {
    if (!m || !m.local) continue
    const k = m.kind === 'mface' ? 'face' : m.kind
    ;(out[k] || out.other).push(m)
  }
  return out
}

/** 图片九宫格列数（QQ 规则：1 张大图、2/4 两列、其余三列） */
export function gridCls(n) {
  if (n <= 1) return 'g1'
  if (n === 2 || n === 4) return 'g2'
  return 'g3'
}

/** 语音气泡宽度随时长变化（QQ 的细节：短语音气泡很短） */
export function voiceWidth(sec) {
  const s = Math.max(1, Math.min(60, Number(sec) || 1))
  return Math.round(96 + s * 3.2)
}

/** 从 media 里猜语音时长（后端暂未存时长，用文件大小粗估） */
export function guessSec(m) {
  const n = Number((m && m.bytes) || 0)
  if (!n) return 2
  return Math.max(1, Math.min(60, Math.round(n / 3000)))
}



/** 合并转发：消息里只有一个 forward id，内容要另问后端展开 */
export function forwardIdOf(m) {
  const segs = Array.isArray(m && m.segs) ? m.segs : []
  for (const s of segs) {
    if (s && s.type === 'forward') {
      const id = (s.data || {}).id
      if (id) return String(id)
    }
  }
  return ''
}
