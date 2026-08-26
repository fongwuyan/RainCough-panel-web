// JMComic 插件 Vue3 前端(独立构建, esbuild IIFE)
// 契约: window.__rcPlugin_JMComic = { mount(container, ctx) }
export function register(g) {
  g.__rcPlugin_JMComic = {
    name: 'JMComic',
    mount: function (container, ctx) {
      const { Vue } = ctx
      const { createApp, h } = Vue

      const App = {
        data() {
          return { keyword: '', albums: [], library: [], loading: false, err: '', view: null, meta: null }
        },
        methods: {
          async search(page) {
            const kw = this.keyword.trim()
            if (!kw) return
            this.loading = true
            this.err = ''
            try {
              const d = await (await fetch('/api/plugins/JMComic/search?keyword=' + encodeURIComponent(kw) + '&page=' + (page || 1))).json()
              if (d.ok === false) { this.err = d.error || '搜索失败' }
              this.albums = d.albums || []
            } catch (e) { this.err = e.message }
            this.loading = false
          },
          async loadLibrary() {
            try {
              const d = await (await fetch('/api/plugins/JMComic/library')).json()
              this.library = d.library || []
            } catch (e) {}
          },
          async openMeta(aid) {
            try {
              const d = await (await fetch('/api/plugins/JMComic/meta/' + aid)).json()
              this.meta = (d && d.meta) || null
              this.view = this.meta ? 'meta' : null
            } catch (e) { this.err = e.message }
          },
          close() { this.view = null; this.meta = null },
          async download(aid) {
            try {
              await fetch('/api/plugins/JMComic/download', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aid })
              })
              alert('已加入下载队列')
            } catch (e) { this.err = e.message }
          },
          addLib(aid, title, cover) {
            fetch('/api/plugins/JMComic/library', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ aid, title, cover })
            }).then(() => this.loadLibrary()).catch(() => {})
          }
        },
        mounted() { this.loadLibrary() },
        render() {
          const card = (a) => h('div', { key: a.aid, class: 'card', style: 'cursor:pointer;overflow:hidden;' }, [
            a.cover ? h('img', { src: a.cover, style: 'width:100%;height:140px;object-fit:cover;background:#0a0d10;', onclick: () => this.openMeta(a.aid) }) : null,
            h('div', { style: 'padding:8px;' }, [
              h('div', { style: 'font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', onclick: () => this.openMeta(a.aid), title: a.title }, a.title),
              h('div', { class: 'mono faint', style: 'font-size:10px;margin:2px 0 6px;' }, a.author || ''),
              h('div', { class: 'flex', style: 'gap:4px;' }, [
                h('button', { class: 'btn btn-sm', onclick: () => this.download(a.aid) }, '下载'),
                h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.addLib(a.aid, a.title, a.cover) }, '收藏'),
              ]),
            ]),
          ])
          const grid = (list) => h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;' }, list.map(card))
          const metaView = this.view === 'meta' && this.meta ? h('div', { class: 'section' }, [
            h('div', { class: 'section-title' }, [h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.close() }, '← 返回'), ' ' + (this.meta.title || '')]),
            h('p', { class: 'mono faint', style: 'font-size:11px;' }, '作者: ' + (this.meta.author || '-') + ' · ' + (this.meta.series || '') ),
            h('div', { class: 'flex', style: 'gap:8px;margin-top:8px;' }, [
              h('button', { class: 'btn btn-primary', onclick: () => this.download(this.meta.aid || '') }, '下载全本'),
            ]),
            h('p', { class: 'hint', style: 'margin-top:8px;' }, '详情字段: ' + JSON.stringify(Object.keys(this.meta).slice(0, 10))),
          ]) : null

          return h('div', { class: 'jm-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, 'JMComic 搜索'),
              h('div', { class: 'flex', style: 'gap:8px;margin-bottom:8px;' }, [
                h('input', { placeholder: '搜索漫画...', value: this.keyword, oninput: (e) => (this.keyword = e.target.value), class: 'input', style: 'flex:1;', onkeydown: (e) => { if (e.key === 'Enter') this.search() } }),
                h('button', { class: 'btn btn-primary', onclick: () => this.search(), disabled: this.loading }, this.loading ? '搜索中...' : '搜索'),
              ]),
              this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
            ]),
            metaView,
            this.albums.length ? h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '搜索结果(' + this.albums.length + ')'),
              grid(this.albums),
            ]) : null,
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '我的收藏(' + this.library.length + ')'),
              this.library.length ? grid(this.library.map((x) => ({ aid: String(x.aid), title: x.title, cover: x.cover, author: '' }))) : h('p', { class: 'hint' }, '暂无收藏'),
            ]),
          ])
        }
      }
      const vm = createApp(App)
      vm.mount(container)
      return () => vm.unmount()
    }
  }
}

if (typeof window !== 'undefined') {
  register(window)
}