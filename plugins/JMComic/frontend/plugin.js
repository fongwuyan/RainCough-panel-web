// JMComic 插件前端(接口库 v4): 封面宫格搜索 / 详情先下载 / 滚动+单页双阅读模式(纯文字界面)
import { createApp, h } from 'vue'

const NAME = 'JMComic'
const STYLE_ID = 'rc-jmcomic-style'

const CSS = `
.rcjm-card{transition:transform .15s ease, box-shadow .15s ease;cursor:pointer}
.rcjm-card:hover{transform:translateY(-3px);box-shadow:0 6px 18px rgba(0,0,0,.35)}
.rcjm-card:active{transform:translateY(-1px)}
.rcjm-thumb{background:#1c2128;width:100%;height:150px;object-fit:cover;display:block}
.rcjm-skel{width:100%;height:150px;background:linear-gradient(90deg,#1c2128 25%,#242a33 37%,#1c2128 63%);background-size:400% 100%;animation:rcjm-shine 1.2s infinite}
@keyframes rcjm-shine{0%{background-position:100% 0}100%{background-position:-100% 0}}
.rcjm-page-img{max-width:560px;width:100%;display:block;margin:8px auto;border:1px solid var(--border);border-radius:6px}
.rcjm-bar{height:6px;background:#1f242c;border-radius:3px;overflow:hidden;margin-top:6px}
.rcjm-bar>div{height:100%;background:var(--accent,#58a6ff);transition:width .3s ease;border-radius:3px}
.rcjm-ch{border-bottom:1px solid var(--border);padding:8px 6px;display:flex;justify-content:space-between;align-items:center;font-size:13px}
.rcjm-ch:hover{background:rgba(58,120,168,.06);transition:background .15s}
.rcjm-tag{display:inline-block;font-size:11px;color:var(--text-muted);background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:1px 8px;margin:2px 4px 0 0}
.rcjm-sticky{position:sticky;top:0;background:var(--bg,#0d1117);z-index:20;padding:8px 0;margin:-2px 0 8px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
`

