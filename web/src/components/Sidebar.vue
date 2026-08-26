<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlugins } from '../stores/plugins'
import { useUi } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const { plugins, load } = usePlugins()
const { installOpen } = useUi()

onMounted(load)

const PAGES = [
  { key: 'ws', label: '工作台', path: '/', desc: '概览与状态' },
  { key: 'fm', label: '文件管理', path: '/plugin/filemanager', desc: '文件系统' },
  { key: 'term', label: '终端', path: '/terminal', desc: 'Shell' },
  { key: 'sysf', label: '系统中心', path: '/sysfunc', desc: '系统功能' },
  { key: 'media', label: '媒体中心', path: '/media', desc: '图片视频' },
  { key: 'store', label: '插件市场', path: '/store', desc: '安装更新' },
  { key: 'envpkg', label: '环境包', path: '/envpkg', desc: '运行时' },
  { key: 'tasks', label: '任务队列', path: '/tasks', desc: '下载安装' },
  { key: 'settings', label: '设置', path: '/settings', desc: '偏好' },
  { key: 'docs', label: '开发文档', path: '/docs', desc: '插件指南' },
]
const SYSTABS = ['日志','进程','服务','防火墙','硬件','更新','定时','磁盘','快照','用户','存储清理','关机重启','内核','时间','健康','事件','日志保留','系统备份','启动历史']
const searchQ = ref('')
const favs = ref(loadFavs())
function loadFavs() { try { return JSON.parse(localStorage.getItem('rc-favs') || '[]') } catch (e) { return [] } }
function saveFavs() { localStorage.setItem('rc-favs', JSON.stringify(favs.value)) }
function favKey(label, path) { return path }
const searchResults = computed(() => {
  const q = searchQ.value.trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const p of PAGES) if ((p.label + p.desc).toLowerCase().includes(q)) out.push({ label: p.label, desc: p.desc, path: p.path })
  for (const p of plugins.value) if ((p.label + ' ' + (p.description || '')).toLowerCase().includes(q)) out.push({ label: p.label, desc: p.description || '', path: '/plugin/' + p.name })
  for (const t of SYSTABS) if (t.toLowerCase().includes(q)) out.push({ label: '系统中心 · ' + t, desc: '系统功能子选项卡', path: '/sysfunc' })
  return out.slice(0, 10)
})
function pick(entry) { go(entry.path); searchQ.value = '' }
function toggleFav(entry) {
  const i = favs.value.findIndex((f) => f.path === entry.path)
  if (i >= 0) favs.value.splice(i, 1); else favs.value.push({ label: entry.label, path: entry.path })
  saveFavs()
}
function inFav(path) { return favs.value.some((f) => f.path === path) }


function go(path) { router.push(path) }

function isActive(name) {
  if (name === 'workspace') return route.path === '/'
  if (name === 'settings') return route.name === 'settings'
  if (name === 'docs') return route.name === 'docs'
  if (name === 'filemanager') return route.name === 'plugin' && route.params.name === 'filemanager'
  if (name === 'terminal') return route.name === 'terminal'
  if (name === 'logs') return route.name === 'logs'
  if (name === 'processes') return route.name === 'processes'
  if (name === 'media') return route.name === 'media'
  if (name === 'scheduler') return route.name === 'scheduler'
  if (name === 'tasks') return route.name === 'tasks'
  if (name === 'sysfunc') return route.name === 'sysfunc'
  if (name === 'envpkg') return route.name === 'envpkg'
  if (name === 'store') return route.name === 'store'
  return route.name === 'plugin' && route.params.name === name
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="brand-dot"></span>
      <h2>RainCough</h2>
    </div>
    <div style="padding:10px">
      <input v-model="searchQ" class="input" style="width:100%" placeholder="搜索: 页面/插件/功能…" @keydown.enter="searchResults.length && pick(searchResults[0])" />
      <div v-if="searchQ && searchResults.length" class="search-pop">
        <div v-for="r in searchResults" :key="r.path" class="search-item">
          <span style="flex:1;cursor:pointer" @click="pick(r)"><b>{{ r.label }}</b> <span class="faint" style="font-size:11px">{{ r.desc }}</span></span>
          <button class="btn btn-sm" @click="toggleFav(r)">{{ inFav(r.path) ? '★' : '☆' }}</button>
        </div>
      </div>
    </div>
    <div v-if="favs.length" style="padding:0 10px 6px">
      <div class="sidebar-section-label">收藏</div>
      <div v-for="f in favs" :key="f.path" class="plugin-item" @click="go(f.path)">
        <div class="info"><div class="label">{{ f.label }}</div></div>
        <button class="btn btn-sm btn-ghost" @click.stop="toggleFav(f)">★</button>
      </div>
    </div>
    <nav class="plugin-list">
      <div class="plugin-item" :class="{ active: isActive('workspace') }" @click="go('/')">
        <div class="info">
          <div class="label">工作台</div>
          <div class="desc">概览与状态</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('filemanager') }" @click="go('/plugin/filemanager')">
        <div class="info">
          <div class="label">文件管理</div>
          <div class="desc">服务器文件系统</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('terminal') }" @click="go('/terminal')">
        <div class="info">
          <div class="label">终端</div>
          <div class="desc">服务器 Shell</div>
        </div>
      </div>

      <div class="sidebar-section-label">系统</div>
      <div class="plugin-item" :class="{ active: isActive('media') }" @click="go('/media')">
        <div class="info">
          <div class="label">媒体中心</div>
          <div class="desc">图片与视频聚合</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('scheduler') }" @click="go('/scheduler')">
        <div class="info">
          <div class="label">定时任务</div>
          <div class="desc">调度器编排</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('sysfunc') }" @click="go('/sysfunc')">
        <div class="info">
          <div class="label">系统中心</div>
          <div class="desc">日志/进程/服务/硬件/更新等</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('tasks') }" @click="go('/tasks')">
        <div class="info">
          <div class="label">任务队列</div>
          <div class="desc">下载/安装/生成</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('store') }" @click="go('/store')">
        <div class="info">
          <div class="label">插件市场</div>
          <div class="desc">安装/更新/卸载</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('envpkg') }" @click="go('/envpkg')">
        <div class="info">
          <div class="label">环境包</div>
          <div class="desc">运行时管理</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('settings') }" @click="go('/settings')">
        <div class="info">
          <div class="label">设置</div>
          <div class="desc">主题与偏好</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('docs') }" @click="go('/docs')">
        <div class="info">
          <div class="label">开发文档</div>
          <div class="desc">插件开发指南</div>
        </div>
      </div>

      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">插件</div>
      <template v-if="plugins.length">
        <div
          v-for="p in plugins.filter((x) => x.name !== 'filemanager')"
          :key="p.name"
          class="plugin-item"
          :class="{ active: isActive(p.name) }"
          @click="go('/plugin/' + p.name)"
        >
          <div class="info">
            <div class="label">{{ p.label }}</div>
            <div class="desc">{{ p.description }}</div>
          </div>
        </div>
      </template>
      <div v-else class="hint" style="padding:16px 8px;">加载中...</div>
    </nav>
    <div class="sidebar-footer">
      <button class="btn btn-primary btn-block" @click="installOpen = true">安装插件</button>
      <span class="version">v1.0 · 仅局域网</span>
    </div>
  </aside>
</template>
