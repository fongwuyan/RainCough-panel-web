<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const data = ref(null)
const loading = ref(false)
const err = ref('')
async function load() {
  loading.value = true
  try { data.value = await api.sysfNet(); err.value = '' }
  catch (e) { err.value = (e && e.message) || String(e) }
  finally { loading.value = false }
}
function fmtRate(b) { b = Number(b) || 0; if (b >= 1048576) return (b / 1048576).toFixed(1) + 'MB/s'; if (b >= 1024) return (b / 1024).toFixed(1) + 'KB/s'; return b + 'B/s' }
let timer = null
onMounted(() => { load(); timer = setInterval(load, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="section">
    <div class="section-title">网络摘要 <span class="mono faint" style="font-weight:400">DNS · TCP 连接 · 实时速率</span> <button class="btn btn-sm" style="float:right" @click="load">刷新</button></div>
    <div v-if="err" class="error" style="margin-bottom:6px;">网络状态加载失败: {{ err }}</div>
    <!-- 网卡清单(IP/UP 状态)已在「服务器信息 · 网卡 IP」展示, 此处不再重复渲染表格 -->
    <div class="info-grid" style="margin-top:8px">
      <div><div style="font-size:12px;color:var(--text-faint);">TCP 连接</div><div class="mono" style="font-size:15px;font-weight:700">{{ (data || {}).tcp_conns || 0 }}</div></div>
      <div><div style="font-size:12px;color:var(--text-faint);">DNS</div><div class="mono" style="font-size:15px;font-weight:700">{{ (data || {}).dns || '—' }}</div></div>
      <div><div style="font-size:12px;color:var(--text-faint);">公网 IP</div><div class="mono" style="font-size:15px;font-weight:700">{{ (data || {}).public_ip || '—' }}</div></div>
      <div><div style="font-size:12px;color:var(--text-faint);">速率</div><div class="mono" style="font-size:15px;font-weight:700">{{ fmtRate(((data || {}).rate || {}).rx || 0) }} ↓ / {{ fmtRate(((data || {}).rate || {}).tx || 0) }} ↑</div></div>
    </div>
    <div v-if="loading && !data" class="hint">加载中…</div>
  </div>
</template>

<style scoped>
.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
</style>