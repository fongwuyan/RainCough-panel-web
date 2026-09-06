// aigen 插件前端(接口库 v4): 文生图 + 图生图 + 画廊管理
import { createApp, h } from 'vue'

const NAME = 'aigen'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() {
      return { tab: 't2i', models: [], model: '', prompt: '', negative: '', steps: 20, size: 512, img: '',
        busy: false, jobId: '', jobStatus: null, resultImgs: [], gallery: [], loading: true, err: '' }
    },
    methods: {
      async loadModels() {
        try { const r = await ctx.invoke('aigen.models'); this.models = (r && r.models) || []; this.model = (this.models[0] && this.models[0].name) || '' }
        catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async loadGallery() {
        try { const r = await ctx.invoke('aigen.gallery', { limit: 60 }); this.gallery = (r && r.items) || [] }
        catch (e) {}
      },
      async pick(e) {
        const f = e.target.files && e.target.files[0]
        if (f) { this.img = await b64(f); e.target.value = '' }
      },
      async run(mode) {
        const p = { prompt: this.prompt, negative_prompt: this.negative, steps: Number(this.steps) || 20, width: Number(this.size) || 512, height: Number(this.size) || 512, model: this.model }
        if (mode === 'img2img') { if (!this.img) { this.err = '请选择输入图片'; return } p.image = this.img }
        this.busy = true; this.err = ''; this.jobStatus = null; this.resultImgs = []
        try { const r = await ctx.invoke(mode === 'img2img' ? 'aigen.img2img' : 'aigen.generate', p); this.jobId = (r && r.job_id) || ''; this.poll() }
        catch (e) { this.err = (e && e.message) || e }
        this.busy = false
      },
      poll() {
        const self = this
        const iv = setInterval(async () => {
          try {
            const d = await ctx.invoke('aigen.status', { job_id: self.jobId })
            self.jobStatus = d
            if (['done', 'error', 'cancelled'].includes(d.status)) {
              clearInterval(iv)
              if (d.status === 'done') { self.resultImgs = d.images || []; self.loadGallery() }
            }
          } catch (e) { clearInterval(iv) }
        }, 1500)
      },
      async cancel() {
        if (!this.jobId) return
        try { await ctx.invoke('aigen.cancel', { job_id: this.jobId }); this.err = '已请求取消' }
        catch (e) { this.err = (e && e.message) || e }
      },
      async delImg(name) {
        try { await ctx.invoke('aigen.gallery.delete', { name }); this.loadGallery() }
        catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() { this.loadModels(); this.loadGallery() },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      return h('div', null, [
        h('div', { class: 'section-title' }, 'AI 生图(Stable Diffusion 本地)'),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [t('t2i', '文生图'), t('i2i', '图生图'), t('g', '画廊')]),
        this.tab !== 'g' ? h('div', { class: 'section' }, [
          h('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap;margin-bottom:8px;' }, [
            h('select', { class: 'input', value: this.model, onchange: (e) => (this.model = e.target.value) }, this.models.map((m) => h('option', { value: m.name }, m.name))),
            h('label', null, ['步数 ']), h('input', { class: 'input', style: 'width:60px;', type: 'number', value: this.steps, oninput: (e) => (this.steps = e.target.value) }),
            h('label', null, ['尺寸 ']), h('select', { class: 'input', value: this.size, onchange: (e) => (this.size = e.target.value) }, [512, 768].map((s) => h('option', { value: s }, s))),
          ]),
          this.tab === 'i2i' ? h('input', { type: 'file', accept: 'image/*', onchange: (e) => this.pick(e), class: 'input', style: 'margin-bottom:8px;width:100%;' }) : null,
          h('textarea', { class: 'input', style: 'width:100%;min-height:60px;font-family:var(--font-mono);', placeholder: '提示词', value: this.prompt, oninput: (e) => (this.prompt = e.target.value) }),
          h('input', { class: 'input', style: 'width:100%;margin-top:6px;', placeholder: '负面提示词', value: this.negative, oninput: (e) => (this.negative = e.target.value) }),
          h('div', { class: 'flex', style: 'gap:6px;margin-top:8px;' }, [
            h('button', { class: 'btn btn-primary', disabled: this.busy, onclick: () => this.run(this.tab === 'i2i' ? 'img2img' : 'text2img') }, this.busy ? '提交中...' : '生成'),
            this.jobId ? h('button', { class: 'btn', onclick: () => this.cancel() }, '取消') : null,
          ]),
          this.jobStatus ? h('p', { class: 'mono faint', style: 'font-size:12px;' }, '任务 ' + this.jobId + ': ' + this.jobStatus.status + ' ' + (this.jobStatus.progress || 0) + '%') : null,
          this.resultImgs.length ? h('div', { class: 'flex', style: 'gap:10px;margin-top:10px;flex-wrap:wrap;' }, this.resultImgs.map((u) => h('img', { src: u, style: 'max-width:200px;border:1px solid var(--border);border-radius:6px;' }))) : null,
        ]) : h('div', { class: 'section' }, [
          h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;' },
            this.gallery.map((it) => h('div', { key: it.name, class: 'card', style: 'padding:6px;' }, [
              h('img', { src: it.url, loading: 'lazy', style: 'width:100%;display:block;' }),
              h('div', { class: 'mono faint', style: 'font-size:10px;' }, it.name),
              h('button', { class: 'btn btn-sm btn-danger', style: 'margin-top:4px;width:100%;', onclick: () => this.delImg(it.name) }, '删除'),
            ]))),
        ]),
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'AI 生图' }], mount }
}
if (typeof window !== 'undefined') register(window)