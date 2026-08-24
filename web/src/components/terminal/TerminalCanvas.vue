<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { resolveColor } from '../../terminal/vt100'

const props = defineProps({
  term: { type: Object, required: true },
})
const emit = defineEmits(['input', 'resize', 'title', 'bell'])

const canvasRef = ref(null)
const scrollbarRef = ref(null)
const thumbRef = ref(null)
let ctx = null
let dpr = 1
let cols = 0
let rows = 0
let cellW = 8 // device px per cell
let cellH = 16 // device px per cell
let fontFamily = '"Cascadia Mono", Consolas, "Courier New", monospace'
let fontSize = 14
let tmpCv = null
let tmpCtx = null
let cursorTimer = null
let cursorOn = true
let rafPending = false
let dirty = true
let dragState = null // { startY, startOffset, thumbH }
let ro = null

function measure() {
  const c = canvasRef.value
  if (!c) return
  const w = c.clientWidth
  const h = c.clientHeight
  dpr = window.devicePixelRatio || 1
  const bw = Math.max(1, Math.floor(w * dpr))
  const bh = Math.max(1, Math.floor(h * dpr))
  if (c.width !== bw) c.width = bw
  if (c.height !== bh) c.height = bh
  ctx = c.getContext('2d')
  // 使用设备像素工作空间：所有坐标/尺寸取整，保证 blit 与文本对齐无毛边
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.font = `${Math.round(fontSize * dpr)}px ${fontFamily}`
  const m = ctx.measureText('W')
  cellW = Math.max(1, Math.ceil(m.width))
  cellH = Math.max(1, Math.round(fontSize * 1.4 * dpr))

  const newCols = Math.max(2, Math.floor((w * dpr) / cellW))
  const newRows = Math.max(1, Math.floor((h * dpr) / cellH))
  if (newCols !== cols || newRows !== rows) {
    cols = newCols
    rows = newRows
    emit('resize', rows, cols)
  }
  dirty = true
}

let lastDraw = null // { rows, cols, off }

function drawRow(row, y) {
  let x = 0
  while (x < cols) {
    const cell = row[x]
    const fg = cell.rev ? cell.bg : cell.fg
    const bg = cell.rev ? cell.fg : cell.bg
    const fgColor = resolveColor(fg)
    const bgColor = resolveColor(bg)
    // 绘制背景（合并同背景 run）
    let runEnd = x
    while (runEnd < cols) {
      const c2 = row[runEnd]
      const c2bg = c2.rev ? c2.fg : c2.bg
      if (resolveColor(c2bg) !== bgColor) break
      runEnd++
    }
    ctx.fillStyle = bgColor
    ctx.fillRect(x * cellW, y * cellH, (runEnd - x) * cellW, cellH)
    // 绘制前景（合并同样式 run）
    ctx.fillStyle = fgColor
    if (cell.bold) ctx.font = `bold ${Math.round(fontSize * dpr)}px ${fontFamily}`
    else ctx.font = `${Math.round(fontSize * dpr)}px ${fontFamily}`
    let e = x
    while (e < runEnd) {
      const c2 = row[e]
      const same = c2.ch === cell.ch && c2.fg === cell.fg && c2.bold === cell.bold &&
        c2.dim === cell.dim && c2.ital === cell.ital && c2.ul === cell.ul &&
        c2.cross === cell.cross && c2.hidden === cell.hidden
      if (!same) break
      e++
    }
    let text = ''
    for (let i = x; i < e; i++) {
      const c = row[i]
      if (!c.skip) text += c.ch
    }
    if (text && !cell.hidden) {
      ctx.fillText(text, x * cellW, y * cellH)
    }
    // 下划线
    if (cell.ul && !cell.hidden) {
      ctx.strokeStyle = fgColor
      ctx.beginPath()
      ctx.moveTo(x * cellW, y * cellH + cellH - 2)
      ctx.lineTo(e * cellW, y * cellH + cellH - 2)
      ctx.stroke()
    }
    if (cell.cross) {
      ctx.strokeStyle = fgColor
      ctx.beginPath()
      ctx.moveTo(x * cellW, y * cellH + cellH / 2)
      ctx.lineTo(e * cellW, y * cellH + cellH / 2)
      ctx.stroke()
    }
    x = e
  }
}

