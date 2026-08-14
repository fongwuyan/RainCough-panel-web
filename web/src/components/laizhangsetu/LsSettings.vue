<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'
import { useLaizhangsetu } from '../../stores/laizhangsetu'

const { config, loadConfig } = useLaizhangsetu()

const form = ref({
  show_info: true,
  exclude_ai: false,
  flip_h: false,
  flip_v: false,
  r18: false,
  exclude_seen: false,
  blur_chance: 5,
  img_size: 0,
  proxy: 'i.pixiv.re',
})
const status = ref('')
const statusOk = ref(false)

onMounted(async () => {
  await loadConfig()
  Object.assign(form.value, config.value || {})
})

async function save() {
  status.value = ''
  try {
    await api.lsSaveConfig({
      show_info: form.value.show_info,
      exclude_ai: form.value.exclude_ai,
      flip_h: form.value.flip_h,
      flip_v: form.value.flip_v,
      r18: form.value.r18,
      exclude_seen: form.value.exclude_seen,
      blur_chance: parseInt(form.value.blur_chance) || 0,
      img_size: parseInt(form.value.img_size) || 0,
      proxy: form.value.proxy || 'i.pixiv.re',
    })
    status.value = '设置已保存'
    statusOk.value = true
    setTimeout(() => { status.value = '' }, 2000)
  } catch (e) {
    status.value = `保存失败: ${e.message}`
    statusOk.value = false
  }
}
</script>

<template>
  <div class="section" style="max-width:520px;">
    <div class="section-title">设置</div>
    <div class="settings-group">
      <div class="settings-item">
        <label>显示图片信息</label>
        <label class="switch">
          <input v-model="form.show_info" type="checkbox" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="settings-item">
        <label>排除 AI 作品</label>
        <label class="switch">
          <input v-model="form.exclude_ai" type="checkbox" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="settings-item">
        <label>水平翻转</label>
        <label class="switch">
          <input v-model="form.flip_h" type="checkbox" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="settings-item">
        <label>垂直翻转</label>
        <label class="switch">
          <input v-model="form.flip_v" type="checkbox" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="settings-item">
        <label>R18</label>
        <label class="switch">
          <input v-model="form.r18" type="checkbox" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="settings-item">
        <label>排除重复</label>
        <label class="switch">
          <input v-model="form.exclude_seen" type="checkbox" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="settings-item">
        <label>模糊几率 (0-100)</label>
        <input v-model.number="form.blur_chance" class="input" type="number" min="0" max="100" style="width:70px;text-align:center;" />
      </div>
      <div class="settings-item">
        <label>图片质量</label>
        <select v-model.number="form.img_size" class="select">
          <option :value="0">原图</option>
          <option :value="1">中等</option>
          <option :value="2">缩略</option>
        </select>
      </div>
      <div class="settings-item">
        <label>代理服务器</label>
        <input v-model="form.proxy" class="input" type="text" style="width:160px;" />
      </div>
    </div>
    <div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
      <button class="btn btn-primary" @click="save">保存设置</button>
      <span v-if="status" class="status-line" :class="statusOk ? 'ok' : 'fail'">{{ status }}</span>
    </div>
  </div>
</template>
