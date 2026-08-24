<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { api } from '../../api'

const props = defineProps({ instId: { type: String, default: '' } })
const emit = defineEmits(['back'])

const st = ref({})
const error = ref('')
const notice = ref('')
const tab = ref('status')
const tabs = [
  { key: 'status', label: '状态' },
  { key: 'console', label: '控制台' },
  { key: 'players', label: '玩家' },
  { key: 'world', label: '世界' },
  { key: 'mods', label: 'Mod' },
  { key: 'config', label: '配置' },
  { key: 'schedule', label: '计划' },
]

const metrics = ref({})
let statusTimer = null
let cpuTimer = null

// 控制台
const termEl = ref(null)
let term = null
let fit = null
let es = null
const cmd = ref('')
const cmdHistory = ref([])
const cmdIdx = ref(-1)
const consoleReady = ref('未连接')

// 玩家
const players = ref([])
const bans = ref({ players: [], ips: [] })
const targetPlayer = ref('')
const opList = ref([])
const wlList = ref([])
const kickReason = ref('')

// 世界
const worldInfo = ref({})
const backups = ref([])
const importFile = ref(null)
const importing = ref(false)
const backing = ref(false)

// 配置
const cfgGroups = ref([])

// Mod
const mods = ref([])
const modFile = ref(null)
const modding = ref(false)

// 计划
const schedule = ref({ auto_restart: false, backup_interval_hours: 0, backup_keep: 10, restart_at: '' })

function b64ToText(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}
function flash() { setTimeout(() => notice.value = '', 4000) }

async function loadStatus() {
  try { st.value = await api.mcStatus() } catch (e) { error.value = e.message }
}
async function loadMetrics() { try { metrics.value = await api.mcMetrics(); drawChart() } catch (e) {} }
async function loadPlayers() {
  try {
    const [p, b, o, w] = await Promise.all([api.mcPlayers(), api.mcBans(), api.mcOps(), api.mcWhitelist()])
    players.value = p || []; bans.value = b || { players: [], ips: [] }; opList.value = o || []; wlList.value = w || []
  } catch (e) { error.value = e.message }
}
async function loadWorld() {
  try {
    const [info, bs] = await Promise.all([api.mcWorldInfo(), api.mcWorldBackups()])
    worldInfo.value = info || {}; backups.value = bs || []
  } catch (e) { error.value = e.message }
}
async function loadConfig() { try { cfgGroups.value = (await api.mcConfig()).groups || [] } catch (e) { error.value = e.message } }
async function loadMods() { try { mods.value = (await api.mcMods()).mods || [] } catch (e) { error.value = e.message } }
async function loadSchedule() { try { schedule.value = await api.mcSchedule() } catch (e) {} }

function reload() {
  loadStatus(); loadMetrics(); loadSchedule()
  if (tab.value === 'players') loadPlayers()
  if (tab.value === 'world') loadWorld()
  if (tab.value === 'config') loadConfig()
  if (tab.value === 'mods') loadMods()
}

onMounted(() => {
  reload()
  statusTimer = setInterval(() => {
    loadStatus(); loadMetrics()
    if (tab.value === 'players') loadPlayers()
  }, 3000)
  if (tab.value === 'console') nextTick(initTerm)
})
onBeforeUnmount(() => {
  clearInterval(statusTimer); clearInterval(cpuTimer)
  closeStream()
  if (term) { term.dispose(); term = null }
})

watch(() => props.instId, () => { closeStream(); if (term) term.clear(); reload() })

function switchTab(key) {
  tab.value = key
  if (key === 'console') {
    nextTick(() => { if (!term) initTerm(); if (!es) openStream() })
  }
  if (key === 'players') loadPlayers()
  if (key === 'world') loadWorld()
  if (key === 'config') loadConfig()
  if (key === 'mods') loadMods()
  if (key === 'schedule') loadSchedule()
}

// 启停
async function start() {
  try { const r = await api.mcStart(); notice.value = r.message; flash() } catch (e) { error.value = e.message }
  loadStatus(); loadMetrics()
}
async function stop(force) {
  if (!force && !confirm('停止服务器并保存存档？')) return
  if (force && !confirm('强制停止（不保存存档）？')) return
  try { const r = await api.mcStop(force); notice.value = r.message; flash() } catch (e) { error.value = e.message }
  loadStatus(); loadMetrics()
}
async function restart() {
  if (!confirm('重启服务器？')) return
  try { const r = await api.mcRestart(); notice.value = r.message; flash() } catch (e) { error.value = e.message }
  loadStatus(); loadMetrics()
}

