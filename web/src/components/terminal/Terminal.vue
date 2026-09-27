<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'
import { VT100Terminal } from '../../terminal/vt100'
import TerminalDom from './TerminalDom.vue'
import { copyText, readText } from '../../utils/clipboard'

/* =========================================================================
   终端(重做): 清空旧实现后按「会话栏 + 屏幕/工具栏 + 状态栏」三段式重写。
   功能与旧版一一对应(见 reader.txt): 多会话/SSE 流/输入/resize/字号/复制粘贴/
   全屏/F5 阻断/服务器增删改查+拖拽排序/常用命令增删改查+复制执行/快捷连接/
   会话右键菜单(复制/关闭/关闭右侧/关闭其他)/提示与错误。
   后端契约沿用 /api/terminal/*(SSE + HTTP 输入)。
   ========================================================================= */

/* ---------------- 状态 ---------------- */
const sessions = ref([]) // [{term, wsId, label, host, spec, status, connecting, closed, _es, _canvas}]
const activeIdx = ref(0)
const active = computed(() => sessions.value[activeIdx.value] || null)
const hosts = ref([])     // 服务器列表(后端 core_terminal 持久化)
const commands = ref([])  // 常用命令
const toolOpen = ref(true)
const toolTab = ref('host')
const fullScreen = ref(false)
const fonts = ref(14)
const toastMsg = ref('')
const errMsg = ref('')
const tabMenu = ref({ show: false, x: 0, y: 0, idx: -1 })

/* 弹窗表单 */
const showHostForm = ref(false)
const hostForm = ref({ old_host: '', host: '', port: '22', username: 'root', password: '', pkey: '', passphrase: '', ps: '', authType: 0 })
const hostFormTitle = ref('添加服务器')
const showCmdForm = ref(false)
const cmdForm = ref({ old_title: '', title: '', shell: '' })
const cmdFormTitle = ref('添加常用命令')

/* 快捷连接 */
const quickVal = ref('')

const reconnectDelays = {}
let sidCounter = 1
let toastTimer = null

/* ---------------- 提示 ---------------- */
function toast(msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 2600)
}

/* ---------------- 会话 ---------------- */
function openSession(spec) {
  // spec: {target:'local'|'ssh', host, port, username, password, pkey, passphrase, label, id}
  // 远程 SSH 后端未实现(TermManager 只起本地 pty, 密钥/密码均被忽略) → 明示降级, 防"已在远程机"误判
  if (spec.target === 'ssh') {
    const want = spec.host || '远程主机'
    toast('远程 SSH 终端未实现，已打开本机会话（原目标 ' + want + ' 不会连接）')
    spec = { ...spec, target: 'local', label: spec.label ? spec.label + ' · 本机' : '本机终端' }
  }
  if (!spec.id) spec = { ...spec, id: 's' + (sidCounter++) }
  const label = spec.label || (spec.target === 'local' ? '本地服务器' : spec.host || 'SSH 会话')
  const s = {
    term: new VT100Terminal({ cols: 80, rows: 24, scrollback: 5000 }),
    wsId: '', closed: false, connecting: true, status: 'info',
    label, host: spec.host || '127.0.0.1', spec: { ...spec, label },
  }
  sessions.value.push(s)
  activeIdx.value = sessions.value.length - 1
  openSocket(s)
}

function newLocalSession() {
  openSession({ target: 'local', label: '本地会话 ' + (sessions.value.length + 1) })
}

function openSocket(s) {
  s.closed = false
  s.connecting = true
  s.status = 'info'
  closeSocket(s)
  // SSE 输出流 + HTTP 输入(本地会话)
  api.tmOpen(24, 100)
    .then((d) => {
      s.wsId = d.sid
      s.status = 'success'
      s.connecting = false
      if (s._es) { try { s._es.close() } catch (e) {} }
      const es = new EventSource('/api/terminal/stream?sid=' + d.sid)
      s._es = es
      // base64 → UTF-8 字节 → 文本。
      // 旧实现直接 atob() 得到"每字节一个字符"的 Latin-1 串, 中文等多字节输出
      // 全部乱码(如 PAM 的"密码：" → å¯ç ï¼:)。解码器按会话持有并用 stream 模式,
      // 跨块的多字节序列由 TextDecoder 自行拼接。
      s._dec = new TextDecoder('utf-8')
      es.onmessage = (ev) => {
        try {
          const bytes = Uint8Array.from(atob(ev.data), (c) => c.charCodeAt(0))
          const text = s._dec.decode(bytes, { stream: true })
          if (text && s.term) s.term.write(text)
          if (s._canvas && typeof s._canvas.forceDraw === 'function') {
            try { s._canvas.forceDraw() } catch (e) {}
          }
        } catch (e) {}
      }
      es.onerror = () => {} // EventSource 自带重连
    })
    .catch((e) => {
      s.status = 'err'
      s.errMsg = e.message
      s.connecting = false
      scheduleReconnect(s)
    })
}

