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
  uploadOpen, uploadBusy, uploadPct, uploadErr, uploadResult, uploadFile,
  filteredInstalled, filteredMarket, onlineCount,
  hasUpdate, incompatible, flash,
  refreshAll, loadMarket, unlock, lockGate,
  openUpload, closeUpload, installFromFile,
  install, update, remove,
} = hub

const tab = ref('installed') // installed | market
const gatePW = ref('')
const gateInput = ref(null)

// 上传弹窗: 拖拽状态 + 文件选择
const dragOver = ref(false)
const fileInput = ref(null)

function onDrop(e) {
  dragOver.value = false
  if (uploadBusy.value) return
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
  if (f) doUpload(f)
}

function onPick(e) {
  const f = e.target && e.target.files && e.target.files[0]
  if (f) doUpload(f)
  // 清空 value, 否则同一个文件选第二次不触发 change
  if (e.target) e.target.value = ''
}

async function doUpload(f) {
  await installFromFile(f)
}

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
        <button class="btn btn-sm btn-primary" @click="openUpload">安装插件</button>
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
        <div class="ph-empty-sub" v-if="!q">
          可以从「插件市场」挑一个装上，或直接安装你手上的插件包
        </div>
        <div v-if="!q" class="ph-empty-actions">
          <button class="btn btn-sm btn-primary" @click="switchTab('market')">去市场看看</button>
          <button class="btn btn-sm" @click="openUpload">安装插件包</button>
        </div>
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

        <!-- 两种安装方式的区别: 市场从仓库拉, 安装插件装本地包 -->
        <div class="ph-hint-bar">
          这里从 GitHub 仓库拉取插件；如果你手上已有插件包（离线/自研/第三方），
          用右上角「安装插件」直接装。
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

    <!-- 安装插件弹窗(面板内直接安装: 上传本地插件包) -->
    <div v-if="uploadOpen" class="ph-modal-mask" @click.self="closeUpload">
      <div class="ph-modal">
        <div class="ph-modal-head">
          <span>安装插件</span>
          <button class="ph-modal-x" :disabled="uploadBusy" @click="closeUpload">×</button>
        </div>

        <div class="ph-modal-body">
          <!-- 成功态 -->
          <div v-if="uploadResult" class="ph-up-ok">
            <div class="ph-up-ok-icon">✓</div>
            <div class="ph-up-ok-title">
              {{ uploadResult.replaced ? '已更新' : '已安装' }}
              {{ uploadResult.label || uploadResult.name }}
            </div>
            <div class="ph-up-ok-meta mono">
              {{ uploadResult.name }} · v{{ uploadResult.version }}
              <template v-if="uploadResult.author"> · {{ uploadResult.author }}</template>
              · {{ uploadResult.files }} 个文件
            </div>
            <div class="ph-up-ok-hint">插件已出现在「已安装」页签，可直接打开使用</div>
            <div class="ph-up-ok-actions">
              <button class="btn btn-sm btn-primary" @click="closeUpload">完成</button>
              <button class="btn btn-sm" @click="tab = 'installed'; closeUpload()">查看已安装</button>
            </div>
          </div>

          <!-- 上传态 -->
          <template v-else>
            <div
              class="ph-up-drop"
              :class="{ over: dragOver, busy: uploadBusy }"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="onDrop"
              @click="!uploadBusy && fileInput && fileInput.click()"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".zip,.tar.gz,.tgz,.tar"
                style="display:none"
                @change="onPick"
              />
              <template v-if="!uploadBusy">
                <div class="ph-up-drop-icon">↑</div>
                <div class="ph-up-drop-title">拖入插件包，或点击选择文件</div>
                <div class="ph-up-drop-sub">支持 .zip / .tar.gz / .tgz / .tar（≤128MB）</div>
              </template>
              <template v-else>
                <div class="ph-up-drop-title">正在安装 {{ uploadFile }}</div>
                <div class="progress ph-up-bar"><div :style="{ width: uploadPct + '%' }"></div></div>
                <div class="ph-up-drop-sub mono">{{ uploadPct }}%</div>
              </template>
            </div>

            <div v-if="uploadErr" class="ph-up-err">{{ uploadErr }}</div>

            <div class="ph-up-note">
              <div class="ph-up-note-title">包内要求</div>
              <ul>
                <li><code>plugin.json</code>（v4 清单：name / frontend.entry / backend.exec）</li>
                <li>清单放在包根目录，或包内唯一一层子目录下均可</li>
                <li>一个包只能装一个插件；同名插件会被整体替换（等于更新）</li>
              </ul>
              <div class="ph-up-note-sub">
                与「插件市场」的区别：市场从 GitHub 仓库拉取，这里直接装你手上的包，
                离线环境也能用。
              </div>
            </div>
          </template>
        </div>
      </div>
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
.ph-empty-actions { display: flex; gap: 8px; justify-content: center; }

