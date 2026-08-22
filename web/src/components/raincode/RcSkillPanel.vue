<script setup>
import { ref, reactive } from 'vue'

defineProps({
  skills: { type: Array, default: () => [] },
})
const emit = defineEmits(['save', 'delete', 'toggle'])

const editing = ref(false)
const editName = ref('')
const note = ref('')

const f = reactive({
  name: '',
  title: '',
  description: '',
  enabled: true,
  params: [],
  execution: { kind: 'shell', command: '', tool: 'execute_shell', argMap: {}, method: 'GET', url: '', headers: {}, body: '' },
})

function blank() {
  f.name = ''; f.title = ''; f.description = ''; f.enabled = true
  f.params = []
  f.execution = { kind: 'shell', command: '', tool: 'execute_shell', argMap: {}, method: 'GET', url: '', headers: {}, body: '' }
}
function editSkill(s) {
  editName.value = s.name
  f.name = s.name
  f.title = s.title || s.name
  f.description = s.description || ''
  f.enabled = s.enabled !== false
  f.params = (s.params || []).map((p) => ({ ...p }))
  const ex = s.execution || {}
  f.execution = {
    kind: ex.kind || 'shell',
    command: ex.command || '',
    tool: ex.tool || 'execute_shell',
    argMap: { ...(ex.argMap || {}) },
    method: ex.method || 'GET',
    url: ex.url || '',
    headers: { ...(ex.headers || {}) },
    body: ex.body || '',
  }
  editing.value = true
}
function startForm() {
  editName.value = ''
  blank()
  editing.value = true
}
function addParam() { f.params.push({ name: '', type: 'string', description: '', required: false }) }
function delParam(i) { f.params.splice(i, 1) }
function addHeader() { f.execution.headers['header' + (Object.keys(f.execution.headers).length + 1)] = '' }
function delHeader(k) { delete f.execution.headers[k] }
function setArg(skillParam) {
  if (!skillParam) {
    f.execution.argMap = {}
    return
  }
  f.execution.argMap = { ...f.execution.argMap, [skillParam]: skillParam }
}
function save() {
  const name = f.name.trim()
  if (!name) { note = '技能名不能为空'; flash(); return }
  const params = f.params
    .filter((p) => p && p.name && p.name.trim())
    .map((p) => ({ name: p.name.trim(), type: p.type || 'string', description: p.description || '', required: !!p.required }))
  const execution = { kind: f.execution.kind }
  if (execution.kind === 'shell') {
    if (!f.execution.command.trim()) { note = 'shell 技能需填写命令'; flash(); return }
    execution.command = f.execution.command
  } else if (execution.kind === 'tool') {
    if (!f.execution.tool.trim()) { note = 'tool 技能需选择内置工具'; flash(); return }
    execution.tool = f.execution.tool
    execution.argMap = { ...f.execution.argMap }
  } else {
    if (!f.execution.url.trim()) { note = 'http 技能需填写 URL'; flash(); return }
    execution.method = f.execution.method || 'GET'
    execution.url = f.execution.url
    execution.headers = { ...f.execution.headers }
    execution.body = f.execution.body || ''
  }
  emit('save', {
    name, title: f.title.trim() || name,
    description: f.description.trim(),
    enabled: f.enabled,
    params, execution,
  })
  editing.value = false
}
function flash() { setTimeout(() => (note.value = ''), 2000) }
</script>

