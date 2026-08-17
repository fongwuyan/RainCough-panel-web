<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  config: { type: Object, default: null },
  env: { type: Object, default: null },
  models: { type: Array, default: () => [] },
  modelSource: { type: String, default: 'fallback' },
  skills: { type: Array, default: () => [] },
})
const emit = defineEmits([
  'close', 'save-config', 'start-agent', 'stop-agent',
  'save-skill', 'delete-skill', 'toggle-skill',
])

const tab = ref('cfg')
const busy = ref(false)
const note = ref('')

const apiBase = ref('https://opencode.ai/zen/v1')
const apiKey = ref('')
const model = ref('deepseek-v4-flash-free')
const workspace = ref('')
const agentPort = ref(8765)
const approveMode = ref('confirm')
const whitelist = ref('')

const skName = ref('')
const skTitle = ref('')
const skDesc = ref('')
const skInstr = ref('')
const editName = ref('')

watch(() => props.config, (c) => {
  if (!c) return
  apiBase.value = c.api_base || 'https://opencode.ai/zen/v1'
  apiKey.value = ''
  model.value = c.model || 'deepseek-v4-flash-free'
  workspace.value = c.workspace || ''
  agentPort.value = c.agent_port || 8765
  approveMode.value = c.approve_mode || 'confirm'
  const wl = Array.isArray(c.whitelist) ? c.whitelist.join('\n') : ''
  whitelist.value = wl
}, { immediate: true })

function save() {
  const wl = whitelist.value.split('\n').map((x) => x.trim()).filter(Boolean)
  emit('save-config', {
    api_base: apiBase.value,
    api_key: apiKey.value || undefined,
    model: model.value,
    workspace: workspace.value,
    agent_port: Number(agentPort.value),
    approve_mode: approveMode.value,
    whitelist: wl,
  })
  note.value = '已保存'
  setTimeout(() => (note.value = ''), 2000)
}

function editSkill(s) {
  editName.value = s.name
  skName.value = s.name
  skTitle.value = s.title
  skDesc.value = s.description
  tab.value = 'skill-form'
}
function startSkillForm() {
  editName.value = ''
  skName.value = ''
  skTitle.value = ''
  skDesc.value = ''
  skInstr.value = ''
  tab.value = 'skill-form'
}
function saveSkill() {
  if (!skName.value.trim() || !skInstr.value.trim()) { note.value = '技能名与内容不能为空'; setTimeout(() => (note.value = ''), 2000); return }
  emit('save-skill', {
    name: skName.value.trim(),
    title: skTitle.value.trim() || skName.value.trim(),
    description: skDesc.value.trim(),
    instructions: skInstr.value,
  })
  tab.value = 'skill'
}
</script>

