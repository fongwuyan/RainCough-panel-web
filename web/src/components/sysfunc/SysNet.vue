<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const data = ref(null)
const loading = ref(false)
async function load() { loading.value = true; try { data.value = await api.sysfNet() } catch (e) {} finally { loading.value = false } }
function fmtRate(b) { if (b >= 1048576) return (b / 1048576).toFixed(1) + 'MB/s'; if (b >= 1024) return (b / 1024).toFixed(1) + 'KB/s'; return b + 'B/s' }
onMounted(load)
</script>

<template>
  <div class="section">
    <div class="section-title">网络状态 <span class="mono faint" style="font-weight:400">网卡 · 连接 · DNS</span> <button class="btn btn-sm" style="float:right" @click="load">刷新</button></div>
    <table class="table"><thead><tr><th>接口</th><th>状态</th><th>IP</th><th>MTU</th></tr></thead>
      <tbody><tr v-for="n in ((data || {}).nics || [])" :key="n.name">
        <td class="mono">{{ n.name }}</td><td><span :class="n.up ? 'ok' : 'faint'">{{ n.up ? 'UP' : 'DOWN' }}</span></td><td class="mono">{{ n.ip || '-' }}</td><td class="mono">{{ n.mtu }}</td></tr></tbody></table>
    <div class="info-grid" style="margin-top:8px">
      <div><div style="font-size:12px;color:var(--text-faint);">TCP 连接</div><div class="mono" style="font-size:15px;font-weight:700">{{ (data || {}).tcp_conns || 0 }}</div></div>
      <div><div style="font-size:12px;color:var(--text-faint);">DNS</div><div class="mono" style="font-size:15px;font-weight:700">{{ (data || {}).dns || '—' }}</div></div>
      <div><div style="font-size:12px;color:var(--text-faint);">公网 IP</div><div class="mono" style="font-size:15px;font-weight:700">{{ (data || {}).public_ip || '—' }}</div></div>
      <div><div style="font-size:12px;color:var(--text-faint);">速率</div><div class="mono" style="font-size:15px;font-weight:700">{{ fmtRate(((data || {}).rate || {}).rx || 0) }} ↓ / {{ fmtRate(((data || {}).rate || {}).tx || 0) }} ↑</div></div>
    </div>
    <div v-if="loading" class="hint">加载中…</div>
  </div>
</template>

<style scoped>
.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
</style>