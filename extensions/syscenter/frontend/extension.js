// 系统中心 · 系统扩展入口
// 页面组件整文件来自主面板 components/sysfunc/SysFuncMain.vue 及其子组件
// (Logs/BackupMain/Processes/ServiceHealth/EnvPkgMain/Ifaces), 仅把 api 导入改为 rc-api、
// 兄弟组件导入改为同目录, 并把路由参数改为扩展内初始子页(#/ext/syscenter?sub=xxx)。
import Vue from 'vue'
import SysFuncMain from './SysFuncMain.vue'

window.__rcExt__ = window.__rcExt__ || {}
window.__rcExt__.syscenter = {
  mount: function (el) {
    var app = Vue.createApp(SysFuncMain)
    app.mount(el)
    return function () { try { app.unmount() } catch (e) {} }
  },
}
