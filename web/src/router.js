import { createRouter, createWebHashHistory } from 'vue-router'
import Workspace from './components/Workspace.vue'
import PluginView from './components/PluginView.vue'
import Settings from './components/Settings.vue'
import Terminal from './components/terminal/Terminal.vue'
import PluginHub from './components/plugins/PluginHub.vue'
import FmMain from './components/filemanager/FmMain.vue'

// 内置功能共 5 项: 工作台 / 文件管理 / 终端 / 插件 / 设置
// (系统扩展与开发文档页已移除; 面板更新走侧边栏常驻浮窗, 不占路由)
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
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

export default router
