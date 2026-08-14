<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useUi } from '../stores/ui'
import { usePlugins } from '../stores/plugins'
import { api } from '../api'
import StoreProject from './store/StoreProject.vue'

const { theme, setTheme } = useUi()
const { plugins, load } = usePlugins()

const storage = ref(null)
const status = ref('')
const statusOk = ref(false)
const activeCat = ref('appearance')

// 插件可插拔设置
const pluginSettings = ref({})
const pluginSettingsLoaded = ref(false)
const psStatus = ref('')
const psOk = ref(false)

const navItems = computed(() => {
  const arr = [{ key: 'appearance', label: '外观' }]
  arr.push({ key: 'project', label: '面板更新' })
  arr.push({ key: 'plugins', label: '插件设置' })
  if (storage.value) {
    for (const key of Object.keys(storage.value)) {
      arr.push({ key: `storage:${key}`, label: storage.value[key].label || key })
    }
  }
  return arr
})

const activeStorageKey = computed(() => {
  if (!activeCat.value.startsWith('storage:')) return null
  return activeCat.value.slice('storage:'.length)
})

async function loadStorage() {
  try {
    storage.value = await api.sysStorage()
  } catch (e) {}
}

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
  try {
    await api.pluginSettingsSave(name, ps.values)
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

function isActive(plugin, path) {
  return (storage.value[plugin].active_path || '') === path
}

function pathStatus(p) {
  if (!p.exists) return 'missing'
  if (p.percent >= 90) return 'full'
  if (p.percent >= 75) return 'warn'
  return 'ok'
}

async function savePlugin(plugin) {
  const sp = storage.value[plugin]
  try {
    await api.saveStorage(plugin, {
      storage_paths: sp.paths.map(x => x.path),
      active_path: sp.active_path,
      auto_switch_full: !!sp.auto_switch_full,
      full_threshold_mb: parseInt(sp.full_threshold_mb) || 0,
    })
    await loadStorage()
    status.value = '设置已保存'
    statusOk.value = true
    setTimeout(() => { status.value = '' }, 2000)
  } catch (e) {
    status.value = `保存失败: ${e.message}`
    statusOk.value = false
  }
}

function addPath(plugin) {
  const sp = storage.value[plugin]
  const input = document.getElementById(`path-input-${plugin}`)
  const v = input ? input.value.trim() : ''
  if (!v) return
  sp.paths.push({ path: v, exists: false, total: 0, used: 0, free: 0, percent: 0 })
  input.value = ''
}

function removePath(plugin, idx) {
  const sp = storage.value[plugin]
  const removed = sp.paths[idx].path
  sp.paths.splice(idx, 1)
  if (sp.active_path === removed) {
    sp.active_path = sp.paths.length ? sp.paths[0].path : ''
  }
}

function movePath(plugin, idx, dir) {
  const sp = storage.value[plugin]
  const to = idx + dir
  if (to < 0 || to >= sp.paths.length) return
  const arr = sp.paths
  ;[arr[idx], arr[to]] = [arr[to], arr[idx]]
}

onMounted(loadStorage)
watch(activeCat, (c) => { if (c === 'plugins') loadPluginSettings() })
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>设置</h1>
      <div class="subtitle">界面主题与存储位置</div>
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

          <div v-else-if="activeCat === 'project'" class="section">
            <StoreProject />
          </div>

          <div v-else-if="activeCat === 'plugins'" class="section">
            <div class="section-title">插件设置</div>
            <div v-if="!Object.keys(pluginSettings).length" class="hint" style="padding:12px;">
              {{ pluginSettingsLoaded ? '暂无提供设置项的插件' : '加载中...' }}
            </div>
            <div v-for="(ps, name) in pluginSettings" :key="name" style="margin-bottom:24px;">
              <div style="font-size:13px;font-weight:700;margin-bottom:8px;">{{ ps.label }} <span style="font-family:var(--font-mono);color:var(--text-faint);font-size:11px;">{{ name }}</span></div>
              <div v-for="s in ps.schema" :key="s.key" class="settings-item">
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
              <div style="margin-top:10px;">
                <button class="btn btn-primary btn-sm" @click="savePluginSettings(name)">保存{{ ps.label }}</button>
              </div>
            </div>
            <div v-if="psStatus" class="status-line" :class="psOk ? 'ok' : 'fail'" style="margin-top:8px;">{{ psStatus }}</div>
          </div>

          <div v-else-if="activeStorageKey && storage && storage[activeStorageKey]" class="section">
            <div class="section-title">存储位置</div>
            <div v-for="(sp, key) in storage" :key="key" v-show="key === activeStorageKey" style="margin-bottom:24px;">
              <div style="font-size:13px;font-weight:700;margin-bottom:10px;">{{ sp.label }}</div>

              <div style="display:flex;gap:8px;margin-bottom:10px;">
                <input :id="`path-input-${key}`" class="input" type="text"
                       placeholder="/mnt/storage/..." style="flex:1;"
                       @keyup.enter="addPath(key)" />
                <button class="btn btn-sm" @click="addPath(key)">添加路径</button>
              </div>

              <div v-for="(p, idx) in sp.paths" :key="p.path"
                   style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
                <input type="radio" :checked="isActive(key, p.path)"
                       @change="sp.active_path = p.path"
                       style="accent-color:var(--accent);" :title="'设为写入路径'" />
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-family:var(--font-mono);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                       :title="p.path">{{ p.path }}</div>
                  <div style="font-size:11px;color:var(--text-faint);font-family:var(--font-mono);">
                    <template v-if="p.exists">{{ fmtBytes(p.used) }} / {{ fmtBytes(p.total) }}
                      <span :style="{ color: p.percent >= 75 ? 'var(--danger)' : 'var(--text-faint)' }">({{ p.percent }}%)</span>
                    </template>
                    <template v-else><span style="color:var(--danger);">路径不存在</span></template>
                  </div>
                  <div v-if="p.exists" class="progress" style="margin-top:4px;">
                    <div :style="{ width: Math.min(100, Math.max(0, p.percent)) + '%' }"></div>
                  </div>
                </div>
                <button class="btn btn-sm" title="上移" @click="movePath(key, idx, -1)">↑</button>
                <button class="btn btn-sm" title="下移" @click="movePath(key, idx, 1)">↓</button>
                <button class="btn btn-sm btn-danger" title="移除" @click="removePath(key, idx)">✕</button>
              </div>

              <div class="settings-item" style="margin-top:12px;border:none;">
                <label>满盘自动切换</label>
                <label class="switch">
                  <input v-model="sp.auto_switch_full" type="checkbox" />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="settings-item" style="border:none;">
                <label>切换阈值 (MB)</label>
                <input v-model.number="sp.full_threshold_mb" class="input" type="number" min="0" style="width:90px;text-align:center;" />
                <span class="hint" style="display:inline;padding:0;margin-left:8px;">剩余空间低于该值时自动换到下一路径</span>
              </div>

              <div style="margin-top:10px;">
                <button class="btn btn-primary btn-sm" @click="savePlugin(key)">保存{{ sp.label }}</button>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:12px;">
              <button class="btn btn-primary" @click="loadStorage">刷新</button>
              <span v-if="status" class="status-line" :class="statusOk ? 'ok' : 'fail'">{{ status }}</span>
            </div>
          </div>

          <div v-else class="empty">加载中...</div>
        </div>
      </div>
    </div>
  </div>
</template>
