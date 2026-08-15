<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { api } from '../../api'

const tab = ref('config')
const tabs = [
  { key: 'config', label: '配置文件' },
  { key: 'subs', label: '订阅 · 节点' },
]

// ---------- 配置 ----------
const env = ref({ profiles: [], running: '', dir: '' })
const err = ref('')
const selected = ref(null)
const cfgText = ref('')
const testResult = ref(null)
const wizard = ref({ protocol: 'vmess', name: '', port: 1080, address: '', uuid: '', password: '', cipher: 'none', network: 'ws', path: '/', security: 'tls', sni: '', id: '' })

function runningNames() {
  const out = []
  for (const m of (env.value.running || '').matchAll(/rcvpn-v2ray-([\w.-]+)\.service/g)) out.push(m[1])
  return out
}
async function refreshEnv() { err.value = ''; env.value = await api.v2Env().catch(e => { err.value = e.message; return { profiles: [], running: '', dir: '' } }) }
async function refresh() { await refreshEnv(); selected.value = null }

async function load(name) {
  const r = await api.v2Load(name).catch(e => { err.value = e.message; return null })
  if (r) { selected.value = r; cfgText.value = JSON.stringify(r.config, null, 2) }
}
async function act(name, action) {
  err.value = ''
  await api.v2Action(name, action).catch(e => err.value = e.message)
  refreshEnv()
}
async function saveCfg() {
  if (!selected.value) return
  let cfg
  try { cfg = JSON.parse(cfgText.value) } catch (e) { err.value = '配置 JSON 无效: ' + e.message; return }
  const r = await api.v2Save(selected.value.name, cfg).catch(e => { err.value = e.message; return null })
  if (r) selected.value = await api.v2Load(r.name).catch(() => selected.value)
}
async function v2test(name) {
  testResult.value = { loading: true }
  const r = await api.v2Test(name).catch(e => { err.value = e.message; return null })
  testResult.value = r || { error: '测试失败' }
}
async function doWizard() {
  const w = wizard.value
  const body = { protocol: w.protocol, name: w.name.trim(), port: parseInt(w.port || 1080), address: w.address.trim() }
  if (w.uuid) body.uuid = w.uuid
  if (w.password) body.password = w.password
  if (w.cipher) body.cipher = w.cipher
  if (w.network) body.network = w.network
  if (w.path) body.path = w.path
  if (w.security) body.security = w.security
  if (w.sni) body.sni = w.sni
  if (w.id) body.id = w.id
  const r = await api.v2Wizard(body).catch(e => { err.value = e.message; return null })
  if (r) { wizard.value.name = ''; refreshEnv() }
}

// ---------- 订阅 ----------
const subs = ref([])
const subUrl = ref('')
const subName = ref('')
const refreshing = ref('')

async function refreshSubs() { subs.value = await api.v2Subs().catch(() => []) }
async function addSub() {
  if (!subUrl.value) return
  await api.v2SubAdd(subUrl.value, subName.value).catch(e => err.value = e.message)
  subUrl.value = ''; subName.value = ''
  refreshSubs()
}
async function delSub(url) {
  if (!confirm('删除订阅?')) return
  await api.v2SubDel(url).catch(e => err.value = e.message)
  refreshSubs()
}
async function refreshSub(url) {
  refreshing.value = url || 'ALL'
  await api.v2SubRefresh(url || undefined).catch(e => err.value = e.message)
  refreshing.value = ''
  refreshSubs()
}

const protoLabel = computed(() => ({ vmess: 'uuid', vless: 'uuid', trojan: '密码', ss: '密码' }[wizard.value.protocol] || 'uuid'))

