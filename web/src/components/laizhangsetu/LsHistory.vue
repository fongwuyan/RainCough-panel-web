<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'
import { usePreview } from '../../stores/preview'

const preview = usePreview()
const items = ref(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await api.lsHistory()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function clear() {
  if (!window.confirm('确定清空历史记录吗？')) return
  await api.lsClearHistory()
  load()
}

function openImage(src) {
  preview.open([src])
}

onMounted(load)
</script>

<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span class="status-line">最近获取的图片</span>
      <button class="btn btn-danger btn-sm" @click="clear">清空历史</button>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div>加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="!items || !items.length" class="empty">暂无历史记录</div>

    <div v-else class="card-grid">
      <div v-for="(item, i) in items" :key="i" class="card" @click="openImage(item.url)">
        <div class="card-cover">
          <img :src="item.url" loading="lazy" />
          <span v-if="item.r18" class="badge-tag">R18</span>
        </div>
        <div class="card-body">
          <div class="card-title">{{ item.title || '无标题' }}</div>
          <div class="card-meta">{{ item.author || '未知画师' }} · {{ item.time || '' }}</div>
          <div v-if="item.tags && item.tags.length" class="card-tags">
            <span v-for="t in item.tags.slice(0, 5)" :key="t" class="tag-chip tag-chip-sm">{{ t }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
