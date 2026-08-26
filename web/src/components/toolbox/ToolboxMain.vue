<script setup>
import { ref } from 'vue'
import OcrPanel from './OcrPanel.vue'
import QrPanel from './QrPanel.vue'
import ImagePanel from './ImagePanel.vue'
import MediaPanel from './MediaPanel.vue'
import NetPanel from './NetPanel.vue'
import TextPanel from './TextPanel.vue'

const tab = ref('ocr')
const tabs = [
  { key: 'ocr', label: 'OCR识别' },
  { key: 'qr', label: '二维码' },
  { key: 'image', label: '图片' },
  { key: 'media', label: '音视频' },
  { key: 'net', label: '网络' },
  { key: 'text', label: '文本' },
]
</script>

<template>
  <div>
    <h1>全能工具箱</h1>
    <div class="subtitle">OCR 文字识别、二维码、图片/音视频处理、RSS 聚合、网页搜索、文本工具</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <OcrPanel v-if="tab === 'ocr'" />
    <QrPanel v-else-if="tab === 'qr'" />
    <ImagePanel v-else-if="tab === 'image'" />
    <MediaPanel v-else-if="tab === 'media'" />
    <NetPanel v-else-if="tab === 'net'" />
    <TextPanel v-else />
  </div>
</template>
