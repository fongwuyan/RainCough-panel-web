<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api.js'
import RcPrompt from './RcPrompt.vue'
import RcChat from './RcChat.vue'
import RcSessionList from './RcSessionList.vue'
import RcTodo from './RcTodo.vue'
import RcToolApprove from './RcToolApprove.vue'
import RcSettings from './RcSettings.vue'
import RcSkillPanel from './RcSkillPanel.vue'

const env = ref(null)
const config = ref(null)
const sessions = ref([])
const skills = ref([])
const workspaces = ref([])
const memoryContent = ref('')
const providers = ref([])
const activeProvider = ref('')
const principles = ref([])
const principlesText = ref('')
const models = ref([])

const currentId = ref('')
const messages = ref([])
const todos = ref([])
const activeSkills = ref([])
const agentMode = ref('build')
const mode = ref('confirm')
const activeModel = ref('')
const activeWorkspace = ref('')

const streaming = ref(false)
const thinking = ref(false)
const pendingApprove = ref(null)
const bootMsg = ref('')

const input = ref('')

/* 弹窗 */
const sessionsOpen = ref(false)
const settingsOpen = ref(false)
const settingsTab = ref('cfg')
const wsOpen = ref(false)
const wsPath = ref('')
const wsDirs = ref([])
const wsParent = ref(null)
const wsNote = ref('')

const HOME_PLACEHOLDERS = [
  '修复代码中的一个 TODO',
  '这个项目用了什么技术栈?',
  '修复失败的最后一次构建',
  '解释这个文件的逻辑',
]

function baseName(p) {
  if (!p) return ''
  const s = String(p).replace(/[\\/]+$/, '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}
const wsName = computed(() => baseName(activeWorkspace.value) || '工作区')
const isHome = computed(() => !currentId.value)
const sessionTitle = computed(() => {
  const user = messages.value.find((m) => m.role === 'user')
  const t = (user && user.content) || ''
  return t.length > 40 ? t.slice(0, 37) + '…' : t || '未命名会话'
})
const hasConfig = computed(() => !!activeProvider.value && !!activeModel.value)
function configState() {
  const p = providers.value.find((x) => x.name === activeProvider.value)
  const base = p ? p.api_base : (config.value && config.value.api_base)
  const show = !!base && !!activeModel.value
  return show ? (p ? p.name + ' / ' : '') + (activeModel.value || '未设置模型') : '未配置'
}

function newId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }
function pushMessage(m) { messages.value.push(m) }

async function loadEnv() {
  try {
    const r = await api.rcEnv()
    env.value = r
    if (r.workspaces && r.workspaces.length) workspaces.value = r.workspaces
    if (r.config) {
      config.value = { ...r.config, hasKey: !!r.config.has_key }
      if (r.config.approve_mode) mode.value = r.config.approve_mode
      if (!activeModel.value && r.config.model) activeModel.value = r.config.model
      if (!activeWorkspace.value && r.config.workspace) activeWorkspace.value = r.config.workspace
    } else if (!activeWorkspace.value && r.workspace) {
      activeWorkspace.value = r.workspace
    }
  } catch (e) { bootMsg.value = e.message }
}
async function loadProviders() {
  try {
    const r = await api.rcProviders()
    providers.value = r.providers || []
    const enabled = providers.value.filter((p) => p.enabled)
    if (enabled.length) {
      const def = config.value && config.value.default_provider
      activeProvider.value = enabled.some((p) => p.name === def)
        ? def : activeProvider.value || enabled[0].name
    } else {
      activeProvider.value = ''
    }
    if (activeProvider.value) {
      try { const mr = await api.rcModels(activeProvider.value); models.value = mr.models || [] } catch { models.value = [] }
      const p = providers.value.find((x) => x.name === activeProvider.value)
      if (p && p.default_model) activeModel.value = p.default_model
      else if (models.value.length && !activeModel.value) activeModel.value = models.value[0]
    }
  } catch {}
}
function onModelChange(m) { activeModel.value = m }
async function loadPrinciples() {
  try { principles.value = (await api.rcPrinciples()).principles || [] } catch { principles.value = [] }
  principlesText.value = principles.value.join('\n')
}
async function loadMemory() {
  try { memoryContent.value = (await api.rcMemory()).content || '' } catch { memoryContent.value = '' }
}
async function saveMemory(content) {
  await api.rcMemorySave(content)
  memoryContent.value = content
}
async function loadSessions(ws) {
  try {
    const r = await api.rcSessions(ws == null ? activeWorkspace.value : ws)
    sessions.value = r.sessions || []
    if (r.workspaces && r.workspaces.length) workspaces.value = r.workspaces
  } catch {}
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
  sessionsOpen.value = false
}

async function switchWorkspace(dir) {
  if (!dir || dir === activeWorkspace.value) return
  activeWorkspace.value = dir
  await saveConfig({ workspace: dir })
  newSession()
  await loadSessions(dir)
  await loadEnv()
  wsOpen.value = false
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
  } catch {}
  sessionsOpen.value = false
}

