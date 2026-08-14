<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const text = ref('')
const size = ref(300)
const genLoading = ref(false)
const genError = ref('')
const qrUrl = ref('')

const decodeFile = ref(null)
const decLoading = ref(false)
const decError = ref('')
const decoded = ref([])

async function doGen() {
  if (!text.value.trim()) { genError.value = '请输入二维码内容'; return }
  genLoading.value = true; genError.value = ''; qrUrl.value = ''
  try {
    const r = await api.tbQrGen(text.value.trim(), size.value)
    qrUrl.value = r.url
  } catch (e) { genError.value = e.message }
  finally { genLoading.value = false }
}

function onDecodeFile(e) {
  decodeFile.value = e.target.files[0] || null
  decoded.value = []
  decError.value = ''
}

async function doDecode() {
  if (!decodeFile.value) { decError.value = '请选择图片'; return }
  decLoading.value = true; decError.value = ''; decoded.value = []
  try {
    const r = await api.tbQrDecode(decodeFile.value)
    decoded.value = r.results
    if (!r.results.length) decError.value = '未识别到二维码内容'
  } catch (e) { decError.value = e.message }
  finally { decLoading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">生成二维码</div>
    <div class="search-bar" style="align-items:stretch;">
      <input v-model="text" class="input" style="flex:1;" placeholder="输入文字或链接" @keyup.enter="doGen" />
      <input v-model.number="size" class="input" style="width:90px;" type="number" min="120" max="1024" placeholder="尺寸" />
      <button class="btn btn-primary" :disabled="genLoading" @click="doGen">
        {{ genLoading ? '生成中...' : '生成' }}
      </button>
    </div>
    <div v-if="genError" class="error" style="margin-top:10px;">{{ genError }}</div>
    <div v-if="qrUrl" style="margin-top:14px;text-align:center;">
      <img :src="qrUrl" style="max-width:280px;background:#fff;padding:8px;" />
      <div class="hint">{{ text }}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">解析二维码</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" accept="image/*" class="input" style="flex:1;" @change="onDecodeFile" />
      <button class="btn btn-primary" :disabled="decLoading || !decodeFile" @click="doDecode">
        {{ decLoading ? '解析中...' : '解析' }}
      </button>
    </div>
    <div v-if="decError" class="error" style="margin-top:10px;">{{ decError }}</div>
    <div v-if="decoded.length" style="margin-top:12px;">
      <div v-for="(r, i) in decoded" :key="i" class="mono-block" style="margin-bottom:8px;">
        <div style="word-break:break-all;">{{ r.data }}</div>
      </div>
    </div>
  </div>
</template>
