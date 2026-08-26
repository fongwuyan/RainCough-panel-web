<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const emit = defineEmits(['created'])

const images = ref([])
const error = ref('')
const notice = ref('')
const creating = ref(false)

const form = ref({
  name: '', vcpu: 2, memory_mb: 2048,
  template: '', iso: '', seed_user: '', seed_pw: '',
  network: 'default', start: true,
})

onMounted(() => loadImages())

async function loadImages() {
  try { images.value = (await api.kvImages()) || [] } catch (err) { error.value = err.message }
}

async function createVm() {
  if (!form.value.name.trim()) { error.value = '请输入虚拟机名称'; return }
  if (!form.value.template && !form.value.iso) { error.value = '请选择模板镜像或 ISO'; return }
  creating.value = true; error.value = ''
  try {
    const r = await api.kvCreate({ ...form.value, name: form.value.name.trim() })
    notice.value = `已创建 ${r.name}${r.started ? ' 并启动' : ''}`
    setTimeout(() => { notice.value = '' }, 4000)
    resetForm()
    emit('created', r.name)
  } catch (err) { error.value = err.message }
  finally { creating.value = false }
}

function resetForm() {
  form.value.name = ''; form.value.vcpu = 2; form.value.memory_mb = 2048
  form.value.template = ''; form.value.iso = ''; form.value.seed_user = ''
  form.value.seed_pw = ''; form.value.network = 'default'; form.value.start = true
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
    <div class="section-title">创建虚拟机</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin-top:12px;">{{ notice }}</div>

    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;">
      <div style="flex:1;min-width:280px;">
        <div class="form-row"><span class="form-label">名称</span>
          <input v-model="form.name" class="input" style="flex:1;" placeholder="如 testvm" /></div>
        <div class="form-row"><span class="form-label">CPU 核数</span>
          <input v-model.number="form.vcpu" type="number" min="1" max="64" class="input" style="flex:1;" /></div>
        <div class="form-row"><span class="form-label">内存 MB</span>
          <input v-model.number="form.memory_mb" type="number" min="512" step="512" class="input" style="flex:1;" /></div>
        <div class="form-row"><span class="form-label">网络</span>
          <input v-model="form.network" class="input" style="flex:1;" placeholder="default" /></div>
      </div>
      <div style="flex:1;min-width:280px;">
        <div class="form-row"><span class="form-label">模板镜像</span>
          <select v-model="form.template" class="input" style="flex:1;">
            <option value="">无（全新空磁盘）</option>
            <option v-for="i in images" :key="i.name" :value="i.name">{{ i.name }} ({{ fmtSize(i.size) }})</option>
          </select></div>
        <div class="form-row"><span class="form-label">ISO 镜像</span>
          <select v-model="form.iso" class="input" style="flex:1;">
            <option value="">无</option>
            <option v-for="i in images" :key="i.name" :value="i.name">{{ i.name }}</option>
          </select></div>
        <div class="form-row"><span class="form-label">Seed 用户</span>
          <input v-model="form.seed_user" class="input" style="flex:1;" placeholder="cloud-init 用户名（可空）" /></div>
        <div class="form-row"><span class="form-label">Seed 密码</span>
          <input v-model="form.seed_pw" type="password" class="input" style="flex:1;" placeholder="cloud-init 密码（可空）" /></div>
      </div>
    </div>
    <div style="margin-top:12px;">
      <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
        <input type="checkbox" v-model="form.start" /> 创建后立即启动
      </label>
    </div>
    <div style="margin-top:12px;">
      <button class="btn btn-primary" :disabled="creating" @click="createVm">{{ creating ? '创建中...' : '创建虚拟机' }}</button>
    </div>
    <div class="hint" style="font-size:11px;margin-top:8px;">模板镜像将以覆盖(backing file)方式快速创建磁盘；填 Seed 用户/密码时会生成 cloud-init 镜像注入。</div>
  </div>
</template>
