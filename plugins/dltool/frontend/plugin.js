// dltool 插件前端(接口库 v4): 下载 / 分片合井(打包) / 重命名
import { createApp, h } from 'vue'

const NAME = 'dltool'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'dl', urls: '', files: [], out: null, mode: 'prefix', value: '', err: '', docEnv: null } },
    methods: {
      async pick(e) {
        const arr = e.target.files ? Array.from(e.target.files) : []
        this.files = []
        for (const f of arr.slice(0, 10)) this.files.push({ name: f.name, data: await b64(f) })
        e.target.value = ''
      },
      async download() {
        const list = this.urls.split(/[\n,;\s]+/).filter(Boolean)
        if (!list.length) { this.err = '请输入下载链接'; return }
        this.err = ''
        try { this.out = await ctx.invoke('dltool.nt.download', { urls: list, pack: true }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async split() {
        this.err = ''
        try { this.out = await ctx.invoke('dltool.nt.split', { files: this.files, chunkSize: 1 }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async rename() {
        this.err = ''
        try { this.out = await ctx.invoke('dltool.nt.rename', { files: this.files, mode: this.mode, value: this.value }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async docCheck() {
        try { this.docEnv = await ctx.invoke('dltool.doc.check') } catch (e) { this.docEnv = null }
      },
    },
    mounted() { this.docCheck() },
    render() {
      const tab = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      return h('div', null, [
        h('div', { class: 'section-title' }, '下载工具' + (this.docEnv ? (this.docEnv.ok ? ' · pandoc ✓' : '') : '')),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [tab('dl', 'URL 下载'), tab('split', '分片'), tab('rename', '重命名')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'dl' ? h('div', null, [
          h('textarea', { class: 'input', style: 'width:100%;min-height:90px;', placeholder: '每行一个下载链接', value: this.urls, oninput: (e) => (this.urls = e.target.value) }),
          h('button', { class: 'btn', style: 'margin-top:8px;', onclick: () => this.download() }, '开始下载(任务队列查看进度)'),
          this.out ? h('p', { class: 'faint', style: 'font-size:12px;' }, this.out.message) : null,
        ]) : null,
        this.tab === 'split' || this.tab === 'rename' ? h('div', null, [
          h('input', { type: 'file', multiple: true, onchange: (e) => this.pick(e), class: 'input', style: 'width:100%;margin-bottom:8px;' }),
          this.tab === 'split'
            ? h('button', { class: 'btn', onclick: () => this.split() }, '按 1MB 分片打包')
            : h('div', { class: 'flex', style: 'gap:6px;' }, [
              h('select', { class: 'input', value: this.mode, onchange: (e) => (this.mode = e.target.value) }, ['prefix', 'suffix', 'replace', 'number'].map((m) => h('option', { value: m }, m))),
              h('input', { class: 'input', placeholder: '值', value: this.value, oninput: (e) => (this.value = e.target.value) }),
              h('button', { class: 'btn', onclick: () => this.rename() }, '重命名打包'),
            ]),
          this.out && this.out.download ? h('a', { href: this.out.download, class: 'btn btn-sm', style: 'margin-top:8px;' }, '下载结果') : null,
        ]) : null,
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '下载工具' }], mount }
}
if (typeof window !== 'undefined') register(window)