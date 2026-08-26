<script setup>
// 终端 — 按旧前端清单重建: 多会话标签页 + VT100 + 本地/SSH + 右侧工具(主机/常用命令)
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { request } from '../api/client'
import { VT100Terminal } from '../terminal/vt100'

const sessions = ref([])
const activeIdx = ref(0)
const hosts = ref([])
const commands = ref([])
const toolOpen = ref(false)
const toolTab = ref('host')
const fullScreen = ref(false)
const fonts = ref(14)
const errMsg = ref('')

const showHostForm = ref(false)
const hostForm = ref({ old_host: '', host: '', port: '22', username: 'root', password: '', ps: '' })
const showCmdForm = ref(false)
const cmdForm = ref({ old_title: '', title: '', shell: '' })

let sid = 0
let es = null

/* ---- 会话 ---- */
function newSession(spec = {}) {
  const id = 's' + (++sid)
  const s = {
    id,
    label: spec.label || (spec.target === 'ssh' ? spec.host : '本地服务器'),
    host: spec.host || '127.0.0.1',
    spec, wsId: '',
    term: new VT100Terminal({ cols: 100, rows: 24, scrollback: 5000 }),
    status: 'connecting', connecting: true, closed: false, errMsg: '', lines: [],
  }
  sessions.value.push(s)
  activeIdx.value = sessions.value.length - 1
  if (spec.target !== 'ssh') connectLocal(s)
}

function connectLocal(s) {
  s.connecting = true
  s.status = 'connecting'
  request.post('/api/terminal/open', { rows: 24, cols: 100 })
    .then((d) => {
      s.wsId = d.sid
      s.status = 'ok'
      s.connecting = false
      if (es) es.close()
      es = new EventSource('/api/terminal/stream?sid=' + d.sid)
      es.onmessage = (ev) => {
        try { const t = atob(ev.data); s.term.write(t); refresh() } catch (e) {}
      }
      es.onerror = () => {}
    })
    .catch((e) => { s.status = 'err'; s.errMsg = e.message; s.connecting = false })
}

function activate(i) {
  activeIdx.value = i
  if (i >= 0) refresh()
}

function closeSession(i) {
  const s = sessions.value[i]
  if (s.wsId) request.post('/api/terminal/close', { sid: s.wsId }).catch(() => {})
  sessions.value.splice(i, 1)
  if (activeIdx.value >= sessions.value.length) activeIdx.value = sessions.value.length - 1
  if (!sessions.value.length) es = null
}

function sendInput(s, text) {
  if (!s.wsId) return
  const b64 = btoa(unescape(encodeURIComponent(text)))
  request.post('/api/terminal/input', { sid: s.wsId, data: b64 }).catch(() => {})
}

function onKeydown(e) {
  const s = sessions.value[activeIdx.value]
  if (!s || !s.wsId) return
  e.preventDefault()
  let text = ''
  if (e.ctrlKey) {
    text = { c: '\x03', d: '\x04', l: '\x0c', a: '\x01', u: '\x15', z: '\x1a' }[e.key] || ''
  } else if (e.key === 'Enter') text = '\r'
  else if (e.key === 'Backspace') text = '\x7f'
  else if (e.key === 'Tab') text = '\t'
  else if (e.key === 'Escape') text = '\x1b'
  else if (e.key === 'ArrowUp') text = '\x1b[A'
  else if (e.key === 'ArrowDown') text = '\x1b[B'
  else if (e.key === 'ArrowRight') text = '\x1b[C'
  else if (e.key === 'ArrowLeft') text = '\x1b[D'
  else if (e.key.length === 1) text = e.key
  if (text) { s.term.write(text); refresh(); sendInput(s, text) }
}

function focusTerm() {
  let input = document.getElementById('term-input-slot')
  if (!input) {
    input = document.createElement('input')
    input.id = 'term-input-slot'
    input.style.cssText = 'opacity:0;position:fixed;left:-99px;top:0;'
    document.body.appendChild(input)
    input.addEventListener('keydown', onKeydown)
    input.addEventListener('blur', () => setTimeout(() => input && input.focus(), 100))
  }
  input.focus()
}

function refresh() {
  if (activeIdx.value >= 0 && sessions.value[activeIdx.value]) {
    sessions.value[activeIdx.value].lines = sessions.value[activeIdx.value].term.renderLines()
  }
  nextTick(() => { const el = document.querySelector('.term-scroll'); if (el) el.scrollTop = el.scrollHeight })
}

function cellStyle(c) {
  const COLORS = ['#000', '#e05252', '#3fb950', '#d29922', '#58a6ff', '#a371f7', '#39c5cf', '#c9d1d9', '#8b949e', '#ff6b63', '#3fb950', '#f0b429', '#58a6ff', '#a371f7', '#39c5cf', '#fff']
  return { color: COLORS[(c && c.fg) || 7] || '#c9d1d9', fontWeight: c && c.bold ? 700 : 400, opacity: c && c.dim ? 0.6 : 1 }
}

