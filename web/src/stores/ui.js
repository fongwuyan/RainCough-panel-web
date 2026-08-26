import { ref } from 'vue'

const installOpen = ref(false)

// 主题命名空间统一: rc_theme(清理 touchgal_theme 残留)
// 默认浅色模式; 用户选择深色后持久化
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

export function useUi() {
  return { installOpen, theme, setTheme }
}