<script setup>
import { ref, computed, watch } from 'vue'
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

const monogram = computed(() => {
  const s = (info.value && (info.value.label || info.value.name)) || name.value || '?'
  return s.trim().charAt(0).toUpperCase()
})
</script>

<template>
  <div>
    <div class="hero">
      <div class="hero-avatar">{{ monogram }}</div>
      <div class="hero-main">
        <h1>{{ (info && (info.label || info.name)) || name }}</h1>
        <div class="subtitle mono">{{ info && info.raw_name ? '' : (info && info.name) || name }}</div>
      </div>
      <span v-if="info && info.version" class="tag-chip">v{{ info.version }}</span>
      <span v-if="info && info.lang" class="tag-chip">{{ info.lang }}</span>
    </div>

    <div v-if="loading" class="section loading"><div class="spinner"></div> 加载中...</div>
    <div v-else-if="error" class="section error">{{ error }}</div>

    <template v-else-if="info">
      <div v-if="info.description" class="section">
        <div class="section-title">简介</div>
        <p class="desc-text">{{ info.description }}</p>
      </div>

      <div class="section">
        <div class="section-title">元信息</div>
        <div class="kv">
          <div class="kv-row"><span class="kv-k">名称</span><span class="kv-v mono">{{ info.name }}</span></div>
          <div v-if="info.label" class="kv-row"><span class="kv-k">显示名</span><span class="kv-v">{{ info.label }}</span></div>
          <div v-if="info.version" class="kv-row"><span class="kv-k">版本</span><span class="kv-v mono">{{ info.version }}</span></div>
          <div v-if="info.author" class="kv-row"><span class="kv-k">作者</span><span class="kv-v">{{ info.author }}</span></div>
          <div v-if="info.lang" class="kv-row"><span class="kv-k">语言</span><span class="kv-v">{{ info.lang }}</span></div>
          <div v-if="info.type" class="kv-row"><span class="kv-k">类型</span><span class="kv-v">{{ info.type }}</span></div>
        </div>
      </div>

      <div v-if="info.commands && info.commands.length" class="section">
        <div class="section-title">可用指令</div>
        <div class="chips">
          <code v-for="c in info.commands" :key="c" class="tag-chip">{{ c }}</code>
        </div>
      </div>

      <div v-if="info.routes && info.routes.length" class="section">
        <div class="section-title">路由</div>
        <div class="kv">
          <div v-for="(r, i) in info.routes" :key="i" class="kv-row">
            <span class="kv-k">/{{ r }}</span><span class="kv-v mono">{{ r }}</span>
          </div>
        </div>
      </div>

      <div v-if="info.api_urls && info.api_urls.length" class="section">
        <div class="section-title">API 地址</div>
        <div class="kv">
          <div v-for="u in info.api_urls" :key="u" class="kv-row">
            <a class="kv-v mono api" :href="u" target="_blank" rel="noreferrer">• {{ u }}</a>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  margin-bottom: 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 14px);
  box-shadow: var(--shadow-sm);
}
.hero-avatar {
  width: 52px; height: 52px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-press));
  border-radius: var(--radius-lg, 14px);
  box-shadow: 0 4px 14px rgba(109, 92, 255, 0.35);
  flex-shrink: 0;
}
.hero-main { flex: 1; min-width: 0; }
.hero-main h1 { margin-bottom: 2px; }
.hero-main .subtitle { margin-bottom: 0; }
.desc-text { font-size: 13px; color: var(--text-muted); line-height: 1.7; }
.kv { display: flex; flex-direction: column; }
.kv-row {
  display: flex; align-items: center; gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.kv-row:last-child { border-bottom: none; }
.kv-k { width: 84px; flex-shrink: 0; color: var(--text-faint); font-size: 12px; }
.kv-v { color: var(--text); word-break: break-all; }
.kv-v.api { color: var(--accent); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