/* ---- 主机/命令 CRUD ---- */
async function loadHosts() {
  try { hosts.value = (await request.get('/api/terminal/hosts')) || [] } catch (e) { errMsg.value = e.message }
}
async function loadCommands() {
  try { commands.value = (await request.get('/api/terminal/commands')) || [] } catch (e) {}
}
async function saveHost() {
  const h = hostForm.value
  try {
    if (h.old_host) await request.put('/api/terminal/hosts', h)
    else await request.post('/api/terminal/hosts', h)
    hostForm.value = { old_host: '', host: '', port: '22', username: 'root', password: '', ps: '' }
    showHostForm.value = false
    loadHosts()
  } catch (e) { errMsg.value = e.message }
}
function editHost(h) {
  hostForm.value = { old_host: h.host, host: h.host, port: h.port || '22', username: h.username || '', password: '', ps: h.ps || '' }
  showHostForm.value = true
}
async function delHost(h) {
  if (!confirm('删除主机 ' + h.host + '?')) return
  try { await request.del('/api/terminal/hosts?host=' + encodeURIComponent(h.host)); loadHosts() } catch (e) { errMsg.value = e.message }
}
function connectHost(h) {
  newSession({ target: 'ssh', host: h.host, port: h.port, username: h.username, password: h.password, label: h.host })
}
async function saveCmd() {
  const c = cmdForm.value
  try {
    if (c.old_title) await request.put('/api/terminal/commands', c)
    else await request.post('/api/terminal/commands', c)
    cmdForm.value = { old_title: '', title: '', shell: '' }
    showCmdForm.value = false
    loadCommands()
  } catch (e) { errMsg.value = e.message }
}
function editCmd(c) {
  cmdForm.value = { old_title: c.title, title: c.title, shell: c.shell }
  showCmdForm.value = true
}
async function delCmd(c) {
  if (!confirm('删除命令 ' + c.title + '?')) return
  try { await request.del('/api/terminal/commands?title=' + encodeURIComponent(c.title)); loadCommands() } catch (e) { errMsg.value = e.message }
}
function sendCmd(c) {
  const s = sessions.value[activeIdx.value]
  if (!s) return
  const text = c.shell + '\r'
  s.term.write(text); refresh(); sendInput(s, text)
}

onMounted(() => { loadHosts(); loadCommands(); newSession(); focusTerm() })
onUnmounted(() => { if (es) es.close() })
</script>

