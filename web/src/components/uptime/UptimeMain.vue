<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const targets = ref([])
const status = ref({})
const loading = ref(false)
const error = ref('')
const notice = ref('')

const showForm = ref(false)
const editing = ref(null)
const form = ref({ name: '', url: '', method: 'GET', timeout: 10, interval: 60, expected_status: 200 })
const formErr = ref('')
const saving = ref(false)

const status24 = ref({})
const testing = ref('')

let pollTimer = null

async function load() {
  loading.value = true; error.value = ''
  try {
    const [t, s] = await Promise.all([api.upTargets(), api.upStatus()])
    targets.value = t || []
    status.value = s || {}
    await Promise.all((t || []).map(x => loadStatus24(x.name)))
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}

function poll() { load().catch(() => {}) }

async function loadStatus24(name) {
  try {
    const cells = await api.upStatus24(name)
    status24.value[name] = cells || []
  } catch (err) { /* ignore */ }
}

onMounted(() => {
  load()
  pollTimer = setInterval(poll, 10000)
})
onBeforeUnmount(() => { clearInterval(pollTimer) })

function openCreate() {
  editing.value = null
  form.value = { name: '', url: '', method: 'GET', timeout: 10, interval: 60, expected_status: 200 }
  formErr.value = ''
  showForm.value = true
}

function openEdit(t) {
  editing.value = t.name
  form.value = {
    name: t.name, url: t.url, method: t.method,
    timeout: t.timeout, interval: t.interval, expected_status: t.expected_status,
  }
  formErr.value = ''
  showForm.value = true
}

async function save() {
  formErr.value = ''
  if (!form.value.name.trim() || !form.value.url.trim()) { formErr.value = 'name 与 url 必填'; return }
  saving.value = true
  try {
    if (editing.value) {
      await api.upUpdate({ ...form.value })
      notice.value = '已更新'
    } else {
      await api.upCreate({ ...form.value })
      notice.value = '已添加'
    }
    setTimeout(() => { notice.value = '' }, 3000)
    showForm.value = false
    load()
  } catch (err) { formErr.value = err.message }
  finally { saving.value = false }
}

async function remove(name) {
  if (!confirm(`确认删除监控目标 ${name}？`)) return
  error.value = ''
  try { await api.upDelete(name); load() } catch (err) { error.value = err.message }
}

async function test(name) {
  testing.value = name; error.value = ''
  try {
    const r = await api.upTest(name)
    if (r.ok) {
      notice.value = `${name}: 在线 ${r.ms}ms (HTTP ${r.status_code})`
    } else {
      error.value = `${name}: 离线 ${r.error || 'HTTP ' + (r.status_code ?? '')}`
    }
    setTimeout(() => { notice.value = '' }, 5000)
  } catch (err) { error.value = err.message }
  finally { testing.value = '' }
}

function fmtTime(ts) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString()
}

function fmtAgo(ts) {
  if (!ts) return '-'
  const s = Math.floor(Date.now() / 1000) - ts
  if (s < 60) return `${s}s前`
  if (s < 3600) return `${Math.floor(s / 60)}m前`
  if (s < 86400) return `${Math.floor(s / 3600)}h前`
  return `${Math.floor(s / 86400)}d前`
}

function uptimeText(t) {
  if (t.uptime === null || t.uptime === undefined) return '-'
  return t.uptime + '%'
}

function cellStyle(c) {
  if (c === 1) return { flex: '1', background: 'var(--success)', minWidth: '1px' }
  if (c === 0) return { flex: '1', background: 'var(--danger)', minWidth: '1px' }
  return { flex: '1', background: 'var(--border-strong)', minWidth: '1px' }
}

function fmt24(i, c, len) {
  const bucketMin = (24 * 60) / len
  const agoMin = Math.round((len - 1 - i) * bucketMin)
  const ago = agoMin >= 60 ? `${Math.floor(agoMin / 60)}h${agoMin % 60 ? agoMin % 60 + 'm' : ''}前` : `${agoMin}m前`
  const st = c === 1 ? '在线' : c === 0 ? '离线' : '无数据'
  return `${ago} · ${st}`
}
</script>

