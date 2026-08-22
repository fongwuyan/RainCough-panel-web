<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  config: { type: Object, default: null },
  env: { type: Object, default: null },
})
const emit = defineEmits(['save-config', 'start-agent', 'stop-agent'])

const busy = ref(false)
const note = ref('')

const apiBase = ref('')
const apiKey = ref('')
const model = ref('')
const workspace = ref('')
const agentPort = ref(8765)
const approveMode = ref('confirm')
const whitelist = ref('')

watch(() => props.config, (c) => {
  if (!c) return
  apiBase.value = c.api_base || ''
  apiKey.value = ''
  model.value = c.model || ''
  workspace.value = c.workspace || ''
  agentPort.value = c.agent_port || 8765
  approveMode.value = c.approve_mode || 'confirm'
  const wl = Array.isArray(c.whitelist) ? c.whitelist.join('\n') : ''
  whitelist.value = wl
}, { immediate: true })

function save() {
  const wl = whitelist.value.split('\n').map((x) => x.trim()).filter(Boolean)
  emit('save-config', {
    api_base: apiBase.value.trim(),
    api_key: apiKey.value.trim() || undefined,
    model: model.value.trim(),
    workspace: workspace.value,
    agent_port: Number(agentPort.value),
    approve_mode: approveMode.value,
    whitelist: wl,
  })
  note.value = '已保存'
  setTimeout(() => (note.value = ''), 2000)
}
</script>

<template>
  <div class="panel">
    <div v-if="env" class="card">
      <div class="card-title">运行环境</div>
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
      <div class="card-title">模型接入</div>
      <label>API Base(OpenAI 兼容)</label>
      <input v-model="apiBase" placeholder="如: https://api.deepseek.com/v1" />
      <label>API Key{{ props.config && props.config.has_key ? ' (已配置 ****, 留空保留)' : '' }}</label>
      <input v-model="apiKey" type="password" :placeholder="props.config && props.config.has_key ? '****' : '填写后可用'" />
      <label>模型</label>
      <input v-model="model" placeholder="如: deepseek-chat / gpt-4o" />
    </div>

    <div class="card">
      <div class="card-title">常规设置</div>
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
      <div class="row end">
        <button class="act" @click="save">保存设置</button>
        <span v-if="note" class="note">{{ note }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel { padding: 0 0 16px; }
.card { background: var(--panel, rgba(0,0,0,0.03)); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin: 12px; }
.card-title { font-weight: 700; color: var(--text); font-size: 13px; display: block; margin-bottom: 4px; }
label { display: block; font-size: 12px; font-weight: 600; color: var(--text); margin: 10px 0 4px; }
input, select, textarea {
  width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-family: var(--font); font-size: 13px;
}
textarea { resize: vertical; }
.e-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
.e-row span { color: var(--text-muted); }
.e-row b { color: var(--text); }
.e-row b.bad { color: var(--error); }
.e-row b.wrk { max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row { display: flex; gap: 8px; align-items: center; }
.row.end { justify-content: flex-end; margin-top: 12px; }
.act { padding: 8px 16px; border: none; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; font-family: var(--font); }
.act.warn { background: var(--error); }
.note { font-size: 12px; color: var(--success); margin-left: 8px; }
</style>