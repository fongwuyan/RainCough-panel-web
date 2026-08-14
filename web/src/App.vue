<script setup>
import { onMounted, onUnmounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import InstallModal from './components/InstallModal.vue'
import Lightbox from './components/Lightbox.vue'
import { usePreview } from './stores/preview'
import { useUi } from './stores/ui'
import { useJmcomic } from './stores/jmcomic'

const preview = usePreview()
const ui = useUi()
const jm = useJmcomic()

function isTyping(e) {
  const t = e.target
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

onMounted(() => {
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
  <div class="layout">
    <Sidebar />
    <main class="content">
      <div class="content-inner">
        <router-view v-slot="{ Component }">
          <transition name="view" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
    <InstallModal />
    <Lightbox />
  </div>
</template>
