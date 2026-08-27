// uptime 插件 Vue3 前端组件(独立构建, 完全自包含)
// Vue 打包进产物(构建工具内联 vue), 不依赖主系统注入
// 导出约定: window.__rcPlugin_uptime = { mount(container, ctx) }
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_uptime = {
    name: 'uptime',
    mount: function (container, ctx) {
      const App = {
        data() {
          return { targets: [], loading: true, newUrl: '', newName: '' }
        },
        methods: {
          async load() {
            this.loading = true
            try {
              const r = await fetch('/api/plugins/uptime/targets')
              const d = await r.json()
              this.targets = Object.values(d.targets || {})
            } catch (e) { console.error(e) }
            this.loading = false
          },
          async add() {
            if (!this.newUrl) return
            await fetch('/api/plugins/uptime/targets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: this.newName || 't' + (Date.now() % 10000), url: this.newUrl })
            })
            this.newUrl = ''
            this.load()
          },
          async del(name) {
            await fetch('/api/plugins/uptime/targets/' + name, { method: 'DELETE' })
            this.load()
          }
        },
        mounted() { this.load() },
        render() {
          const rows = (this.targets || []).map((t) => h('tr', { key: t.name }, [
            h('td', null, t.name),
            h('td', { style: { color: t.last_status ? '#3fb950' : '#f85149' } },
              (t.last_status === undefined ? '-' : (t.last_status ? '在线' : '离线'))),
            h('td', null, t.last_ms ? t.last_ms + 'ms' : '-'),
            h('td', null, (t.avail !== undefined ? t.avail + '%' : '-')),
            h('td', null, h('button', { onclick: () => this.del(t.name) }, '删除'))
          ]))
          return h('div', { class: 'uptime-panel' }, [
            h('h3', 'Uptime 监控目标'),
            h('div', { class: 'uptime-add' }, [
              h('input', { placeholder: '名称', value: this.newName, oninput: (e) => (this.newName = e.target.value) }),
              h('input', { placeholder: 'https://...', value: this.newUrl, oninput: (e) => (this.newUrl = e.target.value) }),
              h('button', { onclick: () => this.add() }, '添加')
            ]),
            this.loading ? h('p', '加载中...') : h('table', { class: 'uptime-table' }, [
              h('thead', null, h('tr', null, [
                h('th', null, '目标'), h('th', null, '状态'), h('th', null, '延迟'),
                h('th', null, '可用率'), h('th', null, '')
              ])),
              h('tbody', null, rows)
            ])
          ])
        }
      }
      const vm = createApp(App)
      vm.mount(container)
      return () => vm.unmount()
    }
  }
}

// IIFE 尾巴: 注册到全局(主面板 PluginView 动态 import 后读取)
if (typeof window !== 'undefined') {
  register(window)
}