<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const conf = ref({ sudo_pw: '' })
const confSaving = ref(false)
const error = ref('')
const notice = ref('')

onMounted(async () => {
  try { conf.value = await api.kvConfig() } catch (err) { error.value = err.message }
})

async function saveConfig() {
  confSaving.value = true; error.value = ''
  try {
    await api.kvSaveConfig({ sudo_pw: conf.value.sudo_pw || '' })
    notice.value = '配置已保存'
    setTimeout(() => { notice.value = '' }, 3000)
  } catch (err) { error.value = err.message }
  finally { confSaving.value = false }
}
</script>

<template>
  <div class="section" style="margin-top:16px;">
    <div class="section-title">设置</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin-top:12px;">{{ notice }}</div>

    <div class="hint" style="font-size:12px;margin-top:8px;">部分操作（读镜像目录、创建磁盘、写 VNC token）需要 root 权限。请填写 sudo 密码（当前用户 f）。</div>
    <div class="form-row" style="margin-top:10px;">
      <span class="form-label">sudo 密码</span>
      <input v-model="conf.sudo_pw" type="password" class="input" style="flex:1;" placeholder="留空则不启用 sudo 兜底" />
    </div>
    <div style="margin-top:10px;">
      <button class="btn btn-primary" :disabled="confSaving" @click="saveConfig">{{ confSaving ? '保存中...' : '保存配置' }}</button>
    </div>
  </div>
</template>
