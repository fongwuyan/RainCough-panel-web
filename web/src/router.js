import { createRouter, createWebHashHistory } from 'vue-router'
import Workspace from './components/workspace/Workspace.vue'
import PluginView from './components/PluginView.vue'
import Settings from './components/settings/Settings.vue'
import Terminal from './components/terminal/Terminal.vue'
import PluginHub from './components/plugins/PluginHub.vue'
import FmMain from './components/filemanager/FmMain.vue'
import Login from './views/Login.vue'

// 内置功能共 5 项: 工作台 / 文件管理 / 终端 / 插件 / 设置
// (系统扩展与开发文档页已移除; 面板更新走侧边栏常驻浮窗, 不占路由)
//
// /login 是公开路由, 不受鉴权守卫拦截; 其它所有路由默认要求已登录。
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login, meta: { public: true } },
    { path: '/', name: 'workspace', component: Workspace },
    { path: '/fm', name: 'fm', component: FmMain },
    { path: '/terminal', name: 'terminal', component: Terminal },
    { path: '/plugins', name: 'plugins', component: PluginHub },
    { path: '/settings', name: 'settings', component: Settings },
    // 插件运行位(前端产物由 /api/plugins/<name>/assets/plugin.js 提供)
    { path: '/plugin/:name', name: 'plugin', component: PluginView },
    // 旧链接兜底: 已移除的页面统一回工作台
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// 全局鉴权守卫: 任何非 public 路由进入前确认登录; 未登录则带 next 跳到 /login。
// 后端中间件是权威(每个 API 401 都会触发), 这里是 UX 加速, 避免无谓渲染。
import { useAuth } from './stores/auth'

// 启动期拉一次 authStatus; router.beforeEach 用同步的 auth.status,
// 但 status.value 在 main.js 启动后由 auth.refresh() 填充(见 main.js)。
router.beforeEach(async (to, from) => {
  const auth = useAuth()
  if (!auth.status.value) {
    await auth.refresh()
  }
  if (to.meta && to.meta.public) {
    // 已登录还去 /login → 直接去工作台(避免登录后回退又看到登录页)
    if (to.name === 'login' && auth.loggedIn()) return { path: '/' }
    return true
  }
  if (auth.loggedIn()) return true
  return { path: '/login', query: { next: to.fullPath } }
})

export default router