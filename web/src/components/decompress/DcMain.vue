<script setup>
import { ref } from 'vue'
import DcList from './DcList.vue'
import DcExtract from './DcExtract.vue'
import DcCompress from './DcCompress.vue'
import DcConvertCompare from './DcConvertCompare.vue'

const tab = ref('list')
const tabs = [
  { key: 'list', label: '压缩包列表' },
  { key: 'extract', label: '解压归类' },
  { key: 'compress', label: '批量压缩' },
  { key: 'convert', label: '互转 / 对比' },
]
</script>

<template>
  <div>
    <h1>解压压缩</h1>
    <div class="subtitle">压缩包列表、解压归类、批量压缩、格式互转、压缩包对比 (7z)</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <DcList v-if="tab === 'list'" />
    <DcExtract v-else-if="tab === 'extract'" />
    <DcCompress v-else-if="tab === 'compress'" />
    <DcConvertCompare v-else />
  </div>
</template>