function toUiMessage(m) {
  if (m.role === 'user' || m.role === 'tool') return { role: m.role, content: m.content || '', tools: [] }
  return { role: 'assistant', content: m.content || '', tools: [] }
}

function ensureSession() { if (!currentId.value) currentId.value = newId() }

async function sendMessage() {
  const t = input.value.trim()
  if (!t || streaming.value) return
  if (t.startsWith('/')) {
    await handleCommand(t)
    return
  }
  if (!hasConfig.value) {
    bootMsg.value = '尚未配置模型接入, 请先在设置中填写 API Base、Key 与模型'
    settingsOpen.value = true
    settingsTab.value = 'cfg'
    return
  }
  ensureSession()
  pushMessage({ role: 'user', content: t, tools: [] })
  input.value = ''
  streaming.value = true
  thinking.value = false
  let assistant = null
  const ensure = () => {
    if (!assistant) { assistant = { role: 'assistant', content: '', tools: [] }; pushMessage(assistant) }
    return assistant
  }
  try {
    const res = await api.rcChat({
      session_id: currentId.value, message: t, model: activeModel.value,
      provider: activeProvider.value, workspace: activeWorkspace.value, mode: mode.value, agent_mode: agentMode.value,
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

async function handleCommand(raw) {
  const line = raw.trim()
  const [cmd, ...rest] = line.split(/\s+/)
  const arg = rest.join(' ')
  switch (cmd) {
    case '/help':
      pushMessage({ role: 'user', content: line, tools: [] })
      pushMessage({ role: 'assistant', content: '可用命令:\n- /help 显示帮助\n- /new 新建会话\n- /clear 清空当前对话\n- /skills 打开技能管理\n- /memory 打开记忆管理', tools: [] })
      break
    case '/new':
      newSession()
      break
    case '/clear':
      currentId.value = ''
      messages.value = []
      todos.value = []
      break
    case '/skills':
      settingsOpen.value = true
      settingsTab.value = 'skills'
      break
    case '/memory':
      settingsOpen.value = true
      settingsTab.value = 'memory'
      break
    default:
      pushMessage({ role: 'user', content: line, tools: [] })
      pushMessage({ role: 'assistant', content: '未知命令: ' + cmd + ' (输入 /help 查看可用命令)', tools: [] })
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
    else if (ev.type === 'memory') { if (typeof ev.content === 'string') memoryContent.value = ev.content }
    else if (ev.type === 'approve') { pendingApprove.value = { ...ev }; settingsOpen.value = false }
    else if (ev.type === 'waiting') {}
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
      session_id: currentId.value, approved: decision.approved, reason: decision.reason || '',
      add_whitelist: !!decision.addWhitelist, command: cmd, model: activeModel.value,
      provider: activeProvider.value, workspace: activeWorkspace.value, mode: mode.value, agent_mode: agentMode.value,
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
  if (currentId.value) { try { await api.rcCancel(currentId.value) } catch {} }
  streaming.value = false
  thinking.value = false
}

async function consumeSSE(res, onEvent) {
  if (!res.ok) {
    let msg = 'HTTP ' + res.status
    try { msg = ((await res.json()).error) || msg } catch {}
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
  if (cfg.model) activeModel.value = cfg.model
  await loadMemory()
}
async function startAgent() { await api.rcStart(); await loadEnv() }
async function stopAgent() { await api.rcStop(); await loadEnv() }
async function saveSkill(s) { await api.rcSkillSave(s); await loadSkills() }
async function deleteSkill(name) { await api.rcSkillDelete(name); await loadSkills() }
async function toggleSkill(name, enabled) { await api.rcSkillToggle(name, enabled); await loadSkills() }
async function toggleActiveSkill(name, checked) {
  activeSkills.value = checked
    ? (activeSkills.value.includes(name) ? activeSkills.value : [...activeSkills.value, name])
    : activeSkills.value.filter((x) => x !== name)
}
async function selectProvider(name) {
  activeProvider.value = name
  try { const r = await api.rcModels(name); models.value = r.models || [] } catch { models.value = [] }
  const p = providers.value.find((x) => x.name === name)
  if (p && p.default_model) { activeModel.value = p.default_model }
  else if (models.value.length) { activeModel.value = models.value[0] }
  else if (p) { activeModel.value = '' }
}
async function saveProviders() {
  const r = await api.rcProvidersSave(providers.value, activeProvider.value)
  providers.value = r.providers || []
  if (!activeProvider.value && providers.value.some((p) => p.enabled)) activeProvider.value = providers.value[0].name
  await loadEnv()
}
function addProvider() {
  providers.value.push({ name: '', api_base: '', api_key: '', default_model: '', enabled: true, has_key: false })
}
async function deleteProvider(name) {
  await api.rcProviderDelete(name)
  await loadProviders()
  if (activeProvider.value === name) activeProvider.value = ''
}
async function savePrinciples() {
  principles.value = (await api.rcPrinciplesSave(principles.value)).principles || []
}
async function deleteSession(id) {
  if (streaming.value) return
  await api.rcSessionDelete(id)
  if (currentId.value === id) newSession()
  await loadSessions()
}

/* 工作区选择器 */
async function wsBrowse(path) {
  try {
    const r = await api.rcBrowse(path)
    wsPath.value = r.path
    wsDirs.value = r.dirs || []
    wsParent.value = r.parent || null
    wsNote.value = r.exists ? '' : '该目录不存在'
  } catch (e) { wsNote.value = e.message }
}
function openAddWs() {
  wsNote.value = ''
  wsBrowse(activeWorkspace.value || '')
  wsOpen.value = true
}
function wsEnter(name) { wsBrowse(wsPath.value.replace(/[\\/]+$/, '') + '/' + name) }
function wsUp() { if (wsParent.value) wsBrowse(wsParent.value) }
async function wsPick() {
  await saveConfig({ workspace: wsPath.value, workspaces: [...workspaces.value, wsPath.value] })
  activeWorkspace.value = wsPath.value
  newSession()
  await loadSessions(wsPath.value)
  wsOpen.value = false
}
function wsSelectRow(d) {
  wsPath.value = (wsPath.value.replace(/[\\/]+$/, '') + '/' + d).replace(/\\/g, '/')
  wsNote.value = ''
}

onMounted(async () => {
  await Promise.all([loadEnv(), loadMemory(), loadSessions(), loadSkills(), loadPrinciples()])
  await loadProviders()
})
</script>

<template>
  <div class="rc">
    <!-- 主题变量在根元素注入, 子组件继承 -->
    <div class="app" :class="{ home: isHome }">
      <!-- ============ 主页 (居中 logo + prompt) ============ -->
      <div v-if="isHome" class="home-root">
        <div class="home-logo">
          <div class="logo-mark">
            <span class="lm-r">R</span><span class="lm-c">C</span>
          </div>
          <div class="logo-text"><b>Rain</b><span class="code">Code</span></div>
          <div class="logo-sub">{{ wsName }} · {{ configState() }}</div>
        </div>

        <div class="home-prompt">
          <RcPrompt
            v-model:value="input"
            :mode="agentMode"
            :model-label="activeModel"
            :provider="activeProvider"
            :providers="providers"
            :models="models"
            :streaming="streaming"
            :dir="activeWorkspace"
            :placeholder="'有什么可以帮你? · 试试「' + (HOME_PLACEHOLDERS[sessions.length % HOME_PLACEHOLDERS.length]) + '」'"
            @update:mode="agentMode = $event"
            @update:provider="selectProvider"
            @update:model="onModelChange"
            @submit="sendMessage"
            @interrupt="cancelTurn"
            @open-sessions="sessionsOpen = true"
            @open-settings="settingsOpen = true; settingsTab = 'cfg'"
          />
        </div>

        <div class="home-hints">
          <button class="hint" @click="newSession">+ 新建会话</button>
          <button class="hint" @click="settingsOpen = true; settingsTab = 'cfg'">/settings 设置</button>
          <button class="hint" @click="wsOpen = true">/workspace 工作区</button>
          <button class="hint" @click="loadEnv">/status 状态</button>
        </div>
      </div>

      <!-- ============ 会话页 (消息 + prompt + 右侧栏) ============ -->
      <div v-else class="session-root">
        <div class="session-main">
          <div class="session-head">
            <button class="shead-new" @click="newSession">+ 新会话</button>
            <span class="shead-title">{{ sessionTitle }}</span>
            <span class="shead-prov" v-if="configState() !== '未配置'">{{ configState() }}</span>
            <button class="shead-btn" @click="sessionsOpen = true">会话</button>
          </div>
          <div class="session-chat">
            <RcChat :messages="messages" :thinking="thinking" :boot-msg="bootMsg" />
          </div>
          <div class="session-prompt">
            <RcPrompt
              v-model:value="input"
              :mode="agentMode"
              :model-label="activeModel"
              :provider="activeProvider"
              :providers="providers"
              :models="models"
              :streaming="streaming"
              :dir="activeWorkspace"
              placeholder="继续对话… (输入 /help 查看命令)"
              @update:mode="agentMode = $event"
              @update:provider="selectProvider"
              @update:model="onModelChange"
              @submit="sendMessage"
              @interrupt="cancelTurn"
              @open-sessions="sessionsOpen = true"
              @open-settings="settingsOpen = true; settingsTab = 'cfg'"
            />
          </div>
        </div>

        <!-- 右侧栏 -->
        <aside class="sidebar">
          <div class="sb-scroll">
            <div class="sb-title">{{ sessionTitle }}</div>
            <button class="sb-ws" @click="wsOpen = true" :title="activeWorkspace">
              <span class="ws-icon">⌂</span><span class="ws-name">{{ wsName }}</span>
            </button>
            <div class="sb-block sb-todo">
              <div class="sb-head">任务清单</div>
              <RcTodo :todos="todos" />
            </div>
            <div class="sb-block sb-skills">
              <div class="sb-head">技能</div>
              <div v-if="!skills.length" class="sb-empty">—</div>
              <label v-for="s in skills" :key="s.name" class="sb-skill">
                <input type="checkbox" :checked="activeSkills.includes(s.name)"
                  @change="toggleActiveSkill(s.name, $event.target.checked)" />
                <span>{{ s.title }}</span>
              </label>
            </div>
          </div>
          <div class="sb-foot">
            <span class="ft-dot">●</span>
            <span class="ft-txt"><b>Rain</b><b class="code">Code</b></span>
            <span class="ft-ver">v1.0</span>
          </div>
        </aside>
      </div>

      <!-- ============ 会话列表弹窗 ============ -->
      <div v-if="sessionsOpen" class="mask" @click.self="sessionsOpen = false">
        <div class="dlg dlg-sessions">
          <div class="dlg-head">
            <span class="dlg-title">会话列表 <span class="muted">{{ wsName }}</span></span>
            <button class="dlg-close" @click="sessionsOpen = false">✕</button>
          </div>
          <div class="dlg-new"><button class="dlg-new-btn" @click="newSession">+ 新建会话</button></div>
          <div class="dlg-body">
            <RcSessionList
              :sessions="sessions" :current-id="currentId" :streaming="streaming"
              @select="openSession" @delete="deleteSession"
            />
          </div>
        </div>
      </div>

      <!-- ============ 设置弹窗 ============ -->
      <div v-if="settingsOpen" class="mask" @click.self="settingsOpen = false">
        <div class="dlg dlg-settings">
          <div class="dlg-nav">
            <div class="dlg-nav-title">RainCode</div>
            <button class="dn-item" :class="{ on: settingsTab === 'cfg' }" @click="settingsTab = 'cfg'">设置</button>
            <button class="dn-item" :class="{ on: settingsTab === 'providers' }" @click="settingsTab = 'providers'">服务商</button>
            <button class="dn-item" :class="{ on: settingsTab === 'principles' }" @click="settingsTab = 'principles'">工作原则</button>
            <button class="dn-item" :class="{ on: settingsTab === 'memory' }" @click="settingsTab = 'memory'">记忆</button>
            <button class="dn-item" :class="{ on: settingsTab === 'skills' }" @click="settingsTab = 'skills'">技能</button>
            <button class="dn-item" :class="{ on: settingsTab === 'todo' }" @click="settingsTab = 'todo'">任务</button>
            <button class="dn-item" :class="{ on: settingsTab === 'ws' }" @click="settingsTab = 'ws'">工作区</button>
            <div class="dn-spacer"></div>
            <button class="dn-close" @click="settingsOpen = false">关闭</button>
          </div>
          <div class="dlg-content">
            <div v-show="settingsTab === 'cfg'">
              <RcSettings
                :config="config" :env="env"
                @save-config="saveConfig" @start-agent="startAgent" @stop-agent="stopAgent"
              />
            </div>
            <div v-show="settingsTab === 'providers'" class="settings-pane">
              <div class="pane-title">服务商</div>
              <div class="prov-desc">配置多个模型服务商(OpenAI 兼容), 在输入框左侧切换。Key 存储在服务器端配置文件中。</div>
              <div v-for="(p, i) in providers" :key="i" class="prov-row">
                <div class="prov-fields">
                  <input v-model="p.name" class="prov-in" placeholder="名称 (如 DeepSeek)" />
                  <input v-model="p.api_base" class="prov-in" placeholder="API Base (https://.../v1)" />
                  <input v-model="p.api_key" class="prov-in" :placeholder="p.has_key ? '**** (留空保留)' : 'API Key'" />
                  <input v-model="p.default_model" class="prov-in" placeholder="默认模型" />
                </div>
                <div class="prov-ops">
                  <label class="prov-en"><input type="checkbox" v-model="p.enabled" />启用</label>
                  <button class="prov-btn use" :class="{ on: activeProvider === p.name }"
                    @click="selectProvider(p.name)">使用</button>
                  <button class="prov-btn del" @click="deleteProvider(p.name)">删除</button>
                </div>
              </div>
              <button class="prov-add" @click="addProvider">+ 添加服务商</button>
              <div class="row end"><button class="plain-btn acc" @click="saveProviders">保存服务商</button></div>
            </div>
            <div v-show="settingsTab === 'principles'" class="settings-pane">
              <div class="pane-title">工作原则</div>
              <div class="mem-desc">每行一条工作原则。该内容将作为系统消息注入, 与记忆一起决定 agent 的行为方式。留空则无任何固定引导。</div>
              <textarea v-model="principlesText" rows="8" class="mem-ta" placeholder="例如:&#10;始终使用中文回答&#10;修改代码前先阅读相关文件&#10;每完成一步用 update_todo 更新任务清单"></textarea>
              <div class="row end"><button class="plain-btn acc" @click="principles = principlesText.split('\n'); savePrinciples()">保存工作原则</button></div>
            </div>
            <div v-show="settingsTab === 'memory'" class="settings-pane">
              <div class="pane-title">长期记忆</div>
              <div class="mem-desc">记忆为全局共享, 跨所有会话注入到系统提示。由 agent 自主读写, 也可手动编辑。</div>
              <textarea v-model="memoryContent" rows="8" class="mem-ta" placeholder="记录用户的偏好、项目约定、关键技术决策…"></textarea>
              <div class="row end"><button class="plain-btn acc" @click="saveMemory(memoryContent)">保存记忆</button></div>
            </div>
            <div v-show="settingsTab === 'skills'" class="settings-pane">
              <RcSkillPanel :skills="skills" @save="saveSkill" @delete="deleteSkill" @toggle="toggleSkill" />
            </div>
            <div v-show="settingsTab === 'todo'" class="settings-pane">
              <RcTodo :todos="todos" />
            </div>
            <div v-show="settingsTab === 'ws'" class="settings-pane">
              <div class="pane-title">工作区</div>
              <div v-for="w in workspaces" :key="w" class="ws-item" :class="{ on: w === activeWorkspace }">
                <button class="ws-item-name" @click="switchWorkspace(w)">{{ w }}</button>
              </div>
              <button class="ws-add" @click="openAddWs">+ 添加工作区</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ 新增工作区选择器 ============ -->
      <div v-if="wsOpen" class="mask" @click.self="wsOpen = false">
        <div class="dlg dlg-ws">
          <div class="dlg-head">
            <span class="dlg-title">选择工作区</span>
            <button class="dlg-close" @click="wsOpen = false">✕</button>
          </div>
          <div class="ws-path">{{ wsPath }}</div>
          <div class="ws-ops"><button class="ws-btn" :disabled="!wsParent" @click="wsUp">↑</button></div>
          <div class="ws-list">
            <div v-if="!wsDirs.length" class="ws-empty">{{ wsNote || '该目录下没有子目录' }}</div>
            <div v-for="d in wsDirs" :key="d" class="ws-row">
              <button class="ws-go" @click="wsEnter(d)">{{ d }}</button>
              <button class="ws-sel" @click="wsSelectRow(d)">✓</button>
            </div>
          </div>
          <div class="ws-foot">
            <button class="ws-pick" @click="wsPick">添加此工作区</button>
            <span v-if="wsNote" class="ws-note">{{ wsNote }}</span>
          </div>
        </div>
      </div>

      <RcToolApprove v-if="pendingApprove" :pending="pendingApprove" @decide="decideApprove" />
    </div>
  </div>
</template>

<style scoped>
/* ===== opencode 主题变量 (直接作用, 子组件继承) ===== */
.rc, .rc * { box-sizing: border-box; }
.rc {
  --font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;
  --background: #0a0a0a;
  --backgroundPanel: #141414;
  --backgroundElement: #1e1e1e;
  --bg: #1e1e1e;
  --surface: #141414;
  --panel: rgba(255,255,255,0.03);
  --border: #3c3c3c;
  --border-active: #606060;
  --text: #eeeeee;
  --text-muted: #808080;
  --primary: #fab283;
  --secondary: #5c9cf5;
  --accent: #9d7cd8;
  --success: #7fd88f;
  --warning: #f5a742;
  --error: #e06c75;
  --prompt-border: var(--secondary);
  --prompt-active: var(--primary);
  --prompt-plan: var(--accent);

  height: 100%; width: 100%; color: var(--text); background: var(--background);
  font-family: var(--font); font-size: 14px; overflow: hidden;
  padding: 0; margin: 0;
}

.app { height: 100%; width: 100%; }

/* ===== 主页 ===== */
.home-root { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 24px; }
.home-logo { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.logo-mark { display: flex; gap: 4px; }
.lm-r, .lm-c { font-size: 42px; font-weight: 800; color: var(--primary); line-height: 1; }
.lm-c { color: var(--text); }
.logo-text { font-size: 22px; color: var(--text); }
.logo-text b { font-weight: 800; }
.logo-text .code { color: var(--primary); font-weight: 800; }
.logo-sub { color: var(--text-muted); font-size: 13px; }
.home-prompt { width: 100%; max-width: 1100px; }
.home-hints { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.hint {
  border: 1px solid var(--border); background: transparent; color: var(--text-muted);
  font-size: 13px; padding: 6px 14px; border-radius: 999px; cursor: pointer; font-family: var(--font);
}
.hint:hover { color: var(--text); border-color: var(--border-active); }

/* ===== 会话页 ===== */
.session-root { height: 100%; display: flex; }
.session-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.session-head {
  display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border);
  background: var(--backgroundPanel);
}
.shead-new { border: none; background: transparent; color: var(--primary); font-weight: 700; font-size: 13px; cursor: pointer; font-family: var(--font); white-space: nowrap; }
.shead-title { flex: 1; color: var(--text); font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shead-prov { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
.shead-btn { border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-size: 12px; padding: 3px 10px; border-radius: 6px; cursor: pointer; font-family: var(--font); }
.session-chat { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.session-chat > * { flex: 1; min-height: 0; }
.session-prompt { flex-shrink: 0; padding: 8px 0 12px; }

/* 右侧栏 */
.sidebar {
  width: 232px; flex-shrink: 0; background: var(--backgroundPanel); border-left: 1px solid var(--border);
  display: flex; flex-direction: column; min-height: 0;
}
.sb-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 12px; }
.sb-title { color: var(--text); font-weight: 700; font-size: 14px; word-break: break-word; }
.sb-ws { display: flex; align-items: center; gap: 6px; margin-top: 8px; border: 1px solid var(--border); background: var(--backgroundElement); color: var(--text-muted); font-size: 12px; padding: 5px 8px; border-radius: 6px; cursor: pointer; font-family: var(--font); width: 100%; }
.ws-icon { color: var(--primary); }
.ws-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-block { margin-top: 16px; }
.sb-head { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.sb-todo { }
.sb-skills { }
.sb-empty { color: var(--text-muted); font-size: 12px; }
.sb-skill { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text); padding: 3px 0; }
.sb-skill input { accent-color: var(--accent); }
.sb-foot {
  display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--border);
}
.ft-dot { color: var(--success); font-size: 10px; }
.ft-txt { font-size: 13px; color: var(--text); font-weight: 800; }
.ft-txt .code { color: var(--primary); }
.ft-ver { color: var(--text-muted); font-size: 12px; }

/* ===== 弹窗通用 ===== */
.mask { position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; }
.dlg { background: var(--backgroundPanel); border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.dlg-sessions { width: min(480px, 92vw); height: min(560px, 80vh); }
.dlg-settings { width: min(760px, 94vw); height: min(620px, 82vh); flex-direction: row; }
.dlg-ws { width: min(440px, 92vw); max-height: 70vh; }
.dlg-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.dlg-title { font-weight: 700; color: var(--text); font-size: 14px; }
.muted { color: var(--text-muted); font-weight: 400; }
.dlg-close { border: none; background: transparent; color: var(--text-muted); font-size: 15px; cursor: pointer; font-family: var(--font); }
.dlg-new { padding: 10px 16px; }
.dlg-new-btn { width: 100%; border: 1px solid var(--primary); background: transparent; color: var(--primary); font-weight: 700; padding: 8px; border-radius: 6px; cursor: pointer; font-family: var(--font); }
.dlg-body { flex: 1; min-height: 0; display: flex; flex-direction: column; border-top: 1px solid var(--border); }
.dlg-body > * { flex: 1; min-height: 0; }

/* 设置弹窗导航 + 内容 */
.dlg-nav { width: 168px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--border); padding: 14px 10px; gap: 4px; background: var(--backgroundElement); }
.dlg-nav-title { font-weight: 800; color: var(--text); font-size: 14px; padding: 0 10px 12px; }
.dn-item { text-align: left; padding: 9px 12px; border-radius: 6px; border: none; background: transparent; color: var(--text); font-weight: 600; cursor: pointer; font-family: var(--font); font-size: 13px; }
.dn-item.on { background: var(--accent); color: #fff; }
.dn-spacer { flex: 1; }
.dn-close { text-align: center; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text); font-weight: 600; cursor: pointer; font-family: var(--font); }
.dlg-content { flex: 1; min-width: 0; overflow-y: auto; }
.settings-pane { padding: 12px 16px; }
.pane-title { font-weight: 700; color: var(--text); margin-bottom: 10px; }
.ws-item { }
.ws-item-name { width: 100%; text-align: left; border: none; background: transparent; color: var(--text-muted); font-size: 13px; padding: 7px 8px; border-radius: 6px; cursor: pointer; font-family: var(--font); word-break: break-all; }
.ws-item-name:hover { background: var(--backgroundElement); color: var(--text); }
.ws-item.on .ws-item-name { color: var(--primary); font-weight: 700; }
.ws-add { margin-top: 8px; border: 1px dashed var(--border); background: transparent; color: var(--text-muted); font-size: 13px; padding: 8px; border-radius: 6px; cursor: pointer; font-family: var(--font); width: 100%; }
.ws-add:hover { color: var(--primary); border-color: var(--primary); }

/* 工作区选择器 */
.ws-path { padding: 8px 16px; font-size: 12px; color: var(--text-muted); word-break: break-all; border-bottom: 1px solid var(--border); }
.ws-ops { padding: 8px 16px; }
.ws-btn { border: 1px solid var(--border); background: transparent; color: var(--text); width: 36px; height: 32px; border-radius: 6px; cursor: pointer; font-family: var(--font); font-size: 14px; }
.ws-btn:disabled { opacity: 0.4; }
.ws-list { flex: 1; overflow-y: auto; border-top: 1px solid var(--border); padding: 6px; }
.ws-empty { color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px; }
.ws-row { display: flex; align-items: center; padding: 2px 6px; }
.ws-go { flex: 1; text-align: left; border: none; background: transparent; color: var(--text); font-size: 13px; padding: 7px 6px; border-radius: 6px; cursor: pointer; font-family: var(--font); }
.ws-go:hover { background: var(--backgroundElement); }
.ws-sel { border: 1px solid var(--primary); background: transparent; color: var(--primary); width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-family: var(--font); }
.ws-foot { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--border); }
.ws-pick { border: none; background: var(--primary); color: #0a0a0a; font-weight: 700; padding: 9px 16px; border-radius: 6px; cursor: pointer; font-family: var(--font); }
.ws-note { color: var(--error); font-size: 12px; }

/* 记忆面板 */
.mem-desc { color: var(--text-muted); font-size: 12px; margin-bottom: 8px; }
.mem-ta {
  width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 12px; line-height: 1.5;
}
.row.end { display: flex; justify-content: flex-end; margin-top: 12px; }
.plain-btn { padding: 8px 16px; border: none; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; font-family: var(--font); }

/* 服务商 */
.prov-desc { color: var(--text-muted); font-size: 12px; margin-bottom: 10px; }
.prov-row { border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 10px; background: var(--bg); }
.prov-fields { display: flex; flex-direction: column; gap: 8px; }
.prov-in {
  padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--backgroundElement);
  color: var(--text); font-family: var(--mono); font-size: 12px; width: 100%; box-sizing: border-box;
}
.prov-in::placeholder { color: var(--text-muted); }
.prov-ops { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.prov-en { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-muted); }
.prov-btn { border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-size: 12px; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-family: var(--font); }
.prov-btn.use.on { border-color: var(--success); color: var(--success); font-weight: 700; }
.prov-btn.del:hover { border-color: var(--error); color: var(--error); }
.prov-add { margin-top: 4px; border: 1px dashed var(--border); background: transparent; color: var(--text-muted); font-size: 13px; padding: 8px; border-radius: 6px; cursor: pointer; font-family: var(--font); width: 100%; }
.prov-add:hover { color: var(--primary); border-color: var(--primary); }
</style>