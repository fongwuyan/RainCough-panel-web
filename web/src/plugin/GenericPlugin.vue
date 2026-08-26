<script setup>
// GenericPlugin — 插件无自带前端时的兜底元信息卡。
import { computed } from 'vue'

const props = defineProps({ info: Object })

const monogram = computed(() => {
  const s = (props.info && (props.info.label || props.info.name)) || '?'
  return String(s).trim().charAt(0).toUpperCase()
})

const name = computed(() => (props.info && props.info.name) || '')
</script>

<template>
  <div v-if="info">
    <div class="hero">
      <div class="hero-avatar">{{ monogram }}</div>
      <div class="hero-main">
        <h1>{{ (info.label || info.name) }}</h1>
        <div class="subtitle mono">{{ info.name }}</div>
      </div>
      <span v-if="info.version" class="chip">v{{ info.version }}</span>
      <span v-if="info.lang" class="chip">{{ info.lang }}</span>
    </div>

    <div v-if="info.description" class="section">
      <div class="section-title">简介</div>
      <p class="desc">{{ info.description }}</p>
    </div>

    <div class="section">
      <div class="section-title">元信息</div>
      <div class="kv">
        <div class="kv-row"><span class="kv-k">名称</span><span class="kv-v mono">{{ name }}</span></div>
        <div class="kv-row"><span class="kv-k">版本</span><span class="kv-v mono">{{ info.version }}</span></div>
        <div v-if="info.author" class="kv-row"><span class="kv-k">作者</span><span class="kv-v">{{ info.author }}</span></div>
        <div v-if="info.lang" class="kv-row"><span class="kv-k">语言</span><span class="kv-v">{{ info.lang }}</span></div>
        <div v-if="info.alive !== undefined" class="kv-row">
          <span class="kv-k">状态</span>
          <span class="kv-v" :class="info.alive ? 'ok' : 'bad'">{{ info.alive ? '运行中' : '已停止' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: center; gap: 14px; padding: 18px 20px; margin-bottom: 16px; background: var(--surface, #161b24); border: 1px solid var(--border, #2a3140); border-radius: 14px; }
.hero-avatar { width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--accent, #6d5cff), var(--accent-press, #5546d6)); border-radius: 14px; flex-shrink: 0; }
.hero-main { flex: 1; min-width: 0; }
.hero-main h1 { margin: 0 0 2px; font-size: 20px; }
.subtitle { margin: 0; font-size: 12px; color: var(--text-faint, #777); }
.chip { background: var(--border, #2a3140); border-radius: 999px; padding: 3px 10px; font-size: 12px; }
.section { padding: 16px 20px; margin-bottom: 14px; background: var(--surface, #161b24); border: 1px solid var(--border, #2a3140); border-radius: 12px; }
.section-title { font-size: 13px; color: var(--text-muted, #9aa3b2); margin-bottom: 10px; }
.desc { font-size: 13px; line-height: 1.7; color: var(--text, #e6e8ee); margin: 0; }
.kv-row { display: flex; align-items: center; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--border, #2a3140); font-size: 13px; }
.kv-row:last-child { border-bottom: none; }
.kv-k { width: 60px; flex-shrink: 0; color: var(--text-faint, #777); }
.kv-v { word-break: break-all; }
.kv-v.ok { color: #3fb950; }
.kv-v.bad { color: #f85149; }
</style>