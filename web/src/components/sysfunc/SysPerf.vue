<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const data = ref(null)
const loading = ref(false)
async function load() { loading.value = true; try { data.value = await api.sysfPerf(24) } catch (e) {} finally { loading.value = false } }

function bars(key) {
  const pts = ((data.value || {}).points || [])
  if (!pts.length) return []
  const vals = pts.slice(-60).map((x) => x[key])
  const max = Math.max.apply(null, vals.concat([1]))
  return vals.map((v) => ({ h: Math.max(2, Math.round((v / max) * 100)), v: v }))
}
function fmtRate(b) { if (b >= 1048576) return (b / 1048576).toFixed(1) + 'MB/s'; if (b >= 1024) return (b / 1024).toFixed(1) + 'KB/s'; return b + 'B/s' }

onMounted(load)
</script>

<template>
  <div class="section">
    <div class="section-title">性能趋势 <span class="mono faint" style="font-weight:400">CPU / 内存 / 磁盘 · 最近 60 点 · 采样 1 分钟</span></div>
    <div class="muted" style="font-size:11px;margin-bottom:8px">收 {{ fmtRate(((data || {}).net || {}).rx || 0) }} ↓ / 发 {{ fmtRate(((data || {}).net || {}).tx || 0) }} ↑ · 共 {{ ((data || {}).points || []).length }} 点</div>
    <div v-for="row in [['cpu','CPU %'],['mem','内存 %'],['disk','磁盘 %']]" :key="row[0]" style="margin-bottom:6px">
      <div class="muted" style="font-size:11px;margin-bottom:2px">{{ row[1] }}</div>
      <div class="bar-row">
        <div v-for="(b,i) in bars(row[0])" :key="i" class="bar-cell" :title="b.v" :style="{ height: b.h + '%' }" :class="{ hot: b.v >= 85 }"></div>
      </div>
    </div>
    <div v-if="loading" class="hint">加载中…</div>
  </div>
</template>

<style scoped>
.bar-row { display: flex; align-items: flex-end; gap: 2px; height: 48px; padding: 4px; background: var(--surface-2); }
.bar-cell { flex: 1; background: var(--accent); min-width: 2px; }
.bar-cell.hot { background: var(--danger); }
</style>