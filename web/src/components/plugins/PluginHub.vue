<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePluginHub } from './usePluginHub'

const router = useRouter()
const hub = usePluginHub()
const {
  installed, market, marketSource, health, activeTasks,
  loading, marketLoading, err, marketErr, q, busy, toast,
  gateLocked, gateEnabled, gateBusy, gateErr,
  filteredInstalled, filteredMarket, onlineCount,
  hasUpdate, incompatible, flash,
  refreshAll, loadMarket, unlock, lockGate, install, update, remove,
} = hub

const tab = ref('installed') // installed | market
const gatePW = ref('')
const gateInput = ref(null)

const summary = computed(() => {
  const total = installed.value.length
  const on = onlineCount.value
  return total ? `${total} 个已装 · ${on} 在线` : '暂无插件'
})

function open(name) {
  router.push('/plugin/' + name)
}

async function doRemove(p) {
  if (!confirm('移除插件 ' + (p.label || p.name) + '？\n目录会被删除。')) return
  await remove(p.name)
}

async function switchTab(t) {
  tab.value = t
  if (t === 'market' && !market.value.length && !marketLoading.value && !gateLocked.value) {
    await loadMarket()
  }
  if (t === 'market' && gateLocked.value) {
    setTimeout(() => { try { gateInput.value && gateInput.value.focus() } catch (e) {} }, 60)
  }
}

async function submitGate() {
  if (gateBusy.value || !gatePW.value) return
  const okUnlocked = await unlock(gatePW.value)
  if (okUnlocked) {
    gatePW.value = ''
  } else {
    gatePW.value = ''
    setTimeout(() => { try { gateInput.value && gateInput.value.focus() } catch (e) {} }, 0)
  }
}
</script>

