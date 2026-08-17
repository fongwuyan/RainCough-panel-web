<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../../api.js'
import RcChat from './RcChat.vue'
import RcSessionList from './RcSessionList.vue'
import RcTodo from './RcTodo.vue'
import RcToolApprove from './RcToolApprove.vue'
import RcSettings from './RcSettings.vue'

const env = ref(null)
const config = ref(null)
const models = ref([])
const modelSource = ref('fallback')
const sessions = ref([])
const skills = ref([])

const currentId = ref('')
const messages = ref([])
const todos = ref([])
const activeSkills = ref([])
const mode = ref('confirm')
const activeModel = ref('')

const streaming = ref(false)
const thinking = ref(false)
const pendingApprove = ref(null)
const showSettings = ref(false)
const showSkillsPanel = ref(false)
const showTodo = ref(true)
const bootMsg = ref('')

function newId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
function pushMessage(m) {
  messages.value.push(m)
}

async function loadEnv() {
  try {
    const r = await api.rcEnv()
    env.value = r
    if (r.config) {
      const has = config.value && config.value.hasKey
      config.value = r.config
      if (has && !r.config.hasKey) config.value.hasKey = true
      if (!activeModel.value && r.config.model) activeModel.value = r.config.model
    }
  } catch (e) {
    bootMsg.value = e.message
  }
}
async function loadModels() {
  try {
    const r = await api.rcModels()
    models.value = r.models || []
    modelSource.value = r.source || 'fallback'
    if (!activeModel.value && r.suggested) activeModel.value = r.suggested
    else if (!activeModel.value && models.value.length) activeModel.value = models.value[0].id
  } catch { models.value = [] }
}
async function loadSessions() {
  try { sessions.value = (await api.rcSessions()).sessions || [] } catch {}
}
async function loadSkills() {
  try { skills.value = (await api.rcSkills()).skills || [] } catch {}
}

function newSession() {
  if (streaming.value) return
  currentId.value = ''
  messages.value = []
  todos.value = []
  activeSkills.value = []
  pendingApprove.value = null
}

async function openSession(id) {
  if (streaming.value || id === currentId.value) return
  currentId.value = id
  messages.value = []
  todos.value = []
  pendingApprove.value = null
  try {
    const r = await api.rcSessionGet(id)
    const s = r.session || {}
    messages.value = (s.messages || []).map(toUiMessage)
    todos.value = s.todos || []
    if (Array.isArray(s.active_skills) && s.active_skills.length) activeSkills.value = s.active_skills
    if (s.model) activeModel.value = s.model
    await loadSessions()
  } catch { /* noop */ }
}

function toUiMessage(m) {
  if (m.role === 'user' || m.role === 'tool') {
    return { role: m.role, content: m.content || '', tools: [] }
  }
  return { role: 'assistant', content: m.content || '', tools: [] }
}

function ensureSession() {
  if (!currentId.value) currentId.value = newId()
}

async function sendMessage(text) {
  const t = (text || '').trim()
  if (!t || streaming.value) return
  if (!config.value || !config.value.hasKey) {
    bootMsg.value = '未配置 API Key, 请到设置页填写'
    showSettings.value = true
    return
  }
  ensureSession()
  pushMessage({ role: 'user', content: t, tools: [] })
  streaming.value = true
  thinking.value = false
  let assistant = null
  const ensure = () => {
    if (!assistant) { assistant = { role: 'assistant', content: '', tools: [] }; pushMessage(assistant) }
    return assistant
  }
  try {
    const res = await api.rcChat({
      session_id: currentId.value,
      message: t,
      model: activeModel.value,
      mode: mode.value,
      active_skills: activeSkills.value,
    })
    await consumeSSE(res, handleStreamEvent(ensure))
  } catch (e) {
    ensure().content = '错误: ' + e.message
  } finally {
    streaming.value = false
    thinking.value = false
    await loadSessions()
  }
}

