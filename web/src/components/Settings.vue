<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUi } from '../stores/ui'
import { usePlugins } from '../stores/plugins'
import { api } from '../api'
import StoreProject from './store/StoreProject.vue'

const { theme, setTheme } = useUi()
const { plugins, load } = usePlugins()

const activeCat = ref('appearance')

// 插件可插拔设置(含各插件的存储路径管理)
const pluginSettings = ref({})
const pluginSettingsLoaded = ref(false)
const psStatus = ref('')
const psOk = ref(false)

const navItems = computed(() => {
  const arr = [{ key: 'appearance', label: '外观' }]
  arr.push({ key: 'project', label: '面板更新' })
  arr.push({ key: 'plugins', label: '插件设置' })
  return arr
})

async function loadPluginSettings() {
  if (pluginSettingsLoaded.value) return
  if (!plugins.value.length) await load()
  const list = plugins.value.filter((x) => x.name !== 'filemanager')
  pluginSettings.value = {}
  await Promise.all(list.map(async (p) => {
    try {
      const d = await api.pluginSettingsGet(p.name)
      if (d.schema && d.schema.length) {
        pluginSettings.value[p.name] = {
          label: p.label || p.name,
          schema: d.schema,
          values: d.values || {},
        }
      }
    } catch (e) {}
  }))
  pluginSettingsLoaded.value = true
}

async function savePluginSettings(name) {
  const ps = pluginSettings.value[name]
  if (!ps) return
  const payload = { ...ps.values }
  if (Array.isArray(payload.storage_paths)) {
    payload.storage_paths = payload.storage_paths
      .map((x) => (typeof x === 'string' ? x : x.path)).filter(Boolean)
  }
  try {
    await api.pluginSettingsSave(name, payload)
    psStatus.value = '已保存'
    psOk.value = true
    setTimeout(() => { psStatus.value = '' }, 2000)
  } catch (e) {
    psStatus.value = `保存失败: ${e.message}`
    psOk.value = false
  }
}

