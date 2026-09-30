<script setup>
import { ref } from 'vue'
import { useUi } from '../stores/ui'
import StoreRepoSettings from './store/StoreRepoSettings.vue'
import StoreProject from './store/StoreProject.vue'

// 插件设置(已并入插件页)之外的全局配置都在这里:
// 外观 / 仓库配置(插件市场与面板仓库) / 面板更新
const { theme, setTheme } = useUi()

const activeCat = ref('appearance')

const navItems = [
  { key: 'appearance', label: '外观' },
  { key: 'repo', label: '仓库配置' },
  { key: 'project', label: '面板更新' },
]
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>设置</h1>
      <div class="subtitle">界面主题、仓库配置与面板更新</div>
    </div>

    <div class="page-body">
      <div class="settings-layout">
        <nav class="settings-nav">
          <button
            v-for="item in navItems"
            :key="item.key"
            class="nav-item"
            :class="{ active: activeCat === item.key }"
            @click="activeCat = item.key"
          >{{ item.label }}</button>
        </nav>

        <div class="settings-pane">
          <div v-if="activeCat === 'appearance'" class="section">
            <div class="section-title">外观</div>
            <div class="settings-item">
              <label>主题模式</label>
              <div class="control">
                <button class="btn" :class="theme === 'dark' ? 'btn-primary' : ''" @click="setTheme('dark')">深色</button>
                <button class="btn" :class="theme === 'light' ? 'btn-primary' : ''" @click="setTheme('light')">浅色</button>
              </div>
            </div>
          </div>

          <StoreRepoSettings v-else-if="activeCat === 'repo'" />
          <StoreProject v-else-if="activeCat === 'project'" />
        </div>
      </div>
    </div>
  </div>
</template>
