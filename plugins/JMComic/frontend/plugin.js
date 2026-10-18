// JMComic 插件前端(接口库 v4): 性能加强版
// 搜索: 防抖自动搜/骨架/最近搜索/翻页预取/批量封面; 阅读: 静态URL直出/prefetch预取/前后页预载
import { createApp, h } from 'vue'

const NAME = 'JMComic'
/**
 * 封面最多轮询多少次。
 *
 * ★ 必须和轮询间隔一起看：这个值是**次数**，不是时长。
 *   轮询从 2s 改到 0.7s 后，15 次只覆盖 10.5 秒 —— 而这里生成一张封面
 *   要 40 秒以上，结果就是「前几张出来了，后面的被提前放弃、永远不显示」。
 *   按 0.7s × 260 ≈ 3 分钟算，足够覆盖一批封面的完整生成。
 */
const MAX_COVER_POLL = 260

const STYLE_ID = 'rc-jmcomic-style'
const RECENT_KEY = 'rc_jmcomic_recent'

const CSS = `
.rcjm-card{transition:transform .15s ease, box-shadow .15s ease;cursor:pointer}
.rcjm-card:hover{transform:translateY(-3px);box-shadow:0 6px 18px rgba(0,0,0,.35)}
.rcjm-card:active{transform:translateY(-1px)}
.rcjm-thumb{background:#1c2128;width:100%;height:150px;object-fit:cover;display:block}
.rcjm-skel{width:100%;height:150px;background:linear-gradient(90deg,#1c2128 25%,#242a33 37%,#1c2128 63%);background-size:400% 100%;animation:rcjm-shine 1.2s infinite}
@keyframes rcjm-shine{0%{background-position:100% 0}100%{background-position:-100% 0}}
.rcjm-page-img{max-width:560px;width:100%;display:block;margin:10px auto;border:1px solid var(--border);border-radius:6px}
.rcjm-bar{height:6px;background:#1f242c;border-radius:3px;overflow:hidden;margin-top:6px}
.rcjm-bar>div{height:100%;background:var(--accent,#58a6ff);transition:width .3s ease;border-radius:3px}
.rcjm-ch{border-bottom:1px solid var(--border);padding:8px 6px;display:flex;justify-content:space-between;align-items:center;font-size:13px}
.rcjm-ch:hover{background:rgba(58,120,168,.06);transition:background .15s}
.rcjm-tag{display:inline-block;font-size:11px;color:var(--text-muted);background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:1px 8px;margin:2px 4px 0 0}
.rcjm-sticky{position:sticky;top:0;background:var(--bg,#0d1117);z-index:20;padding:8px 0;margin:-2px 0 8px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.rcjm-recent{display:inline-block;font-size:11px;padding:2px 10px;border:1px solid var(--border);border-radius:12px;margin:2px 6px 0 0;color:var(--text-muted);cursor:pointer}
.rcjm-recent:hover{border-color:var(--accent);color:var(--accent)}
`

