<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const info = ref({})
const containers = ref([])
const images = ref([])
const loading = ref(false)
const error = ref('')
const notice = ref('')

const tab = ref('containers')
const tabs = [
  { key: 'containers', label: '容器' },
  { key: 'images', label: '镜像' },
  { key: 'networks', label: '网络' },
  { key: 'volumes', label: '卷' },
]

const pullName = ref('')
const pulling = ref(false)
const logShow = ref(false)
const logName = ref('')
const logText = ref('')
const logLoading = ref(false)

let pollTimer = null

async function load() {
  loading.value = true; error.value = ''
  try {
    const [i, c] = await Promise.all([api.dkInfo(), api.dkContainers()])
    info.value = i || {}
    containers.value = c || []
    if (tab.value !== 'containers') {
      const data = tab.value === 'images' ? await api.dkImages()
        : tab.value === 'networks' ? await api.dkNetworks()
        : await api.dkVolumes()
      if (tab.value === 'images') images.value = data || []
      else extra.value = data || []
    }
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}

const extra = ref([])

function poll() { load().catch(() => {}) }

onMounted(() => {
  load()
  pollTimer = setInterval(poll, 10000)
})
onBeforeUnmount(() => { clearInterval(pollTimer) })

function switchTab(key) {
  tab.value = key
  load()
}

async function act(fn, id, msg) {
  error.value = ''
  try {
    const r = await fn(id)
    if (msg) { notice.value = msg; setTimeout(() => { notice.value = '' }, 3000) }
    load()
  } catch (err) { error.value = err.message }
}

async function removeContainer(c) {
  if (!confirm(`确认删除容器 ${c.name}？`)) return
  await act(api.dkRemove, c.id, `已删除容器 ${c.name}`)
}

async function removeImage(img) {
  const label = (img.tags && img.tags[0]) || img.id
  if (!confirm(`确认删除镜像 ${label}？`)) return
  error.value = ''
  try { await api.dkRemoveImage(img.id, true); load() }
  catch (err) { error.value = err.message }
}

async function pull() {
  if (!pullName.value.trim()) { error.value = '请输入镜像名'; return }
  pulling.value = true; error.value = ''
  try {
    await api.dkPull(pullName.value.trim())
    notice.value = `已拉取 ${pullName.value.trim()}`
    setTimeout(() => { notice.value = '' }, 3000)
    pullName.value = ''
    load()
  } catch (err) { error.value = err.message }
  finally { pulling.value = false }
}

async function openLogs(c) {
  logShow.value = true
  logName.value = c.name
  logText.value = ''
  logLoading.value = true
  try {
    const r = await api.dkLogs(c.id, 200)
    logText.value = r.logs || '(无日志)'
  } catch (err) { logText.value = '读取失败: ' + err.message }
  finally { logLoading.value = false }
}

function stateClass(c) {
  const s = (c.state || '').toLowerCase()
  if (s === 'running') return 'ok'
  if (s === 'exited') return 'fail'
  return ''
}

function stateLabel(c) {
  const s = (c.state || '').toLowerCase()
  const map = { running: '运行中', exited: '已停止', paused: '已暂停', created: '已创建', restarting: '重启中' }
  return map[s] || c.state || ''
}

function isRunning(c) {
  return (c.state || '').toLowerCase() === 'running'
}

function fmtSize(s) {
  if (!s) return '-'
  const m = s.match(/([\d.]+)\s*([KMGTP]?B)/i)
  if (m) return m[1] + ' ' + m[2].toUpperCase()
  return s
}
</script>

<template>
  <div>
    <h1>Docker 管理</h1>
    <div class="subtitle">Docker 容器与镜像管理：列表、启停、删除、日志查看、镜像拉取</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin-top:12px;">{{ notice }}</div>

    <div class="section" style="margin-top:16px;">
      <div class="section-title">概览</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;">
        <span v-if="info.version" class="tag-chip">Docker {{ info.version }}</span>
        <span class="tag-chip ok">运行中 {{ info.containers_running || 0 }}</span>
        <span class="tag-chip">容器 {{ info.containers_total || 0 }}</span>
        <span class="tag-chip">镜像 {{ info.images || 0 }}</span>
        <span class="tag-chip">网络 {{ info.networks || 0 }}</span>
        <span class="tag-chip">卷 {{ info.volumes || 0 }}</span>
      </div>
    </div>

    <div class="tabs" style="margin-top:16px;">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
    </div>

    <div v-if="loading" class="loading" style="margin-top:16px;"><div class="spinner"></div></div>

    <div v-else-if="tab === 'containers'" class="section" style="margin-top:16px;">
      <div class="section-title">容器列表 ({{ containers.length }})</div>
      <div v-if="!containers.length" class="hint" style="margin-top:8px;">暂无容器</div>
      <div v-else>
        <div v-for="c in containers" :key="c.id" class="result-item" style="cursor:default;margin-bottom:10px;" @click.stop>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="name" style="font-size:14px;">{{ c.name }}</span>
                <span class="tag-chip" :class="stateClass(c)">{{ stateLabel(c) }}</span>
                <span class="tag-chip">{{ c.image }}</span>
                <span v-if="c.ports && c.ports.length" class="tag-chip">端口: {{ c.ports.join(' ') }}</span>
              </div>
              <div class="meta" style="font-size:12px;margin-top:4px;">{{ c.id }} · 创建于 {{ c.created }}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button v-if="!isRunning(c)" class="btn btn-sm" @click="act(api.dkStart, c.id)">启动</button>
              <button v-else class="btn btn-sm" @click="act(api.dkStop, c.id)">停止</button>
              <button class="btn btn-sm" @click="act(api.dkRestart, c.id)">重启</button>
              <button class="btn btn-sm" @click="openLogs(c)">日志</button>
              <button class="btn btn-sm btn-danger" @click="removeContainer(c)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'images'" class="section" style="margin-top:16px;">
      <div class="section-title">镜像列表 ({{ images.length }})</div>
      <div class="search-bar" style="align-items:stretch;margin-bottom:12px;">
        <input v-model="pullName" class="input" style="flex:1;font-family:var(--font-mono);" placeholder="如 alpine / nginx:latest"
          @keyup.enter="pull" />
        <button class="btn btn-primary" :disabled="pulling" @click="pull">{{ pulling ? '拉取中...' : '拉取镜像' }}</button>
      </div>
      <div v-if="!images.length" class="hint" style="margin-top:8px;">暂无镜像</div>
      <div v-else>
        <div v-for="img in images" :key="img.id" class="result-item" style="cursor:default;margin-bottom:8px;" @click.stop>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="name" style="font-size:14px;">{{ (img.tags && img.tags[0]) || img.repo + ':' + img.tag || '<none>' }}</span>
                <span class="tag-chip">{{ fmtSize(img.size) }}</span>
              </div>
              <div class="meta" style="font-size:12px;margin-top:4px;">{{ img.id }} · {{ img.created }}</div>
              <div v-if="img.tags && img.tags.length > 1" class="meta" style="font-size:11px;margin-top:2px;">{{ img.tags.slice(1).join(' · ') }}</div>
            </div>
            <div style="flex-shrink:0;">
              <button class="btn btn-sm btn-danger" @click="removeImage(img)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'networks'" class="section" style="margin-top:16px;">
      <div class="section-title">网络</div>
      <div v-if="!extra.length" class="hint" style="margin-top:8px;">暂无网络</div>
      <div v-else>
        <div v-for="n in extra" :key="n.id" class="result-item" style="cursor:default;margin-bottom:8px;" @click.stop>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="name" style="font-size:14px;">{{ n.name }}</span>
            <span class="tag-chip">{{ n.driver }}</span>
            <span class="meta" style="font-size:11px;">{{ n.id }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'volumes'" class="section" style="margin-top:16px;">
      <div class="section-title">数据卷</div>
      <div v-if="!extra.length" class="hint" style="margin-top:8px;">暂无数据卷</div>
      <div v-else>
        <div v-for="v in extra" :key="v.name" class="result-item" style="cursor:default;margin-bottom:8px;" @click.stop>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="name" style="font-size:14px;">{{ v.name }}</span>
            <span class="tag-chip">{{ v.driver }}</span>
            <span class="meta" style="font-size:11px;">{{ v.mountpoint }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="logShow" class="section" style="margin-top:16px;">
      <div class="section-title">容器日志 · {{ logName }}</div>
      <div v-if="logLoading" class="loading" style="margin-top:8px;"><div class="spinner"></div></div>
      <textarea class="input" style="width:100%;min-height:220px;font-family:var(--font-mono);font-size:12px;" readonly
        :value="logText"></textarea>
      <div style="margin-top:8px;">
        <button class="btn btn-sm btn-ghost" @click="logShow = false">关闭</button>
      </div>
    </div>
  </div>
</template>
