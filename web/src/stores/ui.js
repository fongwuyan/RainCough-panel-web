import { ref } from 'vue'

const installOpen = ref(false)

const THEME_KEY = 'rc_theme'

function applyTheme(t) {
  if (t === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
}

const theme = ref((() => {
  const saved = localStorage.getItem(THEME_KEY)
  const t = saved === 'dark' ? 'dark' : 'light'
  applyTheme(t)
  return t
})())

function setTheme(t) {
  theme.value = t
  localStorage.setItem(THEME_KEY, t)
  applyTheme(t)
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

export function useUi() {
  return { installOpen, theme, setTheme, sidebarHidden, setSidebarHidden, ball, setBall }
}