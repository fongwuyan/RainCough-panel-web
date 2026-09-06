// uptime 插件前端(接口库 v4): Vue3 展示层, 全部经 ctx.invoke 走接口库。
// 产物: assets/plugin.js(构建工具内联 Vue, 注册 window.__rcPluginV4__.uptime)
import { createApp, h } from 'vue'

const NAME = 'uptime'

function mount(container, ctx) {
  const App = {
    data() {
      return { targets: [], loading: true, newUrl: '', newName: '' }
    },
    methods: {
      async load() {
        this.loading = true
        try {
          const r = await ctx.invoke('uptime.targets.list')
          this.targets = (r && r.targets) || []
        } catch (e) { console.error(e) }
        this.loading = false
      },
      async add() {
        if (!this.newUrl) return
        try {
          await ctx.invoke('uptime.targets.create', {
            name: this.newName || 't' + (Date.now() % 10000),
            url: this.newUrl,
          })
          this.newUrl = ''
          this.newName = ''
          this.load()
        } catch (e) { alert('添加失败: ' + (e && e.message || e)) }
      },
      async del(name) {
        try {
          await ctx.invoke('uptime.targets.delete', { name })
          this.load()
        } catch (e) { alert('删除失败: ' + (e && e.message || e)) }
      },
      async test(name) {
        try {
          const r = await ctx.invoke('uptime.targets.test', { name })
          alert(JSON.stringify(r, null, 2))
        } catch (e) { alert('测试失败: ' + (e && e.message || e)) }
      },
    },
    mounted() { this.load() },
    render() {
      const rows = (this.targets || []).map((t) => h('tr', { key: t.name }, [
        h('td', null, t.name),
        h('td', { style: { color: t.last_ok ? '#3fb950' : '#f85149' } },
          (t.last_ok === undefined || t.last_ok === null) ? '-' : (t.last_ok ? '在线' : '离线')),
        h('td', null, t.last_ms != null ? t.last_ms + 'ms' : '-'),
        h('td', null, (t.uptime !== undefined && t.uptime !== null ? t.uptime + '%' : '-')),
        h('td', null, [
          h('button', { onclick: () => this.test(t.name) }, '测试'),
          h('button', { onclick: () => this.del(t.name) }, '删除'),
        ]),
      ]))
      return h('div', { class: 'uptime-panel' }, [
        h('h3', 'Uptime 监控目标'),
        h('div', { class: 'uptime-add' }, [
          h('input', { placeholder: '名称', value: this.newName, oninput: (e) => (this.newName = e.target.value) }),
          h('input', { placeholder: 'https://...', value: this.newUrl, oninput: (e) => (this.newUrl = e.target.value) }),
          h('button', { onclick: () => this.add() }, '添加'),
        ]),
        this.loading ? h('p', '加载中...') : h('table', { class: 'uptime-table' }, [
          h('thead', null, h('tr', null, [
            h('th', null, '目标'), h('th', null, '状态'), h('th', null, '延迟'),
            h('th', null, '可用率'), h('th', null, ''),
          ])),
          h('tbody', null, rows),
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
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '监控目标' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}