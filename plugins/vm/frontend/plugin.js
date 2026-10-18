// 虚拟机插件前端(接口库 v4)
// 列表 + 实时监控 + 详情抽屉 + 创建向导 + 快照管理
import { createApp } from 'vue'

const NAME = 'vm'
const STYLE_ID = 'rc-vm-style'

const CSS = `
.rcvm{padding:4px 0}
.rcvm-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-size:12px;color:var(--text-muted)}
.rcvm-bar .sep{color:var(--border-strong)}
.rcvm-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}
.rcvm-dot.on{background:var(--success)}
.rcvm-dot.off{background:var(--text-faint)}
.rcvm-dot.warn{background:var(--warning)}
.rcvm-dot.err{background:var(--danger)}

.rcvm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.rcvm-card{border:1px solid var(--border);background:var(--surface);padding:12px 14px;transition:border-color .15s,box-shadow .15s}
.rcvm-card:hover{border-color:var(--border-strong);box-shadow:var(--shadow-sm)}
.rcvm-card.sel{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.rcvm-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.rcvm-name{font-size:13px;font-weight:600;color:var(--text);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.rcvm-name:hover{color:var(--accent)}
.rcvm-badge{font-size:10.5px;padding:1px 7px;border:1px solid;white-space:nowrap}
.rcvm-badge.running{color:var(--success);border-color:var(--success);background:var(--success-soft)}
.rcvm-badge.shutoff{color:var(--text-faint);border-color:var(--border);background:var(--surface-2)}
.rcvm-badge.paused{color:var(--warning);border-color:var(--warning);background:var(--warning-soft)}
.rcvm-badge.crashed{color:var(--danger);border-color:var(--danger);background:var(--danger-soft)}
.rcvm-badge.shutdown{color:var(--warning);border-color:var(--warning);background:var(--warning-soft)}
.rcvm-meta{font-size:11px;color:var(--text-muted);display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.rcvm-meta b{color:var(--text);font-weight:500}
.rcvm-note{font-size:11px;color:var(--text-faint);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.rcvm-meter{margin-bottom:6px}
.rcvm-meter .lbl{display:flex;justify-content:space-between;font-size:10.5px;color:var(--text-faint);margin-bottom:2px}
.rcvm-meter .track{height:5px;background:var(--surface-3);overflow:hidden}
.rcvm-meter .fill{height:100%;background:var(--accent);transition:width .4s ease}
.rcvm-meter .fill.hi{background:var(--danger)}

.rcvm-acts{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px;padding-top:9px;border-top:1px solid var(--border)}

.rcvm-empty{border:1px dashed var(--border);padding:44px 20px;text-align:center;color:var(--text-faint);font-size:12px}
.rcvm-empty .t{font-size:13px;color:var(--text-muted);margin-bottom:6px}

.rcvm-drawer{border:1px solid var(--border);background:var(--surface);margin-top:12px}
.rcvm-drawer-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface-2)}
.rcvm-drawer-hd .t{font-size:13px;font-weight:600}
.rcvm-sec{padding:10px 14px;border-bottom:1px solid var(--border)}
.rcvm-sec:last-child{border-bottom:none}
.rcvm-sec-t{font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px}
.rcvm-kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:12px}
.rcvm-kv .k{color:var(--text-muted)}
.rcvm-kv .v{color:var(--text);word-break:break-all;font-family:var(--font-mono);font-size:11.5px}
.rcvm-item{font-size:11.5px;color:var(--text);padding:5px 0;border-bottom:1px dashed var(--border);font-family:var(--font-mono)}
.rcvm-item:last-child{border-bottom:none}
.rcvm-item .tag{font-family:var(--font);color:var(--text-faint);font-size:10.5px;margin-left:6px}

.rcvm-modal-bg{position:fixed;inset:0;background:rgba(10,12,18,.55);z-index:80;display:flex;align-items:center;justify-content:center;padding:20px}
.rcvm-modal{background:var(--surface);border:1px solid var(--border);width:100%;max-width:520px;max-height:86vh;overflow:auto;box-shadow:var(--shadow)}
.rcvm-modal-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)}
.rcvm-modal-hd .t{font-size:13px;font-weight:600}
.rcvm-modal-bd{padding:14px 16px}
.rcvm-modal-ft{padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}
.rcvm-field{margin-bottom:11px}
.rcvm-field label{display:block;font-size:11.5px;color:var(--text-muted);margin-bottom:4px}
.rcvm-field input,.rcvm-field select,.rcvm-field textarea{width:100%;padding:6px 9px;font-size:12.5px;background:var(--bg-raised);color:var(--text);border:1px solid var(--border);font-family:inherit}
.rcvm-field input:focus,.rcvm-field select:focus,.rcvm-field textarea:focus{outline:none;border-color:var(--accent)}
.rcvm-field .hint{font-size:10.5px;color:var(--text-faint);margin-top:3px}
.rcvm-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

.rcvm-msg{padding:7px 11px;font-size:11.5px;margin-bottom:10px;border:1px solid}
.rcvm-msg.err{color:var(--danger);border-color:var(--danger);background:var(--danger-soft)}
.rcvm-msg.ok{color:var(--success);border-color:var(--success);background:var(--success-soft)}
.rcvm-load{padding:26px;text-align:center;color:var(--text-faint);font-size:12px}
.rcvm-spin{display:inline-block;width:12px;height:12px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:rcvm-rot .7s linear infinite;margin-right:6px;vertical-align:-2px}
@keyframes rcvm-rot{to{transform:rotate(360deg)}}
`

