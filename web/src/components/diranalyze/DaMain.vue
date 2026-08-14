<script setup>
import { ref } from 'vue'
import DaStats from './DaStats.vue'
import DaDuplicate from './DaDuplicate.vue'

const tab = ref('stats')
const tabs = [
  { key: 'stats', label: '分类统计' },
  { key: 'duplicate', label: '重复检测' },
]
</script>

<template>
  <div>
    <h1>目录分析</h1>
    <div class="subtitle">分类统计与重复文件检测（上传文件或压缩包）</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <DaStats v-if="tab === 'stats'" />
    <DaDuplicate v-else />
  </div>
</template>
