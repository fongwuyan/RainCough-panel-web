<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { resolveColor } from '../../terminal/vt100'

const props = defineProps({
  term: { type: Object, required: true },
  fontSize: { type: Number, default: 14 },
})
const emit = defineEmits(['input', 'resize', 'title', 'bell', 'copy', 'paste', 'font'])

const wrapRef = ref(null)
const domRef = ref(null)
const cursorRef = ref(null)
const scrollbarRef = ref(null)
const thumbRef = ref(null)

let fontFamily = '"Cascadia Mono", Consolas, "Courier New", monospace'
let cellW = 9
let cellH = 20
let cols = 0
let rows = 0
let rowEls = []
let lastHtml = []
let cursorOn = true
let cursorTimer = null
let wheelAccum = null
let dragState = null
let ro = null

function measure() {
  const dom = domRef.value
  const wrap = wrapRef.value
  if (!dom || !wrap) return
  const w = wrap.clientWidth
  const h = wrap.clientHeight
  if (w <= 0 || h <= 0) return

  // 用隐藏等宽节点实测字宽（等宽字体下 ch 宽度）
  let probe = dom.querySelector('.trow-probe')
  if (!probe) {
    probe = document.createElement('span')
    probe.className = 'trow-probe'
    dom.appendChild(probe)
  }
  probe.style.fontSize = props.fontSize + 'px'
  probe.style.fontFamily = fontFamily
  probe.textContent = 'W'
  cellW = Math.max(1, probe.getBoundingClientRect().width)
  cellH = Math.max(1, Math.round(props.fontSize * 1.4))

  const newCols = Math.max(2, Math.floor((w - 12) / cellW))
  const newRows = Math.max(1, Math.floor(h / cellH))
  if (newCols !== cols || newRows !== rows) {
    cols = newCols
    rows = newRows
    rebuildRows()
    emit('resize', rows, cols)
  }
  renderAll()
}

