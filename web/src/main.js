import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import { installExtHost, setExtRouter } from './ext-host'

// 系统扩展宿主: 先暴露运行时再挂载主应用(扩展产物从这里取 Vue/api)
installExtHost()
setExtRouter(router)

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
  createApp(App).use(router).mount('#app')
  document.title = 'OK ' + (document.title || '')
} catch (err) {
  document.title = 'MOUNT_FAIL: ' + String((err && err.stack) || err).slice(0, 500)
}
