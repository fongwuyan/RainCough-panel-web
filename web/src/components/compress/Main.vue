<script setup>
import { ref } from 'vue'
import C0 from '../decompress/DcMain.vue'
const tab = ref('t0')
const items = [
  { key: 't0', label: "解压压缩", comp: C0 },
]
</script>

<template>
  <div>
    <h1>解压压缩</h1>
    <div class="tabs">
      <button v-for="it in items" :key="it.key" class="tab" :class="{ active: tab === it.key }" @click="tab = it.key">{{ it.label }}</button>
    </div>
    <component :is="(items.find((i) => i.key === tab) || items[0]).comp" />
  </div>
</template>
