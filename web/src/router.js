import { createRouter, createWebHashHistory } from 'vue-router'
import Workspace from './components/Workspace.vue'
import PluginView from './components/PluginView.vue'
import Settings from './components/Settings.vue'
import PluginDocs from './components/PluginDocs.vue'
import Terminal from './components/terminal/Terminal.vue'
import Logs from './components/logs/Logs.vue'
import Processes from './components/processes/Processes.vue'
import MediaCenter from './components/media/MediaCenter.vue'
import Scheduler from './components/scheduler/Scheduler.vue'
import EnvPkgMain from './components/envpkg/EnvPkgMain.vue'
import TaskQueue from './components/tasks/TaskQueue.vue'
import StorePlugins from './components/store/StorePlugins.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'workspace', component: Workspace },
    { path: '/settings', name: 'settings', component: Settings },
    { path: '/docs', name: 'docs', component: PluginDocs },
    { path: '/terminal', name: 'terminal', component: Terminal },
    { path: '/logs', name: 'logs', component: Logs },
    { path: '/processes', name: 'processes', component: Processes },
    { path: '/media', name: 'media', component: MediaCenter },
    { path: '/scheduler', name: 'scheduler', component: Scheduler },
    { path: '/envpkg', name: 'envpkg', component: EnvPkgMain },
    { path: '/tasks', name: 'tasks', component: TaskQueue },
    { path: '/store', name: 'store', component: StorePlugins },
    { path: '/plugin/:name', name: 'plugin', component: PluginView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
