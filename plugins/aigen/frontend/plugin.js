// aigen 插件 Vue3 前端组件(独立构建, 完全自包含, Vue 已内联打包)
// 契约: window.__rcPlugin_aigen = { mount(container, ctx) }
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_aigen = {
    name: 'aigen',
    mount: function (container, ctx) {
      
      const App = {
        data() {
          return {
            models: [], model: '', prompt: '', negative: '',
            steps: 20, size: 512, busy: false,
            task: null, taskStatus: null,
            gallery: [], loading: true,
          }
        },
        methods: {
          async loadModels() {
            try {
              const r = await fetch('/api/plugins/aigen/models')
              const d = await r.json()
              this.models = d.models || []
              this.model = this.models[0] || ''
            } catch (e) { console.error(e) }
            this.loading = false
          },
          async loadGallery() {
            try {
              const r = await fetch('/api/plugins/aigen/gallery')
              const d = await r.json()
              this.gallery = d.items || []
            } catch (e) { console.error(e) }
          },
          async generate() {
            if (!this.prompt.trim()) return
            this.busy = true
            try {
              const r = await fetch('/api/plugins/aigen/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: this.prompt, negative_prompt: this.negative,
                  steps: Number(this.steps) || 20, size: Number(this.size) || 512,
                  model: this.model,
                })
              })
              const d = await r.json()
              this.task = d.task
              this.poll()
            } catch (e) { alert('启动失败: ' + e.message) }
            this.busy = false
          },
          poll() {
            const self = this
            const iv = setInterval(async () => {
              try {
                const r = await fetch('/api/plugins/aigen/status/' + self.task)
                const d = await r.json()
                self.taskStatus = d
                if (d.status === 'done' || d.status === 'failed') {
                  clearInterval(iv)
                  if (d.status === 'done') {
                    const o = await fetch('/api/plugins/aigen/output/' + self.task).then((x) => x.json())
                    self.resultImg = (o && o.image_b64) ? 'data:image/png;base64,' + o.image_b64 : ''
                    self.loadGallery()
                  }
                }
              } catch (e) { clearInterval(iv) }
            }, 1500)
          }
        },
        mounted() { this.loadModels(); this.loadGallery() },
        render() {
          const self = this
          return h('div', { class: 'aigen-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, 'AI 生图(Stable Diffusion 本地)'),
              h('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap;margin-bottom:8px;' }, [
                h('select', { value: this.model, onchange: (e) => (this.model = e.target.value), class: 'input' },
                  this.models.map((m) => h('option', { value: m }, m))),
                h('label', null, ['步数 ']),
                h('input', { type: 'number', value: this.steps, oninput: (e) => (this.steps = e.target.value), class: 'input', style: 'width:70px' }),
                h('label', null, ['尺寸 ']),
                h('select', { value: this.size, onchange: (e) => (this.size = e.target.value), class: 'input' },
                  [512, 768].map((s) => h('option', { value: s }, s + 'px'))),
              ]),
              h('textarea', { placeholder: '提示词 (prompt)...', value: this.prompt, oninput: (e) => (this.prompt = e.target.value), class: 'input', style: 'width:100%;min-height:60px;font-family:var(--font-mono);' }),
              h('input', { placeholder: '负面提示词 (negative, 可选)', value: this.negative, oninput: (e) => (this.negative = e.target.value), class: 'input', style: 'width:100%;margin-top:6px;' }),
              h('div', { style: 'margin-top:8px;' }, [
                h('button', { class: 'btn btn-primary', onclick: () => this.generate(), disabled: this.busy }, this.busy ? '生成中...' : '开始生成'),
              ]),
              this.taskStatus ? h('p', { class: 'mono', style: 'color:var(--text-faint);font-size:12px;' },
                '任务 ' + this.task + ': ' + this.taskStatus.message + ' ' + (this.taskStatus.progress || 0) + '%') : null,
              this.resultImg ? h('img', { src: this.resultImg, style: 'max-width:360px;margin-top:10px;border:1px solid var(--border);' }) : null,
            ]),
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '最近生成'),
              h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;' },
                (this.gallery || []).map((it) => h('div', { key: it.name, class: 'card', style: 'padding:6px;' }, [
                  h('img', { src: 'data:image/png;base64,' + it.data, style: 'width:100%;display:block;' }),
                  h('div', { class: 'mono faint', style: 'font-size:10px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, it.name)
                ])))
            ])
          ])
        }
      }
      const vm = createApp(App)
      vm.mount(container)
      return () => vm.unmount()
    }
  }
}

if (typeof window !== 'undefined') {
  register(window)
}