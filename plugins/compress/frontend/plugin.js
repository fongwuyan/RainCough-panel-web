// compress 插件前端(接口库 v4): 列表 / 解压 / 压缩 / 转换 / 对比
import { createApp, h } from 'vue'

const NAME = 'compress'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'list', files: [], list: null, ext: null, cmp: null, fmt: 'zip', level: 5, env: null, err: '' } },
    methods: {
      async read(e) {
        const arr = e.target.files ? Array.from(e.target.files) : []
        this.files = []
        for (const f of arr.slice(0, 10)) this.files.push({ name: f.name, data: await b64(f) })
        e.target.value = ''
      },
      async run(method, payload) {
        this.err = ''
        try {
          const r = await ctx.invoke(method, payload)
          if (method.endsWith('.list')) this.list = r
          else if (method.endsWith('.extract')) { this.ext = r; this.tab = 'extract' }
          else if (method.endsWith('.compress')) this.ext = r
          else if (method.endsWith('.convert')) this.ext = r
          else if (method.endsWith('.compare')) this.cmp = r
        } catch (e) { this.err = (e && e.message) || e }
      },
      async env() { try { this.env = await ctx.invoke('compress.dc.check') } catch (e) {} },
    },
    mounted() { this.env() },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      return h('div', null, [
        h('div', { class: 'section-title' }, '解压压缩' + (this.env ? (this.env.ok ? ' · 7z ✓' : ' · 未装 7z') : '')),
        h('input', { type: 'file', multiple: true, onchange: (e) => this.read(e), class: 'input', style: 'width:100%;margin-bottom:8px;' }),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' },
          [['list', '打包内容'], ['extract', '解压'], ['compress', '压缩'], ['convert', '转换格式'], ['compare', '对比']].map((x) => t(x[0], x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab !== 'compare' ? h('button', { class: 'btn btn-sm btn-primary', onclick: () => {
          if (this.tab === 'list') this.run('compress.dc.list', { archive: this.files[0].data, name: this.files[0].name })
          if (this.tab === 'extract') this.run('compress.dc.extract', { archive: this.files[0].data, name: this.files[0].name, organize: 'none' })
          if (this.tab === 'compress') this.run('compress.dc.compress', { files: this.files, format: this.fmt, level: Number(this.level) || 5, name: 'archive' })
          if (this.tab === 'convert') this.run('compress.dc.convert', { archive: this.files[0].data, name: this.files[0].name, format: this.fmt })
        } }, '执行') : h('button', { class: 'btn btn-sm btn-primary', onclick: () => this.run('compress.dc.compare', { archives: this.files.map((f) => f.data) }) }, '对比前两文件'),
        this.fmtView = h('div', { class: 'flex', style: 'gap:6px;margin:6px 0;' }, [
          (this.tab === 'compress' || this.tab === 'convert') ? h('select', { class: 'input', value: this.fmt, onchange: (e) => (this.fmt = e.target.value) }, ['7z', 'zip', 'tar', 'gz'].map((f) => h('option', { value: f }, f))) : null,
          this.tab === 'compress' ? h('input', { class: 'input', style: 'width:70px;', placeholder: '级别', value: this.level, oninput: (e) => (this.level = e.target.value) }) : null,
        ]),
        this.list ? h('p', { class: 'faint', style: 'font-size:12px;' }, this.list.name + ' · ' + this.list.total + ' 项 · ' + this.list.total_size + ' B') : null,
        this.ext && this.ext.download ? h('a', { href: this.ext.download, class: 'btn btn-sm', style: 'margin-top:4px;' }, '下载结果') : null,
        this.cmp ? h('p', { style: 'font-size:12px;margin-top:4px;' }, 'A 独有 ' + this.cmp.only_a.length + ' · B 独有 ' + this.cmp.only_b.length + ' · 差异 ' + this.cmp.diff.length + ' · 相同 ' + this.cmp.same) : null,
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