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
  if (name === 'envpkg') return route.name === 'envpkg'
  if (name === 'store') return route.name === 'store'
  return route.name === 'plugin' && route.params.name === name
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2>插件</h2>
    </div>
    <nav class="plugin-list">
      <div class="plugin-item" :class="{ active: isActive('workspace') }" @click="go('/')">
        <div class="info">
          <div class="label">工作台</div>
          <div class="desc">插件概览与状态</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('filemanager') }" @click="go('/plugin/filemanager')">
        <div class="info">
          <div class="label">文件管理</div>
          <div class="desc">浏览服务器文件系统</div>
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
          <div class="desc">聚合浏览图片与视频</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('logs') }" @click="go('/logs')">
        <div class="info">
          <div class="label">系统日志</div>
          <div class="desc">查看运行日志</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('processes') }" @click="go('/processes')">
        <div class="info">
          <div class="label">进程管理</div>
          <div class="desc">进程列表与结束</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('scheduler') }" @click="go('/scheduler')">
        <div class="info">
          <div class="label">定时任务</div>
          <div class="desc">生图/抓取/清理调度</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('tasks') }" @click="go('/tasks')">
        <div class="info">
          <div class="label">任务队列</div>
          <div class="desc">下载/安装/生成进度</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('store') }" @click="go('/store')">
        <div class="info">
          <div class="label">插件市场</div>
          <div class="desc">拉取安装/更新第三方插件</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('envpkg') }" @click="go('/envpkg')">
        <div class="info">
          <div class="label">环境包管理</div>
          <div class="desc">PHP/JDK/Node/Maven 运行时</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('settings') }" @click="go('/settings')">
        <div class="info">
          <div class="label">设置</div>
          <div class="desc">界面主题与偏好</div>
        </div>
      </div>
      <div class="plugin-item" :class="{ active: isActive('docs') }" @click="go('/docs')">
        <div class="info">
          <div class="label">插件开发文档</div>
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
          @click="go(`/plugin/${p.name}`)"
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
      <span class="version">v1.0</span>
    </div>
  </aside>
</template>
