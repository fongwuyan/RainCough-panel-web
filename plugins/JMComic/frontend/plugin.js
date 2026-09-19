// JMComic 插件前端(接口库 v4): 封面宫格搜索 / 详情先下载 / 滚动+单页双阅读模式
import { createApp, h } from 'vue'

const NAME = 'JMComic'

function mount(container, ctx) {
  const App = {
    data() {
      return { tab: 'search', kw: '', results: [], lib: [], album: null, dl: { status: 'unknown' },
        chapter: null, pages: [], loadIdx: 6, pageIdx: 0, view: 'flow', coverMap: {}, dlTimer: null,
        err: '', page: 1, pageCount: 1, loadingCover: new Set() }
    },
    methods: {
      async search(p = 1) {
        if (!this.kw.trim()) return
        this.err = ''
        try {
          const r = await ctx.invoke('jmcomic.search', { keyword: this.kw, page: p, mode: 'keyword' })
          this.results = (r && r.items) || []
          this.page = p; this.pageCount = (r && r.page_count) || 1
          this.loadCovers()
        } catch (e) { this.err = (e && e.message) || e }
      },
      // 封面懒加载(并发≤4)
      loadCovers() {
        const queue = this.results.slice(0, 24).map((it) => String(it.id)).filter((id) => !this.coverMap[id] && !this.loadingCover.has(id))
        const run = async () => {
          while (queue.length) {
            const id = queue.shift()
            if (this.coverMap[id]) continue
            this.loadingCover.add(id)
            try {
              const r = await ctx.invoke('jmcomic.cover', { aid: id })
              if (r && r.cover) this.coverMap[id] = r.cover
            } catch (e) { /* 失败留占位 */ }
            this.loadingCover.delete(id)
          }
        }
        for (let i = 0; i < 4 && queue.length; i++) run()
      },
      async openAlbum(aid) {
        this.err = ''
        try {
          this.album = await ctx.invoke('jmcomic.album', { aid })
          this.tab = 'album'; this.chapter = null; this.pages = []; this.pageIdx = 0; this.view = 'flow'
          this.pollDl(aid, true)
          if (!this.coverMap[aid]) {
            try { const r = await ctx.invoke('jmcomic.cover', { aid }); if (r && r.cover) this.coverMap[aid] = r.cover } catch (e) {}
          }
        } catch (e) { this.err = (e && e.message) || e }
      },
      async pollDl(aid, once = false) {
        clearInterval(this.dlTimer)
        const tick = async () => {
          try {
            const r = await ctx.invoke('jmcomic.download.status', { aid })
            this.dl = r || {}
            if (this.dl.status === 'completed' || this.dl.status === 'failed') clearInterval(this.dlTimer)
          } catch (e) { clearInterval(this.dlTimer) }
        }
        await tick()
        if (!once && this.dl.status !== 'completed' && this.dl.status !== 'failed') {
          this.dlTimer = setInterval(tick, 2000)
        }
      },
      async startDownload(aid) {
        this.err = ''
        try { await ctx.invoke('jmcomic.download', { aid }); this.pollDl(aid, false) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async openChapter(cid, aid) {
        if (this.dl.status !== 'completed') { this.err = '请先完成下载再阅读'; return }
        this.err = ''
        try {
          this.chapter = await ctx.invoke('jmcomic.chapter', { cid, aid })
          this.pages = []; this.pageIdx = 0; this.loadIdx = 6; this.tab = 'read'
          this.view === 'flow' ? this.loadMore() : this.loadOnePage()
        } catch (e) { this.err = (e && e.message) || e }
      },
      setView(v) { this.view = v; this.pageIdx = 0; if (v === 'single') this.loadOnePage() },
      async loadOnePage() {
        const ch = this.chapter || {}
        const arr = ch.page_arr || []
        if (!arr.length) return
        const idx = Math.min(this.pageIdx, arr.length - 1)
        const f = arr[idx]
        if (this.pages[idx]) return
        try { const r = await ctx.invoke('jmcomic.image', { aid: this.album.id, cid: ch.id, filename: f }); this.pages[idx] = r.data } catch (e) {}
      },
      async loadMore() {
        const ch = this.chapter || {}
        const arr = ch.page_arr || []
        const batch = arr.slice(this.pages.length, this.loadIdx)
        for (const f of batch) {
          try { const r = await ctx.invoke('jmcomic.image', { aid: this.album.id, cid: ch.id, filename: f }); this.pages.push(r.data) }
          catch (e) { this.pages.push('') }
        }
        this.loadIdx += 6
      },
      prevPage() { if (this.pageIdx > 0) { this.pageIdx--; this.loadOnePage() } },
      nextPage() { const n = ((this.chapter || {}).page_arr || []).length; if (this.pageIdx < n - 1) { this.pageIdx++; this.loadOnePage() } },
      async loadLib() { try { const r = await ctx.invoke('jmcomic.library.list', { page: 1, page_size: 60 }); this.lib = ((r && r.items) || []).map((it) => ({ ...it, id: String(it.id ?? it.aid ?? '') })); this.loadCoversFromLib() } catch (e) { this.err = (e && e.message) || e } },
      loadCoversFromLib() { this.results = this.lib; this.loadCovers(); this.results = [] },
      async rm(aid) { try { await ctx.invoke('jmcomic.library.delete', { aid }); this.loadLib() } catch (e) { this.err = (e && e.message) || e } },
      async download(aid) { try { const r = await ctx.invoke('jmcomic.download', { aid }); this.err = r.message } catch (e) { this.err = (e && e.message) || e } },
      async dlStatus(aid) { try { const r = await ctx.invoke('jmcomic.download.status', { aid }); this.err = '已完成 ' + (r.downloaded || 0) + '/' + (r.total || 0) + ' (' + r.status + ')' } catch (e) { this.err = (e && e.message) || e } },
    },
    unmounted() { clearInterval(this.dlTimer) },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => { this.tab = k; if (k === 'lib') this.loadLib() } }, l)
      // ---- 搜索/本子库: 封面宫格 ----
      const gridItems = this.tab === 'search' ? this.results : this.lib
      const grid = h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;' },
        gridItems.map((it) => {
          const id = String(it.id ?? it.aid ?? '')
          const cover = this.coverMap[id]
          return h('div', { key: id, class: 'card', style: 'padding:6px;' }, [
            h('a', { style: 'cursor:pointer;', onclick: () => this.openAlbum(id) }, [
              cover
                ? h('img', { src: cover, loading: 'lazy', style: 'width:100%;height:150px;object-fit:cover;display:block;background:#222;' })
                : h('div', { style: 'width:100%;height:150px;background:#1c2128;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;' }, this.loadingCover.has(id) ? '加载封面…' : '未加载'),
            ]),
            h('div', { style: 'font-size:12px;margin-top:4px;height:34px;overflow:hidden;' }, it.name || ('ID ' + id)),
            h('div', { class: 'faint', style: 'font-size:11px;' }, (it.author || '') + ' · ' + id),
            h('div', { class: 'flex', style: 'gap:4px;margin-top:4px;' }, [
              h('button', { class: 'btn btn-sm', onclick: () => this.openAlbum(id) }, '详情'),
              this.tab === 'search'
                ? [h('button', { class: 'btn btn-sm', onclick: () => this.download(id) }, '下载'), h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.dlStatus(id) }, '进度')]
                : [h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.dlStatus(id) }, '进度'), h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.rm(id) }, '删')],
            ]),
          ])
        }))
      let v = null
      // ---- 详情页 ----
      if (this.tab === 'album' && this.album) {
        const a = this.album, dl = this.dl, done = dl.status === 'completed'
        const cover = this.coverMap[a.id]
        const chapters = (a.chapters || []).map((c) => h('div', { key: c.cid, style: 'padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;display:flex;justify-content:space-between;align-items:center;' }, [
          h('span', null, c.name || ('章节 ' + c.cid)),
          h('button', { class: 'btn btn-sm', disabled: !done, onclick: () => this.openChapter(c.cid, c.aid) }, '阅读'),
        ]))
        const dlBlock = done
          ? h('p', { style: 'color:var(--success);font-size:13px;' }, '✅ 已下载(' + (dl.cached || dl.total || 0) + '页)')
          : h('div', { class: 'section', style: 'margin:6px 0;' }, [
              h('p', { style: 'font-size:13px;' }, this.dl.status === 'downloading' || this.dl.total ? '下载中: ' + (this.dl.downloaded || 0) + '/' + (this.dl.total || '?') + ' 页' : '本子尚未下载，下载后才能阅读章节与图片'),
              h('button', { class: 'btn btn-primary', onclick: () => this.startDownload(a.id) }, '先下载本子'),
              this.dl.total ? h('div', { style: 'height:4px;background:#222;border-radius:2px;margin-top:6px;' }, h('div', { style: 'height:4px;width:' + Math.min(100, (this.dl.downloaded || 0) / Math.max(1, this.dl.total) * 100) + '%;background:var(--accent);' })) : null,
            ])
        v = h('div', null, [
          h('div', { class: 'flex', style: 'gap:10px;align-items:flex-start;' }, [
            cover ? h('img', { src: cover, style: 'width:120px;height:170px;object-fit:cover;border-radius:6px;background:#222;' }) : null,
            h('div', null, [
              h('h3', { style: 'margin:0;' }, a.name),
              h('p', { class: 'faint', style: 'font-size:12px;' }, '作者 ' + (a.author || '未知') + ' · ' + (a.tags || []).join(' / ')),
              h('p', { class: 'faint', style: 'font-size:12px;' }, 'ID ' + a.id + ' · 共 ' + chapters.length + ' 章'),
            ]),
          ]),
          h('div', { class: 'flex', style: 'gap:6px;margin:8px 0;' }, [
            h('button', { class: 'btn btn-sm', onclick: () => { this.tab = 'search' } }, '返回'),
            h('button', { class: 'btn btn-sm', onclick: () => this.pollDl(a.id, false) }, '刷新状态'),
          ]),
          dlBlock,
          h('div', { class: 'section-title', style: 'margin-top:6px;' }, '章节' + (done ? '' : '(下载后解锁)')),
          chapters,
        ])
      }
      // ---- 阅读器 ----
      if (this.tab === 'read' && this.chapter) {
        const ch = this.chapter, arr = ch.page_arr || []
        const toolbar = h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center;' }, [
          h('button', { class: 'btn btn-sm', onclick: () => { this.tab = 'album' } }, '返回详情'),
          h('span', { class: 'faint', style: 'font-size:12px;' }, ch.name || ('章节 ' + ch.id) + ' · ' + arr.length + ' 页'),
          h('button', { class: 'btn btn-sm' + (this.view === 'flow' ? ' btn-primary' : ''), onclick: () => this.setView('flow') }, '滚动模式'),
          h('button', { class: 'btn btn-sm' + (this.view === 'single' ? ' btn-primary' : ''), onclick: () => this.setView('single') }, '单页模式'),
        ])
        if (this.view === 'flow') {
          v = h('div', null, [
            toolbar,
            this.pages.map((d, i) => d ? h('img', { key: i, src: d, loading: 'lazy', style: 'width:100%;max-width:520px;display:block;margin:6px auto;border:1px solid var(--border);border-radius:6px;' }) : null),
            this.pages.length < arr.length
              ? h('button', { class: 'btn', style: 'display:block;margin:6px auto;', onclick: () => this.loadMore() }, '加载更多 (' + this.pages.length + '/' + arr.length + ')')
              : h('p', { class: 'hint' }, '已全部加载'),
          ])
        } else {
          const img = this.pages[this.pageIdx]
          v = h('div', null, [
            toolbar,
            h('div', { style: 'display:flex;justify-content:center;align-items:center;gap:10px;' }, [
              h('button', { class: 'btn btn-sm', disabled: this.pageIdx <= 0, onclick: () => this.prevPage() }, '上一页'),
              h('span', { class: 'faint', style: 'font-size:12px;' }, (this.pageIdx + 1) + ' / ' + arr.length),
              h('button', { class: 'btn btn-sm', disabled: this.pageIdx >= arr.length - 1, onclick: () => this.nextPage() }, '下一页'),
            ]),
            img
              ? h('img', { src: img, style: 'width:100%;max-width:560px;display:block;margin:8px auto;border:1px solid var(--border);border-radius:6px;' })
              : h('p', { class: 'hint', style: 'text-align:center;padding:20px;' }, '加载中…'),
          ])
        }
      }
      // ---- 汇总 ----
      const head = h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;' }, [
        h('span', null, 'JMComic'),
        h('div', { class: 'flex', style: 'gap:6px;' }, [t('search', '搜索'), t('lib', '本子库')]),
      ])
      const searchBar = this.tab === 'search'
        ? h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '关键词', value: this.kw, oninput: (e) => (this.kw = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.search() } }),
            h('button', { class: 'btn', onclick: () => this.search() }, '搜索'),
            h('button', { class: 'btn btn-sm', disabled: this.page <= 1, onclick: () => this.search(this.page - 1) }, '上一页'),
            h('button', { class: 'btn btn-sm', disabled: this.page >= this.pageCount, onclick: () => this.search(this.page + 1) }, '下一页'),
          ])
        : null
      const body = (this.tab === 'album' || this.tab === 'read') ? v : grid
      return h('div', null, [head, this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null, searchBar, body])
    },
  }
  const vm = createApp(App)
  const stop = () => { if (App.unmounted) App.unmounted(); vm.unmount() }
  vm.mount(container)
  return stop
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'JMComic' }], mount }
}
if (typeof window !== 'undefined') register(window)