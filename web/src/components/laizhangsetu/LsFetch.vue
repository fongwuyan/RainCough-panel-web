<script setup>
import { ref } from 'vue'
import { api } from '../../api'
import { useLaizhangsetu } from '../../stores/laizhangsetu'
import { usePreview } from '../../stores/preview'

const { tags } = useLaizhangsetu()
const preview = usePreview()

const input = ref('')
const loading = ref(false)
const result = ref(null)
const error = ref('')

function addTag() {
  const v = input.value.trim()
  if (v && !tags.value.includes(v)) tags.value.push(v)
  input.value = ''
}

function onKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); addTag() }
  if (e.key === 'Backspace' && !input.value && tags.value.length) tags.value.pop()
}

function removeTag(i) { tags.value.splice(i, 1) }

async function doFetch() {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await api.lsFetch([...tags.value])
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openPreview() {
  if (result.value && result.value.url) preview.open([result.value.url])
}

function addTagFromDisplay(t) {
  if (!tags.value.includes(t)) tags.value.push(t)
}
</script>

<template>
  <div>
    <div class="search-bar" style="align-items:stretch;">
      <div class="input" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px;flex:1;cursor:text;" @click="$refs.tagInput.focus()">
        <span v-for="(t, i) in tags" :key="i" class="tag-chip">
          {{ t }}
          <span style="cursor:pointer;color:var(--text-muted);margin-left:4px;" @click="removeTag(i)">删</span>
        </span>
        <input
          ref="tagInput"
          v-model="input"
          class="input"
          style="flex:1;min-width:140px;border:none;box-shadow:none;padding:4px 6px;background:transparent;"
          placeholder="输入标签，回车添加"
          @keydown="onKeydown"
        />
      </div>
      <button class="btn btn-primary" :disabled="loading" @click="doFetch">{{ loading ? '获取中...' : '来一张' }}</button>
    </div>

    <div class="section" v-if="loading">
      <div class="loading"><div class="spinner"></div>加载中...</div>
    </div>

    <div v-else-if="error" class="section">
      <div class="error">{{ error }}</div>
    </div>

    <div v-else-if="result" class="section" style="display:flex;flex-direction:column;align-items:center;">
      <img
        :src="result.url"
        style="max-width:100%;max-height:70vh;object-fit:contain;cursor:zoom-in;"
        @click="openPreview"
      />
      <div v-if="result.is_blurred" class="badge-err" style="position:static;margin-top:10px;">触发模糊效果</div>

      <div v-if="result.show_info" class="mono-block" style="margin-top:14px;text-align:center;line-height:1.9;">
        <div><b>标题</b>: {{ result.title }}</div>
        <div><b>画师</b>: {{ result.author }} (UID: {{ result.uid }})</div>
        <div><b>PID</b>: {{ result.pid }} | <b>尺寸</b>: {{ result.width }}×{{ result.height }}</div>
        <div v-if="result.tags && result.tags.length">
          <b>标签</b>:
          <span
            v-for="t in result.tags"
            :key="t"
            class="tag-chip clickable"
            @click="addTagFromDisplay(t)"
          >{{ t }}</span>
        </div>
        <div v-if="result.r18"><b>R18</b>: <span class="fail">是</span></div>
      </div>

      <div style="margin-top:12px;">
        <a class="btn btn-ghost" :href="result.original_url" target="_blank" rel="noopener">查看原图</a>
      </div>
    </div>

    <div v-else class="section">
      <div class="empty">输入标签，点击"来一张"</div>
    </div>
  </div>
</template>
