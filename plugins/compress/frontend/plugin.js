// compress 插件前端(接口库 v4): 解压 / 压缩 / 对比
import { createApp, h } from 'vue'

const NAME = 'compress'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'extract', files: [], ext: null, cmp: null, err: '', env: null } },
    methods: {
      async read(e) {
        const arr = e.target.files ? Array.from(e.target.files) : []
        this.files = []
        for (const f of arr.slice(0, 10)) this.files.push({ name: f.name, data: await b64(f) })
        e.target.value = ''
      },
      async extract() {
        this.err = ''
        try { this.ext = await ctx.invoke('compress.dc.extract', { archive: this.files[0].data, name: this.files[0].name, organize: 'none' }); this.list() }
        catch (e) { this.err = (e && e.message) || e }
      },
      async list() {
        try { const r = await ctx.invoke('compress.dc.list', { archive: this.files[0].data, name: this.files[0].name }); this.ext = r }
        catch (e) { this.err = (e && e.message) || e }
      },
      async compress() {
        this.err = ''
        try { this.ext = await ctx.invoke('compress.dc.compress', { files: this.files, format: 'zip', level: 5, name: 'archive' }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async compare() {
        this.err = ''
        try { this.cmp = await ctx.invoke('compress.dc.compare', { archives: this.files.map((f) => f.data) }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async env() {
        try { this.env = await ctx.invoke('compress.dc.check') } catch (e) {}
      },
    },
    mounted() { this.env() },
    render() {
      const tab = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      return h('div', null, [
        h('div', { class: 'section-title' }, '解压压缩' + (this.env ? (this.env.ok ? ' · 7z ✓' : ' · 未装 7z') : '')),
        h('input', { type: 'file', multiple: true, onchange: (e) => this.read(e), class: 'input', style: 'margin-bottom:8px;width:100%;' }),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [tab('extract', '查看/解压'), tab('compress', '压缩'), tab('compare', '对比')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'extract' ? h('div', null, [
          h('button', { class: 'btn btn-sm', onclick: () => this.list() }, '查看内容'),
          h('button', { class: 'btn btn-sm btn-primary', onclick: () => this.extract() }, '解压并打包'),
          this.ext ? h('div', { style: 'margin-top:8px;font-size:12px;' }, [
            h('p', null, '共 ' + (this.ext.total != null ? this.ext.total + ' 项' : (this.ext.count != null ? this.ext.count + ' 个文件' : '-'))),
            this.ext.download ? h('a', { href: this.ext.download, class: 'btn btn-sm' }, '下载结果') : null,
          ]) : null,
        ]) : null,
        this.tab === 'compress' ? h('div', null, [
          h('button', { class: 'btn', onclick: () => this.compress() }, '压缩为 zip'),
          this.ext && this.ext.download ? h('a', { href: this.ext.download, style: 'margin-left:8px;' }, '下载') : null,
        ]) : null,
        this.tab === 'compare' ? h('div', null, [
          h('button', { class: 'btn', onclick: () => this.compare() }, '对比前两文件'),
          this.cmp ? h('p', { style: 'font-size:12px;' }, 'A 独有 ' + this.cmp.only_a.length + ' · B 独有 ' + this.cmp.only_b.length + ' · 差异 ' + this.cmp.diff.length + ' · 相同 ' + this.cmp.same) : null,
        ]) : null,
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '解压压缩' }], mount }
}
if (typeof window !== 'undefined') register(window)