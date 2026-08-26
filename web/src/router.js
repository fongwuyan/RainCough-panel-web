import { createRouter, createWebHashHistory } from 'vue-router'
import Home from './core/Home.vue'
import FileManager from './core/FileManager.vue'
import Terminal from './core/Terminal.vue'
import SystemCenter from './core/SystemCenter.vue'
import Tasks from './core/Tasks.vue'
import PluginView from './plugin/PluginView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'workspace', component: Home },
    { path: '/file', name: 'filemanager', component: FileManager },
    { path: '/terminal', name: 'terminal', component: Terminal },
    { path: '/syscenter', name: 'syscenter', component: SystemCenter },
    { path: '/tasks', name: 'tasks', component: Tasks },
    { path: '/plugin/:name', name: 'plugin', component: PluginView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router