// 控制台
function initTerm() {
  if (term) return
  term = new Terminal({ fontFamily: '"Cascadia Mono", Consolas, monospace', fontSize: 13, cursorBlink: true, scrollback: 5000, theme: { background: '#0f1216', foreground: '#d7dce4', cursor: '#6cb6ff' } })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.open(termEl.value)
  fit.fit()
  term.onData(onTermData)
  window.addEventListener('resize', onWinResize)
  loadConsole(); openStream()
}
function onWinResize() { if (fit && term) fit.fit() }
function onTermData(d) {
  if (d === '\r') sendCmd()
  else if (d !== '\u007f') term.write(d)
}
function closeStream() { if (es) { es.close(); es = null; consoleReady.value = '未连接' } }
function openStream() {
  closeStream()
  es = new EventSource(api.mcStream())
  es.onopen = () => (consoleReady.value = '已连接')
  es.onmessage = (ev) => { if (ev.data && term) term.write(b64ToText(ev.data)) }
  es.addEventListener('closed', () => { consoleReady.value = '已结束'; closeStream() })
  es.onerror = () => { if (consoleReady.value === '已结束') closeStream() }
}
async function loadConsole() { try { if (term) { const r = await api.mcConsole(); if (r.log) term.write(r.log) } } catch (e) {} }
async function sendCmd() {
  const c = cmd.value.trim()
  if (!c) return
  if (term) term.write('\r\n' + c + '\r\n')
  try { const r = await api.mcCommand(c); if (r.echo && term) term.write(r.echo + '\r\n') } catch (e) { error.value = e.message }
  cmdHistory.value.push(c); if (cmdHistory.value.length > 30) cmdHistory.value.shift()
  cmdIdx.value = -1; cmd.value = ''
  cmdHistory.value = cmdHistory.value
}
function cmdKeydown(e) {
  if (e.key === 'Enter') { sendCmd(); return }
  if (e.key === 'ArrowUp') {
    if (cmdHistory.value.length) { cmdIdx.value = cmdIdx.value < 0 ? cmdHistory.value.length - 1 : Math.max(0, cmdIdx.value - 1); cmd.value = cmdHistory.value[cmdIdx.value] }
    e.preventDefault()
  }
  if (e.key === 'ArrowDown') {
    if (cmdIdx.value >= 0) { cmdIdx.value = Math.min(cmdHistory.value.length - 1, cmdIdx.value + 1); cmd.value = cmdHistory.value[cmdIdx.value] || '' }
    e.preventDefault()
  }
}

