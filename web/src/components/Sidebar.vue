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
  { key: 'workspace', label: '工作台', path: '/', desc: '概览与状态', icon: 'WD' },
  { key: 'fm', label: '文件管理', path: '/fm', desc: '文件系统', icon: 'FM' },
  { key: 'terminal', label: '终端', path: '/terminal', desc: 'Shell', icon: 'TM' },
  { key: 'media', label: '媒体中心', path: '/media', desc: '图片视频', icon: 'MD' },
  { key: 'tasks', label: '任务队列', path: '/tasks', desc: '下载安装', icon: 'TQ' },
  { key: 'store', label: '插件市场', path: '/store', desc: '安装更新', icon: 'MK' },
  { key: 'envpkg', label: '环境包', path: '/envpkg', desc: '运行时', icon: 'EN' },
  { key: 'settings', label: '设置', path: '/settings', desc: '偏好', icon: 'SG' },
  { key: 'docs', label: '开发文档', path: '/docs', desc: '插件指南', icon: 'DC' },
]
// 「系统」分组: 系统中心20个子功能拆分为侧边栏直达项; 能融合的已融合
// (系统日志/进程管理 与独立页面 /logs /processes 合一; 服务健康/接口总览/定时任务 并入组内)
const sysOpen = ref(true)
const SYS_GROUPS = [
  { title: '监控与诊断', items: [
    { label: '健康检查', path: '/sysfunc/health', desc: '面板自检与重启', icon: 'HI' },
    { label: '硬件信息', path: '/sysfunc/hw', desc: 'CPU/内存/主板/温度', icon: 'HW' },
    { label: '事件时间线', path: '/sysfunc/events', desc: '系统操作留痕', icon: 'EV' },
    { label: '接口监控', path: '/sysfunc/api', desc: '路由与请求流水', icon: 'IM' },
    { label: '接口总览', path: '/ifaces', desc: '服务总线接口目录', icon: 'IF' },
    { label: '启动历史', path: '/sysfunc/boot', desc: '开机/重启记录', icon: 'BT' },
  ]},
  { title: '服务与系统', items: [
    { label: '服务管理', path: '/sysfunc/svc', desc: 'systemd 启停', icon: 'SV' },
    { label: '服务健康', path: '/plughealth', desc: '插件与服务健康诊断', icon: 'HC' },
    { label: '系统更新', path: '/sysfunc/up', desc: 'apt 升级', icon: 'UP' },
    { label: '内核管理', path: '/sysfunc/kern', desc: '内核包', icon: 'KN' },
    { label: '时间/NTP', path: '/sysfunc/tz', desc: '时区同步', icon: 'TZ' },
    { label: '用户/密钥', path: '/sysfunc/usr', desc: '用户与 SSH 密钥', icon: 'US' },
    { label: '关机/重启', path: '/sysfunc/pwr', desc: '电源计划', icon: 'PW' },
  ]},
  { title: '存储与数据', items: [
    { label: '磁盘用量', path: '/sysfunc/disk', desc: 'df / lsblk', icon: 'DS' },
    { label: '快照', path: '/sysfunc/snap', desc: '只读快照', icon: 'SN' },
    { label: '存储清理', path: '/sysfunc/clean', desc: '缓存与占用 Top', icon: 'CL' },
    { label: '系统备份', path: '/sysfunc/backup', desc: '备份与还原', icon: 'BK' },
    { label: '日志保留', path: '/sysfunc/lr', desc: 'logrotate 配置', icon: 'LR' },
  ]},
  { title: '日志 · 进程 · 计划', items: [
    { label: '系统日志', path: '/logs', desc: 'journal/面板日志(融合)', icon: 'LG' },
    { label: '进程管理', path: '/processes', desc: '进程列表(融合)', icon: 'PS' },
    { label: 'Crontab', path: '/sysfunc/cron', desc: '系统 crontab 文本', icon: 'CR' },
    { label: '定时任务', path: '/scheduler', desc: '调度器编排', icon: 'SC' },
  ]},
]
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
  for (const g of SYS_GROUPS) for (const p of g.items) if ((p.label + p.desc).toLowerCase().includes(q)) out.push({ label: '系统 · ' + p.label, desc: p.desc, path: p.path })
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
  if (name === 'plughealth') return route.name === 'plughealth'
  if (name === 'ifaces') return route.name === 'ifaces'
  if (name === 'settings') return route.name === 'settings'
  if (name === 'docs') return route.name === 'docs'
  if (name === 'fm') return route.name === 'fm'
  if (name === 'filemanager') return route.name === 'plugin' && route.params.name === 'filemanager'
  if (name === 'terminal') return route.name === 'terminal'
  if (name === 'logs') return route.name === 'logs'
  if (name === 'processes') return route.name === 'processes'
  if (name === 'media') return route.name === 'media'
  if (name === 'scheduler') return route.name === 'scheduler'
  if (name === 'tasks') return route.name === 'tasks'
  if (name === 'sysfunc') return route.name === 'sysfunc' || route.name === 'sysfunc-sub'
  if (name === 'envpkg') return route.name === 'envpkg'
  if (name === 'store') return route.name === 'store'
  return route.name === 'plugin' && route.params.name === name
}
function activeByPath(p) { return route.path === p }
const sysActive = computed(() => SYS_GROUPS.some((g) => g.items.some((i) => activeByPath(i.path))))
const sysCount = computed(() => SYS_GROUPS.reduce((n, g) => n + g.items.length, 0))
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
      <div
        v-for="p in PAGES.slice(0, 3)"
        :key="p.key"
        class="plugin-item"
        :class="{ active: isActive(p.key) }"
        @click="go(p.path)"
      >
        <div class="nav-icon">{{ p.icon }}</div>
        <div class="info">
          <div class="label">{{ p.label }}</div>
          <div class="desc">{{ p.desc }}</div>
        </div>
      </div>

      <div
        class="sidebar-section-label sys-toggle"
        :class="{ 'sys-active': sysActive }"
        @click="sysOpen = !sysOpen"
      >
        <span class="sys-caret">{{ sysOpen ? '▾' : '▸' }}</span>
        <span>系统</span>
        <span class="sys-count">{{ sysCount }}</span>
      </div>
      <template v-if="sysOpen">
        <template v-for="g in SYS_GROUPS" :key="g.title">
          <div class="sidebar-sub-label">{{ g.title }}</div>
          <div
            v-for="p in g.items"
            :key="p.path"
            class="plugin-item sys-sub"
            :class="{ active: activeByPath(p.path) }"
            @click="go(p.path)"
          >
            <div class="nav-icon sys-ico">{{ p.icon }}</div>
            <div class="info">
              <div class="label">{{ p.label }}</div>
              <div class="desc">{{ p.desc }}</div>
            </div>
          </div>
        </template>
      </template>
      <div
        v-for="p in PAGES.slice(3)"
        :key="p.key"
        class="plugin-item"
        :class="{ active: isActive(p.key) }"
        @click="go(p.path)"
      >
        <div class="nav-icon">{{ p.icon }}</div>
        <div class="info">
          <div class="label">{{ p.label }}</div>
          <div class="desc">{{ p.desc }}</div>
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

<style scoped>
.sidebar-sub-label {
  padding: 6px 10px 3px 14px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.4px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  border-left: 2px solid var(--border);
  margin: 8px 0 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sys-toggle {
  cursor: pointer;
  user-select: none;
  border-left: 2px solid transparent;
  transition: color var(--transition), border-color var(--transition), background var(--transition);
}
.sys-toggle:hover { color: var(--text-muted); background: var(--surface-2); }
.sys-toggle.sys-active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: var(--accent-soft);
}
.sys-caret {
  display: inline-block;
  width: 14px;
  font-size: 10px;
  color: var(--text-faint);
}
.sys-toggle.sys-active .sys-caret { color: var(--accent); }
.sys-count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-faint);
}
.sys-toggle.sys-active .sys-count {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.sys-sub { padding-left: 4px; }
.sys-sub .sys-ico {
  width: 22px;
  height: 22px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0;
}
.sys-sub .label { font-size: 13px; }
.sys-sub .desc { font-size: 10px; }
.sys-sub.active { border-left: 2px solid var(--accent); }
</style>
