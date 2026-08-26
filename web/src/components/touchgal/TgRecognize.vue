<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const dragging = ref(false)
const previewUrl = ref('')
const loading = ref(false)
const result = ref(null)
const error = ref('')
const fileInput = ref(null)

async function handleFile(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    previewUrl.value = e.target.result
    result.value = null
    error.value = ''
    loading.value = true
    try {
      result.value = await api.tgRecognize(e.target.result)
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }
  reader.readAsDataURL(file)
}

function onDrop(e) {
  dragging.value = false
  if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
}

function onKey(e) {
  if (e.key === 'Escape' && previewUrl.value) previewUrl.value = ''
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function chars(data) {
  if (!data || !data.data || !data.data.length) return []
  return data.data[0].character || []
}
function hasResult(data) {
  return data && data.data && data.data.length > 0 && (data.data[0].character || []).length > 0
}
</script>

<template>
  <div>
    <div
      class="dropzone"
      :class="{ dragover: dragging }"
      @click="fileInput.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <p>点击上传或拖拽图片到此处</p>
      <p class="hint">支持 JPG / PNG / WebP</p>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="(e) => handleFile(e.target.files[0])" />
    </div>

    <div v-if="previewUrl" style="margin-top:16px;text-align:center;">
      <img :src="previewUrl" style="max-width:420px;max-height:320px;object-fit:contain;border:1px solid var(--border);" />
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div>正在识别中，请稍候...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-if="result">
      <div class="section" style="margin-top:16px;">
        <div class="section-title">图片识别结果</div>
        <div v-if="!hasResult(result.anime) && !hasResult(result.gal)" class="empty">未找到匹配结果</div>
        <template v-else>
          <div v-if="hasResult(result.anime)" style="margin-bottom:14px;">
            <h3 style="margin-bottom:8px;">动漫识别</h3>
            <div v-for="(c, i) in chars(result.anime).slice(0, 5)" :key="i" class="result-item" style="cursor:default;margin-bottom:6px;">
              {{ c.character || '未知角色' }} - 《{{ c.work || '未知作品' }}》
            </div>
            <div v-if="chars(result.anime).length > 5" class="hint">共 {{ chars(result.anime).length }} 个结果，显示前 5 项</div>
          </div>
          <div v-if="hasResult(result.gal)" style="margin-bottom:14px;">
            <h3 style="margin-bottom:8px;">Gal 识别</h3>
            <div v-for="(c, i) in chars(result.gal).slice(0, 5)" :key="i" class="result-item" style="cursor:default;margin-bottom:6px;">
              {{ c.character || '未知角色' }} - 《{{ c.work || '未知作品' }}》
            </div>
            <div v-if="chars(result.gal).length > 5" class="hint">共 {{ chars(result.gal).length }} 个结果，显示前 5 项</div>
          </div>
          <div class="status-line" style="text-align:center;">数据来源: AnimeTrace</div>
        </template>
      </div>
    </template>
  </div>
</template>
