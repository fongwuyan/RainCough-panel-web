<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({ ctx: { type: Object, required: true } })
const inv = (id, p, t) => props.ctx.host.api.ifaceInvoke(id, p, t)

const err = ref('')
const busy = ref('')
const repo = ref(null)
const gpu = ref(null)
const plan = ref(null)
const showCfg = ref(false)
const cfg = ref({ branch: 'main', mirror: true, local_dir: '', token: '' })

function msg(e) { return (e && e.message) || String(e) }

async function load() {
  busy.value = 'load'
  err.value = ''
  try {
    const r = await Promise.all([inv('drivers.repo', {}, 30000), inv('drivers.gpu', {}, 30000)])
    repo.value = r[0]
    gpu.value = r[1]
    cfg.value.branch = r[0].branch
    cfg.value.mirror = r[0].mirror
    cfg.value.local_dir = r[0].local_dir || ''
  } catch (e) {
    err.value = msg(e)
  } finally {
    busy.value = ''
  }
}

async function sync() {
  busy.value = 'sync'
  err.value = ''
  try {
    repo.value = await inv('drivers.repo', { refresh: true }, 40000)
    gpu.value = await inv('drivers.gpu', { refresh: true }, 30000)
  } catch (e) {
    err.value = msg(e)
  } finally {
    busy.value = ''
  }
}

async function save() {
  busy.value = 'save'
  err.value = ''
  try {
    await inv('drivers.repo.config', {
      branch: cfg.value.branch, mirror: !!cfg.value.mirror,
      local_dir: cfg.value.local_dir || '', token: cfg.value.token || undefined,
    }, 20000)
    cfg.value.token = ''
    repo.value = await inv('drivers.repo', { refresh: true }, 40000)
    gpu.value = await inv('drivers.gpu', { refresh: true }, 30000)
    showCfg.value = false
  } catch (e) {
    err.value = msg(e)
  } finally {
    busy.value = ''
  }
}

async function precheck(entryId) {
  busy.value = 'plan'
  err.value = ''
  try {
    plan.value = await inv('drivers.install', { mode: 'precheck', entry_id: entryId }, 30000)
  } catch (e) {
    plan.value = null
    err.value = msg(e)
  } finally {
    busy.value = ''
  }
}

function srcText(r) {
  if (!r) return '-'
  const used = r.used ? { local: '本地目录', direct: '直连', mirror1: '镜像1', mirror2: '镜像2', mirror3: '镜像3' }[r.used] || r.used : '不可达'
  const age = r.cache_age_s == null ? '-' : (r.cache_age_s < 60 ? r.cache_age_s + 's' : Math.round(r.cache_age_s / 60) + 'min')
  return `panel:${r.repo || 'fongwuyan/RainCough-panel-web'} @${r.branch} · ${used} · ${age}前 · ${r.count} 个条目`
}

function mb(n) { return n ? (n / 1048576).toFixed(0) + ' MB' : '-' }
function cv(v) { return v === true ? '开' : v === false ? '关' : '未知' }

onMounted(load)
</script>

