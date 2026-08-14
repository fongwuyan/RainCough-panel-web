<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'
import { VT100Terminal } from '../../terminal/vt100'
import TerminalDom from './TerminalDom.vue'
import { copyText, readText } from '../../utils/clipboard'

/* ---------------- 状态 ---------------- */
const sessions = ref([])       // [{ term, ws, label, host, spec, status, connecting, closed }]
const activeIdx = ref(0)
const hosts = ref([])          // 服务器列表
const commands = ref([])       // 常用命令
const toolOpen = ref(false)    // 右侧工具面板
const toolTab = ref('host')
const fullScreen = ref(false)
const toastMsg = ref('')
const errMsg = ref('')
const fonts = ref(14)

/* 弹窗表单 */
const showHostForm = ref(false)
const hostForm = ref({ old_host: '', host: '', port: '22', username: 'root', password: '', pkey: '', passphrase: '', ps: '', authType: 0 })
const hostFormTitle = ref('添加主机信息')
const showCmdForm = ref(false)
const cmdForm = ref({ old_title: '', title: '', shell: '' })
const cmdFormTitle = ref('添加常用命令信息')

const reconnectDelays = {}
let sidCounter = 1
let toastTimer = null

/* ---------------- 提示 ---------------- */
function toast(msg, ok = true) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 2600)
}

/* ---------------- 会话管理 ---------------- */
function openSession(spec) {
  // spec: {target:'local'|'ssh', host, port, username, password, pkey, passphrase, label, id}
  if (!spec.id) spec = { ...spec, id: 's' + (sidCounter++) }
  const label = spec.label || (spec.target === 'local' ? '本地服务器' : spec.host || 'SSH 会话')
  const s = {
    term: new VT100Terminal({ cols: 80, rows: 24, scrollback: 5000 }),
    ws: null, closed: false, connecting: true, status: 'info',
    label, host: spec.host || '127.0.0.1', spec: { ...spec, label },
  }
  sessions.value.push(s)
  activeIdx.value = sessions.value.length - 1
  openSocket(s)
}

function wsUrl() {
  return api.tmWsUrl(24, 80)
}

