// 扩展宿主运行时
//
// 系统扩展的产物(extensions/<name>/assets/extension.js)不打包 Vue 与 api,
// 统一从 window.__rcHost 取宿主实例: 体积小、单一 Vue 实例、与主面板同版本。
// 扩展入口约定:
//   window.__rcExt__[name] = { mount(el, ctx) { ... return () => unmount() } }
import * as Vue from 'vue'
import { api } from './api'
import { usePreview } from './stores/preview'

let routerRef = null

// setExtRouter 由 main.js 注入路由实例(扩展内 navigate 用)。
export function setExtRouter(r) { routerRef = r }

// installExtHost 暴露宿主运行时(幂等)。
export function installExtHost() {
  if (window.__rcHost) return window.__rcHost
  window.__rcHost = {
    Vue,
    api,
    usePreview,
    hostVersion: 1,
    router() { return routerRef },
    navigate(to) { if (routerRef) routerRef.push(to) },
    // req 轻量请求: 扩展自己拼路径, 统一错误处理
    async req(method, path, body) {
      const opts = { method }
      if (body !== undefined && body !== null) {
        opts.headers = { 'Content-Type': 'application/json' }
        opts.body = JSON.stringify(body)
      }
      const r = await fetch(path, opts)
      const text = await r.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch (e) { data = { raw: text } }
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      return data
    },
  }
  return window.__rcHost
}
