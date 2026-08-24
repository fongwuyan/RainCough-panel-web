<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlugins } from '../stores/plugins'
import { useUi } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const { plugins, load } = usePlugins()
const { installOpen } = useUi()

onMounted(load)

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
