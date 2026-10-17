<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { api } from '../../api'
import { fmtSize, fmtTime } from './useFileManager'

const props = defineProps({ item: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])

const mode = ref('preview') // preview | edit
const text = ref('')
const loading = ref(false)
const err = ref('')
const tooBig = ref(false)
const saving = ref(false)
const dirty = ref(false)
const ta = ref(null)

const isText = computed(() => {
  const k = props.item && props.item.kind
  return k === 'text' || k === 'code'
})
const isImage = computed(() => props.item && props.item.kind === 'image')
const isVideo = computed(() => props.item && props.item.kind === 'video')
const isAudio = computed(() => props.item && props.item.kind === 'audio')
const isPdf = computed(() => {
  const n = (props.item && props.item.name) || ''
  return n.toLowerCase().endsWith('.pdf')
})
const srcUrl = computed(() => (props.item ? `/api/fm/preview?path=${encodeURIComponent(props.item.path)}` : ''))
const dlUrl = computed(() => (props.item ? api.fmDownload(props.item.path) : ''))

watch(
  () => props.item,
  async (it) => {
    mode.value = 'preview'
    text.value = ''
    err.value = ''
    dirty.value = false
    if (!it || !isText.value) return
    loading.value = true
    try {
      const d = await api.fmPreview(it.path)
      if (d && d.type === 'text') {
        text.value = d.content || ''
        tooBig.value = !!d.too_big
      } else {
        err.value = '该文件不支持文本预览'
      }
    } catch (e) {
      err.value = e.message || String(e)
    } finally {
      loading.value = false
    }
  }
)

async function save() {
  if (!props.item) return
  saving.value = true
  err.value = ''
  try {
    await api.fmSave(props.item.path, text.value, 'utf-8')
    dirty.value = false
    emit('saved')
  } catch (e) {
    err.value = e.message || String(e)
  } finally {
    saving.value = false
  }
}

function startEdit() {
  mode.value = 'edit'
  dirty.value = false
  nextTick(() => ta.value && ta.value.focus())
}

function onInput() {
  dirty.value = true
}

function close() {
  if (dirty.value && !confirm('有未保存的修改, 确定关闭?')) return
  emit('close')
}
</script>

<template>
  <div v-if="item" class="fm-drawer">
    <div class="fm-drawer-head">
      <div class="fm-drawer-title" :title="item.path">{{ item.name }}</div>
      <div class="fm-drawer-meta">
        <span>{{ fmtSize(item.size) }}</span>
        <span>{{ fmtTime(item.mtime) }}</span>
      </div>
      <div class="fm-drawer-actions">
        <button v-if="isText && mode === 'preview'" class="btn btn-sm" @click="startEdit">编辑</button>
        <button v-if="mode === 'edit'" class="btn btn-sm btn-primary" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
        <a class="btn btn-sm btn-ghost" :href="dlUrl" target="_blank">下载</a>
        <button class="btn btn-sm btn-ghost" @click="close">关闭</button>
      </div>
    </div>

    <div class="fm-drawer-body">
      <div v-if="err" class="error">{{ err }}</div>
      <div v-if="loading" class="hint">加载中…</div>

      <template v-else>
        <img v-if="isImage" :src="srcUrl" class="fm-pv-img" alt="" />
        <video v-else-if="isVideo" :src="srcUrl" class="fm-pv-media" controls />
        <audio v-else-if="isAudio" :src="srcUrl" class="fm-pv-audio" controls />
        <iframe v-else-if="isPdf" :src="srcUrl" class="fm-pv-pdf" title="pdf" />
        <textarea
          v-else-if="isText && mode === 'edit'"
          ref="ta"
          v-model="text"
          class="fm-editor"
          spellcheck="false"
          @input="onInput"
        ></textarea>
        <pre v-else-if="isText" class="fm-pv-text">{{ text }}<span v-if="tooBig" class="faint">\n\n…文件过大, 仅显示前 5MB</span></pre>
        <div v-else class="hint fm-pv-none">
          该类型不支持预览<br />
          <a :href="dlUrl" target="_blank" class="btn btn-sm" style="margin-top:12px">下载查看</a>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.fm-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(680px, 60vw);
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  z-index: 60;
}
.fm-drawer-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
.fm-drawer-title {
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 45%;
}
.fm-drawer-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}
.fm-drawer-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.fm-drawer-body {
  flex: 1;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.fm-pv-img,
.fm-pv-media,
.fm-pv-pdf {
  max-width: 100%;
  max-height: 100%;
  margin: auto;
  display: block;
  background: var(--surface-2);
}
.fm-pv-pdf {
  width: 100%;
  height: 100%;
  border: 0;
}
.fm-pv-audio {
  margin: auto;
  width: 100%;
}
.fm-pv-text {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
}
.fm-editor {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.65;
  padding: 10px;
  resize: none;
  outline: none;
}
.fm-editor:focus {
  border-color: var(--accent);
}
.fm-pv-none {
  margin: auto;
  text-align: center;
}
</style>
