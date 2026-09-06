// touchgal 插件前端(接口库 v4): 搜索 / 资源 / 识图
import { createApp, h } from 'vue'

const NAME = 'touchgal'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'search', keyword: '', nsfw: false, results: [], res: [], img: '', rec: null, err: '', loading: false } },
    methods: {
      async search() {
        this.loading = true; this.err = ''
        try { const r = await ctx.invoke('touchgal.search', { keyword: this.keyword, nsfw: this.nsfw }); this.results = (r && (r.data || [])) || [] }
        catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async resource(item) {
        this.err = ''
        try { const r = await ctx.invoke('touchgal.resource', { patchId: item.patchId || item.id }); this.res = (r && r.resources) || [] }
        catch (e) { this.err = (e && e.message) || e }
      },
      async pick(e) {
        const f = e.target.files && e.target.files[0]
        if (f) { this.img = await b64(f); e.target.value = '' }
      },
      async recognize() {
        const url = this.imgUrl && this.imgUrl.trim()
        if (!url) { this.err = '请输入图片 URL'; return }
        this.err = ''
        try { this.rec = await ctx.invoke('touchgal.recognize.dual', { imageUrl: url }) }
        catch (e) { this.err = (e && e.message) || e }
      },
    },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      const rows = this.results.map((it) => h('tr', { key: (it.patchId || it.id || it.name) }, [
        h('td', null, it.name || it.title || ''), h('td', null, h('button', { class: 'btn btn-sm', onclick: () => this.resource(it) }, '资源')),
      ]))
      return h('div', null, [
        h('div', { class: 'section-title' }, 'TouchGal 游戏查找'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [t('search', '搜索'), t('rec', '识图')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'search' ? h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '游戏名', value: this.keyword, oninput: (e) => (this.keyword = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.search() } }),
            h('label', { style: 'font-size:12px;display:flex;align-items:center;' }, h('input', { type: 'checkbox', checked: this.nsfw, onchange: (e) => (this.nsfw = e.target.checked) }), 'NSFW'),
            h('button', { class: 'btn', disabled: this.loading, onclick: () => this.search() }, this.loading ? '搜索中...' : '搜索'),
          ]),
          h('table', { class: 'table' }, [h('thead', null, h('tr', null, ['名称', ''].map((x) => h('th', null, x)))), h('tbody', null, rows)]),
          this.res.length ? h('div', { class: 'section', style: 'margin-top:8px;' }, [
            h('div', { class: 'section-title' }, '下载资源'),
            this.res.map((x) => h('div', { key: x.name, style: 'padding:4px 0;' }, [
              h('b', null, x.name), h('span', { class: 'faint' }, ' [' + x.platform + ' · ' + x.language + '] ' + x.size),
              h('div', { class: 'mono', style: 'font-size:12px;' }, (x.content || '') + ' | 码 ' + x.code + ' · 密 ' + x.password),
            ])),
          ]) : null,
        ]) : h('div', null, [
          h('input', { class: 'input', style: 'width:100%;margin-bottom:8px;', placeholder: '图片 URL(animetrace)', value: this.imgUrl || '', oninput: (e) => (this.imgUrl = e.target.value) }),
          h('button', { class: 'btn', onclick: () => this.recognize() }, '双模型识图(anime+gal)'),
          this.rec ? h('pre', { class: 'faint', style: 'white-space:pre-wrap;font-size:12px;margin-top:8px;' }, JSON.stringify(this.rec, null, 1).slice(0, 2000)) : null,
        ]),
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '游戏查找' }], mount }
}
if (typeof window !== 'undefined') register(window)