function rebuildRows() {
  const dom = domRef.value
  if (!dom) return
  const frag = document.createDocumentFragment()
  rowEls = []
  lastHtml = []
  for (let y = 0; y < rows; y++) {
    const el = document.createElement('pre')
    el.className = 'trow'
    el.style.height = cellH + 'px'
    el.style.lineHeight = cellH + 'px'
    el.style.fontSize = props.fontSize + 'px'
    frag.appendChild(el)
    rowEls.push(el)
    lastHtml.push(null)
  }
  dom.innerHTML = ''
  dom.appendChild(frag)
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function styleKey(c) {
  return c.fg + ',' + c.bg + ',' + (c.bold ? 1 : 0) + (c.dim ? 1 : 0) + (c.ital ? 1 : 0) +
    (c.ul ? 1 : 0) + (c.rev ? 1 : 0) + (c.cross ? 1 : 0) + (c.blink ? 1 : 0) + (c.hidden ? 1 : 0)
}

function styleAttrs(c) {
  const fg = c.rev ? c.bg : c.fg
  const bg = c.rev ? c.fg : c.bg
  let s = 'color:' + resolveColor(fg) + ';background:' + resolveColor(bg) + ';'
  if (c.bold) s += 'font-weight:bold;'
  if (c.dim) s += 'opacity:.6;'
  if (c.ital) s += 'font-style:italic;'
  const deco = []
  if (c.ul) deco.push('underline')
  if (c.cross) deco.push('line-through')
  if (deco.length) s += 'text-decoration:' + deco.join(' ') + ';'
  if (c.blink) s += 'animation:term-blink 1s step-start infinite;'
  if (c.hidden) s += 'opacity:0;'
  return s
}

function buildRowHtml(row) {
  let html = ''
  let i = 0
  const n = row.length
  while (i < n) {
    const c = row[i]
    if (c.skip) { i++; continue }
    const base = styleKey(c)
    let j = i
    let text = ''
    while (j < n) {
      const c2 = row[j]
      if (c2.skip) { j++; continue }
      if (styleKey(c2) !== base) break
      text += c2.hidden ? ' ' : esc(c2.ch)
      j++
    }
    html += '<span style="' + styleAttrs(c) + '">' + text + '</span>'
    i = j
  }
  return html
}

function renderAll() {
  if (typeof props.term.getGrid !== 'function') return
  const info = props.term.getGrid()
  const grid = info.grid
  for (let y = 0; y < rows; y++) {
    const row = grid[y]
    const el = rowEls[y]
    if (!el) continue
    const h = row ? buildRowHtml(row) : ''
    if (h !== lastHtml[y]) {
      el.innerHTML = h
      lastHtml[y] = h
    }
  }
  updateCursor(info)
  refreshScrollbar()
}

function updateCursor(info) {
  const el = cursorRef.value
  if (!el) return
  const off = typeof props.term.viewOffset === 'number' ? props.term.viewOffset : 0
  const show = cursorOn && info.cursorVisible && off === 0 && info.cur && info.cur.y < rows
  if (!show) { el.style.display = 'none'; return }
  el.style.display = 'block'
  el.style.left = (info.cur.x * cellW) + 'px'
  el.style.top = (info.cur.y * cellH) + 'px'
  el.style.width = cellW + 'px'
  el.style.height = cellH + 'px'
}

function refreshScrollbar() {
  const sb = scrollbarRef.value
  const tk = thumbRef.value
  if (!sb || !tk) return
  sb.style.display = 'block'
  const max = (props.term && typeof props.term.maxScroll === 'function' && props.term.maxScroll()) || 0
  if (max <= 0) { tk.style.display = 'none'; return }
  tk.style.display = 'block'
  const trackH = sb.clientHeight || rows * cellH
  const thumbRatio = Math.min(1, rows / (max + rows))
  const thumbH = Math.max(20, trackH * thumbRatio)
  tk.style.height = thumbH + 'px'
  const posRatio = (max - props.term.viewOffset) / max
  const maxTop = trackH - thumbH
  tk.style.top = (maxTop * posRatio) + 'px'
}

function schedule() { renderAll() }

function forceDraw() { renderAll() }

// ---- 键盘 ----
function onKeyDown(e) {
  const key = e.key
  const ctrl = e.ctrlKey || e.metaKey
  if (ctrl && e.shiftKey && e.code === 'KeyC') { emit('copy'); e.preventDefault(); return }
  if (ctrl && e.shiftKey && e.code === 'KeyV') { emit('paste'); e.preventDefault(); return }
  if (ctrl && (e.code === 'Equal' || e.code === 'NumpadAdd')) { emit('font', 1); e.preventDefault(); return }
  if (ctrl && (e.code === 'Minus' || e.code === 'NumpadSubtract')) { emit('font', -1); e.preventDefault(); return }
  if (e.isComposing || e.key === 'Process' || e.key === 'Unidentified') return

  const CONTROLS = {
    Enter: '\r', Backspace: '\x7f', Tab: '\t', Escape: '\x1b',
    Insert: '\x1b[2~', Delete: '\x1b[3~', Home: '\x1b[H', End: '\x1b[F',
    PageUp: '\x1b[5~', PageDown: '\x1b[6~',
    F1: '\x1bOP', F2: '\x1bOQ', F3: '\x1bOR', F4: '\x1bOS',
    F5: '\x1b[15~', F6: '\x1b[17~', F7: '\x1b[18~', F8: '\x1b[19~',
    F9: '\x1b[20~', F10: '\x1b[21~', F11: '\x1b[23~', F12: '\x1b[24~',
  }
  // Ctrl+F1..F12 交给浏览器（如 Ctrl+F5 硬刷新），终端不拦截
  if (ctrl && /^F\d{1,2}$/.test(key)) return
  const mapped = CONTROLS[key]
  if (mapped) {
    e.preventDefault()
    emit('input', mapped)
    return
  }
  if (key && /^Arrow/.test(key)) {
    const L = key.slice(5)
    let m = ''
    if (ctrl) m = '1;5'
    else if (e.altKey) m = '1;3'
    else if (e.shiftKey) m = '1;2'
    e.preventDefault()
    emit('input', '\x1b[' + (m ? m + L : L))
    return
  }
  if (ctrl && key && /^[a-zA-Z]$/.test(key)) {
    e.preventDefault()
    emit('input', String.fromCharCode(key.toLowerCase().charCodeAt(0) - 96))
    return
  }
  if (e.altKey && !ctrl && key && key.length === 1) {
    e.preventDefault()
    emit('input', '\x1b' + key)
    return
  }
  if (key.length === 1 && !ctrl && !e.altKey) {
    e.preventDefault()
    emit('input', key)
    return
  }
}

function onBeforeInput(e) {
  if (e.inputType === 'insertCompositionText') return
  if (e.inputType === 'insertText' || e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
    if (e.data) { e.preventDefault(); emit('input', e.data) }
  }
}

function onWheel(e) {
  e.preventDefault()
  const max = props.term.maxScroll()
  if (max <= 0) { props.term.setViewOffset(0); refreshScrollbar(); return }
  let delta = 0
  if (e.deltaMode === 1) delta = e.deltaY
  else if (e.deltaMode === 2) delta = e.deltaY * rows
  else delta = e.deltaY / 40
  wheelAccum = wheelAccum || { v: 0 }
  wheelAccum.v += delta
  const step = Math.trunc(wheelAccum.v)
  if (step !== 0) {
    wheelAccum.v -= step
    props.term.setViewOffset(props.term.viewOffset + step)
  }
  renderAll()
}

function onMouseDown(e) {
  // 不 preventDefault，允许原生文本框选
  wrapRef.value.focus()
}

// ---- 滚动条拖拽 ----
function beginDrag(e) {
  const tk = thumbRef.value
  if (!tk) return
  e.preventDefault()
  e.stopPropagation()
  dragState = {
    startY: e.clientY,
    startOffset: props.term.viewOffset,
    trackH: (scrollbarRef.value && scrollbarRef.value.clientHeight) || rows * cellH,
    thumbH: tk.offsetHeight || 30,
  }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', endDrag)
  onDragMove(e)
}

function onDragMove(e) {
  if (!dragState) return
  const max = props.term.maxScroll()
  if (max <= 0) { refreshScrollbar(); return }
  const dy = e.clientY - dragState.startY
  const maxTop = Math.max(1, dragState.trackH - dragState.thumbH)
  const startRatio = (max - dragState.startOffset) / max
  const posRatio = Math.max(0, Math.min(1, startRatio + dy / maxTop))
  const offset = max - Math.round(posRatio * max)
  props.term.setViewOffset(offset)
  renderAll()
}

function endDrag() {
  dragState = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', endDrag)
}

function tickCursor() {
  cursorOn = !cursorOn
  renderAll()
}

watch(() => props.term.redrawFull, () => renderAll())
watch(() => props.term.cur, () => renderAll(), { deep: true })

onMounted(() => {
  const wrap = wrapRef.value
  if (!wrap) return
  wrap.addEventListener('wheel', onWheel, { passive: false })
  wrap.addEventListener('mousedown', onMouseDown)
  wrap.addEventListener('keydown', onKeyDown)
  wrap.addEventListener('beforeinput', onBeforeInput)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { measure() })
  }
  measure()
  ro = new ResizeObserver(() => { measure() })
  ro.observe(wrap)
  cursorTimer = setInterval(tickCursor, 530)
})

