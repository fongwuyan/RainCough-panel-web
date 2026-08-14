<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const images = ref([])
const storage = ref(null)
const storageLoading = ref(false)
const error = ref('')

onMounted(() => loadStorage())

async function loadImages() {
  try { images.value = (await api.kvImages()) || [] } catch (err) { error.value = err.message }
}

async function loadStorage() {
  storageLoading.value = true; error.value = ''
  try {
    const s = await api.kvStorage()
    storage.value = s || null
    if (!images.value.length) images.value = (await api.kvImages()) || []
  } catch (err) { error.value = err.message }
  finally { storageLoading.value = false }
}

function fmtSize(n) {
  if (!n) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return v.toFixed(1) + ' ' + units[i]
}
</script>

<template>
  <div class="section" style="margin-top:16px;">
    <div class="section-title">存储池</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="storageLoading" class="loading" style="margin-top:8px;"><div class="spinner"></div></div>
    <template v-else-if="storage">
      <div v-for="p in storage.pools" :key="p.name" class="section" style="margin-top:12px;">
        <div class="section-title">{{ p.name }} <span class="tag-chip" :class="p.state === '活动' ? 'ok' : ''">{{ p.state }}</span>
          <span class="tag-chip">自动启动: {{ p.autostart === '是' ? '开' : '关' }}</span></div>
        <div v-if="!storage.volumes[p.name] || !storage.volumes[p.name].length" class="hint" style="margin-top:6px;">空</div>
        <div v-else>
          <div v-for="v in storage.volumes[p.name]" :key="v.name" class="result-item" style="cursor:default;margin-bottom:6px;" @click.stop>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span class="name" style="font-size:13px;">{{ v.name }}</span>
              <span class="meta" style="font-size:11px;">{{ v.path }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div v-else-if="!storageLoading" class="hint" style="margin-top:8px;">无法读取存储信息</div>

    <div class="section" style="margin-top:16px;">
      <div class="section-title">镜像 ({{ images.length }})</div>
      <div v-if="!images.length" class="hint" style="margin-top:6px;">空</div>
      <div v-else>
        <div v-for="i in images" :key="i.name" class="result-item" style="cursor:default;margin-bottom:6px;" @click.stop>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="name" style="font-size:13px;">{{ i.name }}</span>
            <span class="meta" style="font-size:11px;">{{ fmtSize(i.size) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
