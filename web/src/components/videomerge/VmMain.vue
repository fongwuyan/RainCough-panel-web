<script setup>
import { ref } from 'vue'
import VmMerge from './VmMerge.vue'
import VmInfoExtract from './VmInfoExtract.vue'

const tab = ref('merge')
const tabs = [
  { key: 'merge', label: '融合' },
  { key: 'info', label: '信息 / 提取' },
]
</script>

<template>
  <div>
    <h1>视频融合</h1>
    <div class="subtitle">将压缩包嵌入视频尾部 (YLVFUSN1)，ZIP 可被 7z 直接解出</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <VmMerge v-if="tab === 'merge'" />
    <VmInfoExtract v-else />
  </div>
</template>
