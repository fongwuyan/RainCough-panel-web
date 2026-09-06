// filehash 插件前端(接口库 v4): 计算 / 查重 / 生成校验清单
import { createApp, h } from 'vue'

const NAME = 'filehash'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'calc', files: [], results: [], dup: null, gen: null, err: '' } },
    methods: {
      async pick(e) {
        const arr = e.target.files ? Array.from(e.target.files) : []
        this.files = []
        for (const f of arr.slice(0, 10)) this.files.push({ name: f.name, data: await b64(f) })
        e.target.value = ''
      },
      async calc() {
        this.err = ''
        try { const r = await ctx.invoke('filehash.h.calc', { files: this.files }); this.results = (r && r.results) || [] }
        catch (e) { this.err = (e && e.message) || e }
      },
      async dup() {
        this.err = ''
        try { this.dup = await ctx.invoke('filehash.da.duplicate', { files: this.files }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async gen() {
        this.err = ''
        try { this.gen = await ctx.invoke('filehash.h.generate', { files: this.files, algo: 'sha256' }) }
        catch (e) { this.err = (e && e.message) || e }
      },
    },
    render() {
      const tab = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      return h('div', null, [
        h('div', { class: 'section-title' }, '文件校验'),
        h('input', { type: 'file', multiple: true, onchange: (e) => this.pick(e), class: 'input', style: 'margin-bottom:8px;' }),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [tab('calc', '计算哈希'), tab('dup', '目录查重'), tab('gen', '生成清单')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'calc' ? h('div', null, [
          h('button', { class: 'btn', style: 'margin-bottom:8px;', onclick: () => this.calc() }, '计算 md5/sha1/sha256'),
          h('table', { class: 'table' }, [
            h('thead', null, h('tr', null, [h('th', null, '文件'), h('th', null, '大小'), h('th', null, 'md5'), h('th', null, 'sha256')])),
            h('tbody', null, this.results.map((r) => h('tr', { key: r.name }, [h('td', null, r.name), h('td', null, r.size), h('td', { class: 'mono' }, r.md5), h('td', { class: 'mono' }, r.sha256)]))),
          ]),
        ]) : null,
        this.tab === 'dup' ? h('div', null, [
          h('button', { class: 'btn', style: 'margin-bottom:8px;', onclick: () => this.dup() }, '查重(按 MD5)'),
          this.dup ? this.dup.duplicates.map((d, i) => h('div', { key: i, class: 'card', style: 'padding:8px;margin-bottom:6px;font-size:12px;' }, [
            h('code', null, d.hash.slice(0, 12) + '…'), ' × ' + d.files.length + ' 份: ' + d.files.map((f) => f.name).join(', '),
          ])) : null,
        ]) : null,
        this.tab === 'gen' ? h('div', null, [
          h('button', { class: 'btn', style: 'margin-bottom:8px;', onclick: () => this.gen() }, '生成 checksums.sha256'),
          this.gen ? h('div', null, [h('a', { href: this.gen.download, class: 'btn btn-sm' }, '下载校验清单')]) : null,
        ]) : null,
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '文件校验' }], mount }
}
if (typeof window !== 'undefined') register(window)