function scheduleReconnect(s) {
  if (s._userClose || s.closed) return
  const delay = reconnectDelays[s.label] == null ? 1500 : Math.min(8000, (reconnectDelays[s.label] || 1000) * 2)
  reconnectDelays[s.label] = delay
  setTimeout(() => {
    if (s._userClose || s.closed) return
    if (document.visibilityState === 'hidden') { scheduleReconnect(s); return }
    openSocket(s)
  }, delay)
}

function closeSocket(s) {
  if (s._es) {
    try { s._es.close() } catch (e) {}
    s._es = null
  }
}

function sendMsg(s, obj) {
  if (!s || !s.wsId) return
  if (obj && obj.type === 'input' && obj.data != null) {
    // 输入合并: 连续输入在 16ms 窗口内拼成一次 POST(快速打字/自动重复时,
    // 请求数从"每键一个"降到约 60/s, 减少往返与接口监控噪音); 粘贴大块立即冲刷
    s._inBuf = (s._inBuf || '') + obj.data
    if (!s._inTimer) s._inTimer = setTimeout(() => flushInput(s), 16)
    if (s._inBuf.length > 4096) flushInput(s)
  } else if (obj && obj.type === 'resize') {
    flushInput(s) // 先冲刷输入, 再同步尺寸
    api.tmResize(s.wsId, obj.rows, obj.cols).catch(() => {})
  }
}

function flushInput(s) {
  if (!s) return
  if (s._inTimer) { clearTimeout(s._inTimer); s._inTimer = null }
  const data = s._inBuf || ''
  s._inBuf = ''
  if (!data || !s.wsId) return
  const b64 = btoa(unescape(encodeURIComponent(data)))
  api.tmInput(s.wsId, b64).catch(() => {})
}

function activate(i) {
  activeIdx.value = i
  nextTick(() => {
    const s = sessions.value[activeIdx.value]
    // 重新量测单元格并聚焦(TerminalDom defineExpose 暴露 measure)
    try { if (s && s._canvas) s._canvas.measure() } catch (e) {}
  })
}

function statusText(s) {
  if (s.connecting) return '连接中'
  if (s.status === 'err') return '失败'
  if (s.status === 'success') return '已连接'
  return '等待'
}

function retryActive() {
  const s = active.value
  if (!s) return
  delete reconnectDelays[s.label]
  s._userClose = false
  openSocket(s)
}

function closeSession(s) {
  s._userClose = true
  s.closed = true
  if (s._inTimer) { clearTimeout(s._inTimer); s._inTimer = null } // 丢弃未冲刷的输入, 避免悬挂定时器
  s._inBuf = ''
  closeSocket(s)
  if (s.wsId) { api.tmClose(s.wsId).catch(() => {}) }
  s.wsId = ''
  const idx = sessions.value.indexOf(s)
  if (idx >= 0) sessions.value.splice(idx, 1)
  if (sessions.value.length === 0) {
    openSession({ target: 'local', label: '本地服务器' })
  } else if (activeIdx.value >= sessions.value.length) {
    activeIdx.value = sessions.value.length - 1
  }
}

function closeRight(id) {
  const idx = sessions.value.findIndex((x) => x.spec.id === id)
  if (idx < 0) return
  const right = sessions.value.slice(idx + 1)
  for (const s of right) {
    s._userClose = true; s.closed = true; closeSocket(s)
    if (s.wsId) { api.tmClose(s.wsId).catch(() => {}); s.wsId = '' }
  }
  sessions.value = sessions.value.slice(0, idx + 1)
  activeIdx.value = idx
}

