<template>
  <!-- 插件安装浮窗。三态: 胶囊(收起) → 浮窗(展开) → 确认遮罩(ConfirmSheet)。
       挂在 App.vue 上, 切路由不消失。 -->
  <Teleport to="body">
    <!-- 收起态: 右下角胶囊 -->
    <button
      v-if="!expanded && dock.openCount.value"
      class="rcq-dock-cap"
      title="插件安装"
      @click="expand"
    >
      <span class="rcq-dock-cap-dot" :class="capState"></span>
      <span v-if="dock.openCount.value > 1" class="rcq-dock-cap-n">{{ dock.openCount.value }}</span>
    </button>

    <!-- 展开态: 可拖动浮窗 -->
    <div
      v-else-if="dock.openCount.value"
      ref="dockEl"
      class="rcq-dock"
      :style="dockStyle"
    >
      <div class="rcq-dock-head" @mousedown="onDown">
        <span class="rcq-dock-title">{{ headTitle }}</span>
        <span v-if="dock.openCount.value > 1" class="rcq-dock-jobs">
          <button
            v-for="j in dock.jobs.value"
            :key="j.id"
            class="rcq-dock-job"
            :class="{ on: j.id === dock.activeId.value }"
            :title="j.label || j.name"
            @click.stop="dock.setActive(j.id)"
          >{{ (j.label || j.name || '?').slice(0, 6) }}</button>
        </span>
        <button class="rcq-dock-x" title="收起" @click.stop="collapse">×</button>
      </div>

      <div class="rcq-dock-body">
        <template v-if="job">
          <div v-if="job.message" class="rcq-dock-msg" :class="{ bad: job.error }">
            {{ job.message }}
          </div>

          <InstallTimeline :steps="job.steps" />

          <div v-if="job.env" class="rcq-dock-env">
            <EnvPanel
              :report="job.env"
              :loading="job.busy"
              :error="''"
              applyable
              @recheck="dock.refreshEnv(job.id)"
              @fix="onFix"
            />
          </div>

          <div class="rcq-dock-foot">
            <button
              class="btn btn-sm"
              :disabled="job.busy"
              @click="dock.refreshEnv(job.id)"
            >重新检查</button>
            <button
              v-if="canFix"
              class="btn btn-sm btn-primary"
              :disabled="job.busy"
              @click="fixAll"
            >全部修复</button>
            <button class="btn btn-sm btn-ghost" @click="dock.closeJob(job.id)">完成</button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>

  <ConfirmSheet />
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import EnvPanel from './EnvPanel.vue'
import InstallTimeline from './InstallTimeline.vue'
import ConfirmSheet from './ConfirmSheet.vue'
import { useInstallDock } from './useInstallDock'

const dock = useInstallDock()
const dockEl = ref(null)

// 位置记忆: 拖过一次就记住, 下次开还在原地。
const POS_KEY = 'rc_install_dock_pos'
const OPEN_KEY = 'rc_install_dock_open'

function loadPos() {
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
    if (raw && typeof raw.left === 'number' && typeof raw.top === 'number') return raw
  } catch (e) { /* 忽略 */ }
  return null
}
const pos = ref(loadPos())
const expanded = ref(localStorage.getItem(OPEN_KEY) === '1')

const job = computed(() => dock.activeJob.value)

const headTitle = computed(() => {
  const j = job.value
  if (!j) return '插件安装'
  return (j.label || j.name) + (j.version ? ' v' + j.version : '')
})

// 胶囊颜色跟着最"急"的那个 job 走
const capState = computed(() => {
  const j = job.value
  if (!j) return 'idle'
  if (j.error) return 'bad'
  if (j.env && !j.env.ready) return 'warn'
  return 'ok'
})

const canFix = computed(() => {
  const j = job.value
  if (!j || !j.env) return false
  return dock.pendingSteps(j.env).length > 0
})

const dockStyle = computed(() => {
  if (!pos.value) return { right: '18px', bottom: '18px' }
  return { left: pos.value.left + 'px', top: pos.value.top + 'px' }
})

function expand() {
  expanded.value = true
  try { localStorage.setItem(OPEN_KEY, '1') } catch (e) { /* 忽略 */ }
}
function collapse() {
  expanded.value = false
  try { localStorage.setItem(OPEN_KEY, '0') } catch (e) { /* 忽略 */ }
}

// ---- 拖动 ----
let drag = null
function onDown(e) {
  if (e.button !== 0 || !dockEl.value) return
  const r = dockEl.value.getBoundingClientRect()
  drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  e.preventDefault()
}
function onMove(e) {
  if (!drag || !dockEl.value) return
  const w = dockEl.value.offsetWidth || 380
  const h = dockEl.value.offsetHeight || 300
  const maxX = Math.max(0, window.innerWidth - w)
  const maxY = Math.max(0, window.innerHeight - h)
  const x = Math.min(maxX, Math.max(0, e.clientX - drag.dx))
  const y = Math.min(maxY, Math.max(0, e.clientY - drag.dy))
  pos.value = { left: x, top: y }
}
function onUp() {
  drag = null
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos.value || {})) } catch (e) { /* 忽略 */ }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
})

// ---- 修复 ----
function onFix(item) {
  if (!job.value) return
  dock.requestApply(job.value, item.apply_steps || [])
}
function fixAll() {
  if (!job.value) return
  dock.requestApply(job.value, [])
}
</script>

<style scoped>
.rcq-dock-cap {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 220;
  width: 46px;
  height: 46px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  background: var(--accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}
.rcq-dock-cap-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
}
.rcq-dock-cap-dot.warn { background: #ffd166; }
.rcq-dock-cap-dot.bad { background: #ff8a80; }
.rcq-dock-cap-n {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  line-height: 17px;
  text-align: center;
}

.rcq-dock {
  position: fixed;
  z-index: 220;
  width: 380px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  color: var(--text);
  overflow: hidden;
}
.rcq-dock-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  cursor: move;
  user-select: none;
  background: var(--surface-2);
}
.rcq-dock-title { font-weight: 600; font-size: 13px; }
.rcq-dock-jobs { display: flex; gap: 4px; }
.rcq-dock-job {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 11px;
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  cursor: pointer;
  max-width: 62px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rcq-dock-job.on { border-color: var(--accent); color: var(--accent); }
.rcq-dock-x {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}
.rcq-dock-x:hover { background: var(--surface-3); color: var(--text); }

.rcq-dock-body { padding: 10px 12px 12px; overflow: auto; }
.rcq-dock-msg {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 8px;
}
.rcq-dock-msg.bad { color: var(--danger); }
.rcq-dock-env { margin-top: 8px; }
.rcq-dock-foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

/* 窄屏: 变成底部抽屉, 不用手拖 */
@media (max-width: 640px) {
  .rcq-dock {
    left: 0 !important;
    top: auto !important;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    max-height: 70vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
}
</style>
