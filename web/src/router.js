import { createRouter, createWebHashHistory } from 'vue-router'
import Home from './core/Home.vue'
import PluginView from './plugin/PluginView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/plugin/:name', name: 'plugin', component: PluginView },
    // 预留(M4 展开): /terminal /sysfunc /store /tasks ...
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router