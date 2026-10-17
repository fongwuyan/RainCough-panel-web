<script setup>
import { ref } from 'vue'
import { useSettings, fmtUptime } from './useSettings'

const st = useSettings()
const {
  theme, setTheme, cfg, token, loading, saving, pinging, pingState, pingMsg,
  panel, sys, status, statusOk, repoSummary, saveRepo, ping, clearDoneTasks,
} = st

const active = ref('appearance')
const NAV = [
  { key: 'appearance', label: '外观', desc: '主题与显示' },
  { key: 'repo', label: '仓库配置', desc: '插件市场 / 面板仓库' },
  { key: 'panel', label: '面板信息', desc: '版本与运行状态' },
  { key: 'maint', label: '维护', desc: '数据清理' },
]
</script>

<template>
  <div class="page st-page">
    <div class="st-layout">
      <nav class="st-nav">
        <button
          v-for="n in NAV"
          :key="n.key"
          class="st-nav-item"
          :class="{ active: active === n.key }"
          @click="active = n.key"
        >
          <span class="st-nav-label">{{ n.label }}</span>
          <span class="st-nav-desc">{{ n.desc }}</span>
        </button>
      </nav>

      <section class="st-pane">
        <div v-if="status" class="st-status" :class="statusOk ? 'ok' : 'err'">{{ status }}</div>

        <!-- 外观 -->
        <div v-if="active === 'appearance'" class="st-group">
          <div class="st-group-title">主题</div>
          <div class="st-themes">
            <button class="st-theme" :class="{ active: theme === 'light' }" @click="setTheme('light')">
              <div class="st-theme-prev light">
                <span class="pv-side"></span>
                <span class="pv-main"></span>
              </div>
              <span class="st-theme-name">浅色</span>
            </button>
            <button class="st-theme" :class="{ active: theme === 'dark' }" @click="setTheme('dark')">
              <div class="st-theme-prev dark">
                <span class="pv-side"></span>
                <span class="pv-main"></span>
              </div>
              <span class="st-theme-name">深色</span>
            </button>
          </div>
          <p class="st-hint">主题保存在浏览器本地，切换立即生效。</p>
        </div>

        <!-- 仓库配置 -->
        <div v-else-if="active === 'repo'" class="st-group">
          <div class="st-group-title">插件仓库</div>
          <p class="st-hint">插件市场的清单与安装源。当前：<b class="mono">{{ repoSummary }}</b></p>
          <div class="st-form">
            <label class="st-field"><span>Owner</span><input v-model="cfg.plugin_repo.owner" class="input mono" placeholder="用户名或组织" /></label>
            <label class="st-field"><span>Repo</span><input v-model="cfg.plugin_repo.repo" class="input mono" placeholder="仓库名" /></label>
            <label class="st-field"><span>Branch</span><input v-model="cfg.plugin_repo.branch" class="input mono" placeholder="main" /></label>
          </div>

          <div class="st-group-title" style="margin-top:22px">面板仓库</div>
          <p class="st-hint">面板自更新时的发布来源。</p>
          <div class="st-form">
            <label class="st-field"><span>Owner</span><input v-model="cfg.panel_repo.owner" class="input mono" /></label>
            <label class="st-field"><span>Repo</span><input v-model="cfg.panel_repo.repo" class="input mono" /></label>
            <label class="st-field"><span>Branch</span><input v-model="cfg.panel_repo.branch" class="input mono" /></label>
          </div>

          <div class="st-group-title" style="margin-top:22px">访问令牌</div>
          <p class="st-hint">
            私有仓库需要 GitHub Token（只需 repo 读权限）。已配置时留空表示不修改。
            当前：<b>{{ cfg.has_token ? '已配置' : '未配置' }}</b>
          </p>
          <div class="st-form">
            <label class="st-field wide"><span>Token</span><input v-model="token" class="input mono" type="password" placeholder="ghp_… （留空则不修改）" /></label>
          </div>

          <div class="st-actions">
            <button class="btn btn-primary" :disabled="saving" @click="saveRepo">{{ saving ? '保存中…' : '保存配置' }}</button>
            <button class="btn" :disabled="pinging" @click="ping">{{ pinging ? '测试中…' : '测试连接' }}</button>
            <span v-if="pingMsg" class="st-ping" :class="pingState">{{ pingMsg }}</span>
          </div>
        </div>

        <!-- 面板信息 -->
        <div v-else-if="active === 'panel'" class="st-group">
          <div class="st-group-title">版本</div>
          <div class="st-rows">
            <div class="st-row"><span>面板版本</span><b class="mono">{{ (panel && panel.version) || '—' }}</b></div>
            <div class="st-row"><span>构建提交</span><b class="mono">{{ ((panel && panel.commit) || '').slice(0, 12) || '—' }}</b></div>
            <div class="st-row"><span>程序目录</span><b class="mono">{{ (panel && panel.dir) || '—' }}</b></div>
            <div class="st-row"><span>运行时长</span><b class="mono">{{ fmtUptime(sys && sys.uptime) }}</b></div>
            <div class="st-row"><span>Go 版本</span><b class="mono">{{ (sys && sys.go_version) || '—' }}</b></div>
            <div class="st-row"><span>主机 / 系统</span><b class="mono">{{ (sys && sys.hostname) || '—' }} · {{ (sys && sys.platform) || '—' }} {{ (sys && sys.arch) || '' }}</b></div>
          </div>
        </div>

        <!-- 维护 -->
        <div v-else class="st-group">
          <div class="st-group-title">任务记录</div>
          <p class="st-hint">插件安装、文件批量操作会在任务队列里留下记录。清理只删除记录，不影响任何文件。</p>
          <div class="st-actions">
            <button class="btn btn-danger" @click="clearDoneTasks">清理已完成任务</button>
          </div>

          <div class="st-group-title" style="margin-top:24px">数据目录</div>
          <p class="st-hint">
            面板数据全部存放在程序目录下的 <code class="mono">data/</code>：
            <code class="mono">data/kv/*.log</code> 为各模块配置，<code class="mono">data/workspace-history.ndjson</code> 为工作台历史。
            备份时整目录拷走即可。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.st-page { height: calc(100vh - 66px); padding: 0; }
.st-layout { display: grid; grid-template-columns: 200px 1fr; gap: 0 24px; height: 100%; min-height: 0; }

.st-nav { border-right: 1px solid var(--border); padding-right: 14px; overflow: auto; }
.st-nav-item {
  display: flex; flex-direction: column; gap: 2px; width: 100%;
  border: 0; border-left: 2px solid transparent; background: transparent;
  text-align: left; padding: 8px 10px; cursor: pointer;
}
.st-nav-item:hover { background: var(--surface-2); }
.st-nav-item.active { border-left-color: var(--accent); background: var(--accent-soft); }
.st-nav-label { font-size: 13px; color: var(--text); }
.st-nav-item.active .st-nav-label { color: var(--accent); }
.st-nav-desc { font-size: 10px; color: var(--text-faint); }

.st-pane { overflow: auto; padding-right: 4px; }
.st-group { max-width: 720px; }
.st-group-title { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.st-hint { font-size: 11px; color: var(--text-faint); margin: 0 0 12px; line-height: 1.7; }
.st-hint code { background: var(--surface-2); padding: 1px 4px; }

.st-status { margin-bottom: 12px; padding: 6px 10px; font-size: 12px; border-left: 2px solid; }
.st-status.ok { border-color: var(--success); background: var(--success-soft); color: var(--success); }
.st-status.err { border-color: var(--danger); background: var(--danger-soft); color: var(--danger); }

.st-themes { display: flex; gap: 12px; }
.st-theme {
  border: 1px solid var(--border); background: var(--surface); padding: 10px; cursor: pointer;
  display: flex; flex-direction: column; gap: 8px; width: 160px;
}
.st-theme:hover { border-color: var(--border-strong); }
.st-theme.active { border-color: var(--accent); box-shadow: var(--ring); }
.st-theme-prev { height: 64px; display: flex; gap: 4px; padding: 4px; }
.st-theme-prev .pv-side { width: 26px; display: block; }
.st-theme-prev .pv-main { flex: 1; display: block; }
.st-theme-prev.light { background: #f5f6f8; border: 1px solid #d8dce4; }
.st-theme-prev.light .pv-side { background: #ffffff; border-right: 1px solid #d8dce4; }
.st-theme-prev.light .pv-main { background: #ffffff; }
.st-theme-prev.dark { background: #0d1117; border: 1px solid #2a3140; }
.st-theme-prev.dark .pv-side { background: #161b24; border-right: 1px solid #2a3140; }
.st-theme-prev.dark .pv-main { background: #161b24; }
.st-theme-name { font-size: 12px; color: var(--text-muted); }
.st-theme.active .st-theme-name { color: var(--accent); }

.st-form { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.st-field { display: flex; flex-direction: column; gap: 4px; }
.st-field.wide { grid-column: span 3; }
.st-field span { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.st-field .input { height: 28px; font-size: 12px; }

.st-actions { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
.st-ping { font-size: 11px; }
.st-ping.ok { color: var(--success); }
.st-ping.fail { color: var(--danger); }

.st-rows { border: 1px solid var(--border); }
.st-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 12px; }
.st-row:last-child { border-bottom: 0; }
.st-row span { color: var(--text-faint); }
.st-row b { color: var(--text); font-weight: 500; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