<template>
  <div class="sk">
    <div class="sk-top">
      <span class="pane-title">技能管理</span>
      <button class="m" @click="startForm">+ 新建</button>
    </div>
    <div class="sk-desc">技能为可被 AI 调用的函数工具: 定义参数签名 + 执行方式(shell/tool/http)。启用后注册为函数调用, 由服务器端执行, 无需审批。</div>

    <div v-if="editing" class="skill-form">
      <label>技能名(字母数字_-, 对应函数名)</label>
      <input v-model="f.name" :disabled="!!editName" />
      <label>标题</label>
      <input v-model="f.title" placeholder="显示名称" />
      <label>描述(给 AI 看的用途说明)</label>
      <input v-model="f.description" placeholder="当用户想… 时调用此技能" />

      <label>参数签名 (参数会作为函数入参传给 AI 提取)</label>
      <div v-for="(p, i) in f.params" :key="i" class="param-row">
        <input v-model="p.name" class="param-mini" placeholder="参数名" />
        <select v-model="p.type" class="param-mini">
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
        </select>
        <input v-model="p.description" class="param-desc" placeholder="说明" />
        <label class="req"><input type="checkbox" v-model="p.required" />必填</label>
        <button class="m warn" @click="delParam(i)">✕</button>
      </div>
      <button class="m" @click="addParam">+ 添加参数</button>

      <label>执行方式</label>
      <select v-model="f.execution.kind" class="kind-sel">
        <option value="shell">Shell 命令</option>
        <option value="tool">内置工具</option>
        <option value="http">HTTP 请求</option>
      </select>

      <template v-if="f.execution.kind === 'shell'">
        <label>命令 (用 {参数名} 引用技能参数)</label>
        <textarea v-model="f.execution.command" rows="3" placeholder="例如: ls -la {dir}&#10;echo {text} > /tmp/out.txt"></textarea>
      </template>

      <template v-else-if="f.execution.kind === 'tool'">
        <label>内置工具</label>
        <select v-model="f.execution.tool" class="kind-sel">
          <option value="execute_shell">execute_shell</option>
          <option value="read_file">read_file</option>
          <option value="write_file">write_file</option>
          <option value="edit_file">edit_file</option>
          <option value="list_dir">list_dir</option>
          <option value="search">search</option>
        </select>
        <label>参数映射 (技能参数 → 工具参数)</label>
        <div class="map-hint">规则: 将技能参数绑定到工具参数。</div>
        <div v-for="(_, i) in Object.keys(f.execution.argMap)" :key="i" class="param-row">
          <input :value="Object.keys(f.execution.argMap)[i]" disabled class="param-mini" />
          <span class="arrow">→</span>
          <input :value="f.execution.argMap[Object.keys(f.execution.argMap)[i]]" disabled class="param-mini" />
          <button class="m warn" @click="delHeader(Object.keys(f.execution.argMap)[i])">✕</button>
        </div>
        <label class="auto-map" v-if="f.params.length">
          自动映射(同名技能参数 → 工具参数):
        </label>
        <select v-if="f.params.length" v-model="f.execution.argMap[f.params[0].name]" class="kind-sel" @change="setArg(f.params[0].name)">
          <option :value="null" disabled>选择工具参数</option>
          <option value="command">command (execute_shell)</option>
          <option value="path">path (read/list/search)</option>
          <option value="pattern">pattern (search)</option>
          <option value="content">content (write)</option>
          <option value="old">old (edit)</option>
          <option value="new">new (edit)</option>
        </select>
        <div class="map-hint">写入 {参数名} 对应工具参数键: 在 argMap 中键为技能参数名, 值为工具参数名。当前: {{ JSON.stringify(f.execution.argMap) }}</div>
      </template>

      <template v-else-if="f.execution.kind === 'http'">
        <label>HTTP 方法</label>
        <select v-model="f.execution.method" class="kind-sel">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <label>URL (用 {参数名} 引用技能参数)</label>
        <input v-model="f.execution.url" placeholder="https://api.example.com/data/{id}" />
        <label>Headers</label>
        <div v-for="(v, k) in f.execution.headers" :key="k" class="param-row">
          <input :value="k" disabled class="param-mini" />
          <span class="arrow">→</span>
          <input v-model="f.execution.headers[k]" class="param-desc" placeholder="值, 可用 {参数名}" />
          <button class="m warn" @click="delHeader(k)">✕</button>
        </div>
        <button class="m" @click="addHeader">+ 添加 Header</button>
        <label>Body (可选)</label>
        <textarea v-model="f.execution.body" rows="3" placeholder='{"text": "{text}"}'></textarea>
      </template>

      <div class="row end">
        <button class="act" @click="save">保存技能</button>
        <button class="act ghost" @click="editing = false">取消</button>
        <span v-if="note" class="note">{{ note }}</span>
      </div>
    </div>

    <div v-if="!skills.length" class="empty">暂无技能</div>
    <div v-for="s in skills" v-show="!editing" :key="s.name" class="add">
      <div class="add-top">
        <input type="checkbox" :checked="s.enabled" @change="emit('toggle', s.name, $event.target.checked)" />
        <b>{{ s.title }}</b>
        <span class="s-id">{{ s.name }}</span>
        <span v-if="s.execution" class="s-kind">{{ s.execution.kind }}</span>
      </div>
      <div class="add-desc">{{ s.description || '—' }}</div>
      <div class="add-ops">
        <button class="m" @click="editSkill(s)">编辑</button>
        <button class="m warn" @click="emit('delete', s.name)">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sk { padding: 4px 2px; }
.sk-top { display: flex; align-items: center; justify-content: space-between; }
.pane-title { font-weight: 700; color: var(--text); }
.sk-desc { color: var(--text-muted); font-size: 12px; margin: 6px 0 10px; }
label { display: block; font-size: 12px; font-weight: 600; color: var(--text); margin: 10px 0 4px; }
input, textarea, select {
  width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-family: var(--font); font-size: 13px;
}
textarea { resize: vertical; }
.row.end { display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-top: 12px; }
.act { padding: 8px 16px; border: none; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; font-family: var(--font); }
.act.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
.note { font-size: 12px; color: var(--warning); }
.m { padding: 4px 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; font-family: var(--font); }
.m.warn { color: var(--error); border-color: var(--error); }
.skill-form { margin-top: 8px; }
.add { border-top: 1px solid var(--border); padding: 8px 0; }
.add-top { display: flex; align-items: center; gap: 8px; }
.add-top b { color: var(--text); }
.s-id { font-size: 11px; color: var(--text-muted); }
.s-kind { font-size: 10px; color: var(--primary); border: 1px solid var(--border); border-radius: 4px; padding: 0 5px; }
.add-desc { font-size: 12px; color: var(--text-muted); margin: 6px 0; }
.add-ops { display: flex; gap: 6px; }
.empty { color: var(--text-muted); font-size: 13px; }
.param-row { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
.param-mini { width: 110px; flex-shrink: 0; }
.param-desc { flex: 1; }
.req { display: flex; align-items: center; gap: 4px; font-size: 12px; margin: 0; white-space: nowrap; }
.kind-sel { width: 100%; }
.arrow { color: var(--text-muted); }
.map-hint { font-size: 11px; color: var(--text-muted); margin: 4px 0; }
.auto-map { margin-top: 8px; }
</style>