<script setup>
import { ref } from 'vue'
import C0 from '../toolbox/NetPanel.vue'
const tab = ref('t0')
const items = [
  { key: 't0', label: "网络检查", comp: C0 },
]
</script>

<template>
  <div>
    <h1>采集解析</h1>
    <div class="tabs">
      <button v-for="it in items" :key="it.key" class="tab" :class="{ active: tab === it.key }" @click="tab = it.key">{{ it.label }}</button>
    </div>
    <component :is="(items.find((i) => i.key === tab) || items[0]).comp" />
  </div>
</template>
