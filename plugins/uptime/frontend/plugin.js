// uptime 插件前端(接口库 v4): 监控目标 CRUD + 状态 + 历史 + 24h 格
import { createApp, h } from 'vue'

const NAME = 'uptime'
let timer = null

function mount(container, ctx) {
  const App = {
    data() { return {
      targets: [], status: null, openHist: null, hist: [], cells: [], summary: null,
      newUrl: '', newName: '', loading: true, err: '',
      edit: null, editUrl: '', editInterval: 60, editTimeout: 10,
    } },
    methods: {
      async load() {
        this.loading = true
        try {
          const [d, s] = await Promise.all([
            ctx.invoke('uptime.targets.list'),
            ctx.invoke('uptime.status').catch(() => null),
          ])
          this.targets = (d && d.targets) || []
          this.summary = s
        } catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async add() {
        if (!this.newUrl) return
        this.err = ''
        try {
          await ctx.invoke('uptime.targets.create', { name: this.newName || 't' + (Date.now() % 10000), url: this.newUrl, interval: 60 })
          this.newUrl = ''; this.newName = ''; this.load()
        } catch (e) { this.err = (e && e.message) || e }
      },
      async del(name) {
        try { await ctx.invoke('uptime.targets.delete', { name }); this.load() }
        catch (e) { this.err = (e && e.message) || e }
      },
      async test(name) {
        try { alert(JSON.stringify(await ctx.invoke('uptime.targets.test', { name }), null, 1)) }
        catch (e) { this.err = (e && e.message) || e }
      },
      startEdit(t) {
        this.edit = t.name; this.editUrl = t.url; this.editInterval = t.interval || 60; this.editTimeout = t.timeout || 10
      },
      async saveEdit() {
        try {
          await ctx.invoke('uptime.targets.update', { name: this.edit, url: this.editUrl, interval: Number(this.editInterval) || 60, timeout: Number(this.editTimeout) || 10 })
          this.edit = null; this.load()
        } catch (e) { this.err = (e && e.message) || e }
      },
      async showHist(name) {
        this.openHist = this.openHist === name ? null : name
        if (this.openHist) {
          try {
            const [h, st] = await Promise.all([
              ctx.invoke('uptime.targets.history', { name }),
              ctx.invoke('uptime.targets.status24', { name }),
            ])
            this.hist = ((h && h.history) || []).slice(-48).reverse()
            this.cells = ((st && st.cells) || [])
          } catch (e) { this.err = (e && e.message) || e }
        }
      },
    },
    mounted() { this.load(); timer = setInterval(() => this.load(), 30000) },
    unmounted() { clearInterval(timer) },
    render() {
      const s = this.summary || {}
      const rows = this.targets.map((t) => h('tr', { key: t.name }, [
        h('td', null, t.name),
        h('td', null, h('span', { style: { color: t.last_ok ? '#3fb950' : '#f85149' } }, t.last_ok ? '在线' : (t.last_ok === null ? '-' : '离线'))),
        h('td', { class: 'mono faint' }, t.last_ms != null ? t.last_ms + 'ms' : '-'),
        h('td', null, t.uptime != null ? t.uptime + '%' : '-'),
        h('td', null, h('div', { class: 'flex', style: 'gap:4px;' }, [
          h('button', { class: 'btn btn-sm', onclick: () => this.test(t.name) }, '测试'),
          h('button', { class: 'btn btn-sm', onclick: () => this.startEdit(t) }, '编辑'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.showHist(t.name) }, '历史'),
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.del(t.name) }, '删除'),
        ])),
      ]))
      return h('div', { class: 'uptime-panel' }, [
        h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;' }, [
          h('span', null, 'Uptime 监控目标'),
          h('span', { class: 'faint', style: 'font-size:12px;' }, '共 ' + s.total + ' · 在线 ' + s.online + ' · 离线 ' + s.offline + (s.avg_uptime != null ? ' · 平均可用率 ' + s.avg_uptime + '%' : '')),
        ]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        h('div', { class: 'uptime-add flex', style: 'gap:6px;margin-bottom:8px;' }, [
          h('input', { class: 'input', placeholder: '名称', value: this.newName, oninput: (e) => (this.newName = e.target.value), style: 'width:140px;' }),
          h('input', { class: 'input', placeholder: 'https://...', value: this.newUrl, oninput: (e) => (this.newUrl = e.target.value), style: 'flex:1;' }),
          h('button', { class: 'btn', onclick: () => this.add() }, '添加'),
        ]),
        this.edit != null ? h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;border:1px solid var(--border);padding:8px;border-radius:6px;' }, [
          h('input', { class: 'input', style: 'flex:1;', value: this.editUrl, oninput: (e) => (this.editUrl = e.target.value) }),
          h('input', { class: 'input', style: 'width:70px;', title: '间隔秒', value: this.editInterval, oninput: (e) => (this.editInterval = e.target.value) }),
          h('input', { class: 'input', style: 'width:70px;', title: '超时秒', value: this.editTimeout, oninput: (e) => (this.editTimeout = e.target.value) }),
          h('button', { class: 'btn btn-sm btn-primary', onclick: () => this.saveEdit() }, '保存'),
          h('button', { class: 'btn btn-sm', onclick: () => (this.edit = null) }, '取消'),
        ]) : null,
        this.loading ? h('p', { class: 'hint' }, '加载中...') : h('table', { class: 'table' }, [
          h('thead', null, h('tr', null, ['目标', '状态', '延迟', '可用率', ''].map((x) => h('th', null, x)))),
          h('tbody', null, rows),
        ]),
        this.openHist ? h('div', { class: 'section', style: 'margin-top:10px;' }, [
          h('div', { class: 'section-title' }, '24h 可用格 · ' + this.openHist),
          h('div', { style: 'display:flex;flex-wrap:wrap;gap:2px;' }, (this.cells || []).map((c) =>
            h('div', { style: 'width:8px;height:14px;border-radius:1px;background:' + (c >= 1 ? '#2e9e5b' : (c === 0 ? '#f85149' : '#333')) + ';', title: c == null ? '无数据' : (c ? '在线' : '离线') }))),
          h('div', { class: 'section-title', style: 'margin-top:8px;' }, '最近探活'),
          h('ul', { style: 'list-style:none;padding-left:0;font-size:12px;color:var(--text-faint);' }, this.hist.map((x) =>
            h('li', null, new Date(x.ts * 1000).toLocaleString() + ' · ' + (x.ok ? '✓' : '✗') + (x.ms != null ? ' ' + x.ms + 'ms' : '')))),
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
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '监控目标' }], mount }
}
if (typeof window !== 'undefined') register(window)