let timer = null
onMounted(() => { refresh(); refreshSubs(); timer = setInterval(() => { refreshEnv() }, 8000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div>
    <div v-if="err" class="error" style="margin-bottom:12px;">{{ err }}</div>

    <div class="tabs" style="margin-bottom:16px;">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
    </div>

    <!-- ===== 配置 ===== -->
    <template v-if="tab === 'config'">
      <div class="section">
        <div class="section-title">配置文件</div>
        <div v-if="!env.profiles.length" class="hint" style="text-align:left;padding:0;">暂无配置。可在「向导」创建,或到「订阅」页选择一个节点连接。</div>
        <div v-for="n in env.profiles" :key="n" class="peer">
          <code class="tag-chip">{{ n }}</code>
          <span class="status-line" :class="runningNames().includes(n)?'ok':'fail'">{{ runningNames().includes(n) ? '运行中' : '停止' }}</span>
          <button class="btn btn-sm" @click="load(n)">编辑</button>
          <button class="btn btn-sm" :class="runningNames().includes(n)?'btn-danger':''" @click="act(n, runningNames().includes(n)?'down':'up')">{{ runningNames().includes(n) ? '停止' : '启动' }}</button>
          <button class="btn btn-sm btn-ghost" @click="v2test(n)">测速</button>
          <button class="btn btn-sm" @click="act(n, 'autostart')">自启</button>
          <button class="btn btn-sm btn-danger" @click="act(n, 'delete')">删除</button>
        </div>
        <div v-if="testResult" class="res">
          <div v-if="testResult.loading">测速中...</div>
          <div v-else-if="testResult.ok" class="ok">通过 · {{ testResult.ms }}ms · 出口 {{ testResult.exit_ip }}</div>
          <div v-else class="fail">失败: {{ testResult.error }}</div>
        </div>
      </div>

      <div v-if="selected" class="section">
        <div class="section-title">编辑: {{ selected.name }}</div>
        <textarea v-model="cfgText" class="input" rows="16" style="width:100%;font-family:var(--font-mono);"></textarea>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-primary" @click="saveCfg">保存(需重启生效)</button>
          <button class="btn" @click="act(selected.name, 'restart')">重启</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">向导创建</div>
        <div class="grid3">
          <div class="field"><label>协议</label>
            <select v-model="wizard.protocol" class="select">
              <option>vmess</option><option>vless</option><option>trojan</option><option>ss</option>
            </select>
          </div>
          <div class="field"><label>名称</label><input v-model="wizard.name" class="input" placeholder="config-name" /></div>
          <div class="field"><label>本地端口</label><input v-model="wizard.port" class="input" type="number" /></div>
          <div class="field"><label>服务器地址</label><input v-model="wizard.address" class="input" placeholder="域名或 IP" /></div>
          <div class="field"><label>{{ protoLabel }}</label><input v-model="wizard[['uuid','id'].includes(wizard.protocol)?'uuid':'password']" class="input" /></div>
          <div class="field"><label>加密方式</label><input v-model="wizard.cipher" class="input" placeholder="none / aes-256-gcm" /></div>
          <div class="field"><label>传输方式</label><input v-model="wizard.network" class="input" placeholder="tcp / ws / grpc" /></div>
          <div class="field"><label>path</label><input v-model="wizard.path" class="input" placeholder="/path" /></div>
          <div class="field"><label>安全</label><input v-model="wizard.security" class="input" placeholder="tls / reality" /></div>
          <div class="field"><label>SNI</label><input v-model="wizard.sni" class="input" /></div>
        </div>
        <div style="margin-top:10px;"><button class="btn btn-primary" @click="doWizard">创建配置</button></div>
      </div>
    </template>

    <!-- ===== 订阅 ===== -->
    <template v-else>
      <div class="section">
        <div class="section-title">订阅链接</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input v-model="subUrl" class="input" placeholder="https://... 订阅链接" style="flex:1;min-width:260px;" />
          <input v-model="subName" class="input" placeholder="名称(可选)" style="width:160px;" />
          <button class="btn btn-primary" @click="addSub">添加订阅</button>
          <button class="btn btn-ghost" @click="refreshSub()">全部刷新</button>
        </div>
        <div v-if="!subs.length" class="hint" style="text-align:left;padding:0;">暂无订阅, 添加后在「节点」页查看连接。</div>
        <div v-for="s in subs" :key="s.url" class="peer">
          <div style="flex:1;min-width:0;">
            <code class="tag-chip">{{ s.name || '未命名' }}</code>
            <span class="mono-block" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ s.url }}</span>
          </div>
          <span class="status-line">{{ s.count != null ? s.count + ' 节点' : '' }}</span>
          <span class="status-line" :class="s.last_ok===false?'fail':(s.last_ok?'ok':'')">{{ s.last_ok===false?'失败':(s.last_ok?'成功':'') }}</span>
          <button class="btn btn-sm btn-ghost" :disabled="refreshing===s.url" @click="refreshSub(s.url)">{{ refreshing===s.url ? '刷新中...' : '刷新' }}</button>
          <button class="btn btn-sm btn-danger" @click="delSub(s.url)">删除</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.grid3 { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 6px 20px; }
.field { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; }
.field label { font-size: 12px; color: var(--text-muted); min-width: 70px; }
.field .input, .field .select { width: 150px; }
.peer { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); padding: 8px 12px; margin-bottom: 6px; }
.res { margin-top: 8px; font-size: 12px; font-family: var(--font-mono); }
.ck input { width: 15px; height: 15px; }
</style>