function drawCursor(grid, cur, cursorVisible) {
  if (cursorVisible && cursorOn && cur) {
    const cx = cur.x * cellW
    const cy = cur.y * cellH
    ctx.fillStyle = resolveColor(7)
    ctx.fillRect(cx, cy, cellW, cellH)
    ctx.fillStyle = resolveColor(0)
    ctx.font = `${Math.round(fontSize * dpr)}px ${fontFamily}`
    const c = grid[cur.y] ? grid[cur.y][cur.x] : null
    if (c && c.ch && !c.skip) ctx.fillText(c.ch, cx, cy)
  }
}

function draw() {
  rafPending = false
  if (!dirty) return
  dirty = false

  if (typeof props.term.getGrid !== 'function') return
  // 每次绘制前按当前容器尺寸重新计算行/列，避免初始布局未稳定时 rows 过小
  // 导致内容只画在顶部、下半部分留黑
  measure()
  if (rows < 1 || cols < 2) { scheduleDraw(); return }
  const info = props.term.getGrid()
  const grid = info.grid
  const cur = info.cur
  const cursorVisible = info.cursorVisible
  const off = (typeof props.term.viewOffset === 'number') ? props.term.viewOffset : 0

  const width = cols * cellW
  const height = rows * cellH
  ctx.fillStyle = resolveColor(0)
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  // 增量滚动：把已有像素在设备像素上整数平移，仅重绘新暴露的条带。
  // 用离屏快照做源，避免 self drawImage 反馈拖影；整数偏移避免重采样导致字形虚化/大小抖动
  if (lastDraw && lastDraw.rows === rows && lastDraw.cols === cols &&
      off !== lastDraw.off && Math.abs(off - lastDraw.off) < rows) {
    const d = off - lastDraw.off
    const dy = d * cellH
    if (!tmpCv || tmpCv.width !== width || tmpCv.height !== height) {
      tmpCv = document.createElement('canvas')
      tmpCv.width = width
      tmpCv.height = height
      tmpCtx = tmpCv.getContext('2d')
    }
    tmpCtx.imageSmoothingEnabled = false
    tmpCtx.clearRect(0, 0, width, height)
    tmpCtx.drawImage(canvasRef.value, 0, 0, width, height)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(tmpCv, 0, 0, width, height, 0, dy, width, height)
    const y0 = d > 0 ? 0 : rows + d // 向上滚→重绘顶部条带；向下滚→重绘底部条带
    const y1 = d > 0 ? d : rows
    for (let y = y0; y < y1; y++) {
      const row = grid[y]
      if (row) drawRow(row, y)
    }
    drawCursor(grid, cur, cursorVisible)
    refreshScrollbar()
    lastDraw = { rows, cols, off }
    return
  }

  ctx.fillRect(0, 0, width, height)
  for (let y = 0; y < rows; y++) {
    const row = grid[y]
    if (row) drawRow(row, y)
  }
  drawCursor(grid, cur, cursorVisible)
  refreshScrollbar()
  lastDraw = { rows, cols, off }
}

function scheduleDraw() {
  dirty = true
  if (!rafPending) {
    rafPending = true
    requestAnimationFrame(draw)
  }
}

function onWheel(e) {
  e.preventDefault()
  const max = props.term.maxScroll()
  if (max <= 0) { props.term.setViewOffset(0); refreshScrollbar(); return }
  let delta = 0
  if (e.deltaMode === 1) delta = e.deltaY            // 行单位
  else if (e.deltaMode === 2) delta = e.deltaY * rows // 页单位
  else delta = e.deltaY / 40                          // 像素单位，约 40px/行
  // 像素滚动按比例聚合，避免高频小 delta 每帧整屏重绘
  wheelAccum = wheelAccum || { v: 0 }
  wheelAccum.v += delta
  const step = Math.trunc(wheelAccum.v)
  if (step !== 0) {
    wheelAccum.v -= step
    props.term.setViewOffset(props.term.viewOffset + step)
    scheduleDraw()
  } else {
    scheduleDraw()
  }
}
let wheelAccum = null

