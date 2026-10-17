import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuth } from './stores/auth'
import './styles/main.css'

// 诊断: 任何未捕获错误写入 title(可用 curl 验证)
window.addEventListener('error', (e) => {
  try {
    const m = String((e && (e.error ? (e.error.stack || e.error.message) : e.message)) || e)
    document.title = 'ERR: ' + m.slice(0, 500)
    if (window.__rcErr) window.__rcErr(m)
  } catch (err) {}
})
window.addEventListener('unhandledrejection', (e) => {
  try {
    const m = String((e && e.reason && (e.reason.stack || e.reason.message)) || e.reason || e)
    document.title = 'REJ: ' + m.slice(0, 500)
    if (window.__rcErr) window.__rcErr(m)
  } catch (err) {}
})

try {
  const app = createApp(App).use(router)
  app.mount('#app')
  document.title = 'OK ' + (document.title || '')

  // 登录态由 router.beforeEach 统一处理(它会 await auth.refresh() 后再判定),
  // 这里只做「预取」: 提前拉一次, 让守卫不必等待网络, 首屏更快。
  // ★ 不要在这里再 router.replace 到 /login —— 那会和守卫叠加,
  //   产生 #/login?next=/login?next=/ 这种 next 参数不断累积的 URL(已踩过)。
  const auth = useAuth()
  auth.refresh().catch(() => {})

  // 全局 401 拦截: 后端中间件是权威, 但前端也兜底, 避免过期 cookie 还能看到陈旧数据
  const origFetch = window.fetch
  window.fetch = function (input, init) {
    return origFetch(input, init).then((res) => {
      if (res.status === 401 && typeof input === 'string' && input.indexOf('/api/') === 0
          && input.indexOf('/api/auth/') !== 0) {
        // API 鉴权失败 → 拉一次 status 决定是否要跳 /login
        auth.refresh().then(() => {
          if (!auth.loggedIn()) {
            const here = location.hash.replace(/^#/, '') || '/'
            // 已经在登录页就不再叠加 next
            if (here.indexOf('/login') === 0) return
            try { router.replace({ path: '/login', query: { next: here } }) } catch (e) {}
          }
        }).catch(() => {})
      }
      return res
    })
  }
} catch (err) {
  document.title = 'MOUNT_FAIL: ' + String((err && err.stack) || err).slice(0, 500)
}