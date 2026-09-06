// aigen 插件前端(接口库 v4): Vue3 展示层, 全部 ctx.invoke。
import { createApp, h } from 'vue'

const NAME = 'aigen'

function mount(container, ctx) {
  const App = {
    data() {
      return {
        models: [], model: '', prompt: '', negative: '',
        steps: 20, size: 512, busy: false,
        jobId: '', jobStatus: null, resultImgs: [],
        gallery: [], loading: true, err: '',
      }
    },
    methods: {
      async loadModels() {
        try {
          const r = await ctx.invoke('aigen.models')
          this.models = (r && r.models) || []
          this.model = (this.models[0] && this.models[0].name) || ''
        } catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async loadGallery() {
        try {
          const r = await ctx.invoke('aigen.gallery', { limit: 48 })
          this.gallery = (r && r.items) || []
        } catch (e) {}
      },
      async generate() {
        if (!this.prompt.trim()) return
        this.busy = true
        this.err = ''
        this.jobStatus = null
        this.resultImgs = []
        try {
          const r = await ctx.invoke('aigen.generate', {
            prompt: this.prompt, negative_prompt: this.negative,
            steps: Number(this.steps) || 20, width: Number(this.size) || 512,
            height: Number(this.size) || 512, model: this.model,
          })
          this.jobId = (r && r.job_id) || ''
          this.poll()
        } catch (e) { this.err = (e && e.message) || e }
        this.busy = false
      },
      poll() {
        const self = this
        const iv = setInterval(async () => {
          try {
            const d = await ctx.invoke('aigen.status', { job_id: self.jobId })
            self.jobStatus = d
            if (d.status === 'done' || d.status === 'error' || d.status === 'cancelled') {
              clearInterval(iv)
              if (d.status === 'done') {
                self.resultImgs = d.images || []
                self.loadGallery()
              }
            }
          } catch (e) { clearInterval(iv) }
        }, 1500)
      },
    },
    mounted() { this.loadModels(); this.loadGallery() },
    render() {
      const self = this
      const imgs = (this.resultImgs.length ? this.resultImgs : []).map((u) =>
        h('img', { src: u, style: 'max-width:100%;border:1px solid var(--border);border-radius:6px;' }))
      const gal = this.gallery.map((it) =>
        h('div', { key: it.name, class: 'card', style: 'padding:6px;' }, [
          h('img', { src: it.url, loading: 'lazy', style: 'width:100%;display:block;' }),
          h('div', { class: 'mono faint', style: 'font-size:10px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, it.name),
        ]))
      return h('div', { class: 'aigen-panel' }, [
        h('div', { class: 'section' }, [
          h('div', { class: 'section-title' }, 'AI 生图(Stable Diffusion 本地)'),
          this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
          h('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap;margin-bottom:8px;' }, [
            h('select', { value: this.model, onchange: (e) => (this.model = e.target.value), class: 'input' },
              this.models.map((m) => h('option', { value: m.name }, m.name))),
            h('label', null, ['步数 ']),
            h('input', { type: 'number', value: this.steps, oninput: (e) => (this.steps = e.target.value), class: 'input', style: 'width:70px' }),
            h('label', null, ['尺寸 ']),
            h('select', { value: this.size, onchange: (e) => (this.size = e.target.value), class: 'input' },
              [512, 768].map((s) => h('option', { value: s }, s + 'px'))),
          ]),
          h('textarea', { placeholder: '提示词 (prompt)...', value: this.prompt, oninput: (e) => (this.prompt = e.target.value), class: 'input', style: 'width:100%;min-height:60px;font-family:var(--font-mono);' }),
          h('input', { placeholder: '负面提示词 (negative, 可选)', value: this.negative, oninput: (e) => (this.negative = e.target.value), class: 'input', style: 'width:100%;margin-top:6px;' }),
          h('div', { style: 'margin-top:8px;' }, [
            h('button', { class: 'btn btn-primary', onclick: () => this.generate(), disabled: this.busy }, this.busy ? '提交中...' : '开始生成'),
          ]),
          this.jobStatus ? h('p', { class: 'mono', style: 'color:var(--text-faint);font-size:12px;' },
            '任务 ' + this.jobId + ': ' + this.jobStatus.status + ' ' + (this.jobStatus.progress || 0) + '%') : null,
          this.resultImgs.length ? h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:10px;' }, imgs) : null,
        ]),
        h('div', { class: 'section' }, [
          h('div', { class: 'section-title' }, '最近生成'),
          h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;' }, gal),
        ]),
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'AI 生图' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}