// imagetool 插件前端(接口库 v4): Vue3 展示层, base64 传参。
import { createApp, h } from 'vue'

const NAME = 'imagetool'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'similar', simImg: [], procImg: [], similar: null, procResults: [], procOpts: { format: 'png', resize: '', quality: '', rotate: '' }, err: '' } },
    methods: {
      b64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file) }) },
      async pick(list, e) {
        const files = e.target.files ? Array.from(e.target.files) : []
        list.splice(0, list.length)
        for (const f of files.slice(0, 2)) list.push(await this.b64(f))
        e.target.value = ''
      },
      async similar() {
        if (this.simImg.length < 2) { this.err = '请选两张图'; return }
        this.err = ''
        try { this.similar = await ctx.invoke('imagetool.similar', { images: this.simImg }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async process() {
        if (!this.procImg.length) { this.err = '请选图'; return }
        this.err = ''
        try {
          const r = await ctx.invoke('imagetool.process', { images: this.procImg.map((d) => ({ data: d, name: 'img' })), format: this.procOpts.format, resize: this.procOpts.resize, quality: this.procOpts.quality, rotate: this.procOpts.rotate })
          this.procResults = (r && r.results) || []
        } catch (e) { this.err = (e && e.message) || e }
      },
    },
    render() {
      const tabBtn = (k, label) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, label)
      const simView = h('div', null, [
        h('input', { type: 'file', accept: 'image/*', multiple: true, onchange: (e) => this.pick(this.simImg, e), class: 'input', style: 'margin-bottom:8px;' }),
        h('div', { class: 'flex', style: 'gap:8px;margin-bottom:8px;max-height:140px;overflow:hidden;' }, this.simImg.map((d) => h('img', { src: d, style: 'max-height:130px;' }))),
        h('button', { class: 'btn', onclick: () => this.similar() }, '对比相似度'),
        this.similar ? h('p', null, '相似度: ' + this.similar.similarity + '% · ' + this.similar.verdict + ' (汉明 ' + this.similar.hamming + ')') : null,
      ])
      const procView = h('div', null, [
        h('input', { type: 'file', accept: 'image/*', multiple: true, onchange: (e) => this.pick(this.procImg, e), class: 'input', style: 'margin-bottom:8px;' }),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' }, [
          h('select', { class: 'input', value: this.procOpts.format, onchange: (e) => (this.procOpts.format = e.target.value) }, ['png', 'jpg', 'webp', 'gif'].map((f) => h('option', { value: f }, f))),
          h('input', { class: 'input', style: 'width:110px;', placeholder: '缩放 50%', value: this.procOpts.resize, oninput: (e) => (this.procOpts.resize = e.target.value) }),
          h('input', { class: 'input', style: 'width:80px;', placeholder: '质量', value: this.procOpts.quality, oninput: (e) => (this.procOpts.quality = e.target.value) }),
          h('input', { class: 'input', style: 'width:80px;', placeholder: '旋转', value: this.procOpts.rotate, oninput: (e) => (this.procOpts.rotate = e.target.value) }),
          h('button', { class: 'btn', onclick: () => this.process() }, '处理'),
        ]),
        this.procResults.map((r) => h('div', { class: 'card', style: 'padding:8px;margin-bottom:8px;' }, [
          h('div', null, r.name + ' ' + (r.ok ? '✅' : '❌ ' + (r.error || ''))),
          r.output ? h('img', { src: r.output, style: 'max-width:180px;margin-top:6px;' }) : null,
        ])),
      ])
      return h('div', { class: 'imagetool-panel' }, [
        h('div', { class: 'section-title' }, '图像工具'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:10px;' }, [tabBtn('similar', '相似度'), tabBtn('process', '图像处理')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'similar' ? simView : procView,
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '图像工具' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}