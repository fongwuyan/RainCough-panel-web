<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const env = ref(null)
const ov = ref(null)
const live = ref(null)
const settings = ref(null)
const loading = ref(true)
const err = ref('')
const fwd = ref('')
const sudoPw = ref('')
let liveTimer = null

const CH_LABEL = { v2ray: 'v2ray', wireguard: 'WireGuard', openvpn: 'OpenVPN' }

function fmtBytes(b) {
  b = Number(b) || 0
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'
  return b + ' B'
}
function fmtBps(b) {
  b = Number(b) || 0
  if (b >= 1048576) return (b / 1048576).toFixed(2) + ' MB/s'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB/s'
  return b + ' B/s'
}
function liveRows() {
  if (!live.value) return []
  const rows = []
  for (const k of ['v2ray', 'wireguard', 'openvpn']) {
    const c = live.value[k]
    if (!c) continue
    if (!c.running) continue
    rows.push({ key: k, label: CH_LABEL[k], node: k === 'v2ray' ? c.node : (c.iface || c.running.join(', ') || '-'),
                up: fmtBytes(c.total_up), down: fmtBytes(c.total_down),
                upRate: fmtBps(c.up_bps), downRate: fmtBps(c.down_bps) })
  }
  return rows
}
function heroRow() {
  const r = liveRows()[0]
  if (!r) return null
  const c = live.value[r.key]
  return Object.assign({}, c, r)
}

async function loadAll() {
  loading.value = true
  err.value = ''
  try {
    const [e, o] = await Promise.all([api.vpnEnv(), api.vpnOverview()])
    env.value = e; ov.value = o
  } catch (ex) { err.value = ex.message }
  loading.value = false
}
function pollLive() {
  api.vpnLive().then(d => { live.value = d }).catch(() => {})
}
function loadSettings() {
  api.vpnSettings().then(s => { settings.value = s; fwd.value = (s && s.values && s.values.fwd_target) || '' })
    .catch(() => {})
}
function saveSettings() {
  const body = { fwd_target: fwd.value }
  if (sudoPw.value) body.sudo_pw = sudoPw.value
  api.vpnSaveSettings(body).then(() => {
    sudoPw.value = ''
    api.vpnEnv().then(e => env.value = e).catch(() => {})
  }).catch(e => alert('保存失败: ' + e.message))
}
async function install(pkgs) {
  err.value = ''
  const r = await api.vpnInstall(pkgs).catch(e => { err.value = e.message; return null })
  if (r) { env.value = await api.vpnEnv().catch(() => env.value) }
}
async function stopAll() {
  if (!confirm('停止所有 VPN 通道?')) return
  err.value = ''
  const r = await api.vpnStopAll().catch(e => { err.value = e.message; return null })
  if (r) loadAll()
}
function installOne(kind) {
  if (kind === 'openvpn' || kind === 'easyrsa') install(['openvpn', 'easy-rsa'])
  else if (kind === 'v2ray') install(['v2ray'])
  else if (kind === 'wireguard') install(['wireguard-tools', 'linux-headers'])
}

onMounted(() => { loadAll(); loadSettings(); pollLive(); liveTimer = setInterval(pollLive, 2000) })
onUnmounted(() => { if (liveTimer) clearInterval(liveTimer) })
</script>

