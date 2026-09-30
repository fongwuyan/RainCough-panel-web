<script setup>
import { ref, computed } from 'vue'
import { useUi } from '../stores/ui'

// 插件设置与面板更新已迁至「插件」页(/plugins), 设置页只保留外观
const { theme, setTheme } = useUi()

const activeCat = ref('appearance')

const navItems = computed(() => [{ key: 'appearance', label: '外观' }])
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>设置</h1>
      <div class="subtitle">界面主题</div>
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
        </div>
      </div>
    </div>
  </div>
</template>