function mount(container, ctx) {
  const App = {
    data() {
      return { tab: 'search', kw: '', results: [], lib: [], album: null, dl: { status: 'unknown' },
        chapter: null, pages: [], loadIdx: 6, pageIdx: 0, view: 'flow', coverMap: {},
        dlTimer: null, loading: false, loadingMore: false, dlBusy: false, err: '', okMsg: '',
        page: 1, pageCount: 1, loadingCover: new Set(), keyHandler: null, scrollHandler: null }
    },
    mounted() {
      if (!document.getElementById(STYLE_ID)) {
        const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS
        document.head.appendChild(st)
      }
      this.keyHandler = (e) => {
        if (this.tab !== 'read' || this.view !== 'single') return
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.prevPage() }
        if (e.key === 'ArrowRight') { e.preventDefault(); this.nextPage() }
      }
      window.addEventListener('keydown', this.keyHandler)
      this.scrollHandler = () => {
        if (this.tab !== 'read' || this.view !== 'flow') return
        const arr = ((this.chapter || {}).page_arr || [])
        if (this.pages.length >= arr.length || this.loadingMore) return
        if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 700) this.loadMore()
      }
      window.addEventListener('scroll', this.scrollHandler, { passive: true })
    },
    unmounted() {
      clearInterval(this.dlTimer)
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler)
      if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler)
      const st = document.getElementById(STYLE_ID)
      if (st) st.remove()
    },
    methods: {
      async search(p = 1) {
        if (!this.kw.trim() || this.loading) return
        this.loading = true; this.err = ''
        try {
          const r = await ctx.invoke('jmcomic.search', { keyword: this.kw, page: p, mode: 'keyword' })
          this.results = (r && r.items) || []
          this.page = p; this.pageCount = (r && r.page_count) || 1
          this.loadCovers()
        } catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      // 封面懒加载(全部条目, 并发<=4)
      loadCovers() {
        const queue = this.results.map((it) => String(it.id)).filter((id) => !this.coverMap[id] && !this.loadingCover.has(id))
        const run = async () => {
          while (queue.length) {
            const id = queue.shift()
            if (this.coverMap[id]) continue
            this.loadingCover.add(id)
            try {
              const r = await ctx.invoke('jmcomic.cover', { aid: id })
              if (r && r.cover) this.coverMap[id] = r.cover
            } catch (e) { /* 留占位 */ }
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
        if (this.dlBusy) return
        this.dlBusy = true; this.err = ''
        try { await ctx.invoke('jmcomic.download', { aid }); this.okMsg = '已加入下载队列'; this.pollDl(aid, false) }
        catch (e) { this.err = (e && e.message) || e }
        setTimeout(() => { this.dlBusy = false; this.okMsg = '' }, 1500)
      },
      async openChapter(cid, aid) {
        if (this.dl.status !== 'completed') { this.err = '请先完成下载再阅读'; return }
        this.err = ''
        try {
          this.chapter = await ctx.invoke('jmcomic.chapter', { cid, aid })
          this.pages = []; this.pageIdx = 0; this.loadIdx = 6; this.tab = 'read'
          this.view === 'flow' ? this.loadMore() : this.loadOnePage()
          window.scrollTo(0, 0)
        } catch (e) { this.err = (e && e.message) || e }
      },
      setView(v) { this.view = v; this.pageIdx = 0; if (v === 'single') this.loadOnePage() },
      async loadOnePage() {
        const ch = this.chapter || {}
        const arr = ch.page_arr || []
        if (!arr.length) return
        const idx = Math.min(this.pageIdx, arr.length - 1)
        if (this.pages[idx]) return
        try { const r = await ctx.invoke('jmcomic.image', { aid: this.album.id, cid: ch.id, filename: arr[idx] }); this.pages[idx] = r.data } catch (e) { this.pages[idx] = 'err' }
      },
      async loadMore() {
        const ch = this.chapter || {}
        const arr = ch.page_arr || []
        if (!arr.length || this.loadingMore) return
        this.loadingMore = true
        for (const f of arr.slice(this.pages.length, this.loadIdx)) {
          try { const r = await ctx.invoke('jmcomic.image', { aid: this.album.id, cid: ch.id, filename: f }); this.pages.push(r.data) }
          catch (e) { this.pages.push('') }
        }
        this.loadIdx += 6; this.loadingMore = false
      },
      prevPage() { if (this.pageIdx > 0) { this.pageIdx--; this.loadOnePage() } },
      nextPage() { const n = ((this.chapter || {}).page_arr || []).length; if (this.pageIdx < n - 1) { this.pageIdx++; this.loadOnePage() } },
      imgState(i) { return this.pages[i] === undefined ? 'loading' : (this.pages[i] === '' || this.pages[i] === 'err' ? 'err' : 'ok') },
      async loadLib() {
        try {
          const r = await ctx.invoke('jmcomic.library.list', { page: 1, page_size: 60 })
          this.lib = ((r && r.items) || []).map((it) => ({ ...it, id: String(it.id ?? it.aid ?? '') }))
          this.loadCoversFromLib()
        } catch (e) { this.err = (e && e.message) || e }
      },
      loadCoversFromLib() { const saved = this.results; this.results = this.lib; this.loadCovers(); this.results = saved },
      async rm(aid) { try { await ctx.invoke('jmcomic.library.delete', { aid }); this.loadLib() } catch (e) { this.err = (e && e.message) || e } },
      async download(aid) { try { const r = await ctx.invoke('jmcomic.download', { aid }); this.okMsg = r.message; setTimeout(() => (this.okMsg = ''), 2000) } catch (e) { this.err = (e && e.message) || e } },
      async dlStatus(aid) { try { const r = await ctx.invoke('jmcomic.download.status', { aid }); this.okMsg = '已完成 ' + (r.downloaded || 0) + '/' + (r.total || 0) + ' (' + r.status + ')'; setTimeout(() => (this.okMsg = ''), 2500) } catch (e) { this.err = (e && e.message) || e } },
    },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => { this.tab = k; if (k === 'lib') this.loadLib() } }, l)
      // ---- 搜索/本子库: 封面宫格 ----
      const gridItems = this.tab === 'search' ? this.results : this.lib
      const grid = h('div', null, [
        this.tab === 'search'
          ? h('p', { class: 'faint', style: 'font-size:12px;margin:2px 0 8px;' }, this.results.length + ' 条结果 · 第 ' + this.page + '/' + this.pageCount + ' 页')
          : h('p', { class: 'faint', style: 'font-size:12px;margin:2px 0 8px;' }, this.lib.length + ' 本已入库'),
        h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;' },
          gridItems.map((it) => {
            const id = String(it.id ?? it.aid ?? '')
            const cover = this.coverMap[id]
            return h('div', { key: id, class: 'card rcjm-card', style: 'padding:6px;', onclick: () => this.openAlbum(id) }, [
              cover
                ? h('img', { src: cover, loading: 'lazy', class: 'rcjm-thumb' })
                : h('div', { class: 'rcjm-skel' }),
              h('div', { style: 'font-size:12px;margin-top:4px;height:32px;overflow:hidden;line-height:16px;color:var(--text);' }, it.name || ('ID ' + id)),
              h('div', { class: 'faint', style: 'font-size:11px;margin-top:2px;' }, (it.author || '-') + ' · ' + id),
              h('div', { class: 'flex', style: 'gap:4px;margin-top:5px;', onclick: (e) => e.stopPropagation() }, [
                h('button', { class: 'btn btn-sm btn-primary', onclick: () => this.openAlbum(id) }, '详情'),
                this.tab === 'search'
                  ? [h('button', { class: 'btn btn-sm', onclick: () => this.download(id) }, '下载'), h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.dlStatus(id) }, '进度')]
                  : [h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.dlStatus(id) }, '进度'), h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.rm(id) }, '删除')],
              ]),
            ])
          })),
      ])
      let v = null
      // ---- 详情页 ----
      if (this.tab === 'album' && this.album) {
        const a = this.album, dl = this.dl, done = dl.status === 'completed'
        const cover = this.coverMap[a.id]
        const pct = dl.total ? Math.min(100, Math.round((dl.downloaded || 0) / dl.total * 100)) : 0
        const chapters = (a.chapters || []).map((c) => h('div', { key: c.cid, class: 'rcjm-ch' }, [
          h('span', null, c.name || ('章节 ' + c.cid)),
          h('button', { class: 'btn btn-sm' + (done ? ' btn-primary' : ''), disabled: !done, onclick: () => this.openChapter(c.cid, c.aid) }, done ? '阅读' : '需下载'),
        ]))
        const dlBlock = done
          ? h('div', { style: 'display:flex;align-items:center;gap:10px;padding:8px 0;' }, [
              h('span', { style: 'color:var(--success);font-size:13px;' }, '已下载'),
              h('span', { class: 'faint', style: 'font-size:12px;' }, (dl.cached || dl.total || 0) + ' 页'),
              h('button', { class: 'btn btn-sm', onclick: () => this.pollDl(a.id, true) }, '刷新状态'),
            ])
          : h('div', { class: 'section', style: 'margin:8px 0;padding:12px;' }, [
              h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;' }, [
                h('span', { style: 'font-size:13px;color:var(--text-muted);' }, dl.total ? '下载中: ' + (dl.downloaded || 0) + '/' + dl.total + ' 页 (' + pct + '%)' : '尚未下载，下载后解锁章节与阅读'),
                h('button', { class: 'btn btn-primary', disabled: this.dlBusy, onclick: () => this.startDownload(a.id) }, this.dlBusy ? '提交中…' : '先下载本子'),
              ]),
              dl.total ? h('div', { class: 'rcjm-bar' }, h('div', { style: 'width:' + pct + '%' })) : null,
            ])
        v = h('div', null, [
          h('div', { class: 'flex', style: 'gap:12px;align-items:flex-start;' }, [
            cover
              ? h('img', { src: cover, style: 'width:110px;height:156px;object-fit:cover;border-radius:8px;background:#222;box-shadow:0 4px 14px rgba(0,0,0,.4);' })
              : h('div', { class: 'rcjm-skel', style: 'width:110px;height:156px;border-radius:8px;' }),
            h('div', { style: 'flex:1;min-width:0;' }, [
              h('h3', { style: 'margin:0;font-size:16px;line-height:1.4;' }, a.name),
              h('p', { class: 'faint', style: 'font-size:12px;margin:4px 0;' }, '作者 ' + (a.author || '未知') + ' · ID ' + a.id + ' · ' + (a.chapters || []).length + ' 章'),
              h('div', null, (a.tags || []).slice(0, 8).map((tg) => h('span', { class: 'rcjm-tag' }, tg))),
            ]),
          ]),
          h('div', { class: 'flex', style: 'gap:6px;margin:10px 0;' }, [
            h('button', { class: 'btn btn-sm', onclick: () => { this.tab = this.tab === 'album' ? 'search' : 'album' } }, '返回列表'),
          ]),
          dlBlock,
          h('div', { class: 'section', style: 'padding:4px 12px 8px;' }, [
            h('div', { class: 'section-title', style: 'margin-top:6px;' }, '章节' + (done ? '' : '（下载后解锁）')),
            chapters,
          ]),
        ])
      }
      // ---- 阅读器 ----
      if (this.tab === 'read' && this.chapter) {
        const ch = this.chapter, arr = ch.page_arr || []
        const toolbar = h('div', { class: 'rcjm-sticky' }, [
          h('button', { class: 'btn btn-sm', onclick: () => { this.tab = 'album' } }, '返回详情'),
          h('span', { class: 'faint', style: 'font-size:12px;' }, (ch.name || ('章节 ' + ch.id)) + ' · ' + arr.length + ' 页'),
          h('div', { style: 'margin-left:auto;display:flex;gap:2px;' }, [
            h('button', { class: 'btn btn-sm' + (this.view === 'flow' ? ' btn-primary' : ''), onclick: () => this.setView('flow') }, '滚动'),
            h('button', { class: 'btn btn-sm' + (this.view === 'single' ? ' btn-primary' : ''), onclick: () => this.setView('single') }, '单页'),
          ]),
        ])
        if (this.view === 'flow') {
          v = h('div', null, [
            toolbar,
            this.pages.map((d, i) => {
              if (this.imgState(i) === 'ok') return h('img', { key: i, src: d, loading: 'lazy', class: 'rcjm-page-img' })
              if (this.imgState(i) === 'err') return h('div', { key: i, style: 'width:100%;max-width:520px;height:180px;margin:8px auto;background:#1c2128;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;border-radius:6px;' }, '图片加载失败')
              return h('div', { key: i, class: 'rcjm-skel', style: 'width:100%;max-width:520px;height:200px;margin:8px auto;border-radius:6px;' })
            }),
            h('div', { style: 'text-align:center;padding:16px;' }, this.pages.length < arr.length
              ? h('button', { class: 'btn', disabled: this.loadingMore, onclick: () => this.loadMore() }, this.loadingMore ? '加载中…' : '加载更多（' + this.pages.length + '/' + arr.length + '）')
              : h('span', { class: 'faint', style: 'font-size:12px;' }, '已全部加载（' + arr.length + ' 页）')),
          ])
        } else {
          const st = this.imgState(this.pageIdx)
          const img = this.pages[this.pageIdx]
          let imgNode
          if (st === 'ok') imgNode = h('img', { src: img, class: 'rcjm-page-img', style: 'max-width:640px;min-height:140px;' })
          else if (st === 'err') imgNode = h('div', { style: 'max-width:640px;height:220px;margin:8px auto;background:#1c2128;display:flex;align-items:center;justify-content:center;color:#666;' }, '图片加载失败')
          else imgNode = h('div', { class: 'rcjm-skel', style: 'max-width:640px;height:260px;margin:8px auto;border-radius:8px;' })
          v = h('div', null, [
            toolbar,
            h('div', { style: 'display:flex;justify-content:center;align-items:center;gap:12px;margin:6px 0;' }, [
              h('button', { class: 'btn btn-sm', disabled: this.pageIdx <= 0, onclick: () => this.prevPage() }, '上一页'),
              h('span', { class: 'faint', style: 'font-size:13px;' }, (this.pageIdx + 1) + ' / ' + arr.length),
              h('button', { class: 'btn btn-sm', disabled: this.pageIdx >= arr.length - 1, onclick: () => this.nextPage() }, '下一页'),
            ]),
            h('div', { style: 'position:relative;cursor:pointer;', onclick: (e) => {
              const r = e.currentTarget.getBoundingClientRect()
              if (e.clientX < r.left + r.width / 3) this.prevPage()
              else if (e.clientX > r.left + (r.width / 3) * 2) this.nextPage()
            } }, imgNode),
            h('p', { class: 'faint', style: 'font-size:11px;text-align:center;' }, '点击图片左右区域翻页，键盘方向键翻页'),
          ])
        }
      }
      // ---- 汇总 ----
      const head = h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;align-items:center;' }, [
        h('span', null, 'JMComic'),
        h('div', { class: 'flex', style: 'gap:6px;' }, [t('search', '搜索'), t('lib', '本子库')]),
      ])
      const searchBar = this.tab === 'search'
        ? h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '输入关键词，回车或点击搜索', value: this.kw, oninput: (e) => (this.kw = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.search() } }),
            h('button', { class: 'btn btn-primary', disabled: this.loading, onclick: () => this.search() }, this.loading ? '搜索中…' : '搜索'),
            h('button', { class: 'btn btn-sm', disabled: this.loading || this.page <= 1, onclick: () => this.search(this.page - 1) }, '上一页'),
            h('button', { class: 'btn btn-sm', disabled: this.loading || this.page >= this.pageCount, onclick: () => this.search(this.page + 1) }, '下一页'),
          ])
        : null
      const statusLine = this.okMsg
        ? h('p', { style: 'color:var(--success);font-size:12px;margin:4px 0;' }, this.okMsg)
        : null
      const body = (this.tab === 'album' || this.tab === 'read') ? v : grid
      return h('div', null, [head, statusLine, this.err ? h('p', { style: 'color:var(--danger);font-size:12px;margin:4px 0;' }, this.err) : null, searchBar, body])
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