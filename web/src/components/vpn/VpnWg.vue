<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const env = ref({ profiles: [], running: [] })
const server = ref(null)
const err = ref('')
const sForm = ref({ iface: 'wg0', address: '10.8.0.1/24', port: 51820, mtu: 1420, dns: '1.1.1.1', wan_if: '' })
const newPeer = ref('')
const importName = ref('')
const importContent = ref('')
const exportConf = ref('')
const showExport = ref(false)

async function refresh() {
  err.value = ''
  try {
    const [e, s] = await Promise.all([api.wgEnv(), api.wgServer()])
    env.value = e
    server.value = s
    sForm.value = {
      iface: s.store.iface || 'wg0',
      address: s.store.address || '10.8.0.1/24',
      port: s.store.port || 51820,
      mtu: s.store.mtu || 1420,
      dns: s.store.dns || '1.1.1.1',
      wan_if: s.store.wan_if || s.wan_if || '',
    }
  } catch (ex) { err.value = ex.message }
}
async function saveServer() {
  const body = { ...sForm.value }
  if (confirm('是否需要重新生成服务器密钥?(将导致所有客户端配置失效)')) body.genkeys = server.value?.store.peers?.length || 0
  const r = await api.wgServerSave(body).catch(e => { err.value = e.message; return null })
  if (r) { server.value = await api.wgServer().catch(() => server.value) }
}
async function toggleServer() {
  err.value = ''
  if (server.value?.running) await api.wgServerDown().catch(e => err.value = e.message)
  else await api.wgServerUp().catch(e => err.value = e.message)
  refresh()
}
async function addPeer() {
  const name = newPeer.value.trim()
  if (!name) return
  const r = await api.wgPeerAdd(name).catch(e => { err.value = e.message; return null })
  if (r) { newPeer.value = ''; server.value = await api.wgServer().catch(() => server.value) }
}
async function delPeer(name) {
  if (!confirm('删除 peer ' + name + '?')) return
  await api.wgPeerDelete(name).catch(e => err.value = e.message)
  refresh()
}
async function doExport(name) {
  const r = await api.wgExport(name).catch(e => { err.value = e.message; return null })
  if (r) { exportConf.value = r.content; showExport.value = true }
}
async function importConf() {
  const name = importName.value.trim()
  if (!name || !importContent.value) { err.value = '缺少名称或配置'; return }
  const r = await api.wgImport(name, importContent.value).catch(e => { err.value = e.message; return null })
  if (r) {
    importName.value = ''; importContent.value = ''
    env.value = await api.wgEnv().catch(() => env.value)
  }
}
async function profAction(name, action) {
  err.value = ''
  await api.wgAction(name, action).catch(e => err.value = e.message)
  env.value = await api.wgEnv().catch(() => env.value)
}
let timer = null
onMounted(() => { refresh(); timer = setInterval(refresh, 6000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div>
    <div v-if="err" class="error" style="margin-bottom:12px;">{{ err }}</div>

    <div class="section">
      <div class="section-title">服务端</div>
      <div class="grid2">
        <div>
          <div class="field"><label>接口名</label><input v-model="sForm.iface" class="input" /></div>
          <div class="field"><label>内网地址(网段)</label><input v-model="sForm.address" class="input" /></div>
          <div class="field"><label>监听端口</label><input v-model="sForm.port" class="input" type="number" /></div>
          <div class="field"><label>MTU</label><input v-model="sForm.mtu" class="input" type="number" /></div>
          <div class="field"><label>客户端 DNS</label><input v-model="sForm.dns" class="input" /></div>
          <div class="field"><label>出网网卡(WAN)</label><input v-model="sForm.wan_if" class="input" placeholder="自动" /></div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-primary" @click="saveServer">保存</button>
            <button class="btn" :class="server?.running?'btn-danger':''" @click="toggleServer">{{ server?.running ? '停止服务端' : '启动服务端' }}</button>
          </div>
        </div>
        <div>
          <div class="status-line" style="margin-bottom:8px;">
            状态: <span :class="server?.running?'ok':'fail'">{{ server?.running ? '运行中' : '已停止' }}</span>
          </div>
          <div class="hint" style="text-align:left;padding:0 0 8px;">分配网段: {{ server?.store.address }} · 监听: {{ server?.store.port }}</div>
          <div class="mono-block" style="max-height:200px;overflow:auto;border:1px solid var(--border);padding:10px;white-space:pre;">{{ server?.normalized }}</div>
        </div>
      </div>

      <div class="section-title" style="margin-top:20px;">对端 (Peer)</div>
      <div v-if="server?.store.peers.length">
        <div v-for="p in server.store.peers" :key="p.name" class="peer">
          <code class="tag-chip">{{ p.name }}</code>
          <span class="mono-block">{{ p.address }}</span>
          <button class="btn btn-sm" @click="doExport(p.name)">导出客户端</button>
          <button class="btn btn-sm btn-danger" @click="delPeer(p.name)">删除</button>
        </div>
      </div>
      <div v-else class="hint" style="text-align:left;padding:0 0 8px;">暂无对端,添加一个以生成客户端配置。</div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <input v-model="newPeer" class="input" placeholder="对端名称(字母数字_-)" style="flex:1;" />
        <button class="btn btn-primary" @click="addPeer">添加对端</button>
      </div>
    </div>

    <div class="section">
      <div class="section-title">已导入配置</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input v-model="importName" class="input" placeholder="配置名称" style="width:180px;" />
        <button class="btn btn-primary" @click="importConf">导入</button>
      </div>
      <textarea v-model="importContent" class="input" rows="5" placeholder="粘贴 [Interface] ... 配置内容" style="width:100%;font-family:var(--font-mono);"></textarea>
      <div style="margin-top:12px;">
        <div v-if="!env.profiles.length" class="hint" style="text-align:left;padding:0;">暂无配置文件。</div>
        <div v-for="n in env.profiles" :key="n" class="peer">
          <code class="tag-chip">{{ n }}</code>
          <span class="status-line" :class="env.running.includes(n)?'ok':'fail'">{{ env.running.includes(n) ? '运行中' : '停止' }}</span>
          <button class="btn btn-sm" :class="env.running.includes(n)?'btn-danger':''" @click="profAction(n, env.running.includes(n)?'down':'up')">{{ env.running.includes(n) ? '停止' : '启动' }}</button>
          <button class="btn btn-sm" @click="profAction(n, 'autostart')">开机自启</button>
          <button class="btn btn-sm btn-danger" @click="profAction(n, 'delete')">删除</button>
        </div>
      </div>
    </div>

    <div v-if="showExport" class="overlay" @click.self="showExport = false">
      <div class="modal">
        <div class="modal-header"><h3>客户端配置</h3><button class="btn btn-sm" @click="showExport=false">关闭</button></div>
        <div class="modal-body">
          <div class="mono-block" style="white-space:pre;background:var(--bg);padding:12px;max-height:420px;overflow:auto;">{{ exportConf }}</div>
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
.field .input { width: 200px; }
.peer { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); padding: 8px 12px; margin-bottom: 6px; }
</style>