// webspy 插件前端(接口库 v4): Vue3 展示层, ctx.invoke。
import { createApp, h } from 'vue'

const NAME = 'webspy'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'search', q: '', results: [], rss: [], rssUrl: '', rssName: '', entries: [], artUrl: '', art: null, err: '', loading: false } },
    methods: {
      async search() {
        if (!this.q.trim()) return
        this.loading = true; this.err = ''
        try { const r = await ctx.invoke('webspy.search', { q: this.q }); this.results = (r && r.results) || [] }
        catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async loadRss() {
        try { const r = await ctx.invoke('webspy.rss.list'); this.rss = (r && r.feeds) || [] }
        catch (e) { this.err = (e && e.message) || e }
      },
      async addRss() {
        try { await ctx.invoke('webspy.rss.add', { url: this.rssUrl, name: this.rssName }); this.rssUrl = ''; this.rssName = ''; this.loadRss() }
        catch (e) { this.err = (e && e.message) || e }
      },
      async delRss(idx) {
        try { await ctx.invoke('webspy.rss.delete', { idx }); this.loadRss() }
        catch (e) { this.err = (e && e.message) || e }
      },
      async fetchRss(url) {
        try { const r = await ctx.invoke('webspy.rss.fetch', { url }); this.entries = (r && r.entries) || [] }
        catch (e) { this.err = (e && e.message) || e }
      },
      async readability() {
        if (!this.artUrl.trim()) return
        this.loading = true
        try { this.art = await ctx.invoke('webspy.readability', { url: this.artUrl }) }
        catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
    },
    mounted() { this.loadRss() },
    render() {
      const tabBtn = (k, label) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, label)
      const searchView = h('div', null, [
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
          h('input', { class: 'input', style: 'flex:1;', placeholder: '搜索关键词', value: this.q, oninput: (e) => (this.q = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.search() } }),
          h('button', { class: 'btn', onclick: () => this.search() }, '搜索'),
        ]),
        this.results.map((r) => h('div', { class: 'card', style: 'padding:8px;margin-bottom:6px;' }, [
          h('a', { href: r.url, target: '_blank', style: 'font-weight:bold;' }, r.title),
          h('div', { class: 'faint', style: 'font-size:12px;' }, r.url),
          h('div', { style: 'font-size:13px;' }, r.snippet),
        ])),
      ])
      const rssView = h('div', null, [
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
          h('input', { class: 'input', style: 'flex:1;', placeholder: 'RSS 地址', value: this.rssUrl, oninput: (e) => (this.rssUrl = e.target.value) }),
          h('input', { class: 'input', style: 'width:120px;', placeholder: '名称(可选)', value: this.rssName, oninput: (e) => (this.rssName = e.target.value) }),
          h('button', { class: 'btn', onclick: () => this.addRss() }, '添加'),
        ]),
        this.rss.map((f, i) => h('div', { key: f.url, class: 'flex', style: 'justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);' }, [
          h('div', null, [h('b', null, f.name), h('div', { class: 'faint', style: 'font-size:11px;' }, f.url)]),
          h('div', null, [
            h('button', { class: 'btn btn-sm', onclick: () => this.fetchRss(f.url) }, '抓取'),
            h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.delRss(i) }, '删除'),
          ]),
        ])),
        this.entries.length ? h('div', { class: 'section', style: 'margin-top:10px;' }, [
          h('div', { class: 'section-title' }, '最新条目'),
          this.entries.map((e) => h('div', { style: 'padding:4px 0;' }, [
            h('a', { href: e.link, target: '_blank' }, e.title),
            h('div', { class: 'faint', style: 'font-size:11px;' }, (e.published || '') + ' · ' + (e.summary || '').slice(0, 120)),
          ])),
        ]) : null,
      ])
      const artView = h('div', null, [
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
          h('input', { class: 'input', style: 'flex:1;', placeholder: '网页 URL', value: this.artUrl, oninput: (e) => (this.artUrl = e.target.value) }),
          h('button', { class: 'btn', onclick: () => this.readability(), disabled: this.loading }, '提取正文'),
        ]),
        this.art ? h('div', null, [
          h('h4', null, this.art.title),
          h('pre', { class: 'faint', style: 'white-space:pre-wrap;font-size:13px;max-height:500px;overflow:auto;' }, this.art.text),
        ]) : null,
      ])
      return h('div', { class: 'webspy-panel' }, [
        h('div', { class: 'section-title' }, '采集解析'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:10px;' }, [tabBtn('search', '搜索'), tabBtn('rss', 'RSS'), tabBtn('art', '正文提取')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'search' ? searchView : (this.tab === 'rss' ? rssView : artView),
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '采集解析' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}