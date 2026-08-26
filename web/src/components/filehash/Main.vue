<script setup>
import { ref } from 'vue'
import C0 from '../hash/HashMain.vue'
import C1 from '../diranalyze/DaMain.vue'
const tab = ref('t0')
const items = [
  { key: 't0', label: "文件哈希", comp: C0 },
      { key: 't1', label: "目录分析", comp: C1 },
]
</script>

<template>
  <div>
    <h1>文件校验</h1>
    <div class="tabs">
      <button v-for="it in items" :key="it.key" class="tab" :class="{ active: tab === it.key }" @click="tab = it.key">{{ it.label }}</button>
    </div>
    <component :is="(items.find((i) => i.key === tab) || items[0]).comp" />
  </div>
</template>
