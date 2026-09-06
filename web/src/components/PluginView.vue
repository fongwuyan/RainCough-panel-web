<script setup>
// PluginView — v4 插件页加载器(接口库)
// 加载插件前端产物 /api/plugins/<name>/assets/plugin.js → window.__rcPluginV4__[name]
// 失败时回退 GenericPlugin 信息卡; 诊断信息在「服务健康」页, 不在本页显示
import { computed, ref, onMounted, onBeforeUnmount, nextTick, onErrorCaptured } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GenericPlugin from './GenericPlugin.vue'

const route = useRoute()
const router = useRouter()
const name = computed(() => String(route.params.name || ''))

const mode = ref('loading')   // loading | plugin | generic
let mountFn = null
const mountEl = ref(null)

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
        const listeners = new Set()
        const ctx = {
          plugin: { name: name.value },
          invoke: async (iface, params, opts) => {
            const r = await fetch('/api/plugins/' + name.value + '/invoke', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ iface, params: params || {}, timeout_ms: (opts && opts.timeoutMs) || 0 }),
            }).then((r) => r.json())
            if (!r.ok) throw new Error((r.rpc_error && r.rpc_error.message) || 'invoke failed')
            return r.result
          },
          on: (ev, cb) => { listeners.add(cb); return () => listeners.delete(cb) },
          emit: (ev, payload) => { listeners.forEach((cb) => { try { cb(payload) } catch (e) {} }) },
          toast: (msg, kind) => { console.log('[plugin:' + name.value + ']', kind || 'info', msg) },
          navigate: (to) => router.push(to),
        }
        mountFn = reg.mount(mountEl.value, ctx)
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