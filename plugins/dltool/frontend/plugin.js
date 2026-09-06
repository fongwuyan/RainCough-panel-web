// dltool 插件前端(接口库 v4): 下载 / 分片 / 合并 / 重命名 / 安全删除 / 文档转换
import { createApp, h } from 'vue'

const NAME = 'dltool'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'dl', urls: '', files: [], out: null, mode: 'prefix', value: '', value2: '', passes: 3, docTo: 'html', docEnv: null, err: '' } },
    methods: {
      async pick(e) {
        const arr = e.target.files ? Array.from(e.target.files) : []
        this.files = []
        for (const f of arr.slice(0, 12)) this.files.push({ name: f.name, data: await b64(f) })
        e.target.value = ''
      },
      async download() {
        const list = this.urls.split(/[\n,;\s]+/).filter(Boolean)
        if (!list.length) { this.err = '请输入链接'; return }
        this.err = ''
        try { this.out = await ctx.invoke('dltool.nt.download', { urls: list, pack: true }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async split() {
        this.err = ''
        try { this.out = await ctx.invoke('dltool.nt.split', { files: this.files, chunkSize: 1 }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async join() {
        this.err = ''
        try { this.out = await ctx.invoke('dltool.nt.join', { files: this.files, name: 'joined.bin' }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async rename() {
        this.err = ''
        try { this.out = await ctx.invoke('dltool.nt.rename', { files: this.files, mode: this.mode, value: this.value, value2: this.value2 }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async wipe() {
        this.err = ''
        try { this.out = await ctx.invoke('dltool.nt.delete', { files: this.files, passes: Number(this.passes) || 3 }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async doc() {
        this.err = ''
        try { this.out = await ctx.invoke('dltool.doc.convert', { files: this.files, to: this.docTo }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async docCheck() { try { this.docEnv = await ctx.invoke('dltool.doc.check') } catch (e) { this.docEnv = null } },
    },
    mounted() { this.docCheck() },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      const btns = {
        split: () => this.split(), join: () => this.join(), rename: () => this.rename(), wipe: () => this.wipe(), doc: () => this.doc(),
      }
      const title = { split: '按 1MB 分片打包', join: '合并分片打包', rename: '重命名打包', wipe: '安全删除(覆写)', doc: '文档转换(pandoc)' }[this.tab]
      return h('div', null, [
        h('div', { class: 'section-title' }, '下载工具' + (this.docEnv ? (this.docEnv.ok ? ' · pandoc ' + (this.docEnv.version || '') : '') : '')),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' },
          [['dl', 'URL 下载'], ['split', '分片'], ['join', '合并'], ['rename', '重命名'], ['wipe', '安全删除'], ['doc', '文档转换']].map((x) => t(x[0], x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'dl' ? h('div', null, [
          h('textarea', { class: 'input', style: 'width:100%;min-height:80px;', placeholder: '每行一个下载链接', value: this.urls, oninput: (e) => (this.urls = e.target.value) }),
          h('button', { class: 'btn', style: 'margin-top:6px;', onclick: () => this.download() }, '开始下载(任务队列看进度)'),
          this.out ? h('p', { class: 'faint', style: 'font-size:12px;' }, this.out.message) : null,
        ]) : h('div', null, [
          h('input', { type: 'file', multiple: true, onchange: (e) => this.pick(e), class: 'input', style: 'width:100%;margin-bottom:8px;' }),
          this.tab === 'rename' ? h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' }, [
            h('select', { class: 'input', value: this.mode, onchange: (e) => (this.mode = e.target.value) }, ['prefix', 'suffix', 'replace', 'case', 'number'].map((m) => h('option', { value: m }, m))),
            h('input', { class: 'input', style: 'width:110px;', placeholder: '值', value: this.value, oninput: (e) => (this.value = e.target.value) }),
            h('input', { class: 'input', style: 'width:110px;', placeholder: '值2', value: this.value2, oninput: (e) => (this.value2 = e.target.value) }),
          ]) : null,
          this.tab === 'wipe' ? h('input', { class: 'input', style: 'width:80px;margin-bottom:8px;', type: 'number', value: this.passes, oninput: (e) => (this.passes = e.target.value) }) : null,
          this.tab === 'doc' ? h('select', { class: 'input', style: 'margin-bottom:8px;', value: this.docTo, onchange: (e) => (this.docTo = e.target.value) }, ['html', 'markdown', 'plain', 'docx', 'pdf'].map((f) => h('option', { value: f }, f))) : null,
          h('button', { class: 'btn', onclick: btns[this.tab] }, title),
          this.out && this.out.download ? h('a', { href: this.out.download, class: 'btn btn-sm', style: 'margin-left:6px;' }, '下载结果') : null,
          this.out && !this.out.download ? h('p', { class: 'faint', style: 'font-size:12px;' }, JSON.stringify(this.out).slice(0, 300)) : null,
        ]),
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