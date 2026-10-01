<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

// 「面板更新」悬浮窗(样式对齐宝塔面板的更新弹窗: 标题带关闭、版本对比行、
// 分块带表头的日志区、底部按钮条)。
//
// 性能约定(2026-10-01): 曾出现"点了下载按钮半天才弹出" —— 根因是 Sidebar 模板里的
// showUpdate 没声明成 ref, 点击只写到了未跟踪的 ctx 上, 不触发重渲染, 要等别的响应式
// 变化顺带重渲染才出现。这里另外做两件事保证"点开即现":
//   ① 首帧只画外壳, 接口数据 requestAnimationFrame 之后再并行取;
//   ② 接口并行(Promise.all), 不再串行 await 四次。
const props = defineProps({
  // 触发按钮元素(用于定位与"点击外部关闭"); 由 Sidebar 传入
  anchor: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const root = ref(null)
const pos = ref({ top: 0, left: 0, width: 460 })
const cur = ref({})
const cmd = ref({})
const st = ref({})
const chk = ref(null)
const logs = ref([])
const busy = ref('')
const notice = ref('')
const noticeOk = ref(true)
const progress = ref('')
const askApply = ref(false)

const latest = computed(() => (chk.value && chk.value.latest) || '')
const target = computed(() => latest.value || cmd.value.version || '')
const targetNotes = computed(() => {
  const list = (chk.value && chk.value.versions) || []
  const hit = list.find((v) => v.version === target.value)
  return hit ? (hit.notes || '') : ''
})
const hasUpdate = computed(() => !!(chk.value && chk.value.has_update))
// 检查状态: 没查过 ≠ 已是最新(否则开窗瞬间就谎报"已是最新", 正是用户踩过的坑)
const badgeState = computed(() => {
  if (!chk.value) return 'unknown'
  if (chk.value.error) return 'error'
  return hasUpdate.value ? 'on' : 'off'
})
const badgeText = computed(() => ({
  unknown: '检查中…', error: '检查失败', on: '有新版本', off: '已是最新',
}[badgeState.value]))
const curVer = computed(() => (chk.value && chk.value.current) || cur.value.version || '-')
const pendingRestart = computed(() => !!(st.value && st.value.pending_restart))
const sver = computed(() => (chk.value && chk.value.source) || (chk.value && chk.value.error ? '' : ''))

function anchorEl() {
  const a = props.anchor
  if (!a) return null
  return a.$el || a
}
// 贴在按钮下方右侧展开; 视口不够时贴边/上翻
function place() {
  const el = anchorEl()
  const W = Math.min(460, window.innerWidth - 16)
  let top = 56
  let left = 8
  if (el && el.getBoundingClientRect) {
    const r = el.getBoundingClientRect()
    top = r.bottom + 6
    left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    const H = root.value ? root.value.offsetHeight : 420
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
    api.panelInstallCommand().catch(function () { return null }),
    api.panelUpdateState().catch(function () { return null }),
    api.panelUpdateLog().catch(function () { return null }),
  ])
  if (r[0]) cur.value = r[0]
  if (r[1]) cmd.value = r[1]
  if (r[2]) st.value = r[2]
  if (r[3]) logs.value = r[3].entries || []
  place()
  // 顺带后台查一次版本(不阻塞首帧, 也不弹提示)
  if (!chk.value) silentCheck()
}
async function silentCheck() {
  try { chk.value = await api.panelUpdateCheck() } catch (e) { /* 忽略: 手动检查时会报错 */ }
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
  askApply.value = false
  busy.value = 'apply'; progress.value = '下载并应用中…'
  try {
    await api.panelUpdateApply(target.value)
    for (let i = 0; i < 60; i++) {
      await new Promise(function (r) { setTimeout(r, 2000) })
      try { st.value = await api.panelUpdateState() } catch (e) {}
      if (pendingRestart.value) { flash('已应用 v' + st.value.applied + ', 待你确认重启'); break }
    }
    await load()
    if (!pendingRestart.value) flash('仍在应用中, 到「任务队列」查看进度(未安装则在「系统扩展」页装)', false)
  } catch (e) { flash('应用失败: ' + e.message, false) } finally { busy.value = ''; progress.value = '' }
}
async function doRestart() {
  try {
    await api.panelUpdateRestart()
    progress.value = '正在重启面板, 页面将在数秒后恢复…'
    busy.value = 'restart'
    const t0 = Date.now()
    const timer = setInterval(async function () {
      try {
        const v = await api.panelVersion()
        if (v && v.version) { clearInterval(timer); location.reload() }
      } catch (e) { /* 重启中接口不可用 */ }
      if (Date.now() - t0 > 60000) { clearInterval(timer); flash('未在 60s 内恢复, 请查看 journalctl -u raincough', false); busy.value = ''; progress.value = '' }
    }, 2000)
  } catch (e) { flash('重启下发失败: ' + e.message, false) }
}
async function doRollback() {
  if (!confirm('确定回滚到上一个备份版本？回滚后需重启才生效。')) return
  busy.value = 'rollback'
  try {
    const r = await api.panelUpdateRollback('')
    flash('已回滚 ' + (r.from || '') + ' → ' + (r.to || '') + ', 待确认重启')
    await load()
  } catch (e) { flash('回滚失败: ' + e.message, false) } finally { busy.value = '' }
}
function copy(text) {
  if (!text) return
  try { navigator.clipboard.writeText(text); flash('已复制安装命令') } catch (e) { flash('复制失败, 请手动选择', false) }
}
function fmtSize(n) { const b = n || 0; return b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : (b > 1024 ? (b / 1024).toFixed(1) + ' KB' : b + ' B') }
function fmtTime(ts) { if (!ts) return '-'; const d = new Date(ts * 1000); const p = function (x) { return String(x).padStart(2, '0') }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) }
function actionLabel(a) { return a === 'apply' ? '应用' : (a === 'rollback' ? '回滚' : a) }
function resultLabel(r) { return r === 'ok' ? '成功' : (r === 'fail' ? '失败' : r) }

