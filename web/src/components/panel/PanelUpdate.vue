<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api'

const emit = defineEmits(['close'])
const cur = ref({})
const cmd = ref({})
const st = ref({})
const chk = ref(null)
const logs = ref([])
const busy = ref('')
const notice = ref('')
const noticeOk = ref(true)
const progress = ref('')
const askApply = ref(false)

const latest = computed(() => (chk.value && chk.value.latest) || '')
const target = computed(() => latest.value || cmd.value.version || '')
const targetNotes = computed(() => {
  const list = (chk.value && chk.value.versions) || []
  const hit = list.find((v) => v.version === target.value)
  return hit ? (hit.notes || '') : ''
})
const hasUpdate = computed(() => !!(chk.value && chk.value.has_update))
const curVer = computed(() => (chk.value && chk.value.current) || cur.value.version || '-')

function flash(m, ok) {
  notice.value = m; noticeOk.value = ok !== false
  if (noticeOk.value) setTimeout(function () { if (notice.value === m) notice.value = '' }, 4000)
}
async function load() {
  try { cur.value = await api.panelVersion() } catch (e) {}
  try { cmd.value = await api.panelInstallCommand() } catch (e) {}
  try { st.value = await api.panelUpdateState() } catch (e) {}
  try { logs.value = (await api.panelUpdateLog()).entries || [] } catch (e) {}
}
async function check() {
  busy.value = 'check'; progress.value = '检查更新中...'
  try {
    chk.value = await api.panelUpdateCheck()
    if (chk.value.error) flash('检查失败: ' + chk.value.error, false)
    else flash(hasUpdate.value ? ('发现新版本 v' + latest.value) : '已是最新版本')
  } catch (e) { flash('检查失败: ' + e.message, false) } finally { busy.value = ''; progress.value = '' }
}
async function doApply() {
  askApply.value = false
  busy.value = 'apply'; progress.value = '下载并应用中...'
  try {
    await api.panelUpdateApply(target.value)
    for (let i = 0; i < 60; i++) {
      await new Promise(function (r) { setTimeout(r, 2000) })
      try { st.value = await api.panelUpdateState() } catch (e) {}
      if (st.value && st.value.pending_restart) { flash('已应用 v' + st.value.applied + ', 待你确认重启'); break }
    }
    await load()
    if (!(st.value && st.value.pending_restart)) flash('仍在应用中, 进度见任务队列', false)
  } catch (e) { flash('应用失败: ' + e.message, false) } finally { busy.value = ''; progress.value = '' }
}
async function doRestart() {
  try {
    await api.panelUpdateRestart()
    progress.value = '正在重启面板, 页面将在数秒后恢复...'
    busy.value = 'restart'
    const t0 = Date.now()
    const timer = setInterval(async function () {
      try {
        const v = await api.panelVersion()
        if (v && v.version) { clearInterval(timer); location.reload() }
      } catch (e) { /* 重启中接口不可用 */ }
      if (Date.now() - t0 > 60000) { clearInterval(timer); flash('未在 60s 内恢复, 请查看 journalctl -u raincough', false); busy.value = ''; progress.value = '' }
    }, 2000)
  } catch (e) { flash('重启下发失败: ' + e.message, false) }
}
async function doRollback() {
  if (!confirm('确定回滚到上一个备份版本？回滚后需重启才生效。')) return
  busy.value = 'rollback'
  try {
    const r = await api.panelUpdateRollback('')
    flash('已回滚 ' + (r.from || '') + ' → ' + (r.to || '') + ', 待确认重启')
    await load()
  } catch (e) { flash('回滚失败: ' + e.message, false) } finally { busy.value = '' }
}
function copy(text) {
  if (!text) return
  try { navigator.clipboard.writeText(text); flash('已复制安装命令') } catch (e) { flash('复制失败, 请手动选择', false) }
}
function fmtSize(n) { const b = n || 0; return b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : (b > 1024 ? (b / 1024).toFixed(1) + ' KB' : b + ' B') }
function fmtTime(ts) { if (!ts) return '-'; const d = new Date(ts * 1000); const p = function (x) { return String(x).padStart(2, '0') }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) }
onMounted(load)
</script>