<template>
  <div>
    <div v-if="loading" class="loading"><div class="spinner"></div>加载中...</div>
    <div v-else-if="err" class="error">{{ err }}</div>

    <template v-else>
      <div class="hero" v-if="heroRow()">
        <div class="hero-top">
          <span class="hero-dot on"></span>
          <span class="hero-label">{{ heroRow().label }} · 已连接</span>
        </div>
        <div class="hero-node">{{ heroRow().node }}</div>
        <div class="hero-speed">
          <span class="hero-dir">↓ {{ heroRow().downRate }}</span>
          <span class="hero-dir">↑ {{ heroRow().upRate }}</span>
        </div>
        <div class="hero-total">
          累计 ↓ {{ heroRow().down }} · ↑ {{ heroRow().up }}
        </div>
      </div>
      <div class="hero hero-off" v-else>
        <span class="hero-dot"></span>
        <span class="hero-label">未连接任何通道</span>
      </div>

      <div class="section">
        <div class="section-title">通道状态</div>
        <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
          <div class="ch">
            <div class="ch-l"><span class="dot" :class="ov.channels_active.wireguard?'on':'off'"></span> WireGuard</div>
            <div class="ch-v"><span v-if="ov.channels_active.wireguard" class="ok">运行</span><span v-else class="fail">停止</span></div>
            <div class="ch-m">接口 {{ ov.wireguard.interfaces }} · {{ ov.wireguard.running.join(', ') || '无' }}</div>
          </div>
          <div class="ch">
            <div class="ch-l"><span class="dot" :class="ov.channels_active.openvpn?'on':'off'"></span> OpenVPN</div>
            <div class="ch-v"><span v-if="ov.channels_active.openvpn" class="ok">运行</span><span v-else class="fail">停止</span></div>
            <div class="ch-m">{{ ov.openvpn.detail || '无' }}</div>
          </div>
          <div class="ch">
            <div class="ch-l"><span class="dot" :class="ov.channels_active.v2ray?'on':'off'"></span> v2ray</div>
            <div class="ch-v"><span v-if="ov.channels_active.v2ray" class="ok">运行</span><span v-else class="fail">停止</span></div>
            <div class="ch-m">{{ ov.v2ray.detail }}</div>
          </div>
        </div>
        <div class="status-line" style="margin-top:12px;">
          直连出口 IP: <span class="ok">{{ ov.direct_ip || '无法获取' }}</span>
          <template v-if="ov.proxy_ip"> · 代理出口 IP: <span class="ok">{{ ov.proxy_ip }}</span></template>
        </div>
        <div style="margin-top:12px;">
          <button class="btn btn-danger" @click="stopAll">停止全部通道</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">实时流量 <span class="hint" style="font-size:11px;">每 2 秒刷新</span></div>
        <div v-if="liveRows().length === 0" class="hint" style="padding:8px 0;">暂无运行中的通道</div>
        <table v-else class="tbl">
          <thead>
            <tr><th>通道</th><th>连接节点</th><th>上行</th><th>下行</th><th>实时 ↓ 速率</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in liveRows()" :key="r.key">
              <td>{{ r.label }}</td>
              <td><code class="tag-chip">{{ r.node }}</code></td>
              <td class="st">{{ r.up }}</td>
              <td class="st">{{ r.down }}</td>
              <td class="st" :class="r.downRate > 0 || r.upRate > 0 ? 'ok' : ''">{{ r.downRate }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">运行环境</div>
        <table class="tbl">
          <tbody>
            <tr><td>WireGuard</td>
              <td class="st">{{ env.wireguard.installed ? '已安装' : '未安装' }}</td>
              <td><code class="tag-chip">{{ env.wireguard.ograde }}</code></td>
              <td><button v-if="!env.wireguard.installed" class="btn btn-sm" @click="installOne('wireguard')">安装</button></td></tr>
            <tr><td>OpenVPN</td>
              <td class="st">{{ env.openvpn.installed ? '已安装' : '未安装' }}</td>
              <td><code class="tag-chip">{{ env.openvpn.tool }}</code></td>
              <td><button v-if="!env.openvpn.installed" class="btn btn-sm" @click="installOne('openvpn')">安装</button></td></tr>
            <tr><td>easy-rsa 证书</td>
              <td class="st">{{ env.easyrsa.installed ? '已安装' : '未安装' }}</td>
              <td><code class="tag-chip">{{ env.easyrsa.tool }}</code></td>
              <td><button v-if="!env.easyrsa.installed" class="btn btn-sm" @click="installOne('easyrsa')">安装</button></td></tr>
            <tr><td>v2ray 内核</td>
              <td class="st">{{ env.v2ray.installed ? '已安装' : '未安装' }}</td>
              <td><code class="tag-chip">{{ env.v2ray.tool }} {{ env.v2ray.version }}</code></td>
              <td><button v-if="!env.v2ray.installed" class="btn btn-sm" @click="installOne('v2ray')">安装</button></td></tr>
            <tr><td>sudo 提权</td>
              <td class="st" :class="env.sudo?'ok':'fail'">{{ env.sudo ? '可用' : '需密码' }}</td>
              <td colspan="2"><span class="hint" style="padding:0;">{{ env.sudo_note }}</span></td></tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">设置</div>
        <div class="settings-group">
          <div class="settings-item">
            <label>sudo 密码(用于提权管理)</label>
            <div class="control">
              <input v-model="sudoPw" type="password" class="input" placeholder="留空则保持不变" style="width:240px;" />
            </div>
          </div>
          <div class="settings-item">
            <label>出网检测目标</label>
            <div class="control">
              <input v-model="fwd" class="input" placeholder="https://api.ipify.org" style="width:320px;" />
            </div>
          </div>
          <div style="margin-top:12px;">
            <button class="btn btn-primary" @click="saveSettings">保存设置</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ch { border: 1px solid var(--border); padding: 12px 14px; background: var(--surface); }
.ch-l { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
.ch-v { font-size: 12px; font-family: var(--font-mono); margin-bottom: 2px; }
.ch-m { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; background: var(--border-strong); }
.dot.on { background: var(--success); }
.dot.off { background: var(--danger); }
.tbl { width: 100%; border-collapse: collapse; }
.tbl td { border: 1px solid var(--border); padding: 8px 12px; font-size: 13px; }
.tbl th { border: 1px solid var(--border); padding: 8px 12px; font-size: 12px; text-align: left; color: var(--text-faint); background: var(--surface); }
.tbl td.st { font-family: var(--font-mono); width: 90px; }
.hero {
  border: 1px solid var(--border); border-radius: 12px; padding: 16px;
  background: var(--surface); margin-bottom: 14px;
}
.hero-off { opacity: 0.7; }
.hero-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.hero-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--border-strong); }
.hero-dot.on { background: var(--success); box-shadow: 0 0 8px var(--success); }
.hero-label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.hero-node { font-size: 18px; font-weight: 800; color: var(--text); margin-bottom: 10px; font-family: var(--font-mono); }
.hero-speed { display: flex; gap: 20px; font-family: var(--font-mono); font-size: 14px; margin-bottom: 6px; }
.hero-dir { color: var(--accent); }
.hero-total { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
</style>