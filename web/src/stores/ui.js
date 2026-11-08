import { ref, computed } from 'vue'

const installOpen = ref(false)

const THEME_KEY = 'rc_theme'

// 主题注册表: 面板与插件共用的唯一来源。
//
// 约定:
//   · id      —— 写进 <html data-theme="...">, 也是 localStorage 里存的值(light 不写属性)
//   · scheme  —— 只表达"亮/暗"这一层语义, 给 xterm 配色、color-scheme 这类只能用二值的场景
//   · 新增主题时只加一条, 再去 main.css 加对应 [data-theme="<id>"] 变量块即可,
//     不需要改 Settings / 终端 / 插件页。
export const THEMES = [
  { id: 'light', label: '浅色', scheme: 'light', note: '默认 · 现代浅色' },
  { id: 'dark', label: '深色', scheme: 'dark', note: '低亮度环境' },
  { id: 'yuluo', label: '雨咯主题', scheme: 'dark', note: '毛玻璃 · 半透明 · 水蓝' },
]

export function themeMeta(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

function applyTheme(id) {
  const meta = themeMeta(id)
  const el = document.documentElement
  // light 是默认主题, 不挂属性 —— 保持和旧版本(只认 dark)的 CSS 兼容
  if (meta.id === 'light') delete el.dataset.theme
  else el.dataset.theme = meta.id
  // scheme 总是写上, 让终端/原生控件有稳定的二值依据
  el.dataset.scheme = meta.scheme
  el.style.colorScheme = meta.scheme
}

const theme = ref((() => {
  let saved = null
  try { saved = localStorage.getItem(THEME_KEY) } catch (e) { /* 隐私模式下会抛 */ }
  const t = THEMES.some((x) => x.id === saved) ? saved : 'light'
  applyTheme(t)
  return t
})())

const scheme = computed(() => themeMeta(theme.value).scheme)
const themeInfo = computed(() => themeMeta(theme.value))

function setTheme(id) {
  const meta = themeMeta(id)
  theme.value = meta.id
  try { localStorage.setItem(THEME_KEY, meta.id) } catch (e) { /* 存不下也不影响本次 */ }
  applyTheme(meta.id)
  // 广播给插件前端: 插件页是同一个 document, 但它的样式/画布可能缓存了配色。
  try {
    window.dispatchEvent(new CustomEvent('rc:theme', { detail: { theme: meta.id, scheme: meta.scheme } }))
  } catch (e) { /* 老浏览器没有 CustomEvent 就算了 */ }
}

// ---- 侧栏隐藏 + 悬浮球 ----
// 侧栏收起后，用内容区的球把它叫回来；球本身可拖、可换图标、可隐藏。
const SIDEBAR_KEY = 'rc_sidebar_hidden'
const BALL_KEY = 'rc_ball'

const sidebarHidden = ref(localStorage.getItem(SIDEBAR_KEY) === '1')

function setSidebarHidden(v) {
  sidebarHidden.value = !!v
  try { localStorage.setItem(SIDEBAR_KEY, sidebarHidden.value ? '1' : '0') } catch (e) { /* 忽略 */ }
}

const BALL_DEFAULT = { x: null, y: null, icon: '', tone: 'black', on: true }

function loadBall() {
  try {
    const saved = JSON.parse(localStorage.getItem(BALL_KEY) || '{}')
    return Object.assign({}, BALL_DEFAULT, saved || {})
  } catch (e) {
    return Object.assign({}, BALL_DEFAULT)
  }
}

const ball = ref(loadBall())

function setBall(patch) {
  ball.value = Object.assign({}, ball.value, patch || {})
  try { localStorage.setItem(BALL_KEY, JSON.stringify(ball.value)) } catch (e) { /* 图标太大就存不下 */ }
}

// ---- 雨咯主题壁纸 ----
// 玻璃本身不带颜色, 背景完全交给用户上传的图片(仅存本浏览器, 不上传服务器)。
// 存 localStorage: 先在 canvas 里压到 1920px/JPEG, 正常照片 300–700KB, 不会撑爆配额。
const BG_KEY = 'rc_theme_bg'

function loadBg() {
  try { return localStorage.getItem(BG_KEY) || '' } catch (e) { return '' }
}

const bgImage = ref(loadBg())

function applyWallpaper(v) {
  const el = document.documentElement
  if (v) el.style.setProperty('--rc-wallpaper', 'url("' + v + '")')
  else el.style.removeProperty('--rc-wallpaper')
}
applyWallpaper(bgImage.value)

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片解码失败, 换一张试试')) }
    img.src = url
  })
}

function encodeImage(img, maxSide, quality) {
  const w0 = img.naturalWidth || img.width
  const h0 = img.naturalHeight || img.height
  const scale = Math.min(1, maxSide / Math.max(w0, h0))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w0 * scale))
  canvas.height = Math.max(1, Math.round(h0 * scale))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

