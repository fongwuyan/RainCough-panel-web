<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const status = ref(null)
const env = ref(null)
const checking = ref(false)
const updating = ref(false)
const msg = ref('')
const msgOk = ref(false)

async function loadStatus() {
  try {
    status.value = await api.storeProjectStatus()
  } catch (e) {
    status.value = { error: e.message }
  }
}

async function doCheck() {
  checking.value = true
  try {
    env.value = await api.storeProjectCheck(true)
  } catch (e) {
    env.value = { ok: false, items: [], error: e.message }
  } finally {
    checking.value = false
  }
}

async function doInstall() {
  if (!confirm('确定从远程仓库拉取并更新面板? 将覆盖框架文件并重启服务。')) return
  updating.value = true
  try {
    await api.storeProjectInstall(false)
    msg.value = '已开始更新, 可在任务队列查看进度, 完成后服务将重启'
    msgOk.value = true
  } catch (e) {
    msg.value = `更新失败: ${e.message}`
    msgOk.value = false
  } finally {
    updating.value = false
  }
}

onMounted(() => { loadStatus(); doCheck() })
</script>

<template>
  <div class="section">
    <div class="section-title">面板更新</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">
      <span>当前版本: <b style="color:var(--text);font-family:var(--font-mono);">{{ status?.local || '-' }}</b></span>
      <span>远程版本: <b :style="{ color: status?.remote ? 'var(--text)' : 'var(--danger)', fontFamily: 'var(--font-mono)' }">
        {{ status?.remote || '未获取' }}</b></span>
      <span>运行解释器: <span style="font-family:var(--font-mono);color:var(--text);">{{ status?.runtime_python }}</span></span>
    </div>
    <div v-if="status?.error" class="error" style="padding:8px 0;">{{ status.error }}</div>

    <div class="section" style="margin:16px 0 0;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <b style="font-size:13px;">环境检查</b>
        <button class="btn btn-sm btn-ghost" :disabled="checking" @click="doCheck">{{ checking ? '检查中…' : '重新检查' }}</button>
      </div>
      <div v-if="env?.error" class="error" style="padding:6px 0;">{{ env.error }}</div>
      <div v-for="it in (env?.items || [])" :key="it.name"
           style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px;">
        <b style="width:120px;color:var(--text);">{{ it.label }}</b>
        <span :style="{ color: it.ok ? 'var(--success)' : 'var(--danger)' }">{{ it.ok ? '✔' : '✖' }}</span>
        <span style="color:var(--text-muted);font-family:var(--font-mono);">{{ it.detail }}</span>
      </div>
      <div v-if="!checking && env" style="margin-top:10px;font-size:12px;">
        <span :class="env.ok ? 'ok' : 'fail'">{{ env.ok ? '环境满足要求' : '环境不满足, 将自动拉取离线环境包' }}</span>
      </div>
    </div>

    <div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
      <button class="btn btn-primary" :disabled="updating" @click="doInstall">{{ updating ? '更新中…' : '拉取并更新面板' }}</button>
      <span v-if="msg" class="status-line" :class="msgOk ? 'ok' : 'fail'">{{ msg }}</span>
    </div>
  </div>
</template>