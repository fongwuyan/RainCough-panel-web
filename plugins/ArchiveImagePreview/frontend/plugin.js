// 压缩包图片预览前端
import { createApp, h } from 'vue'

const NAME = 'ArchiveImagePreview'
const CHUNK = 3 * 1024 * 1024

function b64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

function mount(container, ctx) {
  const App = {
    data() {
      return {
        archives: [], cur: null, entries: [], loading: false, uploading: false,
        progress: 0, err: '', lightbox: null, limit: 300, fileEl: null,
      }
    },
    computed: {
      visible() { return this.entries.slice(0, this.limit) },
    },
    methods: {
      fmt(n) {
        n = Number(n) || 0
        if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB'
        if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(2) + ' MB'
        if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
        return n + ' B'
      },
      thumb(aid, idx) { return '/api/plugins/ArchiveImagePreview/thumb/' + aid + '/' + idx },
      preview(aid, idx) { return '/api/plugins/ArchiveImagePreview/preview/' + aid + '/' + idx },
      original(aid, idx) { return '/api/plugins/ArchiveImagePreview/original/' + aid + '/' + idx },
      async load() {
        try {
          const r = await ctx.invoke('zipimg.list', {})
          this.archives = (r && r.archives) || []
          if (this.cur && !this.archives.some(x => x.id === this.cur.id)) this.cur = null
        } catch (e) { this.err = e.message || String(e) }
      },
      async open(a) {
        this.cur = a; this.limit = 300; this.loading = true; this.err = ''
        try {
          const r = await ctx.invoke('zipimg.entries', { aid: a.id })
          this.entries = (r && r.entries) || []
        } catch (e) { this.err = e.message || String(e) }
        finally { this.loading = false }
      },
      async upload(file) {
        if (!file) return
        this.uploading = true; this.progress = 0; this.err = ''
        try {
          const st = await ctx.invoke('zipimg.upload.start', { filename: file.name, size: file.size })
          const uid = st.upload_id
          for (let off = 0, i = 0; off < file.size; off += CHUNK, i++) {
            const data = await b64(file.slice(off, Math.min(off + CHUNK, file.size)))
            await ctx.invoke('zipimg.upload.chunk', { upload_id: uid, index: i, data })
            this.progress = Math.min(99, Math.round((off + CHUNK) * 100 / file.size))
          }
          const r = await ctx.invoke('zipimg.upload.finish', { upload_id: uid })
          this.progress = 100
          await this.load()
          if (r && r.archive) await this.open(r.archive)
        } catch (e) { this.err = e.message || String(e) }
        finally { this.uploading = false }
      },
      onFile(e) { const f = e.target.files && e.target.files[0]; if (f) this.upload(f); e.target.value = '' },
      async del(a) {
        if (!confirm('删除压缩包及缩略图缓存？')) return
        try { await ctx.invoke('zipimg.delete', { aid: a.id }); if (this.cur && this.cur.id === a.id) this.cur = null; await this.load() }
        catch (e) { this.err = e.message || String(e) }
      },
    },
    mounted() { this.load() },
    render() {
      const btn = (text, fn, cls = 'btn btn-sm') => h('button', { class: cls, onclick: fn }, text)
      const small = t => h('div', { class: 'faint', style: 'font-size:11px;' }, t)
      const cards = this.visible.map(e => h('div', {
        key: e.idx, class: 'card',
        style: 'padding:0;overflow:hidden;cursor:zoom-in;position:relative;',
        onclick: () => { this.lightbox = { src: this.preview(this.cur.id, e.idx), name: e.name, aid: this.cur.id, idx: e.idx } },
      }, [
        h('div', { style: 'height:120px;background:var(--bg2,#111);display:flex;align-items:center;justify-content:center;overflow:hidden;' }, [
          h('img', { src: this.thumb(this.cur.id, e.idx), loading: 'lazy', style: 'max-width:100%;max-height:120px;object-fit:contain;' }),
        ]),
        h('div', { style: 'padding:5px 6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', title: e.name }, e.name),
        small(e.ext.replace('.', '').toUpperCase() + ' · ' + this.fmt(e.size)),
      ]))
      return h('div', null, [
        h('div', { class: 'section-title' }, '压缩包图片预览'),
        h('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center;' }, [
          h('input', { type: 'file', accept: '.zip,.tar,.gz,.tgz,.bz2,.xz,.7z,.rar,.cbz,.cbr', onchange: e => this.onFile(e), style: 'font-size:12px;' }),
          this.uploading ? h('span', { class: 'faint', style: 'font-size:12px;' }, '上传 ' + this.progress + '%') : null,
          btn('刷新列表', () => this.load()),
        ]),
        h('div', { class: 'faint', style: 'font-size:11px;margin-bottom:8px;' }, '支持 ZIP / TAR / TAR.GZ / 7Z / RAR / CBZ / CBR；图片格式遇到浏览器不支持的会自动转成 PNG/JPEG。'),
        this.err ? h('div', { style: 'color:var(--danger);font-size:12px;margin-bottom:6px;' }, this.err) : null,
        this.archives.length ? h('div', { class: 'flex', style: 'gap:6px;flex-wrap:wrap;margin-bottom:8px;' }, this.archives.map(a => h('div', {
          key: a.id, class: 'card', style: 'padding:6px 8px;cursor:pointer;' + (this.cur && this.cur.id === a.id ? 'border-color:var(--primary);' : ''),
          onclick: () => this.open(a),
        }, [
          h('b', { style: 'font-size:12px;' }, a.name),
          small(a.kind.toUpperCase() + ' · ' + this.fmt(a.size) + ' · ' + a.images + ' 张'),
          h('div', { style: 'margin-top:4px;' }, [btn('删除', () => this.del(a), 'btn btn-sm btn-danger')]),
        ]))) : h('div', { class: 'faint' }, '还没有上传压缩包'),
        this.cur ? h('div', null, [
          h('div', { class: 'flex', style: 'justify-content:space-between;align-items:center;margin:8px 0;' }, [
            h('b', null, this.cur.name + ' · ' + this.entries.length + ' 张图片'),
            this.entries.length > this.limit ? btn('加载更多', () => this.limit += 300) : null,
          ]),
          this.loading ? h('div', { class: 'faint' }, '扫描中…') : h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px;' }, cards),
        ]) : null,
        this.lightbox ? h('div', {
          style: 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;',
          onclick: e => { if (e.target === e.currentTarget) this.lightbox = null },
        }, [
          h('img', { src: this.lightbox.src, style: 'max-width:92vw;max-height:82vh;object-fit:contain;' }),
          h('div', { style: 'color:#fff;font-size:12px;margin-top:8px;word-break:break-all;' }, this.lightbox.name),
          h('div', { class: 'flex', style: 'gap:8px;margin-top:8px;' }, [
            h('a', { class: 'btn btn-sm', href: this.original(this.lightbox.aid, this.lightbox.idx) }, '下载原图'),
            btn('关闭', () => this.lightbox = null),
          ]),
        ]) : null,
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '压缩包图片预览' }], mount }
}
if (typeof window !== 'undefined') register(window)
