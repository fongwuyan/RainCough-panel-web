<script setup>
import { ref } from 'vue'
import NtDownload from './NtDownload.vue'
import NtSplitJoin from './NtSplitJoin.vue'
import NtRename from './NtRename.vue'
import NtDelete from './NtDelete.vue'

const tab = ref('download')
const tabs = [
  { key: 'download', label: '批量下载' },
  { key: 'split', label: '拆分 / 合并' },
  { key: 'rename', label: '批量重命名' },
  { key: 'delete', label: '安全删除' },
]
</script>

<template>
  <div>
    <h1>网络工具</h1>
    <div class="subtitle">URL 批量下载并打包、文件拆分/合并、批量重命名、安全删除</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <NtDownload v-if="tab === 'download'" />
    <NtSplitJoin v-else-if="tab === 'split'" />
    <NtRename v-else-if="tab === 'rename'" />
    <NtDelete v-else />
  </div>
</template>
