<script setup>
// PluginView — v4 插件页加载器(接口库)
// 加载插件前端产物 /api/plugins/<name>/assets/plugin.js → window.__rcPluginV4__[name]
// 失败时回退 GenericPlugin 信息卡; 诊断信息在「服务健康」页, 不在本页显示
import { computed, ref, onMounted, onBeforeUnmount, nextTick, onErrorCaptured, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GenericPlugin from './GenericPlugin.vue'
import { useUi } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const ui = useUi()
const name = computed(() => String(route.params.name || ''))

const mode = ref('loading')   // loading | plugin | generic
let mountFn = null
let pluginBus = null
const mountEl = ref(null)

// 主题变化: 先更新挂载点属性(纯 CSS 主题的插件靠它), 再广播给插件前端(需要重绘的)
watch(() => [ui.theme.value, mountEl.value], () => {
  const el = mountEl.value
  if (!el || !el.getAttribute) return
  el.setAttribute('data-theme', ui.theme.value)
  el.setAttribute('data-scheme', ui.scheme.value)
  if (pluginBus) pluginBus.emit('theme', { theme: ui.theme.value, scheme: ui.scheme.value })
})

const comp = computed(() => GenericPlugin)

async function loadPluginFrontend() {
  mode.value = 'loading'
  mountFn = null

  const readReg = (n) => {
    const regMap = window.__rcPluginV4__
    if (!regMap) return null
    let reg = regMap[n] || regMap[n.toLowerCase()]
    if (!reg) {
      for (const k in regMap) {
        if (k.toLowerCase() === n.toLowerCase()) { reg = regMap[k]; break }
      }
    }
    return (reg && typeof reg.mount === 'function') ? reg : null
  }
  const loadFetch = async (n) => {
    const url = '/api/plugins/' + n + '/assets/plugin.js'
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url)
    const code = await r.text()
    if (!code || code.length < 200) throw new Error('产物为空或异常(' + code.length + 'B)')
    ;(0, eval)(code)
    return readReg(n)
  }
  const loadScriptEl = (n) => new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = '/api/plugins/' + n + '/assets/plugin.js'
    s.onload = () => resolve(readReg(n))
    s.onerror = () => reject(new Error('脚本加载失败: ' + s.src))
    document.head.appendChild(s)
  })
  const tryLoad = async (n) => {
    try {
      const reg = await loadFetch(n)
      if (reg) return reg
    } catch (e) {
      try { return await loadScriptEl(n) } catch (e2) { throw new Error((e && e.message) || String(e)) }
    }
    return null
  }

  let reg = null
  let firstErr = ''
  try {
    try { reg = await tryLoad(name.value) } catch (e) { firstErr = String((e && e.message) || e) }
    if (!reg && name.value.toLowerCase() !== name.value) {
      try { reg = await tryLoad(name.value.toLowerCase()) } catch (e) {}
    }
  } catch (e) {
    if (!firstErr) firstErr = String((e && e.message) || e)
  }

  if (reg) {
    mode.value = 'plugin'
    await nextTick()
    if (mountEl.value) {
      try {
        // 事件总线: 主题切换要能通知到插件(ctx.on('theme')), 不能只靠 CSS
        const bus = new Map()
        const on = (ev, cb) => {
          if (!bus.has(ev)) bus.set(ev, new Set())
          bus.get(ev).add(cb)
          return () => { const s = bus.get(ev); if (s) s.delete(cb) }
        }
        const emit = (ev, payload) => {
          const s = bus.get(ev)
          if (s) s.forEach((cb) => { try { cb(payload) } catch (e) {} })
        }
        const ctx = {
          plugin: { name: name.value },
          // 当前主题: 用 getter, 切主题后插件读到的就是新值
          get theme() { return ui.theme.value },
          get scheme() { return ui.scheme.value },
          // 供插件自己写主题相关 CSS: [data-theme="yuluo"] .your-class
          get themeAttr() { return ui.theme.value },
          invoke: async (iface, params, opts) => {
            const r = await fetch('/api/plugins/' + name.value + '/invoke', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ iface, params: params || {}, timeout_ms: (opts && opts.timeoutMs) || 0 }),
            }).then((r) => r.json())
            if (!r.ok) throw new Error((r.rpc_error && r.rpc_error.message) || 'invoke failed')
            return r.result
          },
          on,
          emit,
          toast: (msg, kind) => { ui.toast(msg, kind); console.log('[plugin:' + name.value + ']', kind || 'info', msg) },
          navigate: (to) => router.push(to),
        }
        // 把主题写在插件挂载点上, 插件内部可直接用 [data-theme=...] 选择器
        mountEl.value.setAttribute('data-plugin', name.value)
        mountEl.value.setAttribute('data-theme', ui.theme.value)
        mountEl.value.setAttribute('data-scheme', ui.scheme.value)
        mountFn = reg.mount(mountEl.value, ctx)
        pluginBus = { emit }
      } catch (e) {
        console.warn('[plugin:' + name.value + '] 挂载失败:', (e && e.message) || e)
      }
    }
    return
  }
  if (firstErr) console.warn('[plugin:' + name.value + '] 前端加载诊断:', firstErr)
  mode.value = 'generic'
}

onMounted(loadPluginFrontend)
onBeforeUnmount(() => { if (typeof mountFn === 'function') { try { mountFn() } catch (e) {} } })
onErrorCaptured((e) => { console.warn('[plugin:' + name.value + '] 渲染异常:', (e && (e.message || e)) || e) })
</script>

<template>
  <div>
    <div v-if="mode === 'plugin'" ref="mountEl" class="plugin-mount"></div>
    <div v-else-if="mode === 'loading'" class="hint" style="padding:20px;">加载插件前端...</div>
    <component v-else :is="comp" :key="name" />
  </div>
</template>

<style scoped>
.plugin-mount { min-height: 200px; }
</style>