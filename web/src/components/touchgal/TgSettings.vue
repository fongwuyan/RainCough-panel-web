<script setup>
import { ref } from 'vue'

const LIMIT_KEY = 'touchgal_limit'
const NSFW_KEY = 'touchgal_nsfw'

const limit = ref(localStorage.getItem(LIMIT_KEY) || '15')
const nsfw = ref(localStorage.getItem(NSFW_KEY) === 'true')
const saved = ref('')

function save() {
  localStorage.setItem(LIMIT_KEY, limit.value)
  localStorage.setItem(NSFW_KEY, nsfw.value)
  saved.value = '设置已保存'
  setTimeout(() => { saved.value = '' }, 2000)
}
</script>

<template>
  <div class="section" style="max-width:520px;">
    <div class="section-title">设置</div>
    <div class="settings-group">
      <div class="settings-item">
        <label>搜索结果数量 (1-99)</label>
        <input v-model.number="limit" class="input" type="number" min="1" max="99" style="width:70px;text-align:center;" />
      </div>
      <div class="settings-item">
        <label>显示敏感内容 (NSFW)</label>
        <label class="switch">
          <input v-model="nsfw" type="checkbox" />
          <span class="slider"></span>
        </label>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
      <button class="btn btn-primary" @click="save">保存设置</button>
      <span v-if="saved" class="status-line ok">{{ saved }}</span>
    </div>
  </div>
</template>
