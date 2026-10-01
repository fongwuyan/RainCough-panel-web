// 「驱动」扩展前端入口
//
// 约定(const 见 web/src/ext-host.js): 产物不打包 Vue/api, 统一从 window.__rcHost 取。
//   window.__rcExt__.drivers = { mount(el, ctx) { ... return unmount } }
import { createApp } from 'vue'
import App from './App.vue'

window.__rcExt__ = window.__rcExt__ || {}
window.__rcExt__.drivers = {
  mount(el, ctx) {
    const app = createApp(App, { ctx })
    app.mount(el)
    return () => app.unmount()
  },
}
