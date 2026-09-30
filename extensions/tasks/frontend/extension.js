// 任务队列 · 系统扩展入口
// 页面组件整文件来自主面板 web/src/components/tasks/TaskQueue.vue(仅把 api 导入改为 rc-api)
import Vue from 'vue'
import TaskQueue from './TaskQueue.vue'

window.__rcExt__ = window.__rcExt__ || {}
window.__rcExt__.tasks = {
  mount: function (el) {
    var app = Vue.createApp(TaskQueue)
    app.mount(el)
    return function () { try { app.unmount() } catch (e) {} }
  },
}