function closeOthers(id) {
  const keep = sessions.value.filter((x) => x.spec.id === id)
  for (const s of sessions.value) {
    if (s.spec.id === id) continue
    s._userClose = true; s.closed = true; closeSocket(s)
    if (s.wsId) { api.tmClose(s.wsId).catch(() => {}); s.wsId = '' }
  }
  sessions.value = keep
  activeIdx.value = 0
}

function duplicateSession(s) {
  openSession({ ...s.spec, id: undefined })
}

function canvasMounted(s, canvas) {
  s._canvas = canvas
}

/* ---------------- 会话标签右键菜单 ---------------- */
function onTabCtx(e, i) {
  const x = Math.min(e.clientX, window.innerWidth - 180)
  const y = Math.min(e.clientY, window.innerHeight - 190)
  tabMenu.value = { show: true, x, y, idx: i }
}
function tabAct(a) {
  const i = tabMenu.value.idx
  const s = sessions.value[i]
  tabMenu.value.show = false
  if (!s) return
  if (a === 'copy') duplicateSession(s)
  else if (a === 'close') closeSession(s)
  else if (a === 'right') closeRight(s.spec.id)
  else if (a === 'others') closeOthers(s.spec.id)
}
function onDocClick() { if (tabMenu.value.show) tabMenu.value.show = false }

/* ---------------- 输入/粘贴/字号 ---------------- */
function onInput(s, data) {
  if (!s || data == null) return
  sendMsg(s, { type: 'input', data })
}

function onResize(s, rows, cols) {
  if (s.term) s.term.resize(cols, rows)
  sendMsg(s, { type: 'resize', rows, cols })
}

function onFont(_s, delta) {
  fonts.value = Math.min(32, Math.max(10, fonts.value + delta))
  nextTick(() => {
    const s = active.value
    if (s && s._canvas) { try { s._canvas.measure() } catch (e) {} }
  })
}

async function copyActive() {
  const s = active.value
  if (!s || !s.term) return
  try {
    const info = s.term.getGrid()
    const lines = []
    for (let y = 0; y < info.grid.length; y++) lines.push(s.term.lineText(y))
    const text = lines.join('\n').trimEnd()
    if (!text) return
    await copyText(text)
    toast('已复制屏面内容')
  } catch (e) { errMsg.value = e.message }
}

async function pasteActive() {
  const s = active.value
  if (!s) return
  try {
    const text = await readText()
    if (text) onInput(s, text)
  } catch (e) { errMsg.value = e.message }
}

/* ---------------- 全屏 ---------------- */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    fullScreen.value = true
  } else {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
    fullScreen.value = false
  }
}
function onFsChange() { fullScreen.value = !!document.fullscreenElement }

/* ---------------- 服务器 / 常用命令 CRUD ---------------- */
async function loadHosts() {
  try { hosts.value = await api.tmHostsList() } catch (e) { errMsg.value = e.message }
}
async function loadCommands() {
  try { commands.value = await api.tmCommandsList() } catch (e) { errMsg.value = e.message }
}

function openHostForm(item) {
  hostForm.value = item
    ? { old_host: item.host, host: item.host, port: item.port || '22', username: item.username, password: item.password || '', pkey: item.pkey || '', passphrase: item.passphrase || '', ps: item.ps || '', authType: item.pkey ? 1 : 0 }
    : { old_host: '', host: '', port: '22', username: 'root', password: '', pkey: '', passphrase: '', ps: '', authType: 0 }
  hostFormTitle.value = item ? '编辑服务器【' + item.host + '】' : '添加服务器'
  showHostForm.value = true
}

async function saveHost() {
  const f = hostForm.value
  if (!f.host.trim()) { errMsg.value = '服务器地址不能为空'; return }
  const body = {
    host: f.host.trim(), port: f.port || '22', username: (f.username || '').trim() || 'root',
    password: f.authType === 0 ? f.password : '',
    pkey: f.authType === 1 ? f.pkey : '',
    passphrase: f.authType === 1 ? f.passphrase : '',
    ps: (f.ps || '').trim() || f.host.trim(),
  }
  try {
    if (f.old_host) {
      const r = await api.tmHostUpdate({ ...body, old_host: f.old_host })
      hosts.value = r.hosts || []
      toast('已保存')
    } else {
      const r = await api.tmHostCreate(body)
      hosts.value = r.hosts || []
      toast('已保存')
    }
    showHostForm.value = false
    errMsg.value = ''
  } catch (e) { errMsg.value = e.message }
}

