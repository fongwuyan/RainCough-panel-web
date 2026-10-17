<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useTerminal } from './useTerminal'

const tm = useTerminal()
const { sessions, activeId, activeState, hosts, commands, toast } = tm

const panel = ref('') // '' | hosts | cmds
const hostForm = reactive({ open: false, old: '', ps: '', host: '', port: 22, username: '', password: '' })
const cmdForm = reactive({ open: false, old: '', title: '', shell: '' })
const fullscreen = ref(false)
const wrapEl = ref(null)

const activeSession = computed(() => sessions.value.find((s) => s.id === activeId.value))

onMounted(async () => {
  tm.loadHosts()
  tm.loadCommands()
  createSession()
  window.addEventListener('resize', onResize)
  document.addEventListener('fullscreenchange', onFs)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('fullscreenchange', onFs)
  for (const s of [...sessions.value]) tm.closeSession(s.id)
})

let resizeTimer = null
function onResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => tm.fitActive(), 120)
}

function onFs() {
  fullscreen.value = !!document.fullscreenElement
  setTimeout(() => tm.fitActive(), 100)
}

function createSession() {
  const s = tm.newSession()
  nextTick(async () => {
    tm.attach(s.id, document.getElementById('xterm-' + s.id))
    await tm.connect(s.id)
  })
}

function pickSession(id) {
  tm.activate(id)
  panel.value = ''
}

function closeTab(id, e) {
  e && e.stopPropagation()
  tm.closeSession(id)
  if (!sessions.value.length) createSession()
}

