<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const files = ref([])
const passes = ref(3)
const loading = ref(false)
const error = ref('')
const result = ref(null)

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doDelete() {
  if (!files.value.length) { error.value = '请选择要删除的文件'; return }
  if (!window.confirm(`确定要安全删除这 ${files.value.length} 个文件吗？将覆写后删除，不可恢复！`)) return
  loading.value = true; error.value = ''; result.value = null
  try { result.value = await api.ntDelete(files.value, passes.value) }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">安全删除</div>
    <div class="hint" style="margin-bottom:8px;">对上传到服务器的文件副本进行随机覆写后删除（DoD 方式，默认 3 次），操作不可恢复</div>
    <input type="file" multiple class="input" @change="onFiles" />

    <div style="display:flex;gap:10px;align-items:center;margin-top:10px;">
      <label style="font-size:12px;color:var(--text-faint);">覆写次数</label>
      <input v-model.number="passes" class="input" style="width:100px;" type="number" min="1" max="35" />
      <button class="btn btn-danger" :disabled="loading || !files.length" @click="doDelete">
        {{ loading ? '删除中...' : '安全删除' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 覆写删除中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <div v-for="(r, i) in result.results" :key="i" class="mono-block" style="margin-bottom:6px;font-size:12px;">
        <span :class="r.deleted ? 'ok' : 'fail'">{{ r.deleted ? '✔ 已删除' : '✘ 失败' }}</span> {{ r.name }}
      </div>
    </div>
  </div>
</template>