function fmtBytes(b) {
  if (!b) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(1)} ${units[i]}`
}

function addStoragePath(name) {
  const ps = pluginSettings.value[name]
  if (!ps || !Array.isArray(ps.values.storage_paths)) return
  const input = document.getElementById(`path-input-${name}`)
  const v = input ? input.value.trim() : ''
  if (!v) return
  ps.values.storage_paths.push({ path: v, exists: false, total: 0, used: 0, free: 0, percent: 0 })
  input.value = ''
}

function removeStoragePath(name, idx) {
  const ps = pluginSettings.value[name]
  const removed = ps.values.storage_paths[idx].path
  ps.values.storage_paths.splice(idx, 1)
  if (ps.values.active_path === removed) {
    ps.values.active_path = ps.values.storage_paths.length ? ps.values.storage_paths[0].path : ''
  }
}

function moveStoragePath(name, idx, dir) {
  const arr = pluginSettings.value[name].values.storage_paths
  const to = idx + dir
  if (to < 0 || to >= arr.length) return
  ;[arr[idx], arr[to]] = [arr[to], arr[idx]]
}

onMounted(loadPluginSettings)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>设置</h1>
      <div class="subtitle">界面主题、面板更新与插件设置</div>
    </div>

    <div class="page-body">
      <div class="settings-layout">
        <nav class="settings-nav">
          <button
            v-for="item in navItems"
            :key="item.key"
            class="nav-item"
            :class="{ active: activeCat === item.key }"
            @click="activeCat = item.key"
          >{{ item.label }}</button>
        </nav>

        <div class="settings-pane">
          <div v-if="activeCat === 'appearance'" class="section">
            <div class="section-title">外观</div>
            <div class="settings-item">
              <label>主题模式</label>
              <div class="control">
                <button class="btn" :class="theme === 'dark' ? 'btn-primary' : ''" @click="setTheme('dark')">深色</button>
                <button class="btn" :class="theme === 'light' ? 'btn-primary' : ''" @click="setTheme('light')">浅色</button>
              </div>
            </div>
          </div>

          <div v-else-if="activeCat === 'plugins'" class="section">
            <div class="section-title">插件设置</div>
            <div v-if="!Object.keys(pluginSettings).length" class="hint" style="padding:12px;">
              {{ pluginSettingsLoaded ? '暂无提供设置项的插件' : '加载中...' }}
            </div>
            <div v-for="(ps, name) in pluginSettings" :key="name" style="margin-bottom:24px;">
              <div style="font-size:13px;font-weight:700;margin-bottom:8px;">{{ ps.label }} <span style="font-family:var(--font-mono);color:var(--text-faint);font-size:11px;">{{ name }}</span></div>
              <div v-for="s in ps.schema" :key="s.key">
                <div v-if="s.type === 'paths'" class="settings-item" style="flex-direction:column;align-items:stretch;margin-bottom:12px;">
                  <label>{{ s.label }}</label>
                  <div style="display:flex;gap:8px;">
                    <input :id="`path-input-${name}`" class="input" type="text"
                           placeholder="/mnt/storage/..." style="flex:1;"
                           @keyup.enter="addStoragePath(name)" />
                    <button class="btn btn-sm" @click="addStoragePath(name)">添加路径</button>
                  </div>
                  <div v-for="(p, idx) in (ps.values.storage_paths || [])" :key="idx"
                       style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
                    <input type="radio" :checked="ps.values.active_path === p.path"
                           @change="ps.values.active_path = p.path"
                           style="accent-color:var(--accent);" title="设为写入路径" />
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:13px;font-family:var(--font-mono);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                           :title="p.path">{{ p.path }}</div>
                      <div style="font-size:11px;color:var(--text-faint);font-family:var(--font-mono);">
                        <template v-if="p.exists">{{ fmtBytes(p.used) }} / {{ fmtBytes(p.total) }}
                          <span :style="{ color: p.percent >= 75 ? 'var(--danger)' : 'var(--text-faint)' }">({{ p.percent }}%)</span></template>
                        <template v-else><span style="color:var(--danger);">路径不存在</span></template>
                      </div>
                      <div v-if="p.exists" class="progress" style="margin-top:4px;">
                        <div :style="{ width: Math.min(100, Math.max(0, p.percent)) + '%' }"></div>
                      </div>
                    </div>
                    <button class="btn btn-sm" title="上移" @click="moveStoragePath(name, idx, -1)">↑</button>
                    <button class="btn btn-sm" title="下移" @click="moveStoragePath(name, idx, 1)">↓</button>
                    <button class="btn btn-sm btn-danger" title="移除" @click="removeStoragePath(name, idx)">✕</button>
                  </div>
                </div>
                <div v-else class="settings-item">
                  <label>{{ s.label }} <span v-if="s.help" class="hint" style="display:inline;padding:0;margin-left:6px;font-size:11px;">{{ s.help }}</span></label>
                  <div class="control">
                    <input
                      v-if="s.type === 'text'"
                      v-model="ps.values[s.key]"
                      class="input" type="text" :placeholder="s.placeholder || ''" style="min-width:220px;" />
                    <input
                      v-else-if="s.type === 'number'"
                      v-model.number="ps.values[s.key]"
                      class="input" type="number" style="width:110px;text-align:center;" />
                    <select
                      v-else-if="s.type === 'select'"
                      v-model="ps.values[s.key]"
                      class="select">
                      <option v-for="opt in (s.options || [])" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                    <label v-else-if="s.type === 'switch'" class="switch">
                      <input v-model="ps.values[s.key]" type="checkbox" />
                      <span class="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
              <div style="margin-top:10px;">
                <button class="btn btn-primary btn-sm" @click="savePluginSettings(name)">保存{{ ps.label }}</button>
              </div>
            </div>
            <div v-if="psStatus" class="status-line" :class="psOk ? 'ok' : 'fail'" style="margin-top:8px;">{{ psStatus }}</div>
          </div>

          <div v-else-if="activeCat === 'project'" class="section">
            <StoreProject />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
