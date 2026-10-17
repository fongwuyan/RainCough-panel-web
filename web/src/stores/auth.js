import { ref } from 'vue'
import { api } from '../api'

// 登录状态 store(单例): 任何页面 import { useAuth } 拿到同一份反应式状态
//   · loggedIn / user / method / expiresAt: 当前登录信息
//   · canSSHPassword / hasAdminPW: 哪些登录方式可用(给登录页提示)
//   · loading: 启动时拉 status 时为 true(防止一闪而过 /login)
//
// 401 拦截: 全局 fetch 拦截器在 api.js 外设置(见 main.js); 这里只负责状态缓存。
const status = ref(null)        // null=未拉过, 其它={logged_in, user, method, expires_at, ...}
const loading = ref(true)        // 启动期=true, 首次拉完=false

async function refresh() {
  loading.value = true
  try {
    status.value = await api.authStatus()
  } catch (e) {
    status.value = { logged_in: false }
  } finally {
    loading.value = false
  }
}

async function login(password) {
  // 故意让后端 500ms 防爆破时间在 UI 上体现为转圈, 不让用户瞬间看到「失败」
  const res = await api.authLogin(password)
  await refresh()
  return res
}

async function logout() {
  try { await api.authLogout() } catch (e) { /* 即便后端失败, 也要清本地状态 */ }
  await refresh()
}

function isAuthed() {
  return !!(status.value && status.value.logged_in)
}

export function useAuth() {
  // 懒触发首次拉: 由 main.js 在 createApp 后显式调一次, 这里不立即拉,
  // 避免每个组件 import 都触发一次 fetch
  return {
    status,
    loading,
    loggedIn: isAuthed,
    refresh,
    login,
    logout,
  }
}