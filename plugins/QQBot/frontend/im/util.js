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


// ---------------------------------------------------------------- QQ 表情
//
// ★ 这里的 id 是**实测**出来的：逐个打 https://qzonestyle.gtimg.cn/qzone/em/e{id}.gif，
//   只保留返回 200 的号段。QQ 的表情 id 并不连续（91–99、210、371–399 是空的），
//   直接把 0..400 全铺出来会出现一片破图。
export const FACE_RANGES = [[0, 90], [100, 209], [211, 370], [400, 410]]

export const FACE_IDS = (() => {
  const out = []
  for (const [a, b] of FACE_RANGES) {
    for (let i = a; i <= b; i++) out.push(i)
  }
  return out
})()

// 经典表情的名字（QQ 桌面端就是这么叫的），只覆盖 0–90；
// 后面的新表情没有公开命名，tooltip 就显示编号，不瞎编。
export const FACE_NAMES = {
  0: '惊讶', 1: '撇嘴', 2: '色', 3: '发呆', 4: '得意', 5: '流泪', 6: '害羞', 7: '闭嘴',
  8: '睡', 9: '大哭', 10: '尴尬', 11: '发怒', 12: '调皮', 13: '呲牙', 14: '微笑',
  15: '难过', 16: '酷', 17: '抓狂', 18: '吐', 19: '偷笑', 20: '可爱', 21: '白眼',
  22: '傲慢', 23: '饥饿', 24: '困', 25: '惊恐', 26: '流汗', 27: '憨笑', 28: '悠闲',
  29: '奋斗', 30: '咒骂', 31: '疑问', 32: '嘘', 33: '晕', 34: '疯了', 35: '衰',
  36: '骷髅', 37: '敲打', 38: '再见', 39: '发抖', 40: '抠鼻', 41: '鼓掌', 42: '糗大了',
  43: '坏笑', 44: '左哼哼', 45: '右哼哼', 46: '哈欠', 47: '鄙视', 48: '委屈',
  49: '快哭了', 50: '左亲亲', 51: '吓', 52: '可怜', 53: '菜刀', 54: '西瓜', 55: '啤酒',
  56: '篮球', 57: '乒乓', 58: '咖啡', 59: '饭', 60: '猪头', 61: '玫瑰', 62: '凋谢',
  63: '吻', 64: '爱心', 65: '心碎', 66: '蛋糕', 67: '闪电', 68: '炸弹', 69: '刀',
  70: '足球', 71: '瓢虫', 72: '便便', 73: '月亮', 74: '太阳', 75: '礼物', 76: '拥抱',
  77: '强', 78: '弱', 79: '握手', 80: '胜利', 81: '抱拳', 82: '勾引', 83: '拳头',
  84: '差劲', 85: '爱你', 86: 'NO', 87: 'OK', 88: '爱情', 89: '飞吻', 90: '磕头',
}

// 最近使用（QQ 桌面端面板顶部也有一栏），存本地
const RECENT_KEY = 'rcq.im.faces'

export function recentFaces() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => FACE_IDS.indexOf(x) >= 0).slice(0, 20) : []
  } catch (e) { return [] }
}

export function pushRecentFace(id) {
  const n = Number(id)
  const cur = recentFaces().filter((x) => x !== n)
  cur.unshift(n)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, 20))) } catch (e) {}
}
