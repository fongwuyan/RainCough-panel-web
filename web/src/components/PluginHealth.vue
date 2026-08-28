<script setup>
// 插件健康 — 系统顶级页面(信息丰富版)
// 自动检测插件加载: 子进程/PID/端口/uptime/健康端点/前端资产/元数据/runtime日志
// 子选项卡: ① 概览(卡片) ② 全部插件(表格+筛选) ③ 独立日志
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const tab = ref('overview') // overview | table | logs
const data = ref(null)
const loading = ref(false)
const err = ref('')
const q = ref('')
const logName = ref('')
const logText = ref('')
const logLoading = ref(false)
const logLines = ref(500)       // 0 = 全部
const logGrep = ref('')
const logInfo = ref(null)       // {size,total_lines,file}
const logSource = ref('system') // system=主系统日志(安装/加载/痕迹) | runtime=进程控制台

async function loadLog(name) {
  if (!name) return
  logName.value = name
  logLoading.value = true
  logText.value = ''
  logInfo.value = null
  try {
    const q = 'name=' + encodeURIComponent(name) +
      '&source=' + logSource.value +
      '&lines=' + logLines.value +
      (logGrep.value.trim() ? '&grep=' + encodeURIComponent(logGrep.value.trim()) : '')
    const r = await fetch('/api/sys/plugins-health/log?' + q)
    const d = await r.json()
    logInfo.value = d
    logText.value = (d && d.text) ? d.text : (d && d.exists === false ? '(无进程日志文件)' : '(无匹配日志)')
  } catch (e) { logText.value = '读取失败: ' + e.message }
  logLoading.value = false
  setTimeout(scrollLogBottom, 60)
}

function scrollLogBottom() {
  const el = document.querySelector('.ph-logbox')
  if (el) el.scrollTop = el.scrollHeight
}

function fmtSize(b) {
  if (b == null) return ''
  if (b < 1024) return b + 'B'
  if (b < 1048576) return (b / 1024).toFixed(1) + 'KB'
  return (b / 1048576).toFixed(1) + 'MB'
}

const lastRefresh = ref('')

async function load() {
  loading.value = true
  err.value = ''
  try {
    const r = await fetch('/api/sys/plugins-health')
    const d = await r.json()
    if (d.error) { err.value = d.error } else { data.value = d }
    const t = new Date()
    lastRefresh.value = t.toTimeString().slice(0, 8)
  } catch (e) { err.value = e.message }
  loading.value = false
}

const healthyCount = computed(() => data.value ? data.value.healthy : 0)
const aliveCount = computed(() => data.value ? data.value.alive : 0)
const issueCount = computed(() => (data.value ? data.value.total : 0) - (data.value ? data.value.healthy : 0))

const items = computed(() => (data.value ? data.value.items : []).slice().sort((a, b) => {
  // 异常优先
  const ao = a.error ? 0 : 1
  const bo = b.error ? 0 : 1
  if (ao !== bo) return ao - bo
  return (b.started_at || 0) - (a.started_at || 0)
}))

const issues = computed(() => items.value.filter((i) => i.error))
const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value.filter((i) => (i.label + i.name + (i.description || '')).toLowerCase().includes(kw))
})

function statusOf(it) {
  if (!it.alive) return { label: '未存活', cls: 'bad', icon: '✕' }
  if (!it.health_http) return { label: '健康端失败', cls: 'warn', icon: '!' }
  return { label: '正常', cls: 'ok', icon: '✓' }
}

function fmtUp(sec) {
  if (!sec) return '—'
  if (sec < 60) return sec + 's'
  if (sec < 3600) return Math.floor(sec / 60) + 'm' + (sec % 60) + 's'
  if (sec < 86400) return Math.floor(sec / 3600) + 'h' + Math.floor((sec % 3600) / 60) + 'm'
  return Math.floor(sec / 86400) + 'd' + Math.floor((sec % 86400) / 3600) + 'h'
}

