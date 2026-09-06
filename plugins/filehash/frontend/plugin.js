// filehash 插件前端(接口库 v4): 计算 / 查重 / 生成清单 / 校验
import { createApp, h } from 'vue'

const NAME = 'filehash'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'calc', files: [], stats: null, results: [], dup: null, gen: null, verify: null, verifyAlgo: 'sha256', err: '' } },
    methods: {
      async pick(e) {
        const arr = e.target.files ? Array.from(e.target.files) : []
        this.files = []
        for (const f of arr.slice(0, 12)) this.files.push({ name: f.name, data: await b64(f) })
        e.target.value = ''
      },
      async calc() { this.err = ''; try { const r = await ctx.invoke('filehash.h.calc', { files: this.files }); this.results = (r && r.results) || [] } catch (e) { this.err = (e && e.message) || e } },
      async stats() { this.err = ''; try { this.stats = await ctx.invoke('filehash.da.stats', { files: this.files }) } catch (e) { this.err = (e && e.message) || e } },
      async dup() { this.err = ''; try { this.dup = await ctx.invoke('filehash.da.duplicate', { files: this.files }) } catch (e) { this.err = (e && e.message) || e } },
      async gen() { this.err = ''; try { this.gen = await ctx.invoke('filehash.h.generate', { files: this.files, algo: 'sha256' }) } catch (e) { this.err = (e && e.message) || e } },
      async verify() { this.err = ''; try { this.verify = await ctx.invoke('filehash.h.verify', { files: this.files }) } catch (e) { this.err = (e && e.message) || e } },
    },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      const cats = (this.stats && this.stats.categories || []).filter((c) => c.count > 0)
      return h('div', null, [
        h('div', { class: 'section-title' }, '文件校验'),
        h('input', { type: 'file', multiple: true, onchange: (e) => this.pick(e), class: 'input', style: 'width:100%;margin-bottom:8px;' }),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' },
          [['calc', '计算'], ['stats', '目录统计'], ['dup', '查重'], ['gen', '生成清单'], ['verify', '校验']].map((x) => t(x[0], x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'calc' ? h('div', null, [h('button', { class: 'btn', onclick: () => this.calc() }, '计算 md5/sha1/sha256'),
          h('table', { class: 'table', style: 'margin-top:6px;' }, [h('thead', null, h('tr', null, ['文件', 'md5', 'sha256'].map((x) => h('th', null, x)))), h('tbody', null, this.results.map((r) => h('tr', { key: r.name }, [h('td', null, r.name), h('td', { class: 'mono' }, r.md5), h('td', { class: 'mono' }, r.sha256)])))])]) : null,
        this.tab === 'stats' ? h('div', null, [h('button', { class: 'btn', onclick: () => this.stats() }, '统计上传文件/压缩包'),
          this.stats ? h('div', { style: 'margin-top:6px;font-size:13px;' }, [
            h('p', null, this.stats.total_files + ' 个文件 · 共 ' + this.stats.total_size + ' B'),
            cats.map((c) => h('span', { class: 'chip', style: 'margin-right:6px;' }, c.name + ' ' + c.count)),
          ]) : null]) : null,
        this.tab === 'dup' ? h('div', null, [h('button', { class: 'btn', onclick: () => this.dup() }, '查重(按 MD5)'),
          this.dup ? this.dup.duplicates.map((d, i) => h('div', { key: i, style: 'margin-top:4px;font-size:12px;' }, d.hash.slice(0, 12) + '… ×' + d.files.length + ': ' + d.files.map((f) => f.name).join(', '))) : null]) : null,
        this.tab === 'gen' ? h('div', null, [h('button', { class: 'btn', onclick: () => this.gen() }, '生成 checksums.sha256'), this.gen ? h('a', { href: this.gen.download, class: 'btn btn-sm', style: 'margin-left:6px;' }, '下载') : null]) : null,
        this.tab === 'verify' ? h('div', null, [h('p', { class: 'faint', style: 'font-size:12px;' }, '上传校验文件(.md5/.sha1/.sha256) + 对应数据文件'), h('button', { class: 'btn', onclick: () => this.verify() }, '校验'),
          this.verify ? h('table', { class: 'table', style: 'margin-top:6px;' }, [h('thead', null, h('tr', null, ['文件', '状态'].map((x) => h('th', null, x)))), h('tbody', null, this.verify.results.map((r, i) => h('tr', { key: i }, [h('td', null, r.file), h('td', { style: { color: r.status === 'ok' ? '#2e9e5b' : '#f85149' } }, r.status)])))]) : null]) : null,
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