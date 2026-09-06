// vpn 插件前端(接口库 v4): 概览 / 订阅 / 节点 / 连接 / WireGuard / OpenVPN
import { createApp, h } from 'vue'

const NAME = 'vpn'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'ov', ov: null, status: null, env: null, subs: [], nodes: [], subUrl: '', subName: '', q: '', wgText: '', wgName: '', ovpnText: '', ovpnName: '', err: '', timer: null } },
    methods: {
      async load() {
        try {
          const [ov, st, env] = await Promise.all([ctx.invoke('vpn.overview').catch(() => null), ctx.invoke('vpn.v2.status').catch(() => null), ctx.invoke('vpn.env').catch(() => null)])
          this.ov = ov; this.status = st; this.env = env
        } catch (e) { this.err = (e && e.message) || e }
      },
      async tabLoad(k) {
        this.err = ''
        try {
          if (k === 'subs') this.subs = ((await ctx.invoke('vpn.v2.subs.list')).subs) || []
          if (k === 'nodes') this.nodes = ((await ctx.invoke('vpn.v2.nodes.list', { q: this.q })).nodes) || []
          if (k === 'wg') {}
          if (k === 'ovpn') {}
        } catch (e) { this.err = (e && e.message) || e }
      },
      async addSub() {
        if (!this.subUrl) { this.err = '订阅地址必填'; return }
        try { await ctx.invoke('vpn.v2.subs.save', { url: this.subUrl, name: this.subName }); this.subUrl = ''; this.tabLoad('subs') }
        catch (e) { this.err = (e && e.message) || e }
      },
      async delSub(name) { try { await ctx.invoke('vpn.v2.subs.delete', { name }); this.tabLoad('subs') } catch (e) { this.err = (e && e.message) || e } },
      async refreshSubs() { try { await ctx.invoke('vpn.v2.subs.refresh'); this.tabLoad('nodes') } catch (e) { this.err = (e && e.message) || e } },
      async delNode(id) { try { await ctx.invoke('vpn.v2.nodes.delete', { id }); this.tabLoad('nodes') } catch (e) { this.err = (e && e.message) || e } },
      async testNode(id) { try { const r = await ctx.invoke('vpn.v2.nodes.test', { ids: [id] }); alert(JSON.stringify(r)) } catch (e) { this.err = (e && e.message) || e } },
      async connect(id) { try { await ctx.invoke('vpn.v2.connect', { id }); this.load(); this.tab = 'ov' } catch (e) { this.err = (e && e.message) || e } },
      async disconnect() { try { await ctx.invoke('vpn.v2.connect', { action: 'disconnect' }); this.load() } catch (e) { this.err = (e && e.message) || e } },
      async stopAll() { try { await ctx.invoke('vpn.stop.all'); this.load() } catch (e) { this.err = (e && e.message) || e } },
      async wgAct(kind, act) {
        const name = kind === 'wg' ? this.wgName : this.ovpnName
        if (kind === 'import' ? (!this.wgText.trim() && !this.ovpnText.trim()) : !name) { this.err = '缺名称/配置'; return }
        try {
          if (kind === 'import') { await ctx.invoke('vpn.wg.import', { name: this.wgName, text: this.wgText }); this.wgText = '' }
          else if (kind === 'wg') await ctx.invoke('vpn.wg.' + act, { name })
          else if (kind === 'ovpnimport') { await ctx.invoke('vpn.ovpn.import', { name: this.ovpnName, text: this.ovpnText }); this.ovpnText = '' }
          else await ctx.invoke('vpn.ovpn.' + act, { name })
        } catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() { this.load(); this.timer = setInterval(() => this.load(), 8000) },
    unmounted() { clearInterval(this.timer) },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => { this.tab = k; this.tabLoad(k) } }, l)
      const ch = (this.ov || {}).channels || {}
      const row = (c, label) => h('div', { style: 'margin-bottom:4px;font-size:13px;' }, [h('label', null, label), ' ',
        h('b', { style: { color: c && c.running ? '#2e9e5b' : '#d9524e' } }, c && c.running ? '运行中' : '未运行'),
        c && c.running && c.name ? h('span', { class: 'faint' }, ' · ' + c.name) : null])
      return h('div', null, [
        h('div', { class: 'section-title' }, 'VPN 网络'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' },
          [['ov', '总览'], ['subs', '订阅'], ['nodes', '节点'], ['wg', 'WireGuard'], ['ovpn', 'OpenVPN']].map((x) => t(x[0], x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'ov' ? h('div', { class: 'section' }, [
          h('div', { style: 'margin-bottom:6px;font-size:13px;' }, ['直连 IP ', h('b', null, (this.ov || {}).direct_ip || '-'), ' · 代理 IP ', h('b', null, (this.status && this.status.proxy_ip) || '-')]),
          row(ch.proxy, '代理'), row(ch.wireguard, 'WireGuard'), row(ch.openvpn, 'OpenVPN'),
          h('div', { class: 'flex', style: 'gap:6px;margin-top:8px;' }, [
            this.status && this.status.connected ? h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.disconnect() }, '断开代理') : null,
            h('button', { class: 'btn btn-sm', onclick: () => this.load() }, '刷新'),
            h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.stopAll() }, '停止全部通道'),
          ]),
        ]) : null,
        this.tab === 'subs' ? h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '订阅 URL', value: this.subUrl, oninput: (e) => (this.subUrl = e.target.value) }),
            h('input', { class: 'input', style: 'width:120px;', placeholder: '名称', value: this.subName, oninput: (e) => (this.subName = e.target.value) }),
            h('button', { class: 'btn', onclick: () => this.addSub() }, '添加'),
            h('button', { class: 'btn btn-sm', onclick: () => this.refreshSubs() }, '全部拉取'),
          ]),
          this.subs.map((s) => h('div', { key: s.url, class: 'flex', style: 'justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);' }, [
            h('div', null, [h('b', null, s.name), h('div', { class: 'faint', style: 'font-size:11px;' }, s.url + ' · 节点 ' + (s.nodes || 0) + (s.error ? ' · ' + s.error : ''))]),
            h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.delSub(s.name) }, '删除'),
          ])),
        ]) : null,
        this.tab === 'nodes' ? h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '过滤名称/地址/协议', value: this.q, oninput: (e) => (this.q = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.tabLoad('nodes') } }),
            h('button', { class: 'btn btn-sm', onclick: () => this.tabLoad('nodes') }, '搜索'),
          ]),
          this.nodes.map((n) => h('div', { key: n._id, class: 'flex', style: 'justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);' }, [
            h('div', null, [h('b', null, n.name || n._id.slice(0, 8)), h('span', { class: 'faint' }, ' · ' + (n.protocol || '') + ' · ' + (n.addr || '') + (n.latency != null ? ' · ' + n.latency + 'ms' : ''))]),
            h('div', { class: 'flex', style: 'gap:4px;' }, [
              h('button', { class: 'btn btn-sm', onclick: () => this.testNode(n._id) }, '测速'),
              h('button', { class: 'btn btn-sm btn-primary', onclick: () => this.connect(n._id) }, '连接'),
              h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.delNode(n._id) }, '删'),
            ]),
          ])),
        ]) : null,
        this.tab === 'wg' || this.tab === 'ovpn' ? h('div', { class: 'section' }, [
          this.tab === 'wg'
            ? [h('input', { class: 'input', style: 'width:160px;margin-bottom:6px;', placeholder: '接口名', value: this.wgName, oninput: (e) => (this.wgName = e.target.value) }),
               h('textarea', { class: 'input', style: 'width:100%;min-height:90px;margin-bottom:6px;', placeholder: 'wg 配置内容', value: this.wgText, oninput: (e) => (this.wgText = e.target.value) }),
               h('div', { class: 'flex', style: 'gap:6px;' }, [h('button', { class: 'btn btn-sm', onclick: () => this.wgAct('import', null) }, '导入'), h('button', { class: 'btn btn-sm', onclick: () => this.wgAct('wg', 'up') }, '启用'), h('button', { class: 'btn btn-sm', onclick: () => this.wgAct('wg', 'down') }, '停用')])]
            : [h('input', { class: 'input', style: 'width:160px;margin-bottom:6px;', placeholder: '配置名', value: this.ovpnName, oninput: (e) => (this.ovpnName = e.target.value) }),
               h('textarea', { class: 'input', style: 'width:100%;min-height:90px;margin-bottom:6px;', placeholder: 'ovpn 配置内容', value: this.ovpnText, oninput: (e) => (this.ovpnText = e.target.value) }),
               h('div', { class: 'flex', style: 'gap:6px;' }, [h('button', { class: 'btn btn-sm', onclick: () => this.wgAct('ovpnimport', null) }, '导入'), h('button', { class: 'btn btn-sm', onclick: () => this.wgAct('ovpn', 'up') }, '启动'), h('button', { class: 'btn btn-sm', onclick: () => this.wgAct('ovpn', 'down') }, '停止')])],
        ]) : null,
      ])
    },
  }
  const vm = createApp(App)
  const stop = () => { if (App.unmounted) App.unmounted(); vm.unmount() }
  vm.mount(container)
  return stop
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'VPN 网络' }], mount }
}
if (typeof window !== 'undefined') register(window)