async function deleteHost(host) {
  try {
    const r = await api.tmHostDelete(host)
    hosts.value = r.hosts || []
    toast('已删除服务器')
  } catch (e) { errMsg.value = e.message }
}

function connectHost(item) {
  openSession({ target: 'ssh', host: item.host, port: item.port, username: item.username, password: item.password || '', pkey: item.pkey || '', passphrase: item.passphrase || '', label: item.ps || item.host })
}

function openCmdForm(item) {
  cmdForm.value = item
    ? { old_title: item.title, title: item.title, shell: item.shell }
    : { old_title: '', title: '', shell: '' }
  cmdFormTitle.value = item ? '编辑常用命令【' + item.title + '】' : '添加常用命令'
  showCmdForm.value = true
}

async function saveCmd() {
  const f = cmdForm.value
  if (!f.title.trim()) { errMsg.value = '命令名称不能为空'; return }
  if (!f.shell.trim()) { errMsg.value = '命令内容不能为空'; return }
  try {
    let r
    if (f.old_title) r = await api.tmCommandUpdate({ old_title: f.old_title, title: f.title.trim(), shell: f.shell })
    else r = await api.tmCommandCreate({ title: f.title.trim(), shell: f.shell })
    commands.value = r.commands || []
    showCmdForm.value = false
    errMsg.value = ''
    toast('已保存')
  } catch (e) { errMsg.value = e.message }
}

async function deleteCmd(title) {
  try {
    const r = await api.tmCommandDelete(title)
    commands.value = r.commands || []
    toast('已删除命令')
  } catch (e) { errMsg.value = e.message }
}

async function copyCmd(shell) {
  await copyText(shell)
  toast('已复制命令')
}

function runCmd(shell) {
  const s = active.value
  if (s) onInput(s, shell)
}

/* ---------------- 快捷连接(root@host:port / user:pw@host:port) ---------------- */
function quickConnect() {
  const v = quickVal.value.trim()
  if (!v) return
  let user = 'root', host = v, port = '22', pw = ''
  if (host.indexOf('@') !== -1) {
    const sp = host.split('@'); user = sp[0]; host = sp[1]
    if (user.indexOf(':') !== -1) { const us = user.split(':'); user = us[0]; pw = us[1] }
  }
  if (host.indexOf(':') !== -1) {
    const hs = host.split(':'); host = hs[0]; port = hs[1]
  }
  if (!host) return
  openSession({ target: 'ssh', host, port, username: user, password: pw, pkey: '', passphrase: '', label: user + '@' + host })
  quickVal.value = ''
}

/* ---------------- 服务器列表拖拽排序(契约: {hosts:[...]} 整体提交) ---------------- */
let dragHost = null
function onHostDragStart(e, host) { dragHost = host; e.dataTransfer.effectAllowed = 'move' }
function onHostDragOver(e) { e.preventDefault() }
function onHostDrop(e, target) {
  e.preventDefault()
  if (!dragHost || dragHost === target) return
  const from = hosts.value.findIndex((h) => h.host === dragHost)
  const to = hosts.value.findIndex((h) => h.host === target)
  if (from < 0 || to < 0) return
  hosts.value.splice(to, 0, hosts.value.splice(from, 1)[0])
  api.tmHostSort(hosts.value.map((h) => ({ ...h }))).catch(() => { errMsg.value = '排序保存失败' })
  dragHost = null
}

/* ---------------- 键盘: 页面内阻止 F5 刷新 ---------------- */
function onDocKey(e) {
  if (e.keyCode === 116 || (e.metaKey && e.keyCode === 82)) {
    if (e.target && (e.target.tagName === 'CANVAS' || (e.target.closest && e.target.closest('.term-page')))) {
      e.preventDefault()
      e.returnValue = false
    }
  }
}

