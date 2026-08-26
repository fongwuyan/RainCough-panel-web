<script setup>
import { ref } from 'vue'
import { api } from '../../api'

// 互转
const cFile = ref(null)
const cFmt = ref('7z')
const cLoading = ref(false)
const cError = ref('')
const cResult = ref(null)

// 对比
const aFile = ref(null)
const bFile = ref(null)
const cmpLoading = ref(false)
const cmpError = ref('')
const cmpResult = ref(null)

const FORMATS = ['7z', 'zip', 'tar']

function onCFile(e) { const f = e.target.files[0]; if (f) { cFile.value = f; cResult.value = null; cError.value = '' } }
function onA(e) { const f = e.target.files[0]; if (f) { aFile.value = f; cmpResult.value = null; cmpError.value = '' } }
function onB(e) { const f = e.target.files[0]; if (f) { bFile.value = f; cmpResult.value = null; cmpError.value = '' } }

async function doConvert() {
  if (!cFile.value) { cError.value = '请选择压缩包'; return }
  cLoading.value = true; cError.value = ''; cResult.value = null
  try { cResult.value = await api.dcConvert(cFile.value, cFmt.value) }
  catch (e) { cError.value = e.message }
  finally { cLoading.value = false }
}

async function doCompare() {
  if (!aFile.value || !bFile.value) { cmpError.value = '请选择两个压缩包'; return }
  cmpLoading.value = true; cmpError.value = ''; cmpResult.value = null
  try { cmpResult.value = await api.dcCompare(aFile.value, bFile.value) }
  catch (e) { cmpError.value = e.message }
  finally { cmpLoading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">压缩包格式互转</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" class="input" style="flex:1;" @change="onCFile" />
      <select v-model="cFmt" class="input" style="width:auto;">
        <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
      </select>
      <button class="btn btn-primary" :disabled="cLoading || !cFile" @click="doConvert">
        {{ cLoading ? '转换中...' : '转换' }}
      </button>
    </div>
    <div v-if="cError" class="error" style="margin-top:10px;">{{ cError }}</div>
    <div v-if="cResult" style="margin-top:10px;">
      <a class="btn btn-ghost" :href="cResult.download">下载转换结果</a>
    </div>
  </div>

  <div class="section">
    <div class="section-title">压缩包对比</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" class="input" style="flex:1;" @change="onA" placeholder="压缩包 A" />
      <input type="file" class="input" style="flex:1;" @change="onB" placeholder="压缩包 B" />
      <button class="btn btn-primary" :disabled="cmpLoading || !aFile || !bFile" @click="doCompare">
        {{ cmpLoading ? '对比中...' : '对比' }}
      </button>
    </div>
    <div v-if="cmpError" class="error" style="margin-top:10px;">{{ cmpError }}</div>

    <div v-if="cmpResult" style="margin-top:12px;">
      <div class="ok">对比完成：{{ cmpResult.same }} 个文件相同</div>
      <div v-if="cmpResult.only_a.length" style="margin-top:8px;">
        <b>仅 {{ cmpResult.a }} 有 ({{ cmpResult.only_a.length }})：</b>
        <div class="mono-block" style="max-height:180px;overflow:auto;">
          <div v-for="n in cmpResult.only_a" :key="n">{{ n }}</div>
        </div>
      </div>
      <div v-if="cmpResult.only_b.length" style="margin-top:8px;">
        <b>仅 {{ cmpResult.b }} 有 ({{ cmpResult.only_b.length }})：</b>
        <div class="mono-block" style="max-height:180px;overflow:auto;">
          <div v-for="n in cmpResult.only_b" :key="n">{{ n }}</div>
        </div>
      </div>
      <div v-if="cmpResult.diff.length" style="margin-top:8px;">
        <b>大小不同 ({{ cmpResult.diff.length }})：</b>
        <div class="mono-block" style="max-height:180px;overflow:auto;">
          <div v-for="n in cmpResult.diff" :key="n">{{ n }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
