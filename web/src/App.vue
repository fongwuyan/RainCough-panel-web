<script setup>
import { onMounted, onUnmounted, ref, onErrorCaptured } from 'vue'
import Sidebar from './components/Sidebar.vue'
import InstallModal from './components/InstallModal.vue'
import Lightbox from './components/Lightbox.vue'
import { usePreview } from './stores/preview'
import { useUi } from './stores/ui'
import { useJmcomic } from './stores/jmcomic'

const preview = usePreview()
const ui = useUi()
const jm = useJmcomic()
const errGlobal = ref('')
const blankHint = ref('')
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
      if (jm.popupAid.value) { jm.closePopup(); return }
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
<div class="layout">
    <Sidebar />
    <main class="content">
      <div class="content-inner">
        <router-view v-slot="{ Component }">
        <component :is="Component" :key="$route.fullPath" />
      </router-view>
      </div>
    </main>
    <InstallModal />
    <Lightbox />
  </div>
</template>