onMounted(() => {
  loadHosts()
  loadCommands()
  openSession({ target: 'local', label: '本地服务器' })
  document.addEventListener('keydown', onDocKey)
  document.addEventListener('fullscreenchange', onFsChange)
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  for (const s of sessions.value) {
    closeSocket(s)
    if (s.wsId) { api.tmClose(s.wsId).catch(() => {}) } // 离开页面即关后端 pty(否则等 60 分钟闲置清理)
    s.wsId = ''
  }
  document.removeEventListener('keydown', onDocKey)
  document.removeEventListener('fullscreenchange', onFsChange)
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="term-page" :class="{ fullscreen: fullScreen }">
    <!-- ===== 会话栏 ===== -->
    <div class="term-tabs">
      <div class="term-tablist">
        <div v-for="(s, i) in sessions" :key="s.spec.id" class="term-tab"
             :class="{ active: i === activeIdx }"
             @click="activate(i)"
             @contextmenu.prevent.stop="onTabCtx($event, i)">
          <span class="tab-label">{{ s.label }}</span>
          <span class="tab-state" :class="'st-' + s.status">{{ statusText(s) }}</span>
          <button class="tab-close" title="关闭该会话" @click.stop="closeSession(s)">关闭</button>
        </div>
        <button class="term-btn" @click="newLocalSession">新建会话</button>
      </div>
      <div class="term-actions">
        <button class="term-btn" :class="{ on: toolOpen }" @click="toolOpen = !toolOpen">工具栏</button>
        <button class="term-btn" @click="toggleFullscreen">{{ fullScreen ? '退出全屏' : '全屏' }}</button>
      </div>
    </div>

    <!-- ===== 屏幕 + 工具栏 ===== -->
    <div class="term-main">
      <div class="term-screen">
        <div v-if="active" class="term-slot">
          <TerminalDom :ref="(c) => { if (c) canvasMounted(active, c) }"
                       :term="active.term || {}" :font-size="fonts"
                       @input="(d) => onInput(active, d)"
                       @resize="(r, c) => onResize(active, r, c)"
                       @font="(d) => onFont(active, d)"
                       @copy="copyActive" @paste="pasteActive" />
        </div>
        <div v-if="active && active.connecting" class="term-overlay">正在建立会话…</div>
        <div v-if="active && active.status === 'err'" class="term-overlay err">
          <span>连接失败：{{ active.errMsg || '未知错误' }}</span>
          <button class="term-btn" @click="retryActive">重试</button>
        </div>
      </div>

      <aside v-if="toolOpen" class="term-side">
        <div class="side-tabs">
          <button class="side-tab" :class="{ on: toolTab === 'host' }" @click="toolTab = 'host'">服务器</button>
          <button class="side-tab" :class="{ on: toolTab === 'cmd' }" @click="toolTab = 'cmd'">常用命令</button>
          <button class="side-collapse" @click="toolOpen = false">收起</button>
        </div>

        <!-- 服务器 -->
        <div v-show="toolTab === 'host'" class="side-block">
          <div class="side-head">
            <span>服务器列表</span>
            <button class="term-btn primary" @click="openHostForm()">添加服务器</button>
          </div>
          <div class="side-quick">
            <input v-model="quickVal" class="input" placeholder="root@host:22 回车快速连接"
                   @keydown.enter="quickConnect" />
          </div>
          <ul class="side-list">
            <li v-for="h in hosts" :key="h.host" class="side-item" draggable="true"
                @dragstart="onHostDragStart($event, h.host)"
                @dragover="onHostDragOver"
                @drop="onHostDrop($event, h.host)"
                @click="connectHost(h)">
              <div class="side-main">
                <div class="side-name">{{ h.ps || h.host }}</div>
                <div class="side-sub">{{ h.username || 'root' }}@{{ h.host }}:{{ h.port || 22 }}</div>
              </div>
              <div class="side-ops" @click.stop>
                <button class="side-op" @click="openHostForm(h)">编辑</button>
                <button class="side-op danger" @click="deleteHost(h.host)">删除</button>
              </div>
            </li>
            <li v-if="!hosts.length" class="side-empty">暂无服务器，点「添加服务器」</li>
          </ul>
          <div class="side-tip">单击连接 · 拖动行排序 · 地址栏支持 user:pw@host:port</div>
        </div>

        <!-- 常用命令 -->
        <div v-show="toolTab === 'cmd'" class="side-block">
          <div class="side-head">
            <span>常用命令</span>
            <button class="term-btn primary" @click="openCmdForm()">添加命令</button>
          </div>
          <ul class="side-list">
            <li v-for="c in commands" :key="c.title" class="side-item" @dblclick="runCmd(c.shell)">
              <div class="side-main">
                <div class="side-name">{{ c.title }}</div>
                <div class="side-sub ellip">{{ c.shell }}</div>
              </div>
              <div class="side-ops" @click.stop>
                <button class="side-op" @click="copyCmd(c.shell)">复制</button>
                <button class="side-op" @click="runCmd(c.shell)">执行</button>
                <button class="side-op" @click="openCmdForm(c)">编辑</button>
                <button class="side-op danger" @click="deleteCmd(c.title)">删除</button>
              </div>
            </li>
            <li v-if="!commands.length" class="side-empty">暂无常用命令，点「添加命令」</li>
          </ul>
          <div class="side-tip">双击条目 = 在当前会话执行</div>
        </div>
      </aside>
    </div>

    <!-- ===== 状态栏 ===== -->
    <footer class="term-bar">
      <span class="bar-item">会话 {{ sessions.length }}</span>
      <span class="bar-item">字号 {{ fonts }}</span>
      <button class="term-btn tiny" @click="onFont(null, -1)">字号 −</button>
      <button class="term-btn tiny" @click="onFont(null, 1)">字号 ＋</button>
      <button class="term-btn tiny" @click="copyActive">复制屏面</button>
      <button class="term-btn tiny" @click="pasteActive">粘贴</button>
      <span class="bar-grow"></span>
      <span v-if="errMsg" class="bar-err">错误：{{ errMsg }}</span>
      <span v-else class="bar-dim">SSE 流式会话 · 输入与窗口尺寸实时同步</span>
    </footer>

    <!-- ===== 添加/编辑服务器 ===== -->
    <div v-if="showHostForm" class="term-mask" @click.self="showHostForm = false">
      <div class="term-form">
        <div class="form-head">
          <span>{{ hostFormTitle }}</span>
          <button class="term-btn" @click="showHostForm = false">取消</button>
        </div>
        <div class="form-body">
          <label class="form-row"><span>地址</span>
            <input v-model="hostForm.host" class="input" placeholder="IP 或域名" />
          </label>
          <label class="form-row"><span>端口</span>
            <input v-model="hostForm.port" class="input" placeholder="22" />
          </label>
          <label class="form-row"><span>账号</span>
            <input v-model="hostForm.username" class="input" placeholder="root" />
          </label>
          <label class="form-row"><span>认证</span>
            <select v-model="hostForm.authType" class="input">
              <option :value="0">密码</option>
              <option :value="1">私钥</option>
            </select>
          </label>
          <label v-if="hostForm.authType === 0" class="form-row"><span>密码</span>
            <input v-model="hostForm.password" type="password" class="input" placeholder="SSH 密码" />
          </label>
          <template v-if="hostForm.authType === 1">
            <label class="form-row column"><span>私钥内容</span>
              <textarea v-model="hostForm.pkey" rows="5" class="input" placeholder="粘贴 PRIVATE KEY"></textarea>
            </label>
            <label class="form-row"><span>私钥密码</span>
              <input v-model="hostForm.passphrase" type="password" class="input" placeholder="可选" />
            </label>
          </template>
          <label class="form-row"><span>备注</span>
            <input v-model="hostForm.ps" class="input" placeholder="显示名，默认取地址" />
          </label>
        </div>
        <div class="form-actions">
          <button class="term-btn primary" @click="saveHost">保存</button>
          <button class="term-btn" @click="showHostForm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- ===== 添加/编辑常用命令 ===== -->
    <div v-if="showCmdForm" class="term-mask" @click.self="showCmdForm = false">
      <div class="term-form">
        <div class="form-head">
          <span>{{ cmdFormTitle }}</span>
          <button class="term-btn" @click="showCmdForm = false">取消</button>
        </div>
        <div class="form-body">
          <label class="form-row"><span>命令名称</span>
            <input v-model="cmdForm.title" class="input" placeholder="必填" />
          </label>
          <label class="form-row column"><span>命令内容</span>
            <textarea v-model="cmdForm.shell" rows="5" class="input" placeholder="必填"></textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="term-btn primary" @click="saveCmd">保存</button>
          <button class="term-btn" @click="showCmdForm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- ===== 会话标签右键菜单 ===== -->
    <div v-if="tabMenu.show" class="term-menu"
         :style="{ left: tabMenu.x + 'px', top: tabMenu.y + 'px' }" @click.stop>
      <button class="menu-item" @click="tabAct('copy')">复制会话（新标签）</button>
      <button class="menu-item" @click="tabAct('close')">关闭当前</button>
      <button class="menu-item" @click="tabAct('right')">关闭右侧</button>
      <button class="menu-item" @click="tabAct('others')">关闭其他</button>
    </div>

    <!-- ===== toast ===== -->
    <transition name="term-fade">
      <div v-if="toastMsg" class="term-toast">{{ toastMsg }}</div>
    </transition>
  </div>
</template>

<style scoped>
/* =========================================================================
   终端(重做版式): 三段式 —— 会话栏 / 屏幕+工具栏 / 状态栏。
   全文字化(无小图标), 卡片化圆角, 与文件管理同一套设计语言。
   ========================================================================= */
.term-page {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--bg); color: var(--text);
  font-size: 13px; overflow: hidden; min-height: 0;
}
.term-page.fullscreen { background: #000; }

/* ---------- 会话栏 ---------- */
.term-tabs {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.term-tablist { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; overflow-x: auto; }
.term-tab {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--surface-2); color: var(--text-muted); cursor: pointer;
  white-space: nowrap; transition: var(--transition); font-size: 12.5px;
}
.term-tab:hover { background: var(--surface-3); color: var(--text); }
.term-tab.active {
  background: var(--accent-soft); color: var(--accent-hover);
  border-color: var(--accent); font-weight: 600;
}
.tab-label { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.tab-state { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.tab-state.st-success { color: var(--success); }
.tab-state.st-err { color: var(--danger); }
.tab-state.st-info { color: var(--text-faint); }
.tab-close {
  border: none; background: transparent; color: var(--text-faint);
  font-size: 11px; padding: 0 4px; border-radius: var(--radius-sm); cursor: pointer;
}
.tab-close:hover { background: var(--danger-soft); color: var(--danger); }
.term-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* 文字按钮(通用) */
.term-btn {
  height: 28px; padding: 0 12px; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--surface-2);
  color: var(--text-muted); font-size: 12.5px; cursor: pointer;
  transition: var(--transition); white-space: nowrap;
}
.term-btn:hover { background: var(--surface-3); color: var(--text); border-color: var(--border-strong); }
.term-btn.on { background: var(--accent-soft); color: var(--accent-hover); border-color: var(--accent); }
.term-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.term-btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); color: #fff; }
.term-btn.tiny { height: 24px; padding: 0 8px; font-size: 11.5px; }

/* ---------- 主体: 屏幕 + 工具栏 ---------- */
.term-main { flex: 1; min-height: 0; display: flex; }
.term-screen {
  position: relative; flex: 1; min-width: 0; min-height: 0;
  background: #000; overflow: hidden;
}
.term-slot { position: absolute; inset: 0; }
.term-overlay {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  padding: 14px 18px; border-radius: var(--radius-md);
  background: rgba(20, 22, 26, .92); color: #e6edf3;
  border: 1px solid #30363d; font-size: 13px;
  display: flex; align-items: center; gap: 12px; z-index: 5;
}
.term-overlay.err { border-color: var(--danger); color: #ffd7d5; }
.term-overlay .term-btn { background: #21262d; border-color: #30363d; color: #e6edf3; }

/* ---------- 右侧工具栏 ---------- */
.term-side {
  width: 300px; flex-shrink: 0; display: flex; flex-direction: column;
  background: var(--surface); border-left: 1px solid var(--border);
  overflow: hidden; min-height: 0;
}
.side-tabs {
  display: flex; align-items: center; gap: 4px;
  padding: 8px; border-bottom: 1px solid var(--border);
}
.side-tab {
  flex: 1; height: 28px; border: 1px solid transparent; border-radius: var(--radius);
  background: transparent; color: var(--text-muted); font-size: 12.5px; cursor: pointer;
  transition: var(--transition);
}
.side-tab:hover { background: var(--surface-2); color: var(--text); }
.side-tab.on { background: var(--accent-soft); color: var(--accent-hover); border-color: var(--accent); font-weight: 600; }
.side-collapse { height: 28px; padding: 0 10px; font-size: 12px; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--text-muted); border-radius: var(--radius); cursor: pointer; }
.side-collapse:hover { background: var(--surface-3); color: var(--text); }
.side-block { display: flex; flex-direction: column; min-height: 0; flex: 1; padding: 10px; gap: 8px; }
.side-head {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; font-weight: 700; letter-spacing: .05em; color: var(--text-muted);
}
.side-quick .input { font-family: var(--font-mono); font-size: 12px; }
.side-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; min-height: 0; }
.side-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; margin-bottom: 6px;
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--surface-2); cursor: pointer; transition: var(--transition);
}
.side-item:hover { border-color: var(--accent); background: var(--surface-3); }
.side-main { flex: 1; min-width: 0; }
.side-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-sub { font-size: 11.5px; color: var(--text-faint); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-sub.ellip { white-space: nowrap; }
.side-ops { display: flex; gap: 4px; opacity: .65; transition: opacity var(--transition); }
.side-item:hover .side-ops { opacity: 1; }
.side-op {
  border: 1px solid var(--border); background: var(--surface);
  color: var(--text-muted); font-size: 11px; padding: 2px 7px;
  border-radius: var(--radius-sm); cursor: pointer;
}
.side-op:hover { border-color: var(--accent); color: var(--accent-hover); }
.side-op.danger:hover { border-color: var(--danger); color: var(--danger); }
.side-empty { padding: 18px 8px; text-align: center; color: var(--text-faint); font-size: 12.5px; }
.side-tip { font-size: 11px; color: var(--text-faint); line-height: 1.6; }

/* ---------- 状态栏 ---------- */
.term-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 7px 12px; background: var(--surface);
  border-top: 1px solid var(--border); font-size: 12px;
}
.bar-item { color: var(--text-muted); font-family: var(--font-mono); }
.bar-grow { flex: 1; }
.bar-err { color: var(--danger); }
.bar-dim { color: var(--text-faint); }

