<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

// 面板自更新【未实现】: 运行中的二进制无法就地替换, 更新只能走部署脚本。
// 旧版此处放了"检查更新/立即更新/环境检查/更新日志"四组控件, 但后端只回
// current=latest=v1.0.0 / up_to_date=true / 空 env.items —— 于是界面恒显示
// "环境不满足, 将自动拉取离线环境包", 点"立即更新"还谎报"已开始更新…完成后
// 服务将重启"(2026-09-28 审计定位)。现在只如实展示版本与更新方式。
const status = ref(null)

async function loadStatus() {
  try {
    status.value = await api.storeProjectStatus()
  } catch (e) {
    status.value = { error: e.message }
  }
}

onMounted(loadStatus)
</script>

<template>
  <div class="section">
    <div class="section-title">面板更新</div>
    <div v-if="status?.error" class="error" style="padding:8px 0;">{{ status.error }}</div>
    <template v-else-if="status">
      <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">
        <span>当前版本: <b style="color:var(--text);font-family:var(--font-mono);">{{ status.current || '-' }}</b></span>
        <span>面板仓库: <b style="color:var(--text);font-family:var(--font-mono);">{{ status.repo || '-' }}</b></span>
      </div>
      <div class="hint" style="margin-top:12px;padding:10px 12px;">
        面板暂不支持在线自更新 —— {{ status.message || '更新需通过部署脚本完成' }}
      </div>
      <div class="section" style="margin-top:12px;padding:12px;">
        <b style="font-size:13px;">更新步骤</b>
        <div style="margin-top:8px;font-size:12px;line-height:1.9;color:var(--text);font-family:var(--font-mono);white-space:pre-wrap;">{{ status.howto }}</div>
      </div>
    </template>
    <div v-else class="hint" style="padding:12px;">加载中…</div>
  </div>
</template>
