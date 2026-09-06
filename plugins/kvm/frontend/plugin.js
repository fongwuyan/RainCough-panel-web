// kvm 插件前端(接口库 v4): Vue3 展示层, ctx.invoke。
import { createApp, h } from 'vue'

const NAME = 'kvm'

function mount(container, ctx) {
  const App = {
    data() {
      return { domains: [], info: null, loading: false, err: '' }
    },
    methods: {
      async load() {
        this.loading = true
        this.err = ''
        try {
          const [d, i] = await Promise.all([
            ctx.invoke('kvm.domains.list').catch((e) => { this.err = (e && e.message) || e; return { domains: [] } }),
            ctx.invoke('kvm.info').catch(() => null),
          ])
          this.domains = (d && d.domains) || []
          this.info = i
        } catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async act(name, action) {
        try {
          const r = await ctx.invoke('kvm.domain.action', { name, action })
          if (r && r.ok === false) this.err = r.error || ''
          this.load()
        } catch (e) { this.err = (e && e.message) || e }
      },
      async vnc(name) {
        try {
          const r = await ctx.invoke('kvm.domain.vnc', { name, enable: true })
          if (!r || !r.ok) { this.err = (r && (r.error || r.message)) || 'VNC 不可用'; return }
          if (r.need_reboot) { alert(r.message || '需重启虚拟机生效'); return }
          const host = location.hostname || 'localhost'
          window.open('ws://' + host + ':' + r.ws_port + '/websockify?token=' + r.token, '_blank')
        } catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() { this.load() },
    render() {
      const rows = (this.domains || []).map((d) => h('tr', { key: d.name }, [
        h('td', { class: 'mono' }, d.name + (d.note ? ' · ' + d.note : '')),
        h('td', null, d.state_cn || d.state),
        h('td', null, h('div', { style: 'display:flex;gap:4px;' }, [
          d.state === 'running' ? [
            h('button', { class: 'btn btn-sm', onclick: () => this.act(d.name, 'shutdown') }, '关机'),
            h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.act(d.name, 'reboot') }, '重启'),
          ] : h('button', { class: 'btn btn-sm', onclick: () => this.act(d.name, 'start') }, '启动'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.vnc(d.name) }, 'VNC'),
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.act(d.name, 'destroy') }, '强制关闭'),
        ])),
      ]))
      return h('div', { class: 'kvm-panel' }, [
        h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;align-items:center;' }, [
          h('span', null, 'KVM 虚拟机' + (this.info ? ' · ' + (this.info.libvirt || '') + ' · ' + this.info.domains_running + '/' + this.info.domains_total : '')),
          h('button', { class: 'btn btn-sm', onclick: () => this.load() }, '刷新'),
        ]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.loading ? h('p', { class: 'hint' }, '加载中...') : h('table', { class: 'table' }, [
          h('thead', null, h('tr', null, [h('th', null, '名称'), h('th', null, '状态'), h('th', null, '操作')])),
          h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 3, class: 'empty' }, '无虚拟机'))),
        ]),
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '虚拟机' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}