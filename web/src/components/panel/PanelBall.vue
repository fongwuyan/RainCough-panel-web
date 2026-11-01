<script setup>
// 内容区悬浮球：拖到哪记到哪，点一下收起/展开侧栏，右键（或长按）换外观。
// 图标支持上传图片（base64 存 localStorage，>1MB 拒绝，避免撑爆）。
//
// 两个必须注意的点：
// 1) <img> 默认 draggable=true —— 上传图标后一拖就变成"拖图片"，pointer 事件被浏览器
//    原生拖拽接管，球就拖不动了。必须 draggable=false + user-drag:none + pointer-events:none。
// 2) 右键菜单不能写死 right/bottom，否则球拖到别处菜单还留在角落。按球的实时矩形算。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useUi } from '../../stores/ui'

const ui = useUi()
const ball = ui.ball

const pos = ref({ x: ball.value.x, y: ball.value.y })
const dragging = ref(false)
const menuOpen = ref(false)
const menuPos = ref({ left: 0, top: 0 })
const fileInput = ref(null)
const ballEl = ref(null)

const size = 44
const margin = 10
const MENU_W = 214
const MENU_H = 158
const GAP = 10

const style = computed(() => {
  const s = { width: size + 'px', height: size + 'px' }
  if (pos.value.x == null || pos.value.y == null) {
    s.right = '22px'
    s.bottom = '22px'
  } else {
    s.left = pos.value.x + 'px'
    s.top = pos.value.y + 'px'
  }
  s.background = ball.value.tone === 'white' ? '#ffffff' : '#111214'
  s.color = ball.value.tone === 'white' ? '#111214' : '#ffffff'
  s.borderColor = ball.value.tone === 'white' ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.18)'
  return s
})

function clamp(x, y) {
  const maxX = window.innerWidth - size - margin
  const maxY = window.innerHeight - size - margin
  return { x: Math.min(Math.max(margin, x), Math.max(margin, maxX)), y: Math.min(Math.max(margin, y), Math.max(margin, maxY)) }
}

let start = null
let moved = false
let pressTimer = null

function onPointerDown(e) {
  if (e.button !== 0) return
  const rect = e.currentTarget.getBoundingClientRect()
  start = { px: e.clientX, py: e.clientY, x: rect.left, y: rect.top }
  moved = false
  dragging.value = true
  try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* 合成事件没有活动指针 */ }
  pressTimer = setTimeout(() => { if (!moved) { openMenu(); dragging.value = false } }, 600)
}

function onPointerMove(e) {
  if (!start) return
  const dx = e.clientX - start.px
  const dy = e.clientY - start.py
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true
  if (!moved) return
  pos.value = clamp(start.x + dx, start.y + dy)
}

function onPointerUp(e) {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
  if (!start) return
  dragging.value = false
  if (moved) {
    ui.setBall({ x: pos.value.x, y: pos.value.y })
  } else if (!menuOpen.value) {
    ui.setSidebarHidden(!ui.sidebarHidden.value)
  }
  start = null
}

/** 菜单贴着球：优先上方，放不下放下方；左右按视口夹紧。 */
function openMenu() {
  const el = ballEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  let left = r.left + size / 2 - MENU_W / 2
  let top = r.top - MENU_H - GAP
  if (top < 8) top = r.bottom + GAP
  if (top + MENU_H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - MENU_H - 8)
  left = Math.min(Math.max(8, left), window.innerWidth - MENU_W - 8)
  menuPos.value = { left, top }
  menuOpen.value = true
}

function onContext(e) {
  e.preventDefault()
  if (menuOpen.value) { menuOpen.value = false; return }
  openMenu()
}

function pickTone(tone) { ui.setBall({ tone }) }

function chooseIcon() {
  if (fileInput.value) fileInput.value.click()
}

function onIconPicked(e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  if (f.size > 1024 * 1024) { alert('图标别超过 1MB'); return }
  const reader = new FileReader()
  reader.onload = () => { ui.setBall({ icon: String(reader.result || '') }); menuOpen.value = false }
  reader.readAsDataURL(f)
  e.target.value = ''
}

function resetIcon() { ui.setBall({ icon: '' }) }
function hideBall() { menuOpen.value = false; ui.setBall({ on: false }); ui.setSidebarHidden(false) }

function onResize() {
  if (pos.value.x != null) {
    const p = clamp(pos.value.x, pos.value.y)
    pos.value = p
    ui.setBall({ x: p.x, y: p.y })
  }
  if (menuOpen.value) openMenu()
}

onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <div class="rc-ball-wrap">
    <div
      ref="ballEl"
      class="rc-ball"
      :class="{ dragging }"
      :style="style"
      title="点击：收起/展开侧栏 · 右键：外观 · 可拖动"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @contextmenu="onContext"
      @dragstart.prevent
    >
      <img v-if="ball.icon" :src="ball.icon" alt="" draggable="false" />
      <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    </div>

    <div
      v-if="menuOpen"
      class="rc-ball-menu"
      :style="{ left: menuPos.left + 'px', top: menuPos.top + 'px', width: MENU_W + 'px' }"
      @pointerdown.stop
      @contextmenu.prevent
    >
      <div class="row">
        <span>底色</span>
        <button :class="{ on: ball.tone !== 'white' }" @click="pickTone('black')">黑</button>
        <button :class="{ on: ball.tone === 'white' }" @click="pickTone('white')">白</button>
      </div>
      <div class="row">
        <span>图标</span>
        <button @click="chooseIcon">上传图片</button>
        <button v-if="ball.icon" @click="resetIcon">恢复默认</button>
      </div>
      <div class="row">
        <button class="ghost" @click="hideBall">隐藏这个球</button>
      </div>
      <div class="tip">隐藏后可在「设置 → 外观 → 布局」里重新打开</div>
    </div>

    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onIconPicked" />
  </div>
</template>

<style scoped>
.rc-ball-wrap { position: fixed; inset: 0; pointer-events: none; z-index: 60; }
.rc-ball {
  position: fixed;
  border-radius: 50%;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  pointer-events: auto;
  box-shadow: 0 6px 18px rgba(0, 0, 0, .18);
  transition: transform .12s ease, box-shadow .12s ease;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  overflow: hidden;
}
.rc-ball:hover { transform: scale(1.06); box-shadow: 0 8px 22px rgba(0, 0, 0, .26); }
.rc-ball.dragging { cursor: grabbing; transform: scale(1.04); }
/* 图标不能抢事件，否则一拖就变成浏览器原生"拖图片" */
.rc-ball img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  -webkit-user-drag: none;
  user-drag: none;
}
.rc-ball-menu {
  position: fixed;
  background: var(--bg-raised, #fff);
  border: 1px solid var(--border, #e5e5e5);
  padding: 10px 12px;
  pointer-events: auto;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .18);
  font-size: 12px;
  color: var(--text, #111);
}
.rc-ball-menu .row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.rc-ball-menu .row span { width: 36px; color: var(--text-muted, #888); font-size: 11px; }
.rc-ball-menu button {
  background: var(--surface-2, #f5f5f5);
  border: 1px solid var(--border, #e5e5e5);
  color: inherit;
  padding: 3px 10px;
  font-size: 11.5px;
  cursor: pointer;
}
.rc-ball-menu button.on { border-color: var(--accent, #2563eb); color: var(--accent, #2563eb); }
.rc-ball-menu button.ghost { width: 100%; color: var(--text-muted, #888); }
.rc-ball-menu .tip { font-size: 10.5px; color: var(--text-faint, #aaa); margin-top: 2px; }
</style>
