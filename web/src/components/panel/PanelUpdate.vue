<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

// 「面板更新」= 侧边栏标题右侧下载按钮的悬浮窗 + 检测到新版本时的确认弹窗。
// 内容按需求收敛为四件事: 当前/最新版本、更新日志、检查更新、更新面板;
// 更新历史/安装命令/回滚都不在这里(需要时用命令行或文档)。
//
// 两个曾踩过的坑(2026-10-01, 用 tools/ui-probe.mjs 实测发现, 别再犯):
//   ① 触发状态必须是声明过的 ref —— 曾漏声明 showUpdate, 点击落到未跟踪的 ctx 上不触发重渲染,
//      表现成"点了没反应/过一会儿才弹出";
//   ② api.js 里 panel* 方法名必须与后端一致, 缺一个就会让整个悬浮窗抛错变空壳。
const props = defineProps({
  open: { type: Boolean, default: false },   // 悬浮窗是否展开(由 Sidebar 控制)
  anchor: { type: Object, default: null },   // 触发按钮元素(定位 + 点击外部关闭)
})
const emit = defineEmits(['close'])

const root = ref(null)
const pos = ref({ top: 0, left: 0, width: 460 })
const cur = ref({})
const st = ref({})
const chk = ref(null)
const busy = ref('')
const notice = ref('')
const noticeOk = ref(true)
const progress = ref('')
const dlgOpen = ref(false)
const applyErr = ref('')

const latest = computed(() => (chk.value && chk.value.latest) || '')
const curVer = computed(() => (chk.value && chk.value.current) || cur.value.version || '-')
const notes = computed(() => {
  const list = (chk.value && chk.value.versions) || []
  const hit = list.find((v) => v.version === latest.value)
  return hit ? (hit.notes || '') : ''
})
const hasUpdate = computed(() => !!(chk.value && chk.value.has_update))
const pendingRestart = computed(() => !!(st.value && st.value.pending_restart))
// 没查过 ≠ 已是最新(否则开窗瞬间就谎报, 正是用户踩过的坑)
const badgeState = computed(() => {
  if (!chk.value) return 'unknown'
  if (chk.value.error) return 'error'
  return hasUpdate.value ? 'on' : 'off'
})
const badgeText = computed(() => ({
  unknown: '检查中…', error: '检查失败', on: '有新版本', off: '已是最新',
}[badgeState.value]))
// 弹窗当前展示哪一步
const dlgView = computed(() => {
  if (busy.value === 'apply' || progress.value) return 'applying'
  if (pendingRestart.value) return 'restart'
  if (applyErr.value) return 'error'
  return 'confirm'
})

function anchorEl() {
  const a = props.anchor
  return a ? (a.$el || a) : null
}
function place() {
  const el = anchorEl()
  const W = Math.min(460, window.innerWidth - 16)
  let top = 56
  let left = 8
  if (el && el.getBoundingClientRect) {
    const r = el.getBoundingClientRect()
    top = r.bottom + 6
    left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    const H = root.value ? root.value.offsetHeight : 380
    if (top + H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - H - 8)
  }
  pos.value = { top: top, left: left, width: W }
}
function flash(m, ok) {
  notice.value = m; noticeOk.value = ok !== false
  if (noticeOk.value) setTimeout(function () { if (notice.value === m) notice.value = '' }, 4000)
}
async function load() {
  const r = await Promise.all([
    api.panelVersion().catch(function () { return null }),
    api.panelUpdateState().catch(function () { return null }),
  ])
  if (r[0]) cur.value = r[0]
  if (r[1]) st.value = r[1]
  place()
  if (!chk.value) {
    await silentCheck()
    autoOpenDialog()
  }
}
async function silentCheck() {
  try { chk.value = await api.panelUpdateCheck() } catch (e) { /* 手动检查时会报错 */ }
}
// 检测到新版本就弹确认窗; 同一会话里用户选过"稍后"的版本不再自动弹(不反复打扰)
function autoOpenDialog() {
  if (!hasUpdate.value) return
  let skip = ''
  try { skip = sessionStorage.getItem('rc-upd-skip') || '' } catch (e) {}
  if (skip === latest.value) return
  dlgOpen.value = true
}
function laterOn() {
  if (hasUpdate.value) { try { sessionStorage.setItem('rc-upd-skip', latest.value) } catch (e) {} }
  dlgOpen.value = false
  if (!pendingRestart.value) emit('close')
}
async function check() {
  busy.value = 'check'; progress.value = '检查更新中…'
  try {
    chk.value = await api.panelUpdateCheck()
    if (chk.value.error) flash('检查失败: ' + chk.value.error, false)
    else flash(hasUpdate.value ? ('发现新版本 v' + latest.value) : '已是最新版本')
  } catch (e) { flash('检查失败: ' + e.message, false) } finally { busy.value = ''; progress.value = '' }
  place()
}
async function doApply() {
  applyErr.value = ''
  busy.value = 'apply'
  progress.value = '正在下载并应用 v' + latest.value + '…'
  try {
    await api.panelUpdateApply(latest.value)
    for (let i = 0; i < 60; i++) {
      await new Promise(function (r) { setTimeout(r, 2000) })
      try { st.value = await api.panelUpdateState() } catch (e) {}
      if (pendingRestart.value) break
    }
    progress.value = ''
    try { chk.value = await api.panelUpdateCheck() } catch (e) {}
    if (!pendingRestart.value) applyErr.value = '仍在应用中，可到「任务队列」看进度(未安装则在「系统扩展」页装)'
  } catch (e) {
    progress.value = ''
    applyErr.value = '更新失败: ' + e.message
  } finally { busy.value = '' }
}
async function doRestart() {
  try {
    applyErr.value = ''
    await api.panelUpdateRestart()
    progress.value = '正在重启面板, 页面将在数秒后恢复…'
    busy.value = 'restart'
    const t0 = Date.now()
    const timer = setInterval(async function () {
      try {
        const v = await api.panelVersion()
        if (v && v.version) { clearInterval(timer); location.reload() }
      } catch (e) { /* 重启中接口不可用 */ }
      if (Date.now() - t0 > 60000) { clearInterval(timer); progress.value = ''; busy.value = ''; flash('未在 60s 内恢复, 请查看 journalctl -u raincough', false) }
    }, 2000)
  } catch (e) { progress.value = ''; flash('重启下发失败: ' + e.message, false) }
}
function copy(text) {
  if (!text) return
  try { navigator.clipboard.writeText(text); flash('已复制') } catch (e) { flash('复制失败, 请手动选择', false) }
}
function onDocDown(e) {
  if (dlgOpen.value) return                       // 弹窗有自己的遮罩处理
  const el = anchorEl()
  if (root.value && root.value.contains(e.target)) return
  if (el && el.contains && el.contains(e.target)) return
  emit('close')
}
function onKey(e) { if (e.key === 'Escape') { if (dlgOpen.value) laterOn(); else emit('close') } }

