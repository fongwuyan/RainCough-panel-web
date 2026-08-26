<script setup>
import { onMounted, ref } from 'vue'
import Sidebar from './core/Sidebar.vue'

const errGlobal = ref('')
onMounted(() => {
  const onErr = (e) => {
    const m = String(e && (e.message ? e.message : e.error || e))
    if (m && !errGlobal.value) errGlobal.value = m.slice(0, 800)
  }
  window.addEventListener('error', onErr)
  window.addEventListener('unhandledrejection', onErr)
})
</script>

<template>
  <div v-if="errGlobal" class="global-err">全局错误: {{ errGlobal }}</div>
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
  </div>
</template>

<style>
.global-err { position: fixed; top: 0; left: 0; right: 0; z-index: 99999; background: #c62828; color: #fff; padding: 10px 14px; font-size: 12px; font-family: monospace; max-height: 120px; overflow: auto; }
</style>