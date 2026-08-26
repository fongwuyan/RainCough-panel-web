<script setup>
// Home 工作台 — 复刻旧 Workspace: 系统概览卡片 + 滚动时序图 + 磁盘表格
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { usePlugins } from '../stores/plugins'
import { systemApi } from '../api/system'

const { plugins, load: loadPlugins } = usePlugins()
loadPlugins()

const sys = ref(null)
let timer = null

// 滚动时序(仿任务管理器)
const MAX = 120
const hist = reactive({
  cpu: [], mem: [], netUp: [], netDown: [], load1: [], load5: [],
})
function push(arr, v) { arr.push(v); if (arr.length > MAX) arr.shift() }

async function tick() {
  try {
    const d = await systemApi.info()
    sys.value = d
    push(hist.cpu, d.cpu_percent || 0)
    push(hist.mem, d.memory_percent || 0)
    push(hist.netUp, d.net_up_rate || 0)
    push(hist.netDown, d.net_down_rate || 0)
    const la = d.load_avg || [0, 0, 0]
    push(hist.load1, la[0]); push(hist.load5, la[1])
  } catch (e) { /* 后端未就绪 */ }
}

function fmtBytes(b) {
  if (!b && b !== 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = b
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return v.toFixed(1) + ' ' + units[i]
}
function fmtRate(r) { return fmtBytes(r || 0) + '/s' }
function fmtDuration(sec) {
  if (!sec) return '-'
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  let s = ''
  if (d > 0) s += d + '天'
  if (h > 0 || d > 0) s += h + '时'
  s += m + '分'
  return s
}

// 迷你折线(SVG path)
function linePath(values, color, w = 220, h = 48) {
  if (!values || values.length < 2) return ''
  const max = Math.max(...values, 1)
  const step = w / (values.length - 1)
  let d = ''
  values.forEach((v, i) => {
    const x = i * step, y = h - (v / max) * (h - 4) - 2
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
  })
  return d
}

const memUsed = computed(() => sys.value ? fmtBytes(sys.value.memory_used) : '-')
const memTotal = computed(() => sys.value ? fmtBytes(sys.value.memory_total) : '-')

onMounted(() => { tick(); timer = setInterval(tick, 3000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="page">
    <div class="page-head hero">
      <div>
        <h1>工作台</h1>
        <p class="subtitle mono">RainCough Core · {{ sys ? sys.hostname : '连接中…' }}</p>
      </div>
      <span v-if="sys" class="chip mono">{{ sys.go_version }}</span>
    </div>

    <div class="page-body">
      <!-- 概览卡片 -->
      <div class="grid cards">
        <div class="card">
          <div class="card-title">CPU</div>
          <div class="big-num mono">{{ sys ? Math.round(sys.cpu_percent) : 0 }}%</div>
          <div class="bar"><div class="bar-fill" :style="{ width: (sys ? sys.cpu_percent : 0) + '%', background: 'var(--accent)' }"></div></div>
          <svg class="spark" :viewBox="'0 0 220 48'">
            <path :d="linePath(hist.cpu, '#6d5cff')" fill="none" stroke="#6d5cff" stroke-width="1.6" />
          </svg>
        </div>
        <div class="card">
          <div class="card-title">内存 {{ memUsed }} / {{ memTotal }}</div>
          <div class="big-num mono">{{ sys ? Math.round(sys.memory_percent) : 0 }}%</div>
          <div class="bar"><div class="bar-fill" :style="{ width: (sys ? sys.memory_percent : 0) + '%', background: '#3fb950' }"></div></div>
          <svg class="spark" :viewBox="'0 0 220 48'">
            <path :d="linePath(hist.mem, '#3fb950')" fill="none" stroke="#3fb950" stroke-width="1.6" />
          </svg>
        </div>
        <div class="card">
          <div class="card-title">负载</div>
          <div class="big-num mono">{{ sys && sys.load_avg ? sys.load_avg[0].toFixed(2) : '-' }}</div>
          <div class="kv-row"><span class="kv-k">1m / 5m</span>
            <span class="kv-v mono">{{ sys ? (sys.load_avg[1] || 0).toFixed(2) : '-' }}</span></div>
          <svg class="spark" :viewBox="'0 0 220 48'">
            <path :d="linePath(hist.load1, '#f0b429')" fill="none" stroke="#f0b429" stroke-width="1.6" />
            <path :d="linePath(hist.load5, '#58a6ff')" fill="none" stroke="#58a6ff" stroke-width="1.2" />
          </svg>
        </div>
        <div class="card">
          <div class="card-title">网络</div>
          <div class="kv-row"><span class="kv-k">↓ 下行</span><span class="kv-v mono ok">{{ sys ? fmtRate(sys.net_down_rate) : '-' }}</span></div>
          <div class="kv-row"><span class="kv-k">↑ 上行</span><span class="kv-v mono">{{ sys ? fmtRate(sys.net_up_rate) : '-' }}</span></div>
          <svg class="spark" :viewBox="'0 0 220 48'">
            <path :d="linePath(hist.netDown, '#3fb950')" fill="none" stroke="#3fb950" stroke-width="1.4" />
            <path :d="linePath(hist.netUp, '#6d5cff')" fill="none" stroke="#6d5cff" stroke-width="1.4" />
          </svg>
        </div>
      </div>

      <!-- 系统信息 -->
      <div class="section">
        <div class="section-title">系统信息</div>
        <div class="grid kv-grid">
          <div class="kv-row"><span class="kv-k">主机名</span><span class="kv-v mono">{{ sys ? sys.hostname : '-' }}</span></div>
          <div class="kv-row"><span class="kv-k">平台</span><span class="kv-v">{{ sys ? (sys.platform + ' / ' + sys.arch) : '-' }}</span></div>
          <div class="kv-row"><span class="kv-k">CPU</span><span class="kv-v">{{ sys ? (sys.cpu_count + ' 核') : '-' }}</span></div>
          <div class="kv-row"><span class="kv-k">运行时长</span><span class="kv-v">{{ sys ? fmtDuration(sys.uptime) : '-' }}</span></div>
          <div class="kv-row"><span class="kv-k">进程数</span><span class="kv-v mono">{{ sys ? sys.process_count : '-' }}</span></div>
          <div class="kv-row"><span class="kv-k">交换分区</span><span class="kv-v">{{ sys ? (sys.swap_percent ? Math.round(sys.swap_percent) + '%' : '0%') : '-' }}</span></div>
        </div>
      </div>

      <!-- 磁盘 -->
      <div class="section">
        <div class="section-title">磁盘</div>
        <table class="table">
          <thead><tr><th>挂载点</th><th>文件系统</th><th>总容量</th><th>已用</th><th>使用率</th></tr></thead>
          <tbody>
            <tr v-for="d in (sys ? sys.disks || [] : [])" :key="d.mountpoint">
              <td class="mono">{{ d.mountpoint }}</td>
              <td class="mono faint">{{ d.fstype }}</td>
              <td class="mono">{{ fmtBytes(d.total) }}</td>
              <td class="mono">{{ fmtBytes(d.used) }}</td>
              <td>
                <div class="bar slim"><div class="bar-fill" :style="{ width: (d.percent || 0) + '%', background: d.percent > 90 ? 'var(--danger)' : 'var(--accent)' }"></div></div>
                <span class="mono faint">{{ Math.round(d.percent || 0) }}%</span>
              </td>
            </tr>
            <tr v-if="!(sys && sys.disks && sys.disks.length)"><td colspan="5" class="faint">加载中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px; }
.big-num { font-size: 30px; font-weight: 800; margin: 6px 0; }
.bar { background: var(--surface-2); border-radius: var(--radius-sm); height: 8px; overflow: hidden; margin: 6px 0; }
.bar.slim { height: 6px; display: inline-block; width: 120px; margin-right: 8px; vertical-align: middle; }
.bar-fill { height: 100%; transition: width .3s; }
.spark { width: 100%; height: 48px; margin-top: 6px; }
.hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.chip { padding: 3px 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-pill); font-size: 12px; }
.kv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0 20px; }
</style>