function togglePanel(p) {
  panel.value = panel.value === p ? '' : p
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    wrapEl.value && wrapEl.value.requestFullscreen && wrapEl.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

// ---- 主机 ----

function editHost(h) {
  Object.assign(hostForm, {
    open: true,
    old: h ? (h.ps || h.host) : '',
    ps: h ? h.ps || '' : '',
    host: h ? h.host || '' : '',
    port: h ? h.port || 22 : 22,
    username: h ? h.username || '' : '',
    password: '',
  })
}

async function submitHost() {
  if (!hostForm.host) return tm.flash('主机地址必填')
  try {
    await tm.saveHost({
      _new: !hostForm.old,
      ps: hostForm.ps || hostForm.host,
      host: hostForm.host,
      port: Number(hostForm.port) || 22,
      username: hostForm.username,
      password: hostForm.password,
    })
    hostForm.open = false
  } catch (e) {
    tm.flash('保存失败: ' + (e.message || e))
  }
}

async function removeHost(h) {
  if (!confirm('删除主机 ' + (h.ps || h.host) + '?')) return
  try {
    await tm.deleteHost(h.ps || h.host)
  } catch (e) {
    tm.flash('删除失败: ' + (e.message || e))
  }
}

function connectHost(h) {
  panel.value = ''
  tm.sshTo(h, true)
}

// ---- 命令 ----

function editCmd(c) {
  Object.assign(cmdForm, {
    open: true,
    old: c ? c.title : '',
    title: c ? c.title : '',
    shell: c ? c.shell : '',
  })
}

async function submitCmd() {
  if (!cmdForm.title || !cmdForm.shell) return tm.flash('标题与命令都必填')
  try {
    await tm.saveCmd({ _new: !cmdForm.old, title: cmdForm.title, shell: cmdForm.shell })
    cmdForm.open = false
  } catch (e) {
    tm.flash('保存失败: ' + (e.message || e))
  }
}

async function removeCmd(c) {
  if (!confirm('删除命令 ' + c.title + '?')) return
  try {
    await tm.deleteCmd(c.title)
  } catch (e) {
    tm.flash('删除失败: ' + (e.message || e))
  }
}

function runCmd(c) {
  tm.runCmd(c)
  panel.value = ''
}

watch(activeId, () => nextTick(() => tm.fitActive()))
</script>

<template>
  <div ref="wrapEl" class="page tm-page" :class="{ fs: fullscreen }">
    <!-- 工具栏 -->
    <div class="tm-toolbar">
      <button class="btn btn-sm btn-primary" @click="createSession">+ 新建会话</button>

      <div class="tm-menu">
        <button class="btn btn-sm" :class="{ 'btn-primary': panel === 'hosts' }" @click="togglePanel('hosts')">主机</button>
        <div v-if="panel === 'hosts'" class="tm-pop" @click.stop>
          <div class="tm-pop-head">
            <span>SSH 主机</span>
            <button class="btn btn-sm btn-ghost" @click="editHost(null)">+ 添加</button>
          </div>
          <div v-if="!hosts.length" class="hint tm-pop-empty">还没有主机</div>
          <div v-for="h in hosts" :key="h.ps || h.host" class="tm-pop-item" @dblclick="connectHost(h)">
            <div class="tm-pop-main">
              <div class="tm-pop-title">{{ h.ps || h.host }}</div>
              <div class="tm-pop-sub mono">{{ (h.username ? h.username + '@' : '') + h.host }}:{{ h.port || 22 }}</div>
            </div>
            <button class="btn btn-sm btn-ghost" title="连接" @click="connectHost(h)">连接</button>
            <button class="btn btn-sm btn-ghost" title="编辑" @click="editHost(h)">改</button>
            <button class="btn btn-sm btn-ghost" title="删除" @click="removeHost(h)">×</button>
          </div>
          <div class="tm-pop-foot">点「连接」会在新标签里执行 ssh</div>
        </div>
      </div>

      <div class="tm-menu">
        <button class="btn btn-sm" :class="{ 'btn-primary': panel === 'cmds' }" @click="togglePanel('cmds')">命令</button>
        <div v-if="panel === 'cmds'" class="tm-pop" @click.stop>
          <div class="tm-pop-head">
            <span>常用命令</span>
            <button class="btn btn-sm btn-ghost" @click="editCmd(null)">+ 添加</button>
          </div>
          <div v-if="!commands.length" class="hint tm-pop-empty">还没有命令</div>
          <div v-for="c in commands" :key="c.title" class="tm-pop-item">
            <div class="tm-pop-main">
              <div class="tm-pop-title">{{ c.title }}</div>
              <div class="tm-pop-sub mono">{{ c.shell }}</div>
            </div>
            <button class="btn btn-sm btn-ghost" title="执行" @click="runCmd(c)">运行</button>
            <button class="btn btn-sm btn-ghost" title="编辑" @click="editCmd(c)">改</button>
            <button class="btn btn-sm btn-ghost" title="删除" @click="removeCmd(c)">×</button>
          </div>
          <div class="tm-pop-foot">点「运行」把命令敲进当前会话</div>
        </div>
      </div>

      <div class="tm-actions">
        <button class="btn btn-sm btn-ghost" title="复制选中" @click="tm.copyActive()">复制</button>
        <button class="btn btn-sm btn-ghost" title="粘贴" @click="tm.pasteActive()">粘贴</button>
        <button class="btn btn-sm btn-ghost" title="清屏" @click="tm.clearActive()">清屏</button>
        <button class="btn btn-sm btn-ghost" title="全屏" @click="toggleFullscreen">{{ fullscreen ? '退出全屏' : '全屏' }}</button>
      </div>

      <span class="tm-state" :class="'s-' + (activeSession ? activeSession.state : 'none')">{{ activeState }}</span>
    </div>

    <!-- 标签栏 -->
    <div class="tm-tabs">
      <div
        v-for="s in sessions"
        :key="s.id"
        class="tm-tab"
        :class="{ active: s.id === activeId }"
        @click="pickSession(s.id)"
      >
        <span class="tm-dot" :class="'s-' + s.state"></span>
        <span class="tm-tab-title">{{ s.title }}</span>
        <button class="tm-tab-x" @click="closeTab(s.id, $event)">×</button>
      </div>
    </div>

    <!-- 终端区 -->
    <div class="tm-body" @click="panel = ''">
      <div
        v-for="s in sessions"
        :key="s.id"
        :id="'xterm-' + s.id"
        v-show="s.id === activeId"
        class="tm-term"
      ></div>

      <div v-if="activeSession && activeSession.state === 'closed'" class="tm-mask">
        <div class="tm-mask-box">
          <div class="tm-mask-title">会话已结束</div>
          <div class="tm-mask-sub">{{ activeSession.err || 'shell 已退出' }}</div>
          <div class="tm-mask-actions">
            <button class="btn btn-primary" @click="tm.reconnect(activeSession.id)">重连</button>
            <button class="btn" @click="createSession">新建会话</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="tm-status">
      <span class="mono">{{ activeSession ? activeSession.sid || '—' : '无会话' }}</span>
      <span v-if="activeSession" class="mono">{{ activeSession.cols }}×{{ activeSession.rows }}</span>
      <span class="faint">选中文本自动复制 · 右键粘贴</span>
      <span class="tm-count">{{ sessions.length }} 个会话</span>
    </div>

    <!-- 主机表单 -->
    <div v-if="hostForm.open" class="overlay" @click.self="hostForm.open = false">
      <div class="modal tm-modal">
        <div class="modal-header">
          <span>{{ hostForm.old ? '编辑主机' : '添加主机' }}</span>
          <button class="btn btn-sm btn-ghost" @click="hostForm.open = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row"><label class="form-label">名称</label><input v-model="hostForm.ps" class="input" placeholder="显示名" /></div>
          <div class="form-row"><label class="form-label">主机</label><input v-model="hostForm.host" class="input" placeholder="IP 或域名" /></div>
          <div class="form-row"><label class="form-label">端口</label><input v-model="hostForm.port" class="input" type="number" /></div>
          <div class="form-row"><label class="form-label">用户</label><input v-model="hostForm.username" class="input" /></div>
          <div class="form-row"><label class="form-label">密码</label><input v-model="hostForm.password" class="input" type="password" placeholder="仅记录, 连接时需手动输入" /></div>
          <p class="faint" style="font-size:11px;margin:6px 0 0">
            面板只提供本机 pty, 连接时在终端里执行 <code>ssh</code>, 由本机 ssh 客户端完成认证。
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="hostForm.open = false">取消</button>
          <button class="btn btn-primary" @click="submitHost">保存</button>
        </div>
      </div>
    </div>

    <!-- 命令表单 -->
    <div v-if="cmdForm.open" class="overlay" @click.self="cmdForm.open = false">
      <div class="modal tm-modal">
        <div class="modal-header">
          <span>{{ cmdForm.old ? '编辑命令' : '添加命令' }}</span>
          <button class="btn btn-sm btn-ghost" @click="cmdForm.open = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row"><label class="form-label">标题</label><input v-model="cmdForm.title" class="input" /></div>
          <div class="form-row"><label class="form-label">命令</label><input v-model="cmdForm.shell" class="input mono" placeholder="ls -al /var/log" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="cmdForm.open = false">取消</button>
          <button class="btn btn-primary" @click="submitCmd">保存</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="tm-toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.tm-page { display: flex; flex-direction: column; height: calc(100vh - 66px); padding: 0; background: var(--surface); }
.tm-page.fs { height: 100vh; }

.tm-toolbar {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--surface-2);
}
.tm-actions { margin-left: auto; display: flex; gap: 2px; }
.tm-state { font-size: 11px; color: var(--text-faint); padding-left: 8px; font-family: var(--font-mono); }
.tm-state.s-open { color: var(--success); }
.tm-state.s-error, .tm-state.s-closed { color: var(--danger); }