<template>
  <div>
    <h1>Uptime 监控</h1>
    <div class="subtitle">对 HTTP/HTTPS 目标定时探活，记录在线状态、响应时间与 24h 可用率</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin-top:12px;">{{ notice }}</div>

    <div class="section" style="margin-top:16px;">
      <div class="section-title">概览</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;">
        <span class="tag-chip">监控 {{ status.total || 0 }}</span>
        <span class="tag-chip ok">在线 {{ status.online || 0 }}</span>
        <span class="tag-chip fail">离线 {{ status.offline || 0 }}</span>
        <span class="tag-chip">平均可用率 {{ status.avg_uptime ?? '-' }}%</span>
      </div>
    </div>

    <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
      <button class="btn btn-primary" @click="openCreate">添加目标</button>
      <span class="hint" style="font-size:12px;">每 10s 自动刷新</span>
    </div>

    <div v-if="showForm" class="section" style="margin-top:16px;">
      <div class="section-title">{{ editing ? '编辑目标' : '添加监控目标' }}</div>
      <div v-if="formErr" class="error" style="margin-bottom:10px;">{{ formErr }}</div>
      <div class="form-row">
        <span class="form-label">名称</span>
        <input v-model="form.name" class="input" :disabled="!!editing" placeholder="如 主站" />
      </div>
      <div class="form-row">
        <span class="form-label">URL</span>
        <input v-model="form.url" class="input" placeholder="https://example.com" />
      </div>
      <div class="form-row">
        <span class="form-label">方法</span>
        <select v-model="form.method" class="input" style="flex:0 0 120px;min-width:120px;width:120px;">
          <option>GET</option>
          <option>HEAD</option>
        </select>
        <span class="form-label" style="width:100px;">期望状态码</span>
        <input v-model.number="form.expected_status" class="input" style="flex:0 0 100px;min-width:80px;width:100px;" type="number" />
        <span class="form-label" style="width:100px;">超时(s)</span>
        <input v-model.number="form.timeout" class="input" style="flex:0 0 100px;min-width:80px;width:100px;" type="number" min="1" />
        <span class="form-label" style="width:110px;">间隔(s)</span>
        <input v-model.number="form.interval" class="input" style="flex:0 0 100px;min-width:80px;width:100px;" type="number" min="5" />
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
        <button class="btn btn-ghost" @click="showForm = false">取消</button>
      </div>
    </div>

    <div class="section" style="margin-top:16px;">
      <div class="section-title">监控目标 ({{ targets.length }})</div>
      <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div></div>
      <div v-else-if="!targets.length" class="hint" style="margin-top:12px;">暂无监控目标</div>
      <div v-else>
        <div v-for="t in targets" :key="t.name" class="result-item" style="cursor:default;margin-bottom:10px;" @click.stop>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="name" style="font-size:14px;">{{ t.name }}</span>
                <span v-if="t.last_ok === true" class="tag-chip ok">在线</span>
                <span v-else-if="t.last_ok === false" class="tag-chip fail">离线</span>
                <span v-else class="tag-chip muted">待检测</span>
                <span class="tag-chip">{{ t.method }}</span>
                <span v-if="t.last_ms !== undefined && t.last_ms !== null" class="tag-chip">{{ t.last_ms }}ms</span>
                <span class="tag-chip">可用率 {{ uptimeText(t) }}</span>
              </div>
              <div class="meta" style="font-size:12px;margin-top:4px;">{{ t.url }}</div>
              <div class="meta" style="font-size:11px;margin-top:2px;">
                间隔 {{ t.interval }}s · 超时 {{ t.timeout }}s · 期望 {{ t.expected_status }} ·
                最近检查 {{ fmtAgo(t.last_check) }} · 记录 {{ t.history_count }} 条
              </div>
              <div v-if="status24[t.name] && status24[t.name].length" style="margin-top:8px;">
                <div style="display:flex;gap:1px;height:16px;overflow:hidden;border-radius: 0;max-width:720px;">
                  <div
                    v-for="(c, i) in status24[t.name]"
                    :key="i"
                    :title="fmt24(i, c, status24[t.name].length)"
                    :style="cellStyle(c)"
                  ></div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:2px;max-width:720px;">
                  <span class="hint" style="font-size:10px;">24h前</span>
                  <span class="hint" style="font-size:10px;">12h前</span>
                  <span class="hint" style="font-size:10px;">现在</span>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn btn-sm" :disabled="testing === t.name" @click="test(t.name)">{{ testing === t.name ? '测试中...' : '测试' }}</button>
              <button class="btn btn-sm" @click="openEdit(t)">编辑</button>
              <button class="btn btn-sm btn-danger" @click="remove(t.name)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