function handleStreamEvent(ensure) {
  return (ev) => {
    if (ev.type === 'message') ensure().content += ev.content
    else if (ev.type === 'thinking') thinking.value = true
    else if (ev.type === 'tool') {
      thinking.value = false
      const a = ensure()
      if (ev.state === 'start') a.tools.push({ name: ev.name, args: ev.args, running: true, output: '' })
      else {
        const last = a.tools[a.tools.length - 1]
        if (last) { last.running = false; last.output = ev.output || ''; last.args = ev.args || last.args }
      }
    } else if (ev.type === 'todo') todos.value = ev.todos || []
    else if (ev.type === 'approve') pendingApprove.value = { ...ev }
    else if (ev.type === 'waiting') { /* keep approve modal */ }
    else if (ev.type === 'done' || ev.type === 'canceled') thinking.value = false
    else if (ev.type === 'error') ensure().content += '\n错误: ' + ev.error
  }
}

async function decideApprove(decision) {
  const p = pendingApprove.value
  if (!p || !currentId.value) { pendingApprove.value = null; return }
  pendingApprove.value = null
  streaming.value = true
  thinking.value = false
  const cmd = (p.args && p.args.command) || ''
  let assistant = null
  const ensure = () => {
    if (!assistant) { assistant = { role: 'assistant', content: '', tools: [] }; pushMessage(assistant) }
    return assistant
  }
  try {
    const res = await api.rcApprove({
      session_id: currentId.value,
      approved: decision.approved,
      reason: decision.reason || '',
      add_whitelist: !!decision.addWhitelist,
      command: cmd,
      model: activeModel.value,
      mode: mode.value,
      active_skills: activeSkills.value,
    })
    await consumeSSE(res, handleStreamEvent(ensure))
  } catch (e) {
    ensure().content = '错误: ' + e.message
  } finally {
    streaming.value = false
    thinking.value = false
    await loadSessions()
  }
}

async function cancelTurn() {
  if (currentId.value) {
    try { await api.rcCancel(currentId.value) } catch { /* noop */ }
  }
  streaming.value = false
  thinking.value = false
}

async function consumeSSE(res, onEvent) {
  if (!res.ok) {
    let msg = 'HTTP ' + res.status
    try { msg = ((await res.json()).error) || msg } catch { /* noop */ }
    throw new Error(msg)
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith('data:')) continue
      const d = line.slice(5).trim()
      if (!d) continue
      let ev
      try { ev = JSON.parse(d) } catch { continue }
      onEvent(ev)
    }
  }
}

async function saveConfig(cfg) {
  await api.rcSaveConfig(cfg)
  await loadEnv()
  await loadModels()
}
async function startAgent() { await api.rcStart(); await loadEnv() }
async function stopAgent() { await api.rcStop(); await loadEnv() }
async function saveSkill(s) { await api.rcSkillSave(s); await loadSkills() }
async function deleteSkill(name) { await api.rcSkillDelete(name); await loadSkills() }
async function toggleSkill(name, enabled) { await api.rcSkillToggle(name, enabled); await loadSkills() }
function toggleActive(name, checked) {
  activeSkills.value = checked
    ? (activeSkills.value.includes(name) ? activeSkills.value : [...activeSkills.value, name])
    : activeSkills.value.filter((x) => x !== name)
}
async function deleteSession(id) {
  if (streaming.value) return
  await api.rcSessionDelete(id)
  if (currentId.value === id) newSession()
  await loadSessions()
}

onMounted(async () => {
  await Promise.all([loadEnv(), loadModels(), loadSessions(), loadSkills()])
})
</script>

