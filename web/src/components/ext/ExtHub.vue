<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'
import { verNewer } from '../../version'
import { useExtensions } from '../../stores/extensions'

// 「系统扩展」: 面板内置 7 项功能之外的功能, 以扩展包存于主面板库 extensions/,
// 面板主体安装时不含扩展, 在此页按需安装/更新/卸载。
const router = useRouter()
const { extensions, builtins, load: loadInstalled } = useExtensions()

const registry = ref([])
const regSource = ref('')     // github | local | ''
const regLoading = ref(false)
const regError = ref('')
const notice = ref('')
const noticeOk = ref(true)
const busy = ref('')
const progress = ref('')
const refreshing = ref(false)

const progressPct = computed(() => {
  const m = /(\d+)%/.exec(progress.value || '')
  return m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : 0
})

function flash(msg, ok = true) {
  notice.value = msg
  noticeOk.value = ok
  if (ok) setTimeout(() => { if (notice.value === msg) notice.value = '' }, 4000)
}

async function loadRegistry() {
  regLoading.value = true
  regError.value = ''
  try {
    const d = await api.extRegistry()
    registry.value = d.extensions || []
    regSource.value = d.source || ''
    if (d.error) regError.value = d.error
  } catch (e) {
    regError.value = e.message
    registry.value = []
    regSource.value = ''
  } finally {
    regLoading.value = false
  }
}

async function refresh() {
  refreshing.value = true
  try {
    await Promise.all([loadInstalled(), loadRegistry()])
  } finally {
    refreshing.value = false
  }
}

function newer(ext) {
  return !!(ext.installed && ext.version && ext.installed_version &&
    verNewer(ext.version, ext.installed_version))
}

async function storeTaskIds() {
  try {
    const d = await api.taskQueue(true, 40)
    const s = new Set()
    for (const t of (d.tasks || [])) if (t.source === 'ext') s.add(t.id)
    return s
  } catch (e) { return new Set() }
}

// 只跟踪新出现的 ext 任务: 队列里残留的旧记录会造成假完成(见任务队列审计)
async function watchTask(name, verb, before) {
  const t0 = Date.now()
  let last = ''
  let miss = 0
  while (Date.now() - t0 < 120000) {
    await new Promise((r) => setTimeout(r, 1500))
    let list = []
    try {
      const d = await api.taskQueue(true, 40)
      list = d.tasks || []
    } catch (e) { /* 下一轮再取 */ }
    const t = list.find((x) => x.source === 'ext' && !before.has(x.id) &&
      `${x.name || ''} ${x.message || ''}`.includes(name))
    if (!t) {
      if (++miss >= 8) { progress.value = ''; flash(`${verb}已提交, 到本页下方装好「任务队列」扩展后可查看进度`, false); return false }
      continue
    }
    miss = 0
    if (t.status === 'done') { progress.value = ''; flash(`${verb}完成: ${t.message || name}`); return true }
    if (t.status === 'failed') { progress.value = ''; flash(`${verb}失败: ${t.error || t.message || '未知错误'}`, false); return false }
    const line = `${verb}中 ${t.progress || 0}%${t.phase ? ' · ' + t.phase : ''}`
    if (line !== last) { last = line; progress.value = line }
  }
  progress.value = ''
  flash(`${verb}仍在后台进行, 到「任务队列」扩展查看进度(没装就在本页下方安装)`, false)
  return false
}

async function doInstall(ext, verb) {
  const name = ext.name
  const before = await storeTaskIds()
  busy.value = name
  try {
    if (verb === '更新') await api.extUpdate(name)
    else await api.extInstall(name)
    const ok = await watchTask(name, verb, before)
    if (ok) {
      await Promise.all([loadInstalled(), loadRegistry()])
      if (verb !== '更新') flash(`已安装 ${ext.label || name}, 可在侧边栏或本页打开`)
    }
  } catch (e) {
    flash(e.message, false)
  } finally { busy.value = '' }
}

async function doRemove(ext) {
  const name = ext.name
  if (!confirm(`确定卸载扩展 ${ext.label || name}？扩展目录将被删除。`)) return
  busy.value = name
  try {
    await api.extRemove(name)
    flash(`已卸载 ${ext.label || name}`)
    await Promise.all([loadInstalled(), loadRegistry()])
    if (name === 'media') router.push('/ext')
  } catch (e) {
    flash(`卸载失败: ${e.message}`, false)
  } finally { busy.value = '' }
}

