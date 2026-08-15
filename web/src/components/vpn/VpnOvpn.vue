<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const srv = ref(null)
const cli = ref({ clients: [], running: '', server_running: false })
const err = ref('')
const sForm = ref({ iface: 'server', port: 1194, proto: 'udp', subnet: '10.8.0.0 255.255.255.0', server_address: '10.8.0.1', dns: '8.8.8.8', comp_lzo: 'no' })
const impName = ref('')
const impContent = ref('')
const serverLog = ref('')
const showLog = ref(false)
const busy = ref('')

function runningClients() {
  const out = []
  const m = cli.value.running.matchAll(/client\/([\w.-]+)\.conf/g)
  for (const g of m) out.push(g[1])
  return out
}

async function refreshCl() {
  cli.value = await api.ovpnEnv().catch(e => { err.value = e.message; return { clients: [], running: '', server_running: false } })
}
async function refreshS() {
  srv.value = await api.ovpnServer().catch(e => { err.value = e.message; return null })
  if (srv.value) {
    sForm.value = {
      iface: srv.value.store.iface || 'server',
      port: srv.value.store.port || 1194,
      proto: srv.value.store.proto || 'udp',
      subnet: srv.value.store.subnet || '10.8.0.0 255.255.255.0',
      server_address: srv.value.store.server_address || '10.8.0.1',
      dns: srv.value.store.dns || '8.8.8.8',
      comp_lzo: srv.value.store.comp_lzo || 'no',
    }
  }
}
async function refresh() { err.value = ''; await Promise.all([refreshS(), refreshCl()]) }
async function saveSrv(writeConf) {
  const r = await api.ovpnServerSave({ ...sForm.value, write_conf: writeConf }).catch(e => { err.value = e.message; return null })
  if (r) refresh()
}
async function initPki() {
  if (!confirm('初始化 easy-rsa PKI?将创建证书体系。')) return
  busy.value = 'init'
  await api.ovpnInitPki().catch(e => err.value = e.message)
  busy.value = ''
  refresh()
}
async function build() {
  busy.value = 'build'
  await api.ovpnBuild().catch(e => err.value = e.message)
  busy.value = ''
  refresh()
}
async function toggleSrv() {
  err.value = ''
  if (srv.value?.running) await api.ovpnServerDown().catch(e => err.value = e.message)
  else await api.ovpnServerUp().catch(e => err.value = e.message)
  refresh()
}
async function viewServerLog() {
  const r = await api.ovpnServerLog().catch(() => ({ log: '无法获取' }))
  serverLog.value = r.log || '(空)'
  showLog.value = true
}
async function importCl() {
  const name = impName.value.trim()
  if (!name || !impContent.value) { err.value = '缺少名称或配置'; return }
  const r = await api.ovpnImport(name, impContent.value).catch(e => { err.value = e.message; return null })
  if (r) { impName.value = ''; impContent.value = ''; refreshCl() }
}
async function cliAction(name, action) {
  err.value = ''
  await api.ovpnAction(name, action).catch(e => err.value = e.message)
  refreshCl()
}
onMounted(refresh)
</script>

