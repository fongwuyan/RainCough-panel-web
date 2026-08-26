<script setup>
import { ref } from 'vue'
import { useUi } from '../stores/ui'
import { usePlugins } from '../stores/plugins'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'

const { installOpen } = useUi()
const { plugins, find, load } = usePlugins()
const route = useRoute()
const router = useRouter()

const fileName = ref('')
const status = ref('')
const statusOk = ref(false)
const busy = ref(false)
const fileInput = ref(null)

function pickFile(e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  if (!f.name.toLowerCase().endsWith('.zip')) {
    status.value = '仅支持 .zip 文件'
    statusOk.value = false
    return
  }
  fileName.value = f.name
  status.value = `已选择: ${f.name}`
  statusOk.value = true
}

async function install() {
  const f = fileInput.value && fileInput.value.files[0]
  if (!f || busy.value) return
  busy.value = true
  status.value = '正在安装...'
  statusOk.value = false
  try {
    await api.installPlugin(f)
    status.value = '安装成功'
    statusOk.value = true
    await load()
    setTimeout(() => {
      installOpen.value = false
      fileName.value = ''
      status.value = ''
      if (route.name === 'plugin' && !find(String(route.params.name))) {
        router.push('/')
      }
    }, 1200)
  } catch (e) {
    status.value = `安装失败: ${e.message}`
    statusOk.value = false
  } finally {
    busy.value = false
  }
}

function onDrop(e) {
  const f = e.dataTransfer.files && e.dataTransfer.files[0]
  if (f) pickFile({ target: { files: [f] } })
}
</script>

<template>
  <transition name="fade">
    <div v-if="installOpen" class="overlay" @click.self="installOpen = false">
      <div class="modal" style="max-width:420px;">
        <div class="modal-header">
          <h2>安装插件</h2>
          <button class="btn btn-ghost btn-sm" @click="installOpen = false">关闭</button>
        </div>
        <div class="modal-body">
          <p class="hint" style="margin-bottom:10px;">上传插件的 ZIP 压缩包，插件将自动安装到系统中。</p>
          <p class="hint" style="margin-bottom:16px;">插件包内需包含 <code>plugin.py</code> 文件。</p>
          <div
            class="dropzone"
            @click="fileInput.click()"
            @dragover.prevent="$event.currentTarget.classList.add('dragover')"
            @dragleave.prevent="$event.currentTarget.classList.remove('dragover')"
            @drop.prevent="onDrop"
          >
            <p>点击选择或拖拽 ZIP 文件到此处</p>
          </div>
          <input ref="fileInput" type="file" accept=".zip" hidden @change="pickFile" />
          <div class="status-line" :style="{ marginTop: '10px', color: statusOk ? 'var(--success)' : 'var(--danger)' }">{{ status }}</div>
        </div>
        <div v-if="fileName && !busy" class="modal-footer">
          <button class="btn btn-primary btn-block" @click="install">确认安装</button>
        </div>
      </div>
    </div>
  </transition>
</template>
