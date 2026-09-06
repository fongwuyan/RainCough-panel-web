// ocrqr 插件前端(接口库 v4): Vue3 展示层, ctx.invoke; 图片以 base64 传参。
import { createApp, h } from 'vue'

const NAME = 'ocrqr'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'ocr', env: null, ocrText: '', ocrLoading: false, qrText: '', qrUrl: '', decResults: [], err: '' } },
    methods: {
      async loadEnv() {
        try { this.env = await ctx.invoke('ocrqr.ocr.check') } catch (e) {}
      },
      fileToB64(file) {
        return new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result))
          r.onerror = reject
          r.readAsDataURL(file)
        })
      },
      async pickOcr(e) {
        const f = e.target.files && e.target.files[0]
        if (!f) return
        this.ocrLoading = true; this.err = ''
        try {
          const img = await this.fileToB64(f)
          const r = await ctx.invoke('ocrqr.ocr', { image: img })
          this.ocrText = (r && r.text) || ''
        } catch (ex) { this.err = (ex && ex.message) || ex }
        this.ocrLoading = false
      },
      async genQr() {
        if (!this.qrText.trim()) return
        this.err = ''
        try { const r = await ctx.invoke('ocrqr.qr.gen', { text: this.qrText, size: 300 }); this.qrUrl = (r && r.url) || '' }
        catch (e) { this.err = (e && e.message) || e }
      },
      async pickDecode(e) {
        const f = e.target.files && e.target.files[0]
        if (!f) return
        this.err = ''
        try {
          const img = await this.fileToB64(f)
          const r = await ctx.invoke('ocrqr.qr.decode', { image: img })
          this.decResults = (r && r.results) || []
        } catch (ex) { this.err = (ex && ex.message) || ex }
      },
    },
    mounted() { this.loadEnv() },
    render() {
      const env = this.env
      const envBar = env ? h('div', { class: 'faint', style: 'font-size:12px;margin-bottom:8px;' },
        'OCR 环境: ' + (env.ok ? '就绪' : '未就绪') + (env.models ? ' · 模型' : '') + (env.package ? ' · rapidocr' : '')) : null
      const tabBtn = (k, label) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, label)
      const ocrView = h('div', null, [
        h('input', { type: 'file', accept: 'image/*', onchange: (e) => this.pickOcr(e), class: 'input', style: 'margin-bottom:8px;' }),
        this.ocrLoading ? h('p', { class: 'hint' }, '识别中...') : null,
        this.ocrText ? h('pre', { style: 'background:#0d1117;color:#c9d1d9;padding:10px;border-radius:6px;white-space:pre-wrap;' }, this.ocrText) : null,
      ])
      const qrGenView = h('div', null, [
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
          h('input', { class: 'input', style: 'flex:1;', placeholder: '二维码内容', value: this.qrText, oninput: (e) => (this.qrText = e.target.value) }),
          h('button', { class: 'btn', onclick: () => this.genQr() }, '生成'),
        ]),
        this.qrUrl ? h('img', { src: this.qrUrl, style: 'max-width:260px;border:1px solid var(--border);border-radius:6px;' }) : null,
      ])
      const qrDecView = h('div', null, [
        h('input', { type: 'file', accept: 'image/*', onchange: (e) => this.pickDecode(e), class: 'input', style: 'margin-bottom:8px;' }),
        this.decResults.map((r, i) => h('div', { key: i, class: 'card', style: 'padding:8px;margin-bottom:6px;' }, r.data)),
      ])
      return h('div', { class: 'ocrqr-panel' }, [
        h('div', { class: 'section-title' }, 'OCR / 二维码'), envBar,
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:10px;' }, [tabBtn('ocr', 'OCR 识别'), tabBtn('qrgen', '二维码生成'), tabBtn('qrdec', '二维码解码')]),
        this.tab === 'ocr' ? ocrView : (this.tab === 'qrgen' ? qrGenView : qrDecView),
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'OCR / 二维码' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}