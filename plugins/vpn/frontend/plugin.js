// vpn 插件前端(接口库 v4): Vue3 展示层, ctx.invoke。
import { createApp, h } from 'vue'

const NAME = 'vpn'

function mount(container, ctx) {
  const App = {
    data() { return { ov: null, status: null, env: null, err: '', loading: true, timer: null } },
    methods: {
      async load() {
        this.loading = true
        try {
          const [ov, st, env] = await Promise.all([
            ctx.invoke('vpn.overview').catch(() => null),
            ctx.invoke('vpn.v2.status').catch(() => null),
            ctx.invoke('vpn.env').catch(() => null),
          ])
          this.ov = ov; this.status = st; this.env = env
        } catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async disconnect() {
        try { await ctx.invoke('vpn.v2.connect', { action: 'disconnect' }); this.load() }
        catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() { this.load(); this.timer = setInterval(() => this.load(), 8000) },
    unmounted() { clearInterval(this.timer) },
    render() {
      const ov = this.ov || {}
      const ch = ov.channels || {}
      const row = (c, label) => h('div', { style: 'margin-bottom:6px;font-size:13px;' }, [
        h('label', null, label), ' ',
        h('b', { style: { color: (c && c.running) ? '#2e9e5b' : '#d9524e' } }, (c && c.running) ? '运行中' : '未运行'),
        c && c.running && c.name ? h('span', { class: 'faint' }, ' · ' + c.name) : null,
      ])
      return h('div', { class: 'vpn-panel' }, [
        h('div', { class: 'section' }, [
          h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;' }, [
            h('span', null, 'VPN 通道总览'),
            h('button', { class: 'btn btn-sm', onclick: () => this.load() }, '刷新'),
          ]),
          this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
          h('div', { style: 'margin-bottom:8px;font-size:13px;' }, [
            h('span', { class: 'faint' }, '本机直连 IP: '), h('b', null, ov.direct_ip || '-'),
            h('span', { class: 'faint', style: 'margin-left:16px;' }, '代理 IP: '), h('b', null, (this.status && this.status.proxy_ip) || '-'),
          ]),
          row(ch.proxy, 'v2ray/sing-box 代理'),
          row(ch.wireguard, 'WireGuard'),
          row(ch.openvpn, 'OpenVPN'),
          this.status && this.status.connected ? h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.disconnect() }, '断开代理') : null,
        ]),
        h('div', { class: 'section' }, [
          h('div', { class: 'section-title' }, '工具链'),
          h('code', { style: 'font-size:12px;' }, JSON.stringify(this.env ? {
            v2ray: !!this.env.v2ray, sing_box: !!this.env.sing_box,
            wireguard: !!this.env.wireguard, openvpn: !!this.env.openvpn,
          } : {}))
        ]),
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

if (typeof window !== 'undefined') {
  register(window)
}