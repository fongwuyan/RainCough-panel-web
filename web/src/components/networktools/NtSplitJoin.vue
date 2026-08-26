<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const mode = ref('split')
const splitFiles = ref([])
const chunkMB = ref(100)
const joinFiles = ref([])
const joinName = ref('joined')
const loading = ref(false)
const error = ref('')
const result = ref(null)

function onSplit(e) {
  splitFiles.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}
function onJoin(e) {
  joinFiles.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doRun() {
  loading.value = true; error.value = ''; result.value = null
  try {
    if (mode.value === 'split') {
      if (!splitFiles.value.length) throw new Error('请选择要拆分的文件')
      result.value = await api.ntSplit(splitFiles.value[0], chunkMB.value)
    } else {
      if (!joinFiles.value.length) throw new Error('请选择分片文件')
      result.value = await api.ntJoin(joinFiles.value, joinName.value)
    }
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">文件拆分 / 合并</div>
    <div class="tabs">
      <button class="tab" :class="{ active: mode === 'split' }" @click="mode = 'split'">拆分</button>
      <button class="tab" :class="{ active: mode === 'join' }" @click="mode = 'join'">合并</button>
    </div>

    <template v-if="mode === 'split'">
      <div class="hint" style="margin-top:10px;">将文件按指定大小拆分为 .part001/.part002... 分片（自动打包下载）</div>
      <div class="search-bar" style="align-items:stretch;margin-top:8px;">
        <input type="file" class="input" style="flex:1;" @change="onSplit" />
        <input v-model.number="chunkMB" class="input" style="width:110px;" type="number" placeholder="分片 MB" />
      </div>
    </template>
    <template v-else>
      <div class="hint" style="margin-top:10px;">按文件名排序合并分片为完整文件</div>
      <div class="search-bar" style="align-items:stretch;margin-top:8px;">
        <input type="file" multiple class="input" style="flex:1;" @change="onJoin" />
        <input v-model="joinName" class="input" style="width:150px;" placeholder="输出文件名" />
      </div>
    </template>

    <button class="btn btn-primary" style="margin-top:10px;" :disabled="loading" @click="doRun">
      {{ loading ? '处理中...' : (mode === 'split' ? '拆分' : '合并') }}
    </button>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 处理中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <template v-if="mode === 'split'"><div class="ok">拆分为 {{ result.parts }} 个分片</div></template>
      <template v-else><div class="ok">合并 {{ result.files }} 个分片</div></template>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="result.download">下载结果</a></div>
    </div>
  </div>
</template>
