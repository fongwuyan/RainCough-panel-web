<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const tab = ref('overview')
const loading = ref(false)
const error = ref('')
const notice = ref('')
let timer = null

const env = ref(null)
const ov = ref(null)
const nodes = ref([])
const subs = ref([])
const status = ref(null)
const wg = ref(null)
const ovpn = ref(null)
const logs = ref('')

const subName = ref('')
const subUrl = ref('')
const wgName = ref('')
const wgText = ref('')
const ovName = ref('')
const ovText = ref('')

function toast(msg) {
  notice.value = msg
  setTimeout(() => { notice.value = '' }, 4000)
}
function fmtLat(l) { return l === null || l === undefined ? '-' : l.toFixed(1) + 'ms' }

async function loadAll() {
  loading.value = true
  try {
    const [e, o, n, s] = await Promise.all([
      api.vpnEnv(), api.vpnOverview(), api.vpnNodes(), api.vpnSubs(),
    ])
    env.value = e; ov.value = o; nodes.value = n; subs.value = s
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}
async function loadDetail() {
  try {
    const [st, w, op, lg] = await Promise.all([
      api.vpnStatus(), api.vpnWgStatus(), api.vpnOvpnStatus(), api.vpnLogs(40),
    ])
    status.value = st; wg.value = w; ovpn.value = op; logs.value = (lg && lg.log) || ''
  } catch (e) {}
}
async function refresh() {
  await loadAll(); await loadDetail()
}

async function act(fn, okMsg) {
  error.value = ''
  try { const r = await fn(); toast(okMsg || JSON.stringify(r).slice(0, 90)) }
  catch (e) { error.value = e.message }
  refresh()
}

/* 代理 */
async function connectNode(id) { await act(() => api.vpnConnect(id), '已发起连接') }
async function disconnect() { await act(api.vpnDisconnect, '已断开') }
async function testNodes() {
  const ids = nodes.value.slice(0, 12).map((n) => n._id)
  if (!ids.length) return
  await act(() => api.vpnNodeTest(ids))
}
async function speedNode(id) { await act(() => api.vpnNodeSpeed(id)) }
async function deleteNodes(ids) { if (ids.length) await act(() => api.vpnNodeDelete(ids)) }
async function addSub() {
  if (!subUrl.value) { error.value = '请输入订阅链接'; return }
  await act(() => api.vpnSubAdd(subName.value || '', subUrl.value))
  subUrl.value = ''; subName.value = ''
}
async function refreshSubs() { await act(api.vpnSubRefresh, '订阅已刷新') }
async function delSub(name) { await act(() => api.vpnSubDelete(name)) }

/* WG / OVPN */
async function wgUp(n) { await act(() => api.vpnWgUp(n)) }
async function wgDown(n) { await act(() => api.vpnWgDown(n)) }
async function wgImport() {
  if (!wgName.value || !wgText.value) { error.value = '需要名称与配置内容'; return }
  await act(() => api.vpnWgImport(wgName.value, wgText.value), 'WG 配置已导入为 ' + wgName.value)
  wgText.value = ''
}
async function ovUp(n) { await act(() => api.vpnOvpnUp(n)) }
async function ovDown(n) { await act(() => api.vpnOvpnDown(n)) }
async function ovImport() {
  if (!ovName.value || !ovText.value) { error.value = '需要名称与配置内容'; return }
  await act(() => api.vpnOvpnImport(ovName.value, ovText.value), 'OVPN 配置已导入为 ' + ovName.value)
  ovText.value = ''
}

const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'proxy', label: '代理(节点/订阅)' },
  { key: 'wg', label: 'WireGuard' },
  { key: 'ovpn', label: 'OpenVPN' },
  { key: 'logs', label: '日志' },
]

