<script setup>
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'

const route = useRoute()
const name = computed(() => String(route.params.name || ''))
const info = ref(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  info.value = null
  try {
    info.value = await api.pluginInfo(name.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(() => route.params.name, load, { immediate: true })
</script>

<template>
  <div>
    <h1>{{ name }}</h1>
    <div class="subtitle">通用插件信息视图</div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      加载中...
    </div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="info">
      <div class="section">
        <div class="section-title">插件信息</div>
        <div class="mono-block" style="line-height:1.9;">
          <div v-if="info.version">版本: {{ info.version }}</div>
          <div v-if="info.author">作者: {{ info.author }}</div>
          <div>类型: AstrBot Java 插件 (已转换)</div>
        </div>
      </div>

      <div v-if="info.commands && info.commands.length" class="section">
        <div class="section-title">可用指令</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <code v-for="c in info.commands" :key="c" class="tag-chip" style="font-size:13px;">{{ c }}</code>
        </div>
      </div>

      <div v-if="info.api_urls && info.api_urls.length" class="section">
        <div class="section-title">API 地址</div>
        <div class="mono-block" style="line-height:1.8;">
          <div v-for="u in info.api_urls" :key="u">• {{ u }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
