// webspy 插件前端(接口库 v4): 搜索 / 链接检测 / RSS / 正文提取
import { createApp, h } from 'vue'

const NAME = 'webspy'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'search', q: '', results: [], urls: '', uc: null, rss: [], rssUrl: '', rssName: '', entries: [], artUrl: '', art: null, err: '', loading: false } },
    methods: {
      async search() {
        if (!this.q.trim()) return
        this.loading = true; this.err = ''
        try { const r = await ctx.invoke('webspy.search', { q: this.q }); this.results = (r && r.results) || [] }
        catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async urlcheck() {
        const list = this.urls.split(/[\n,;\s]+/).filter(Boolean)
        if (!list.length) { this.err = '请输入链接'; return }
        this.err = ''
        try { this.uc = await ctx.invoke('webspy.urlcheck', { urls: list }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async loadRss() { try { const r = await ctx.invoke('webspy.rss.list'); this.rss = (r && r.feeds) || [] } catch (e) { this.err = (e && e.message) || e } },
      async addRss() { try { await ctx.invoke('webspy.rss.add', { url: this.rssUrl, name: this.rssName }); this.rssUrl = ''; this.rssName = ''; this.loadRss() } catch (e) { this.err = (e && e.message) || e } },
      async delRss(idx) { try { await ctx.invoke('webspy.rss.delete', { idx }); this.loadRss() } catch (e) { this.err = (e && e.message) || e } },
      async fetchRss(url) { try { const r = await ctx.invoke('webspy.rss.fetch', { url }); this.entries = (r && r.entries) || [] } catch (e) { this.err = (e && e.message) || e } },
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
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      return h('div', null, [
        h('div', { class: 'section-title' }, '采集解析'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' }, [['search', '搜索'], ['uc', '链接检测'], ['rss', 'RSS'], ['art', '正文提取']].map((x) => t(x[0], x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'search' ? h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '搜索关键词', value: this.q, oninput: (e) => (this.q = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.search() } }),
            h('button', { class: 'btn', onclick: () => this.search() }, '搜索'),
          ]),
          this.results.map((r) => h('div', { key: r.url, class: 'card', style: 'padding:8px;margin-bottom:6px;' }, [
            h('a', { href: r.url, target: '_blank', style: 'font-weight:bold;' }, r.title),
            h('div', { class: 'faint', style: 'font-size:11px;' }, r.url), h('div', { style: 'font-size:13px;' }, r.snippet),
          ])),
        ]) : null,
        this.tab === 'uc' ? h('div', null, [
          h('textarea', { class: 'input', style: 'width:100%;min-height:80px;', placeholder: '每行一个 URL', value: this.urls, oninput: (e) => (this.urls = e.target.value) }),
          h('button', { class: 'btn', style: 'margin-top:6px;', onclick: () => this.urlcheck() }, '检测(最多20)'),
          this.uc ? this.uc.results.map((r, i) => h('div', { key: i, style: 'font-size:12px;margin-top:4px;' }, (r.ok ? '✓' : '✗') + ' [' + (r.status || '-') + '] ' + r.url + (r.error ? ' — ' + r.error : ''))) : null,
        ]) : null,
        this.tab === 'rss' ? h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: 'RSS 地址', value: this.rssUrl, oninput: (e) => (this.rssUrl = e.target.value) }),
            h('input', { class: 'input', style: 'width:120px;', placeholder: '名称', value: this.rssName, oninput: (e) => (this.rssName = e.target.value) }),
            h('button', { class: 'btn', onclick: () => this.addRss() }, '添加'),
          ]),
          this.rss.map((f, i) => h('div', { key: f.url, class: 'flex', style: 'justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);' }, [
            h('div', null, [h('b', null, f.name), h('div', { class: 'faint', style: 'font-size:11px;' }, f.url)]),
            h('div', null, [h('button', { class: 'btn btn-sm', onclick: () => this.fetchRss(f.url) }, '抓取'), h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.delRss(i) }, '删')]),
          ])),
          this.entries.length ? this.entries.map((e, i) => h('div', { key: i, style: 'padding:4px 0;' }, [
            h('a', { href: e.link, target: '_blank' }, e.title), h('div', { class: 'faint', style: 'font-size:11px;' }, (e.published || '') + ' · ' + (e.summary || '').slice(0, 100)),
          ])) : null,
        ]) : null,
        this.tab === 'art' ? h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '网页 URL', value: this.artUrl, oninput: (e) => (this.artUrl = e.target.value) }),
            h('button', { class: 'btn', disabled: this.loading, onclick: () => this.readability() }, '提取正文'),
          ]),
          this.art ? h('div', null, [h('h4', null, this.art.title), h('pre', { class: 'faint', style: 'white-space:pre-wrap;font-size:13px;max-height:500px;overflow:auto;' }, this.art.text)]) : null,
        ]) : null,
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '采集解析' }], mount }
}
if (typeof window !== 'undefined') register(window)