import { createRouter, createWebHashHistory } from 'vue-router'
import Workspace from './components/Workspace.vue'
import PluginView from './components/PluginView.vue'
import Settings from './components/Settings.vue'
import PluginDocs from './components/PluginDocs.vue'
import Terminal from './components/terminal/Terminal.vue'
import SysFuncMain from './components/sysfunc/SysFuncMain.vue'
import PluginHub from './components/plugins/PluginHub.vue'
import ExtHub from './components/ext/ExtHub.vue'
import ExtView from './components/ext/ExtView.vue'
import FmMain from './components/filemanager/FmMain.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // ---- 内置功能(随面板主体安装, 共 7 项) ----
    { path: '/', name: 'workspace', component: Workspace },
    { path: '/fm', name: 'fm', component: FmMain }, // 文件管理
    { path: '/terminal', name: 'terminal', component: Terminal },
    { path: '/ext', name: 'ext', component: ExtHub }, // 系统扩展(扩展安装与管理)
    { path: '/plugins', name: 'plugins', component: PluginHub }, // 插件: 管理 + 市场
    { path: '/settings', name: 'settings', component: Settings },
    { path: '/docs', name: 'docs', component: PluginDocs },
    // 系统扩展运行位(扩展产物由 /api/ext/<name>/assets/extension.js 提供)
    { path: '/ext/:name', name: 'ext-view', component: ExtView },
    { path: '/plugin/:name', name: 'plugin', component: PluginView },
    // ---- 待迁移为扩展的功能(暂仍在主体内) ----
    { path: '/sysfunc', name: 'sysfunc', component: SysFuncMain },
    { path: '/sysfunc/:sub', name: 'sysfunc-sub', component: SysFuncMain },
    // ---- 已迁为系统扩展的旧路径(保留书签/收藏夹可用) ----
    { path: '/media', redirect: '/ext/media' },       // 媒体中心
    { path: '/tasks', redirect: '/ext/tasks' },       // 任务队列
    { path: '/scheduler', redirect: '/ext/scheduler' }, // 调度器
    // 旧市场深链 -> 新插件页(保留书签/收藏夹可用)
    { path: '/store', redirect: '/plugins' },
    // 已融合页面的旧深链 -> 系统中心子页(保留书签/收藏夹可用)
    { path: '/logs', redirect: '/sysfunc/logs' },
    { path: '/processes', redirect: '/sysfunc/processes' },
    { path: '/envpkg', redirect: '/sysfunc/env' },
    { path: '/plughealth', redirect: '/sysfunc/sh' },
    { path: '/ifaces', redirect: '/sysfunc/ifa' },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