.tm-menu { position: relative; }
.tm-pop {
  position: absolute; top: 30px; left: 0; z-index: 40; width: 380px;
  background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow);
  max-height: 420px; overflow: auto;
}
.tm-pop-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text-muted);
}
.tm-pop-empty { padding: 16px; font-size: 12px; }
.tm-pop-item {
  display: flex; align-items: center; gap: 6px; padding: 7px 10px;
  border-bottom: 1px solid var(--border);
}
.tm-pop-item:hover { background: var(--surface-2); }
.tm-pop-main { flex: 1; min-width: 0; }
.tm-pop-title { font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm-pop-sub { font-size: 11px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm-pop-foot { padding: 6px 10px; font-size: 10px; color: var(--text-faint); }

.tm-tabs { display: flex; gap: 2px; padding: 4px 8px 0; background: var(--bg-raised); border-bottom: 1px solid var(--border); overflow-x: auto; }
.tm-tab {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px;
  font-size: 12px; color: var(--text-muted); cursor: pointer;
  border: 1px solid transparent; border-bottom: 0; white-space: nowrap;
}
.tm-tab:hover { background: var(--surface-2); }
.tm-tab.active { background: var(--surface); color: var(--text); border-color: var(--border); }
.tm-dot { width: 6px; height: 6px; background: var(--text-faint); display: inline-block; }
.tm-dot.s-open { background: var(--success); }
.tm-dot.s-error, .tm-dot.s-closed { background: var(--danger); }
.tm-tab-x { border: 0; background: transparent; color: var(--text-faint); cursor: pointer; font-size: 13px; line-height: 1; }
.tm-tab-x:hover { color: var(--danger); }

.tm-body { flex: 1; position: relative; min-height: 0; background: var(--surface); }
.tm-term { position: absolute; inset: 0; padding: 6px 8px; }
.tm-term :deep(.xterm) { height: 100%; }

.tm-mask {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}
.tm-mask-box { background: var(--surface); border: 1px solid var(--border); padding: 20px 24px; text-align: center; box-shadow: var(--shadow); }
.tm-mask-title { font-size: 13px; color: var(--text); margin-bottom: 4px; }
.tm-mask-sub { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); margin-bottom: 14px; }
.tm-mask-actions { display: flex; gap: 8px; justify-content: center; }

.tm-status {
  display: flex; align-items: center; gap: 14px; padding: 5px 12px;
  border-top: 1px solid var(--border); background: var(--surface-2);
  font-size: 11px; color: var(--text-muted);
}
.tm-count { margin-left: auto; }
.tm-modal { width: 400px; max-width: 92vw; }

.tm-toast {
  position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%);
  background: var(--text); color: var(--bg); padding: 8px 16px; font-size: 12px; z-index: 90;
}
</style>
