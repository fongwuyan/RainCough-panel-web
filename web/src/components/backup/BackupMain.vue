<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const jobs = ref([])
const runs = ref([])
const loading = ref(false)
const error = ref('')
const notice = ref('')

const showForm = ref(false)
const editingName = ref('')
const form = ref({ name: '', sources: '', target: '', compress: 'gz', keep: 5, interval_hours: 0, excludes: '' })

let timer = null

function sizeTxt(b) {
  if (!b && b !== 0) return '-'
  if (b < 1024) return b + ' B'
  const u = ['KB', 'MB', 'GB', 'TB']
  let i = -1, v = b
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return v.toFixed(1) + ' ' + u[i]
}
function timeTxt(ts) {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}
function relTime(ts) {
  if (!ts) return '-'
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts))
  if (s < 60) return s + ' 秒前'
  if (s < 3600) return Math.floor(s / 60) + ' 分钟前'
  return Math.floor(s / 3600) + ' 小时前'
}
const RUN_STATE = { done: '完成', error: '失败', interrupted: '中断' }

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [j, r] = await Promise.all([api.bkpList(), api.bkpRuns()])
    jobs.value = j.jobs || []
    runs.value = (r.runs || []).slice(0, 30)
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}

function openCreate() {
  editingName.value = ''
  form.value = { name: '', sources: '', target: '', compress: 'gz', keep: 5, interval_hours: 0, excludes: '' }
  showForm.value = true
}
function openEdit(j) {
  editingName.value = j.name
  form.value = {
    name: j.name,
    sources: (j.sources || []).join('\n'),
    target: j.target || '',
    compress: j.compress || 'gz',
    keep: j.keep || 5,
    interval_hours: j.interval_hours || 0,
    excludes: (j.excludes || []).join('\n'),
  }
  showForm.value = true
}
function closeForm() { showForm.value = false }

async function saveForm() {
  error.value = ''
  const payload = {
    name: form.value.name.trim(),
    sources: form.value.sources.split('\n').map((s) => s.trim()).filter(Boolean),
    target: form.value.target.trim(),
    compress: form.value.compress,
    keep: parseInt(form.value.keep, 10) || 5,
    interval_hours: parseInt(form.value.interval_hours, 10) || 0,
    excludes: form.value.excludes.split('\n').map((s) => s.trim()).filter(Boolean),
  }
  try {
    if (editingName.value) await api.bkpUpdate(editingName.value, payload)
    else await api.bkpCreate(payload)
    closeForm()
    await load()
  } catch (e) { error.value = e.message }
}

async function runNow(j) {
  try {
    await api.bkpRun(j.name)
    notice.value = '已开始备份 ' + j.name + '，可在任务队列查看进度'
    setTimeout(() => { notice.value = '' }, 5000)
    setTimeout(load, 1500)
  } catch (e) { error.value = e.message }
}

async function togglePause(j) {
  try {
    await api.bkpUpdate(j.name, { paused: !j.paused })
    await load()
  } catch (e) { error.value = e.message }
}

async function removeJob(j) {
  if (!confirm('删除任务「' + j.name + '」？不会删除已产生的归档文件。')) return
  try {
    await api.bkpDelete(j.name)
    await load()
  } catch (e) { error.value = e.message }
}

async function removeRun(r) {
  if (!confirm('删除归档 ' + r.file.split('/').pop() + ' ？')) return
  try {
    await api.bkpDeleteRun(r.file)
    await load()
  } catch (e) { error.value = e.message }
}

async function goTarget(j) {
  try { window.open('/#/plugin/filemanager', '_blank') } catch (e) {}
}