/* ---------- 弹窗表单 ---------- */
.term-mask {
  position: fixed; inset: 0; z-index: 1200;
  background: rgba(0, 0, 0, .5); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
}
.term-form {
  width: 460px; max-width: 92vw; max-height: 86vh;
  display: flex; flex-direction: column;
  background: var(--surface-2); border: 1px solid var(--border-strong);
  border-radius: var(--radius-md); box-shadow: var(--shadow); overflow: hidden;
}
.form-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700;
}
.form-body { padding: 14px 16px; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
.form-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-muted); }
.form-row > span { width: 76px; flex-shrink: 0; text-align: right; }
.form-row .input, .form-row textarea { flex: 1; min-width: 0; font-size: 12.5px; }
.form-row.column { flex-direction: column; align-items: stretch; }
.form-row.column > span { width: auto; text-align: left; }
.form-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 16px; border-top: 1px solid var(--border);
}

/* ---------- 右键菜单 ---------- */
.term-menu {
  position: fixed; z-index: 1500; min-width: 170px; padding: 4px;
  background: var(--surface-2); border: 1px solid var(--border-strong);
  border-radius: var(--radius-md); box-shadow: var(--shadow);
}
.menu-item {
  display: block; width: 100%; text-align: left; padding: 7px 10px;
  border: none; background: transparent; color: var(--text);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 12.5px;
  transition: var(--transition);
}
.menu-item:hover { background: var(--surface-3); }

/* ---------- toast ---------- */
.term-toast {
  position: fixed; top: 16px; right: 16px; z-index: 2000;
  padding: 10px 16px; font-size: 13px;
  background: var(--surface-3); border: 1px solid var(--border-strong);
  border-left: 3px solid var(--success); color: var(--text);
  border-radius: var(--radius-md); box-shadow: var(--shadow);
}
.term-fade-enter-active, .term-fade-leave-active { transition: opacity .25s, transform .25s; }
.term-fade-enter-from, .term-fade-leave-to { opacity: 0; transform: translateY(-8px); }

/* ---------- 响应式 ---------- */
@media (max-width: 900px) {
  .term-side { display: none; }
  .tab-label { max-width: 110px; }
}
</style>
