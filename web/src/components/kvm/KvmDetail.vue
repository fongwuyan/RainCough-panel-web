<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { api } from '../../api'
import RFB from '@novnc/novnc'

const props = defineProps({ name: { type: String, required: true } })
const emit = defineEmits(['back'])

const detail = ref(null)
const stats = ref(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')

const note = ref('')
const noteSaving = ref(false)

const vncShow = ref(false)
const vncName = ref('')
let rfb = null

let pollTimer = null

async function loadDetail() {
  loading.value = true; error.value = ''
  try {
    detail.value = await api.kvDomain(props.name)
    note.value = detail.value.note || ''
    const s = await api.kvDomainStats(props.name).catch(() => null)
    stats.value = s && s.running ? s : null
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}

function pollStats() {
  if (vncShow.value) return
  api.kvDomainStats(props.name).then(s => {
    if (s && s.running) stats.value = s
  }).catch(() => {})
}

onMounted(() => {
  loadDetail()
  pollTimer = setInterval(pollStats, 5000)
})
onBeforeUnmount(() => {
  clearInterval(pollTimer)
  closeVnc()
})

async function act(action, msg) {
  error.value = ''
  try {
    await api.kvAction(props.name, action)
    if (msg) { notice.value = msg; setTimeout(() => { notice.value = '' }, 3000) }
    loadDetail()
  } catch (err) { error.value = err.message }
}

async function toggleAutostart() {
  const on = !detail.value.autostart
  try {
    await api.kvAutostart(props.name, on)
    detail.value.autostart = on
    notice.value = on ? `已设置 ${props.name} 开机自启` : `已取消 ${props.name} 开机自启`
    setTimeout(() => { notice.value = '' }, 3000)
  } catch (err) { error.value = err.message }
}

async function saveNote() {
  noteSaving.value = true; error.value = ''
  try {
    await api.kvSaveNote(props.name, note.value.trim())
    detail.value.note = note.value.trim()
    notice.value = '备注已保存'
    setTimeout(() => { notice.value = '' }, 3000)
  } catch (err) { error.value = err.message }
  finally { noteSaving.value = false }
}

async function openVnc() {
  error.value = ''
  try {
    let r = await api.kvVncGet(props.name)
    if (!r.ok || !r.vnc) {
      r = await api.kvVncEnable(props.name)
      if (!r.ok) { error.value = '启用 VNC 失败'; return }
      if (r.need_reboot) {
        if (!confirm(`虚拟机 ${props.name} 正在运行，VNC 需要重启后才生效（将短暂中断）。\n是否立即重启并连接控制台？`)) return
        await api.kvAction(props.name, 'destroy')
        await api.kvAction(props.name, 'start')
        await new Promise(res => setTimeout(res, 5000))
        r = await api.kvVncGet(props.name)
        if (!r.ok || !r.vnc) r = await api.kvVncEnable(props.name)
      }
    }
    vncShow.value = true
    vncName.value = props.name
    await nextTick()
    connectRfb(r.ws)
  } catch (err) { error.value = err.message }
}

function connectRfb(wsUrl) {
  const canvas = document.getElementById('vnc-canvas')
  if (!canvas) return
  rfb = new RFB(canvas, wsUrl, { credentials: { password: '' } })
  rfb.scaleViewport = true
  rfb.resizeSession = true
}

function closeVnc() {
  if (rfb) { try { rfb.disconnect() } catch (e) {} rfb = null }
  vncShow.value = false
  pollStats()
}

function fmtSize(n) {
  if (n === undefined || n === null) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return v.toFixed(1) + ' ' + units[i]
}

function fmtRate(n) {
  return fmtSize(n) + '/s'
}

function isRunning() { return detail.value && (detail.value.state || '') === 'running' }
</script>

<template>
  <div class="section" style="margin-top:16px;">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-sm btn-ghost" @click="emit('back')">← 返回列表</button>
      <span class="section-title" style="margin:0;">虚拟机详情 · {{ props.name }}</span>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin-top:12px;">{{ notice }}</div>
    <div v-if="loading && !detail" class="loading" style="margin-top:16px;"><div class="spinner"></div></div>

    <template v-if="detail">
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;">
        <span class="tag-chip">CPU {{ detail.vcpu }} 核</span>
        <span class="tag-chip">内存 {{ detail.memory_mb }} MB</span>
        <span class="tag-chip" :class="detail.autostart ? 'ok' : ''">开机自启: {{ detail.autostart ? '开' : '关' }}</span>
        <span v-if="detail.vnc && detail.vnc.port" class="tag-chip">VNC :{{ detail.vnc.port }}</span>
      </div>
      <div class="meta" style="font-size:11px;margin-top:6px;">UUID: {{ detail.uuid }}</div>

      <div class="section" style="margin-top:14px;">
        <div class="section-title" style="font-size:13px;">备注</div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;">
          <input v-model="note" class="input" style="flex:1;min-width:220px;" placeholder="为这台虚拟机添加备注…" />
          <button class="btn btn-sm" :disabled="noteSaving" @click="saveNote">{{ noteSaving ? '保存中...' : '保存备注' }}</button>
        </div>
      </div>

      <div class="section" style="margin-top:14px;">
        <div class="section-title" style="font-size:13px;">资源占用
          <span v-if="stats" class="meta" style="font-size:11px;margin-left:8px;">每 5 秒刷新</span>
        </div>
        <template v-if="stats">
          <div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;">
            <div style="min-width:180px;flex:1;">
              <div class="meta" style="font-size:12px;">CPU 使用率 {{ stats.cpu_pct }}%</div>
              <div class="progress" style="margin-top:6px;border-radius: 0;">
                <div :style="{ width: Math.min(100, stats.cpu_pct) + '%' }"></div>
              </div>
            </div>
            <div v-if="stats.mem && stats.mem.maximum_kb" style="min-width:180px;flex:1;">
              <div class="meta" style="font-size:12px;">
                内存
                {{ fmtSize((stats.mem.maximum_kb - (stats.mem.available_kb || 0)) * 1024) }}
                / {{ fmtSize(stats.mem.maximum_kb * 1024) }}
                <span v-if="stats.mem.rss_kb" class="meta">（宿主 RSS {{ fmtSize(stats.mem.rss_kb * 1024) }}）</span>
              </div>
              <div class="progress" style="margin-top:6px;border-radius: 0;">
                <div :style="{ width: Math.min(100, 100 * (stats.mem.maximum_kb - (stats.mem.available_kb || 0)) / stats.mem.maximum_kb) + '%' }"></div>
              </div>
            </div>
          </div>
          <div v-if="stats.net && stats.net.length" style="margin-top:12px;">
            <div class="meta" style="font-size:12px;margin-bottom:4px;">网络</div>
            <div v-for="n in stats.net" :key="n.iface" class="meta" style="font-size:12px;">
              {{ n.iface }} · 收 {{ fmtRate(n.rx_bps) }} · 发 {{ fmtRate(n.tx_bps) }}
              <span class="meta">（累计 收 {{ fmtSize(n.rx_bytes) }} / 发 {{ fmtSize(n.tx_bytes) }}）</span>
            </div>
          </div>
          <div v-if="stats.disk && stats.disk.length" style="margin-top:12px;">
            <div class="meta" style="font-size:12px;margin-bottom:4px;">磁盘 IO</div>
            <div v-for="dk in stats.disk" :key="dk.dev" class="meta" style="font-size:12px;">
              {{ dk.dev }} · 读 {{ fmtRate(dk.rd_bps) }} · 写 {{ fmtRate(dk.wr_bps) }}
              <span class="meta">（累计 读 {{ fmtSize(dk.rd_bytes) }} / 写 {{ fmtSize(dk.wr_bytes) }}）</span>
            </div>
          </div>
        </template>
        <div v-else class="hint" style="font-size:12px;margin-top:8px;">虚拟机未运行，无资源数据。</div>
      </div>

      <div class="section" style="margin-top:14px;">
        <div class="section-title" style="font-size:13px;">操作</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          <button class="btn btn-sm" @click="act('start', '已启动')">启动</button>
          <button class="btn btn-sm" @click="act('shutdown', '已发送关机')">关机</button>
          <button class="btn btn-sm" @click="act('reboot', '已重启')">重启</button>
          <button class="btn btn-sm" @click="act('suspend', '已暂停')">暂停</button>
          <button class="btn btn-sm" @click="act('resume', '已恢复')">恢复</button>
          <button class="btn btn-sm" @click="act('destroy', '已强制关闭')">强制关闭</button>
          <button class="btn btn-sm" @click="toggleAutostart">{{ detail.autostart ? '取消自启' : '设置自启' }}</button>
          <button class="btn btn-sm btn-primary" @click="openVnc">VNC 控制台</button>
        </div>
      </div>

      <div class="section" style="margin-top:14px;">
        <div class="section-title" style="font-size:13px;">磁盘</div>
        <div v-if="!detail.disks.length" class="hint">无</div>
        <div v-for="dk in detail.disks" :key="dk.dev" class="meta" style="font-size:12px;">{{ dk.dev }} · {{ dk.device }} · {{ dk.type }} · {{ dk.src }}</div>
      </div>

      <div class="section" style="margin-top:14px;">
        <div class="section-title" style="font-size:13px;">网卡</div>
        <div v-if="!detail.ifaces.length" class="hint">无</div>
        <div v-for="n in detail.ifaces" :key="n.mac" class="meta" style="font-size:12px;">{{ n.network }} · {{ n.mac }}</div>
      </div>
    </template>

    <div v-if="vncShow" class="section" style="margin-top:16px;">
      <div class="section-title">VNC 控制台 · {{ vncName }}</div>
      <div style="background:#111;border-radius: 0;overflow:hidden;margin-top:10px;padding:8px;">
        <canvas id="vnc-canvas" style="width:100%;height:520px;background:#000;border-radius: 0;"></canvas>
      </div>
      <div style="margin-top:8px;">
        <button class="btn btn-sm btn-ghost" @click="closeVnc">关闭控制台</button>
      </div>
    </div>
  </div>
</template>
