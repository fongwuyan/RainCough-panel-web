<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const status = ref(null)
const env = ref(null)
const checking = ref(false)
const checkUpdating = ref(false)
const updateInfo = ref(null)
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

async function doCheckUpdate() {
  checkUpdating.value = true
  msg.value = ''
  try {
    updateInfo.value = await api.storeProjectUpdateInfo()
  } catch (e) {
    updateInfo.value = { error: e.message }
  } finally {
    checkUpdating.value = false
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

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d) ? '' : d.toLocaleDateString()
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

    <div style="margin:16px 0 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <button class="btn btn-primary" :disabled="checkUpdating || updating" @click="doCheckUpdate">
        {{ checkUpdating ? '检查中…' : '检查更新' }}</button>
      <button v-if="updateInfo?.update_available" class="btn btn-primary btn-danger" :disabled="updating"
              @click="doInstall">{{ updating ? '更新中…' : '立即更新' }}</button>
      <span v-if="msg" class="status-line" :class="msgOk ? 'ok' : 'fail'">{{ msg }}</span>
    </div>

    <div v-if="updateInfo && !updateInfo.error" style="margin-top:12px;font-size:12px;">
      <span v-if="updateInfo.update_available" class="ok"
            style="color:var(--success);font-weight:600;">发现新版本 v{{ updateInfo.remote }}</span>
      <span v-else-if="updateInfo.remote" style="color:var(--text-muted);">已是最新版本 v{{ updateInfo.local }}</span>
    </div>
    <div v-if="updateInfo?.error" class="error" style="padding:6px 0;">{{ updateInfo.error }}</div>

    <div v-if="updateInfo?.update_available && (updateInfo.changelog || updateInfo.latest_tag)"
         class="section" style="margin:12px 0 0;padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <b style="font-size:13px;">更新日志{{ updateInfo.latest_tag ? ' · ' + updateInfo.latest_tag : '' }}
          <span v-if="updateInfo.published_at" style="color:var(--text-muted);font-weight:400;margin-left:8px;">
            {{ fmtDate(updateInfo.published_at) }}</span></b>
        <a v-if="updateInfo.release_url" :href="updateInfo.release_url" target="_blank"
           rel="noopener" style="font-size:12px;">在 GitHub 查看</a>
      </div>
      <div style="max-height:260px;overflow:auto;padding:10px;border:1px solid var(--border);border-radius: 0;
                  background:var(--bg);white-space:pre-wrap;font-size:12px;line-height:1.7;color:var(--text);">
        {{ updateInfo.changelog || '该版本没有更新说明。' }}
      </div>
    </div>

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
  </div>
</template>