function mount(container, ctx) {
  const App = {
    data() {
      return { tab: 'search', kw: '', results: [], lib: [], album: null, dl: { status: 'unknown' },
        chapter: null, pages: [], pageArr: [], pageIdx: 0, view: 'flow', coverMap: {},
        dlTimer: null, searchTimer: null, loading: false, loadingMore: false, dlBusy: false,
        descOpen: false, err: '', okMsg: '', page: 1, pageCount: 1, recent: [],
        coverQueueStop: false, coverLoaded: 0, coverLoadedLib: 0, searchMs: 0, keyHandler: null, scrollRaf: null, scrollHandler: null,
        // 封面重试状态：
        // coverPending  —— 本轮请求过但没拿到封面的 aid（服务端是渐进生成的，可能只是还没生成好）
        // coverErrCount —— <img> 加载失败次数（用于绕过浏览器缓存重试）
        // coverTimer    —— 定时重试 pending 的计时器
        coverPending: {}, coverErrCount: {}, coverTimer: null, coverLoading: false,
        // coverGiveUp：服务端确认拿不到封面的 aid，UI 跳过它们不再重试
        coverGiveUp: {}, coverRetryCursor: 0,
        coverPrefetchTimer: null,
        prefetchIdx: 0 }
    },
    mounted() {
      if (!document.getElementById(STYLE_ID)) {
        const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS
        document.head.appendChild(st)
      }
      try { this.recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch (e) { this.recent = [] }
      this.keyHandler = (e) => {
        if (this.tab !== 'read' || this.view !== 'single') return
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.prevPage() }
        if (e.key === 'ArrowRight') { e.preventDefault(); this.nextPage() }
      }
      window.addEventListener('keydown', this.keyHandler)
      this.scrollHandler = () => {
        if (this.scrollRaf) return
        this.scrollRaf = requestAnimationFrame(() => {
          this.scrollRaf = null
          if (this.tab === 'read' && this.view === 'flow') {
            const total = this.pageArr.length
            if (this.prefetchIdx < total && !this.loadingMore && this.nearBottom(700)) this.prefetchNext()
          }
        })
      }
      // ★ 必须 capture：面板的内容区是 <main class="content" style="overflow-y:auto">，
      //   滚动发生在它身上而不是 window。scroll 事件不冒泡，只有捕获阶段能拿到。
      window.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true })

      // 封面是服务端按需生成的，一个要 1~2 秒（3 次网络请求）。
      // 首批 4s 必然拿不全，所以每 2 秒轮询一次（cached_only，纯读文件），
      // 哪张生成好了就显示哪张。最多轮询 30 秒。
      // 700ms 一轮。cached_only 查询是纯文件 stat（实测 0.86ms），
      // 这个频率对服务器几乎无成本，换来的是「生成完立刻可见」。
      // 原来 2s 一轮，用户会觉得"明明好了却不显示"。
      // 心跳只做一件事：把「已请求但还没生成好」的那些重新查一遍。
      // 封面加载本身是搜索后一次性全请求的，不依赖滚动、也不在这里分批推进。
      this.coverTimer = setInterval(() => {
        if (this.tab !== 'search' && this.tab !== 'lib') return
        if (Object.keys(this.coverPending).length) this.retryPendingCovers()
      }, 700)
    },
    unmounted() {
      clearInterval(this.dlTimer); clearTimeout(this.searchTimer); clearInterval(this.coverTimer); this.stopCoverPrefetch()
      this.coverQueueStop = true
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler)
      if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler, { capture: true })
      if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf)
      const st = document.getElementById(STYLE_ID)
      if (st) st.remove()
    },
    methods: {
      // ---------- 搜索 ----------
      onKwInput(e) {
        this.kw = e.target.value
        clearTimeout(this.searchTimer)
        if (this.kw.trim().length) {
          this.searchTimer = setTimeout(() => this.search(1), 300)
        } else {
          this.results = []; this.coverQueueStop = true
        }
      },
      clearKw() { clearTimeout(this.searchTimer); this.kw = ''; this.results = []; this.coverQueueStop = true; this.coverLoaded = 0 },
      saveRecent() {
        const kw = this.kw.trim()
        if (!kw) return
        const r = [kw].concat(this.recent.filter((x) => x !== kw)).slice(0, 10)
        this.recent = r
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)) } catch (e) {}
      },
      delRecent(kw) { this.recent = this.recent.filter((x) => x !== kw); try { localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent)) } catch (e) {} },
      async search(p = 1) {
        if (!this.kw.trim() || this.loading) return
        clearTimeout(this.searchTimer)
        this.loading = true; this.err = ''; this.coverQueueStop = true
        const t0 = Date.now()
        try {
          const r = await ctx.invoke('jmcomic.search', { keyword: this.kw, page: p, mode: 'keyword' })
          this.results = (r && r.items) || []
          this.page = p; this.pageCount = (r && r.page_count) || 1
          this.searchMs = Date.now() - t0
          this.saveRecent()
          // 换了一批结果：清掉旧的重试队列（coverMap 保留，已取到的不用重取）
          this.coverPending = {}
          this.coverGiveUp = {}
          this.coverRetryCursor = 0
          // 一次性加载界面上所有封面（不依赖滚动）
          this.loadAllCovers()
        } catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      jumpPage(p) {
        if (!p || p < 1 || p > this.pageCount || p === this.page) return
        this.search(p)
      },
      // 封面: 批量 covers(首屏1批开取, 滚动续补)
      //
      // ★ 修掉一个会让封面永久不显示的 bug：
      //   原来只把 coverLoaded 往前推，**没拿到封面的 aid 就此被跳过**，
      //   之后无论是滚动还是重新搜索都不会再为它请求。
      //   服务端改成渐进返回（最多等 4s）之后，这个漏洞被放大 ——
      //   首屏 12 个里只生成了 5 个，另外 7 个就永远空着。
      //   现在把没拿到的记进 coverPending，由定时器重试。
      // 找到真正的滚动容器（面板布局是 <main class="content"> overflow-y:auto）
      findScroller() {
        let el = this.$el ? this.$el.parentElement : null
        while (el && el !== document.body) {
          const oy = getComputedStyle(el).overflowY
          if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 10) return el
          el = el.parentElement
        }
        return null
      },
      // 是否接近底部（兼容「内容区自己滚」和「整页滚」两种布局）
      nearBottom(threshold) {
        const sc = this.findScroller()
        if (sc) return sc.scrollTop + sc.clientHeight >= sc.scrollHeight - threshold
        return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold
      },
      async fetchCovers(aids, cachedOnly) {
        const list = aids.map(String)
        try {
          // cachedOnly=true: 只查已生成的，不触发生成也不等 —— 轮询用
          const r = await ctx.invoke('jmcomic.covers', { aids: list, cached_only: !!cachedOnly })
          const covers = (r && r.covers) || {}
          for (const k in covers) {
            if (!this.coverMap[k]) this.coverMap[k] = covers[k]
            delete this.coverPending[k]
          }
          // 服务端明确说这些位置拿不到封面（本子没图/取图失败）：
          // 标记放弃，让顺序门控跳过它们，否则会一直堵着后面的
          for (const a of ((r && r.failed) || [])) {
            this.coverGiveUp[String(a)] = true
            delete this.coverPending[String(a)]
          }
        } catch (e) { /* 批取失败：全部进重试队列 */ }
        for (const a of list) {
          if (this.coverMap[a]) { delete this.coverPending[a]; continue }
          // 已判定拿不到的不再重试（否则删了又被加回来，白耗请求）
          if (this.coverGiveUp[a]) { delete this.coverPending[a]; continue }
          const n = (this.coverPending[a] || 0) + 1
          // 最多轮询 MAX_COVER_POLL 次（每次 2s ≈ 30s），避免真的没封面的本子无限重试
          if (n <= MAX_COVER_POLL) this.coverPending[a] = n
          else delete this.coverPending[a]
        }
      },
      /**
       * 一次性把界面上**所有**位置的封面都请求掉。
       *
       * ★ 不做任何"滚动检测 / 分批延迟"：
       *   用户要求「不需要滚动检测加载封面，直接加载界面的所有封面图片资源」。
       *
       *   服务端单次最多收 60 个 aid，所以按 60 分组、**并发**发出（不等待）。
       *   每组内部：先 cached_only 查（毫秒级，已缓存的立即显示），
       *   再触发生成（fire-and-forget）。
       */
      loadAllCovers() {
        this.stopCoverPrefetch()
        const items = this.tab === 'search' ? this.results : this.lib
        if (!items || !items.length) return
        const aids = items.map((it) => String(it.id ?? it.aid ?? ''))
        const groups = []
        for (let i = 0; i < aids.length; i += 60) groups.push(aids.slice(i, i + 60))

        // 第一步：并发查所有组「现在就能显示的」——把已缓存的全列出来
        groups.forEach((g) => { this.fetchCovers(g, true) })
        // 第二步：触发服务端生成缺的那些（不等结果）
        //
        // ★ 不要在客户端判断"是否有下载在跑"：
        //   `this.dl` 是**详情页**的状态，在列表页它可能是上次残留的 downloading，
        //   导致这里被永久跳过 —— 表现为"只有前 12 个位置有封面，其余全是骨架"。
        //   是否让路由服务端统一判断（jm_covers 里查 Downloader.is_busy()）。
        groups.forEach((g) => {
          ctx.invoke('jmcomic.covers', { aids: g }).catch(() => {})
        })
      },
      stopCoverPrefetch() {
        if (this.coverPrefetchTimer !== null) {
          clearInterval(this.coverPrefetchTimer)
          this.coverPrefetchTimer = null
        }
      },
      async retryPendingCovers() {
        // 已经拿到或超过重试次数的先清掉
        for (const a in this.coverPending) {
          if (this.coverMap[a] || this.coverPending[a] > MAX_COVER_POLL) delete this.coverPending[a]
        }
        const all = Object.keys(this.coverPending)
        if (!all.length) { this.coverRetryCursor = 0; return }

        // ★ 必须轮转，不能每次都取「前 N 个」。
        //   原来固定 slice(0, 24)：待处理超过 24 个时（快速滚动很容易攒到 36+），
        //   排在后面的**永远轮不到**——表现就是"最下面两排长时间不加载"。
        //   现在用游标环形推进，任何一项最多等 pending 总数/批大小 轮就会轮到。
        const BATCH = 60              // 与服务端 aids[:60] 上限一致
        const start = (this.coverRetryCursor || 0) % Math.max(all.length, 1)
        const aids = []
        for (let i = 0; i < Math.min(BATCH, all.length); i++) {
          aids.push(all[(start + i) % all.length])
        }
        this.coverRetryCursor = (start + aids.length) % Math.max(all.length, 1)

        // 只查不生成：服务端后台还在跑，这里纯读文件，几乎不耗时
        await this.fetchCovers(aids, true)
      },
      // 图片加载失败兜底：可能是浏览器缓存了之前的 404（图片长缓存 + immutable）。
      // 加一个一次性参数强制回源，最多试两次。
      onCoverErr(e, id) {
        const url = this.coverMap[id]
        if (!url) return
        const n = (this.coverErrCount[id] || 0) + 1
        this.coverErrCount[id] = n
        if (n > 2) { if (e && e.target) e.target.style.visibility = 'hidden'; return }
        if (e && e.target) e.target.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'r=' + Date.now()
      },
      // ---------- 详情 ----------
      async openAlbum(aid) {
        this.err = ''
        try {
          const [a, st, cv] = await Promise.all([
            ctx.invoke('jmcomic.album', { aid: aid }),
            ctx.invoke('jmcomic.dl.status', { aid: aid }),
            ctx.invoke('jmcomic.cover', { aid: aid }).catch(() => null),
          ])
          this.album = a
          // 新下载器的 task 结构；没有任务时给个空壳，渲染不用到处判空
          this.dl = (st && st.task) || { status: 'none', done_pages: 0, total_pages: 0 }
          if (cv && cv.cover) this.coverMap[String(aid)] = cv.cover
          this.tab = 'album'; this.chapter = null; this.pages = []; this.pageIdx = 0; this.view = 'flow'
          if (this.dl.status !== 'completed' && this.dl.status !== 'failed' && this.dl.status !== 'cancelled') this.pollDl(aid, false)
        } catch (e) { this.err = (e && e.message) || e }
      },
      async pollDl(aid, once = false) {
        clearInterval(this.dlTimer)
        const tick = async () => {
          try {
            const r = await ctx.invoke('jmcomic.dl.status', { aid })
            if (r && r.task) this.dl = r.task
            // 终态才停轮询：paused 也要停（继续时手动重启轮询），否则白耗请求
            if (['completed', 'failed', 'cancelled', 'paused'].includes(this.dl.status)) {
              clearInterval(this.dlTimer)
            }
          } catch (e) { clearInterval(this.dlTimer) }
        }
        await tick()
        if (!once && !['completed', 'failed', 'cancelled', 'paused'].includes(this.dl.status)) {
          this.dlTimer = setInterval(tick, 2000)
        }
      },
      async startDownload(aid) {
        if (this.dlBusy) return
        this.dlBusy = true; this.err = ''
        try {
          const r = await ctx.invoke('jmcomic.dl.start', {
            aid, name: (this.album && this.album.name) || '', workers: 6,
          })
          if (r && r.task) this.dl = r.task
          this.okMsg = '开始下载'
          this.pollDl(aid, false)
        } catch (e) { this.err = (e && e.message) || e }
        setTimeout(() => { this.dlBusy = false; this.okMsg = '' }, 1200)
      },
      async pauseDownload(aid) {
        try {
          await ctx.invoke('jmcomic.dl.pause', { aid })
          this.okMsg = '已暂停，可随时继续'
          this.pollDl(aid, true)
        } catch (e) { this.err = (e && e.message) || e }
        setTimeout(() => { this.okMsg = '' }, 1500)
      },
      async resumeDownload(aid) {
        try {
          const r = await ctx.invoke('jmcomic.dl.resume', { aid })
          if (r && r.task) this.dl = r.task
          this.okMsg = '继续下载（已完成的页会跳过）'
          this.pollDl(aid, false)
        } catch (e) { this.err = (e && e.message) || e }
        setTimeout(() => { this.okMsg = '' }, 1500)
      },
      async retryFailed(aid) {
        try {
          const r = await ctx.invoke('jmcomic.dl.retry_failed', { aid })
          if (r && r.task) this.dl = r.task
          this.okMsg = '正在补下失败的页'
          this.pollDl(aid, false)
        } catch (e) { this.err = (e && e.message) || e }
        setTimeout(() => { this.okMsg = '' }, 1500)
      },
      async cancelDownload(aid) {
        this.err = ''
        try {
          await ctx.invoke('jmcomic.dl.cancel', { aid })
          this.dl = { ...(this.dl || {}), status: 'cancelled' }
          this.pollDl(aid, true)
        } catch (e) { this.err = (e && e.message) || e }
      },
      // ---------- 阅读 ----------
      async openChapter(cid, aid) {
        if (this.dl.status !== 'completed') { this.err = '请先完成下载再阅读'; return }
        this.err = ''
        try {
          const ch = await ctx.invoke('jmcomic.chapter', { cid, aid })
          this.chapter = ch; this.pageArr = (ch && ch.page_arr) || []
          this.pages = []; this.pageIdx = 0; this.prefetchIdx = 0; this.tab = 'read'
          this.view === 'flow' ? this.prefetchNext() : this.loadPageAt(0)
          window.scrollTo(0, 0)
        } catch (e) { this.err = (e && e.message) || e }
      },
      setView(v) { this.view = v; if (v === 'single') { this.loadPageAt(this.pageIdx); this.loadPageAt(this.pageIdx + 1) } },
      prefetchNext() {
        const total = this.pageArr.length
        if (this.prefetchIdx >= total || this.loadingMore) return
        this.loadingMore = true
        const start = this.prefetchIdx
        const cid = this.chapter.id
        ctx.invoke('jmcomic.prefetch', { aid: this.album.id, cid: cid, start: start, count: 12 })
          .then((r) => {
            const urls = (r && r.urls) || []
            urls.forEach((u, i) => { const idx = start + i; if (idx < this.pageArr.length && u) this.pages[idx] = u })
            this.prefetchIdx = start + 12
          })
          .catch(() => { this.prefetchIdx = start + 12; this.pages.length = Math.max(this.pages.length, Math.min(start + 6, total)) })
          .finally(() => { this.loadingMore = false })
      },
      async loadPageAt(i) {
        if (i < 0 || i >= this.pageArr.length || this.pages[i]) return
        try {
          const r = await ctx.invoke('jmcomic.image', { aid: this.album.id, cid: this.chapter.id, filename: this.pageArr[i] })
          if (r && r.url) this.pages[i] = r.url
        } catch (e) { this.pages[i] = 'err' }
      },
      prevPage() { if (this.pageIdx > 0) { this.pageIdx--; this.loadPageAt(this.pageIdx) } },
      nextPage() { const n = this.pageArr.length; if (this.pageIdx < n - 1) { this.pageIdx++; this.loadPageAt(this.pageIdx) } },
      imgState(i) { return this.pages[i] === undefined ? 'loading' : (this.pages[i] === '' || this.pages[i] === 'err' ? 'err' : 'ok') },
      // ---------- 库 ----------
      async loadLib() {
        try {
          const r = await ctx.invoke('jmcomic.library.list', { page: 1, page_size: 60 })
          this.lib = ((r && r.items) || []).map((it) => ({ ...it, id: String(it.id ?? it.aid ?? '') })); this.coverLoadedLib = 0
          this.coverGiveUp = {}
          this.loadAllCovers()
        } catch (e) { this.err = (e && e.message) || e }
      },
      async rm(aid) {
        try {
          await ctx.invoke('jmcomic.library.delete', { aid })
          this.lib = this.lib.filter((it) => String(it.id ?? it.aid) !== String(aid))
          delete this.coverMap[String(aid)]
          this.okMsg = '已删除 ' + aid; setTimeout(() => (this.okMsg = ''), 2000)
          this.loadLib()
        } catch (e) { this.err = (e && e.message) || e }
      },
      async download(aid) { try { const r = await ctx.invoke('jmcomic.download', { aid }); this.okMsg = r.message; setTimeout(() => (this.okMsg = ''), 2000) } catch (e) { this.err = (e && e.message) || e } },
      async dlStatus(aid) { try { const r = await ctx.invoke('jmcomic.download.status', { aid }); this.okMsg = '完成 ' + (r.downloaded || 0) + '/' + (r.total || '?') + ' (' + r.status + ')'; setTimeout(() => (this.okMsg = ''), 2500) } catch (e) { this.err = (e && e.message) || e } },
    },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => { clearInterval(this.dlTimer); this.coverQueueStop = true; this.stopCoverPrefetch(); this.tab = k; if (k === 'lib') this.loadLib() } }, l)
      // ---- 搜索/本子库宫格 ----
      const gridItems = this.tab === 'search' ? this.results : this.lib
      let grid
      if (this.loading && !gridItems.length) {
        grid = h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;' },
          Array.from({ length: 12 }).map((_, i) => h('div', { key: 's' + i, class: 'card', style: 'padding:6px;' }, h('div', { class: 'rcjm-skel' }))))
      } else {
        grid = h('div', null, [
          h('p', { class: 'faint', style: 'font-size:12px;margin:2px 0 8px;' }, this.tab === 'search'
            ? this.results.length + ' 条结果 · 第 ' + this.page + '/' + this.pageCount + ' 页' + (this.searchMs ? ' · ' + (this.searchMs / 1000).toFixed(1) + 's' : '')
            : this.lib.length + ' 本已入库'),
          h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;' },
            gridItems.map((it, gi) => {
              const id = String(it.id ?? it.aid ?? '')
              // 每个位置独立显示：谁就绪谁先出图，不再等前面的。
              // 服务端按顺序生成，所以视觉上仍是从上往下依次填充；
              // 但不会出现「第 2 个已就绪却因为第 1 个没好而一直空着」。
              const cover = this.coverMap[id]
              return h('div', { key: id, class: 'card rcjm-card', style: 'padding:6px;', onclick: () => this.openAlbum(id) }, [
                cover
                  ? h('img', { src: cover, loading: 'lazy', class: 'rcjm-thumb', onerror: (e) => this.onCoverErr(e, id) })
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
      }
      let v = null
      // ---- 详情 ----
      if (this.tab === 'album' && this.album) {
        const a = this.album, dl = this.dl, done = (dl.status === 'completed')
        const cancelling = dl.status === 'cancelling' || (dl.status === 'downloading' && dl.cancel)
        const cancelled = dl.status === 'cancelled'
        const cover = this.coverMap[a.id]
        const pct = dl.total ? Math.min(100, Math.round((dl.downloaded || 0) / dl.total * 100)) : 0
        const first = (a.chapters || [])[0]
        const chapters = (a.chapters || []).map((c, ci) => h('div', { key: c.cid, class: 'rcjm-ch' }, [
          h('span', null, '第 ' + (ci + 1) + ' 话' + (c.name && !('第' + (ci + 1) + '话').includes(c.name) ? ' · ' + c.name : '')),
          h('button', { class: 'btn btn-sm' + (done ? ' btn-primary' : ''), disabled: !done, onclick: () => this.openChapter(c.cid, c.aid) }, done ? '阅读' : '需下载'),
        ]))
        const statItems = []
        if (a.views) statItems.push('浏览 ' + a.views)
        if (a.likes) statItems.push('点赞 ' + a.likes)
        if (a.comment_count) statItems.push('评论 ' + a.comment_count)
        if (a.page_count) statItems.push('全本 ' + a.page_count + ' 页')
        const desc = a.description || ''
        const descShort = desc.length > 220
        const showDesc = descShort && !this.descOpen ? desc.slice(0, 220) + '…' : desc
        let dlBlock
        // 统一从新下载器的 task 取字段
        const st = dl.status || 'none'
        const dPages = dl.done_pages || 0
        const tPages = dl.total_pages || 0
        const pct2 = dl.progress != null ? dl.progress : (tPages ? Math.round(dPages / tPages * 100) : 0)
        const spKB = Math.round((dl.speed_bps || 0) / 1024)
        const eta = dl.eta_sec || 0
        const etaTxt = eta > 0 ? (Math.floor(eta / 60) + 'm' + String(eta % 60).padStart(2, '0') + 's') : ''
        const fCnt = dl.failed_count || 0
        const wrap = (inner, tone) => h('div', {
          style: 'padding:10px 12px;border-radius:8px;' + ({
            ok: 'background:rgba(46,158,91,.08);border:1px solid rgba(46,158,91,.35);',
            run: 'background:rgba(58,120,168,.08);border:1px solid rgba(58,120,168,.35);',
            warn: 'background:rgba(214,158,46,.10);border:1px solid rgba(214,158,46,.4);',
            err: 'background:rgba(217,82,78,.06);border:1px solid rgba(217,82,78,.3);',
            idle: 'background:rgba(217,82,78,.06);border:1px solid rgba(217,82,78,.3);',
          }[tone] || ''),
        }, inner)

        if (st === 'completed') {
          dlBlock = wrap([
            h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' }, [
              h('span', { style: 'color:var(--success);font-size:13px;font-weight:600;' }, '已下载'),
              h('span', { class: 'faint', style: 'font-size:12px;' }, tPages + ' 页'),
              first ? h('button', { class: 'btn btn-primary btn-sm', onclick: () => this.openChapter(first.cid, first.aid) }, '开始阅读（第 1 话）') : null,
            ]),
          ], 'ok')
        } else if (st === 'downloading' || st === 'queued') {
          dlBlock = wrap([
            h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;' }, [
              h('div', null, [
                h('div', { style: 'font-size:13px;color:var(--text);font-weight:600;' },
                  st === 'queued' ? ('排队中 · ' + (dl.current || '准备…')) : ('下载中 ' + dPages + '/' + tPages + ' 页')),
                h('div', { class: 'faint', style: 'font-size:11px;margin-top:2px;' },
                  (st === 'queued' ? '' : (pct2 + '% · '))
                  + (spKB > 0 ? spKB + ' KB/s' : '')
                  + (etaTxt ? (' · 剩余 ' + etaTxt) : '')
                  + (fCnt ? (' · 失败 ' + fCnt + ' 页') : '')),
              ]),
              h('div', { style: 'display:flex;gap:6px;' }, [
                h('button', { class: 'btn btn-sm', onclick: () => this.pauseDownload(a.id) }, '暂停'),
                h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.cancelDownload(a.id) }, '取消'),
              ]),
            ]),
            h('div', { class: 'rcjm-bar' }, h('div', { style: 'width:' + Math.max(1, pct2) + '%' })),
          ], 'run')
        } else if (st === 'paused') {
          dlBlock = wrap([
            h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;' }, [
              h('div', null, [
                h('div', { style: 'font-size:13px;color:var(--text);font-weight:600;' }, '已暂停'),
                h('div', { class: 'faint', style: 'font-size:11px;margin-top:2px;' },
                  dPages + '/' + tPages + ' 页已完成，继续时会跳过这些页'),
              ]),
              h('button', { class: 'btn btn-primary btn-sm', onclick: () => this.resumeDownload(a.id) }, '继续下载'),
            ]),
            h('div', { class: 'rcjm-bar' }, h('div', { style: 'width:' + Math.max(1, pct2) + '%' })),
          ], 'warn')
        } else if (st === 'failed') {
          dlBlock = wrap([
            h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;' }, [
              h('div', null, [
                h('div', { style: 'font-size:13px;color:var(--error,#d9524e);font-weight:600;' },
                  '下载未完成 · ' + dPages + '/' + tPages + ' 页'),
                h('div', { class: 'faint', style: 'font-size:11px;margin-top:2px;' },
                  (fCnt ? (fCnt + ' 页失败') : '') + (dl.error ? ('　' + dl.error) : '')),
              ]),
              h('div', { style: 'display:flex;gap:6px;' }, [
                h('button', { class: 'btn btn-primary btn-sm', onclick: () => this.retryFailed(a.id) }, '只补失败'),
                h('button', { class: 'btn btn-sm', onclick: () => this.resumeDownload(a.id) }, '全部续传'),
              ]),
            ]),
            h('div', { class: 'rcjm-bar' }, h('div', { style: 'width:' + Math.max(1, pct2) + '%' })),
          ], 'err')
        } else if (st === 'cancelled') {
          dlBlock = wrap([
            h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;' }, [
              h('span', { style: 'font-size:13px;color:var(--text-muted);' },
                '已取消' + (dPages ? ('（已下 ' + dPages + ' 页会保留）') : '')),
              h('button', { class: 'btn btn-primary btn-sm', onclick: () => this.startDownload(a.id) }, '重新下载'),
            ]),
          ], 'err')
        } else {
          dlBlock = wrap([
            h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;' }, [
              h('span', { style: 'font-size:13px;color:var(--text-muted);' }, '尚未下载到本地，下载后可离线阅读'),
              h('button', { class: 'btn btn-primary', disabled: this.dlBusy, onclick: () => this.startDownload(a.id) },
                this.dlBusy ? '提交中…' : '下载整本'),
            ]),
          ], 'idle')
        }
        const related = (a.related || []).slice(0, 8)
        v = h('div', null, [
          h('div', { class: 'rcjm-sticky' }, [
            h('button', { class: 'btn btn-sm', onclick: () => { clearInterval(this.dlTimer); this.tab = 'search' } }, '返回列表'),
            h('span', { class: 'faint', style: 'font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40%;' }, this.kw ? this.kw + ' 的搜索结果' : '本子库'),
            h('span', { class: 'faint', style: 'font-size:12px;' }, '> 本子详情'),
            h('button', { class: 'btn btn-sm', style: 'margin-left:auto;', onclick: () => this.pollDl(a.id, true) }, '刷新状态'),
          ]),
          h('div', { class: 'section', style: 'padding:14px;' }, [
            h('div', { class: 'flex', style: 'gap:14px;align-items:flex-start;' }, [
              cover
                ? h('img', { src: cover, onerror: (e) => this.onCoverErr(e, a.id), style: 'width:134px;height:200px;object-fit:cover;border-radius:8px;background:#222;box-shadow:0 4px 14px rgba(0,0,0,.4);' })
                : h('div', { class: 'rcjm-skel', style: 'width:134px;height:200px;border-radius:8px;' }),
              h('div', { style: 'flex:1;min-width:0;' }, [
                h('h3', { style: 'margin:0;font-size:17px;line-height:1.45;' }, a.name),
                h('p', { class: 'faint', style: 'font-size:12px;margin:6px 0;' }, '作者 ' + (a.author || '未知') + ' · ID ' + a.id + ' · ' + (a.chapters || []).length + ' 话'),
                statItems.length ? h('p', { style: 'font-size:12px;color:var(--text-muted);margin:4px 0;' }, statItems.join(' · ')) : null,
                (a.tags || []).length ? h('div', null, (a.tags || []).slice(0, 10).map((tg) => h('span', { class: 'rcjm-tag' }, tg))) : null,
                desc ? h('div', { style: 'margin-top:6px;' }, [
                  h('p', { class: 'faint', style: 'font-size:12px;line-height:1.65;white-space:pre-wrap;margin:0;' }, showDesc),
                  descShort ? h('button', { class: 'btn btn-sm btn-ghost', style: 'margin-top:2px;', onclick: () => (this.descOpen = !this.descOpen) }, this.descOpen ? '收起' : '展开') : null,
                ]) : null,
              ]),
            ]),
          ]),
          dlBlock,
          h('div', { class: 'section', style: 'padding:4px 12px 8px;margin-top:10px;' }, [
            h('div', { class: 'section-title', style: 'margin-top:6px;' }, '章节（' + (a.chapters || []).length + '）' + (done ? '' : ' · 下载后解锁')),
            chapters,
          ]),
          related.length ? h('div', { class: 'section', style: 'padding:4px 12px 8px;margin-top:10px;' }, [
            h('div', { class: 'section-title', style: 'margin-top:6px;' }, '相关推荐'),
            h('div', { style: 'display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;' }, related.map((r) =>
              h('button', { key: r.id, class: 'btn btn-sm', onclick: () => this.openAlbum(r.id) }, (r.name || r.id).slice(0, 16) + (((r.name || r.id) || '').length > 16 ? '…' : '')))),
          ]) : null,
        ])
      }
      // ---- 阅读 ----
      if (this.tab === 'read' && this.chapter) {
        const total = this.pageArr.length
        const toolbar = h('div', { class: 'rcjm-sticky' }, [
          h('button', { class: 'btn btn-sm', onclick: () => { clearInterval(this.dlTimer); this.tab = 'album' } }, '返回详情'),
          h('span', { class: 'faint', style: 'font-size:12px;' }, (this.chapter.name || ('章节 ' + this.chapter.id)) + ' · ' + total + ' 页'),
          h('div', { style: 'margin-left:auto;display:flex;gap:2px;' }, [
            h('button', { class: 'btn btn-sm' + (this.view === 'flow' ? ' btn-primary' : ''), onclick: () => this.setView('flow') }, '滚动'),
            h('button', { class: 'btn btn-sm' + (this.view === 'single' ? ' btn-primary' : ''), onclick: () => this.setView('single') }, '单页'),
          ]),
        ])
        if (this.view === 'flow') {
          v = h('div', null, [
            toolbar,
            Array.from({ length: Math.max(total, this.pages.length) }).map((_, i) => {
              if (this.imgState(i) === 'ok') return h('img', { key: i, src: this.pages[i], loading: 'lazy', class: 'rcjm-page-img', style: 'min-height:100px;' })
              if (this.imgState(i) === 'err') return h('div', { key: i, style: 'width:100%;max-width:520px;height:180px;margin:10px auto;background:#1c2128;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;border-radius:6px;' }, '图片加载失败')
              return h('div', { key: i, class: 'rcjm-skel', style: 'width:100%;max-width:520px;height:200px;margin:10px auto;border-radius:6px;' })
            }),
            h('div', { style: 'text-align:center;padding:14px;' }, this.prefetchIdx >= total
              ? h('span', { class: 'faint', style: 'font-size:12px;' }, '已全部加载（' + total + ' 页）')
              : h('span', { class: 'faint', style: 'font-size:12px;' }, '滚动到底自动加载 ' + this.prefetchIdx + '/' + total)),
          ])
        } else {
          const st = this.imgState(this.pageIdx)
          let imgNode
          if (st === 'ok') imgNode = h('img', { src: this.pages[this.pageIdx], class: 'rcjm-page-img', style: 'max-width:640px;min-height:140px;' })
          else if (st === 'err') imgNode = h('div', { style: 'max-width:640px;height:220px;margin:8px auto;background:#1c2128;display:flex;align-items:center;justify-content:center;color:#666;' }, '图片加载失败')
          else imgNode = h('div', { class: 'rcjm-skel', style: 'max-width:640px;height:260px;margin:8px auto;border-radius:8px;' })
          v = h('div', null, [
            toolbar,
            h('div', { style: 'display:flex;justify-content:center;align-items:center;gap:12px;margin:6px 0;' }, [
              h('button', { class: 'btn btn-sm', disabled: this.pageIdx <= 0, onclick: () => this.prevPage() }, '上一页'),
              h('span', { class: 'faint', style: 'font-size:13px;' }, (this.pageIdx + 1) + ' / ' + total),
              h('button', { class: 'btn btn-sm', disabled: this.pageIdx >= total - 1, onclick: () => this.nextPage() }, '下一页'),
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
        ? h('div', null, [
            h('div', { class: 'flex', style: 'gap:6px;margin-bottom:6px;' }, [
              h('input', { class: 'input', style: 'flex:1;', placeholder: '输入关键词，自动搜索', value: this.kw, oninput: (e) => this.onKwInput(e), onkeyup: (e) => { if (e.key === 'Enter') this.search(1) } }),
              this.kw ? h('button', { class: 'btn btn-sm', onclick: () => this.clearKw() }, '清除') : null,
              h('button', { class: 'btn btn-primary', disabled: this.loading, onclick: () => this.search(1) }, this.loading ? '搜索中…' : '搜索'),
              h('button', { class: 'btn btn-sm', disabled: this.loading || this.page <= 1, onclick: () => this.search(this.page - 1) }, '上一页'),
              h('button', { class: 'btn btn-sm', disabled: this.loading || this.page >= this.pageCount, onclick: () => this.search(this.page + 1) }, '下一页'),
            ]),
            this.recent.length && !this.results.length ? h('div', { style: 'margin-bottom:6px;' }, this.recent.map((kw) => h('span', { key: kw, class: 'rcjm-recent', onclick: () => { this.kw = kw; this.search(1) }, title: '点击搜索' }, kw))) : null,
          ])
        : null
      const statusLine = this.okMsg ? h('p', { style: 'color:var(--success);font-size:12px;margin:4px 0;' }, this.okMsg) : null
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