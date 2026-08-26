<script setup>
// PluginView — 插件页加载器
// 适配: 插件自带独立 Vue3 前端(assets/plugin.js → window.__rcPlugin_<name>.mount)
// 回退: 旧 MAP 组件(面板内置) → GenericPlugin 信息卡
import { computed, ref, h, onMounted, onBeforeUnmount, nextTick, onErrorCaptured } from 'vue'
import { useRoute } from 'vue-router'
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
const name = computed(() => String(route.params.name || ''))

// 插件独立前端状态
const mode = ref('loading')   // loading | plugin(独立前端) | map(内置回退) | generic
const perr = ref('')
let mountFn = null            // 卸载函数(插件 mount 返回)
let mountEl = null

const isMapFallback = computed(() => mode.value === 'map')
const comp = computed(() => MAP[name.value] || GenericPlugin)

// ctx.Vue: 把主面板的 Vue 运行时注入插件(external 由 esbuild 保留, 此处注入)
import * as VueExports from 'vue'

async function loadPluginFrontend() {
  mode.value = 'loading'
  perr.value = ''
  mountFn = null
  try {
    // 动态加载插件的独立前端产物
    await import(/* @vite-ignore */ '/api/plugins/' + name.value + '/assets/plugin.js')
    const reg = window.__rcPlugin_ && window.__rcPlugin_[name.value]
    if (reg && typeof reg.mount === 'function') {
      mode.value = 'plugin'
      await nextTick()
      if (mountEl) {
        // ctx: {Vue: 主运行时, plugin: 插件信息, api: 请求器}
        mountFn = reg.mount(mountEl, {
          Vue: VueExports,
          plugin: { name: name.value },
          api: {
            get: (p) => fetch('/api/plugins/' + name.value + p).then((r) => r.json()),
            post: (p, body) => fetch('/api/plugins/' + name.value + p, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body || {}),
            }).then((r) => r.json()),
          },
        })
      }
      return
    }
  } catch (e) {
    // 插件无独立前端(404 或未构建) → 回退内置
  }
  mode.value = MAP[name.value] ? 'map' : 'generic'
}

onMounted(loadPluginFrontend)
onBeforeUnmount(() => { if (typeof mountFn === 'function') { try { mountFn() } catch (e) {} } })

onErrorCaptured((e) => { perr.value = String((e && (e.message || e)) || e) })
</script>

<template>
  <div>
    <div v-if="perr" style="background:#7a1f1f;color:#fff;padding:10px 14px;margin:10px;font-size:12px;font-family:monospace">插件页错误: {{ perr }}</div>

    <!-- 插件独立前端挂载区 -->
    <div v-if="mode === 'plugin'" ref="mountEl" class="plugin-mount"></div>
    <div v-else-if="mode === 'loading'" class="hint" style="padding:20px;">加载插件前端...</div>

    <!-- 回退: 内置组件 / 信息卡 -->
    <component v-else :is="comp" :key="name" />
  </div>
</template>

<style scoped>
.plugin-mount { min-height: 200px; }
</style>