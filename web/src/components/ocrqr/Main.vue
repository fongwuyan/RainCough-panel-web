<script setup>
import { ref } from 'vue'
import C0 from '../toolbox/OcrPanel.vue'
import C1 from '../toolbox/QrPanel.vue'
const tab = ref('t0')
const items = [
  { key: 't0', label: "OCR 识别", comp: C0 },
      { key: 't1', label: "二维码", comp: C1 },
]
</script>

<template>
  <div>
    <h1>识别二维码</h1>
    <div class="tabs">
      <button v-for="it in items" :key="it.key" class="tab" :class="{ active: tab === it.key }" @click="tab = it.key">{{ it.label }}</button>
    </div>
    <component :is="(items.find((i) => i.key === tab) || items[0]).comp" />
  </div>
</template>
