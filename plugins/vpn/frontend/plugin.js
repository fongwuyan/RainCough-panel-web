// vpn 插件 Vue3 前端(独立构建, esbuild IIFE)
// 契约: window.__rcPlugin_vpn = { mount(container, ctx) }
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_vpn = {
    name: 'vpn',
    mount: function (container, ctx) {
      
      const App = {
        data() {
          return { subs: [], nodes: [], status: { active: '', connected: false }, newName: '', newUrl: '', err: '' }
        },
        methods: {
          async loadAll() {
            for (const [ep, key] of [['/v2/subs', 'subs'], ['/v2/nodes', 'nodes'], ['/v2/status', 'status']]) {
              try {
                const r = await fetch('/api/plugins/vpn' + ep)
                const d = await r.json()
                if (key === 'subs') this.subs = d.subs || []
                else if (key === 'nodes') this.nodes = d.nodes || []
                else this.status = d
              } catch (e) { console.error(e) }
            }
          },
          async addSub() {
            if (!this.newName || !this.newUrl) return
            try {
              await fetch('/api/plugins/vpn/v2/subs', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.newName, url: this.newUrl })
              })
              this.newName = ''; this.newUrl = ''; this.loadAll()
            } catch (e) { this.err = e.message }
          },
          async refreshSub(name) {
            try {
              await fetch('/api/plugins/vpn/v2/subs/refresh', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
              })
              this.loadAll()
            } catch (e) { this.err = e.message }
          },
          async delSub(name) {
            try {
              await fetch('/api/plugins/vpn/v2/subs/' + name, { method: 'DELETE' })
              this.loadAll()
            } catch (e) { this.err = e.message }
          },
          async connect(name) {
            try {
              await fetch('/api/plugins/vpn/v2/connect', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
              })
              this.loadAll()
            } catch (e) { this.err = e.message }
          },
          async stopAll() {
            try {
              await fetch('/api/plugins/vpn/stop-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
              this.loadAll()
            } catch (e) { this.err = e.message }
          },
          async testNode(uri) {
            try {
              await fetch('/api/plugins/vpn/v2/nodes/test', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uri })
              })
            } catch (e) {}
          }
        },
        mounted() { this.loadAll() },
        render() {
          const self = this
          const nodeRows = this.nodes.map((n) => h('tr', { key: n.uri }, [
            h('td', { class: 'mono', style: 'word-break:break-all;' }, n.name),
            h('td', null, h('button', { class: 'btn btn-sm', onclick: () => this.connect(n.name) }, '连接')),
            h('td', null, h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.testNode(n.uri) }, '测速')),
          ]))
          const subRows = this.subs.map((s) => h('tr', { key: s.name }, [
            h('td', { class: 'mono' }, s.name),
            h('td', { class: 'mono faint', style: 'word-break:break-all;' }, s.url),
            h('td', { class: 'mono' }, s.nodes || 0),
            h('td', null, h('button', { class: 'btn btn-sm', onclick: () => this.refreshSub(s.name) }, '刷新')),
            h('td', null, h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.delSub(s.name) }, '删除')),
          ]))
          return h('div', { class: 'vpn-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, [
                'VPN 网络 · ',
                this.status.connected
                  ? h('b', { style: 'color:var(--success);' }, '已连接: ' + this.status.active)
                  : h('b', { style: 'color:var(--text-faint);' }, '未连接'),
                ' · ' + this.subs.length + ' 订阅 / ' + this.nodes.length + ' 节点',
                h('button', { class: 'btn btn-sm btn-danger', style: 'float:right;', onclick: () => this.stopAll() }, '断开全部')
              ]),
            ]),
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '订阅管理'),
              h('div', { class: 'flex', style: 'gap:8px;margin-bottom:8px;' }, [
                h('input', { placeholder: '订阅名', value: this.newName, oninput: (e) => (this.newName = e.target.value), class: 'input', style: 'width:140px;' }),
                h('input', { placeholder: '订阅 URL (v2ray/wireguard)', value: this.newUrl, oninput: (e) => (this.newUrl = e.target.value), class: 'input', style: 'flex:1;' }),
                h('button', { class: 'btn btn-primary', onclick: () => this.addSub() }, '添加'),
              ]),
              h('table', { class: 'table' }, [
                h('thead', null, h('tr', null, [h('th', null, '名称'), h('th', null, 'URL'), h('th', null, '节点'), h('th', null, ''), h('th', null, '')])),
                h('tbody', null, subRows),
              ]),
            ]),
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '节点列表'),
              h('table', { class: 'table' }, [
                h('thead', null, h('tr', null, [h('th', null, '节点'), h('th', null, ''), h('th', null, '')])),
                h('tbody', null, nodeRows),
              ]),
            ]),
            this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
          ])
        }
      }
      const vm = createApp(App)
      vm.mount(container)
      return () => vm.unmount()
    }
  }
}

if (typeof window !== 'undefined') {
  register(window)
}