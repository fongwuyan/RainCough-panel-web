import { ref, computed, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { api } from '../../api'
import { useUi } from '../../stores/ui'

const LIGHT = {
  background: '#ffffff',
  foreground: '#1b1f27',
  cursor: '#6d5cff',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(109,92,255,0.22)',
  black: '#1b1f27', red: '#d1242b', green: '#1f7a3d', yellow: '#9a6b00',
  blue: '#2b6cb0', magenta: '#805ad5', cyan: '#2c7a7b', white: '#5c6675',
  brightBlack: '#8a93a3', brightRed: '#e53e3e', brightGreen: '#2f855a',
  brightYellow: '#b7791f', brightBlue: '#3182ce', brightMagenta: '#9f7aea',
  brightCyan: '#319795', brightWhite: '#1b1f27',
}

const DARK = {
  background: '#12161d',
  foreground: '#e6e8ee',
  cursor: '#8274ff',
  cursorAccent: '#12161d',
  selectionBackground: 'rgba(109,92,255,0.3)',
  black: '#1b1f27', red: '#f85149', green: '#3fb950', yellow: '#d29922',
  blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#c9d1d9',
  brightBlack: '#6b7484', brightRed: '#ff7b72', brightGreen: '#56d364',
  brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
}

// 终端会话管理: xterm 实例、SSE 输出流、输入/尺寸同步、主机与命令库。
export function useTerminal() {
  const { theme } = useUi()

  const sessions = ref([])
  const activeId = ref('')
  const hosts = ref([])
  const commands = ref([])
  const toast = ref('')
  let toastTimer = null
  let seq = 0

  const runtimes = new Map() // id -> { term, fit, es, el, dec, opened }

  const active = computed(() => sessions.value.find((s) => s.id === activeId.value) || null)
  const activeState = computed(() => {
    const s = active.value
    if (!s) return '—'
    if (s.state === 'open') return '已连接'
    if (s.state === 'connecting') return '连接中…'
    if (s.state === 'closed') return '已断开'
    return '错误'
  })

  function flash(msg) {
    toast.value = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = ''), 2600)
  }

  function themeOpts() {
    return theme.value === 'dark' ? DARK : LIGHT
  }

  // ---- 会话 ----

  function newSession(title) {
    const id = 't' + ++seq
    const s = {
      id,
      title: title || '本地 ' + seq,
      sid: '',
      state: 'connecting',
      err: '',
      rows: 24,
      cols: 80,
    }
    sessions.value.push(s)
    activeId.value = id
    return s
  }

  // attach 在 DOM 就绪后调用: 建 xterm 实例并接管输入
  function attach(id, el) {
    const s = sessions.value.find((x) => x.id === id)
    if (!s || !el) return
    let rt = runtimes.get(id)
    if (rt && rt.el === el) return
    if (rt) return // 已绑定到别的容器, 忽略重复 ref 回调

    const term = new Terminal({
      fontFamily: 'Cascadia Mono, SF Mono, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
      theme: themeOpts(),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(el)
    try {
      fit.fit()
    } catch (e) { /* 容器尚未有尺寸 */ }

    rt = { term, fit, el, es: null, dec: new TextDecoder('utf-8'), opened: false }
    runtimes.set(id, rt)

    s.rows = term.rows
    s.cols = term.cols

    term.onData((data) => send(id, data))
    term.onResize(({ rows, cols }) => {
      const cur = sessions.value.find((x) => x.id === id)
      if (cur) {
        cur.rows = rows
        cur.cols = cols
        if (cur.sid) api.tmResize(cur.sid, rows, cols).catch(() => {})
      }
    })
    term.focus()
  }

  async function connect(id) {
    const s = sessions.value.find((x) => x.id === id)
    const rt = runtimes.get(id)
    if (!s || !rt) return
    s.state = 'connecting'
    s.err = ''
    try {
      const d = await api.tmOpen(rt.term.rows, rt.term.cols)
      s.sid = d.sid
      s.state = 'open'
      openStream(s, rt)
    } catch (e) {
      s.state = 'error'
      s.err = e.message || String(e)
    }
  }

  function openStream(s, rt) {
    if (rt.es) {
      try { rt.es.close() } catch (e) {}
    }
    const es = new EventSource('/api/terminal/stream?sid=' + encodeURIComponent(s.sid))
    rt.es = es
    rt.dec = new TextDecoder('utf-8')
    es.onmessage = (ev) => {
      try {
        const bytes = Uint8Array.from(atob(ev.data), (c) => c.charCodeAt(0))
        const text = rt.dec.decode(bytes, { stream: true })
        if (text) rt.term.write(text)
      } catch (e) { /* 忽略坏帧 */ }
    }
    es.addEventListener('closed', () => {
      const cur = sessions.value.find((x) => x.id === s.id)
      if (cur) cur.state = 'closed'
      try { es.close() } catch (e) {}
    })
    es.onerror = () => {
      // EventSource 会自动重连; 会话真没了由 closed 事件兜底
    }
  }

  function send(id, data) {
    const s = sessions.value.find((x) => x.id === id)
    if (!s || !s.sid || s.state !== 'open') return
    api.tmInput(s.sid, b64(data)).catch((e) => {
      const cur = sessions.value.find((x) => x.id === id)
      if (cur) {
        cur.state = 'closed'
        cur.err = e.message || String(e)
      }
    })
  }

  // 连上后稍等 shell 就绪再敲命令(否则字符会被丢弃)
  function sendLater(id, text, delay = 350) {
    setTimeout(() => send(id, text), delay)
  }

  async function reconnect(id) {
    const s = sessions.value.find((x) => x.id === id)
    const rt = runtimes.get(id)
    if (!s || !rt) return
    rt.term.reset()
    s.sid = ''
    await connect(id)
  }

  function closeSession(id) {
    const s = sessions.value.find((x) => x.id === id)
    const rt = runtimes.get(id)
    if (rt) {
      if (rt.es) {
        try { rt.es.close() } catch (e) {}
      }
      try { rt.term.dispose() } catch (e) {}
      runtimes.delete(id)
    }
    if (s && s.sid) api.tmClose(s.sid).catch(() => {})
    sessions.value = sessions.value.filter((x) => x.id !== id)
    if (activeId.value === id) {
      const last = sessions.value[sessions.value.length - 1]
      activeId.value = last ? last.id : ''
    }
  }

  function activate(id) {
    activeId.value = id
    nextTick(() => {
      const rt = runtimes.get(id)
      if (!rt) return
      try { rt.fit.fit() } catch (e) {}
      rt.term.focus()
    })
  }

  function fitActive() {
    const rt = runtimes.get(activeId.value)
    if (!rt) return
    try { rt.fit.fit() } catch (e) {}
  }

  function clearActive() {
    const rt = runtimes.get(activeId.value)
    if (rt) rt.term.clear()
  }

  async function copyActive() {
    const rt = runtimes.get(activeId.value)
    if (!rt) return
    const sel = rt.term.getSelection()
    if (!sel) return flash('没有选中内容')
    try {
      await navigator.clipboard.writeText(sel)
      flash('已复制')
    } catch (e) {
      flash('复制失败: ' + (e.message || e))
    }
  }

  async function pasteActive() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) send(activeId.value, text)
    } catch (e) {
      flash('无法读取剪贴板(需要 https 或 localhost)')
    }
  }

  function syncTheme() {
    for (const rt of runtimes.values()) {
      try { rt.term.options.theme = themeOpts() } catch (e) {}
    }
  }

  // ---- 主机 ----

  async function loadHosts() {
    try {
      const d = await api.tmHostsList()
      hosts.value = Array.isArray(d) ? d : d.hosts || []
    } catch (e) {
      flash('主机列表加载失败')
    }
  }

  async function saveHost(h) {
    if (h._new) await api.tmHostCreate(h)
    else await api.tmHostUpdate(h)
    await loadHosts()
  }

  async function deleteHost(name) {
    await api.tmHostDelete(name)
    await loadHosts()
  }

  // 连接主机 = 在当前(或新开)会话里敲 ssh 命令。后端只提供本地 pty,
  // 远程登录由本机的 ssh 客户端完成(密钥登录可直接用, 密码需在终端里输入)。
  function sshTo(h, inNewTab = true) {
    const user = h.username ? h.username + '@' : ''
    const port = h.port && Number(h.port) !== 22 ? ' -p ' + h.port : ''
    const cmd = 'ssh' + port + ' ' + user + h.host + '\n'
    let id = activeId.value
    if (inNewTab || !id) {
      const s = newSession((h.ps || h.host || 'ssh') + ' · ssh')
      id = s.id
      nextTick(() => {
        attach(id, document.getElementById('xterm-' + id))
        connect(id).then(() => sendLater(id, cmd))
      })
      return
    }
    sendLater(id, cmd, 120)
  }

  // ---- 命令库 ----

  async function loadCommands() {
    try {
      const d = await api.tmCommandsList()
      commands.value = Array.isArray(d) ? d : []
    } catch (e) {
      flash('命令库加载失败')
    }
  }

  async function saveCmd(c) {
    if (c._new) await api.tmCommandCreate({ title: c.title, shell: c.shell })
    else await api.tmCommandUpdate({ title: c.title, shell: c.shell })
    await loadCommands()
  }

  async function deleteCmd(title) {
    await api.tmCommandDelete(title)
    await loadCommands()
  }

  function runCmd(c) {
    if (!c || !c.shell) return
    send(activeId.value, c.shell.endsWith('\n') ? c.shell : c.shell + '\n')
  }

  return {
    sessions, activeId, active, activeState, hosts, commands, toast,
    newSession, attach, connect, reconnect, closeSession, activate, fitActive,
    clearActive, copyActive, pasteActive, syncTheme, send, sendLater,
    loadHosts, saveHost, deleteHost, sshTo,
    loadCommands, saveCmd, deleteCmd, runCmd, flash,
  }
}

// b64 把字符串按 UTF-8 编码成 base64(后端要求 base64 输入)。
function b64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
  }
  return btoa(bin)
}
