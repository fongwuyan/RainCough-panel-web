<script setup>
import { ref } from 'vue'
import MtImage from './MtImage.vue'
import MtPdf from './MtPdf.vue'
import MtMedia from './MtMedia.vue'
import MtInfo from './MtInfo.vue'

const tab = ref('image')
const tabs = [
  { key: 'image', label: '图片处理' },
  { key: 'pdf', label: 'PDF 工具' },
  { key: 'media', label: '音视频' },
  { key: 'info', label: '文件信息' },
]
</script>

<template>
  <div>
    <h1>媒体工具</h1>
    <div class="subtitle">图片处理 (ImageMagick)、PDF 合并/拆分/压缩、音视频转换 (ffmpeg)</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <MtImage v-if="tab === 'image'" />
    <MtPdf v-else-if="tab === 'pdf'" />
    <MtMedia v-else-if="tab === 'media'" />
    <MtInfo v-else />
  </div>
</template>
