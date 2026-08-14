<script setup>
import { ref } from 'vue'
import DocConvert from './DocConvert.vue'

const tab = ref('convert')
const tabs = [
  { key: 'convert', label: '文档转换' },
]
</script>

<template>
  <div>
    <h1>文档转换</h1>
    <div class="subtitle">基于 Pandoc 的文档格式互转 (Markdown/DOCX/HTML/EPUB 等)</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <DocConvert v-if="tab === 'convert'" />
  </div>
</template>
