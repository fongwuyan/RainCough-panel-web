// touchgal 插件前端(接口库 v4): Vue3 展示层, ctx.invoke, 无直连。
import { createApp, h } from 'vue'

const NAME = 'touchgal'

function mount(container, ctx) {
  const App = {
    data() {
      return { keyword: '', nsfw: false, results: [], res: [], loading: false, err: '' }
    },
    methods: {
      async search() {
        this.loading = true
        this.err = ''
        this.res = []
        try {
          const r = await ctx.invoke('touchgal.search', { keyword: this.keyword, nsfw: this.nsfw })
          this.results = (r && (r.data || r.resources || [])) || []
        } catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async resource(item) {
        this.err = ''
        try {
          const r = await ctx.invoke('touchgal.resource', { patchId: item.patchId || item.id })
          this.res = (r && r.resources) || []
        } catch (e) { this.err = (e && e.message) || e }
      },
    },
    render() {
      const rows = this.results.map((it) => h('tr', { key: it.patchId || it.id || it.name }, [
        h('td', null, it.name || it.title || ''),
        h('td', { class: 'faint' }, it.ratingCount != null ? it.ratingCount + ' ★' : ''),
        h('td', null, h('button', { class: 'btn btn-sm', onclick: () => this.resource(it) }, '资源')),
      ]))
      const resList = this.res.map((x) => h('li', { key: x.name }, [
        h('b', null, x.name), ' ',
        h('span', { class: 'faint' }, '[' + x.platform + ' · ' + x.language + '] ' + x.size),
        h('div', { class: 'mono', style: 'font-size:12px;' }, (x.content ? x.content + ' | ' : '') + '提取码 ' + x.code + ' · 密码 ' + x.password),
      ]))
      return h('div', { class: 'tg-panel' }, [
        h('h3', 'TouchGal 游戏查找'),
        h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;' }, [
          h('input', { class: 'input', placeholder: '游戏名/关键字', value: this.keyword, oninput: (e) => (this.keyword = e.target.value), style: 'flex:1;min-width:200px;', onkeyup: (e) => { if (e.key === 'Enter') this.search() } }),
          h('label', { style: 'font-size:12px;display:flex;align-items:center;gap:4px;' }, [
            h('input', { type: 'checkbox', checked: this.nsfw, onchange: (e) => (this.nsfw = e.target.checked) }), 'NSFW'
          ]),
          h('button', { class: 'btn btn-primary', onclick: () => this.search(), disabled: this.loading }, this.loading ? '搜索中...' : '搜索'),
        ]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        h('table', { class: 'table', style: 'margin-top:10px;' }, [
          h('thead', null, h('tr', null, [h('th', null, '名称'), h('th', null, '评分'), h('th', null, '')])),
          h('tbody', null, rows),
        ]),
        this.res.length ? h('div', { class: 'section', style: 'margin-top:12px;' }, [
          h('div', { class: 'section-title' }, '下载资源'),
          h('ul', { style: 'list-style:none;padding-left:0;' }, resList),
        ]) : null,
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '游戏查找' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}