// 调度器 · 系统扩展入口
// 页面组件整文件来自主面板 web/src/components/scheduler/Scheduler.vue(仅把 api 导入改为 rc-api)
import Vue from 'vue'
import Scheduler from './Scheduler.vue'

window.__rcExt__ = window.__rcExt__ || {}
window.__rcExt__.scheduler = {
  mount: function (el) {
    var app = Vue.createApp(Scheduler)
    app.mount(el)
    return function () { try { app.unmount() } catch (e) {} }
  },
}
