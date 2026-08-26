<script setup>
// 文件管理 — 目录浏览/上传/下载/编辑(简化版, 对接 /api/fm)
import { ref, onMounted } from 'vue'
import { request } from '../api/client'

const path = ref('/')
const items = ref([])
const loading = ref(false)
const error = ref('')
const editor = ref(null)   // {path, name, content}
const editorText = ref('')

async function load(p) {
  loading.value = true
  error.value = ''
  try {
    const d = await request.get('/api/fm/list?path=' + encodeURIComponent(p || '/'))
    path.value = d.path || p
    items.value = d.items || []
  } catch (e) { error.value = e.message }
  loading.value = false
}

function open(item) {
  if (item.is_dir) load(item.path)
  else view(item)
}

function goUp() {
  const parts = path.value.replace(/\/+$/, '').split('/')
  parts.pop()
  load(parts.join('/') || '/')
}

function breadcrumbs() {
  const parts = path.value.split('/').filter(Boolean)
  const out = []
  let acc = ''
  out.push({ name: '/', path: '/' })
  for (const p of parts) {
    acc += '/' + p
    out.push({ name: p, path: acc })
  }
  return out
}

async function view(item) {
  try {
    const d = await request.get('/api/fm/read?path=' + encodeURIComponent(item.path))
    editor.value = { path: item.path, name: item.name }
    editorText.value = d.content || ''
  } catch (e) { alert('读取失败: ' + e.message) }
}

async function save() {
  if (!editor.value) return
  try {
    await request.post('/api/fm/save', { path: editor.value.path, content: editorText.value })
    editor.value = null
    load(path.value)
  } catch (e) { alert('保存失败: ' + e.message) }
}

async function doDelete(item) {
  if (!confirm('删除 ' + item.name + ' ?')) return
  try {
    await request.post('/api/fm/delete', { path: item.path })
    load(path.value)
  } catch (e) { alert('删除失败: ' + e.message) }
}

async function mkdir() {
  const name = prompt('目录名:')
  if (!name) return
  try {
    await request.post('/api/fm/mkdir?path=' + encodeURIComponent(path.value + '/' + name))
    load(path.value)
  } catch (e) { alert(e.message) }
}

function fmtSize(n) {
  if (!n && n !== 0) return '-'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return n.toFixed(1) + ' ' + u[i]
}

onMounted(() => load('/'))
</script>

<template>
  <div class="page">
    <div class="page-head hero">
      <div>
        <h1>文件管理</h1>
        <p class="subtitle mono">{{ path }}</p>
      </div>
      <div class="toolbar">
        <button class="btn" @click="goUp">上级</button>
        <button class="btn" @click="mkdir">新建目录</button>
        <button class="btn btn-primary" @click="load(path)">刷新</button>
      </div>
    </div>

    <div class="breadcrumbs">
      <template v-for="(b, i) in breadcrumbs()" :key="i">
        <a v-if="i < breadcrumbs().length - 1" @click="load(b.path)">{{ b.name }}</a>
        <span v-else>{{ b.name }}</span>
        <span v-if="i < breadcrumbs().length - 1" class="sep">/</span>
      </template>
    </div>

    <div class="page-body">
      <div v-if="error" class="error-box">{{ error }}</div>
      <table class="table">
        <thead><tr><th>名称</th><th>大小</th><th>修改时间</th><th></th></tr></thead>
        <tbody>
          <tr v-for="it in items" :key="it.path" @dblclick="open(it)">
            <td><span class="file-icon">{{ it.is_dir ? '📁' : '📄' }}</span>
              <a @click="open(it)">{{ it.name }}</a></td>
            <td class="mono faint">{{ it.is_dir ? '-' : fmtSize(it.size) }}</td>
            <td class="mono faint">{{ new Date(it.mtime * 1000).toLocaleString() }}</td>
            <td class="actions">
              <button v-if="!it.is_dir" class="btn btn-sm" @click="view(it)">编辑</button>
              <button class="btn btn-sm btn-danger" @click="doDelete(it)">删除</button>
            </td>
          </tr>
          <tr v-if="!items.length && !loading"><td colspan="4" class="faint">空目录</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑器 -->
    <div v-if="editor" class="editor-overlay">
      <div class="editor-panel">
        <div class="editor-head">
          <b class="mono">{{ editor.name }}</b>
          <div>
            <button class="btn btn-sm" @click="editor = null">关闭</button>
            <button class="btn btn-sm btn-primary" @click="save">保存</button>
          </div>
        </div>
        <textarea v-model="editorText" class="editor-text mono" spellcheck="false"></textarea>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.toolbar { display: flex; gap: 8px; }
.breadcrumbs { padding: 6px 0 10px; font-size: 13px; }
.breadcrumbs a { cursor: pointer; color: var(--accent); }
.breadcrumbs .sep { margin: 0 4px; color: var(--text-faint); }
.file-icon { margin-right: 6px; }
.actions { text-align: right; white-space: nowrap; }
.error-box { background: var(--danger-soft); color: var(--danger); padding: 8px 12px; margin-bottom: 10px; }
.editor-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.editor-panel { width: 80%; max-width: 900px; height: 80%; background: var(--bg-raised); border: 1px solid var(--border); display: flex; flex-direction: column; }
.editor-head { display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border); }
.editor-text { flex: 1; background: var(--bg); color: var(--text); border: 0; padding: 14px; resize: none; font-size: 13px; }
</style>