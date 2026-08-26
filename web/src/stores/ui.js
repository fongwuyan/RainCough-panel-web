import { ref } from 'vue'

const installOpen = ref(false)

const THEME_KEY = 'touchgal_theme'

function applyTheme(t) {
  if (t === 'light') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
}

const theme = ref((() => {
  const saved = localStorage.getItem(THEME_KEY)
  const t = saved === 'light' ? 'light' : 'dark'
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
