<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({ ctx: { type: Object, required: true } })
const inv = (id, p, t) => props.ctx.host.api.ifaceInvoke(id, p, t)

const err = ref('')
const busy = ref('')
const repo = ref(null)
const gpu = ref(null)
const plan = ref(null)
const task = ref(null)
const logs = ref(null)
const showCfg = ref(false)
const typed = ref('')
const ack = ref([])
let timer = null

const cfg = ref({ branch: 'main', mirror: true, local_dir: '', token: '', gpg: true, gpg_fpr: '' })

function msg(e) { return (e && e.message) || String(e) }
function mb(n) { return n ? (n / 1048576).toFixed(0) + ' MB' : '-' }
function cv(v) { return v === true ? '开' : v === false ? '关' : '未知' }
function short(s) { return (s || '').slice(0, 12) + (s ? '…' : '') }
function srcText(r) {
  if (!r) return '-'
  const used = r.used ? ({ local: '本地目录', direct: '直连', mirror1: '镜像1', mirror2: '镜像2', mirror3: '镜像3' }[r.used] || r.used) : '不可达'
  const age = r.cache_age_s == null ? '-' : (r.cache_age_s < 60 ? r.cache_age_s + 's' : Math.round(r.cache_age_s / 60) + 'min')
  return `panel @${r.branch} · ${used} · ${age}前 · ${r.count} 个条目`
}
function gpgText(r) {
  const g = (r && r.gpg) || {}
  if (!g.enabled) return '签名校验 关'
  return g.verified ? `签名 已验证 · ${String(g.fpr || '').slice(0, 16)}…` : `签名 未验证${g.error ? ' · ' + g.error : ''}`
}

async function load() {
  busy.value = 'load'
  err.value = ''
  try {
    const r = await Promise.all([inv('drivers.repo', {}, 40000), inv('drivers.gpu', {}, 30000)])
    repo.value = r[0]
    gpu.value = r[1]
    Object.assign(cfg.value, {
      branch: r[0].branch, mirror: r[0].mirror, local_dir: r[0].local_dir || '',
      gpg: (r[0].gpg || {}).enabled !== false, gpg_fpr: (r[0].gpg || {}).expected_fpr || '',
    })
    const t = await inv('drivers.task', {}, 20000)
    if (t.active) { task.value = t.active; startPoll() }
  } catch (e) { err.value = msg(e) } finally { busy.value = '' }
}

async function sync() {
  busy.value = 'sync'; err.value = ''
  try {
    repo.value = await inv('drivers.repo', { refresh: true }, 40000)
    gpu.value = await inv('drivers.gpu', { refresh: true }, 30000)
  } catch (e) { err.value = msg(e) } finally { busy.value = '' }
}

async function save() {
  busy.value = 'save'; err.value = ''
  try {
    await inv('drivers.repo.config', {
      branch: cfg.value.branch, mirror: !!cfg.value.mirror, local_dir: cfg.value.local_dir || '',
      token: cfg.value.token || undefined, gpg: !!cfg.value.gpg, gpg_fpr: cfg.value.gpg_fpr || undefined,
    }, 20000)
    cfg.value.token = ''
    showCfg.value = false
    await sync()
  } catch (e) { err.value = msg(e) } finally { busy.value = '' }
}

async function precheck(p) {
  busy.value = 'plan'; err.value = ''; plan.value = null; typed.value = ''; ack.value = []
  try {
    plan.value = await inv('drivers.install', p, 30000)
  } catch (e) { err.value = msg(e) } finally { busy.value = '' }
}

async function doApply() {
  if (!plan.value) return
  busy.value = 'apply'; err.value = ''
  try {
    const r = await inv('drivers.install', {
      mode: 'apply', plan_id: plan.value.plan_id,
      confirm: { acknowledge: ack.value, typed: typed.value },
    }, 40000)
    task.value = { id: r.task_id, state: r.state, commands: [], progress: [] }
    startPoll()
  } catch (e) { err.value = msg(e) } finally { busy.value = '' }
}