function onMouseDown(e) {
  // 聚焦到 canvas
  e.preventDefault()
  canvasRef.value.focus()
}

// ---- 滚动条 ----
function refreshScrollbar() {
  const sb = scrollbarRef.value
  const tk = thumbRef.value
  if (!sb || !tk) return
  // 轨道常显；有回滚历史才显示滑块
  sb.style.display = 'block'
  const max = (props.term && typeof props.term.maxScroll === 'function' && props.term.maxScroll()) || 0
  if (max <= 0) { tk.style.display = 'none'; return }
  tk.style.display = 'block'
  const trackH = sb.clientHeight || rows * cellH
  const thumbRatio = Math.min(1, rows / (max + rows))          // 可视比例
  const thumbH = Math.max(20, trackH * thumbRatio)
  tk.style.height = thumbH + 'px'
  // 位置：viewOffset 越大越靠近顶部
  const posRatio = (max - props.term.viewOffset) / max         // 0=底(最近),1=顶
  const maxTop = trackH - thumbH
  tk.style.top = (maxTop * posRatio) + 'px'
}

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
  // 立即按点击位置跳转
  onDragMove(e)
}

function onDragMove(e) {
  if (!dragState) return
  const max = props.term.maxScroll()
  if (max <= 0) { refreshScrollbar(); return }
  const dy = e.clientY - dragState.startY
  const maxTop = Math.max(1, dragState.trackH - dragState.thumbH)
  // 位置比例（0=底部最近，1=顶部历史）
  const startRatio = (max - dragState.startOffset) / max
  const posRatio = Math.max(0, Math.min(1, startRatio + dy / maxTop))
  const offset = max - Math.round(posRatio * max)
  props.term.setViewOffset(offset)
  refreshScrollbar()
  scheduleDraw()
}

function endDrag() {
  dragState = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', endDrag)
}

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

function onContextMenu(e) {
  e.preventDefault()
  emit('paste')
}

watch(() => props.term.redrawFull, () => scheduleDraw())
watch(() => props.term.cur, () => scheduleDraw(), { deep: true })

let rafWatcher = null
function tickCursor() {
  cursorOn = !cursorOn
  scheduleDraw()
}
let cursorBlinkTimer = null

onMounted(() => {
  canvasRef.value.addEventListener('wheel', onWheel, { passive: false })
  canvasRef.value.addEventListener('mousedown', onMouseDown)
  canvasRef.value.addEventListener('contextmenu', onContextMenu)
  canvasRef.value.addEventListener('keydown', onKeyDown)
  canvasRef.value.addEventListener('beforeinput', onBeforeInput)
  measure()
  window.addEventListener('resize', measure)
  ro = new ResizeObserver(() => { measure(); scheduleDraw() })
  if (canvasRef.value && canvasRef.value.parentElement) {
    ro.observe(canvasRef.value.parentElement)
  }
  cursorBlinkTimer = setInterval(tickCursor, 530)
  // 初始绘制
  scheduleDraw()
})

onUnmounted(() => {
  if (ro) { ro.disconnect(); ro = null }
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('wheel', onWheel)
    canvasRef.value.removeEventListener('mousedown', onMouseDown)
    canvasRef.value.removeEventListener('contextmenu', onContextMenu)
    canvasRef.value.removeEventListener('keydown', onKeyDown)
    canvasRef.value.removeEventListener('beforeinput', onBeforeInput)
  }
  window.removeEventListener('resize', measure)
  clearInterval(cursorBlinkTimer)
})

defineExpose({ measure, forceDraw: () => scheduleDraw() })
</script>

<template>
  <div class="term-wrap">
    <canvas ref="canvasRef" class="term-canvas" tabindex="0"></canvas>
    <div ref="scrollbarRef" class="term-scrollbar">
      <div ref="thumbRef" class="term-scrollbar-thumb" @mousedown="beginDrag"></div>
    </div>
  </div>
</template>

<style scoped>
.term-wrap {
  position: absolute;
  inset: 0;
}
.term-canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
  background: #000;
  cursor: text;
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