<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlugins } from '../stores/plugins'
import { api } from '../api'
import RealtimeChart from './sys/RealtimeChart.vue'

const router = useRouter()
const { plugins, remove } = usePlugins()

const FUNC_COUNTS = {
  touchgal: 3,
  yulotool: 25,
  jmcomic: 4,
  laizhangsetu: 3,
}

const funcCount = computed(() =>
  plugins.value.reduce((n, p) => n + (FUNC_COUNTS[p.name] || 1), 0)
)

const sys = ref(null)
let sysTimer = null

// --- 滚动时间序列（仿任务管理器性能页）---
const MAX = 200
const hist = reactive({
  cpu: [],
  pc: [],
  mem: [],
  swap: [],
  netUp: [],
  netDown: [],
  disk: [],
  load1: [],
  load5: [],
  load15: [],
  ifaces: {}, // name -> { up: [], down: [] }
})

function push(arr, v) {
  arr.push(v)
  if (arr.length > MAX) arr.shift()
}

function pushIface(name, up, down) {
  if (!hist.ifaces[name]) hist.ifaces[name] = { up: [], down: [] }
  push(hist.ifaces[name].up, up)
  push(hist.ifaces[name].down, down)
}

const C = {
  cpu: '#6d5cff',
  mem: '#3fb950',
  swap: '#f0b429',
  down: '#3fb950',
  up: '#6d5cff',
  disk: '#58a6ff',
  load: ['#6d5cff', '#3fb950', '#f0b429'],
}

const CORE_PALETTE = ['#6d5cff', '#3fb950', '#f0b429', '#58a6ff',
                      '#a371f7', '#f85149', '#39c5cf', '#d29922']
function perCoreColor(i) { return CORE_PALETTE[i % CORE_PALETTE.length] }

// --- disks (lsblk) ---
const disks = ref([])
const diskError = ref('')
const unmounting = ref('')
const newDisks = ref(new Set())
let diskTimer = null
let prevDisks = null

async function loadDisks() {
  try {
    const data = await api.disks()
    const list = data.disks || []
    if (prevDisks) {
      const prev = new Set(prevDisks.map((d) => d.path))
      const fresh = new Set()
      for (const d of list) {
        if (d.hotplug && !prev.has(d.path)) fresh.add(d.path)
      }
      if (fresh.size) newDisks.value = fresh
    }
    prevDisks = list
    disks.value = list
    diskError.value = ''
  } catch (e) {
    diskError.value = e.message
  }
}

async function doUnmount(part) {
  if (!window.confirm(`确定卸载 ${part.path}（${part.mountpoint}）？`)) return
  unmounting.value = part.path
  try {
    await api.diskUnmount(part.path)
    await loadDisks()
    loadSys()
  } catch (e) {
    window.alert('卸载失败: ' + e.message)
  } finally {
    unmounting.value = ''
  }
}