function onDocDown(e) {
  const el = anchorEl()
  if (root.value && root.value.contains(e.target)) return
  if (el && el.contains && el.contains(e.target)) return
  emit('close')
}
function onKey(e) { if (e.key === 'Escape') emit('close') }

onMounted(function () {
  place()
  // load() 内部全是 await, 调用后立刻让出事件循环 —— 悬浮窗首帧照常画出, 数据随后填入。
  // (不要改成 requestAnimationFrame 里再调: 个别环境(后台标签/headless)rAF 不触发, 数据会永远不加载)
  load()
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
    <div ref="root" class="pu-pop" :style="{ top: pos.top + 'px', left: pos.left + 'px', width: pos.width + 'px' }">
      <div class="pu-head">
        <span class="pu-title">面板更新</span>
        <span class="pu-badge" :class="badgeState">{{ badgeText }}</span>
        <button class="pu-x" title="关闭" @click="emit('close')">×</button>
      </div>

      <div class="pu-body">
        <div class="pu-ver">
          <div class="pu-ver-row"><span class="pu-k">当前版本</span><span class="pu-v">{{ curVer }}</span></div>
          <div class="pu-ver-row">
            <span class="pu-k">最新版本</span>
            <span class="pu-v" :class="{ hl: hasUpdate }">{{ latest || '未检查' }}</span>
          </div>
        </div>

        <div v-if="notice" class="pu-line" :class="noticeOk ? 'ok' : 'fail'">{{ notice }}</div>
        <div v-if="progress" class="pu-line">{{ progress }}</div>

        <div v-if="askApply" class="pu-block warn">
          <div class="pu-bh">确认下载并应用</div>
          <div class="pu-pad">
            <div>将应用 <b>v{{ target }}</b>：先备份当前版本，应用后由你决定是否立即重启。</div>
            <div class="pu-mini">
              <button class="btn btn-sm btn-primary" @click="doApply">确定应用</button>
              <button class="btn btn-sm" @click="askApply = false">取消</button>
            </div>
          </div>
        </div>

        <div v-if="pendingRestart" class="pu-block warn">
          <div class="pu-bh">已应用 v{{ st.applied }}，待重启生效</div>
          <div class="pu-pad">
            <div class="pu-cmdrow">
              <code>sudo systemctl restart raincough</code>
              <button class="btn btn-sm" @click="copy('sudo systemctl restart raincough')">复制</button>
            </div>
          </div>
        </div>

        <div v-if="target && targetNotes" class="pu-block">
          <div class="pu-bh">更新日志 v{{ target }}</div>
          <pre class="pu-pre">{{ targetNotes }}</pre>
        </div>

        <div class="pu-block">
          <div class="pu-bh">更新历史</div>
          <div v-if="logs.length" class="pu-logs">
            <div v-for="(e, i) in logs" :key="i" class="pu-log-row">
              <span class="pu-log-t">{{ fmtTime(e.at) }}</span>
              <span>{{ actionLabel(e.action) }} {{ e.from }} → {{ e.to || '-' }}</span>
              <span :class="e.result === 'ok' ? 'ok' : 'fail'" style="margin-left:auto;">{{ resultLabel(e.result) }}</span>
            </div>
          </div>
          <div v-else class="pu-pad pu-empty">暂无更新记录</div>
        </div>

        <div class="pu-block">
          <div class="pu-bh">安装命令</div>
          <div class="pu-pad">
            <div class="pu-k2">本版本（v{{ cmd.version || curVer }}）</div>
            <div class="pu-cmdrow">
              <code>{{ cmd.install || '（releases.json 中没有本版本）' }}</code>
              <button class="btn btn-sm" @click="copy(cmd.install)">复制</button>
            </div>
            <div class="pu-k2">最新版</div>
            <div class="pu-cmdrow">
              <code>{{ cmd.install_latest || '-' }}</code>
              <button class="btn btn-sm" @click="copy(cmd.install_latest)">复制</button>
            </div>
            <div v-if="cmd.md5" class="pu-meta">资产 {{ cmd.tag }} · {{ fmtSize(cmd.size_bytes) }} · md5 {{ cmd.md5 }}</div>
          </div>
        </div>

        <div class="pu-tip">
          面板不会自动更新：检查 / 下载并应用 / 重启三步都由你确认<span v-if="sver">（版本来源 {{ sver }}）</span>。
        </div>
      </div>

      <div class="pu-foot">
        <button class="btn btn-sm" :disabled="!!busy" @click="doRollback">回滚</button>
        <span class="pu-spacer"></span>
        <button class="btn btn-sm" :disabled="!!busy" @click="check">{{ busy === 'check' ? '检查中…' : '检查更新' }}</button>
        <button v-if="hasUpdate && !pendingRestart" class="btn btn-sm btn-primary" :disabled="!!busy" @click="askApply = true">下载并应用</button>
        <button v-if="pendingRestart" class="btn btn-sm btn-primary" :disabled="!!busy" @click="doRestart">立即重启</button>
        <button v-if="pendingRestart" class="btn btn-sm" :disabled="!!busy" @click="flash('已应用, 稍后请手动执行: sudo systemctl restart raincough')">稍后重启</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="emit('close')">关闭</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 宝塔式弹窗: 标题条 / 内容区 / 底部按钮条 三段, 直角, 1px 边框 */
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
}
.pu-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
.pu-title { font-weight: 700; font-size: 13px; }
.pu-badge {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid var(--border-strong);
  color: var(--text-faint);
}
.pu-badge.on { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.pu-badge.error { color: var(--danger); border-color: var(--danger); }
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
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.pu-x:hover { color: var(--danger); border-color: var(--border-strong); }
.pu-body { padding: 10px 12px; overflow: auto; }
.pu-ver { border: 1px solid var(--border); padding: 6px 8px; background: var(--surface-2); }
.pu-ver-row { display: flex; align-items: baseline; justify-content: space-between; padding: 2px 0; }
.pu-k { color: var(--text-muted); }
.pu-k2 { font-size: 11px; color: var(--text-faint); margin: 6px 0 3px; }
.pu-v { font-family: var(--font-mono); }
.pu-v.hl { color: var(--accent); font-weight: 700; }
.pu-line { padding: 4px 0 0; color: var(--text-muted); }
.pu-line.ok { color: var(--success); }
.pu-line.fail { color: var(--danger); }
.pu-block { border: 1px solid var(--border); background: var(--surface-2); margin-top: 8px; }
.pu-block.warn { border-color: var(--accent); }
.pu-bh {
  padding: 5px 8px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
}
.pu-pad { padding: 8px; }
.pu-empty { color: var(--text-faint); }
.pu-pre {
  margin: 0;
  padding: 8px;
  max-height: 170px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted);
}
.pu-logs { max-height: 130px; overflow: auto; }
.pu-log-row { display: flex; align-items: baseline; gap: 8px; padding: 3px 8px; border-bottom: 1px dashed var(--border); }
.pu-log-row:last-child { border-bottom: 0; }
.pu-log-t { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }
.pu-log-row .ok { color: var(--success); }
.pu-log-row .fail { color: var(--danger); }
.pu-cmdrow { display: flex; align-items: center; gap: 6px; }
.pu-cmdrow code {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 3px 5px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.pu-meta { font-size: 10px; color: var(--text-faint); margin-top: 6px; word-break: break-all; }
.pu-mini { display: flex; gap: 8px; margin-top: 8px; }
.pu-tip { margin-top: 8px; font-size: 10px; color: var(--text-faint); }
.pu-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  flex-wrap: wrap;
}
.pu-spacer { flex: 1; }
</style>