<template>
  <div class="pu-pop">
    <div class="pu-head">
      <b>面板更新</b>
      <span class="pu-ver">v{{ curVer }}</span>
      <button class="btn btn-sm btn-ghost" style="margin-left:auto;" @click="emit('close')">关闭</button>
    </div>
    <div v-if="notice" class="pu-line" :class="noticeOk ? 'ok' : 'fail'">{{ notice }}</div>
    <div v-if="progress" class="pu-line">{{ progress }}</div>

    <div class="pu-row">
      <span>最新版本</span>
      <b :style="{ color: hasUpdate ? 'var(--accent)' : 'var(--text-muted)' }">{{ latest || '未检查' }}</b>
    </div>
    <div v-if="target && targetNotes" class="pu-notes">
      <div class="pu-notes-title">更新日志 v{{ target }}</div>
      <pre>{{ targetNotes }}</pre>
    </div>

    <div class="pu-actions">
      <button class="btn btn-sm" :disabled="!!busy" @click="check">检查更新</button>
      <button v-if="hasUpdate" class="btn btn-sm btn-primary" :disabled="!!busy" @click="askApply = true">下载并应用</button>
      <button v-if="st && st.pending_restart" class="btn btn-sm btn-primary" :disabled="!!busy" @click="doRestart">立即重启</button>
      <button v-if="st && st.pending_restart" class="btn btn-sm" :disabled="!!busy" @click="flash('已应用, 稍后请手动执行: sudo systemctl restart raincough')">稍后手动重启</button>
      <button class="btn btn-sm btn-danger" :disabled="!!busy" @click="doRollback">回滚</button>
    </div>

    <div v-if="st && st.pending_restart" class="pu-pending">
      已应用 v{{ st.applied }}, 待重启生效 —— 手动命令:
      <code>sudo systemctl restart raincough</code>
      <button class="btn btn-sm" @click="copy('sudo systemctl restart raincough')">复制</button>
    </div>

    <div v-if="askApply" class="pu-confirm">
      <div>确定下载并应用 <b>v{{ target }}</b>？（会先备份当前版本，应用后由你决定是否立即重启）</div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-sm btn-primary" @click="doApply">确定应用</button>
        <button class="btn btn-sm btn-ghost" @click="askApply = false">取消</button>
      </div>
    </div>

    <div class="pu-cmd">
      <div class="pu-cmd-title">本版本安装命令</div>
      <div class="pu-cmd-row"><code>{{ cmd.install || '（未在 releases.json 中找到本版本）' }}</code>
        <button class="btn btn-sm" @click="copy(cmd.install)">复制</button></div>
      <div class="pu-cmd-title" style="margin-top:8px;">最新版安装命令</div>
      <div class="pu-cmd-row"><code>{{ cmd.install_latest || '-' }}</code>
        <button class="btn btn-sm" @click="copy(cmd.install_latest)">复制</button></div>
      <div v-if="cmd.md5" class="pu-meta">资产 {{ cmd.tag }} · {{ fmtSize(cmd.size_bytes) }} · md5 {{ cmd.md5 }}</div>
    </div>

    <div v-if="logs.length" class="pu-log">
      <div class="pu-cmd-title">更新历史</div>
      <div v-for="(e, i) in logs" :key="i" class="pu-log-row">
        {{ fmtTime(e.at) }} · {{ e.action }} {{ e.from }} → {{ e.to || '-' }} · {{ e.result }}
      </div>
    </div>
    <div class="pu-foot">面板不会自动更新：检查/应用/重启三步都由你确认。</div>
  </div>
</template>

<style scoped>
.pu-pop { position: absolute; top: 48px; left: 10px; right: 10px; z-index: 60; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.35); font-size: 12px; }
.pu-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.pu-ver { color: var(--accent); font-family: var(--font-mono); }
.pu-line { font-size: 12px; padding: 2px 0 6px; color: var(--text-muted); }
.pu-line.ok { color: var(--success); }
.pu-line.fail { color: var(--danger); }
.pu-row { display: flex; justify-content: space-between; padding: 2px 0; }
.pu-notes { margin: 8px 0; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px; background: var(--surface-2); max-height: 160px; overflow: auto; }
.pu-notes-title { font-weight: 700; margin-bottom: 4px; }
.pu-notes pre { margin: 0; white-space: pre-wrap; word-break: break-all; font-family: var(--font-mono); font-size: 11px; }
.pu-actions { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
.pu-pending { border: 1px solid var(--accent); border-radius: var(--radius-sm); padding: 8px; margin-bottom: 10px; }
.pu-pending code { display: inline-block; margin: 4px 6px 0 0; font-family: var(--font-mono); font-size: 11px; }
.pu-confirm { border: 1px solid var(--border-strong); border-radius: var(--radius-sm); padding: 8px; margin-bottom: 10px; }
.pu-cmd { border-top: 1px dashed var(--border); padding-top: 8px; margin-top: 6px; }
.pu-cmd-title { font-size: 11px; color: var(--text-faint); margin-bottom: 4px; }
.pu-cmd-row { display: flex; align-items: center; gap: 6px; }
.pu-cmd-row code { flex: 1; font-family: var(--font-mono); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pu-meta { font-size: 10px; color: var(--text-faint); margin-top: 4px; word-break: break-all; }
.pu-log { border-top: 1px dashed var(--border); margin-top: 8px; padding-top: 8px; max-height: 120px; overflow: auto; }
.pu-log-row { font-size: 11px; color: var(--text-muted); }
.pu-foot { margin-top: 8px; font-size: 10px; color: var(--text-faint); }
</style>