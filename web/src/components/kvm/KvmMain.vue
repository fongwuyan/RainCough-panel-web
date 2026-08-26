<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'
import KvmList from './KvmList.vue'
import KvmDetail from './KvmDetail.vue'
import KvmCreate from './KvmCreate.vue'
import KvmStorage from './KvmStorage.vue'
import KvmConfig from './KvmConfig.vue'

const info = ref({})
const loading = ref(false)
const error = ref('')

const tab = ref('list')
const tabs = [
  { key: 'list', label: '虚拟机' },
  { key: 'create', label: '创建' },
  { key: 'storage', label: '存储' },
  { key: 'config', label: '设置' },
]

const detailName = ref(null)

async function load() {
  loading.value = true; error.value = ''
  try {
    info.value = (await api.kvInfo()) || {}
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}

onMounted(load)

function switchTab(key) {
  tab.value = key
  if (key === 'list') load()
}

function openDetail(d) {
  detailName.value = d.name
}

function backToList() {
  detailName.value = null
}
</script>

<template>
  <div>
    <h1>KVM 虚拟机</h1>
    <div class="subtitle">KVM/QEMU 虚拟机管理：列表、启停、详情、创建、VNC 控制台、存储池与镜像</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>

    <div class="section" style="margin-top:16px;">
      <div class="section-title">概览</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;">
        <span v-if="info.libvirt" class="tag-chip">libvirt {{ info.libvirt }}</span>
        <span v-if="info.qemu" class="tag-chip">{{ info.qemu }}</span>
        <span class="tag-chip ok">运行中 {{ info.domains_running || 0 }}</span>
        <span class="tag-chip">虚拟机 {{ info.domains_total || 0 }}</span>
        <span class="tag-chip">存储池 {{ info.pools || 0 }}</span>
      </div>
    </div>

    <div class="tabs" style="margin-top:16px;">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
    </div>

    <div v-if="tab === 'list'">
      <KvmList v-if="!detailName" @open="openDetail" />
      <KvmDetail v-else :name="detailName" @back="backToList" />
    </div>
    <KvmCreate v-else-if="tab === 'create'" @created="() => { switchTab('list'); }" />
    <KvmStorage v-else-if="tab === 'storage'" />
    <KvmConfig v-else-if="tab === 'config'" />
  </div>
</template>