.ph-source { display: flex; align-items: center; gap: 10px; font-size: 11px; margin-bottom: 8px; }
.ph-hint-bar {
  font-size: 11px; line-height: 1.55; color: var(--text-muted);
  background: var(--surface-2); border-left: 2px solid var(--border-strong);
  padding: 7px 10px; margin-bottom: 10px;
}

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

/* ---- 安装插件弹窗 ---- */
.ph-modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.42);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 16px;
}
.ph-modal {
  width: 100%; max-width: 480px; max-height: calc(100vh - 64px);
  display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--border);
  box-shadow: var(--shadow);
}
.ph-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 16px; border-bottom: 1px solid var(--border);
  font-size: 13px; font-weight: 600; color: var(--text);
}
.ph-modal-x {
  border: 0; background: transparent; color: var(--text-muted);
  font-size: 19px; line-height: 1; cursor: pointer; padding: 0 4px;
}
.ph-modal-x:hover:not(:disabled) { color: var(--text); }
.ph-modal-x:disabled { opacity: 0.4; cursor: not-allowed; }
.ph-modal-body { padding: 16px; overflow: auto; }

.ph-up-drop {
  border: 1px dashed var(--border-strong); background: var(--surface-2);
  padding: 26px 16px; text-align: center; cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}
.ph-up-drop:hover:not(.busy) { border-color: var(--accent); }
.ph-up-drop.over { border-color: var(--accent); background: var(--accent-soft); }
.ph-up-drop.busy { cursor: default; }
.ph-up-drop-icon { font-size: 22px; color: var(--text-faint); line-height: 1; margin-bottom: 8px; }
.ph-up-drop-title { font-size: 12.5px; color: var(--text); }
.ph-up-drop-sub { font-size: 11px; color: var(--text-faint); margin-top: 5px; }
.ph-up-bar { width: 100%; height: 5px; margin: 12px 0 6px; }

.ph-up-err {
  margin-top: 12px; padding: 8px 10px; font-size: 11.5px; line-height: 1.5;
  color: var(--danger); background: var(--danger-soft);
  border-left: 2px solid var(--danger); word-break: break-word;
}

.ph-up-note {
  margin-top: 14px; padding: 10px 12px;
  background: var(--surface-2); border-left: 2px solid var(--border-strong);
}
.ph-up-note-title { font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
.ph-up-note ul { margin: 0; padding-left: 16px; }
.ph-up-note li { font-size: 11px; color: var(--text-muted); line-height: 1.65; }
.ph-up-note code {
  background: var(--surface-3); color: var(--text); padding: 1px 4px;
  font-family: var(--font-mono); font-size: 10.5px;
}
.ph-up-note-sub {
  font-size: 10.5px; color: var(--text-faint); line-height: 1.55;
  margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);
}

.ph-up-ok { text-align: center; padding: 12px 4px 4px; }
.ph-up-ok-icon {
  width: 40px; height: 40px; line-height: 40px; margin: 0 auto 12px;
  border-radius: 50%; background: var(--success-soft); color: var(--success);
  font-size: 20px;
}
.ph-up-ok-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
.ph-up-ok-meta { font-size: 11px; color: var(--text-faint); margin-top: 6px; }
.ph-up-ok-hint { font-size: 11.5px; color: var(--text-muted); margin-top: 10px; }
.ph-up-ok-actions { display: flex; gap: 8px; justify-content: center; margin-top: 18px; }
</style>
