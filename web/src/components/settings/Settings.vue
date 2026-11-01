<script setup>
import { ref, onMounted } from 'vue'
import { useSettings, fmtUptime } from './useSettings'
import { useUi } from '../../stores/ui'
import { api } from '../../api'

const st = useSettings()
const ui = useUi()
const { sidebarHidden, ball } = useUi()
const {
  theme, setTheme, cfg, loading, saving, pinging, pingState, pingMsg,
  gatePW, gateLocked, gateEnabled, gateBusy,
  panel, sys, status, statusOk, repoSummary,
  unlockGate, lockGate, saveRepo, ping, clearDoneTasks,
} = st

const active = ref('appearance')

// ---- 移动端访问密钥 ----
// /<插件名>/api/... 前缀通道不走登录中间件(App 没有登录能力), 全靠这个密钥把关。
const restKey = ref('')
const restKeyErr = ref('')
const restKeyBusy = ref(false)
const restKeyConfirm = ref(false)

async function loadRestKey() {
  try {
    const d = await api.restKey()
    restKey.value = (d && d.key) || ''
    restKeyErr.value = ''
  } catch (e) {
    restKeyErr.value = (e && e.message) || '读取失败'
  }
}
// 两步确认: 重置会让已配对的 App 立刻失效, 不能一次点击就做
async function rotateRestKey() {
  if (!restKeyConfirm.value) {
    restKeyConfirm.value = true
    setTimeout(function () { restKeyConfirm.value = false }, 5000)
    return
  }
  restKeyConfirm.value = false
  restKeyBusy.value = true
  try {
    const d = await api.restKeyRotate()
    restKey.value = (d && d.key) || ''
    restKeyErr.value = ''
  } catch (e) {
    restKeyErr.value = (e && e.message) || '重置失败'
  } finally {
    restKeyBusy.value = false
  }
}
function copyRestKey() {
  if (!restKey.value) return
  try { navigator.clipboard.writeText(restKey.value) } catch (e) { /* 无剪贴板权限时可手动选中复制 */ }
}
onMounted(loadRestKey)

// ---- 登录方式 ----
// 面板默认接受「系统(SSH)密码」和「面板密码」两种。这里只切系统密码那条通道，
// 服务端 Verify() 会真的跳过它, 不是只在界面上藏起来。
const loginPolicy = ref(null)
const loginBusy = ref(false)
const loginErr = ref('')

async function loadLoginPolicy() {
  try {
    loginPolicy.value = await api.authLoginPolicy()
    loginErr.value = ''
  } catch (e) {
    loginErr.value = (e && e.message) || '读取失败'
  }
}

async function setSshLogin(on) {
  if (loginBusy.value) return
  loginBusy.value = true
  loginErr.value = ''
  try {
    loginPolicy.value = await api.authSetLoginPolicy(on)
  } catch (e) {
    loginErr.value = (e && e.message) || '保存失败'
    // 失败时重新读一次: 开关位置必须等于服务端真实状态, 不能停在用户点的那个位置
    await loadLoginPolicy()
  } finally {
    loginBusy.value = false
  }
}
onMounted(loadLoginPolicy)

// ---- 面板密码 ----
// 关掉系统密码后只剩这一条登录通道，所以必须能在这里设一个自己记得住的密码，
// 否则用户只能去服务器上跑 `raincough -set-password`。
const newPW = ref('')
const newPW2 = ref('')
const pwBusy = ref(false)
const pwMsg = ref('')
const pwOk = ref(false)

async function savePanelPassword() {
  if (pwBusy.value) return
  pwMsg.value = ''
  if (newPW.value.length < 8) {
    pwOk.value = false
    pwMsg.value = '至少 8 位'
    return
  }
  if (newPW.value !== newPW2.value) {
    pwOk.value = false
    pwMsg.value = '两次输入不一致'
    return
  }
  pwBusy.value = true
  try {
    await api.authSetPassword(newPW.value)
    pwOk.value = true
    pwMsg.value = '已更新，其它设备需重新登录'
    newPW.value = ''
    newPW2.value = ''
    await loadLoginPolicy()
  } catch (e) {
    pwOk.value = false
    pwMsg.value = (e && e.message) || '保存失败'
  } finally {
    pwBusy.value = false
  }
}

