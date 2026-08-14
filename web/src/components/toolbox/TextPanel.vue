<script setup>
import { ref } from 'vue'
import { api } from '../../api'

// regex
const pattern = ref('')
const rxText = ref('')
const rxLoading = ref(false)
const rxError = ref('')
const rxResult = ref(null)

// replace
const repFiles = ref([])
const findText = ref('')
const replaceText = ref('')
const useRegex = ref(false)
const repLoading = ref(false)
const repError = ref('')
const repResult = ref(null)

// convert
const convertAction = ref('json2yaml')
const convertIn = ref('')
const convertOut = ref('')
const convertLoading = ref(false)
const convertError = ref('')

// stats
const statsFile = ref(null)
const statsLoading = ref(false)
const statsError = ref('')
const stats = ref(null)

async function doRegex() {
  if (!pattern.value) { rxError.value = '请输入正则表达式'; return }
  rxLoading.value = true; rxError.value = ''; rxResult.value = null
  try { rxResult.value = await api.tbRegex(pattern.value, rxText.value) }
  catch (e) { rxError.value = e.message }
  finally { rxLoading.value = false }
}

function onRepFiles(e) { repFiles.value = Array.from(e.target.files); repResult.value = null }

async function doReplace() {
  if (!repFiles.value.length) { repError.value = '请选择文件'; return }
  if (!findText.value) { repError.value = '请输入查找内容'; return }
  repLoading.value = true; repError.value = ''; repResult.value = null
  try {
    repResult.value = await api.tbTextReplace(repFiles.value, findText.value, replaceText.value, useRegex.value)
  } catch (e) { repError.value = e.message }
  finally { repLoading.value = false }
}

async function doConvert() {
  if (!convertIn.value.trim()) { convertError.value = '请输入内容'; return }
  convertLoading.value = true; convertError.value = ''; convertOut.value = ''
  try {
    const r = await api.tbConvert(convertAction.value, convertIn.value)
    convertOut.value = r.output
  } catch (e) { convertError.value = e.message }
  finally { convertLoading.value = false }
}

function onStatsFile(e) { statsFile.value = e.target.files[0] || null; stats.value = null }

async function doStats() {
  if (!statsFile.value) { statsError.value = '请选择文本文件'; return }
  statsLoading.value = true; statsError.value = ''; stats.value = null
  try { stats.value = await api.tbTextStats(statsFile.value) }
  catch (e) { statsError.value = e.message }
  finally { statsLoading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">正则表达式测试</div>
    <input v-model="pattern" class="input" style="width:100%;font-family:var(--font-mono);font-size:12px;" placeholder="正则表达式" />
    <textarea v-model="rxText" class="input" style="width:100%;min-height:80px;font-family:var(--font-mono);font-size:12px;margin-top:8px;"
      placeholder="测试文本"></textarea>
    <div style="margin-top:10px;">
      <button class="btn btn-primary" :disabled="rxLoading" @click="doRegex">测试</button>
    </div>
    <div v-if="rxError" class="error" style="margin-top:10px;">{{ rxError }}</div>
    <div v-if="rxLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="rxResult" style="margin-top:12px;">
      <div class="mono-block" style="margin-bottom:8px;">共 {{ rxResult.count }} 处匹配</div>
      <div v-for="(m, i) in rxResult.matches.slice(0, 50)" :key="i" class="mono-block" style="margin-bottom:6px;">
        <span class="tag-chip tag-chip-sm">[{{ m.start }}-{{ m.end }}]</span> {{ m.match }}
        <span v-if="m.groups && m.groups.length" class="hint"> 组: {{ m.groups.join(', ') }}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">批量文本替换</div>
    <input type="file" multiple class="input" style="width:100%;" @change="onRepFiles" />
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <input v-model="findText" class="input" style="flex:1;min-width:140px;font-family:var(--font-mono);font-size:12px;" placeholder="查找内容" />
      <input v-model="replaceText" class="input" style="flex:1;min-width:140px;font-family:var(--font-mono);font-size:12px;" placeholder="替换为(留空为删除)" />
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted);">
        <input v-model="useRegex" type="checkbox" /> 正则
      </label>
      <button class="btn btn-primary" :disabled="repLoading || !repFiles.length" @click="doReplace">
        {{ repLoading ? '替换中...' : '替换' }}
      </button>
    </div>
    <div v-if="repError" class="error" style="margin-top:10px;">{{ repError }}</div>
    <div v-if="repLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="repResult" style="margin-top:12px;">
      <div v-for="(r, i) in repResult.results" :key="i" class="mono-block" style="margin-bottom:6px;">
        <span :class="r.ok ? 'ok' : 'fail'">{{ r.ok ? (r.replaced ? '已替换' : '无变化') : '失败' }}</span> {{ r.name }}
        <span v-if="!r.ok" class="fail"> - {{ r.error }}</span>
      </div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="repResult.download">下载替换后文件 (ZIP)</a></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">JSON / YAML 转换</div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
      <select v-model="convertAction" class="input" style="width:auto;">
        <option value="json2yaml">JSON → YAML</option>
        <option value="yaml2json">YAML → JSON</option>
        <option value="jsonfmt">JSON 格式化</option>
        <option value="jsonmin">JSON 压缩</option>
      </select>
      <button class="btn btn-primary" :disabled="convertLoading" @click="doConvert">转换</button>
    </div>
    <textarea v-model="convertIn" class="input" style="width:100%;min-height:90px;font-family:var(--font-mono);font-size:12px;"
      placeholder="输入内容"></textarea>
    <div v-if="convertError" class="error" style="margin-top:8px;">{{ convertError }}</div>
    <textarea v-if="convertOut" class="input" style="width:100%;min-height:90px;font-family:var(--font-mono);font-size:12px;margin-top:8px;"
      :value="convertOut" readonly></textarea>
  </div>

  <div class="section">
    <div class="section-title">文本统计</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" accept=".txt,.md,.log,.json,.py,.html" class="input" style="flex:1;" @change="onStatsFile" />
      <button class="btn btn-primary" :disabled="statsLoading || !statsFile" @click="doStats">统计</button>
    </div>
    <div v-if="statsError" class="error" style="margin-top:10px;">{{ statsError }}</div>
    <div v-if="statsLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="stats" style="margin-top:12px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">
        <div class="mono-block">字符数: <b>{{ stats.chars }}</b></div>
        <div class="mono-block">去空白: <b>{{ stats.chars_no_space }}</b></div>
        <div class="mono-block">单词数: <b>{{ stats.words }}</b></div>
        <div class="mono-block">行数: <b>{{ stats.lines }}</b></div>
        <div class="mono-block">字节: <b>{{ stats.bytes }}</b></div>
      </div>
      <div class="section-title" style="margin-top:14px;">高频字符 TOP20</div>
      <div class="tag-chips" style="display:flex;flex-wrap:wrap;gap:6px;">
        <span v-for="(c, i) in stats.top_chars" :key="i" class="tag-chip">
          {{ c.char }} <span style="color:var(--text-muted);">{{ c.count }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