async function doRevert(action) {
  busy.value = 'plan'; err.value = ''; plan.value = null; typed.value = ''; ack.value = []
  try {
    plan.value = await inv('drivers.revert', { mode: 'precheck', action }, 30000)
  } catch (e) { err.value = msg(e) } finally { busy.value = '' }
}

function startPoll() {
  stopPoll()
  timer = setInterval(async () => {
    if (!task.value || !task.value.id) return
    try {
      task.value = await inv('drivers.task', { id: task.value.id }, 20000)
      if (['done', 'failed', 'cancelled'].includes(task.value.state)) {
        stopPoll()
        await afterTask()
      }
    } catch (e) { stopPoll(); err.value = msg(e) }
  }, 2000)
}
function stopPoll() { if (timer) { clearInterval(timer); timer = null } }

async function afterTask() {
  try {
    repo.value = await inv('drivers.repo', {}, 30000)
    gpu.value = await inv('drivers.gpu', { refresh: true }, 30000)
    logs.value = await inv('drivers.log', { limit: 20 }, 20000)
  } catch (e) { err.value = msg(e) }
}

async function cancelTask() {
  if (!task.value) return
  try { await inv('drivers.cancel', { id: task.value.id }, 20000) } catch (e) { err.value = msg(e) }
}

async function loadLogs() {
  busy.value = 'log'
  try { logs.value = await inv('drivers.log', { limit: 50 }, 20000) } catch (e) { err.value = msg(e) } finally { busy.value = '' }
}

function pct(t) {
  const p = (t && t.progress) || []
  for (let i = p.length - 1; i >= 0; i--) if (p[i].pct != null) return p[i].pct
  return t && t.state === 'done' ? 100 : null
}

onMounted(load)
onBeforeUnmount(stopPoll)
</script>

