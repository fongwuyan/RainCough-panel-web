<script setup>
// PluginView v2 — 远程组件挂载加载器。
// 加载顺序:
//   1. 本地内置组件映射(渐进迁移期保留少量核心; 最终清空)
//   2. 插件构建产物 /api/plugins/<name>/assets/<entry>.js 动态 import
//   3. 兜底: 无前端时显示插件元信息卡(GenericPlugin)
// 插件前端导出约定: export const __raincoughPlugin = { routes, install } 或 default 组件
import { ref, computed, watch, onErrorCaptured, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { pluginsApi } from '../api/plugins'

// 内置组件映射(仅在迁移期保留; M4 完成后删除, 全部走远程加载)
const BUILTIN = {}

const route = useRoute()
const name = computed(() => String(route.params.name || ''))
const state = ref({ phase: 'loading', error: '', comp: null, info: null })

async function load() {
  state.value = { phase: 'loading', error: '', comp: null, info: null }
  try {
    const info = await pluginsApi.info(name.value)
    state.value.info = info

    // 1) 内置组件
    if (BUILTIN[name.value]) {
      state.value.comp = BUILTIN[name.value]
      state.value.phase = 'ready'
      return
    }

    // 2) 插件自带前端(远程组件挂载)
    const entry = info && info.assets && info.assets.entry
    if (entry) {
      const mod = await import(/* @vite-ignore */ pluginsApi.assetUrl(name.value, entry))
      const exported = mod.__raincoughPlugin || mod.default
      if (exported && typeof exported === 'object' && exported.install) {
        // 插件前端契约: install(ctx) 返回组件; ctx = { plugin, api }
        const ctx = { plugin: name.value, api: pluginsApi }
        const comp = await exported.install(ctx)
        state.value.comp = ensureComp(comp)
        state.value.phase = 'ready'
        return
      }
      const comp = ensureComp(exported)
      if (comp) {
        state.value.comp = comp
        state.value.phase = 'ready'
        return
      }
    }

    // 3) 兜底: 元信息卡
    state.value.phase = 'fallback'
  } catch (e) {
    state.value.phase = 'error'
    state.value.error = String((e && (e.message || e)) || e)
  }
}

function ensureComp(c) {
  if (!c) return null
  if (typeof c === 'function' || typeof c === 'object') {
    return defineAsyncComponent(() => Promise.resolve(c))
  }
  return null
}

watch(() => route.params.name, load, { immediate: true })
onErrorCaptured((e) => {
  state.value.phase = 'error'
  state.value.error = String((e && (e.message || e)) || e)
})
</script>

<template>
  <div v-if="state.phase === 'loading'" class="plugin-loading">
    <div class="spinner"></div> 加载插件中...
  </div>
  <div v-else-if="state.phase === 'error'" class="plugin-error">
    插件页错误: {{ state.error }}
  </div>
  <component v-else-if="state.phase === 'ready' && state.comp" :is="state.comp" :plugin="state.info" />
  <GenericPlugin v-else :info="state.info" />
</template>

<style scoped>
.plugin-loading { padding: 40px; text-align: center; color: var(--text-muted, #888); }
.plugin-error { padding: 14px; background: #7a1f1f; color: #fff; border-radius: 8px; font-size: 12px; font-family: monospace; }
.spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: -4px; margin-right: 8px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>