function open(ext) {
  router.push(ext.route || ('/ext/' + ext.name))
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <div class="page-body">
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:12px;">
        <button class="btn btn-sm" :disabled="refreshing" @click="refresh">
          {{ refreshing ? '刷新中…' : '刷新' }}
        </button>
      </div>

      <div v-if="notice" class="ext-line" :class="noticeOk ? 'ok' : 'fail'">{{ notice }}</div>
      <div v-if="progress" class="progress" style="margin-bottom:6px;">
        <div :style="{ width: progressPct + '%' }"></div>
      </div>
      <div v-if="progress" class="hint" style="margin:-2px 0 10px;">{{ progress }}</div>

      <div class="section">
        <div class="section-title">内置功能 ({{ builtins.length }})</div>
        <div class="hint" style="margin-bottom:10px;">随面板主体安装, 不可卸载。</div>
        <div class="ext-grid">
          <div v-for="b in builtins" :key="b.name" class="ext-card builtin" @click="router.push(b.route || '/')">
            <div class="ext-name">{{ b.label }}</div>
            <div class="ext-desc">{{ b.description }}</div>
            <div class="ext-foot"><span class="tag-chip tag-chip-sm">内置</span></div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">已装扩展 ({{ extensions.length }})</div>
        <div v-if="!extensions.length" class="hint" style="padding:14px 2px;">
          还没有安装扩展, 到下方「可用扩展」安装(如媒体中心、任务队列)。
        </div>
        <div v-for="x in extensions" :key="x.name" class="ext-row">
          <div class="ext-row-main">
            <div class="ext-name">
              {{ x.label || x.name }}
              <span class="ext-mono">{{ x.name }}</span>
            </div>
            <div class="ext-desc">
              版本 {{ x.version || '-' }}
              <span v-if="x.author" style="margin-left:10px;">作者: {{ x.author }}</span>
              <span v-if="!x.has_assets" style="margin-left:10px;color:var(--danger);">产物缺失</span>
            </div>
            <div v-if="x.description" class="ext-desc">{{ x.description }}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm" @click="open(x)">打开</button>
            <button class="btn btn-sm btn-danger" :disabled="!!busy" @click="doRemove(x)">卸载</button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">可用扩展 ({{ registry.length }})</div>
        <div v-if="regError || regSource === 'local'" class="ext-err">仓库不可用</div>
        <div v-if="regLoading && !registry.length" class="hint" style="padding:14px 2px;">加载中...</div>
        <div v-else-if="!registry.length && !regError" class="hint" style="padding:14px 2px;">
          {{ regSource === 'local' ? '本地源中没有可安装的扩展' : '没有可安装的扩展' }}
        </div>
        <div v-for="x in registry" :key="x.name" class="ext-row">
          <div class="ext-row-main">
            <div class="ext-name">
              {{ x.label || x.name }}
              <span class="ext-mono">{{ x.name }}</span>
            </div>
            <div class="ext-desc">
              版本 {{ x.version || '-' }}
              <span v-if="x.author" style="margin-left:10px;">作者: {{ x.author }}</span>
            </div>
            <div v-if="x.description" class="ext-desc">{{ x.description }}</div>
          </div>
          <span v-if="x.installed" class="tag-chip">
            {{ x.installed_version ? `已装 ${x.installed_version}` : '已装' }}
          </span>
          <span v-if="newer(x)" class="tag-chip tag-chip-sm" style="border-color:var(--accent);color:var(--accent);">
            有更新 → {{ x.version }}
          </span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <template v-if="!x.installed">
              <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="doInstall(x, '安装')">
                {{ busy === x.name ? '安装中…' : '安装' }}
              </button>
            </template>
            <template v-else>
              <button v-if="newer(x)" class="btn btn-sm" :disabled="!!busy" @click="doInstall(x, '更新')">
                {{ busy === x.name ? '更新中…' : '更新' }}
              </button>
              <button v-else class="btn btn-sm" disabled style="opacity:.6;cursor:default;"
                      title="版本已是最新, 如需修复可先卸载再安装">已是最新</button>
              <button class="btn btn-sm" @click="open(x)">打开</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ext-line { font-size: 13px; padding: 6px 0 10px; }
.ext-line.ok { color: var(--success); }
.ext-line.fail { color: var(--danger); }
.ext-err {
  padding: 10px 12px; text-align: center; color: var(--danger);
  border: 1px solid var(--danger); border-radius: var(--radius-sm); margin-bottom: 10px;
}
.ext-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.ext-card {
  border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 12px 14px; background: var(--surface); cursor: pointer;
}
.ext-card:hover { border-color: var(--accent); }
.ext-card.builtin { cursor: pointer; }
.ext-row {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 12px 14px; margin-bottom: 10px; background: var(--surface);
}
.ext-row-main { flex: 1; min-width: 220px; }
.ext-name { font-size: 15px; font-weight: 600; }
.ext-mono { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); margin-left: 6px; }
.ext-desc { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.ext-foot { margin-top: 8px; }
@media (max-width: 960px) {
  .ext-grid { grid-template-columns: 1fr 1fr; }
}
</style>