<template>
  <div class="page ph-page">
    <!-- 头部 -->
    <div class="ph-head">
      <div class="ph-title">
        <span>插件</span>
        <span class="ph-sub">{{ summary }}</span>
      </div>
      <div class="ph-actions">
        <input v-model="q" class="input ph-search" placeholder="搜索插件…" />
        <button class="btn btn-sm" :disabled="loading" @click="refreshAll">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
        <button class="btn btn-sm btn-ghost" @click="router.push('/settings')">仓库配置</button>
      </div>
    </div>

    <!-- 页签 -->
    <div class="ph-tabs">
      <button class="ph-tab" :class="{ active: tab === 'installed' }" @click="switchTab('installed')">
        已安装 <span class="ph-count">{{ installed.length }}</span>
      </button>
      <button class="ph-tab" :class="{ active: tab === 'market' }" @click="switchTab('market')">
        插件市场 <span class="ph-count">{{ market.length }}</span>
      </button>
      <span class="ph-health">在线 {{ onlineCount }} / 共 {{ installed.length }}</span>
    </div>

    <!-- 安装任务条 -->
    <div v-if="activeTasks.length" class="ph-tasks">
      <div v-for="t in activeTasks" :key="t.id" class="ph-task">
        <span class="ph-task-name">{{ t.name || t.kind }}</span>
        <div class="progress ph-task-bar"><div :style="{ width: (t.progress || 0) + '%' }"></div></div>
        <span class="mono ph-task-pct">{{ t.progress || 0 }}%</span>
        <span class="faint">{{ t.message || t.status }}</span>
      </div>
    </div>

    <!-- 已安装 -->
    <div v-if="tab === 'installed'" class="ph-body">
      <div v-if="err" class="error">{{ err }}</div>
      <div v-else-if="loading" class="hint ph-empty">加载中…</div>
      <div v-else-if="!filteredInstalled.length" class="ph-empty">
        <div class="ph-empty-title">{{ q ? '没有匹配的插件' : '还没有安装插件' }}</div>
        <div class="ph-empty-sub" v-if="!q">到「插件市场」页签挑一个装上</div>
        <button v-if="!q" class="btn btn-sm btn-primary" @click="switchTab('market')">去市场看看</button>
      </div>

      <div v-else class="ph-list">
        <div v-for="p in filteredInstalled" :key="p.name" class="ph-row">
          <span class="ph-dot" :class="p.alive ? 'on' : 'off'" :title="p.alive ? '在线' : '未运行'"></span>
          <div class="ph-main">
            <div class="ph-row-title">
              <span class="ph-name">{{ p.label || p.name }}</span>
              <span class="ph-ver mono">v{{ p.version || '—' }}</span>
              <span v-if="incompatible(p)" class="ph-tag danger" title="v6 只支持 Go 插件">不兼容 v6</span>
            </div>
            <div class="ph-desc">{{ p.description || '（无描述）' }}</div>
          </div>
          <div class="ph-row-actions">
            <button class="btn btn-sm" @click="open(p.name)">打开</button>
            <button class="btn btn-sm btn-ghost" @click="open(p.name)">设置</button>
            <button class="btn btn-sm btn-danger" :disabled="busy === p.name" @click="doRemove(p)">移除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 市场 -->
    <div v-else class="ph-body">
      <!-- 插件库上锁: 输口令才能看清单/安装 -->
      <div v-if="gateLocked" class="ph-gate">
        <div class="ph-gate-lock">🔒</div>
        <div class="ph-gate-title">插件库已上锁</div>
        <div class="ph-gate-sub">
          插件库为公开仓库，插件内容受口令保护。<br />
          输入口令后本设备 30 天内免输。
        </div>
        <form class="ph-gate-form" @submit.prevent="submitGate">
          <input
            ref="gateInput"
            v-model="gatePW"
            type="password"
            class="input ph-gate-input"
            :class="{ 'has-err': !!gateErr }"
            placeholder="插件库口令"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            :disabled="gateBusy"
            @input="gateErr = ''"
          />
          <button class="btn btn-sm btn-primary" type="submit" :disabled="gateBusy || !gatePW">
            {{ gateBusy ? '验证中…' : '解锁' }}
          </button>
        </form>
        <div v-if="gateErr" class="ph-gate-err">{{ gateErr }}</div>
        <div v-else class="ph-gate-hint">连续输错 5 次会锁定 60 秒</div>
      </div>

      <template v-else>
        <div class="ph-source">
          <span v-if="marketSource === 'local'" class="ph-tag warn">本地清单（GitHub 不可达）</span>
          <span v-else-if="marketSource" class="ph-tag">来源：GitHub</span>
          <span class="faint">仓库地址可在「设置 → 仓库配置」修改</span>
          <button v-if="gateEnabled" class="btn btn-xs ph-relock" title="清除解锁状态" @click="lockGate">
            重新上锁
          </button>
        </div>

        <div v-if="marketErr" class="error">{{ marketErr }}</div>
        <div v-else-if="marketLoading" class="hint ph-empty">正在拉取市场清单…</div>
        <div v-else-if="!filteredMarket.length" class="ph-empty">
          <div class="ph-empty-title">{{ q ? '没有匹配的插件' : '市场里没有插件' }}</div>
          <div class="ph-empty-sub" v-if="marketSource === 'local'">
            GitHub 不可达，已回退到本机扫描，但本机也没有已装插件
          </div>
          <div class="ph-empty-sub" v-else>检查「设置 → 仓库配置」里的仓库地址与令牌</div>
        </div>

        <div v-else class="ph-list">
          <div v-for="p in filteredMarket" :key="p.name" class="ph-row">
            <div class="ph-main">
              <div class="ph-row-title">
                <span class="ph-name">{{ p.label || p.name }}</span>
                <span class="ph-ver mono">v{{ p.version || '—' }}</span>
                <span v-if="p.installed" class="ph-tag ok">已装 {{ p.installed_version || '' }}</span>
                <span v-if="hasUpdate(p)" class="ph-tag warn">可更新</span>
              </div>
              <div class="ph-desc">{{ p.description || '（无描述）' }}</div>
              <div v-if="p.author" class="ph-author">作者 {{ p.author }}</div>
            </div>
            <div class="ph-row-actions">
              <button
                v-if="!p.installed"
                class="btn btn-sm btn-primary"
                :disabled="busy === p.name"
                @click="install(p.name)"
              >
                {{ busy === p.name ? '提交中…' : '安装' }}
              </button>
              <button
                v-else-if="hasUpdate(p)"
                class="btn btn-sm btn-primary"
                :disabled="busy === p.name"
                @click="update(p.name)"
              >
                {{ busy === p.name ? '提交中…' : '更新' }}
              </button>
              <button v-else class="btn btn-sm" disabled>已是最新</button>
              <button v-if="p.installed" class="btn btn-sm btn-ghost" @click="open(p.name)">管理</button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div v-if="toast" class="ph-toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.ph-page { height: calc(100vh - 66px); display: flex; flex-direction: column; padding: 0; }

