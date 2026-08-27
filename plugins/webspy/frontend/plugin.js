// webspy 插件 Vue3 前端组件(独立构建, 完全自包含)
// 契约: window.__rcPlugin_webspy = { name:'webspy', mount(container, ctx) }
// 后端: plugins/webspy/server.py — 路由 /search /urlcheck /rss/feeds /rss/fetch /readability /info
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_webspy = {
    name: 'webspy',
    mount: function (container, ctx) {

      // API 助手: 优先 ctx.api(自动前缀 /api/plugins/webspy), 退化为裸 fetch
      const call = (method, path, body) => {
        if (ctx && ctx.api) {
          return method === 'GET' ? ctx.api.get(path) : ctx.api.post(path, body)
        }
        const opts = { method }
        if (method !== 'GET') {
          opts.headers = { 'Content-Type': 'application/json' }
          opts.body = JSON.stringify(body || {})
        }
        return fetch('/api/plugins/webspy' + path, opts).then((r) => r.json())
      }

      const App = {
        data() {
          return {
            info: {},
            // —— ① 搜索 ——
            searchQ: '',
            searchLimit: 10,
            searchLoading: false,
            searchResults: [],
            // —— ② 链接检查 ——
            urlInput: '',
            urlLoading: false,
            urlResults: [],
            // —— ③ RSS ——
            feeds: [],
            newFeedUrl: '',
            newFeedName: '',
            fetchLoading: '',
            feedEntries: null,
            // —— ④ 正文提取 ——
            rdUrl: '',
            rdLoading: false,
            rdResult: null,
            err: '',
          }
        },
        methods: {
          // ---- 通用 ----
          async loadInfo() {
            try {
              const d = await call('GET', '/info')
              if (d && typeof d === 'object') this.info = d
            } catch (e) { /* 静默失败 */ }
          },
          fmtTs(ts) {
            if (!ts) return '—'
            try { return new Date(ts * 1000).toLocaleString() } catch (e) { return '—' }
          },
          fmtSize(n) {
            if (n == null) return '—'
            if (n < 1024) return n + 'B'
            if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB'
            return (n / 1024 / 1024).toFixed(1) + 'MB'
          },
          stripHtml(s) {
            if (!s) return ''
            const t = document.createElement('div')
            t.innerHTML = s
            return (t.textContent || '').trim()
          },

          // ---- ① 搜索(GET /search?q=&limit=)→ {ok, results:[{title,url,snippet}]} ----
          async search() {
            this.err = ''
            const q = this.searchQ.trim()
            if (!q) { this.err = '请输入搜索关键词'; return }
            this.searchLoading = true
            try {
              const d = await call('GET', '/search?q=' + encodeURIComponent(q) + '&limit=' + this.searchLimit)
              if (!d) this.err = '后端无响应'
              else if (d.ok === false) { this.err = d.error || '搜索失败'; this.searchResults = [] }
              else {
                this.searchResults = d.results || []
                if (!this.searchResults.length) this.err = '无搜索结果'
              }
            } catch (e) { this.err = e.message }
            this.searchLoading = false
          },

          // ---- ② 链接检查(POST /urlcheck {urls})→ {ok, results:[{url,status,ok,ms,final_url,size,error?}]} ----
          checkUrls() {
            this.err = ''
            const urls = this.urlInput.split(/[\s,，;；\n]+/).map((s) => s.trim()).filter(Boolean)
            if (!urls.length) { this.err = '请输入要检查的 URL(可多个, 用逗号或换行分隔)'; return }
            this.urlLoading = true
            call('POST', '/urlcheck', { urls }).then((d) => {
              if (!d) this.err = '后端无响应'
              else if (d.ok === false) this.err = d.error || '检查失败'
              else this.urlResults = d.results || []
            }).catch((e) => { this.err = e.message })
              .finally(() => { this.urlLoading = false })
          },
          checkUrl(u) { this.urlInput = u; this.checkUrls() },

          // ---- ③ RSS(GET/POST /rss/feeds, /rss/feeds/delete, /rss/fetch) ----
          async loadFeeds() {
            this.err = ''
            try {
              const d = await call('GET', '/rss/feeds')
              if (!d) this.err = '后端无响应'
              else if (d.ok === false) this.err = d.error || '加载订阅失败'
              else this.feeds = d.feeds || []
            } catch (e) { this.err = e.message }
          },
          async addFeed() {
            this.err = ''
            const url = this.newFeedUrl.trim()
            if (!url) { this.err = '请输入 RSS 地址'; return }
            try {
              const d = await call('POST', '/rss/feeds', { url, name: this.newFeedName.trim() })
              if (!d) this.err = '后端无响应'
              else if (d.ok === false) this.err = d.error || '添加失败'
              else {
                this.feeds = d.feeds || []
                this.newFeedUrl = ''
                this.newFeedName = ''
              }
            } catch (e) { this.err = e.message }
          },
          async delFeed(idx) {  // 后端按列表索引删除
            this.err = ''
            try {
              const d = await call('POST', '/rss/feeds/delete', { idx })
              if (!d) this.err = '后端无响应'
              else if (d.ok === false) this.err = d.error || '删除失败'
              else {
                this.feeds = d.feeds || []
                if (this.feedEntries) this.feedEntries = null
              }
            } catch (e) { this.err = e.message }
          },
          async fetchFeed(url) {  // → {ok, feed_title, entries:[{title,link,summary,published,published_ts}]}
            this.err = ''
            if (this.fetchLoading) return
            this.fetchLoading = url
            try {
              const d = await call('POST', '/rss/fetch', { url })
              if (!d) this.err = '后端无响应'
              else if (d.ok === false) this.err = d.error || '抓取失败'
              else {
                this.feedEntries = d
                await this.loadFeeds()  // 刷新 last_fetched
              }
            } catch (e) { this.err = e.message }
            this.fetchLoading = ''
          },

          // ---- ④ 正文提取(POST /readability {url})→ {ok,url,title,length,text} ----
          async extract() {
            this.err = ''
            const url = this.rdUrl.trim()
            if (!url) { this.err = '请输入要提取正文的 URL'; return }
            this.rdLoading = true
            try {
              const d = await call('POST', '/readability', { url })
              if (!d) this.err = '后端无响应'
              else if (d.ok === false) this.err = d.error || '提取失败'
              else this.rdResult = d
            } catch (e) { this.err = e.message }
            this.rdLoading = false
          },
        },
        mounted() {
          this.loadInfo()
          this.loadFeeds()
        },
        render() {
          const self = this
          const errBanner = this.err
            ? h('p', { style: 'color:var(--danger);font-size:12px;margin-top:8px;' }, this.err)
            : null

          // —— ① 搜索结果 ——
          const sRows = (this.searchResults || []).map((r, i) =>
            h('div', { key: r.url || i, class: 'card', style: 'padding:8px 10px;' }, [
              h('a', { href: r.url, target: '_blank', rel: 'noopener', style: 'font-weight:600;color:var(--accent,#4da3ff);' },
                r.title || r.url),
              r.snippet ? h('div', { style: 'color:var(--text-faint);font-size:12px;margin:3px 0;' }, r.snippet) : null,
              h('div', { class: 'flex', style: 'gap:8px;align-items:center;' }, [
                h('span', { class: 'mono faint', style: 'font-size:11px;word-break:break-all;flex:1;' }, r.url),
                h('button', { class: 'btn btn-sm', onclick: () => self.checkUrl(r.url) }, '检查'),
                h('button', { class: 'btn btn-sm', onclick: () => { self.rdUrl = r.url; self.extract() } }, '正文'),
              ]),
            ]))

          // —— ② 链接检查结果 ——
          const ucRows = (this.urlResults || []).map((u, i) => h('tr', { key: i }, [
            h('td', { class: 'mono', style: 'font-size:11px;word-break:break-all;max-width:260px;' }, u.url),
            h('td', { style: 'text-align:center;' },
              u.status ? h('span', { style: 'font-weight:600;color:' + (u.ok ? 'var(--success,#3fb950)' : 'var(--danger,#f85149)') + ';' }, String(u.status)) : '—'),
            h('td', { style: 'text-align:center;' }, u.ok
              ? h('span', { style: 'color:var(--success,#3fb950);' }, '可用')
              : h('span', { style: 'color:var(--danger,#f85149);' }, '不可用')),
            h('td', { class: 'mono', style: 'text-align:right;' }, u.ms != null ? u.ms + 'ms' : '—'),
            h('td', { class: 'mono', style: 'text-align:right;' }, self.fmtSize(u.size)),
            h('td', { class: 'mono faint', style: 'font-size:11px;word-break:break-all;max-width:220px;' }, u.error || u.final_url || ''),
          ]))

          // —— ③ RSS 订阅列表(含追加/删除/抓取) ——
          const feedRows = (this.feeds || []).map((f, i) => h('tr', { key: f.url }, [
            h('td', { class: 'mono' }, f.name),
            h('td', { class: 'mono faint', style: 'font-size:11px;word-break:break-all;max-width:220px;' }, f.url),
            h('td', { class: 'mono faint', style: 'font-size:11px;' }, this.fmtTs(f.added)),
            h('td', { class: 'mono faint', style: 'font-size:11px;' }, this.fmtTs(f.last_fetched)),
            h('td', null, this.fetchLoading === f.url
              ? h('span', { class: 'hint' }, '抓取中…')
              : h('button', { class: 'btn btn-sm', onclick: () => this.fetchFeed(f.url) }, '抓取')),
            h('td', null, h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.delFeed(i) }, '删除')),
          ]))

          // —— ③ 抓取条目展示 ——
          const en = this.feedEntries
          const entryNodes = (en && (en.entries || [])).map((e, i) => {
            const sum = this.stripHtml(e.summary)
            return h('div', { key: e.link || i, class: 'card', style: 'padding:8px 10px;' }, [
              h('div', { class: 'flex', style: 'gap:8px;justify-content:space-between;align-items:flex-start;' }, [
                h('a', { href: e.link, target: '_blank', rel: 'noopener', style: 'font-weight:600;color:var(--accent,#4da3ff);flex:1;' },
                  e.title || '(无标题)'),
                e.published ? h('span', { class: 'mono faint', style: 'font-size:11px;white-space:nowrap;' }, e.published) : null,
              ]),
              h('div', { class: 'mono faint', style: 'font-size:11px;word-break:break-all;margin:2px 0;' }, e.link),
              sum ? h('div', { style: 'font-size:12px;' },
                sum.length > 300 ? sum.slice(0, 300) + '…' : sum) : null,
            ])
          })

          return h('div', { class: 'webspy-panel' }, [
            // —— 头部/概览 ——
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, [
                '采集解析' + (this.info.version ? ' v' + this.info.version : ''),
                h('button', { class: 'btn btn-sm', style: 'float:right;', onclick: () => this.loadFeeds() }, '刷新 RSS'),
              ]),
              h('p', { class: 'hint' }, 'Bing 搜索 · 链接可用性检查 · RSS 订阅管理 · 正文提取(当前 ' + this.feeds.length + ' 个订阅)'),
            ]),

            // —— ① 搜索 ——
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, 'Bing 搜索'),
              h('div', { class: 'flex', style: 'gap:8px;margin-bottom:8px;' }, [
                h('input', {
                  class: 'input', placeholder: '搜索关键词…', style: 'flex:1;',
                  value: this.searchQ,
                  oninput: (e) => (this.searchQ = e.target.value),
                  onkeydown: (e) => { if (e.key === 'Enter') this.search() },
                }),
                h('input', {
                  class: 'input', type: 'number', min: '1', max: '20', placeholder: '数量', style: 'width:80px;',
                  value: String(this.searchLimit),
                  oninput: (e) => (this.searchLimit = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 10))),
                }),
                h('button', { class: 'btn btn-primary', onclick: () => this.search(), disabled: this.searchLoading },
                  this.searchLoading ? '搜索中…' : '搜索'),
              ]),
              sRows.length
                ? h('div', { style: 'display:flex;flex-direction:column;gap:6px;' }, sRows)
                : h('p', { class: 'hint' }, '输入关键词搜索, 结果可一键「检查」链接可用性或「正文」提取'),
            ]),

            // —— ② 链接检查 ——
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '链接检查'),
              h('div', { class: 'flex', style: 'gap:8px;margin-bottom:8px;' }, [
                h('input', {
                  class: 'input', placeholder: 'https://… (多个 URL 用逗号/换行分隔)', style: 'flex:1;',
                  value: this.urlInput,
                  oninput: (e) => (this.urlInput = e.target.value),
                  onkeydown: (e) => { if (e.key === 'Enter') this.checkUrls() },
                }),
                h('button', { class: 'btn btn-primary', onclick: () => this.checkUrls(), disabled: this.urlLoading },
                  this.urlLoading ? '检查中…' : '检查'),
              ]),
              this.urlResults.length
                ? h('table', { class: 'table' }, [
                    h('thead', null, h('tr', null, [
                      h('th', null, 'URL'), h('th', null, '状态'), h('th', null, '结果'),
                      h('th', null, '耗时'), h('th', null, '大小'), h('th', null, '最终URL/错误'),
                    ])),
                    h('tbody', null, ucRows),
                  ])
                : null,
            ]),

            // —— ③ RSS ——
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, 'RSS 订阅'),
              h('div', { class: 'flex', style: 'gap:8px;margin-bottom:8px;' }, [
                h('input', { class: 'input', placeholder: '订阅名(可选)', style: 'width:150px;',
                  value: this.newFeedName, oninput: (e) => (this.newFeedName = e.target.value) }),
                h('input', { class: 'input', placeholder: 'RSS 地址 https://…', style: 'flex:1;',
                  value: this.newFeedUrl, oninput: (e) => (this.newFeedUrl = e.target.value),
                  onkeydown: (e) => { if (e.key === 'Enter') this.addFeed() } }),
                h('button', { class: 'btn btn-primary', onclick: () => this.addFeed() }, '添加'),
              ]),
              this.feeds.length
                ? h('table', { class: 'table' }, [
                    h('thead', null, h('tr', null, [
                      h('th', null, '名称'), h('th', null, 'URL'), h('th', null, '添加时间'),
                      h('th', null, '最近抓取'), h('th', null, ''), h('th', null, ''),
                    ])),
                    h('tbody', null, feedRows),
                  ])
                : h('p', { class: 'hint' }, '还没有订阅, 添加一个 RSS 源开始'),
              en ? h('div', { style: 'margin-top:10px;' }, [
                h('div', { class: 'flex', style: 'gap:8px;align-items:center;margin-bottom:6px;' }, [
                  h('div', { class: 'section-title', style: 'margin:0;' }, '条目: ' + (en.feed_title || '') + ' (' + (en.entries || []).length + ')'),
                  h('button', { class: 'btn btn-sm', onclick: () => (this.feedEntries = null) }, '收起'),
                ]),
                h('div', { style: 'display:flex;flex-direction:column;gap:6px;' }, entryNodes),
              ]) : null,
            ]),

            // —— ④ 正文提取 ——
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '正文提取 (Readability)'),
              h('div', { class: 'flex', style: 'gap:8px;margin-bottom:8px;' }, [
                h('input', {
                  class: 'input', placeholder: 'https://…', style: 'flex:1;',
                  value: this.rdUrl,
                  oninput: (e) => (this.rdUrl = e.target.value),
                  onkeydown: (e) => { if (e.key === 'Enter') this.extract() },
                }),
                h('button', { class: 'btn btn-primary', onclick: () => this.extract(), disabled: this.rdLoading },
                  this.rdLoading ? '提取中…' : '提取正文'),
              ]),
              this.rdResult
                ? h('div', { class: 'card', style: 'padding:10px;' }, [
                    h('div', { style: 'font-weight:600;margin-bottom:4px;' }, this.rdResult.title),
                    h('div', { class: 'hint', style: 'margin-bottom:6px;' },
                      '来源: ' + this.rdResult.url + ' · 长度: ' + this.rdResult.length + ' 字符'),
                    h('pre', {
                      class: 'mono',
                      style: 'font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:380px;overflow:auto;' +
                        'background:rgba(0,0,0,.15);padding:8px;border-radius:6px;margin:0;',
                    }, this.rdResult.text),
                  ])
                : h('p', { class: 'hint' }, '输入网页 URL, 提取去除导航/脚本后的正文文本'),
            ]),

            errBanner,
          ])
        }
      }
      const vm = createApp(App)
      vm.mount(container)
      return () => vm.unmount()
    }
  }
}

// IIFE 尾巴: 注册到全局(主面板 PluginView 动态 import 后读取)
if (typeof window !== 'undefined') {
  register(window)
}