<template>
  <div class="app">
    <div class="app-screen">
      <div class="topbar">
        <div class="brand">AI 编程助手 <span class="sub">raincode</span></div>
        <select v-model="activeModel" class="ctl sel" title="模型(全部为 opencode 免费模型)">
          <option v-for="m in models" :key="m.id" :value="m.id">
            {{ m.name || m.id }}{{ m.reasoning ? ' ⚡' : '' }}
          </option>
        </select>
        <span v-if="modelSource === 'fallback'" class="hint fallback">离线列表</span>
        <div class="pill">
          <button :class="{ on: mode === 'auto' }" @click="mode = 'auto'">自动</button>
          <button :class="{ on: mode === 'confirm' }" @click="mode = 'confirm'">确认</button>
          <button :class="{ on: mode === 'whitelist' }" @click="mode = 'whitelist'">白名单</button>
        </div>
        <button class="ctl" :class="{ on: showSkillsPanel }" @click="showSkillsPanel = !showSkillsPanel">技能</button>
        <button class="ctl" :class="{ on: showTodo }" @click="showTodo = !showTodo">任务</button>
        <button class="ctl" :class="{ on: showSettings }" @click="showSettings = !showSettings">设置</button>
      </div>

      <div class="body">
        <RcSessionList
          class="side"
          :sessions="sessions"
          :current-id="currentId"
          :streaming="streaming"
          @new="newSession"
          @select="openSession"
          @delete="deleteSession"
        />
        <div class="center">
          <RcChat
            :messages="messages"
            :streaming="streaming"
            :thinking="thinking"
            :boot-msg="bootMsg"
            @send="sendMessage"
            @cancel="cancelTurn"
          />
        </div>
        <RcTodo v-if="showTodo" class="rail" :todos="todos" />
      </div>

      <div v-if="showSkillsPanel" class="popover skill-pop">
        <div class="pop-title">本会话启用技能</div>
        <div v-if="!skills.length" class="empty">暂无技能, 可在设置-技能中新建</div>
        <label v-for="s in skills" :key="s.name" class="skill-line">
          <input
            type="checkbox"
            :checked="activeSkills.includes(s.name)"
            @change="toggleActive(s.name, $event.target.checked)"
          />
          <span class="s-name">{{ s.title }}</span>
          <span class="s-desc">{{ s.description || s.name }}</span>
        </label>
      </div>
    </div>

    <RcToolApprove v-if="pendingApprove" :pending="pendingApprove" @decide="decideApprove" />
    <RcSettings
      :open="showSettings"
      :config="config"
      :env="env"
      :models="models"
      :model-source="modelSource"
      :skills="skills"
      @close="showSettings = false"
      @save-config="saveConfig"
      @start-agent="startAgent"
      @stop-agent="stopAgent"
      @save-skill="saveSkill"
      @delete-skill="deleteSkill"
      @toggle-skill="toggleSkill"
    />
  </div>
</template>

<style scoped>
.app { display: flex; height: 100vh; }
.app-screen { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; }
.topbar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-bottom: 1px solid var(--border);
  background: var(--surface); flex-shrink: 0; flex-wrap: wrap;
}
.brand { font-weight: 700; color: var(--text); white-space: nowrap; }
.brand .sub { font-size: 11px; font-weight: 400; color: var(--text-muted); }
.ctl {
  padding: 6px 10px; font-size: 12px; font-weight: 600; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg, transparent);
  color: var(--text); cursor: pointer; font-family: var(--font);
}
.sel { max-width: 260px; }
.ctl.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.pill { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.pill button {
  padding: 6px 10px; font-size: 12px; font-weight: 600; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer; font-family: var(--font);
}
.pill button.on { background: var(--accent); color: #fff; }
.hint { font-size: 11px; color: var(--text-muted); }
.hint.fallback { color: #e0a000; }
.body { flex: 1; min-height: 0; display: flex; }
.side { width: 220px; flex-shrink: 0; border-right: 1px solid var(--border); }
.center { flex: 1; min-width: 0; display: flex; }
.rail { width: 240px; flex-shrink: 0; border-left: 1px solid var(--border); }
.popover {
  position: absolute; top: 56px; right: 12px; z-index: 30; width: 300px; max-height: 50vh; overflow: auto;
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
}
.pop-title { font-weight: 700; margin-bottom: 8px; color: var(--text); }
.skill-line { display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer; }
.s-name { font-weight: 600; color: var(--text); white-space: nowrap; }
.s-desc { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
.empty { font-size: 12px; color: var(--text-muted); }
</style>