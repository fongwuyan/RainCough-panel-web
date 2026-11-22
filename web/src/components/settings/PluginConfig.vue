<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const plugins = ref([])
const cur = ref('')
const text = ref('{\n}')
const loading = ref(false)
const saving = ref(false)
const err = ref('')
const ok = ref('')

async function loadList() {
  try {
    const d = await api.pluginConfigList()
    plugins.value = (d && d.plugins) || []
    if (!cur.value && plugins.value.length) await open(plugins.value[0].name)
  } catch (e) { err.value = e.message || String(e) }
}

async function open(name) {
  cur.value = name; loading.value = true; err.value = ''; ok.value = ''
  try {
    const d = await api.pluginConfigGet(name)
    text.value = d && d.config ? JSON.stringify(d.config, null, 2) : '{\n}'
  } catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}

async function save() {
  if (!cur.value) return
  let obj
  try { obj = JSON.parse(text.value) } catch (e) { err.value = 'JSON 无效: ' + e.message; return }
  saving.value = true; err.value = ''; ok.value = ''
  try {
    await api.pluginConfigSave(cur.value, obj)
    ok.value = '已保存，插件重新加载配置后生效'
  } catch (e) { err.value = e.message || String(e) }
  finally { saving.value = false }
}

onMounted(loadList)
</script>

<template>
  <div class="page pcfg-page">
    <div class="pcfg-head">
      <div><h1>插件配置</h1><p class="sub">面板统一读写插件根目录 config.json；不接触插件业务代码</p></div>
      <button class="btn" :disabled="loading" @click="loadList">刷新</button>
    </div>
    <div v-if="err" class="error">{{ err }}</div>
    <div v-if="ok" class="ok-msg">{{ ok }}</div>
    <div class="pcfg-layout">
      <aside class="pcfg-list">
        <div v-for="p in plugins" :key="p.name" class="pcfg-item" :class="{ active: cur === p.name }" @click="open(p.name)">
          <b>{{ p.name }}</b>
          <span class="faint">{{ p.has_config ? '有配置' : '无配置' }}</span>
        </div>
        <div v-if="!plugins.length" class="hint" style="padding:12px;">没有插件</div>
      </aside>
      <section class="pcfg-main">
        <div class="pcfg-toolbar">
          <b>{{ cur || '未选择插件' }}</b>
          <span class="faint">保存后重载插件生效</span>
          <button class="btn btn-primary btn-sm" :disabled="saving || !cur" @click="save">{{ saving ? '保存中…' : '保存配置' }}</button>
        </div>
        <textarea v-model="text" class="pcfg-editor" spellcheck="false" :disabled="!cur || loading"></textarea>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pcfg-page { padding: 18px 22px 28px; }
.pcfg-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.pcfg-head h1 { margin: 0; font-size: 22px; }
.pcfg-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.ok-msg { color: #2f9e44; font-size: 12px; margin: 8px 0; }
.pcfg-layout { display: grid; grid-template-columns: 220px 1fr; gap: 12px; margin-top: 14px; min-height: 480px; }
.pcfg-list { border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); overflow: auto; }
.pcfg-item { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-bottom: 1px solid var(--border); cursor: pointer; font-size: 12px; }
.pcfg-item.active { background: var(--accent-soft); color: var(--accent); }
.pcfg-main { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); overflow: hidden; }
.pcfg-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 12px; }
.pcfg-toolbar .faint { margin-right: auto; font-size: 11px; }
.pcfg-editor { flex: 1; min-height: 440px; border: 0; resize: vertical; padding: 10px; font-family: var(--mono); font-size: 12px; background: var(--bg2); color: var(--text); outline: none; }
@media (max-width: 800px) { .pcfg-layout { grid-template-columns: 1fr; } .pcfg-list { max-height: 160px; } }
</style>