<template>
  <div class="page"><div class="page-body">
    <div class="dr-bar">
      <button class="btn btn-sm" :disabled="!!busy" @click="sync">{{ busy === 'sync' ? '同步中…' : '同步' }}</button>
      <button class="btn btn-sm" @click="showCfg = !showCfg">{{ showCfg ? '收起配置' : '配置' }}</button>
      <span class="dr-origin">{{ srcText(repo) }}</span>
    </div>

    <div v-if="err" class="dr-err">{{ err }}</div>

    <div v-if="showCfg" class="dr-cfg">
      <label>分支<input class="input" v-model="cfg.branch" style="width:110px"></label>
      <label><input type="checkbox" v-model="cfg.mirror"> gh-proxy 镜像</label>
      <label>本地目录<input class="input" v-model="cfg.local_dir" placeholder="离线/自测用" style="width:280px"></label>
      <label>令牌<input class="input" v-model="cfg.token" type="password" placeholder="面板库私有才需要" style="width:200px"></label>
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
              <td>{{ c.has_display_output ? (c.connectors.length + ' 个' + (c.connected_outputs ? ' / 已接 ' + c.connected_outputs : '')) : '无' }}</td>
              <td class="dr-mono">{{ c.link.width || '-' }}<span class="dr-faint">/{{ c.link.max_width || '-' }}</span></td>
              <td>{{ c.gsp.supported ? (c.gsp.enabled === true ? '已启用' : c.gsp.enabled === false ? '已关闭' : '未知') + (c.gsp.disable_recommended ? ' · 建议关' : '') : '不支持' }}</td>
              <td>{{ c.repo_entry ? c.repo_entry.id : '无' }}<span v-if="c.repo_entry" class="dr-faint"> · {{ c.repo_entry.driver_version }}</span></td>
              <td>{{ c.ready.can_install ? '可安装' : (c.ready.blocked_by.join('/') || '缺条目') }}<span v-if="c.ready.missing.length" class="dr-faint"> · 缺 {{ c.ready.missing.join('/') }}</span><div v-for="w in c.warnings" :key="w" class="dr-warn">{{ w }}</div></td>
            </tr>
          </tbody>
        </table>
        <div v-if="gpu.conflicts.deb_nvidia.length" class="dr-rule">
          冲突包: <span v-for="p in gpu.conflicts.deb_nvidia" :key="p.pkg" class="dr-mono">{{ p.pkg }} {{ p.version }} </span>
        </div>
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
            <td>{{ e.patch.blocks }} 块<br><span class="dr-mono dr-faint">{{ e.patch.result_sha256.slice(0, 12) }}…</span></td>
            <td>{{ mb(e.base.size_b) }}<br><span class="dr-mono dr-faint">{{ (e.base.sha256_expected || '').slice(0, 12) }}…</span></td>
            <td class="dr-faint">{{ e.post.join(' / ') }}</td>
            <td><button class="btn btn-sm" :disabled="!!busy" @click="precheck(e.id)">预检</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="plan" class="dr-sec">
      <div class="dr-sec-t">{{ plan.title }} · 计划 {{ plan.plan_id }} · {{ plan.mode }}</div>
      <div class="dr-rule">来源 {{ plan.source.repo }} @{{ plan.source.branch }} ({{ plan.source.used }})<br>{{ plan.source.manifest_url }}</div>
      <div class="dr-rule">官方驱动 {{ plan.base.version }} · {{ mb(plan.base.size_b) }} · 下载方式 {{ plan.base.download.mode }} × {{ plan.base.download.connections }}（续传 {{ plan.base.download.resume ? '开' : '关' }}）<br>
        <span class="dr-mono">sha256 {{ plan.base.sha256_expected }}</span><br>
        校验: {{ plan.base.verify.join(' + ') }}</div>
      <div class="dr-rule">补丁 {{ plan.patch.path }} · 靶点 <span class="dr-mono">{{ plan.patch.target }}</span> · {{ plan.patch.blocks }} 块 · dry-run {{ plan.patch.dry_run_required ? '必需' : '关' }}<br>
        <span class="dr-mono">base {{ plan.patch.base_sha256.slice(0, 16) }}… → result {{ plan.patch.result_sha256.slice(0, 16) }}…</span></div>
      <div class="dr-rule">前置: {{ plan.prereq.length ? plan.prereq.join(' / ') : '无' }}<br>
        冲突: {{ plan.conflicts.length ? plan.conflicts.map((c) => c.pkg + ' ' + c.version).join(' / ') : '无' }}<br>
        将写入 {{ plan.modprobe.file }}: <span class="dr-mono">{{ plan.modprobe.lines.join(' | ') }}</span></div>
      <div class="dr-rule">影响: initramfs {{ plan.side_effects.initramfs ? '会重建' : '不动' }} · nouveau 黑名单 {{ plan.side_effects.nouveau_blacklist ? '会写入' : '不写' }} · 需重启 {{ plan.reboot_required ? '是' : '否' }}<br>
        退路: {{ plan.rollback.uninstaller }} / {{ plan.rollback.restore_deb }} / 用缓存重打</div>
      <div class="dr-rule">确认项: {{ plan.requires_confirm.join(' / ') }}</div>
      <div v-for="w in plan.warnings" :key="w" class="dr-warn">{{ w }}</div>
      <div class="dr-src">{{ plan.notes }}</div>
      <div class="dr-rule">将执行 ({{ plan.commands.length }})</div>
      <div v-for="c in plan.commands" :key="c.cmd" class="dr-cmd"><span class="dr-mono">{{ c.cmd }}</span><span class="dr-faint"> — {{ c.why }}</span></div>
    </div>
  </div></div>
</template>

<style scoped>
.dr-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.dr-origin { font-size: 12px; color: var(--text-faint); font-family: var(--font-mono); }
.dr-cfg { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 20px; margin-bottom: 14px;
  background: var(--surface); border: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }
.dr-cfg label { display: flex; align-items: center; gap: 6px; }
.dr-sec { background: var(--surface); border: 1px solid var(--border); padding: 16px 20px; margin-bottom: 18px; }
.dr-sec-t { font-size: 13px; font-weight: 700; color: var(--text); padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border); }
.dr-empty { font-size: 12px; color: var(--text-faint); padding: 10px 0; }
.dr-err { font-size: 12px; color: var(--danger); padding: 10px 0; }
.dr-warn { font-size: 12px; color: var(--danger); margin-top: 4px; }
.dr-rule { font-size: 12px; color: var(--text-muted); line-height: 1.9; margin-bottom: 8px; }
.dr-cmd { font-size: 12px; color: var(--text-muted); line-height: 1.8; }
.dr-src { font-size: 12px; color: var(--text-faint); line-height: 1.8; margin-bottom: 8px; }
.dr-mono { font-family: var(--font-mono); }
.dr-faint { color: var(--text-faint); }
.dr-tag { margin-left: 6px; padding: 1px 8px; font-size: 10px; color: var(--accent); background: var(--accent-soft); }
.dr-fake { margin-left: 8px; padding: 1px 8px; font-size: 10px; color: var(--danger); border: 1px solid var(--border); }
</style>