<template>
  <div>
    <div v-if="err" class="error" style="margin-bottom:12px;">{{ err }}</div>

    <div class="section">
      <div class="section-title">服务端</div>
      <div class="status-line" style="margin-bottom:12px;">
        PKI: <span :class="srv?.pki_ready?'ok':'fail'">{{ srv?.pki_ready ? '已初始化' : '未初始化' }}</span>
        · 配置: <span :class="srv?.conf_exists?'ok':'fail'">{{ srv?.conf_exists ? '已生成' : '未生成' }}</span>
        · 运行: <span :class="srv?.running?'ok':'fail'">{{ srv?.running ? '运行中' : '已停止' }}</span>
      </div>
      <div class="grid2">
        <div>
          <div class="field"><label>接口/名称</label><input v-model="sForm.iface" class="input" /></div>
          <div class="field"><label>端口</label><input v-model="sForm.port" class="input" type="number" /></div>
          <div class="field"><label>协议</label>
            <select v-model="sForm.proto" class="select"><option value="udp">udp</option><option value="tcp">tcp</option></select>
          </div>
          <div class="field"><label>子网段</label><input v-model="sForm.subnet" class="input" placeholder="10.8.0.0 255.255.255.0" /></div>
          <div class="field"><label>服务端地址</label><input v-model="sForm.server_address" class="input" /></div>
          <div class="field"><label>DNS</label><input v-model="sForm.dns" class="input" /></div>
          <div class="field"><label>压缩</label>
            <select v-model="sForm.comp_lzo" class="select"><option value="no">off</option><option value="yes">allow</option></select>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
            <button class="btn" @click="saveSrv(false)">保存配置</button>
            <button class="btn" @click="saveSrv(true)">保存并写盘</button>
            <button class="btn btn-primary" :disabled="busy==='init'" @click="initPki">{{ busy==='init' ? '初始化中...' : '初始化 PKI' }}</button>
            <button class="btn" :disabled="!srv?.pki_ready || busy==='build'" @click="build">{{ busy==='build' ? '生成中...' : '生成服务端证书' }}</button>
            <button class="btn" :class="srv?.running?'btn-danger':''" @click="toggleSrv">{{ srv?.running ? '停止服务端' : '启动服务端' }}</button>
            <button class="btn btn-ghost" @click="viewServerLog">日志</button>
          </div>
        </div>
        <div>
          <div class="section-title" style="font-size:13px;">步骤</div>
          <ol class="steps">
            <li :class="{ done: srv?.pki_ready }">初始化 PKI</li>
            <li :class="{ done: srv?.conf_exists }">生成服务端证书 + DH 参数</li>
            <li :class="{ done: srv?.running }">启动服务端</li>
          </ol>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">客户端</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input v-model="impName" class="input" placeholder="配置名称" style="width:180px;" />
        <button class="btn btn-primary" @click="importCl">导入</button>
      </div>
      <textarea v-model="impContent" class="input" rows="5" placeholder="粘贴 .ovpn 客户端配置" style="width:100%;font-family:var(--font-mono);"></textarea>
      <div style="margin-top:12px;">
        <div v-if="!cli.clients.length" class="hint" style="text-align:left;padding:0;">暂无客户端配置。</div>
        <div v-for="n in cli.clients" :key="n" class="peer">
          <code class="tag-chip">{{ n }}</code>
          <span class="status-line" :class="runningClients().includes(n)?'ok':'fail'">{{ runningClients().includes(n) ? '运行中' : '停止' }}</span>
          <button class="btn btn-sm" :class="runningClients().includes(n)?'btn-danger':''" @click="cliAction(n, runningClients().includes(n)?'down':'up')">{{ runningClients().includes(n) ? '停止' : '启动' }}</button>
          <button class="btn btn-sm" @click="cliAction(n, 'autostart')">开机自启</button>
          <button class="btn btn-sm btn-danger" @click="cliAction(n, 'delete')">删除</button>
        </div>
      </div>
    </div>

    <div v-if="showLog" class="overlay" @click.self="showLog=false">
      <div class="modal" style="max-width:720px;">
        <div class="modal-header"><h3>OpenVPN 服务端日志</h3><button class="btn btn-sm" @click="showLog=false">关闭</button></div>
        <div class="modal-body">
          <div class="mono-block" style="white-space:pre;background:var(--bg);padding:12px;max-height:420px;overflow:auto;">{{ serverLog }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }
.field { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
.field label { font-size: 13px; color: var(--text-muted); min-width: 110px; }
.field .input, .field .select { width: 200px; }
.steps { margin: 0 0 0 20px; color: var(--text-muted); }
.steps li { margin: 6px 0; }
.steps li.done { color: var(--success); }
.peer { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); padding: 8px 12px; margin-bottom: 6px; }
</style>