function openSocket(s) {
  s.closed = false
  s.connecting = true
  s.status = 'info'
  closeSocket(s)
  wsUrl()
    .then((url) => {
      const ws = new WebSocket(url)
      s.ws = ws
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => {
        reconnectDelays[s.label] = undefined
        const init = {
          type: 'init',
          target: s.spec.target || 'local',
          rows: s.term.rows, cols: s.term.cols,
        }
        if (init.target === 'ssh') {
          init.host = s.spec.host || ''
          init.port = s.spec.port || '22'
          init.username = s.spec.username || ''
          init.password = s.spec.password || ''
          init.pkey = s.spec.pkey || ''
          init.passphrase = s.spec.passphrase || ''
        }
        sendMsg(s, init)
        // 状态图标：连接中(黄) -> 成功(绿) 短暂脉冲
        s.status = 'warning'
        setTimeout(() => { if (s.ws && s.ws.readyState === 1) s.status = 'success' }, 200)
        s.connecting = false
      }
      ws.onmessage = (ev) => {
        let text
        if (ev.data instanceof ArrayBuffer) {
          text = new TextDecoder('utf-8').decode(new Uint8Array(ev.data))
        } else {
          text = String(ev.data)
        }
        if (!text) return
        if (text[0] === '{') {
          try {
            const j = JSON.parse(text)
            if (j.type === 'exit') {
              s.closed = true
              s.status = 'warning'
              try { s.ws && s.ws.close() } catch (e) {}
              return
            }
          } catch (e) {}
        }
        if (s.term) { try { s.term.write(text) } catch (e) {} }
        if (s._canvas && typeof s._canvas.forceDraw === 'function') {
          try { s._canvas.forceDraw() } catch (e) {}
        }
      }
      ws.onclose = () => { if (!s.closed && !s._userClose) scheduleReconnect(s) }
      ws.onerror = () => { try { ws.close() } catch (e) {} }
    })
    .catch((e) => {
      errMsg.value = e.message
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
  if (s.ws) {
    s._userClose = false
    try { s.ws.onclose = null; s.ws.close(); s.ws = null } catch (e) {}
  }
}

function sendMsg(s, obj) {
  if (s.ws && s.ws.readyState === 1) {
    try { s.ws.send(JSON.stringify(obj)) } catch (e) {}
  }
}

function activate(i) {
  activeIdx.value = i
  nextTick(() => {
    const s = sessions.value[activeIdx.value]
    try { s._canvas && s._canvas.measure() } catch (e) {}
    try { s.term && s.term.focus() } catch (e) {}
  })
}

function closeSession(s) {
  s._userClose = true
  s.closed = true
  try { s.ws && s.ws.close() } catch (e) {}
  s.ws = null
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
    s._userClose = true; s.closed = true
    try { s.ws && s.ws.close() } catch (e) {}
    s.ws = null
  }
  sessions.value = sessions.value.slice(0, idx + 1)
  activeIdx.value = idx
}

function closeOthers(id) {
  const keep = sessions.value.filter((x) => x.spec.id === id)
  for (const s of sessions.value) {
    if (s.spec.id === id) continue
    s._userClose = true; s.closed = true
    try { s.ws && s.ws.close() } catch (e) {}
    s.ws = null
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

/* ---------------- 输入/粘贴 ---------------- */
function onInput(s, data) {
  if (!s || data == null) return
  sendMsg(s, { type: 'input', data })
}

function onResize(s, rows, cols) {
  if (s.term) s.term.resize(cols, rows)
  sendMsg(s, { type: 'resize', rows, cols })
}

function onFont(_, delta) {
  fonts.value = Math.min(32, Math.max(10, fonts.value + delta))
  for (const s of sessions.value) {
    if (s._canvas) { try { s._canvas.measure() } catch (e) {} }
  }
}

async function copyActive() {
  const s = sessions.value[activeIdx.value]
  if (!s || !s.term) return
  const info = s.term.getGrid()
  const lines = []
  for (let y = 0; y < info.grid.length; y++) lines.push(s.term.lineText(y))
  const text = lines.join('\n').trimEnd()
  if (!text) return
  await copyText(text)
}

async function pasteActive() {
  const s = sessions.value[activeIdx.value]
  if (!s) return
  const text = await readText()
  if (text) onInput(s, text)
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

/* ---------------- 服务器 / 常用命令 ---------------- */
async function loadHosts() {
  try { hosts.value = await api.tmHostsList() } catch (e) { errMsg.value = e.message }
}
async function loadCommands() {
  try { commands.value = await api.tmCommandsList() } catch (e) { errMsg.value = e.message }
}

function openHostForm(item) {
  hostForm.value = item
    ? { old_host: item.host, host: item.host, port: item.port, username: item.username, password: item.password || '', pkey: item.pkey || '', passphrase: item.passphrase || '', ps: item.ps || '', authType: item.pkey ? 1 : 0 }
    : { old_host: '', host: '', port: '22', username: 'root', password: '', pkey: '', passphrase: '', ps: '', authType: 0 }
  hostFormTitle.value = item ? `编辑服务器信息【${item.host}】` : '添加主机信息'
  showHostForm.value = true
}

async function saveHost() {
  const f = hostForm.value
  if (!f.host.trim()) { toast('服务器IP不能为空', false); return }
  const body = {
    host: f.host.trim(), port: f.port || '22', username: f.username.trim(),
    password: f.authType === 0 ? f.password : '',
    pkey: f.authType === 1 ? f.pkey : '',
    passphrase: f.authType === 1 ? f.passphrase : '',
    ps: f.ps.trim() || f.host.trim(),
  }
  try {
    if (f.old_host) {
      const r = await api.tmHostUpdate({ ...body, old_host: f.old_host })
      hosts.value = r.hosts || []
    } else {
      const r = await api.tmHostCreate(body)
      hosts.value = r.hosts || []
    }
    showHostForm.value = false
    if (!f.old_host) {
      // 添加成功即连接
      openSession({ target: 'ssh', ...body, label: body.ps })
    }
    toast('保存成功')
  } catch (e) { toast(e.message, false) }
}

async function deleteHost(host) {
  try {
    const r = await api.tmHostDelete(host)
    hosts.value = r.hosts || []
    toast('已删除')
  } catch (e) { toast(e.message, false) }
}

function connectHost(item) {
  openSession({ target: 'ssh', host: item.host, port: item.port, username: item.username, password: item.password || '', pkey: item.pkey || '', passphrase: item.passphrase || '', label: item.ps || item.host })
}

function openCmdForm(item) {
  cmdForm.value = item ? { old_title: item.title, title: item.title, shell: item.shell } : { old_title: '', title: '', shell: '' }
  cmdFormTitle.value = item ? `编辑常用命令信息【${item.title}】` : '添加常用命令信息'
  showCmdForm.value = true
}

async function saveCmd() {
  const f = cmdForm.value
  if (!f.title.trim()) { toast('命令名称不能为空', false); return }
  if (!f.shell.trim()) { toast('命令内容不能为空', false); return }
  try {
    let r
    if (f.old_title) r = await api.tmCommandUpdate({ old_title: f.old_title, title: f.title.trim(), shell: f.shell })
    else r = await api.tmCommandCreate({ title: f.title.trim(), shell: f.shell })
    commands.value = r.commands || []
    showCmdForm.value = false
    toast('保存成功')
  } catch (e) { toast(e.message, false) }
}

async function deleteCmd(title) {
  try {
    const r = await api.tmCommandDelete(title)
    commands.value = r.commands || []
    toast('已删除')
  } catch (e) { toast(e.message, false) }
}

async function copyCmd(shell) {
  await copyText(shell)
  toast('复制成功')
}

function runCmd(shell) {
  const s = sessions.value[activeIdx.value]
  if (s) onInput(s, shell)
}

/* ---------------- 快捷连接 ---------------- */
const quickVal = ref('')
function quickConnect() {
  const v = quickVal.value.trim()
  if (!v) return
  // 支持 root@host:port 或 host:port 或 host
  let user = 'root', host = v, port = '22', pw = ''
  if (host.indexOf('@') !== -1) {
    const sp = host.split('@'); user = sp[0]; host = sp[1]
    if (user.indexOf(':') !== -1) { const us = user.split(':'); user = us[0]; pw = us[1] }
  }
  if (host.indexOf(':') !== -1) {
    const hs = host.split(':'); host = hs[0]; port = hs[1]
  }
  if (!host) return
  openSession({ target: 'ssh', host, port, username: user, password: pw, pkey: '', passphrase: '', label: `${user}@${host}` })
  quickVal.value = ''
}

/* ---------------- 拖动排序 ---------------- */
let dragHost = null
function onHostDragStart(e, host) { dragHost = host; e.dataTransfer.effectAllowed = 'move' }
function onHostDrop(e, target) {
  e.preventDefault()
  if (!dragHost || dragHost === target) return
  const from = hosts.value.findIndex((h) => h.host === dragHost)
  const to = hosts.value.findIndex((h) => h.host === target)
  if (from < 0 || to < 0) return
  hosts.value.splice(to, 0, hosts.value.splice(from, 1)[0])
  const sortList = {}
  hosts.value.forEach((h, i) => (sortList[h.host] = i))
  api.tmHostSort(sortList).catch(() => {})
  dragHost = null
}
function onHostDragOver(e) { e.preventDefault() }

/* ---------------- 键盘: 阻止 F5 ---------------- */
function onDocKey(e) {
  if (e.keyCode === 116 || (e.metaKey && e.keyCode === 82)) {
    if (e.target && (e.target.tagName === 'CANVAS' || e.target.closest && e.target.closest('.term-page'))) {
      e.preventDefault(); e.returnValue = false
    }
  }
}

onMounted(() => {
  loadHosts()
  loadCommands()
  openSession({ target: 'local', label: '本地服务器' })
  document.addEventListener('keydown', onDocKey)
  document.addEventListener('fullscreenchange', onFsChange)
})

onUnmounted(() => {
  for (const s of sessions.value) { try { s.ws && s.ws.close() } catch (e) {} }
  document.removeEventListener('keydown', onDocKey)
  document.removeEventListener('fullscreenchange', onFsChange)
  for (const u of unregTermCtx) { try { u() } catch (e) {} }
  unregTermCtx = []
})
</script>

<template>
  <div class="term-page" :class="{ full_term_view: fullScreen }">
    <!-- 快捷连接栏 -->
    <div class="quick_links">
      <span class="ql-icon">🔒</span>
      <span class="ql-label">SSH://</span>
      <input
        v-model="quickVal"
        class="quick_links_input"
        type="text"
        placeholder="root@192.168.1.1:22，支持临时终端连接。"
        @keydown.enter="quickConnect"
      />
      <span class="ql-caret">▾</span>
    </div>

    <!-- 主体 -->
    <div class="term_box">
      <!-- 标签栏 -->
      <div class="term_item_tab">
        <div class="list">
          <span
            v-for="(s, i) in sessions"
            :key="s.spec.id"
            class="item"
            :class="[{ active: i === activeIdx, localhost_item: s.spec.target === 'local' }, 'sess-' + s.spec.id]"
            @click="activate(i)"
          >
            <i class="icon" :class="'icon-' + s.status"></i>
            <span class="content">{{ s.label }}</span>
            <span class="icon-trem-close" title="关闭会话" @click.stop="closeSession(s)">×</span>
          </span>
          <span class="addServer" title="添加服务器SSH信息" @click="openHostForm()">＋</span>
          <span class="tab_tootls" @click="toggleFullscreen">
            <i class="tt-icon" :class="fullScreen ? 'tt-min' : 'tt-max'"></i><span>全屏显示</span>
          </span>
        </div>
      </div>

      <!-- 终端内容 -->
      <div class="term_content_tab">
        <div
          v-for="(s, i) in sessions"
          :key="s.spec.id"
          class="term_item"
          :id="s.spec.id"
          :class="{ active: i === activeIdx }"
        >
          <TerminalDom
            v-if="i === activeIdx"
            :ref="(c) => { if (c) canvasMounted(s, c) }"
            :term="s.term || {}"
            @input="(d) => onInput(s, d)"
            @resize="(r, c) => onResize(s, r, c)"
            @font="(d) => onFont(s, d)"
            @copy="copyActive"
            @paste="pasteActive"
          />
        </div>
        <!-- 工具面板开关 -->
        <div
          class="term-tool-button"
          :class="toolOpen ? 'tool-hide' : 'tool-show'"
          @click="toolOpen = !toolOpen"
        >
          <i class="tt-chevron" :class="toolOpen ? 'tt-right' : 'tt-left'"></i>
        </div>
      </div>
    </div>

    <!-- 右侧工具面板 -->
    <div class="term_tootls" :class="{ open: toolOpen }">
      <div class="tab-nav">
        <span :class="{ on: toolTab === 'host' }" @click="toolTab = 'host'">服务器列表</span>
        <span :class="{ on: toolTab === 'shell' }" @click="toolTab = 'shell'">常用命令</span>
      </div>
      <div class="tab-con">
        <div v-show="toolTab === 'host'" class="tab-block">
          <div class="block-head">
            <button class="btn btn-success btn-sm" @click="openHostForm()">添加服务器</button>
          </div>
          <ul class="tootls_host_list">
            <li
              v-for="h in hosts"
              :key="h.host"
              :data-host="h.host"
              draggable="true"
              @dragstart="onHostDragStart($event, h.host)"
              @dragover="onHostDragOver"
              @drop="onHostDrop($event, h.host)"
              @dblclick="connectHost(h)"
              @click="connectHost(h)"
            >
              <i class="drag-handle">⠿</i>
              <span class="h-name">{{ h.ps === h.host ? h.ps : h.ps + '【' + h.host + '】' }}</span>
              <span class="tootls">
                <span class="glyph" title="编辑服务器信息" @click.stop="openHostForm(h)">✎</span>
                <span class="glyph" title="删除服务器信息" @click.stop="deleteHost(h.host)">🗑</span>
              </span>
            </li>
          </ul>
        </div>
        <div v-show="toolTab === 'shell'" class="tab-block">
          <div class="block-head">
            <button class="btn btn-success btn-sm" @click="openCmdForm()">添加命令</button>
          </div>
          <ul class="tootls_commonly_list">
            <li v-for="c in commands" :key="c.title" :data-title="c.title" @click="copyCmd(c.shell)" @dblclick="runCmd(c.shell)">
              <span class="cmd-name">{{ c.title }}</span>
              <span class="tootls">
                <span class="glyph" title="编辑常用命令信息" @click.stop="openCmdForm(c)">✎</span>
                <span class="glyph" title="删除常用命令信息" @click.stop="deleteCmd(c.title)">🗑</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 标签右键菜单（由全局统一右键菜单接管） -->

    <!-- 添加/编辑主机弹窗 -->
    <div v-if="showHostForm" class="term-modal-mask" @click.self="showHostForm = false">
      <div class="term-modal">
        <div class="tm-title">{{ hostFormTitle }}</div>
        <div class="bt-form bt-form-2x pd20">
          <div class="line">
            <span class="tname">服务器IP</span>
            <div class="info-r">
              <input v-model="hostForm.host" class="bt-input-text" style="width:240px" placeholder="输入服务器IP" />
              <input v-model="hostForm.port" class="bt-input-text" style="width:60px" placeholder="端口" />
            </div>
          </div>
          <div class="line">
            <span class="tname">SSH账号</span>
            <div class="info-r"><input v-model="hostForm.username" class="bt-input-text" style="width:305px" placeholder="输入SSH账号" /></div>
          </div>
          <div class="line">
            <span class="tname">验证方式</span>
            <div class="info-r btn-group">
              <button type="button" class="btn btn-sm" :class="hostForm.authType === 0 ? 'btn-success' : 'btn-default'" @click="hostForm.authType = 0">密码验证</button>
              <button type="button" class="btn btn-sm" :class="hostForm.authType === 1 ? 'btn-success' : 'btn-default'" @click="hostForm.authType = 1">私钥验证</button>
            </div>
          </div>
          <div v-if="hostForm.authType === 0" class="line">
            <span class="tname">密码</span>
            <div class="info-r"><input v-model="hostForm.password" class="bt-input-text" style="width:305px" placeholder="请输入SSH密码" /></div>
          </div>
          <div v-if="hostForm.authType === 1" class="line">
            <span class="tname">私钥</span>
            <div class="info-r"><textarea v-model="hostForm.pkey" rows="4" class="bt-input-text" style="width:305px;height:80px;line-height:18px;padding-top:10px" placeholder="请输入SSH私钥"></textarea></div>
          </div>
          <div v-if="hostForm.authType === 1" class="line">
            <span class="tname">私钥密码</span>
            <div class="info-r"><input v-model="hostForm.passphrase" class="bt-input-text" style="width:305px" placeholder="请输入私钥密码" /></div>
          </div>
          <div class="line">
            <span class="tname">备注</span>
            <div class="info-r"><input v-model="hostForm.ps" class="bt-input-text" style="width:305px" placeholder="请输入备注,可为空" /></div>
          </div>
        </div>
        <div class="tm-actions">
          <button class="btn btn-success btn-sm" @click="saveHost">提交</button>
          <button class="btn btn-default btn-sm" @click="showHostForm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑常用命令弹窗 -->
    <div v-if="showCmdForm" class="term-modal-mask" @click.self="showCmdForm = false">
      <div class="term-modal">
        <div class="tm-title">{{ cmdFormTitle }}</div>
        <div class="bt-form bt-form-2x pd20">
          <div class="line">
            <span class="tname">命令名称</span>
            <div class="info-r"><input v-model="cmdForm.title" class="bt-input-text" style="width:305px" placeholder="请输入常用命令描述，必填项" /></div>
          </div>
          <div class="line">
            <span class="tname">命令内容</span>
            <div class="info-r"><textarea v-model="cmdForm.shell" rows="4" class="bt-input-text" style="width:305px;height:150px;line-height:18px;padding-top:10px" placeholder="请输入常用命令信息，必填项"></textarea></div>
          </div>
        </div>
        <div class="tm-actions">
          <button class="btn btn-success btn-sm" @click="saveCmd">提交</button>
          <button class="btn btn-default btn-sm" @click="showCmdForm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 提示 -->
    <transition name="fade">
      <div v-if="toastMsg" class="bt-toast">{{ toastMsg }}</div>
    </transition>
    <span v-if="errMsg" class="term-err">⚠ {{ errMsg }}</span>
  </div>
</template>

<style scoped>
/* ===== 宝塔经典浅色外壳（强制，不随应用主题） ===== */
.term-page {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: #f5f6f7; color: #333;
  font-size: 13px; overflow: hidden; min-height: 0;
  font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
}
.term-page.full_term_view {
  background: #fff;
}

/* 快捷连接栏 */
.quick_links {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: #fff; border-bottom: 1px solid #e3e5e8;
}
.ql-label { color: #555; font-weight: 600; letter-spacing: .5px; }
.quick_links_input {
  flex: 0 1 420px; max-width: 480px;
  border: 1px solid #cfd2d6; border-radius: 3px;
  padding: 5px 10px; font-size: 13px; outline: none;
}
.quick_links_input:focus { border-color: #66afe9; box-shadow: 0 0 3px rgba(102,175,233,.4); }
.ql-caret { color: #999; font-size: 11px; cursor: pointer; }

/* 主体布局 */
.term_box {
  position: relative; flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  margin-right: 0; transition: margin-right .25s ease;
}
.term_tootls.open ~ .term_box, .term_box.tool-open { margin-right: 300px; }

/* 标签栏 */
.term_item_tab { flex-shrink: 0; background: #fff; border-bottom: 1px solid #e3e5e8; }
.term_item_tab .list { display: flex; align-items: center; overflow-x: auto; padding: 6px 8px 0; }
.term_item_tab .item {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px 6px; margin-right: 4px;
  border: 1px solid #e3e5e8; border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: #f5f6f7; color: #666;
  cursor: pointer; white-space: nowrap; user-select: none;
  max-width: 220px;
}
.term_item_tab .item:hover { background: #fbfbfc; }
.term_item_tab .item.active { background: #fff; color: #333; font-weight: 600; border-color: #d0d4d8; }
.term_item_tab .item .content { overflow: hidden; text-overflow: ellipsis; }
.term_item_tab .item .icon {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.term_item_tab .item .icon-success { background: #2fbf71; }
.term_item_tab .item .icon-warning { background: #f0ad4e; }
.term_item_tab .item .icon-info { background: #b9bec4; }
.term_item_tab .item .icon-trem-close {
  color: #999; font-size: 14px; line-height: 1; padding: 0 2px; border-radius: 3px;
}
.term_item_tab .item .icon-trem-close:hover { color: #fff; background: #e2544b; }
.term_item_tab .addServer {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; margin: 0 4px;
  border: 1px solid #e3e5e8; border-radius: 4px;
  background: #fff; color: #2d8f5e; font-size: 16px; cursor: pointer;
}
.term_item_tab .addServer:hover { border-color: #2d8f5e; color: #fff; background: #2d8f5e; }
.term_item_tab .tab_tootls {
  display: inline-flex; align-items: center; gap: 4px;
  margin-left: auto; padding: 0 4px; color: #666; cursor: pointer;
  font-size: 12px; user-select: none;
}
.term_item_tab .tab_tootls:hover { color: #2d8f5e; }
.tt-icon { display: inline-block; width: 13px; height: 13px; border: 1.5px solid currentColor; border-radius: 2px; position: relative; }
.tt-max::after { content: ''; position: absolute; top: -3px; left: -3px; width: 8px; height: 8px; border: 1.5px solid #fff; }
.tt-min::after { content: ''; position: absolute; top: 1px; left: 1px; right: 1px; bottom: 1px; border: 1.5px solid currentColor; border-radius: 1px; }

/* 终端内容区 */
.term_content_tab { position: relative; flex: 1; min-height: 0; background: #000; }
.term_content_tab .term_item {
  position: absolute; inset: 0; display: none; background: #000;
}
.term_content_tab .term_item.active { display: block; }

.term-tool-button {
  position: absolute; top: 50%; right: 0; transform: translateY(-50%);
  width: 18px; height: 56px;
  background: #eceef1; border: 1px solid #d0d4d8; border-right: none;
  border-radius: 4px 0 0 4px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 6;
}
.term-tool-button:hover { background: #e0e3e7; }
.tt-chevron { width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; }
.tt-left { border-right: 7px solid #666; }
.tt-right { border-left: 7px solid #666; }

/* 右侧工具面板 */
.term_tootls {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: 300px; background: #fff;
  border-left: 1px solid #e3e5e8;
  transform: translateX(100%); transition: transform .25s ease;
  z-index: 5;
}
.term_tootls.open { transform: translateX(0); }
.term_tootls .tab-nav { display: flex; border-bottom: 1px solid #e3e5e8; background: #fbfbfc; }
.term_tootls .tab-nav span {
  flex: 1; text-align: center; padding: 10px 0; font-size: 13px; color: #666; cursor: pointer;
  border-bottom: 2px solid transparent;
}
.term_tootls .tab-nav span.on { color: #2d8f5e; border-bottom-color: #2d8f5e; font-weight: 600; }
.term_tootls .tab-con { position: absolute; top: 41px; left: 0; right: 0; bottom: 0; overflow-y: auto; }
.term_tootls .block-head { padding: 10px 12px; }
.term_tootls ul { list-style: none; margin: 0; padding: 0; }
.term_tootls li {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-top: 1px solid #f0f1f3; cursor: pointer;
}
.term_tootls li:hover { background: #f5f9f7; }
.term_tootls li .drag-handle { color: #bbb; cursor: grab; }
.term_tootls li .h-name, .term_tootls li .cmd-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #444; }
.term_tootls li .tootls { display: flex; gap: 8px; color: #999; }
.term_tootls li .tootls .glyph { cursor: pointer; }
.term_tootls li .tootls .glyph:hover { color: #2d8f5e; }

/* 通用按钮 */
.btn { display: inline-block; border: 1px solid transparent; border-radius: 3px; padding: 5px 12px; font-size: 13px; cursor: pointer; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-success { background: #2d8f5e; border-color: #2d8f5e; color: #fff; }
.btn-success:hover { background: #26794f; }
.btn-default { background: #fff; border-color: #d0d4d8; color: #555; }
.btn-default:hover { background: #f0f1f3; }

/* 弹窗 */
.term-modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 9990;
  display: flex; align-items: center; justify-content: center;
}
.term-modal {
  width: 560px; background: #fff; border-radius: 4px; box-shadow: 0 8px 30px rgba(0,0,0,.2);
  overflow: hidden;
}
.term-modal .tm-title { padding: 14px 16px; font-size: 15px; font-weight: 600; border-bottom: 1px solid #eee; }
.bt-form .line { display: flex; align-items: center; padding: 8px 0; }
.bt-form .tname { width: 90px; color: #666; text-align: right; padding-right: 10px; flex-shrink: 0; }
.bt-input-text { border: 1px solid #cfd2d6; border-radius: 3px; padding: 5px 8px; font-size: 13px; outline: none; }
.bt-input-text:focus { border-color: #66afe9; box-shadow: 0 0 3px rgba(102,175,233,.4); }
.tm-actions { padding: 12px 16px; border-top: 1px solid #eee; text-align: right; }

/* 提示 / 错误 */
.bt-toast {
  position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
  background: #fff; border: 1px solid #e3e5e8; border-radius: 4px;
  padding: 9px 20px; font-size: 13px; color: #333; z-index: 10000;
  box-shadow: 0 4px 14px rgba(0,0,0,.12);
}
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.term-err { position: fixed; top: 10px; right: 16px; z-index: 9999; color: #d9534f; font-size: 12px; }
</style>
