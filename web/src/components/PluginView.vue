<script setup>
// PluginView — 插件页加载器
// 适配: 插件自带独立 Vue3 前端(assets/plugin.js)
//   v3 远程组件: window.__rcPlugin_<name>.mount
//   v4 接口库:   window.__rcPluginV4__[name].mount(ctx.invoke 走 /api/plugins/<name>/invoke)
// 回退: 旧 MAP 组件(面板内置) → GenericPlugin 信息卡
import { computed, ref, h, onMounted, onBeforeUnmount, nextTick, onErrorCaptured } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GenericPlugin from './GenericPlugin.vue'
import LsMain from './laizhangsetu/LsMain.vue'
import TgMain from './touchgal/TgMain.vue'
import JmMain from './jmcomic/JmMain.vue'
import FmMain from './filemanager/FmMain.vue'
import AiMain from './aigen/AIGen.vue'
import UptimeMain from './uptime/UptimeMain.vue'
import DockerMain from './docker/DockerMain.vue'
import McServerMain from './mcserver/McServerMain.vue'
import McSkinMain from './mcskin/McSkinMain.vue'
import KvmMain from './kvm/KvmMain.vue'
import VpnMain from './vpn/VpnMain.vue'

// 面板内置回退组件(插件未提供独立前端时使用)
const MAP = {
  jmcomic: JmMain, laizhangsetu: LsMain, touchgal: TgMain,
  filemanager: FmMain, aigen: AiMain, uptime: UptimeMain,
  docker: DockerMain, mcserver: McServerMain, mcskin: McSkinMain,
  kvm: KvmMain, vpn: VpnMain,
}

const route = useRoute()
const router = useRouter()
const name = computed(() => String(route.params.name || ''))

// 插件独立前端状态
const mode = ref('loading')   // loading | plugin(独立前端) | map(内置回退) | generic
let mountFn = null            // 卸载函数(插件 mount 返回)
const mountEl = ref(null)     // 模板 ref(必须 ref() 声明, script setup 模板 ref 才会绑定)

const isMapFallback = computed(() => mode.value === 'map')
const comp = computed(() => MAP[name.value.toLowerCase()] || GenericPlugin)

async function loadPluginFrontend() {
  mode.value = 'loading'
  mountFn = null
  // ---- 浏览器适配: 三保险加载插件独立前端 ----
  // ①new Function 全局执行(fetch+eval, 产物是 IIFE, register(window) 必写全局)
  // ②<script> 标签加载 ③默认(异常→诊断)
  const readReg = (n) => {
    const pick = (regMap) => {
      if (!regMap) return null
      let reg = regMap[n] || regMap[n.toLowerCase()]
      if (!reg) {
        for (const k in regMap) {
          if (k.toLowerCase() === n.toLowerCase()) { reg = regMap[k]; break }
        }
      }
      return (reg && typeof reg.mount === 'function') ? reg : null
    }
    // v4 接口库注册优先, v3 远程组件兜底
    return pick(window.__rcPluginV4__) || pick(window.__rcPlugin_)
  }
  const loadFetch = async (n) => {
    const url = '/api/plugins/' + n + '/assets/plugin.js'
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url)
    const code = await r.text()
    if (!code || code.length < 200) throw new Error('产物为空或异常(' + code.length + 'B)')
    // 全局作用域执行 IIFE(浏览器适配核心)
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
      // fetch 执行成功但未注册 → 换 script 再试
      const reg2 = await loadScriptEl(n)
      if (reg2) return reg2
      return null
    } catch (e) {
      // fetch 失败(如 404=无独立前端) → script 兜底
      try {
        const reg = await loadScriptEl(n)
        if (reg) return reg
      } catch (e2) { throw new Error((e && e.message) || String(e)) }
      throw e
    }
  }
  let firstErr = ''
  let notRegistered = false
  let firstDiag = ''
  try {
    // 先按原始名(JMComic), 失败按小写(jmcomic) — 网关资产大小写敏感
    let reg = null
    try {
      reg = await tryLoad(name.value)
      if (!reg && !window.__rcPlugin_) notRegistered = true
    } catch (e) { firstErr = String((e && e.message) || e) }
    if (!reg && name.value.toLowerCase() !== name.value) {
      try { reg = await tryLoad(name.value.toLowerCase()) } catch (e) {}
    }
    // import 成功但注册键缺失 → 资产缺陷(需诊断产物)
    if (!reg && !firstErr && window.__rcPlugin_) {
      notRegistered = true
      firstErr = '资产已加载但未注册(keys=' + Object.keys(window.__rcPlugin_).join(',') + ')'
    }
    if (reg) {
      mode.value = 'plugin'
      await nextTick()
      if (mountEl.value) {
        // ctx: v3 提供 api 请求器; v4 提供 invoke(on/emit/toast/navigate)
        // Vue 已内联在插件产物中, 不注入运行时
        try {
          const listeners = new Set()
          const ctx = {
            plugin: { name: name.value },
            api: {
              get: (p) => fetch('/api/plugins/' + name.value + p).then((r) => r.json()),
              post: (p, body) => fetch('/api/plugins/' + name.value + p, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
              }).then((r) => r.json()),
            },
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
  } catch (e) {
    if (!firstErr) firstErr = String((e && e.message) || e)
  }
  // 回退: 有内置组件(MAP)则静默回退(无独立前端是正常情况);
  // 诊断信息不发到插件页头部, 归位于「服务健康」页对应插件行(console 保留一份)
  firstDiag = 'err=' + (firstErr || '-') + ' regKeys=' + (window.__rcPlugin_ ? Object.keys(window.__rcPlugin_).join(',') : 'none') + ' v4keys=' + (window.__rcPluginV4__ ? Object.keys(window.__rcPluginV4__).join(',') : 'none')
  if (firstErr || notRegistered) {
    console.warn('[plugin:' + name.value + '] 前端加载诊断:', firstDiag)
  }
  mode.value = MAP[name.value.toLowerCase()] ? 'map' : 'generic'
}

onMounted(loadPluginFrontend)
onBeforeUnmount(() => { if (typeof mountFn === 'function') { try { mountFn() } catch (e) {} } })

onErrorCaptured((e) => { console.warn('[plugin:' + name.value + '] 渲染异常:', (e && (e.message || e)) || e) })
</script>

<template>
  <div>
    <!-- 插件独立前端挂载区(诊断信息见「服务健康」页, 不在插件页头部展示) -->
    <div v-if="mode === 'plugin'" ref="mountEl" class="plugin-mount"></div>
    <div v-else-if="mode === 'loading'" class="hint" style="padding:20px;">加载插件前端...</div>

    <!-- 回退: 内置组件 / 信息卡 -->
    <component v-else :is="comp" :key="name" />
  </div>
</template>

<style scoped>
.plugin-mount { min-height: 200px; }
</style>