.ph-head { display: flex; align-items: center; gap: 12px; padding: 0 0 10px; }
.ph-title { display: flex; align-items: baseline; gap: 10px; font-size: 16px; font-weight: 600; color: var(--text); }
.ph-sub { font-size: 11px; font-weight: 400; color: var(--text-faint); font-family: var(--font-mono); }
.ph-actions { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.ph-search { width: 200px; height: 28px; font-size: 12px; }

.ph-tabs {
  display: flex; align-items: center; gap: 2px;
  border-bottom: 1px solid var(--border); padding-bottom: 0;
}
.ph-tab {
  border: 0; background: transparent; color: var(--text-muted);
  font-size: 12px; padding: 7px 14px; cursor: pointer;
  border-bottom: 2px solid transparent;
}
.ph-tab:hover { color: var(--text); }
.ph-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.ph-count { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); margin-left: 4px; }
.ph-health { margin-left: auto; font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }

.ph-tasks { border-bottom: 1px solid var(--border); background: var(--surface-2); padding: 6px 12px; }
.ph-task { display: flex; align-items: center; gap: 10px; font-size: 11px; padding: 2px 0; }
.ph-task-name { color: var(--text); min-width: 160px; }
.ph-task-bar { width: 160px; height: 4px; }
.ph-task-pct { color: var(--text-faint); width: 38px; text-align: right; }

.ph-body { flex: 1; overflow: auto; padding-top: 10px; }
.ph-empty { padding: 48px 16px; text-align: center; }
.ph-empty-title { font-size: 13px; color: var(--text-muted); }
.ph-empty-sub { font-size: 11px; color: var(--text-faint); margin: 6px 0 14px; }

.ph-source { display: flex; align-items: center; gap: 10px; font-size: 11px; margin-bottom: 8px; }

.ph-list { border: 1px solid var(--border); background: var(--surface); }
.ph-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-bottom: 1px solid var(--border);
}
.ph-row:last-child { border-bottom: 0; }
.ph-row:hover { background: var(--surface-2); }
.ph-dot { width: 7px; height: 7px; background: var(--text-faint); flex-shrink: 0; }
.ph-dot.on { background: var(--success); }
.ph-dot.off { background: var(--text-faint); }

.ph-main { flex: 1; min-width: 0; }
.ph-row-title { display: flex; align-items: center; gap: 8px; }
.ph-name { font-size: 13px; color: var(--text); font-weight: 500; }
.ph-ver { font-size: 11px; color: var(--text-faint); }
.ph-desc { font-size: 11px; color: var(--text-muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ph-author { font-size: 10px; color: var(--text-faint); margin-top: 2px; }

.ph-tag { font-size: 10px; padding: 0 5px; border: 1px solid var(--border-strong); color: var(--text-muted); }
.ph-tag.ok { border-color: var(--success); color: var(--success); }
.ph-tag.warn { border-color: var(--warning); color: var(--warning); }
.ph-tag.danger { border-color: var(--danger); color: var(--danger); }

.ph-row-actions { display: flex; gap: 6px; flex-shrink: 0; }

.ph-toast {
  position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%);
  background: var(--text); color: var(--bg); padding: 8px 16px; font-size: 12px; z-index: 90;
}

/* ---- 插件库上锁 ---- */
.ph-gate {
  max-width: 420px; margin: 48px auto 0; padding: 28px 24px;
  border: 1px solid var(--border); background: var(--surface);
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.ph-gate-lock { font-size: 26px; line-height: 1; margin-bottom: 12px; opacity: 0.75; }
.ph-gate-title { font-size: 14px; font-weight: 600; color: var(--text); }
.ph-gate-sub {
  font-size: 11.5px; color: var(--text-muted); line-height: 1.6;
  margin: 8px 0 18px;
}
.ph-gate-form { display: flex; gap: 8px; width: 100%; }
.ph-gate-input { flex: 1; height: 32px; font-size: 13px; }
.ph-gate-input.has-err { border-color: var(--danger); }
.ph-gate-err { font-size: 11.5px; color: var(--danger); margin-top: 10px; }
.ph-gate-hint { font-size: 11px; color: var(--text-faint); margin-top: 10px; }

.ph-relock { margin-left: auto; }
.btn-xs { padding: 1px 7px; font-size: 10.5px; height: 20px; }
</style>