function fmtBytes(b) {
  if (!b) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(1)} ${units[i]}`
}

function fmtRate(r) {
  return `${fmtBytes(r || 0)}/s`
}

function fmtDuration(sec) {
  if (!sec) return '-'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  let s = ''
  if (d > 0) s += `${d}天`
  if (h > 0 || d > 0) s += `${h}时`
  s += `${m}分`
  return s
}

function fmtClock(ts) {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const nowClock = ref(fmtClock(Date.now() / 1000))
let clockTimer = null

function pctBar(p) {
  return Math.max(0, Math.min(100, p || 0))
}

// --- 磁盘总览（合计）---
const diskAgg = computed(() => {
  const list = (sys.value && sys.value.disks) || []
  if (!list.length) {
    const s = sys.value
    return { used: s && s.disk_used, total: s && s.disk_total, percent: s && s.disk_percent }
  }
  const used = list.reduce((n, d) => n + (d.used || 0), 0)
  const total = list.reduce((n, d) => n + (d.total || 0), 0)
  return { used, total, percent: total ? (used / total) * 100 : 0 }
})

// mountpoint -> usage map from sys.disks
const mountUsage = computed(() => {
  const map = {}
  for (const d of (sys.value && sys.value.disks) || []) {
    if (d.mountpoint) map[d.mountpoint] = d
  }
  return map
})

const activeIfaces = computed(() => {
  return Object.keys(hist.ifaces)
    .map((name) => ({
      name,
      up: hist.ifaces[name].up,
      down: hist.ifaces[name].down,
      last: (hist.ifaces[name].down[hist.ifaces[name].down.length - 1] || 0) +
            (hist.ifaces[name].up[hist.ifaces[name].up.length - 1] || 0),
    }))
    .sort((a, b) => b.last - a.last)
    .slice(0, 3)
})

function diskUsedPct(part) {
  const u = mountUsage.value[part.mountpoint]
  if (!u) return null
  return u.percent
}

async function loadSys() {
  try {
    const s = await api.sysInfo()
    sys.value = s
    push(hist.cpu, s.cpu_percent || 0)
    if (s.cpu_per_core && s.cpu_per_core.length) {
      s.cpu_per_core.forEach((v, i) => {
        if (!hist.pc[i]) hist.pc[i] = []
        push(hist.pc[i], v || 0)
      })
    }
    push(hist.mem, s.memory_percent || 0)
    push(hist.swap, s.swap_percent || 0)
    push(hist.netUp, s.net_up_rate || 0)
    push(hist.netDown, s.net_down_rate || 0)
    push(hist.disk, diskAgg.value.percent || 0)
    if (s.load_avg && s.load_avg.length >= 3) {
      push(hist.load1, s.load_avg[0])
      push(hist.load5, s.load_avg[1])
      push(hist.load15, s.load_avg[2])
    }
    if (s.net_interfaces && s.net_interfaces.length) {
      for (const ni of s.net_interfaces) {
        if (ni.up) pushIface(ni.name, ni.up_rate || 0, ni.down_rate || 0)
      }
      for (const name of Object.keys(hist.ifaces)) {
        if (!s.net_interfaces.some((ni) => ni.name === name)) {
          pushIface(name, 0, 0)
        }
      }
    }
  } catch (e) {}
}

onMounted(() => {
  loadSys()
  loadDisks()
  sysTimer = setInterval(loadSys, 300)
  diskTimer = setInterval(loadDisks, 3000)
  clockTimer = setInterval(() => { nowClock.value = fmtClock(Date.now() / 1000) }, 1000)
})

onUnmounted(() => {
  if (sysTimer) clearInterval(sysTimer)
  if (diskTimer) clearInterval(diskTimer)
  if (clockTimer) clearInterval(clockTimer)
})

async function removePlugin(name) {
  if (!window.confirm(`确定要移除插件 "${name}" 吗？`)) return
  try {
    await remove(name)
    if (router.currentRoute.value.name === 'plugin' &&
        router.currentRoute.value.params.name === name) {
      router.push('/')
    }
  } catch (e) {
    window.alert('移除失败: ' + e.message)
  }
}

function openPlugin(name) { router.push(`/plugin/${name}`) }
</script>

<template>
  <div>
    <h1>工作台</h1>
    <div class="subtitle">已加载 {{ plugins.length }} 个插件</div>

    <div class="section" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div>
        <div style="font-size:26px;font-weight:800;font-family:var(--font-mono);">{{ plugins.length }}</div>
        <div style="font-size:12px;color:var(--text-faint);">已安装插件</div>
      </div>
      <div>
        <div style="font-size:26px;font-weight:800;font-family:var(--font-mono);">{{ funcCount }}</div>
        <div style="font-size:12px;color:var(--text-faint);">可用功能</div>
      </div>
      <div>
        <div style="font-size:26px;font-weight:800;font-family:var(--font-mono);">v1.0</div>
        <div style="font-size:12px;color:var(--text-faint);">应用版本</div>
      </div>
    </div>

    <div v-if="sys" class="section">
      <div class="section-title">服务器状态
        <span style="float:right;font-weight:400;font-family:var(--font-mono);font-size:12px;color:var(--text-faint);">服务器时间 {{ nowClock }}</span>
      </div>

      <div class="info-grid">
        <div>
          <div style="font-size:12px;color:var(--text-faint);">主机名</div>
          <div style="font-size:15px;font-weight:700;font-family:var(--font-mono);">{{ sys.hostname || '-' }}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-faint);">系统</div>
          <div style="font-size:13px;font-weight:600;">{{ sys.platform || '-' }} ({{ sys.arch || '-' }})</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-faint);">CPU 型号</div>
          <div style="font-size:13px;font-weight:600;font-family:var(--font-mono);">{{ sys.cpu_model || '-' }}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-faint);">内存可用</div>
          <div style="font-size:15px;font-weight:700;font-family:var(--font-mono);">{{ fmtBytes(sys.memory_available) }}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-faint);">运行时长 / 启动</div>
          <div style="font-size:15px;font-weight:700;font-family:var(--font-mono);">{{ fmtDuration(sys.uptime) }}</div>
          <div style="font-size:11px;font-family:var(--font-mono);color:var(--text-faint);">{{ fmtClock(sys.boot_time) }} 启动</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-faint);">Python</div>
          <div style="font-size:15px;font-weight:700;font-family:var(--font-mono);">{{ sys.python_version || '-' }}</div>
        </div>
      </div>

      <div class="info-grid" style="margin-top:12px;">
        <div style="grid-column:1/-1;">
          <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">网卡 IP</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <span v-for="ni in sys.net_interfaces" :key="ni.name"
                  style="font-size:12px;font-family:var(--font-mono);background:var(--bg);border:1px solid var(--border);padding:3px 8px;">
              <span :style="{ color: ni.up ? 'var(--success)' : 'var(--danger)' }">●</span>
              {{ ni.name }} {{ ni.addr || '-' }}
            </span>
          </div>
        </div>
      </div>

      <div class="perf-grid">
        <!-- CPU -->
        <div class="perf-card perf-card-wide">
          <div class="perf-head">
            <span>CPU（{{ sys.cpu_count }}核）</span>
            <span class="perf-val">{{ (sys.cpu_percent || 0).toFixed(1) }}%</span>
          </div>
          <div class="core-grid">
            <div v-for="(c, i) in sys.cpu_per_core" :key="i" class="core-card">
              <div class="core-head">
                <span>核 {{ i + 1 }}</span>
                <span class="perf-val" style="font-size:12px;">{{ (c || 0).toFixed(0) }}%</span>
              </div>
              <RealtimeChart :series="[{ name: '核' + (i + 1), data: hist.pc[i] || [], color: perCoreColor(i) }]" :max="100" :height="64" />
            </div>
            <div v-if="!sys.cpu_per_core || !sys.cpu_per_core.length" class="hint" style="grid-column:1/-1;">无核数据</div>
          </div>
        </div>

        <!-- 内存 + 交换 -->
        <div class="perf-card">
          <div class="perf-head">
            <span>内存</span>
            <span class="perf-val">{{ fmtBytes(sys.memory_used) }} / {{ fmtBytes(sys.memory_total) }}</span>
          </div>
          <RealtimeChart :series="[
            { name: '内存', data: hist.mem, color: C.mem },
            { name: '交换', data: hist.swap, color: C.swap },
          ]" :max="100" :height="120" />
          <div v-if="sys.swap_total" style="display:flex;justify-content:space-between;font-size:11px;margin-top:8px;">
            <span style="color:var(--text-faint);">交换 {{ fmtBytes(sys.swap_used) }} / {{ fmtBytes(sys.swap_total) }}</span>
            <span style="font-family:var(--font-mono);">{{ sys.swap_percent }}%</span>
          </div>
        </div>

        <!-- 磁盘总览 -->
        <div class="perf-card">
          <div class="perf-head">
            <span>磁盘</span>
            <span class="perf-val">{{ fmtBytes(diskAgg.used) }} / {{ fmtBytes(diskAgg.total) }}</span>
          </div>
          <RealtimeChart :series="[{ name: '磁盘', data: hist.disk, color: C.disk }]" :max="100" :height="120" />
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:8px;">
            <span style="color:var(--text-faint);">总占用 {{ diskAgg.percent.toFixed(1) }}%</span>
            <span style="color:var(--text-faint);">剩余 {{ fmtBytes((diskAgg.total || 0) - (diskAgg.used || 0)) }}</span>
          </div>
        </div>

        <!-- Load Average -->
        <div class="perf-card">
          <div class="perf-head">
            <span>Load Average</span>
            <span class="perf-val" v-if="sys.load_avg && sys.load_avg.length">
              {{ sys.load_avg[0].toFixed(2) }} / {{ sys.load_avg[1].toFixed(2) }} / {{ sys.load_avg[2].toFixed(2) }}
            </span>
          </div>
          <RealtimeChart :series="[
            { name: '1m', data: hist.load1, color: C.load[0] },
            { name: '5m', data: hist.load5, color: C.load[1] },
            { name: '15m', data: hist.load15, color: C.load[2] },
          ]" :height="120" />
        </div>

        <!-- 网络（多曲线，两栏） -->
        <div class="perf-card perf-card-wide">
          <div class="perf-head">
            <span>网络</span>
            <span class="perf-val">
              ↓ {{ fmtRate(sys.net_down_rate) }} &nbsp; ↑ {{ fmtRate(sys.net_up_rate) }}
            </span>
          </div>
          <div class="net-grid">
            <div>
              <RealtimeChart :series="[
                { name: '下行', data: hist.netDown, color: C.down },
                { name: '上行', data: hist.netUp, color: C.up },
              ]" :height="150" />
              <div style="font-size:11px;font-family:var(--font-mono);color:var(--text-faint);margin-top:6px;">
                累计收 {{ fmtBytes(sys.net_recv) }} / 发 {{ fmtBytes(sys.net_sent) }}
              </div>
            </div>
            <div v-if="activeIfaces.length" style="border-left:1px solid var(--border);padding-left:14px;">
              <div style="font-size:11px;color:var(--text-faint);margin-bottom:6px;">分接口</div>
              <div v-for="ifc in activeIfaces" :key="ifc.name" style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font-mono);margin-bottom:2px;">
                  <span>{{ ifc.name }}</span>
                  <span>
                    <span style="color:var(--success);">↓{{ fmtRate(ifc.down[ifc.down.length - 1]) }}</span>
                    &nbsp;
                    <span style="color:var(--accent);">↑{{ fmtRate(ifc.up[ifc.up.length - 1]) }}</span>
                  </span>
                </div>
                <RealtimeChart :series="[
                  { name: '下行', data: ifc.down, color: C.down },
                  { name: '上行', data: ifc.up, color: C.up },
                ]" :height="60" />
              </div>
            </div>
          </div>
          <div style="font-size:11px;font-family:var(--font-mono);color:var(--text-faint);margin-top:6px;">
            进程 {{ sys.process_count }} / 线程 {{ sys.thread_count }}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">磁盘设备
        <button class="btn btn-sm btn-ghost" style="float:right;" @click="loadDisks">刷新</button>
      </div>
      <div v-if="diskError" class="error" style="margin-bottom:8px;">{{ diskError }}</div>
      <div v-if="!disks.length && !diskError" class="status-line">加载中...</div>

      <div v-for="d in disks" :key="d.path" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-family:var(--font-mono);font-weight:700;">{{ d.path }}</span>
          <span style="color:var(--text-faint);font-size:12px;">{{ d.model || d.tran || '磁盘' }}</span>
          <span style="font-size:12px;font-family:var(--font-mono);">{{ fmtBytes(d.size) }}</span>
          <span v-if="d.hotplug" class="tag-chip" style="background:var(--accent);color:#fff;">热插拔</span>
          <span v-if="d.removable" class="tag-chip" style="background:var(--text-faint);color:#fff;">可移动</span>
          <span v-if="newDisks.has(d.path)" class="tag-chip" style="background:var(--success);color:#fff;">新识别</span>
        </div>
        <div v-if="d.partitions && d.partitions.length" style="margin-top:8px;margin-left:18px;">
          <div v-for="p in d.partitions" :key="p.path"
               style="display:flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;background:var(--surface-2);">
            <span style="font-family:var(--font-mono);font-size:12px;min-width:110px;">{{ p.path }}</span>
            <span style="font-size:11px;color:var(--text-muted);min-width:60px;">{{ p.fstype || '-' }}</span>
            <span style="font-size:12px;font-family:var(--font-mono);min-width:80px;">{{ fmtBytes(p.size) }}</span>
            <span v-if="p.label" style="font-size:11px;color:var(--text-muted);">{{ p.label }}</span>
            <span style="font-size:12px;flex:1;font-family:var(--font-mono);" :class="{ 'text-faint': !p.mounted }">
              {{ p.mounted ? p.mountpoint : '未挂载' }}
            </span>
            <span v-if="diskUsedPct(p) !== null && diskUsedPct(p) !== undefined" style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);min-width:52px;">
              {{ diskUsedPct(p).toFixed(0) }}%
            </span>
            <div v-if="diskUsedPct(p) !== null && diskUsedPct(p) !== undefined" class="progress" style="flex:1;max-width:120px;">
              <div :style="{ width: pctBar(diskUsedPct(p)) + '%' }"></div>
            </div>
            <button v-if="p.mounted" class="btn btn-sm" :disabled="unmounting === p.path" @click="doUnmount(p)">
              {{ unmounting === p.path ? '卸载中...' : '卸载' }}
            </button>
          </div>
        </div>
        <div v-else style="margin-top:6px;margin-left:18px;color:var(--text-faint);font-size:12px;">无分区</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">系统工具</div>
      <div class="card-grid">
        <div class="card" style="aspect-ratio:auto;" @click="router.push('/terminal')">
          <div class="card-body">
            <div class="card-title">终端</div>
            <div class="card-meta">服务器 Shell 命令行</div>
          </div>
        </div>
        <div class="card" style="aspect-ratio:auto;" @click="router.push('/logs')">
          <div class="card-body">
            <div class="card-title">系统日志</div>
            <div class="card-meta">查看运行日志</div>
          </div>
        </div>
        <div class="card" style="aspect-ratio:auto;" @click="router.push('/processes')">
          <div class="card-body">
            <div class="card-title">进程管理</div>
            <div class="card-meta">进程列表与结束</div>
          </div>
        </div>
        <div class="card" style="aspect-ratio:auto;" @click="router.push('/media')">
          <div class="card-body">
            <div class="card-title">媒体中心</div>
            <div class="card-meta">聚合浏览图片与视频</div>
          </div>
        </div>
        <div class="card" style="aspect-ratio:auto;" @click="router.push('/scheduler')">
          <div class="card-body">
            <div class="card-title">定时任务</div>
            <div class="card-meta">生图/抓取/清理调度</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">已安装插件</div>
      <div class="card-grid">
        <div
          v-for="p in plugins"
          :key="p.name"
          class="card"
          style="aspect-ratio:auto;"
          @click="openPlugin(p.name)"
        >
          <div class="card-body">
            <div class="card-title">{{ p.label }}</div>
            <div class="card-meta">{{ p.description }}</div>
            <div style="margin-top:8px;">
              <button class="btn btn-danger btn-sm" @click.stop="removePlugin(p.name)">移除</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!plugins.length" class="empty">加载中...</div>
    </div>
  </div>
</template>

<style scoped>
.perf-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px 16px;
}
.perf-card {
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 14px;
}
.perf-card-wide {
  grid-column: span 3;
}
.net-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 14px;
  align-items: start;
}
@media (max-width: 720px) {
  .net-grid { grid-template-columns: 1fr; }
  .net-grid > div:last-child { border-left: none !important; padding-left: 0 !important; }
}
.core-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}
@media (min-width: 1200px) {
  .core-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
}
.core-card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 8px;
}
.core-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  margin-bottom: 6px;
}
.perf-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
}
.perf-val {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
@media (max-width: 1100px) {
  .perf-grid { grid-template-columns: 1fr 1fr; }
  .perf-card-wide { grid-column: span 2; }
}
@media (max-width: 720px) {
  .perf-grid { grid-template-columns: 1fr; }
  .perf-card-wide { grid-column: span 1; }
}
</style>