onMounted(() => { load(); timer = setInterval(load, 4000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div>
    <h1>系统备份</h1>
    <div class="subtitle">目录打包备份与保留轮换 · 支持定时执行，进度接入任务队列</div>

    <div v-if="notice" class="notice" style="padding:8px 12px;border-radius:8px;background:var(--success-soft);color:var(--success);margin-bottom:12px;">{{ notice }}</div>
    <div v-if="error" class="error" style="margin-bottom:12px;">{{ error }}</div>

    <div class="section">
      <div class="section-title">
        <span>备份任务</span>
        <button class="btn btn-sm btn-primary" style="float:right" @click="openCreate">＋ 新建任务</button>
      </div>
      <div v-if="loading && !jobs.length" class="loading"><div class="spinner"></div> 加载中...</div>
      <div v-else-if="!jobs.length" class="empty" style="padding:26px;">还没有备份任务，点右上角「新建任务」开始</div>

      <table v-else class="table" style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr><th style="text-align:left;padding:8px">名称</th><th>来源</th><th>保留</th><th>间隔</th><th>上次</th><th>状态</th><th style="text-align:right;padding:8px">操作</th></tr></thead>
        <tbody>
          <tr v-for="j in jobs" :key="j.name" style="border-top:1px solid var(--border)">
            <td style="padding:8px;font-weight:700">{{ j.name }}</td>
            <td style="padding:8px;color:var(--text-muted);font-family:var(--font-mono);font-size:12px;" :title="(j.sources||[]).join('\n')">{{ j.sources.length }} 个来源</td>
            <td style="padding:8px;text-align:center">{{ j.keep }}</td>
            <td style="padding:8px;text-align:center">{{ j.interval_hours ? j.interval_hours + ' 小时' : (j.paused ? '暂停' : '手动') }}</td>
            <td style="padding:8px;color:var(--text-faint);font-family:var(--font-mono);font-size:12px;">{{ j.last_run ? relTime(j.last_run.start) + ' · ' + sizeTxt(j.last_run.size) : '-' }}</td>
            <td style="padding:8px;text-align:center">
              <span v-if="j.running" class="badge running" style="color:var(--accent)">运行中</span>
              <span v-else-if="j.paused" class="badge" style="color:var(--text-faint)">暂停</span>
              <span v-else-if="j.last_run" class="badge" :style="j.last_run.status === 'done' ? 'color:var(--success)' : 'color:var(--danger)'">{{ RUN_STATE[j.last_run.status] || j.last_run.status }}</span>
              <span v-else class="badge" style="color:var(--text-faint)">未运行</span>
            </td>
            <td style="padding:8px;text-align:right;white-space:nowrap">
              <button class="btn btn-sm btn-primary" :disabled="j.running" @click="runNow(j)">立即备份</button>
              <button class="btn btn-sm" @click="openEdit(j)">编辑</button>
              <button class="btn btn-sm btn-ghost" @click="togglePause(j)">{{ j.paused ? '恢复' : '暂停' }}</button>
              <button class="btn btn-sm btn-danger btn-ghost" @click="removeJob(j)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">运行历史</div>
      <div v-if="!runs.length" class="empty" style="padding:20px;">暂无备份记录</div>
      <table v-else class="table" style="width:100%;border-collapse:collapse;font-size:12.5px;font-family:var(--font-mono);">
        <thead><tr><th style="text-align:left;padding:6px">时间</th><th style="text-align:left">任务</th><th>时长</th><th>大小</th><th>状态</th><th style="text-align:right;padding:6px">归档</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in runs" :key="i" style="border-top:1px solid var(--border)">
            <td style="padding:6px">{{ timeTxt(r.start) }}</td>
            <td style="padding:6px">{{ r.job }}</td>
            <td style="padding:6px;text-align:center">{{ r.duration ? r.duration + 's' : '-' }}</td>
            <td style="padding:6px;text-align:center">{{ sizeTxt(r.size) }}</td>
            <td style="padding:6px;text-align:center">
              <span :style="r.status === 'done' ? 'color:var(--success)' : 'color:var(--danger)'">{{ RUN_STATE[r.status] || r.status }}</span>
            </td>
            <td style="padding:6px;text-align:right;white-space:nowrap">
              <span class="status-line">{{ r.file.split('/').pop() }}</span>
              <button v-if="r.file" class="btn btn-sm btn-ghost" @click="removeRun(r)" title="删除归档">删</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div v-if="showForm" class="modal-mask" @click.self="closeForm">
      <div class="modal-panel">
        <div class="modal-head"><span>{{ editingName ? '编辑任务：' + editingName : '新建备份任务' }}</span><button class="btn btn-sm btn-ghost" @click="closeForm">×</button></div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:10px;">
          <label class="lbl">任务名称
            <input v-model="form.name" class="input" :disabled="!!editingName" style="width:100%" placeholder="如: jmcomic 库" />
          </label>
          <label class="lbl">来源路径（每行一个绝对路径）
            <textarea v-model="form.sources" class="input" rows="3" style="width:100%;resize:vertical;font-family:var(--font-mono);" placeholder="/opt/touchgal/plugins/JMComic/downloads&#10;/opt/touchgal/data/tasks.json"></textarea>
          </label>
          <label class="lbl">目标目录（绝对路径）
            <input v-model="form.target" class="input" style="width:100%;font-family:var(--font-mono);" placeholder="/opt/touchgal/backups 或外置盘挂载点" />
          </label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <label class="lbl">压缩 <select v-model="form.compress" class="input"><option value="gz">tar.gz</option><option value="none">tar(不压缩)</option></select></label>
            <label class="lbl">保留份数 <input v-model="form.keep" type="number" min="1" class="input" style="width:70px" /></label>
            <label class="lbl">定时间隔(小时, 0=手动) <input v-model="form.interval_hours" type="number" min="0" class="input" style="width:80px" /></label>
          </div>
          <label class="lbl">排除规则（tar --exclude 通配, 每行一个）
            <textarea v-model="form.excludes" class="input" rows="2" style="width:100%;resize:vertical;font-family:var(--font-mono);" placeholder="*.log&#10;cache"></textarea>
          </label>
        </div>
        <div class="modal-foot" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 14px;">
          <button class="btn btn-sm" @click="closeForm">取消</button>
          <button class="btn btn-sm btn-primary" @click="saveForm">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table th { color: var(--text-faint); font-size: 12px; }
.modal-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-panel { width: 520px; max-width: 94vw; max-height: 86vh; overflow: auto; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--border); font-weight: 700; }
.modal-body { padding: 14px; }
.lbl { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.lbl .input { margin-top: 2px; }
</style>