onMounted(() => { refresh(); timer = setInterval(loadDetail, 5000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div>
    <h1>VPN 网络</h1>
    <div class="subtitle">WireGuard / OpenVPN / 代理通道 · 代理仅本机可用（127.0.0.1），不开放内网共享</div>

    <div v-if="notice" class="notice-box">{{ notice }}</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div class="tabs">
      <button v-for="t in TABS" :key="t.key" class="tab" :class="{ active: tab === t.key }"
              @click="tab = t.key">{{ t.label }}</button>
      <span class="grow"></span>
      <button class="btn btn-sm" @click="refresh">刷新</button>
      <button class="btn btn-sm btn-danger" @click="act(api.vpnStopAll, '已全部停止')">停止全部</button>
    </div>

    <!-- 概览 -->
    <div v-if="tab === 'overview'" class="card-grid ov">
      <div class="stat"><span class="st-k">直连 IP</span><b class="mono">{{ ov && ov.direct_ip || '-' }}</b></div>
      <div class="stat"><span class="st-k">代理 IP</span><b class="mono" :class="status && status.proxy_ip ? 'ok' : 'faint'">{{ status && status.proxy_ip || '未连接' }}</b></div>
      <div class="stat"><span class="st-k">代理通道</span>
        <b :class="(status && status.connected) ? 'ok' : 'faint'">{{ (status && status.connected) ? '已连接' : '未连接' }}</b>
        <span class="mono faint" v-if="status && status.name"> · {{ status.name }}</span>
      </div>
      <div class="stat"><span class="st-k">WireGuard</span>
        <b :class="(ov && ov.channels.wireguard.running) ? 'ok' : 'faint'">{{ (ov && ov.channels.wireguard.running) ? '运行中' : '未运行' }}</b>
      </div>
      <div class="stat"><span class="st-k">OpenVPN</span>
        <b :class="(ov && ov.channels.openvpn.running) ? 'ok' : 'faint'">{{ (ov && ov.channels.openvpn.running) ? '运行中' : '未运行' }}</b>
      </div>
      <div class="stat"><span class="st-k">节点 / 订阅</span><b class="mono">{{ ov && ov.nodes || 0 }} / {{ ov && ov.subs || 0 }}</b></div>
    </div>

    <div v-if="tab === 'overview'" class="section">
      <div class="section-title">环境检测</div>
      <div class="kv-grid">
        <div class="kv"><span class="fine">WireGuard</span><b :class="env && env.wireguard ? 'ok' : 'err'">{{ env && env.wireguard ? '就绪' : '缺失' }}</b></div>
        <div class="kv"><span class="fine">v2ray/xray</span><b :class="env && env.v2ray ? 'ok' : 'err'">{{ env && env.v2ray ? '就绪' : '缺失' }}</b></div>
        <div class="kv"><span class="fine">sing-box</span><b :class="env && env.sing_box ? 'ok' : 'err'">{{ env && env.sing_box ? '就绪' : '缺失' }}</b></div>
        <div class="kv"><span class="fine">OpenVPN</span><b :class="env && env.openvpn ? 'ok' : 'err'">{{ env && env.openvpn ? '就绪' : '缺失' }}</b></div>
        <div class="kv"><span class="fine">sudo</span><b :class="env && env.sudo ? 'ok' : 'err'">{{ env && env.sudo ? '可用' : '不可用' }}</b></div>
      </div>
    </div>

    <!-- 代理 -->
    <div v-if="tab === 'proxy'">
      <div class="section">
        <div class="section-title">
          <span>订阅</span>
          <button class="btn btn-sm" @click="refreshSubs">刷新全部</button>
        </div>
        <div v-if="!subs.length" class="hint">暂无订阅，添加下方链接后刷新导入节点</div>
        <table v-else class="table">
          <thead><tr><th>名称</th><th>地址</th><th>节点数</th><th>状态</th><th></th></tr></thead>
          <tbody>
            <tr v-for="s in subs" :key="s.name">
              <td>{{ s.name }}</td>
              <td class="mono faint" style="max-width:40ch;overflow:hidden;text-overflow:ellipsis">{{ s.url }}</td>
              <td class="mono">{{ s.nodes ?? '-' }}</td>
              <td><span :class="s.last_ok ? 'ok' : 'faint'">{{ s.last_ok === null ? (s.error || '未刷新') : (s.last_ok ? 'OK' : '失败') }}</span></td>
              <td style="text-align:right"><button class="btn btn-sm btn-ghost" @click="delSub(s.name)">删</button></td>
            </tr>
          </tbody>
        </table>
        <div class="flex" style="margin-top:12px">
          <input v-model="subName" class="input" style="width:150px" placeholder="名称(可选)" />
          <input v-model="subUrl" class="input" style="flex:1" placeholder="https://... 订阅链接" @keydown.enter="addSub" />
          <button class="btn btn-sm btn-primary" @click="addSub">添加</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span>节点（{{ nodes.length }}）</span>
          <button class="btn btn-sm" @click="testNodes">批量 Ping 前12</button>
        </div>
        <div v-if="!nodes.length" class="hint">节点库为空：先添加订阅并刷新</div>
        <div v-else class="node-table">
          <div class="node-row head">
            <span class="n-proto">协议</span><span class="n-name">节点</span>
            <span class="n-lat">延迟</span><span class="n-act">操作</span>
          </div>
          <div v-for="n in nodes" :key="n._id" class="node-row">
            <span class="n-proto"><span class="chip">{{ n.protocol }}</span></span>
            <span class="n-name mono" :title="n.addr + ':' + n.port">{{ n._id }}</span>
            <span class="n-lat mono">{{ fmtLat(n.latency) }}</span>
            <span class="n-act">
              <button class="btn btn-sm btn-primary" @click="connectNode(n._id)">连接</button>
              <button class="btn btn-sm" @click="speedNode(n._id)">测速</button>
              <button class="btn btn-sm btn-ghost" @click="deleteNodes([n._id])">删</button>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- WG -->
    <div v-if="tab === 'wg'">
      <div class="section">
        <div class="section-title">WireGuard 状态</div>
        <pre class="mono-block pre">{{ wg && wg.text || (wg && wg.err) || '无活动隧道' }}</pre>
      </div>
      <div class="section">
        <div class="section-title">导入配置</div>
        <div class="flex-col">
          <input v-model="wgName" class="input" placeholder="隧道名(如 wg0)" />
          <textarea v-model="wgText" class="input mono" rows="8" placeholder="[Interface]..." style="font-family:var(--font-mono)"></textarea>
          <div class="flex">
            <button class="btn btn-sm btn-primary" @click="wgImport">导入</button>
            <button class="btn btn-sm" @click="wgUp(wgName || 'wg0')">启动</button>
            <button class="btn btn-sm btn-danger" @click="wgDown(wgName || 'wg0')">停止</button>
          </div>
        </div>
      </div>
    </div>

    <!-- OVPN -->
    <div v-if="tab === 'ovpn'">
      <div class="section">
        <div class="section-title">OpenVPN 状态</div>
        <pre class="mono-block pre">{{ ovpn && ovpn.procs && ovpn.procs.length ? ovpn.procs.join('\n') : '无活动隧道' }}</pre>
      </div>
      <div class="section">
        <div class="section-title">导入配置</div>
        <div class="flex-col">
          <input v-model="ovName" class="input" placeholder="配置名(如 myvpn)" />
          <textarea v-model="ovText" class="input mono" rows="8" placeholder="client..." style="font-family:var(--font-mono)"></textarea>
          <div class="flex">
            <button class="btn btn-sm btn-primary" @click="ovImport">导入</button>
            <button class="btn btn-sm" @click="ovUp(ovName || 'myvpn')">启动</button>
            <button class="btn btn-sm btn-danger" @click="ovDown(ovName || 'myvpn')">停止</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 日志 -->
    <div v-if="tab === 'logs'" class="section">
      <div class="section-title">运行日志（最近）</div>
      <pre class="mono-block pre">{{ logs || '暂无日志' }}</pre>
    </div>
  </div>
</template>

<style scoped>
.notice-box { padding: 8px 12px; border-radius: 0; background: var(--success-soft); color: var(--success); margin-bottom: 12px; font-size: 13px; }
.card-grid.ov { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 0; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.st-k { font-size: 11px; color: var(--text-faint); }
.stat b { font-size: 15px; }
.kv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.kv { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--surface-2); border-radius: 0; }
.fine { font-size: 12px; color: var(--text-muted); }
.chip { display: inline-block; padding: 1px 8px; font-size: 11px; font-family: var(--font-mono); border-radius: 0; background: var(--accent-soft); color: var(--accent); }
.node-table { display: flex; flex-direction: column; }
.node-row { display: flex; align-items: center; gap: 8px; padding: 7px 4px; border-bottom: 1px solid var(--border); font-size: 13px; }
.node-row.head { color: var(--text-faint); font-size: 11px; border-bottom: 1px solid var(--border-strong); }
.n-proto { width: 86px; flex-shrink: 0; }
.n-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.n-lat { width: 80px; text-align: right; }
.n-act { width: 230px; text-align: right; white-space: nowrap; }
.pre { max-height: 320px; overflow: auto; }
</style>
