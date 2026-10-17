<script setup>
import { onMounted, onUnmounted, ref, onErrorCaptured, computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Lightbox from './components/Lightbox.vue'
import { usePreview } from './stores/preview'
import { useUi } from './stores/ui'

const preview = usePreview()
const ui = useUi()
const route = useRoute()
const errGlobal = ref('')
const blankHint = ref('')
// 登录页不要侧栏(免得用户看到自己跳不出去)
const isLogin = computed(() => route.name === 'login')
function startBlankProbe() {
  setTimeout(() => {
    try {
      const app = document.getElementById('app')
      const txt = (app ? app.innerText : '').trim()
      const html = app ? app.innerHTML.length : 0
      if (html > 0 && txt.length === 0) { blankHint.value = '空渲染: ' + (location.hash || '/') + ' html=' + html }
      else if (html === 0) { blankHint.value = '未挂载: ' + (location.hash || '/') }
    } catch (e) { blankHint.value = 'probe: ' + String(e).slice(0, 160) }
  }, 2500)
}
onErrorCaptured((e) => { errGlobal.value = String((e && (e.stack || e.message || e)) || e).slice(0, 900) })

function isTyping(e) {
  const t = e.target
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

onMounted(() => {
  startBlankProbe()
  const onErr = (e) => { const m = String(e && (e.message ? e.message : e.error || e)); if (m && !errGlobal.value) { errGlobal.value = m.slice(0, 800) } }
  window.addEventListener('error', onErr)
  window.addEventListener('unhandledrejection', onErr)
  window.__rcErr = (m) => { errGlobal.value = String(m).slice(0, 800) }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (preview.show.value) { preview.close(); return }
      if (ui.installOpen.value) { ui.installOpen.value = false }
    }
    if (preview.show.value && !isTyping(e)) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); preview.prev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); preview.next() }
    }
  })
})

onUnmounted(() => {
})
</script>

<template>
  <div v-if="blankHint" style="position:fixed;top:60px;left:0;right:0;z-index:99998;background:#e65100;color:#fff;padding:8px 14px;font-size:12px;font-family:monospace">探测: {{ blankHint }}</div>
<div v-if="errGlobal" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#c62828;color:#fff;padding:10px 14px;font-size:12px;font-family:monospace;max-height:120px;overflow:auto">全局错误: {{ errGlobal }}</div>
<div class="layout" :class="{ 'layout-login': isLogin }">
    <Sidebar v-if="!isLogin" />
    <main class="content" :class="{ 'content-login': isLogin }">
      <div class="content-inner" :class="{ 'content-inner-login': isLogin }">
        <router-view v-slot="{ Component }">
        <component :is="Component" :key="$route.fullPath" />
      </router-view>
      </div>
    </main>
    <Lightbox v-if="!isLogin" />
  </div>
</template>