onUnmounted(() => {
  if (ro) { ro.disconnect(); ro = null }
  const wrap = wrapRef.value
  if (wrap) {
    wrap.removeEventListener('wheel', onWheel)
    wrap.removeEventListener('mousedown', onMouseDown)
    wrap.removeEventListener('keydown', onKeyDown)
    wrap.removeEventListener('beforeinput', onBeforeInput)
  }
  clearInterval(cursorTimer)
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', endDrag)
})

defineExpose({ measure, forceDraw })
</script>

<template>
  <div ref="wrapRef" class="term-wrap" tabindex="0">
    <div ref="domRef" class="term-dom"></div>
    <div ref="cursorRef" class="term-cursor"></div>
    <div ref="scrollbarRef" class="term-scrollbar">
      <div ref="thumbRef" class="term-scrollbar-thumb" @mousedown="beginDrag"></div>
    </div>
  </div>
</template>

<style scoped>
.term-wrap {
  position: absolute;
  inset: 0;
  outline: none;
  cursor: text;
}
.term-dom {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #000;
  padding: 0 12px 0 0;
  user-select: text;
}
.trow {
  margin: 0;
  padding: 0;
  white-space: pre;
  overflow: hidden;
  font-family: "Cascadia Mono", Consolas, "Courier New", monospace;
  color: #fff;
}
.trow-probe {
  position: absolute;
  visibility: hidden;
  white-space: pre;
  font-family: "Cascadia Mono", Consolas, "Courier New", monospace;
  font-size: inherit;
}
.term-cursor {
  position: absolute;
  background: rgba(255, 255, 255, 0.7);
  display: none;
  pointer-events: none;
}
.term-scrollbar {
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 100%;
  display: block;
  background: rgba(255, 255, 255, 0.04);
  z-index: 5;
}
.term-scrollbar-thumb {
  position: absolute;
  left: 0;
  width: 10px;
  border-radius: 0;
  background: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  display: none;
}
.term-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}
</style>

<style>
@keyframes term-blink {
  50% { opacity: 0; }
}
</style>
