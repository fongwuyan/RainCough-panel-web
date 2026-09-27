import { createRouter, createWebHashHistory } from 'vue-router'
import Workspace from './components/Workspace.vue'
import PluginView from './components/PluginView.vue'
import Settings from './components/Settings.vue'
import PluginDocs from './components/PluginDocs.vue'
import Terminal from './components/terminal/Terminal.vue'
import MediaCenter from './components/media/MediaCenter.vue'
import Scheduler from './components/scheduler/Scheduler.vue'
import TaskQueue from './components/tasks/TaskQueue.vue'
import SysFuncMain from './components/sysfunc/SysFuncMain.vue'
import StorePlugins from './components/store/StorePlugins.vue'
import FmMain from './components/filemanager/FmMain.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'workspace', component: Workspace },
    { path: '/fm', name: 'fm', component: FmMain }, // 文件管理(系统功能一级页)
    { path: '/settings', name: 'settings', component: Settings },
    { path: '/docs', name: 'docs', component: PluginDocs },
    { path: '/terminal', name: 'terminal', component: Terminal },
    { path: '/media', name: 'media', component: MediaCenter },
    { path: '/scheduler', name: 'scheduler', component: Scheduler },
    { path: '/tasks', name: 'tasks', component: TaskQueue },
    { path: '/sysfunc', name: 'sysfunc', component: SysFuncMain },
    { path: '/sysfunc/:sub', name: 'sysfunc-sub', component: SysFuncMain },
    { path: '/store', name: 'store', component: StorePlugins },
    { path: '/plugin/:name', name: 'plugin', component: PluginView },
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
