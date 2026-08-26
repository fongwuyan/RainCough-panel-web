<script setup>
// 环境包 — 干净重写, 对接 /api/envpkg(样式复刻旧 EnvPkgMain 布局)
import { ref, onMounted, onUnmounted } from 'vue'
import { request } from '../api/client'

const envs = ref([])
const recipes = ref([])
const loading = ref(false)
const error = ref('')
const installing = ref('')
const installMsg = ref('')
let timer = null

const RECIPE_LABELS = { node: 'Node.js', python: 'Python', go: 'Go', java: 'Java (OpenJDK)', php: 'PHP' }

async function loadEnvs() {
  loading.value = true
  try {
    const d = await request.get('/api/envpkg/envs')
    envs.value = d.envs || []
  } catch (e) { error.value = e.message }
  loading.value = false
}
async function loadRecipes() {
  try {
    const d = await request.get('/api/envpkg/recipes')
    recipes.value = d.recipes || []
  } catch (e) { /* 忽略 */ }
}
async function install(recipe, version) {
  const name = recipe.type + '-' + version
  if (!confirm('安装运行时 ' + name + ' ?(约几十 MB, 后台执行)')) return
  installing.value = name
  installMsg.value = ''
  try {
    await request.post('/api/envpkg/install', { type: recipe.type, version })
    installMsg.value = '已开始安装 ' + name + ', 请刷新查看'
    setTimeout(loadEnvs, 3000)
  } catch (e) { installMsg.value = '安装失败: ' + e.message }
  installing.value = ''
}
async function uninstall(env) {
  if (!confirm('卸载 ' + env.name + ' ?')) return
  try {
    await request.post('/api/envpkg/uninstall', { name: env.name })
    loadEnvs()
  } catch (e) { alert(e.message) }
}
function fmtSize(n) {
  if (!n) return '-'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return n.toFixed(1) + ' ' + u[i]
}

onMounted(() => { loadEnvs(); loadRecipes(); timer = setInterval(loadEnvs, 8000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="page">
    <div class="page-head hero">
      <div>
        <h1>环境包</h1>
        <p class="subtitle">运行时管理 · 已装 {{ envs.length }}</p>
      </div>
      <button class="btn" @click="loadEnvs">刷新</button>
    </div>

    <div class="page-body">
      <div v-if="installMsg" class="status-line" style="padding:8px 0;">{{ installMsg }}</div>

      <div class="section">
        <div class="section-title">已安装运行时</div>
        <div v-if="!envs.length" class="hint" style="padding:14px;">暂无已安装的运行时</div>
        <div class="result-item" v-for="e in envs" :key="e.name">
          <div style="display:flex;align-items:center;gap:12px;width:100%;">
            <div style="flex:1;">
              <div class="name">{{ e.name }}</div>
              <div class="meta">{{ RECIPE_LABELS[e.type] || e.type }} · bin: <span class="mono faint">{{ e.bin_path }}</span></div>
            </div>
            <span class="meta" style="flex-shrink:0;">{{ fmtSize(e.size) }}</span>
            <button class="btn btn-sm btn-danger" @click="uninstall(e)">卸载</button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">可用运行时</div>
        <div class="result-item" v-for="r in recipes" :key="r.type">
          <div style="display:flex;align-items:center;gap:12px;width:100%;">
            <div style="flex:1;">
              <div class="name">{{ RECIPE_LABELS[r.type] || r.type }}</div>
              <div class="meta">版本: <span class="mono">{{ (r.versions || []).join(' / ') }}</span></div>
            </div>
            <div style="display:flex;gap:6px;">
              <button v-for="v in (r.versions || []).slice(0, 3)" :key="v" class="btn btn-sm"
                :disabled="!!installing"
                @click="install(r, v)">{{ installing === r.type + '-' + v ? '安装中…' : '安装 ' + v }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
</style>