<template>
  <div class="page" :class="{ fullscreen: fullScreen }">
    <div class="term-tabs">
      <div v-for="(s, i) in sessions" :key="s.id" class="term-tab" :class="{ active: i === activeIdx }" @click="activate(i)">
        <span class="dot" :class="s.status"></span>
        <span>{{ s.label }}</span>
        <span class="tab-close" @click.stop="closeSession(i)">✕</span>
      </div>
      <span class="grow"></span>
      <button class="btn btn-sm btn-ghost" @click="newSession()">+ 本地</button>
      <button class="btn btn-sm btn-ghost" @click="toolOpen = true; toolTab = 'host'">SSH</button>
      <button class="btn btn-sm btn-ghost" @click="fullScreen = !fullScreen">{{ fullScreen ? '退出全屏' : '全屏' }}</button>
      <button class="btn btn-sm btn-ghost" @click="fonts = Math.max(10, fonts - 1)">A-</button>
      <button class="btn btn-sm btn-ghost" @click="fonts = Math.min(24, fonts + 1)">A+</button>
    </div>

    <div class="term-body" :style="{ fontSize: fonts + 'px' }">
      <div class="term-main" @click="focusTerm">
        <div class="term-scroll">
          <template v-if="sessions[activeIdx]">
            <div v-for="(line, ri) in sessions[activeIdx].lines" :key="ri" class="term-line">
              <span v-for="(c, ci) in line.cells" :key="ci" class="tc" :style="cellStyle(c)">{{ c.ch === ' ' ? '\u00a0' : c.ch }}</span>
            </div>
            <div v-if="sessions[activeIdx].connecting" class="term-hint">连接中...</div>
            <div v-if="sessions[activeIdx].errMsg" class="term-hint" style="color:var(--danger);">{{ sessions[activeIdx].errMsg }}</div>
          </template>
        </div>
      </div>

      <div v-if="toolOpen" class="term-tools">
        <div class="tool-head">
          <button class="btn btn-sm" :class="{ 'btn-primary': toolTab === 'host' }" @click="toolTab = 'host'">主机</button>
          <button class="btn btn-sm" :class="{ 'btn-primary': toolTab === 'cmd' }" @click="toolTab = 'cmd'">命令</button>
          <button class="btn btn-sm btn-ghost" @click="toolOpen = false">✕</button>
        </div>

        <template v-if="toolTab === 'host'">
          <div class="tool-list">
            <div v-for="h in hosts" :key="h.host" class="tool-item">
              <div class="ti-main" @dblclick="connectHost(h)">
                <b>{{ h.host }}</b>
                <div class="mono faint" style="font-size:11px;">{{ h.username || 'root' }}:{{ h.port || 22 }}</div>
              </div>
              <div class="ti-ops">
                <button class="btn btn-sm" @click="connectHost(h)">连</button>
                <button class="btn btn-sm" @click="editHost(h)">编</button>
                <button class="btn btn-sm btn-danger" @click="delHost(h)">删</button>
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-primary tool-add" @click="showHostForm = true">+ 添加主机</button>
        </template>

        <template v-else>
          <div class="tool-list">
            <div v-for="c in commands" :key="c.title" class="tool-item">
              <div class="ti-main" @click="sendCmd(c)">
                <b>{{ c.title }}</b>
                <div class="mono faint" style="font-size:11px;">{{ c.shell }}</div>
              </div>
              <div class="ti-ops">
                <button class="btn btn-sm" @click="editCmd(c)">编</button>
                <button class="btn btn-sm btn-danger" @click="delCmd(c)">删</button>
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-primary tool-add" @click="showCmdForm = true">+ 添加命令</button>
        </template>
      </div>
    </div>

    <!-- 主机表单 -->
    <div v-if="showHostForm" class="modal-mask" @click.self="showHostForm = false">
      <div class="card" style="width:420px;padding:18px;">
        <b style="margin-bottom:12px;display:block;">{{ hostForm.old_host ? '编辑主机' : '添加主机' }}</b>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <input v-model="hostForm.host" class="input" placeholder="服务器 IP / 域名" />
          <div style="display:flex;gap:8px;">
            <input v-model="hostForm.port" class="input" style="width:80px" placeholder="22" />
            <input v-model="hostForm.username" class="input" style="flex:1" placeholder="用户名 (root)" />
          </div>
          <input v-model="hostForm.password" class="input" type="password" placeholder="密码 (留空=SSH 密钥)" />
          <input v-model="hostForm.ps" class="input" placeholder="备注" />
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
          <button class="btn btn-ghost" @click="showHostForm = false">取消</button>
          <button class="btn btn-primary" @click="saveHost">保存</button>
        </div>
      </div>
    </div>

    <!-- 命令表单 -->
    <div v-if="showCmdForm" class="modal-mask" @click.self="showCmdForm = false">
      <div class="card" style="width:420px;padding:18px;">
        <b style="margin-bottom:12px;display:block;">{{ cmdForm.old_title ? '编辑命令' : '添加命令' }}</b>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <input v-model="cmdForm.title" class="input" placeholder="命令名称" />
          <textarea v-model="cmdForm.shell" class="input mono" style="min-height:70px" placeholder="Shell 内容"></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
          <button class="btn btn-ghost" @click="showCmdForm = false">取消</button>
          <button class="btn btn-primary" @click="saveCmd">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.term-tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.term-tab { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.term-tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.grow { flex: 1; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.connecting { background: var(--warning); }
.dot.ok { background: var(--success); }
.dot.err { background: var(--danger); }
.tab-close { opacity: .6; padding: 0 2px; }
.tab-close:hover { opacity: 1; }
.term-body { display: flex; gap: 10px; height: calc(100vh - 210px); }
.term-main { flex: 1; background: #0a0e14; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; }
.term-scroll { flex: 1; overflow-y: auto; padding: 10px; white-space: pre; cursor: text; }
.term-line { min-height: 1.4em; }
.tc { font-family: var(--font-mono); }
.term-hint { color: var(--text-faint); padding: 8px; font-size: 12px; }
.term-tools { width: 240px; border: 1px solid var(--border); display: flex; flex-direction: column; background: var(--surface-2); }
.tool-head { display: flex; gap: 4px; padding: 8px; border-bottom: 1px solid var(--border); }
.tool-list { flex: 1; overflow-y: auto; padding: 6px; }
.tool-item { display: flex; align-items: center; gap: 6px; padding: 6px; border-bottom: 1px solid var(--border); }
.ti-main { flex: 1; min-width: 0; cursor: pointer; }
.ti-ops { display: flex; gap: 3px; }
.tool-add { margin: 8px; }
.fullscreen { position: fixed; inset: 0; z-index: 999; background: var(--bg); padding: 10px 18px; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex; align-items: center; justify-content: center; }
</style>