// 玩家
function fmtSize(b) { if (!b) return '—'; if (b < 1024) return b + ' B'; if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'; return (b / 1024 / 1024).toFixed(1) + ' MB' }
function fmtTime(t) { if (!t) return '—'; return new Date(t * 1000).toLocaleString() }
async function wlAction(action) { if (!targetPlayer.value.trim()) return; try { await api.mcWhitelistAction(action, targetPlayer.value.trim()) } catch (e) { error.value = e.message } loadPlayers() }
async function opAction(action) { if (!targetPlayer.value.trim()) return; try { await api.mcOpsAction(action, targetPlayer.value.trim()) } catch (e) { error.value = e.message } loadPlayers() }
async function kickPlayer(name) { if (!confirm(`踢出玩家 ${name}？`)) return; try { await api.mcKick(name, kickReason.value) } catch (e) { error.value = e.message } loadPlayers() }
async function banPlayer(name) { if (!confirm(`封禁玩家 ${name}？`)) return; try { await api.mcBan(name) } catch (e) { error.value = e.message } loadPlayers() }
async function unbanPlayer(name) { try { await api.mcUnban(name) } catch (e) { error.value = e.message } loadPlayers() }
async function banIp(ip) { try { await api.mcBanIp(ip) } catch (e) { error.value = e.message } loadPlayers() }
async function pardonIp(ip) { try { await api.mcPardonIp(ip) } catch (e) { error.value = e.message } loadPlayers() }

// 世界
async function backupWorld() {
  backing.value = true; error.value = ''
  try { const r = await api.mcBackup(); notice.value = `备份完成：${r.name}`; flash() } catch (e) { error.value = e.message }
  backing.value = false; loadWorld()
}
async function restoreWorld(name) {
  if (!confirm(`用备份 ${name} 恢复世界？将替换当前 world 目录！`)) return
  try { const r = await api.mcWorldRestore(name); notice.value = r.message; flash() } catch (e) { error.value = e.message }
  loadWorld()
}
async function deleteBackup(name) { if (!confirm(`删除备份 ${name}？`)) return; try { await api.mcWorldBackupDelete(name) } catch (e) { error.value = e.message } loadWorld() }
function onImportFile(e) { importFile.value = e.target.files[0] || null }
async function importWorld() {
  if (!importFile.value) { error.value = '请选择世界 zip'; return }
  if (st.value.running) { error.value = '请先停止服务器再导入'; return }
  if (!confirm('导入世界将替换当前 world 目录，继续？')) return
  importing.value = true; error.value = ''
  try { const fd = new FormData(); fd.append('file', importFile.value); const r = await api.mcImport(fd); notice.value = r.message; flash(); importFile.value = null } catch (e) { error.value = e.message }
  importing.value = false; loadWorld()
}

// 配置 / Mod / 计划
function saveConfig() {
  const flat = {}
  cfgGroups.value.forEach(g => g.items.forEach(it => (flat[it.key] = it.value)))
  api.mcSaveConfig(flat).then(r => { notice.value = r.message; flash() }).catch(e => error.value = e.message)
}
function onModFile(e) { modFile.value = e.target.files[0] || null }
async function uploadMod() {
  if (!modFile.value) { error.value = '请选择 .jar Mod'; return }
  if (st.value.running) { error.value = '请先停止服务器再安装 Mod'; return }
  modding.value = true; error.value = ''
  try { const fd = new FormData(); fd.append('file', modFile.value); const r = await api.mcModsUpload(fd); notice.value = r.message; flash(); modFile.value = null } catch (e) { error.value = e.message }
  modding.value = false; loadMods()
}
async function deleteMod(name) { if (!confirm(`删除 Mod ${name}？`)) return; try { const r = await api.mcModsDelete(name); notice.value = r.message; flash() } catch (e) { error.value = e.message } loadMods() }
async function saveSchedule() { try { await api.mcScheduleSave(schedule.value); notice.value = '计划已保存'; flash() } catch (e) { error.value = e.message } }

// 监控图
function drawChart() {
  const c = document.getElementById('mc-metrics-canvas')
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  const w = c.clientWidth, h = c.clientHeight
  if (!w) return
  if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px' }
  const ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const hc = metrics.value.hist_cpu || [], hm = metrics.value.hist_mem || []
  if (!hc.length) return
  function line(arr, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath()
    arr.forEach((v, i) => {
      const x = w - (arr.length - i) * (w / Math.max(1, arr.length - 1))
      const y = h - (v / 100) * h
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
  }
  line(hc, 'rgba(108,182,255,0.9)')
  line(hm, 'rgba(255,170,150,0.9)')
  ctx.strokeStyle = 'rgba(128,128,128,0.15)'; ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); ctx.stroke() }
}
</script>

<template>
  <div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <h1 style="margin:0;">{{ st.inst_label || props.instId }}</h1>
      <button class="btn btn-sm btn-ghost" @click="emit('back')">← 返回实例列表</button>
      <span class="tag-chip" :class="st.running ? 'ok' : 'fail'">{{ st.running ? '运行中' : '已停止' }}</span>
      <span v-if="st.running" class="tag-chip">在线 {{ st.player_count || 0 }}/{{ st.max_players }}</span>
      <span class="tag-chip">端口 {{ st.port }}</span>
    </div>
    <div class="subtitle">实例 ID：{{ props.instId }} · {{ st.running ? `运行 ${st.uptime != null ? Math.floor(st.uptime/3600) + 'h' + Math.floor(st.uptime%3600/60) + 'm' : ''}` : '离线' }}</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin-top:12px;">{{ notice }}</div>

    <div class="tabs" style="margin-top:16px;">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
    </div>

    <!-- 状态 -->
    <div v-if="tab === 'status'" class="section" style="margin-top:16px;">
      <div class="section-title">服务器状态</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;">
        <span class="tag-chip" :class="st.running ? 'ok' : 'fail'">{{ st.running ? '运行中' : '已停止' }}</span>
        <span v-if="st.player_count != null && st.running" class="tag-chip">在线 {{ st.player_count }}/{{ st.max_players }}</span>
        <span class="tag-chip">{{ st.version || 'Fabric' }}</span>
        <span class="tag-chip">端口 {{ st.port }}</span>
        <span class="tag-chip">地址 {{ st.host }}:{{ st.port }}</span>
        <span v-if="st.tps" class="tag-chip">TPS {{ st.tps }}</span>
        <span class="tag-chip">{{ st.online_mode === 'true' ? '正版验证' : '离线模式' }}</span>
      </div>
      <div v-if="st.running && st.players && st.players.length" style="margin-top:8px;">
        <span class="hint" style="font-size:12px;">在线: </span><span v-for="p in st.players" :key="p" class="tag-chip">{{ p }}</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button v-if="!st.running" class="btn btn-primary" @click="start">启动服务器</button>
        <template v-else>
          <button class="btn" @click="stop(false)">停止 (保存)</button>
          <button class="btn" @click="restart">重启</button>
          <button class="btn btn-danger" @click="stop(true)">强制停止</button>
        </template>
      </div>
    </div>

    <!-- 监控 -->
    <div v-if="tab === 'status'" class="section" style="margin-top:16px;">
      <div class="section-title">系统监控</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:10px;font-size:13px;">
        <span>系统 CPU <b>{{ metrics.cpu }}</b>%</span>
        <span>系统内存 <b>{{ metrics.mem_percent }}</b>% ({{ (metrics.mem_used||0).toFixed(0) }}MB / {{ (metrics.mem_total||0).toFixed(0) }}MB)</span>
        <span>JVM CPU <b>{{ metrics.jvm_cpu }}</b>%</span>
        <span>JVM 内存 <b>{{ metrics.jvm_rss_mb }}</b> MB</span>
        <span>磁盘可用 <b>{{ metrics.disk_free ? (metrics.disk_free/1024/1024/1024).toFixed(1) : '—' }}</b> GB</span>
      </div>
      <div style="margin-top:10px;">
        <canvas id="mc-metrics-canvas" style="width:100%;height:120px;"></canvas>
        <div class="hint" style="font-size:11px;margin-top:4px;">蓝 = JVM CPU，红 = 系统内存占用</div>
      </div>
    </div>

    <!-- 控制台 -->
    <div v-if="tab === 'console'" class="section" style="margin-top:16px;">
      <div class="section-title">实时控制台 <span class="tag-chip tag-chip-sm" :class="consoleReady === '已连接' ? 'ok' : ''">{{ consoleReady }}</span></div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <input v-model="cmd" class="input" style="flex:1;font-family:var(--font-mono);" placeholder="输入命令并回车，如 list / op 玩家名 / say 你好 / tps" @keydown="cmdKeydown" />
        <button class="btn btn-primary" :disabled="!st.running" @click="sendCmd">发送</button>
        <button class="btn btn-ghost" @click="loadConsole">重新载入</button>
      </div>
      <div ref="termEl" style="background:#0f1216;border:1px solid var(--border);border-radius: 0;padding:8px;height:420px;overflow:hidden;"></div>
    </div>

    <!-- 玩家 -->
    <div v-if="tab === 'players'" class="section" style="margin-top:16px;">
      <div class="section-title">玩家管理</div>
      <div class="form-row">
        <span class="form-label">玩家名</span>
        <input v-model="targetPlayer" class="input" style="flex:0 0 180px;" placeholder="输入玩家名" />
        <button class="btn btn-sm" :disabled="!st.running" @click="wlAction('add')">白名单加</button>
        <button class="btn btn-sm" :disabled="!st.running" @click="wlAction('remove')">白名单删</button>
        <button class="btn btn-sm" :disabled="!st.running" @click="opAction('add')">设置 OP</button>
        <button class="btn btn-sm" :disabled="!st.running" @click="opAction('remove')">取消 OP</button>
      </div>
      <div class="form-row"><span class="form-label">踢出理由</span><input v-model="kickReason" class="input" style="flex:0 0 200px;" placeholder="可选" /></div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:12px;">
        <div style="flex:1;min-width:280px;">
          <div class="section-title" style="font-size:13px;">在线/存档玩家 ({{ players.length }})</div>
          <div v-if="!players.length" class="hint">暂无</div>
          <table class="mc-table" v-else>
            <thead><tr><th>玩家</th><th>状态</th><th>位置</th><th>最后在线</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="p in players" :key="p.uuid || p.name">
                <td>{{ p.name }}</td>
                <td><span class="tag-chip" :class="p.online ? 'ok' : ''">{{ p.online ? '在线' : '离线' }}</span></td>
                <td style="font-size:12px;font-family:var(--font-mono);">{{ p.pos ? p.pos.join(', ') : '—' }}</td>
                <td style="font-size:12px;">{{ fmtTime(p.last_seen) }}</td>
                <td style="white-space:nowrap;">
                  <button v-if="p.online" class="btn btn-sm" @click="kickPlayer(p.name)">踢</button>
                  <button class="btn btn-sm btn-danger" @click="banPlayer(p.name)">封</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="flex:0 0 300px;">
          <div class="section-title" style="font-size:13px;">OP / 白名单</div>
          <div style="display:flex;gap:12px;">
            <div>
              <div class="hint">OP ({{ opList.length }})</div>
              <div v-if="!opList.length" class="hint" style="font-size:12px;">空</div>
              <div v-else><span v-for="n in opList" :key="n" class="tag-chip ok">{{ n }}</span></div>
            </div>
            <div>
              <div class="hint">白名单 ({{ wlList.length }})</div>
              <div v-if="!wlList.length" class="hint" style="font-size:12px;">空</div>
              <div v-else><span v-for="n in wlList" :key="n" class="tag-chip">{{ n }}</span></div>
            </div>
          </div>
          <div class="section-title" style="font-size:13px;margin-top:12px;">封禁列表</div>
          <div v-if="!bans.players.length && !bans.ips.length" class="hint">无封禁</div>
          <div v-else>
            <div v-for="b in bans.players" :key="b.uuid || b.name" style="margin-bottom:4px;">
              <span class="tag-chip" style="font-size:12px;">{{ b.name }}</span>
              <button class="btn btn-sm btn-ghost" @click="unbanPlayer(b.name)">解封</button>
            </div>
            <div v-for="b in bans.ips" :key="b.ip || b.name" style="margin-bottom:4px;">
              <span class="tag-chip" style="font-size:12px;">IP {{ b.ip }}</span>
              <button class="btn btn-sm btn-ghost" @click="pardonIp(b.ip)">解封</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 世界 -->
    <div v-if="tab === 'world'" class="section" style="margin-top:16px;">
      <div class="section-title">世界管理</div>
      <div v-if="worldInfo.exists" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;">
        <span class="tag-chip">大小 {{ fmtSize(worldInfo.size) }}</span>
        <span class="tag-chip">区域 {{ worldInfo.regions }}</span>
        <span class="tag-chip">玩家存档 {{ worldInfo.playerdata }}</span>
        <span v-if="worldInfo.seed != null" class="tag-chip">种子 {{ worldInfo.seed }}</span>
        <span class="tag-chip">{{ worldInfo.world_name }}</span>
      </div>
      <div v-else class="hint" style="margin-top:8px;">服务器尚未生成世界（world 目录不存在）</div>
      <div class="form-row" style="margin-top:12px;">
        <span class="form-label">手动备份</span>
        <button class="btn" :disabled="backing" @click="backupWorld">{{ backing ? '备份中…' : '立即备份' }}</button>
        <span class="hint">本地留存，可一键恢复</span>
      </div>
      <div class="form-row">
        <span class="form-label">导入世界</span>
        <input type="file" accept=".zip" class="input" @change="onImportFile" />
        <button class="btn btn-primary" :disabled="importing || st.running" @click="importWorld">{{ importing ? '导入中…' : '导入' }}</button>
      </div>
      <div class="section-title" style="font-size:13px;margin-top:12px;">备份列表 ({{ backups.length }})</div>
      <div v-if="!backups.length" class="hint">暂无备份</div>
      <table class="mc-table" v-else>
        <thead><tr><th>备份名</th><th>大小</th><th>时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="b in backups" :key="b.name">
            <td style="font-family:var(--font-mono);font-size:12px;">{{ b.name }}</td>
            <td>{{ fmtSize(b.size) }}</td>
            <td style="font-size:12px;">{{ fmtTime(b.time) }}</td>
            <td style="white-space:nowrap;">
              <a class="btn btn-sm" :href="api.mcWorldDownload(b.name)" target="_blank">下载</a>
              <button class="btn btn-sm" :disabled="st.running" @click="restoreWorld(b.name)">恢复</button>
              <button class="btn btn-sm btn-danger" @click="deleteBackup(b.name)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mod -->
    <div v-if="tab === 'mods'" class="section" style="margin-top:16px;">
      <div class="section-title">Mod 管理</div>
      <div v-if="st.running" class="error" style="margin-bottom:10px;">Mod 增删需先停止服务器！</div>
      <div class="form-row">
        <span class="form-label">上传 Mod</span>
        <input type="file" accept=".jar" class="input" @change="onModFile" />
        <button class="btn btn-primary" :disabled="modding || st.running" @click="uploadMod">{{ modding ? '上传中…' : '上传' }}</button>
      </div>
      <div v-if="!mods.length" class="hint" style="margin-top:10px;">暂无 Mod</div>
      <table v-else class="mc-table" style="margin-top:10px;">
        <thead><tr><th>文件名</th><th>大小</th><th>时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="m in mods" :key="m.name">
            <td style="font-family:var(--font-mono);font-size:12px;">{{ m.name }}</td>
            <td>{{ fmtSize(m.size) }}</td>
            <td style="font-size:12px;">{{ fmtTime(m.time) }}</td>
            <td><button class="btn btn-sm btn-danger" :disabled="st.running" @click="deleteMod(m.name)">删除</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 配置 -->
    <div v-if="tab === 'config'" class="section" style="margin-top:16px;">
      <div class="section-title">完整配置 (server.properties)</div>
      <div v-for="g in cfgGroups" :key="g.group" style="margin-top:14px;">
        <div class="section-title" style="font-size:13px;">{{ g.group }}</div>
        <div v-for="it in g.items" :key="it.key" class="form-row">
          <span class="form-label">{{ it.label }}</span>
          <select v-if="it.type === 'choice'" v-model="it.value" class="select"><option v-for="o in it.options" :key="o" :value="o">{{ o }}</option></select>
          <input v-else-if="it.type === 'bool'" v-model="it.value" class="input" type="text" placeholder="true/false" />
          <input v-else :type="it.type === 'int' ? 'number' : 'text'" v-model="it.value" class="input" :placeholder="it.key" />
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="btn btn-primary" @click="saveConfig">保存配置</button>
        <button class="btn btn-ghost" @click="loadConfig">重新加载</button>
        <span class="hint" style="font-size:11px;align-self:center;">保存后需重启服务器生效</span>
      </div>
    </div>

    <!-- 计划 -->
    <div v-if="tab === 'schedule'" class="section" style="margin-top:16px;">
      <div class="section-title">崩溃守护 / 计划任务</div>
      <div class="form-row">
        <span class="form-label">崩溃自动重启</span>
        <select v-model="schedule.auto_restart" class="select"><option :value="true">启用</option><option :value="false">关闭</option></select>
      </div>
      <div class="form-row">
        <span class="form-label">定时重启时间 (HH:MM)</span>
        <input v-model="schedule.restart_at" class="input" style="flex:0 0 120px;" placeholder="如 04:00，空则关闭" />
      </div>
      <div class="form-row">
        <span class="form-label">自动备份间隔 (小时，0=关闭)</span>
        <input v-model.number="schedule.backup_interval_hours" type="number" class="input" style="flex:0 0 120px;" />
      </div>
      <div class="form-row">
        <span class="form-label">保留备份数</span>
        <input v-model.number="schedule.backup_keep" type="number" class="input" style="flex:0 0 120px;" />
      </div>
      <div style="margin-top:10px;"><button class="btn btn-primary" @click="saveSchedule">保存计划</button></div>
    </div>
  </div>
</template>

<style scoped>
.mc-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
.mc-table th, .mc-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); text-align: left; }
.mc-table th { color: var(--text-faint); font-weight: 500; font-size: 12px; }
</style>