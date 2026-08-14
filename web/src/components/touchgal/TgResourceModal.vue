<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const props = defineProps({ patchId: { type: String, required: true } })
const emit = defineEmits(['close'])

const loading = ref(true)
const error = ref('')
const items = ref([])

onMounted(async () => {
  try {
    items.value = await api.tgResource(props.patchId)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

function esc(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', esc))
function cleanup() { window.removeEventListener('keydown', esc) }
</script>

<template>
  <div class="overlay" @click.self="emit('close')" @mounted="cleanup">
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h2>下载资源</h2>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">关闭</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
        <div v-if="loading" class="loading"><div class="spinner"></div>获取下载资源中...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else-if="!items.length" class="error">未找到ID为 {{ patchId }} 的下载资源</div>
        <template v-else>
          <p class="status-line" style="margin-bottom:12px;">游戏ID: {{ patchId }}</p>
          <div v-for="(r, i) in items" :key="i" class="result-item" style="cursor:default;">
            <div class="name">{{ i + 1 }}. {{ r.name }}</div>
            <div class="meta">{{ r.platform }} | {{ r.size }} | {{ r.language }}</div>
            <div class="note" style="color:var(--text);">{{ r.content }}</div>
            <div class="note">提取码: {{ r.code }} | 解压码: {{ r.password }}</div>
            <div v-if="r.note && r.note !== '无备注'" class="note">备注: {{ r.note }}</div>
          </div>
          <div class="status-line" style="text-align:center;margin-top:10px;">数据来源: Touchgal API</div>
        </template>
      </div>
    </div>
  </div>
</template>