<template>
  <div class="page"><div class="page-body">
    <div class="dr-bar">
      <button class="btn btn-sm" :disabled="!!busy" @click="sync">{{ busy === 'sync' ? '同步中…' : '同步' }}</button>
      <button class="btn btn-sm" @click="showCfg = !showCfg">{{ showCfg ? '收起配置' : '配置' }}</button>
      <span class="dr-origin">{{ srcText(repo) }} · {{ gpgText(repo) }}</span>
    </div>

    <div v-if="err" class="dr-err">{{ err }}</div>

    <div v-if="showCfg" class="dr-cfg">
      <label>分支<input class="input" v-model="cfg.branch" style="width:100px"></label>
      <label><input type="checkbox" v-model="cfg.mirror"> 镜像</label>
      <label><input type="checkbox" v-model="cfg.gpg"> 签名校验</label>
      <label>指纹<input class="input" v-model="cfg.gpg_fpr" style="width:330px"></label>
      <label>本地目录<input class="input" v-model="cfg.local_dir" style="width:220px"></label>
      <label>令牌<input class="input" v-model="cfg.token" type="password" style="width:150px"></label>
      <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="save">保存</button>
    </div>

    <div v-if="repo && repo.problems && repo.problems.length" class="dr-sec">
      <div class="dr-sec-t">清单问题 ({{ repo.problems.length }})</div>
      <div v-for="p in repo.problems" :key="p.id" class="dr-warn">{{ p.id }}: {{ p.error }}</div>
    </div>

    <template v-if="gpu">
      <div class="dr-sec">
        <div class="dr-sec-t">核心 {{ gpu.tools.kernel }} · Secure Boot {{ cv(gpu.secure_boot) }} · DKMS {{ gpu.tools.dkms ? '已装' : '未装' }} · headers {{ gpu.tools.headers ? '已装' : '未装' }} · 磁盘 {{ gpu.tools.free_disk_mb }} MB<span v-if="gpu.fake" class="dr-fake">模拟数据</span></div>
      </div>

      <div class="dr-sec">
        <div class="dr-sec-t">NVIDIA 卡 ({{ gpu.cards.length }})</div>
        <div v-if="!gpu.cards.length" class="dr-empty">没有 NVIDIA 设备</div>
        <table v-else class="table">
          <thead><tr><th>地址</th><th>型号</th><th>架构</th><th>算力</th><th>驱动</th><th>输出</th><th>链路</th><th>GSP</th><th>匹配条目</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="c in gpu.cards" :key="c.bdf">
              <td class="dr-mono">{{ c.bdf }}<br><span class="dr-faint">{{ c.pci_id }}</span></td>
              <td>{{ c.model }}<span v-if="c.mining" class="dr-tag">矿卡 {{ c.mining_class }}</span></td>
              <td>{{ c.arch || '-' }}</td>
              <td>{{ c.compute_cap || '-' }}</td>
              <td>{{ c.driver || '未装' }}<span v-if="c.driver_version" class="dr-faint"> {{ c.driver_version }}</span><span v-if="c.driver_source !== 'none'" class="dr-faint"> ({{ c.driver_source }})</span></td>
              <td>{{ c.has_display_output ? c.connectors.length + ' 个' : '无' }}</td>
              <td class="dr-mono">{{ c.link.width || '-' }}<span class="dr-faint">/{{ c.link.max_width || '-' }}</span></td>
              <td>{{ c.gsp.supported ? (c.gsp.enabled === true ? '已启用' : c.gsp.enabled === false ? '已关闭' : '未知') + (c.gsp.disable_recommended ? ' · 建议关' : '') : '不支持' }}</td>
              <td>{{ c.repo_entry ? c.repo_entry.id + ' · ' + c.repo_entry.driver_version : '无' }}</td>
              <td>{{ c.ready.can_install ? '可安装' : (c.ready.blocked_by.join('/') || '缺条目') }}<span v-if="c.ready.missing.length" class="dr-faint"> · 缺 {{ c.ready.missing.join('/') }}</span><div v-for="w in c.warnings" :key="w" class="dr-warn">{{ w }}</div></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="dr-sec">
        <div class="dr-sec-t">容器直通 ({{ gpu.container.toolkit_installed ? '已装 ' + gpu.container.version : '未装' }})</div>
        <div class="dr-rule">docker {{ gpu.container.docker ? '已装' : '未装' }} · nvidia-ctk {{ gpu.container.nvidia_ctk ? '有' : '无' }} · docker runtime {{ gpu.container.docker_runtime_configured ? '已配置' : '未配置' }} · 源文件 {{ gpu.container.list_file ? '在' : '无' }} · keyring {{ gpu.container.keyring ? '在' : '无' }}</div>
        <button class="btn btn-sm" :disabled="!!busy" @click="precheck({ mode: 'precheck', kind: 'container-toolkit' })">预检安装</button>
      </div>
    </template>

    <div v-if="repo" class="dr-sec">
      <div class="dr-sec-t">补丁清单 ({{ repo.entries.length }})</div>
      <div v-if="repo.error" class="dr-err">{{ repo.error }}</div>
      <div v-if="!repo.entries.length" class="dr-empty">清单里没有条目</div>
      <table v-else class="table">
        <thead><tr><th>条目</th><th>适用卡</th><th>版本</th><th>补丁</th><th>官方驱动</th><th>收尾</th><th></th></tr></thead>
        <tbody>
          <tr v-for="e in repo.entries" :key="e.id">
            <td>{{ e.title }}<br><span class="dr-mono dr-faint">{{ e.id }}</span></td>
            <td class="dr-faint">{{ e.card_names.join(' / ') }}<br><span class="dr-mono">{{ e.card_pci_ids.join(' ') }}</span></td>
            <td class="dr-mono">{{ e.driver_version }}</td>
            <td>{{ e.patch.blocks }} 块<br><span class="dr-mono dr-faint">{{ short(e.patch.result_sha256) }}</span></td>
            <td>{{ mb(e.base.size_b) }}<br><span class="dr-mono dr-faint">{{ short(e.base.sha256_expected) }}</span></td>
            <td class="dr-faint">{{ e.post.join(' / ') }}</td>
            <td><button class="btn btn-sm" :disabled="!!busy" @click="precheck({ mode: 'precheck', entry_id: e.id })">预检</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="plan" class="dr-sec">
      <div class="dr-sec-t">{{ plan.title }} · {{ plan.plan_id }} · {{ plan.kind }} · {{ plan.entry_id }}</div>
      <div class="dr-rule" v-if="plan.source">来源 {{ plan.source.repo }} @{{ plan.source.branch }} <span v-if="plan.source.used">({{ plan.source.used }})</span><span v-if="plan.gpg && plan.gpg.verified"> · 签名已验证</span></div>
      <div class="dr-rule" v-if="plan.base">官方驱动 {{ plan.base.version }} · {{ mb(plan.base.size_b) }}<span v-if="plan.base.download"> · {{ plan.base.download.mode }} × {{ plan.base.download.connections }}</span><br><span class="dr-mono">sha256 {{ plan.base.sha256_expected }}</span></div>
      <div class="dr-rule" v-if="plan.patch">补丁 <span class="dr-mono">{{ plan.patch.path }}</span> · 靶点 <span class="dr-mono">{{ plan.patch.target }}</span> · {{ plan.patch.blocks }} 块<br><span class="dr-mono">{{ short(plan.patch.base_sha256) }} → {{ short(plan.patch.result_sha256) }}</span></div>
      <div class="dr-rule" v-if="plan.prereq">前置: {{ plan.prereq.length ? plan.prereq.join(' / ') : '无' }}<span v-if="plan.conflicts"> · 冲突: {{ plan.conflicts.length ? plan.conflicts.map((c) => c.pkg).join(' / ') : '无' }}</span></div>
      <div class="dr-rule" v-if="plan.modprobe">将写入 <span class="dr-mono">{{ plan.modprobe.file }}</span>: <span class="dr-mono">{{ plan.modprobe.lines.join(' | ') }}</span></div>
      <div class="dr-rule" v-if="plan.side_effects">initramfs {{ plan.side_effects.initramfs ? '会重建' : '不动' }} · 黑名单 {{ plan.side_effects.nouveau_blacklist ? '会写' : '不写' }} · 需重启 {{ plan.reboot_required ? '是' : '否' }}</div>
      <div v-for="w in plan.warnings || []" :key="w" class="dr-warn">{{ w }}</div>
      <div class="dr-rule">将执行 ({{ plan.commands.length }})</div>
      <div v-for="c in plan.commands" :key="c.cmd" class="dr-cmd"><span class="dr-mono">{{ c.cmd }}</span><span class="dr-faint"> — {{ c.why }}</span></div>
      <div class="dr-rule">确认项</div>
      <label v-for="a in plan.requires_confirm" :key="a" class="dr-ack"><input type="checkbox" :value="a" v-model="ack"> {{ a }}</label>
      <div class="dr-bar" style="margin-top:8px;">
        <input class="input" v-model="typed" :placeholder="'输入以确认: ' + (plan.typed_expect || '')" style="width:260px">
        <button class="btn btn-sm btn-danger" :disabled="!!busy || ack.length < (plan.requires_confirm || []).length || typed !== plan.typed_expect" @click="doApply">确认执行</button>
      </div>
    </div>

    <div v-if="task" class="dr-sec">
      <div class="dr-sec-t">{{ task.action || '任务' }} {{ task.id }} · {{ task.state }}<span v-if="pct(task) != null"> · {{ pct(task) }}%</span></div>
      <div class="dr-bar">
        <button class="btn btn-sm" :disabled="!['queued', 'running'].includes(task.state)" @click="cancelTask">取消任务</button>
        <span v-if="task.error" class="dr-err">{{ task.error }}</span>
      </div>
      <div v-if="task.progress && task.progress.length" class="dr-rule">{{ task.progress[task.progress.length - 1].label }}</div>
      <div v-for="(c, i) in task.commands" :key="i" class="dr-cmd">
        <span class="dr-mono">{{ c.cmd }}</span>
        <span class="dr-faint"> rc={{ c.rc }} {{ c.ms }}ms</span>
        <div v-if="c.out_tail" class="dr-out">{{ c.out_tail }}</div>
      </div>
      <div v-if="task.effects && task.effects.patch" class="dr-rule">补丁: 靶点 {{ task.effects.patch.target }} · {{ task.effects.patch.already ? '原本已完成' : '已应用' }} · <span class="dr-mono">{{ short(task.effects.patch.sha256) }}</span></div>
      <div v-if="task.effects && task.effects.nvidia_smi" class="dr-rule"><span class="dr-mono">{{ task.effects.nvidia_smi }}</span></div>
    </div>

    <div class="dr-sec">
      <div class="dr-sec-t">退路</div>
      <div class="dr-bar">
        <button class="btn btn-sm" :disabled="!!busy" @click="doRevert('uninstall')">官方卸载</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="doRevert('deb')">回 Debian 包</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="doRevert('repatch')">回补丁前</button>
      </div>
    </div>

    <div class="dr-sec">
      <div class="dr-sec-t">日志 {{ logs ? '(' + logs.total + ')' : '' }}</div>
      <div class="dr-bar"><button class="btn btn-sm" :disabled="!!busy" @click="loadLogs">刷新日志</button></div>
      <div v-if="!logs" class="dr-empty">未加载</div>
      <div v-else-if="!logs.items.length" class="dr-empty">暂无记录</div>
      <table v-else class="table">
        <thead><tr><th>时间</th><th>动作</th><th>结果</th><th>命令</th><th>备份</th></tr></thead>
        <tbody>
          <tr v-for="l in logs.items.slice().reverse()" :key="l.id + l.ts">
            <td class="dr-mono">{{ new Date(l.ts * 1000).toLocaleString('zh-CN', { hour12: false }) }}</td>
            <td>{{ l.action }}</td>
            <td :class="{ 'dr-err': l.result !== 'ok' }">{{ l.result }}</td>
            <td>{{ (l.commands || []).length }}</td>
            <td class="dr-mono dr-faint">{{ l.backup || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div></div>
</template>

<style scoped>
.dr-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.dr-origin { font-size: 12px; color: var(--text-faint); font-family: var(--font-mono); }
.dr-cfg { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 20px; margin-bottom: 14px;
  background: var(--surface); border: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }
.dr-cfg label, .dr-ack { display: flex; align-items: center; gap: 6px; }
.dr-ack { font-size: 12px; color: var(--text-muted); margin: 2px 0; }
.dr-sec { background: var(--surface); border: 1px solid var(--border); padding: 16px 20px; margin-bottom: 18px; }
.dr-sec-t { font-size: 13px; font-weight: 700; color: var(--text); padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border); }
.dr-empty { font-size: 12px; color: var(--text-faint); padding: 10px 0; }
.dr-err { font-size: 12px; color: var(--danger); padding: 6px 0; }
.dr-warn { font-size: 12px; color: var(--danger); margin: 4px 0; }
.dr-rule { font-size: 12px; color: var(--text-muted); line-height: 1.9; margin-bottom: 8px; }
.dr-cmd { font-size: 12px; color: var(--text-muted); line-height: 1.8; margin-bottom: 4px; }
.dr-out { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); white-space: pre-wrap; max-height: 120px; overflow: auto; }
.dr-mono { font-family: var(--font-mono); }
.dr-faint { color: var(--text-faint); }
.dr-tag { margin-left: 6px; padding: 1px 8px; font-size: 10px; color: var(--accent); background: var(--accent-soft); }
.dr-fake { margin-left: 8px; padding: 1px 8px; font-size: 10px; color: var(--danger); border: 1px solid var(--border); }
</style>
