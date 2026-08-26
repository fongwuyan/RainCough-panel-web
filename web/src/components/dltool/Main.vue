<script setup>
import { ref } from 'vue'
import C0 from '../networktools/NtMain.vue'
import C1 from '../docconvert/DocMain.vue'
const tab = ref('t0')
const items = [
  { key: 't0', label: "网络工具", comp: C0 },
      { key: 't1', label: "文档转换", comp: C1 },
]
</script>

<template>
  <div>
    <h1>下载工具</h1>
    <div class="tabs">
      <button v-for="it in items" :key="it.key" class="tab" :class="{ active: tab === it.key }" @click="tab = it.key">{{ it.label }}</button>
    </div>
    <component :is="(items.find((i) => i.key === tab) || items[0]).comp" />
  </div>
</template>