async function setWallpaper(file) {
  if (!file) throw new Error('没有选择图片')
  if (file.type && !/^image\//.test(file.type)) throw new Error('请选择图片文件（JPG / PNG / WebP）')
  const img = await readImageFile(file)
  // 第一次 1920px/q0.85；仍然太大就退到 1500px/q0.72
  let data = encodeImage(img, 1920, 0.85)
  if (data.length > 3.2e6) data = encodeImage(img, 1500, 0.72)
  if (data.length > 4.2e6) throw new Error('图片压完仍然太大，请换一张更小的')
  try {
    localStorage.setItem(BG_KEY, data)
  } catch (e) {
    throw new Error('浏览器存储空间不足，图片存不下（可换张小一点的）')
  }
  bgImage.value = data
  applyWallpaper(data)
  // 背景图是雨咯主题的一部分, 上传后直接切过去, 避免"传了没反应"
  if (theme.value !== 'yuluo') setTheme('yuluo')
  return { bytes: data.length, width: img.naturalWidth, height: img.naturalHeight }
}

function clearWallpaper() {
  try { localStorage.removeItem(BG_KEY) } catch (e) { /* 忽略 */ }
  bgImage.value = ''
  applyWallpaper('')
}

// ---- 雨咯主题: 侧栏选项卡 / 内容区(除背景) 的底色 ----
// 两组都是"调色盘选色 + 1–100% 不透明度"。1% ≈ 纯透明看背景图, 100% = 实底。
// 内容区那一层铺在 .content 上(卡片不再是各自铺色), 背景图不参与, 所以叫"除背景"。
const SIDE_ALPHA_KEY = 'rc_side_alpha'
const SIDE_COLOR_KEY = 'rc_side_color'
const CONTENT_ALPHA_KEY = 'rc_content_alpha'
const CONTENT_COLOR_KEY = 'rc_content_color'
const DEFAULT_TINT = '#080a0d'

function clampPct(v) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return 1
  return Math.min(100, Math.max(1, n))
}

function normColor(v) {
  return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : DEFAULT_TINT
}

function loadPct(keys) {
  try {
    for (const k of [].concat(keys)) {
      const v = localStorage.getItem(k)
      if (v != null && v !== '') return clampPct(v)
    }
    return 1
  } catch (e) { return 1 }
}

function loadColor(key) {
  try { return normColor(localStorage.getItem(key)) } catch (e) { return DEFAULT_TINT }
}

function hexToRgb(hex) {
  const h = normColor(hex).replace('#', '')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', ')
}

const sideAlpha = ref(loadPct(SIDE_ALPHA_KEY))
const sideColor = ref(loadColor(SIDE_COLOR_KEY))
// 兼容旧版"卡片不透明度"的键, 用户不需要重新调
const contentAlpha = ref(loadPct([CONTENT_ALPHA_KEY, 'rc_card_alpha']))
const contentColor = ref(loadColor(CONTENT_COLOR_KEY))

function applyTints() {
  const el = document.documentElement
  el.style.setProperty('--rc-side-alpha', (sideAlpha.value / 100).toFixed(3))
  el.style.setProperty('--rc-side-rgb', hexToRgb(sideColor.value))
  el.style.setProperty('--rc-content-alpha', (contentAlpha.value / 100).toFixed(3))
  el.style.setProperty('--rc-content-rgb', hexToRgb(contentColor.value))
}
applyTints()

function setSideAlpha(v) {
  sideAlpha.value = clampPct(v)
  try { localStorage.setItem(SIDE_ALPHA_KEY, String(sideAlpha.value)) } catch (e) { /* 忽略 */ }
  applyTints()
}

function setSideColor(v) {
  sideColor.value = normColor(v)
  try { localStorage.setItem(SIDE_COLOR_KEY, sideColor.value) } catch (e) { /* 忽略 */ }
  applyTints()
}

function setContentAlpha(v) {
  contentAlpha.value = clampPct(v)
  try { localStorage.setItem(CONTENT_ALPHA_KEY, String(contentAlpha.value)) } catch (e) { /* 忽略 */ }
  applyTints()
}

function setContentColor(v) {
  contentColor.value = normColor(v)
  try { localStorage.setItem(CONTENT_COLOR_KEY, contentColor.value) } catch (e) { /* 忽略 */ }
  applyTints()
}

// ---- 轻量 toast ----
// 插件 ctx.toast 以前只 console.log, 用户看不到任何反馈; 面板自己的操作也需要统一提示。
const toasts = ref([])
let toastSeq = 0

function toast(msg, kind) {
  if (msg == null || msg === '') return
  const id = ++toastSeq
  toasts.value.push({ id, msg: String(msg).slice(0, 400), kind: kind || 'info' })
  setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id) }, 3600)
}

function dismissToast(id) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useUi() {
  return {
    installOpen, theme, scheme, themeInfo, themes: THEMES, setTheme,
    sidebarHidden, setSidebarHidden, ball, setBall,
    bgImage, setWallpaper, clearWallpaper,
    sideAlpha, sideColor, setSideAlpha, setSideColor,
    contentAlpha, contentColor, setContentAlpha, setContentColor,
    toasts, toast, dismissToast,
  }
}