onMounted(function () {
  place()
  load()   // 内部全是 await, 不阻塞首帧; 顺带自动查一次版本
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
  document.addEventListener('mousedown', onDocDown)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(function () {
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
  document.removeEventListener('mousedown', onDocDown)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <!-- 悬浮窗: 只有 当前/最新版本 + 检查更新 + 更新日志 -->
    <div v-if="open" ref="root" class="pu-pop" :style="{ top: pos.top + 'px', left: pos.left + 'px', width: pos.width + 'px' }">
      <div class="pu-head">
        <span class="pu-title">面板更新</span>
        <span class="pu-badge" :class="badgeState">{{ badgeText }}</span>
        <button class="pu-x" title="关闭" @click="emit('close')">×</button>
      </div>
      <div class="pu-body">
        <div class="pu-ver">
          <div class="pu-ver-row"><span class="pu-k">当前版本</span><span class="pu-v">{{ curVer }}</span></div>
          <div class="pu-ver-row"><span class="pu-k">最新版本</span><span class="pu-v" :class="{ hl: hasUpdate }">{{ latest || '—' }}</span></div>
          <div class="pu-ver-act">
            <button class="btn btn-sm" :disabled="!!busy" @click="check">{{ busy === 'check' ? '检查中…' : '检查更新' }}</button>
          </div>
        </div>

        <div v-if="notice" class="pu-line" :class="noticeOk ? 'ok' : 'fail'">{{ notice }}</div>

        <div v-if="latest && notes" class="pu-block">
          <div class="pu-bh">更新日志 v{{ latest }}</div>
          <pre class="pu-pre">{{ notes }}</pre>
        </div>

        <button v-if="hasUpdate" class="btn btn-sm btn-primary pu-wide" :disabled="!!busy" @click="dlgOpen = true">
          更新面板
        </button>
      </div>
    </div>

    <!-- 检测到新版本: 确认弹窗(更新内容 + 确认更新; 更新完成后在这里确认重启) -->
    <div v-if="dlgOpen" class="pu-mask" @mousedown.self="laterOn">
      <div class="pu-dlg">
        <div class="pu-dlg-head">
          <span class="pu-title">面板更新</span>
          <button class="pu-x" title="关闭" @click="laterOn">×</button>
        </div>

        <div class="pu-dlg-body">
          <template v-if="dlgView === 'confirm'">
            <div class="pu-dlg-ver">
              当前版本 <b>{{ curVer }}</b>
              <span class="pu-arrow">→</span>
              最新版本 <b class="hl">{{ latest }}</b>
            </div>
            <div class="pu-block">
              <div class="pu-bh">更新内容 v{{ latest }}</div>
              <pre class="pu-pre tall">{{ notes || '（该版本没有填写更新说明）' }}</pre>
            </div>
          </template>

          <template v-else-if="dlgView === 'applying'">
            <div class="pu-dlg-ver">正在更新到 <b class="hl">v{{ latest }}</b></div>
            <div class="pu-progress">{{ progress || '正在下载并应用中…' }}</div>
            <div class="pu-note">先备份当前版本再覆盖；完成后由你确认是否立即重启。</div>
          </template>

          <template v-else-if="dlgView === 'restart'">
            <div class="pu-dlg-ver">已更新到 <b class="hl">v{{ st.applied }}</b>，重启后生效</div>
            <div class="pu-cmdrow">
              <code>sudo systemctl restart raincough</code>
              <button class="btn btn-sm" @click="copy('sudo systemctl restart raincough')">复制</button>
            </div>
            <div class="pu-note">面板不会自动重启：由你决定现在重启还是稍后手动执行。</div>
          </template>

          <template v-else>
            <div class="pu-dlg-ver fail">更新未完成</div>
            <div class="pu-note">{{ applyErr }}</div>
            <div class="pu-cmdrow">
              <code>sudo systemctl restart raincough</code>
              <button class="btn btn-sm" @click="copy('sudo systemctl restart raincough')">复制</button>
            </div>
          </template>
        </div>

        <div class="pu-dlg-foot">
          <template v-if="dlgView === 'confirm'">
            <button class="btn btn-sm" @click="laterOn">稍后</button>
            <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="doApply">确认更新</button>
          </template>
          <template v-else-if="dlgView === 'applying'">
            <button class="btn btn-sm" disabled>更新中…</button>
          </template>
          <template v-else-if="dlgView === 'restart'">
            <button class="btn btn-sm" :disabled="!!busy" @click="laterOn">稍后手动重启</button>
            <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="doRestart">立即重启</button>
          </template>
          <template v-else>
            <button class="btn btn-sm" @click="laterOn">关闭</button>
            <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="doApply">重试</button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 宝塔式两段式弹窗(标题条 / 内容 / 按钮条), 直角 + 1px 边框。
   文字一律用 --text(近黑), 不用 --text-faint —— 之前整体太浅就是这个原因。 */
.pu-pop {
  position: fixed;
  z-index: 200;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 24px);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 30px rgba(0, 0, 0, .3);
  font-size: 12px;
  color: var(--text);
}
.pu-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
.pu-title { font-weight: 700; font-size: 13px; color: var(--text); }
.pu-badge {
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
}
.pu-badge.on { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); font-weight: 700; }
.pu-badge.error { color: var(--danger); border-color: var(--danger); font-weight: 700; }
.pu-x {
  margin-left: auto;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.pu-x:hover { color: var(--danger); border-color: var(--border-strong); }
.pu-body { padding: 10px 12px; overflow: auto; }
.pu-ver { border: 1px solid var(--border); padding: 7px 9px; background: var(--surface-2); }
.pu-ver-row { display: flex; align-items: baseline; justify-content: space-between; padding: 2px 0; }
.pu-k { color: var(--text); font-weight: 600; }
.pu-v { font-family: var(--font-mono); color: var(--text); font-weight: 600; }
.pu-v.hl { color: var(--accent); font-weight: 700; }
.pu-ver-act { display: flex; justify-content: flex-end; margin-top: 7px; }
.pu-line { padding: 6px 0 0; color: var(--text); }
.pu-line.ok { color: var(--success); font-weight: 600; }
.pu-line.fail { color: var(--danger); font-weight: 600; }
.pu-block { border: 1px solid var(--border); background: var(--surface-2); margin-top: 8px; }
.pu-bh {
  padding: 6px 9px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}
.pu-pre {
  margin: 0;
  padding: 9px;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.65;
  color: var(--text);
}
.pu-pre.tall { max-height: 300px; }
.pu-wide { width: 100%; margin-top: 8px; }
.pu-cmdrow { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.pu-cmdrow code {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text);
  padding: 4px 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 弹窗(遮罩 + 卡片) */
.pu-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, .35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.pu-dlg {
  width: 520px;
  max-width: 100%;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: 0 14px 40px rgba(0, 0, 0, .4);
  font-size: 12px;
  color: var(--text);
}
.pu-dlg-head {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
.pu-dlg-body { padding: 12px 14px; overflow: auto; }
.pu-dlg-ver { font-size: 13px; color: var(--text); }
.pu-dlg-ver b { font-family: var(--font-mono); }
.pu-dlg-ver b.hl { color: var(--accent); }
.pu-dlg-ver.fail { color: var(--danger); font-weight: 700; }
.pu-arrow { color: var(--text-muted); margin: 0 4px; }
.pu-progress { margin-top: 10px; font-family: var(--font-mono); color: var(--text); }
.pu-note { margin-top: 8px; color: var(--text-muted); line-height: 1.7; }
.pu-dlg-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
}
</style>
