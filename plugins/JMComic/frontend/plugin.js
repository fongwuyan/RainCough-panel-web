// JMComic 插件前端(接口库 v4): 搜索 / 详情 / 阅读 / 本子库
import { createApp, h } from 'vue'

const NAME = 'JMComic'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'search', kw: '', results: [], lib: [], album: null, chapter: null, pages: [], loadIdx: 6, err: '', page: 1, pageCount: 1, dl: {} } },
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
      async openAlbum(aid) {
        this.err = ''
        try { this.album = await ctx.invoke('jmcomic.album', { aid }); this.tab = 'album'; this.chapter = null; this.pages = [] }
        catch (e) { this.err = (e && e.message) || e }
      },
      async download(aid) {
        try { const r = await ctx.invoke('jmcomic.download', { aid }); this.dl[aid] = r.message }
        catch (e) { this.err = (e && e.message) || e }
      },
      async dlStatus(aid) {
        try { const r = await ctx.invoke('jmcomic.download.status', { aid }); this.dl[aid] = '已完成 ' + (r.downloaded || 0) + '/' + (r.total || 0) + ' (' + r.status + ')' }
        catch (e) { this.err = (e && e.message) || e }
      },
      async openChapter(cid, aid) {
        this.err = ''
        try {
          this.chapter = await ctx.invoke('jmcomic.chapter', { cid, aid })
          this.pages = [] ; this.loadIdx = 6 ; this.tab = 'read'
          this.loadPages()
        } catch (e) { this.err = (e && e.message) || e }
      },
      async loadPages() {
        const ch = this.chapter || {}
        const arr = ch.page_arr || []
        const batch = arr.slice(this.pages.length, this.loadIdx)
        for (const f of batch) {
          try { const r = await ctx.invoke('jmcomic.image', { aid: ch.id || this.album.id, cid: ch.id, filename: f }); this.pages.push({ name: f, data: r.data }) }
          catch (e) { this.pages.push({ name: f, data: '' }) }
        }
        this.loadIdx += 6
      },
      async loadLib() { try { const r = await ctx.invoke('jmcomic.library.list', { page: 1, page_size: 60 }); this.lib = (r && r.items) || [] } catch (e) { this.err = (e && e.message) || e } },
      async rm(aid) { try { await ctx.invoke('jmcomic.library.delete', { aid }); this.loadLib() } catch (e) { this.err = (e && e.message) || e } },
    },
    mounted() { this.loadLib() },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => { this.tab = k; if (k === 'lib') this.loadLib() } }, l)
      const list = this.tab === 'album' && this.album ? [{ id: this.album.id, name: this.album.name }] : (this.tab === 'search' ? this.results : this.lib)
      const rows = list.map((it) => h('tr', { key: it.id }, [
        h('td', { class: 'mono' }, it.id), h('td', null, it.name + (it.author ? ' · ' + it.author : '')),
        h('td', null, h('div', { class: 'flex', style: 'gap:4px;' }, [
          h('button', { class: 'btn btn-sm', onclick: () => this.openAlbum(it.id) }, '详情'),
          this.tab === 'search' ? [h('button', { class: 'btn btn-sm', onclick: () => this.download(it.id) }, '下载'), h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.dlStatus(it.id) }, '进度')] : null,
          this.tab === 'lib' ? [h('button', { class: 'btn btn-sm', onclick: () => this.dlStatus(it.id) }, '进度'), h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.rm(it.id) }, '删')] : null,
        ])),
      ]))
      return h('div', null, [
        h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;' }, [
          h('span', null, 'JMComic'),
          h('div', { class: 'flex', style: 'gap:6px;' }, [t('search', '搜索'), t('lib', '本子库')]),
        ]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'search' ? h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
          h('input', { class: 'input', style: 'flex:1;', placeholder: '关键词', value: this.kw, oninput: (e) => (this.kw = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.search() } }),
          h('button', { class: 'btn', onclick: () => this.search() }, '搜索'),
          h('button', { class: 'btn btn-sm', disabled: this.page <= 1, onclick: () => this.search(this.page - 1) }, '上一页'),
          h('button', { class: 'btn btn-sm', disabled: this.page >= this.pageCount, onclick: () => this.search(this.page + 1) }, '下一页'),
        ]) : null,
        this.tab === 'album' && this.album ? h('div', { class: 'section', style: 'margin-bottom:8px;' }, [
          h('h3', null, this.album.name), h('p', { class: 'faint', style: 'font-size:12px;' }, '作者 ' + (this.album.author || '未知') + ' · ' + (this.album.tags || []).join(', ')),
          h('button', { class: 'btn btn-sm', onclick: () => this.download(this.album.id) }, '下载本子'),
          h('div', { class: 'section-title', style: 'margin-top:8px;' }, '章节'),
          (this.album.chapters || []).map((c) => h('div', { key: c.cid, style: 'padding:4px 0;border-bottom:1px solid var(--border);font-size:13px;' }, [
            c.name || ('章节 ' + c.cid), h('button', { class: 'btn btn-sm', style: 'float:right;', onclick: () => this.openChapter(c.cid, c.aid) }, '阅读'),
          ])),
        ]) : null,
        this.tab === 'read' && this.chapter ? h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('button', { class: 'btn btn-sm', onclick: () => this.tab = 'album' }, '返回详情'),
            h('span', { class: 'faint' }, this.pages.length + '/' + (this.chapter.page_arr || []).length + ' 页'),
          ]),
          this.pages.map((pg) => pg.data ? h('img', { key: pg.name, src: pg.data, loading: 'lazy', style: 'width:100%;max-width:520px;display:block;margin:6px auto;border:1px solid var(--border);border-radius:6px;' }) : null),
          this.pages.length < (this.chapter.page_arr || []).length
            ? h('button', { class: 'btn', style: 'margin-top:6px;', onclick: () => this.loadPages() }, '加载更多')
            : h('p', { class: 'hint' }, '已全部加载'),
        ]) : null,
        (this.tab === 'search' || this.tab === 'lib') && !this.err ? h('table', { class: 'table' }, [h('thead', null, h('tr', null, ['ID', '名称', '操作'].map((x) => h('th', null, x)))), h('tbody', null, rows)]) : null,
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