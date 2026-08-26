<script setup>
import { ref } from 'vue'
import HashCalc from './HashCalc.vue'
import HashGenVerify from './HashGenVerify.vue'

const tab = ref('calc')
const tabs = [
  { key: 'calc', label: '计算哈希' },
  { key: 'gen', label: '校验文件' },
]
</script>

<template>
  <div>
    <h1>文件哈希</h1>
    <div class="subtitle">计算 MD5/SHA1/SHA256，生成与验证校验文件</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <HashCalc v-if="tab === 'calc'" />
    <HashGenVerify v-else />
  </div>
</template>