function mount(container, ctx) {
  const App = {
    template: `
<div class="rcvm">
  <div v-if="err" class="rcvm-msg err">{{ err }}</div>
  <div v-if="okMsg" class="rcvm-msg ok">{{ okMsg }}</div>

  <div class="rcvm-bar">
    <span v-if="info">
      <span class="rcvm-dot" :class="info.have_kvm ? 'on' : 'warn'"></span>
      {{ info.have_kvm ? 'KVM 硬件加速' : '无 KVM(纯模拟)' }}
      <span class="sep">·</span>
      libvirt {{ info.libvirt || '?' }}
      <span class="sep">·</span>
      <b>{{ doms.filter(d => d.state === 'running').length }}</b> / {{ doms.length }} 运行中
    </span>
    <span v-else-if="loading" class="rcvm-spin"></span>
    <span style="flex:1"></span>
    <button class="btn btn-sm" :disabled="loading" @click="reload">{{ loading ? '刷新中…' : '刷新' }}</button>
    <button class="btn btn-sm btn-primary" :disabled="!canManage" @click="openCreate">新建虚拟机</button>
  </div>

  <div v-if="info && !info.have_kvm && info.kvm_note" class="rcvm-msg err">{{ info.kvm_note }}</div>
  <div v-if="info && !info.can_manage" class="rcvm-msg err">
    当前只能查看：面板以用户「{{ info.user }}」运行，没有 root 权限也没有免密 sudo。
    启停/创建/删除需要 root —— 请让面板以 root 运行，或为该用户配置 NOPASSWD sudo。
  </div>
  <div v-if="info && info.list_error" class="rcvm-msg err">读取虚拟机列表失败：{{ info.list_error }}</div>

  <div v-if="!doms.length && !loading" class="rcvm-empty">
    <div class="t">还没有虚拟机</div>
    <div>点右上角「新建虚拟机」，从已有镜像创建一个</div>
  </div>

  <div class="rcvm-grid">
    <div v-for="d in doms" :key="d.name" class="rcvm-card" :class="{ sel: sel && sel.name === d.name }">
      <div class="rcvm-hd">
        <span class="rcvm-name" :title="d.name" @click="openDetail(d)">{{ d.name }}</span>
        <span class="rcvm-badge" :class="d.state">{{ d.state_label }}</span>
      </div>
      <div class="rcvm-meta">
        <span>CPU <b>{{ d.vcpu || '-' }}</b> 核</span>
        <span>内存 <b>{{ d.memory_mb ? (d.memory_mb / 1024).toFixed(1) : '-' }}</b> GB</span>
        <span v-if="d.autostart">开机自启</span>
      </div>
      <div v-if="d.note" class="rcvm-note" :title="d.note">{{ d.note }}</div>

      <template v-if="d.state === 'running' && stats[d.name]">
        <div class="rcvm-meter">
          <div class="lbl"><span>CPU</span><span>{{ stats[d.name].cpu_pct }}%</span></div>
          <div class="track"><div class="fill" :class="{ hi: stats[d.name].cpu_pct > 85 }" :style="{ width: Math.min(stats[d.name].cpu_pct, 100) + '%' }"></div></div>
        </div>
        <div class="rcvm-meter">
          <div class="lbl"><span>内存</span><span>{{ stats[d.name].mem_cur_mb }} / {{ stats[d.name].mem_max_mb }} MB</span></div>
          <div class="track"><div class="fill" :style="{ width: stats[d.name].mem_pct + '%' }"></div></div>
        </div>
        <div class="rcvm-meta">
          <span>↓ {{ fmtRate(stats[d.name].net_rx_kbps) }}</span>
          <span>↑ {{ fmtRate(stats[d.name].net_tx_kbps) }}</span>
          <span v-if="stats[d.name].warmup" style="color:var(--text-faint)">测量中…</span>
        </div>
      </template>

      <div class="rcvm-acts">
        <button v-if="d.state !== 'running'" class="btn btn-sm btn-primary" :disabled="busy[d.name] || !canManage" @click="act(d, 'start')">开机</button>
        <template v-else>
          <button class="btn btn-sm" :disabled="busy[d.name] || !canManage" @click="act(d, 'shutdown')">关机</button>
          <button class="btn btn-sm" :disabled="busy[d.name] || !canManage" @click="act(d, 'reboot')">重启</button>
          <button class="btn btn-sm" :disabled="busy[d.name] || !canManage" @click="act(d, 'suspend')">挂起</button>
          <button class="btn btn-sm btn-danger" :disabled="busy[d.name] || !canManage" @click="act(d, 'destroy')">强制断电</button>
        </template>
        <button v-if="d.state === 'paused'" class="btn btn-sm" :disabled="busy[d.name] || !canManage" @click="act(d, 'resume')">恢复</button>
        <button class="btn btn-sm btn-ghost" @click="openDetail(d)">详情</button>
      </div>
    </div>
  </div>

  <!-- 详情抽屉 -->
  <div v-if="sel" class="rcvm-drawer">
    <div class="rcvm-drawer-hd">
      <span class="t">{{ sel.name }}</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" :disabled="busy[sel.name]" @click="act(sel, sel.state === 'running' ? 'shutdown' : 'start')">
          {{ sel.state === 'running' ? '关机' : '开机' }}
        </button>
        <button class="btn btn-sm btn-ghost" @click="closeDetail">关闭</button>
      </div>
    </div>

    <div v-if="detailLoading" class="rcvm-load"><span class="rcvm-spin"></span>读取详情…</div>
    <template v-else-if="detail">
      <div class="rcvm-sec">
        <div class="rcvm-sec-t">基本</div>
        <div class="rcvm-kv">
          <span class="k">状态</span><span class="v">{{ detail.state_label || detail.state || '-' }}</span>
          <span class="k">UUID</span><span class="v">{{ detail.uuid || '-' }}</span>
          <span class="k">CPU</span><span class="v">{{ detail.vcpu }} 核</span>
          <span class="k">内存</span><span class="v">{{ detail.memory_mb }} MB</span>
          <span class="k">架构</span><span class="v">{{ detail.arch || '-' }} / {{ detail.machine || '-' }}</span>
          <span class="k">开机自启</span><span class="v">{{ detail.autostart ? '已启用' : '未启用' }}</span>
        </div>
      </div>

      <div class="rcvm-sec">
        <div class="rcvm-sec-t">磁盘 ({{ (detail.disks || []).length }})</div>
        <div v-for="(dk, i) in detail.disks" :key="i" class="rcvm-item">
          {{ dk.target || '?' }} · {{ dk.bus || '?' }} · {{ dk.device }}
          <span class="tag">{{ dk.format || dk.type }}</span>
          <div style="color:var(--text-faint);font-size:10.5px;margin-top:2px">{{ dk.source || '(无源)' }}</div>
        </div>
        <div v-if="!(detail.disks || []).length" style="color:var(--text-faint);font-size:11.5px">无磁盘</div>
      </div>

      <div class="rcvm-sec">
        <div class="rcvm-sec-t">网络 ({{ (detail.nets || []).length }})</div>
        <div v-for="(nw, i) in detail.nets" :key="i" class="rcvm-item">
          {{ nw.mac || '?' }}
          <span class="tag">{{ nw.model || nw.type }}{{ nw.source ? ' · ' + nw.source : '' }}</span>
        </div>
        <div v-if="!(detail.nets || []).length" style="color:var(--text-faint);font-size:11.5px">无网卡</div>
      </div>

      <div class="rcvm-sec">
        <div class="rcvm-sec-t">显示 / 控制台</div>
        <div v-for="(g, i) in detail.graphics" :key="i" class="rcvm-item">
          {{ g.type }} · 端口 {{ g.port }}{{ g.autoport === 'yes' ? '(自动)' : '' }}
          <span class="tag">{{ g.listen || '监听全部' }}{{ g.passwd ? ' · 有密码' : '' }}</span>
        </div>
        <div v-if="!(detail.graphics || []).length" style="color:var(--text-faint);font-size:11.5px">无图形设备</div>
        <div style="margin-top:8px">
          <button class="btn btn-sm" :disabled="consoleBusy" @click="showConsole(sel.name)">查询 VNC 连接</button>
          <span v-if="consoleInfo" style="font-size:11.5px;color:var(--text-muted);margin-left:8px;font-family:var(--font-mono)">{{ consoleInfo }}</span>
        </div>
      </div>

      <div class="rcvm-sec">
        <div class="rcvm-sec-t">快照 ({{ snaps.length }})</div>
        <div v-for="s in snaps" :key="s.name" class="rcvm-item" style="display:flex;align-items:center;gap:6px">
          <span style="flex:1">{{ s.name }}<span class="tag">{{ s.created }}</span></span>
          <button class="btn btn-sm btn-ghost" :disabled="snapBusy" @click="revertSnap(s.name)">回滚</button>
          <button class="btn btn-sm btn-ghost" :disabled="snapBusy" @click="deleteSnap(s.name)">删除</button>
        </div>
        <div v-if="!snaps.length" style="color:var(--text-faint);font-size:11.5px">还没有快照</div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <input v-model="snapName" placeholder="快照名(留空自动)" style="flex:1;padding:5px 8px;font-size:12px;background:var(--bg-raised);color:var(--text);border:1px solid var(--border)" />
          <button class="btn btn-sm" :disabled="snapBusy" @click="createSnap">创建快照</button>
        </div>
      </div>

      <div class="rcvm-sec">
        <div class="rcvm-sec-t">备注</div>
        <textarea v-model="noteDraft" rows="2" placeholder="给这台虚拟机加个说明…"
          style="width:100%;padding:6px 9px;font-size:12.5px;background:var(--bg-raised);color:var(--text);border:1px solid var(--border);font-family:inherit;resize:vertical"></textarea>
        <div style="margin-top:7px;display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" :disabled="noteBusy" @click="saveNote">保存备注</button>
          <button class="btn btn-sm" :disabled="busy[sel.name]" @click="toggleAutostart">
            {{ detail.autostart ? '取消开机自启' : '设为开机自启' }}
          </button>
          <span style="flex:1"></span>
          <button class="btn btn-sm btn-danger" :disabled="busy[sel.name]" @click="removeVm">删除虚拟机</button>
        </div>
      </div>
    </template>
  </div>

  <!-- 创建向导 -->
  <div v-if="showCreate" class="rcvm-modal-bg" @click.self="showCreate = false">
    <div class="rcvm-modal">
      <div class="rcvm-modal-hd">
        <span class="t">新建虚拟机</span>
        <button class="btn btn-sm btn-ghost" @click="showCreate = false">取消</button>
      </div>
      <div class="rcvm-modal-bd">
        <div class="rcvm-field">
          <label>名称</label>
          <input v-model="form.name" placeholder="例如 web-01（字母/数字/点/下划线/短横线）" />
          <div class="hint">创建后即为 libvirt 域名，不可重名</div>
        </div>
        <div class="rcvm-field">
          <label>基础镜像</label>
          <select v-model="form.image">
            <option value="">— 选择镜像 —</option>
            <option v-for="im in images" :key="im.path" :value="im.path">
              {{ im.name }} · {{ im.size_h }}{{ im.virtual_size_h ? ' / 虚拟 ' + im.virtual_size_h : '' }}
            </option>
          </select>
          <div class="hint">用 qcow2 覆盖层创建，基础镜像不会被修改，可多台共享</div>
        </div>
        <div class="rcvm-row">
          <div class="rcvm-field">
            <label>CPU 核数</label>
            <input v-model.number="form.vcpu" type="number" min="1" max="64" />
          </div>
          <div class="rcvm-field">
            <label>内存 (MB)</label>
            <input v-model.number="form.memory" type="number" min="128" step="256" />
          </div>
        </div>
        <div class="rcvm-row">
          <div class="rcvm-field">
            <label>磁盘容量 (GB)</label>
            <input v-model.number="form.disk_gb" type="number" min="1" />
          </div>
          <div class="rcvm-field">
            <label>网络</label>
            <input v-model="form.network" placeholder="default" />
          </div>
        </div>
        <div class="rcvm-field">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer">
            <input type="checkbox" v-model="form.start" style="width:auto" />
            创建后立即启动
          </label>
        </div>
        <div v-if="createErr" class="rcvm-msg err">{{ createErr }}</div>
      </div>
      <div class="rcvm-modal-ft">
        <button class="btn btn-sm" @click="showCreate = false">取消</button>
        <button class="btn btn-sm btn-primary" :disabled="creating" @click="doCreate">
          {{ creating ? '创建中…' : '创建' }}
        </button>
      </div>
    </div>
  </div>
</div>
`,
    data() {
      return {
        info: null, doms: [], stats: {}, loading: false, err: '', okMsg: '',
        busy: {}, sel: null, detail: null, detailLoading: false,
        consoleInfo: '', consoleBusy: false,
        snaps: [], snapName: '', snapBusy: false,
        noteDraft: '', noteBusy: false,
        showCreate: false, images: [], creating: false, createErr: '',
        form: { name: '', image: '', vcpu: 2, memory: 2048, disk_gb: 20, network: 'default', start: true },
        timer: null, statTimer: null, alive: true, okTimer: null,
      }
    },
    computed: {
      canManage() { return !!(this.info && this.info.can_manage) },
    },
    mounted() {
      if (!document.getElementById(STYLE_ID)) {
        const st = document.createElement('style')
        st.id = STYLE_ID
        st.textContent = CSS
        document.head.appendChild(st)
      }
      this.reload()
      // 运行中的虚拟机每 3 秒拉一次实时统计; 列表本身 10 秒刷一次状态
      this.statTimer = setInterval(() => { if (this.alive) this.pollStats() }, 3000)
      this.timer = setInterval(() => { if (this.alive) this.reload(true) }, 10000)
    },
    unmounted() {
      this.alive = false
      clearInterval(this.timer)
      clearInterval(this.statTimer)
      if (this.okTimer) clearTimeout(this.okTimer)
    },
    methods: {
      fmtRate(kbps) {
        const v = Number(kbps) || 0
        if (v < 1000) return v.toFixed(1) + ' Kbps'
        return (v / 1000).toFixed(2) + ' Mbps'
      },
      flash(msg) {
        this.okMsg = msg
        if (this.okTimer) clearTimeout(this.okTimer)
        this.okTimer = setTimeout(() => (this.okMsg = ''), 2600)
      },
      fail(e) {
        this.err = (e && e.message) || String(e)
        setTimeout(() => (this.err = ''), 6000)
      },
      async reload(silent) {
        if (!silent) this.loading = true
        try {
          if (!this.info) this.info = await ctx.invoke('vm.info', {})
          const r = await ctx.invoke('vm.list', {})
          this.doms = (r && r.domains) || []
          if (this.sel) {
            const fresh = this.doms.find((d) => d.name === this.sel.name)
            if (fresh) this.sel = fresh
            else this.closeDetail()
          }
          if (!silent) this.pollStats()
        } catch (e) {
          if (!silent) this.fail(e)
        } finally {
          if (!silent) this.loading = false
        }
      },
      async pollStats() {
        const running = this.doms.filter((d) => d.state === 'running')
        if (!running.length) { this.stats = {}; return }
        const next = {}
        await Promise.all(running.map(async (d) => {
          try {
            next[d.name] = await ctx.invoke('vm.stats', { name: d.name })
          } catch (e) { /* 单台失败不影响其它 */ }
        }))
        if (this.alive) this.stats = next
      },
      async act(d, action) {
        const label = { start: '开机', shutdown: '关机', reboot: '重启', destroy: '强制断电', suspend: '挂起', resume: '恢复' }[action] || action
        if (action === 'destroy' && !confirm('强制断电相当于拔电源，' + d.name + ' 里未保存的数据会丢失。继续？')) return
        this.busy = Object.assign({}, this.busy, { [d.name]: true })
        try {
          const r = await ctx.invoke('vm.action', { name: d.name, action })
          this.flash(d.name + ' ' + label + (r && r.noop ? '（已是该状态）' : ' 已执行'))
          await this.reload(true)
          if (this.sel && this.sel.name === d.name) await this.openDetail(this.sel)
        } catch (e) {
          this.fail(e)
        } finally {
          const b = Object.assign({}, this.busy)
          delete b[d.name]
          this.busy = b
        }
      },
      async openDetail(d) {
        this.sel = d
        this.detailLoading = true
        this.consoleInfo = ''
        this.snapName = ''
        try {
          this.detail = await ctx.invoke('vm.detail', { name: d.name })
          this.noteDraft = (this.detail && this.detail.note) || ''
          await this.loadSnaps(d.name)
        } catch (e) {
          this.fail(e)
        } finally {
          this.detailLoading = false
        }
      },
      closeDetail() {
        this.sel = null
        this.detail = null
        this.snaps = []
        this.consoleInfo = ''
      },
      async loadSnaps(name) {
        try {
          const r = await ctx.invoke('vm.snapshot.list', { name })
          this.snaps = (r && r.snapshots) || []
        } catch (e) { this.snaps = [] }
      },
      async createSnap() {
        if (!this.sel) return
        this.snapBusy = true
        try {
          await ctx.invoke('vm.snapshot.create', { name: this.sel.name, snapshot: this.snapName })
          this.snapName = ''
          this.flash('快照已创建')
          await this.loadSnaps(this.sel.name)
        } catch (e) { this.fail(e) } finally { this.snapBusy = false }
      },
      async revertSnap(sn) {
        if (!confirm('回滚到「' + sn + '」会丢弃此后对磁盘的所有修改。继续？')) return
        this.snapBusy = true
        try {
          await ctx.invoke('vm.snapshot.revert', { name: this.sel.name, snapshot: sn })
          this.flash('已回滚到 ' + sn)
          await this.reload(true)
        } catch (e) { this.fail(e) } finally { this.snapBusy = false }
      },
      async deleteSnap(sn) {
        if (!confirm('删除快照「' + sn + '」？')) return
        this.snapBusy = true
        try {
          await ctx.invoke('vm.snapshot.delete', { name: this.sel.name, snapshot: sn })
          this.flash('快照已删除')
          await this.loadSnaps(this.sel.name)
        } catch (e) { this.fail(e) } finally { this.snapBusy = false }
      },
      async showConsole(name) {
        this.consoleBusy = true
        try {
          const r = await ctx.invoke('vm.console', { name })
          if (r.hint) {
            this.consoleInfo = r.hint
          } else {
            this.consoleInfo = 'VNC ' + (r.vnc || '') +
              (r.port ? '（' + location.hostname + ':' + r.port + '）' : '')
          }
        } catch (e) { this.fail(e) } finally { this.consoleBusy = false }
      },
      async saveNote() {
        if (!this.sel) return
        this.noteBusy = true
        try {
          await ctx.invoke('vm.note.save', { name: this.sel.name, note: this.noteDraft })
          this.flash('备注已保存')
          await this.reload(true)
        } catch (e) { this.fail(e) } finally { this.noteBusy = false }
      },
      async toggleAutostart() {
        if (!this.sel || !this.detail) return
        const on = !this.detail.autostart
        this.busy = Object.assign({}, this.busy, { [this.sel.name]: true })
        try {
          await ctx.invoke('vm.autostart', { name: this.sel.name, on })
          this.detail.autostart = on
          this.flash('开机自启已' + (on ? '启用' : '关闭'))
          await this.reload(true)
        } catch (e) { this.fail(e) } finally {
          const b = Object.assign({}, this.busy)
          delete b[this.sel.name]
          this.busy = b
        }
      },
      async removeVm() {
        if (!this.sel) return
        const name = this.sel.name
        if (!confirm('删除虚拟机「' + name + '」？\n\n默认保留磁盘文件，可之后手动清理。')) return
        const withDisk = confirm('是否同时删除磁盘文件？\n\n确定 = 连磁盘一起删（不可恢复）\n取消 = 只删虚拟机定义，保留磁盘')
        this.busy = Object.assign({}, this.busy, { [name]: true })
        try {
          await ctx.invoke('vm.delete', { name, with_disk: withDisk })
          this.flash(name + ' 已删除' + (withDisk ? '（含磁盘）' : '（磁盘保留）'))
          this.closeDetail()
          await this.reload(true)
        } catch (e) { this.fail(e) } finally {
          const b = Object.assign({}, this.busy)
          delete b[name]
          this.busy = b
        }
      },
      async openCreate() {
        this.showCreate = true
        this.createErr = ''
        this.form = { name: '', image: '', vcpu: 2, memory: 2048, disk_gb: 20, network: 'default', start: true }
        try {
          const r = await ctx.invoke('vm.images.list', {})
          this.images = (r && r.images) || []
        } catch (e) { this.createErr = (e && e.message) || String(e) }
      },
      async doCreate() {
        this.createErr = ''
        if (!this.form.name.trim()) { this.createErr = '请填写名称'; return }
        if (!this.form.image) { this.createErr = '请选择基础镜像'; return }
        this.creating = true
        try {
          const r = await ctx.invoke('vm.create', this.form, { timeoutMs: 200000 })
          this.flash('已创建 ' + r.name)
          this.showCreate = false
          await this.reload(true)
        } catch (e) {
          this.createErr = (e && e.message) || String(e)
        } finally {
          this.creating = false
        }
      },
    },
  }
  const app = createApp(App)
  const stop = () => { try { app.unmount() } catch (e) {} }
  app.mount(container)
  return stop
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '虚拟机' }], mount }
}
if (typeof window !== 'undefined') register(window)
