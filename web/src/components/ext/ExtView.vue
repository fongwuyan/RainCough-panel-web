<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// ExtView — 系统扩展加载器
// 取 /api/ext/<name>/assets/extension.js → 执行 → window.__rcExt__[name].mount(el)
// 扩展产物不打包 Vue/api, 统一用 window.__rcHost(见 src/ext-host.js)
const route = useRoute()
const router = useRouter()
const name = computed(() => String(route.params.name || ''))

const mode = ref('loading')   // loading | ext | missing
const err = ref('')
const mountEl = ref(null)
let unmountFn = null

function readReg(n) {
  const regMap = window.__rcExt__
  if (!regMap) return null
  let reg = regMap[n]
  if (!reg) {
    for (const k in regMap) {
      if (k.toLowerCase() === n.toLowerCase()) { reg = regMap[k]; break }
    }
  }
  return (reg && typeof reg.mount === 'function') ? reg : null
}

async function loadExt() {
  mode.value = 'loading'
  err.value = ''
  unmountFn = null
  const n = name.value
  try {
    const url = `/api/ext/${encodeURIComponent(n)}/assets/extension.js`
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
    const code = await r.text()
    if (!code || code.length < 50) throw new Error(`产物为空或异常(${code.length}B)`)
    ;(0, eval)(code)
    const reg = readReg(n)
    if (!reg) throw new Error('产物未注册 mount (window.__rcExt__[' + n + '])')
    mode.value = 'ext'
    await nextTick()
    if (mountEl.value) {
      unmountFn = reg.mount(mountEl.value, {
        navigate: (to) => router.push(to),
        host: window.__rcHost,
      })
    }
  } catch (e) {
    err.value = (e && e.message) || String(e)
    mode.value = 'missing'
  }
}

onMounted(loadExt)
onBeforeUnmount(() => {
  if (typeof unmountFn === 'function') {
    try { unmountFn() } catch (e) { /* 卸载失败不影响离开 */ }
  }
})
</script>

<template>
  <div>
    <div v-if="mode === 'ext'" ref="mountEl" class="ext-mount"></div>
    <div v-else-if="mode === 'loading'" class="hint" style="padding:20px;">加载扩展...</div>
    <div v-else class="page">
      <div class="page-head">
        <h1>扩展未就绪</h1>
        <div class="subtitle">{{ name }}</div>
      </div>
      <div class="page-body">
        <div class="ext-err">{{ err }}</div>
        <div class="hint" style="padding:10px 2px;">
          该扩展可能尚未安装, 或产物缺失。到「系统扩展」页安装后再打开。
        </div>
        <button class="btn btn-sm" @click="router.push('/ext')">前往系统扩展</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ext-mount { min-height: 200px; }
.ext-err {
  padding: 10px 12px; color: var(--danger); border: 1px solid var(--danger);
  border-radius: var(--radius-sm); font-size: 13px; word-break: break-all; margin-bottom: 10px;
}
</style>
