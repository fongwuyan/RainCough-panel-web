/**
 * RainCough 插件前端共用库 (@raincough/plugin-vue, 展示层专用)
 *
 * 契约(interface_version=1):
 *   - 插件前端产物 = 单文件 plugin.js, 导出 register(g) 或 default 对象
 *   - 产物约定: window.__rcPluginV4__[name] = { pages, mount(el, ctx) }
 *   - ctx 由主系统壳注入: { plugin, invoke, on, emit, toast, navigate }
 *
 * 本文件仅为 SDK 帮助函数; 真实渲染容器/ctx 由主系统 PluginShell.vue 提供。
 */
(function (global) {
  'use strict'

  // 向主系统壳登记插件页面(壳加载产物后调用)
  function definePlugin(def) {
    return def
  }

  // 构造注入给插件页的 ctx(壳侧使用)
  function createCtx(plugin, api) {
    return {
      plugin,
      invoke: function (iface, params, opts) {
        return (opts && opts.timeoutMs
          ? api.invokeTimeout(iface, params, opts.timeoutMs)
          : api.invoke(iface, params))
      },
      on: function (event, cb) {
        return api.on(event, cb)
      },
      emit: function (event, payload) {
        return api.emit(event, payload)
      },
      toast: function (msg, kind) {
        return api.toast(msg, kind)
      },
      navigate: function (to) {
        return api.navigate(to)
      },
    }
  }

  // 默认 mount 帮助: 把已扣好的 Vue 应用挂到容器(pages 渲染由插件自行实现)
  function registerGlobal(name, entry) {
    global.__rcPluginV4__ = global.__rcPluginV4__ || {}
    global.__rcPluginV4__[name] = entry
    return global.__rcPluginV4__[name]
  }

  global.RainCoughPlugin = {
    definePlugin,
    createCtx,
    registerGlobal,
  }
})(typeof window !== 'undefined' ? window : globalThis)

export const definePlugin = definePlugin
export const createCtx = createCtx
export const registerGlobal = registerGlobal