<template>
  <div v-if="open" class="drawer">
    <div class="d-head">
      <div class="tabs">
        <button :class="{ on: tab === 'cfg' }" @click="tab = 'cfg'">设置</button>
        <button :class="{ on: tab === 'skill' || tab === 'skill-form' }" @click="tab = 'skill'">技能</button>
      </div>
      <button class="close" @click="emit('close')">✕</button>
    </div>

    <div class="d-body">
      <template v-if="tab === 'cfg'">
        <div v-if="env" class="env card">
          <div class="e-row"><span>Node.js</span><b :class="{ bad: !env.node.ok }">{{ env.node.version || '未安装' }}</b></div>
          <div class="e-row"><span>Agent 服务</span><b :class="{ bad: !env.agent.running }">{{ env.agent.running ? '运行中' : '未运行' }}</b></div>
          <div class="e-row"><span>端口</span><b>{{ env.agent.port }}</b></div>
          <div class="e-row"><span>工作区</span><b class="wrk">{{ env.workspace }}</b></div>
          <div class="row">
            <button class="act" @click="emit('start-agent')">启动 Agent</button>
            <button class="act warn" @click="emit('stop-agent')">停止</button>
          </div>
        </div>

        <div class="card">
          <label>API Base(OpenAI 兼容)</label>
          <input v-model="apiBase" />
          <label>API Key(留空保留已保存)</label>
          <input v-model="apiKey" type="password" :placeholder="config && config.hasKey ? '已配置 (****)' : '填写后可用'" />
          <label>默认模型</label>
          <select v-model="model">
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name || m.id }}</option>
          </select>
          <div v-if="modelSource === 'fallback'" class="ms-note">离线默认列表(在线拉取需可用 Key 且能访问外网)</div>
          <label>工作区目录(agent 可读写范围)</label>
          <input v-model="workspace" />
          <label>Agent 端口</label>
          <input v-model.number="agentPort" type="number" />
          <label>默认审批方式</label>
          <select v-model="approveMode">
            <option value="auto">自动执行</option>
            <option value="confirm">手动确认</option>
            <option value="whitelist">白名单</option>
          </select>
          <label>白名单命令(每行一条, 前缀匹配)</label>
          <textarea v-model="whitelist" rows="5" placeholder="如:&#10;npm run&#10;git status&#10;ls"></textarea>
        </div>

        <div class="row end">
          <button class="act" @click="save">保存设置</button>
          <span v-if="note" class="note toggleref">{{ note }}</span>
        </div>
      </template>

      <template v-else-if="tab === 'skill'">
        <div class="row end">
          <button class="act" @click="startSkillForm">+ 新建技能</button>
        </div>
        <div v-if="!skills.length" class="empty card">暂无技能</div>
        <div v-for="s in skills" :key="s.name" class="add card">
          <div class="add-top">
            <input type="checkbox" :checked="s.enabled" @change="emit('toggle-skill', s.name, $event.target.checked)" />
            <b>{{ s.title }}</b>
            <span class="s-id">{{ s.name }}</span>
          </div>
          <div class="add-desc">{{ s.description || '—' }}</div>
          <div class="add-ops">
            <button class="m" @click="editSkill(s)">编辑</button>
            <button class="m warn" @click="emit('delete-skill', s.name)">删除</button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="card">
          <label>技能名(字母数字_-)</label>
          <input v-model="skName" :disabled="!!editName" />
          <label>标题</label>
          <input v-model="skTitle" placeholder="显示名称" />
          <label>描述</label>
          <input v-model="skDesc" placeholder="用于列表展示" />
          <label>技能内容(注入系统提示的指令, Markdown)</label>
          <textarea v-model="skInstr" rows="8" placeholder="# 技能说明&#10;当用户… 时, 你应该…"></textarea>
          <div class="row end">
            <button class="act" @click="saveSkill">保存技能</button>
            <button class="act ghost" @click="tab = 'skill'">返回</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.drawer {
  position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 92vw); z-index: 50;
  background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.15);
}
.d-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border); }
.tabs { display: flex; gap: 4px; }
.tabs button { padding: 6px 14px; border: none; background: transparent; color: var(--text-muted); font-weight: 600; cursor: pointer; font-family: var(--font); border-radius: 8px; }
.tabs button.on { background: var(--accent); color: #fff; }
.close { border: none; background: transparent; color: var(--text); cursor: pointer; font-size: 16px; }
.d-body { flex: 1; overflow-y: auto; padding: 14px; }
.card { background: var(--panel, rgba(0,0,0,0.03)); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
label { display: block; font-size: 12px; font-weight: 600; color: var(--text); margin: 10px 0 4px; }
input, select, textarea {
  width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-family: var(--font); font-size: 13px;
}
textarea { resize: vertical; }
.env .e-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
.env .e-row span { color: var(--text-muted); }
.env .e-row b { color: var(--text); }
.env .e-row b.bad { color: #e05c5c; }
.env .e-row b.wrk { max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row { display: flex; gap: 8px; align-items: center; }
.row.end { justify-content: flex-end; margin-top: 12px; }
.act { padding: 8px 16px; border: none; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; font-family: var(--font); }
.act.warn { background: #e05c5c; }
.act.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
.ms-note { font-size: 11px; color: #e0a000; margin-top: 4px; }
.note { font-size: 12px; color: #1a7f37; margin-left: 8px; }
.add { }
.add-top { display: flex; align-items: center; gap: 8px; }
.add-top b { color: var(--text); }
.s-id { font-size: 11px; color: var(--text-muted); }
.add-desc { font-size: 12px; color: var(--text-muted); margin: 6px 0; }
.add-ops { display: flex; gap: 6px; }
.m { padding: 4px 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; font-family: var(--font); }
.m.warn { color: #e05c5c; border-color: #e05c5c; }
.empty { color: var(--text-muted); font-size: 13px; }
</style>