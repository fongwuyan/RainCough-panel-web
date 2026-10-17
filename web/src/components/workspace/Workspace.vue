<script setup>
import { computed } from 'vue'
import RealtimeChart from '../sys/RealtimeChart.vue'
import {
  useWorkspace, num, fmtBytes, fmtRate, fmtDuration, fmtTime,
} from './useWorkspace'

const ws = useWorkspace()
const {
  sys, err, updatedAt, now, gpus, gpuErr, gpuLoading,
  cpu, cores, load, memTotal, memUsed, memPct, swapTotal, swapUsed, swapPct,
  upRate, downRate, ifaces, disks, diskPct, uptime,
  histCpu, histMem, histSwap, histUp, histDown, histDisk, histCore,
  loadGpus,
} = ws

const C = {
  cpu: '#6d5cff',
  mem: '#2b6cb0',
  swap: '#805ad5',
  up: '#c05621',
  down: '#2f855a',
  disk: '#b7791f',
}

const gpuVram = (g) => (g.vram_total ? fmtBytes(g.vram_total) : '—')
const gpuUsage = (g) => (g.usage >= 0 ? g.usage.toFixed(0) + '%' : '—')
const gpuTemp = (g) => (g.temp ? g.temp + '°C' : '—')

const memFree = computed(() => Math.max(0, memTotal.value - memUsed.value))

// 只展示真实存储挂载点: 过滤 tmpfs/overlay 等伪文件系统与 0 字节挂载
const SKIP_MOUNT = ['/run', '/sys', '/proc', '/dev', '/snap', '/var/lib/docker']
const mounts = computed(() =>
  disks.value.filter((d) => {
    if (!d || num(d.total) < 1024 * 1024) return false
    return !SKIP_MOUNT.some((p) => d.mountpoint === p || d.mountpoint.startsWith(p + '/'))
  })
)
const updatedAgo = computed(() => {
  if (!updatedAt.value) return '—'
  const s = Math.max(0, Math.round((now.value - updatedAt.value) / 1000))
  return s <= 1 ? '刚刚' : s + ' 秒前'
})

function coreColor(v) {
  if (v >= 80) return 'var(--danger)'
  if (v >= 50) return 'var(--warning)'
  return 'var(--accent)'
}
</script>