let timer = null
onMounted(() => { load(); timer = setInterval(load, 8000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div>
    <div class="parent-tabs">
      <div class="parent-tab" :class="{ on: tab === 'overview' }" @click="tab = 'overview'">概览</div>
      <div class="parent-tab" :class="{ on: tab === 'table' }" @click="tab = 'table'">全部插件</div>
      <div class="parent-tab" :class="{ on: tab === 'logs' }" @click="tab = 'logs'">独立日志</div>
    </div>

    <!-- ===== 概览 ===== -->
    <div v-if="tab === 'overview'">
      <div v-if="err" class="section error">{{ err }}</div>

      <!-- 统计带 -->
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">{{ data ? data.total : '–' }}</div><div class="stat-label">插件总数</div></div>
        <div class="stat-card"><div class="stat-num accent">{{ healthyCount }}</div><div class="stat-label">健康</div></div>
        <div class="stat-card"><div class="stat-num warn" :style="{color: issueCount ? '#f0b429' : 'var(--text-faint)'}">{{ issueCount }}</div><div class="stat-label">异常</div></div>
        <div class="stat-card"><div class="stat-num muted">{{ aliveCount }}</div><div class="stat-label">子进程存活</div></div>
      </div>
      <p class="hint" style="margin:6px 0;">上次检测 {{ lastRefresh || '…' }} · 每 8s 自动刷新</p>

      <!-- 异常卡片 -->
      <div v-if="issues.length" class="section" style="border:1px solid var(--danger,#5a1f2a);">
        <div class="section-title" style="color:var(--danger,#f85149);">⚠ 异常插件 ({{ issues.length }})</div>
        <div v-for="it in issues" :key="it.name" class="kv-row">
          <span class="kv-k"><b>{{ it.label || it.name }}</b> <span class="mono faint" style="font-size:11px;">{{ it.name }}</span></span>
          <span class="kv-v mono" style="color:var(--danger,#f85149);">{{ it.error }}</span>
        </div>
      </div>

      <!-- 插件卡片网格 -->
      <div v-if="data" class="card-grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">
        <div v-for="it in items" :key="it.name" class="card" style="padding:10px 12px;">
          <div class="flex" style="justify-content:space-between;align-items:flex-start;gap:6px;">
            <div style="min-width:0;">
              <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ it.label || it.name }}</div>
              <div class="mono faint" style="font-size:10px;">{{ it.name }}{{ it.version ? ' · v' + it.version : '' }}</div>
            </div>
            <span :class="'tag-chip ' + statusOf(it).cls" style="flex-shrink:0;">{{ statusOf(it).icon }} {{ statusOf(it).label }}</span>
          </div>

          <div v-if="it.description" class="faint" style="font-size:11px;margin:5px 0;line-height:1.4;max-height:32px;overflow:hidden;">{{ it.description }}</div>

          <div class="kv" style="margin-top:6px;">
            <div class="kv-row" v-if="it.lang || it.author"><span class="kv-k" style="width:58px;">元数据</span><span class="kv-v mono" style="font-size:11px;">{{ [it.lang, it.author].filter(Boolean).join(' · ') }}{{ it.routes ? ' · ' + it.routes + ' 路由' : '' }}</span></div>
            <div class="kv-row" v-if="it.alive"><span class="kv-k" style="width:58px;">进程</span><span class="kv-v mono" style="font-size:11px;">PID {{ it.pid }} · :{{ it.port }} · 已运行 {{ fmtUp(it.uptime_sec) }}</span></div>
            <div class="kv-row"><span class="kv-k" style="width:58px;">检测</span><span class="kv-v mono" style="font-size:11px;">子进程 {{ it.alive ? '✔' : '✘' }} · 健康端 {{ it.health_http ? '✔' : '✘' }} · 前端 {{ it.asset_ok ? '✔' : '—' }}</span></div>
            <div class="kv-row" v-if="it.dead_count"><span class="kv-k" style="width:58px;">退避</span><span class="kv-v" style="font-size:11px;color:var(--warn,#f0b429);">已崩 {{ it.dead_count }} 次</span></div>
          </div>

          <div v-if="it.log_tail" class="mono faint" style="font-size:10px;margin-top:6px;background:rgba(0,0,0,.18);padding:4px 6px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" :title="it.log_tail">{{ it.log_tail.split('\n').slice(-1)[0] }}</div>
          <div v-else-if="it.error" class="mono" style="font-size:10px;margin-top:6px;color:var(--danger,#f85149);">{{ it.error }}</div>

          <div class="flex" style="gap:6px;margin-top:8px;justify-content:flex-end;">
            <button class="btn btn-sm" @click="logName = it.name; tab = 'logs'; loadLog(it.name)">日志</button>
          </div>
        </div>
      </div>
      <button class="btn btn-sm" style="margin-top:8px;" @click="load">立即检测</button>
    </div>

    <!-- ===== 全部插件(表格) ===== -->
    <div v-else-if="tab === 'table'">
      <div class="flex" style="gap:8px;margin-bottom:8px;">
        <input v-model="q" class="input" style="flex:1;" placeholder="筛选插件(名称/描述)…" />
        <button class="btn btn-sm" @click="load">刷新</button>
      </div>
      <table class="table">
        <thead>
          <tr><th>插件</th><th>版本</th><th>类型/作者</th><th>PID</th><th>端口</th><th>运行</th><th>状态</th><th>资产</th><th>退避</th></tr>
        </thead>
        <tbody>
          <tr v-for="it in filtered" :key="it.name">
            <td class="mono">{{ it.label || it.name }}<div class="mono faint" style="font-size:10px;">{{ it.name }}</div></td>
            <td class="mono faint" style="font-size:11px;">{{ it.version }}</td>
            <td class="mono faint" style="font-size:11px;">{{ it.lang || '?' }}{{ it.author ? ' · ' + it.author : '' }}</td>
            <td class="mono faint" style="font-size:11px;">{{ it.pid || '–' }}</td>
            <td class="mono faint" style="font-size:11px;">{{ it.port || '–' }}</td>
            <td class="mono faint" style="font-size:11px;">{{ fmtUp(it.uptime_sec) }}</td>
            <td><span :class="'tag-chip ' + statusOf(it).cls">{{ statusOf(it).label }}</span></td>
            <td class="mono faint">{{ it.asset_ok ? '✔' : '—' }}</td>
            <td class="mono faint" :style="{color: it.dead_count ? '#f0b429' : ''}">{{ it.dead_count || '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===== 独立日志 ===== -->
    <div v-else>
      <div class="section">
        <div class="section-title">插件日志</div>

        <!-- 来源切换 -->
        <div class="flex" style="gap:8px;margin-bottom:10px;">
          <button class="btn btn-sm" :class="{ 'btn-primary': logSource === 'system' }" @click="logSource = 'system'; logName && loadLog(logName)">系统日志</button>
          <button class="btn btn-sm" :class="{ 'btn-primary': logSource === 'runtime' }" @click="logSource = 'runtime'; logName && loadLog(logName)">进程控制台</button>
          <span class="hint" style="font-size:11px;flex:1;align-self:center;">
            {{ logSource === 'system' ? '主系统日志中的插件安装/加载/错误/运行痕迹' : '插件子进程自身的 stdout/stderr 完整输出' }}
          </span>
        </div>

        <div class="flex" style="gap:8px;margin-bottom:8px;">
          <select v-model="logName" class="input" style="flex:1" @change="logName && loadLog(logName)">
            <option value="">选择插件…</option>
            <option v-for="it in items" :key="it.name" :value="it.name">{{ it.label || it.name }}</option>
          </select>
          <button class="btn btn-primary" @click="logName && loadLog(logName)" :disabled="!logName || logLoading">{{ logLoading ? '读取中…' : '读取日志' }}</button>
        </div>

        <!-- 查看范围 + 过滤 + 文件信息 -->
        <div class="flex" style="gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap;" v-if="logName">
          <select v-model="logLines" class="input" style="width:130px;" @change="logName && loadLog(logName)">
            <option :value="100">最近 100 行</option>
            <option :value="500">最近 500 行</option>
            <option :value="2000">最近 2000 行</option>
            <option :value="10000">最近 10000 行</option>
            <option :value="0">完整日志(全部)</option>
          </select>
          <input v-model="logGrep" class="input" style="width:200px;" placeholder="grep 过滤…" @keydown.enter="logName && loadLog(logName)" />
          <button class="btn btn-sm" v-if="logGrep" @click="logGrep = ''; loadLog(logName)">清过滤</button>
          <button class="btn btn-sm" @click="logLines = 0; loadLog(logName)" :disabled="logLines === 0">全部日志</button>
          <button class="btn btn-sm btn-ghost" @click="loadLog(logName)">刷新</button>
          <span v-if="logInfo && logInfo.exists" class="mono faint" style="font-size:11px;margin-left:auto;">
            {{ logInfo.total_lines }} 行 · {{ fmtSize(logInfo.size) }}
          </span>
        </div>

        <div v-if="logLoading" class="loading"><div class="spinner"></div> 加载日志...</div>
        <pre v-else-if="logText" class="mono-block ph-logbox" style="max-height:60vh;overflow:auto;white-space:pre-wrap;font-size:12px;">{{ logText }}</pre>
        <p v-else class="hint">选择插件后点击读取日志; 可选完整日志或按行数/grep 查看</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 子选项卡(与其它页面一致) */
.parent-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border,#2d333b ); margin-bottom: 14px; }
.parent-tab {
  padding: 8px 16px; font-size: 13px; cursor: pointer;
  color: var(--border-strong,#6e7681); border-bottom: 2px solid transparent;
  background: transparent;
}
.parent-tab.on { color: var(--accent,#4da3ff); border-bottom-color: var(--accent,#4da3ff); font-weight: 600; }
.parent-tab:hover { color: var(--text,#e6edf3); }

/* 统计卡 */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 14px; }
.stat-card { background: var(--surface,#161b22); border: 1px solid var(--border,#2d333b); border-radius: 6px; padding: 14px 16px; }
.stat-num { font-size: 26px; font-weight: 700; }
.stat-num.accent { color: var(--accent,#4da3ff); }
.stat-num.warn { color: #f0b429; }
.stat-num.muted { color: var(--border-strong,#6e7681); }
.stat-label { font-size: 12px; color: var(--border-strong,#6e7681); margin-top: 2px; }

/* 元信息键值行 */
.kv { margin: 4px 0; }
.kv-row { display: flex; gap: 8px; padding: 3px 0; font-size: 12px; align-items: baseline; }
.kv-k { color: var(--border-strong,#6e7681); flex-shrink: 0; }
.kv-v { flex: 1; word-break: break-all; }
</style>