const NAV = [
  { key: 'appearance', label: '外观', desc: '主题与显示' },
  { key: 'repo', label: '仓库配置', desc: '插件市场 / 面板仓库' },
  { key: 'login', label: '登录', desc: '密码与登录方式' },
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

          <div class="st-group-title" style="margin-top:18px">布局</div>
          <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;font-size:12px">
            <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
              <input type="checkbox" :checked="!sidebarHidden" @change="ui.setSidebarHidden(!$event.target.checked)" />
              显示侧栏
            </label>
            <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
              <input type="checkbox" :checked="ball.on" @change="ui.setBall({ on: $event.target.checked })" />
              显示悬浮球
            </label>
            <button class="btn" @click="ui.setBall({ x: null, y: null })">球归位</button>
          </div>
          <p class="st-hint">侧栏收起后点悬浮球展开；球可拖动，右键（或长按）换黑/白底色、上传图标。</p>
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

          <div class="st-group-title" style="margin-top:22px">移动端访问</div>
          <p class="st-hint">
            Android 版 JMReader 没有登录能力，走
            <code class="mono">/&lt;插件名&gt;/api/…</code>
            前缀读插件数据。这条通道靠下面的密钥把关，重置后 App 要重新填。
          </p>
          <div class="st-form">
            <label class="st-field wide">
              <span>访问密钥</span>
              <input
                class="input mono"
                :value="restKey"
                readonly
                placeholder="读取中…"
                @focus="$event.target.select()"
              />
            </label>
          </div>
          <div class="st-actions">
            <button class="btn" :disabled="!restKey" @click="copyRestKey">复制</button>
            <button
              class="btn"
              :class="{ 'btn-danger': restKeyConfirm }"
              :disabled="restKeyBusy"
              @click="rotateRestKey"
            >
              {{ restKeyBusy ? '重置中…' : (restKeyConfirm ? '确认重置？再点一次' : '重置密钥') }}
            </button>
            <span v-if="restKeyErr" class="st-ping fail">{{ restKeyErr }}</span>
          </div>

          <!-- 密钥区块只在闸门启用时出现。
               闸门默认关闭(2026-11-01 起), 之前这块无条件渲染 —— 用户会看到
               一个输了也没用的密码框, 属于典型的"无效按钮"。 -->
          <template v-if="gateEnabled">
            <div class="st-group-title" style="margin-top:22px">插件库口令</div>
            <div class="st-form">
              <label class="st-field wide">
                <span>密钥</span>
                <input
                  v-model="gatePW"
                  class="input mono"
                  type="password"
                  autocomplete="off"
                  :disabled="gateBusy"
                  @keydown.enter="unlockGate"
                />
              </label>
            </div>
            <div class="st-actions">
              <button class="btn btn-primary" :disabled="gateBusy || !gatePW" @click="unlockGate">
                {{ gateBusy ? '验证中…' : '解锁' }}
              </button>
              <button v-if="!gateLocked" class="btn" :disabled="gateBusy" @click="lockGate">上锁</button>
              <span class="st-ping" :class="gateLocked ? 'fail' : 'ok'">
                {{ gateLocked ? '未解锁' : '已解锁' }}
              </span>
            </div>
          </template>
          <p v-else class="st-hint" style="margin-top:22px">
            插件市场未上锁，无需密钥。需要保护插件内容时，在 systemd 单元里设置
            <code class="mono">RC_STORE_GATE=on</code> 与
            <code class="mono">RC_STORE_GATE_HASH</code>（用
            <code class="mono">raincough -hash-password</code> 生成）后重启面板。
          </p>

          <div class="st-actions">
            <button class="btn btn-primary" :disabled="saving" @click="saveRepo">{{ saving ? '保存中…' : '保存配置' }}</button>
            <button class="btn" :disabled="pinging" @click="ping">{{ pinging ? '测试中…' : '测试连接' }}</button>
            <span v-if="pingMsg" class="st-ping" :class="pingState">{{ pingMsg }}</span>
          </div>
        </div>

        <!-- 登录 -->
        <div v-else-if="active === 'login'" class="st-group">
          <div class="st-group-title">登录方式</div>
          <p class="st-hint">
            面板默认接受两种密码：<b>系统（SSH）密码</b>与<b>面板密码</b>。
            关掉系统密码后，只能用面板密码登录，SSH 密码立即失效。
          </p>

          <template v-if="loginPolicy">
            <div class="switch-row">
              <label>允许用系统（SSH）密码登录</label>
              <span class="switch">
                <input
                  type="checkbox"
                  :checked="loginPolicy.allow_ssh_password"
                  :disabled="loginBusy || !loginPolicy.shadow_available"
                  @change="setSshLogin($event.target.checked)"
                />
                <span class="slider"></span>
              </span>
            </div>

            <div class="st-rows">
              <div class="st-row">
                <span>系统密码通道</span>
                <b>{{ loginPolicy.shadow_available ? '可用' : '不可用' }}</b>
              </div>
              <div class="st-row">
                <span>系统用户名</span>
                <b class="mono">{{ loginPolicy.ssh_username || '—' }}</b>
              </div>
              <div class="st-row">
                <span>面板密码</span>
                <b>{{ loginPolicy.has_admin_pw ? (loginPolicy.admin_kind || '已设置') : '未设置' }}</b>
              </div>
            </div>

            <p v-if="!loginPolicy.shadow_available" class="st-hint" style="margin-top:10px">
              系统密码不可用：{{ loginPolicy.shadow_note || '读不到 /etc/shadow（面板需要以 root 运行）' }}。
              这时开关是灰的，只能用面板密码登录。
            </p>
            <p v-else-if="!loginPolicy.allow_ssh_password" class="st-hint" style="margin-top:10px">
              <b>已关闭。</b>现在只能用面板密码登录。面板密码不是 SSH 密码；忘了就在服务器上执行
              <code class="mono">raincough -set-password</code> 重设，再重启面板。
            </p>
            <p v-else class="st-hint" style="margin-top:10px">
              关闭后只能用面板密码登录；已登录的浏览器不受影响，不会掉线。
            </p>

            <p v-if="loginErr" class="st-ping fail">{{ loginErr }}</p>
          </template>
          <p v-else-if="loginErr" class="st-ping fail">{{ loginErr }}</p>
          <p v-else class="st-hint">读取中…</p>

          <div class="st-group-title" style="margin-top:22px">面板密码</div>
          <p class="st-hint">
            独立于 SSH 的登录密码。设一个自己记得住的 —— 关掉系统密码后，这就是唯一的入口。
            至少 8 位；保存后其它设备需要重新登录，当前浏览器保持登录。
          </p>
          <div class="st-form">
            <label class="st-field">
              <span>新密码</span>
              <input v-model="newPW" class="input" type="password" autocomplete="new-password" />
            </label>
            <label class="st-field">
              <span>确认</span>
              <input
                v-model="newPW2"
                class="input"
                type="password"
                autocomplete="new-password"
                @keydown.enter="savePanelPassword"
              />
            </label>
          </div>
          <div class="st-actions">
            <button class="btn btn-primary" :disabled="pwBusy || !newPW" @click="savePanelPassword">
              {{ pwBusy ? '保存中…' : '设置面板密码' }}
            </button>
            <span v-if="pwMsg" class="st-ping" :class="pwOk ? 'ok' : 'fail'">{{ pwMsg }}</span>
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