<template>
  <div class="page ws-page">
    <div class="ws-scroll">
      <div v-if="err" class="error ws-err">系统数据获取失败: {{ err }}</div>

      <!-- 概览 -->
      <section class="ws-hero">
        <div class="ws-hero-left">
          <div class="ws-host">{{ (sys && sys.hostname) || '—' }}</div>
          <div class="ws-sub">
            {{ (sys && sys.platform) || '—' }} · {{ (sys && sys.arch) || '—' }}
            <span v-if="sys && sys.cpu_model"> · {{ sys.cpu_model }}</span>
          </div>
        </div>
        <div class="ws-kpis">
          <div class="kpi">
            <b>{{ fmtDuration(uptime) }}</b>
            <span>运行时长</span>
          </div>
          <div class="kpi">
            <b>{{ (sys && sys.process_count) || 0 }}</b>
            <span>进程</span>
          </div>
          <div class="kpi">
            <b>{{ (sys && sys.thread_count) || 0 }}</b>
            <span>线程</span>
          </div>
          <div class="kpi">
            <b class="mono">{{ load.map((x) => num(x).toFixed(2)).join(' / ') }}</b>
            <span>负载 1/5/15</span>
          </div>
        </div>
      </section>

      <div class="ws-grid">
        <!-- CPU -->
        <section class="ws-card">
          <div class="ws-card-head">
            <span class="ws-card-title">CPU</span>
            <span class="ws-card-side">{{ (sys && sys.cpu_count) || 0 }} 核</span>
          </div>
          <div class="ws-big">
            <span class="ws-big-num">{{ cpu.toFixed(1) }}</span><span class="ws-big-unit">%</span>
            <span class="ws-big-note">当前占用</span>
          </div>
          <div class="ws-cores">
            <div v-for="(v, i) in cores" :key="i" class="ws-core" :title="'核 ' + i + ' · ' + num(v).toFixed(1) + '%'">
              <div class="ws-core-bar">
                <i :style="{ height: Math.max(4, num(v)) + '%', background: coreColor(num(v)) }"></i>
              </div>
              <span class="ws-core-idx" :title="num(v).toFixed(1) + '%'">{{ num(v).toFixed(0) }}%</span>
            </div>
          </div>
          <RealtimeChart :series="[{ name: 'CPU %', data: histCpu, color: C.cpu }]" :max="100" :height="72" />
        </section>

        <!-- 内存 -->
        <section class="ws-card">
          <div class="ws-card-head">
            <span class="ws-card-title">内存</span>
            <span class="ws-card-side">{{ fmtBytes(memUsed) }} / {{ fmtBytes(memTotal) }}</span>
          </div>
          <div class="ws-big">
            <span class="ws-big-num">{{ memPct.toFixed(1) }}</span><span class="ws-big-unit">%</span>
            <span class="ws-big-note">已用 {{ fmtBytes(memUsed) }} · 可用 {{ fmtBytes(memFree) }}</span>
          </div>
          <div class="ws-bar">
            <i :style="{ width: Math.min(100, memPct) + '%' }"></i>
          </div>
          <div class="ws-row" v-if="swapTotal > 0">
            <span class="ws-row-k">交换分区</span>
            <div class="ws-bar grow">
              <i class="swap" :style="{ width: Math.min(100, swapPct) + '%' }"></i>
            </div>
            <span class="ws-row-v mono">{{ fmtBytes(swapUsed) }} / {{ fmtBytes(swapTotal) }}</span>
          </div>
          <div class="ws-row" v-else>
            <span class="ws-row-k">交换分区</span>
            <span class="ws-row-v faint">未启用</span>
          </div>
          <RealtimeChart
            :series="[
              { name: '内存 %', data: histMem, color: C.mem },
              { name: '交换 %', data: histSwap, color: C.swap },
            ]"
            :max="100"
            :height="72"
          />
        </section>

        <!-- 网络 -->
        <section class="ws-card">
          <div class="ws-card-head">
            <span class="ws-card-title">网络</span>
            <span class="ws-card-side">{{ ifaces.length }} 个接口</span>
          </div>
          <div class="ws-net">
            <div class="ws-net-item">
              <span class="ws-net-k">下行</span>
              <b class="ws-net-v down">{{ fmtRate(downRate) }}</b>
            </div>
            <div class="ws-net-item">
              <span class="ws-net-k">上行</span>
              <b class="ws-net-v up">{{ fmtRate(upRate) }}</b>
            </div>
          </div>
          <div class="ws-chips">
            <span v-for="n in ifaces" :key="n.name" class="ws-chip" :class="{ off: !n.up }">
              {{ n.name }}<i v-if="n.addr"> · {{ n.addr }}</i>
            </span>
          </div>
          <RealtimeChart
            :series="[
              { name: '下行', data: histDown, color: C.down },
              { name: '上行', data: histUp, color: C.up },
            ]"
            :height="72"
          />
        </section>

        <!-- 磁盘 -->
        <section class="ws-card">
          <div class="ws-card-head">
            <span class="ws-card-title">磁盘</span>
            <span class="ws-card-side">总占用 {{ diskPct.toFixed(0) }}%</span>
          </div>
          <div v-if="!mounts.length" class="hint">未检测到存储挂载点</div>
          <div v-else class="ws-mounts">
            <div v-for="d in mounts" :key="d.mountpoint" class="ws-mount">
              <div class="ws-mount-top">
                <span class="ws-mount-path mono" :title="d.mountpoint">{{ d.mountpoint }}</span>
                <span class="ws-mount-num mono">{{ fmtBytes(d.used) }} / {{ fmtBytes(d.total) }}</span>
              </div>
              <div class="ws-bar">
                <i :style="{ width: Math.min(100, num(d.percent)) + '%', background: num(d.percent) > 85 ? 'var(--danger)' : C.disk }"></i>
              </div>
            </div>
          </div>
          <RealtimeChart :series="[{ name: '磁盘 %', data: histDisk, color: C.disk }]" :max="100" :height="72" />
        </section>

        <!-- GPU -->
        <section class="ws-card span2">
          <div class="ws-card-head">
            <span class="ws-card-title">GPU</span>
            <span class="ws-card-side">{{ gpus.length }} 个显示设备</span>
            <button class="btn btn-sm btn-ghost" :disabled="gpuLoading" @click="loadGpus">
              {{ gpuLoading ? '刷新中…' : '刷新' }}
            </button>
          </div>
          <div v-if="gpuErr" class="error">{{ gpuErr }}</div>
          <div v-else-if="!gpus.length" class="hint">未检测到显卡 / 核显</div>
          <div v-else class="ws-gpus">
            <div v-for="(g, i) in gpus" :key="g.pci || i" class="ws-gpu">
              <div class="ws-gpu-head">
                <span class="ws-gpu-name">{{ g.name || 'GPU ' + (i + 1) }}</span>
                <span class="ws-tag">{{ g.kind || '未知' }}</span>
              </div>
              <div class="ws-gpu-grid">
                <div><span>厂商</span>{{ g.vendor || '—' }}</div>
                <div><span>驱动</span>{{ g.driver || '—' }}</div>
                <div><span>PCI</span><span class="mono">{{ g.pci || '—' }}</span></div>
                <div><span>显存</span>{{ gpuVram(g) }}</div>
                <div><span>利用率</span>{{ gpuUsage(g) }}</div>
                <div><span>温度</span>{{ gpuTemp(g) }}</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="ws-foot">
        <span>启动于 {{ fmtTime(sys && sys.boot_time) }}</span>
        <span>· 数据更新 {{ updatedAgo }}</span>
        <span class="grow"></span>
        <span>Go {{ (sys && sys.go_version) || '—' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ws-page { height: calc(100vh - 66px); padding: 0; }
.ws-scroll { height: 100%; overflow: auto; }
.ws-err { margin-bottom: 10px; }

.ws-hero {
  display: flex; align-items: center; gap: 24px;
  padding: 14px 16px; background: var(--surface); border: 1px solid var(--border);
  margin-bottom: 12px;
}
.ws-host { font-size: 18px; font-weight: 600; color: var(--text); letter-spacing: 0.3px; }
.ws-sub { font-size: 11px; color: var(--text-faint); margin-top: 3px; font-family: var(--font-mono); }
.ws-kpis { margin-left: auto; display: flex; gap: 26px; }
.kpi { display: flex; flex-direction: column; align-items: flex-end; }
.kpi b { font-size: 14px; color: var(--text); font-weight: 600; }
.kpi span { font-size: 10px; color: var(--text-faint); margin-top: 2px; }

.ws-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.span2 { grid-column: span 2; }
@media (max-width: 980px) { .ws-grid { grid-template-columns: 1fr; } .span2 { grid-column: span 1; } }

.ws-card { background: var(--surface); border: 1px solid var(--border); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.ws-card-head { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
.ws-card-title { font-size: 12px; font-weight: 600; color: var(--text); letter-spacing: 0.5px; }
.ws-card-side { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.ws-card-head .btn { margin-left: auto; }

.ws-big { display: flex; align-items: baseline; gap: 4px; }
.ws-big-num { font-size: 30px; font-weight: 600; color: var(--text); line-height: 1; font-family: var(--font-mono); }
.ws-big-unit { font-size: 14px; color: var(--text-faint); }
.ws-big-note { margin-left: auto; font-size: 11px; color: var(--text-faint); }

.ws-bar { height: 6px; background: var(--surface-3); overflow: hidden; }
.ws-bar i { display: block; height: 100%; background: var(--accent); transition: width var(--transition); }
.ws-bar i.swap { background: #805ad5; }
.ws-bar.grow { flex: 1; }

.ws-cores { display: flex; gap: 3px; align-items: flex-end; height: 54px; }
.ws-core { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; }
.ws-core-bar { width: 100%; max-width: 34px; height: 40px; background: var(--surface-3); display: flex; align-items: flex-end; }
.ws-core-bar i { display: block; width: 100%; transition: height var(--transition); }
.ws-core-idx { font-size: 9px; color: var(--text-faint); font-family: var(--font-mono); }

.ws-row { display: flex; align-items: center; gap: 10px; font-size: 11px; }
.ws-row-k { color: var(--text-faint); width: 62px; flex-shrink: 0; }
.ws-row-v { color: var(--text-muted); }

.ws-net { display: flex; gap: 24px; }
.ws-net-item { display: flex; flex-direction: column; gap: 2px; }
.ws-net-k { font-size: 10px; color: var(--text-faint); }
.ws-net-v { font-size: 18px; font-weight: 600; font-family: var(--font-mono); }
.ws-net-v.down { color: #2f855a; }
.ws-net-v.up { color: #c05621; }

.ws-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ws-chip {
  font-size: 10px; font-family: var(--font-mono); color: var(--text-muted);
  border: 1px solid var(--border); padding: 1px 6px; background: var(--surface-2);
}
.ws-chip i { color: var(--text-faint); font-style: normal; }
.ws-chip.off { opacity: 0.45; }

.ws-mounts { display: flex; flex-direction: column; gap: 8px; }
.ws-mount-top { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; }
.ws-mount-path { color: var(--text); }
.ws-mount-num { color: var(--text-faint); }

.ws-gpus { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.ws-gpu { border: 1px solid var(--border); padding: 10px 12px; background: var(--bg-raised); }
.ws-gpu-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ws-gpu-name { font-size: 12px; color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-tag { font-size: 10px; color: var(--accent); border: 1px solid var(--accent); padding: 0 4px; }
.ws-gpu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px; color: var(--text-muted); }
.ws-gpu-grid span:first-child { color: var(--text-faint); margin-right: 6px; }

.ws-foot {
  display: flex; align-items: center; gap: 8px; margin-top: 12px;
  font-size: 10px; color: var(--text-faint); font-family: var(--font-mono);
}
.grow { flex: 1; }
</style>
