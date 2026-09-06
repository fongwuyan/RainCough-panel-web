// JMComic 插件前端(接口库 v4): Vue3 展示层, ctx.invoke。
import { createApp, h } from 'vue'

const NAME = 'JMComic'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'search', kw: '', results: [], lib: [], album: null, err: '', page: 1, pageCount: 1 } },
    methods: {
      async search(p = 1) {
        if (!this.kw.trim()) return
        this.err = ''
        try {
          const r = await ctx.invoke('jmcomic.search', { keyword: this.kw, page: p, mode: 'keyword' })
          this.results = (r && r.items) || []
          this.page = p; this.pageCount = (r && r.page_count) || 1
        } catch (e) { this.err = (e && e.message) || e }
      },
      async album(aid) {
        this.err = ''
        try { this.album = await ctx.invoke('jmcomic.album', { aid }); this.tab = 'album' }
        catch (e) { this.err = (e && e.message) || e }
      },
      async download(aid) {
        try { this.err = (await ctx.invoke('jmcomic.download', { aid })).message || '' }
        catch (e) { this.err = (e && e.message) || e }
      },
      async loadLib() {
        this.err = ''
        try { const r = await ctx.invoke('jmcomic.library.list', { page: 1, page_size: 45 }); this.lib = (r && r.items) || [] }
        catch (e) { this.err = (e && e.message) || e }
      },
      async rm(aid) {
        try { await ctx.invoke('jmcomic.library.delete', { aid }); this.loadLib() }
        catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() { this.loadLib() },
    render() {
      const tab = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      const rows = (this.tab === 'album' && this.album ? [{ id: this.album.id, name: this.album.name }] : (this.tab === 'search' ? this.results : this.lib)).map((it) =>
        h('tr', { key: it.id }, [
          h('td', null, it.id),
          h('td', null, it.name + (it.author ? ' · ' + it.author : '')),
          h('td', null, [
            h('button', { class: 'btn btn-sm', onclick: () => this.album(it.id) }, '详情'),
            this.tab === 'search' ? h('button', { class: 'btn btn-sm', onclick: () => this.download(it.id) }, '下载') : null,
            this.tab === 'lib' ? h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.rm(it.id) }, '删除') : null,
          ]),
        ]))
      return h('div', null, [
        h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;' }, [
          h('span', null, 'JMComic'),
          h('div', { class: 'flex', style: 'gap:6px;' }, [tab('search', '搜索'), tab('lib', '本子库')]),
        ]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'search' ? h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
          h('input', { class: 'input', style: 'flex:1;', placeholder: '关键词', value: this.kw, oninput: (e) => (this.kw = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.search() } }),
          h('button', { class: 'btn', onclick: () => this.search() }, '搜索'),
          h('button', { class: 'btn btn-sm', disabled: this.page <= 1, onclick: () => this.search(this.page - 1) }, '上一页'),
          h('button', { class: 'btn btn-sm', disabled: this.page >= this.pageCount, onclick: () => this.search(this.page + 1) }, '下一页'),
        ]) : null,
        this.tab === 'album' && this.album ? h('div', { class: 'section', style: 'margin-bottom:10px;' }, [
          h('h3', null, this.album.name),
          h('p', { class: 'faint', style: 'font-size:12px;' }, '作者 ' + (this.album.author || '未知') + ' · ' + (this.album.chapters || []).length + ' 章'),
          h('button', { class: 'btn btn-sm', onclick: () => this.download(this.album.id) }, '下载本子'),
        ]) : null,
        h('table', { class: 'table' }, [h('thead', null, h('tr', null, [h('th', null, 'ID'), h('th', null, '名称'), h('th', null, '操作')])), h('tbody', null, rows)]),
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'JMComic' }], mount }
}
if (typeof window !== 'undefined') register(window)