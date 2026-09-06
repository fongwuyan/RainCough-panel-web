// kvm 插件前端(接口库 v4): 虚拟机列表/启停/VNC/创建/配置/存储
import { createApp, h } from 'vue'

const NAME = 'kvm'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'list', domains: [], info: null, detail: null, images: [], storage: null, cfg: {}, create: { name: '', vcpu: 2, memory_mb: 2048, disk: 8, iso: '', seed_user: '', seed_pw: '' }, err: '' } },
    methods: {
      async load() {
        try {
          const [d, i] = await Promise.all([ctx.invoke('kvm.domains.list').catch(() => ({ domains: [] })), ctx.invoke('kvm.info').catch(() => null)])
          this.domains = (d && d.domains) || []; this.info = i
        } catch (e) { this.err = (e && e.message) || e }
      },
      async act(name, action) { try { const r = await ctx.invoke('kvm.domain.action', { name, action }); if (r.ok === false) this.err = r.error || ''; this.load() } catch (e) { this.err = (e && e.message) || e } },
      async vnc(name) {
        try {
          const r = await ctx.invoke('kvm.domain.vnc', { name, enable: true })
          if (!r || !r.ok) { this.err = (r && (r.error || r.message)) || 'VNC 不可用'; return }
          if (r.need_reboot) { alert(r.message); return }
          window.open('ws://' + (location.hostname || 'localhost') + ':' + r.ws_port + '/websockify?token=' + r.token, '_blank')
        } catch (e) { this.err = (e && e.message) || e }
      },
      async detail(name) { try { this.detail = await ctx.invoke('kvm.domain.detail', { name }); this.tab = 'detail' } catch (e) { this.err = (e && e.message) || e } },
      async tabLoad(k) {
        this.err = ''
        try {
          if (k === 'img') this.images = ((await ctx.invoke('kvm.images.list')).images) || []
          if (k === 'storage') this.storage = await ctx.invoke('kvm.storage.list')
          if (k === 'cfg') this.cfg = await ctx.invoke('kvm.config.get')
        } catch (e) { this.err = (e && e.message) || e }
      },
      async saveCfg() { try { await ctx.invoke('kvm.config.save', { sudo_pw: this.cfg.sudo_pw || '' }); this.tabLoad('cfg') } catch (e) { this.err = (e && e.message) || e } },
      async createVm() {
        if (!this.create.name) { this.err = '名称必填'; return }
        this.err = ''
        try { await ctx.invoke('kvm.domains.create', this.create); this.load() }
        catch (e) { this.err = (e && e.message) || e }
      },
      async note(name) {
        const note = prompt('备注:', '')
        if (note === null) return
        try { await ctx.invoke('kvm.domain.note.save', { name, note }); this.load() }
        catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() { this.load(); this.tabLoad('img') },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => { this.tab = k; this.tabLoad(k) } }, l)
      const rows = this.domains.map((d) => h('tr', { key: d.name }, [
        h('td', null, d.name + (d.note ? ' · ' + d.note : '')), h('td', null, d.state_cn || d.state),
        h('td', null, h('div', { class: 'flex', style: 'gap:4px;' }, [
          d.state === 'running'
            ? [h('button', { class: 'btn btn-sm', onclick: () => this.act(d.name, 'shutdown') }, '关机'), h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.act(d.name, 'reboot') }, '重启')]
            : h('button', { class: 'btn btn-sm', onclick: () => this.act(d.name, 'start') }, '启动'),
          h('button', { class: 'btn btn-sm', onclick: () => this.vnc(d.name) }, 'VNC'),
          h('button', { class: 'btn btn-sm', onclick: () => this.detail(d.name) }, '详情'),
          h('button', { class: 'btn btn-sm', onclick: () => this.note(d.name) }, '备注'),
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.act(d.name, 'destroy') }, '强制关'),
        ])),
      ]))
      return h('div', null, [
        h('div', { class: 'section-title' }, 'KVM 虚拟机' + (this.info ? ' · ' + (this.info.libvirt || '') + ' · ' + this.info.domains_running + '/' + this.info.domains_total : '')),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' },
          [['list', '虚拟机'], ['create', '创建'], ['img', '镜像'], ['storage', '存储'], ['cfg', '配置']].map((x) => t(x[0], x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'list' ? h('table', { class: 'table' }, [h('thead', null, h('tr', null, ['名称', '状态', '操作'].map((x) => h('th', null, x)))), h('tbody', null, rows)]) : null,
        this.tab === 'detail' && this.detail ? h('div', { class: 'section' }, [
          h('h4', null, this.detail.name), h('p', { class: 'faint', style: 'font-size:12px;' }, 'CPU ' + this.detail.vcpu + ' · 内存 ' + this.detail.memory_mb + 'MB · 自启 ' + this.detail.autostart),
          h('div', { style: 'font-size:12px;' }, '磁盘: ' + (this.detail.disks || []).map((x) => x.dev + ':' + x.src).join(' | ')),
        ]) : null,
        this.tab === 'create' ? h('div', { class: 'section' }, [
          h('input', { class: 'input', style: 'width:100%;margin-bottom:6px;', placeholder: '名称*', value: this.create.name, oninput: (e) => (this.create.name = e.target.value) }),
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:6px;' }, [
            h('input', { class: 'input', style: 'width:80px;', type: 'number', placeholder: 'vCPU', value: this.create.vcpu, oninput: (e) => (this.create.vcpu = e.target.value) }),
            h('input', { class: 'input', style: 'width:100px;', type: 'number', placeholder: '内存MB', value: this.create.memory_mb, oninput: (e) => (this.create.memory_mb = e.target.value) }),
            h('input', { class: 'input', style: 'width:80px;', placeholder: '安装ISO', value: this.create.iso, oninput: (e) => (this.create.iso = e.target.value) }),
          ]),
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:6px;' }, [
            h('input', { class: 'input', placeholder: 'cloud-init 用户', value: this.create.seed_user, oninput: (e) => (this.create.seed_user = e.target.value) }),
            h('input', { class: 'input', type: 'password', placeholder: 'cloud-init 密码', value: this.create.seed_pw, oninput: (e) => (this.create.seed_pw = e.target.value) }),
          ]),
          h('button', { class: 'btn btn-primary', onclick: () => this.createVm() }, '创建并启动'),
        ]) : null,
        this.tab === 'img' ? h('div', null, this.images.map((i) => h('div', { key: i.name, style: 'padding:4px 0;border-bottom:1px solid var(--border);font-size:13px;' }, i.name + ' · ' + i.size + ' B'))) : null,
        this.tab === 'storage' && this.storage ? h('div', null, this.storage.pools.map((p) => h('div', { key: p.name, style: 'padding:4px 0;' }, [
          h('b', null, p.name), h('span', { class: 'faint' }, ' · ' + p.state),
          h('div', { class: 'faint', style: 'font-size:12px;' }, (this.storage.volumes[p.name] || []).map((v) => v.name).join(', ')),
        ]))) : null,
        this.tab === 'cfg' ? h('div', { class: 'section' }, [
          h('div', { style: 'margin:6px 0;' }, ['sudo 密码 ', h('input', { class: 'input', style: 'width:160px;', type: 'password', value: this.cfg.sudo_pw || '', oninput: (e) => (this.cfg.sudo_pw = e.target.value) })]),
          h('button', { class: 'btn', onclick: () => this.saveCfg() }, '保存'),
        ]) : null,
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '虚拟机' }], mount }
}
if (typeof window !== 'undefined') register(window)