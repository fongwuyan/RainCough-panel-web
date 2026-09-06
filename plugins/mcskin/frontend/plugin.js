// mcskin 插件前端(接口库 v4): 转皮肤 / AI 上色 / 文生肤
import { createApp, h } from 'vue'

const NAME = 'mcskin'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'convert', img: '', model: 'wide', result: null, prompt: '', t2s: null, hist: [], paint: null, pImg: '', err: '', timer: null } },
    methods: {
      async pick(e, key) {
        const f = e.target.files && e.target.files[0]
        if (f) { this[key] = await b64(f); e.target.value = '' }
      },
      async convert() {
        if (!this.img) { this.err = '请选择图片'; return }
        this.err = ''
        try { this.result = await ctx.invoke('mcskin.convert', { image: this.img, model: this.model }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async paint() {
        if (!this.pImg) { this.err = '请选择图片'; return }
        this.err = ''
        try { this.paint = await ctx.invoke('mcskin.paint', { image: this.pImg, body: 'wide', model: null, prompt: this.prompt }) ; this.pollPaint() }
        catch (e) { this.err = (e && e.message) || e }
      },
      pollPaint() {
        const self = this
        clearInterval(this.timer)
        this.timer = setInterval(async () => {
          try {
            const d = await ctx.invoke('mcskin.paint.status', { job_id: self.paint.job_id })
            self.paint = d
            if (['done', 'error', 'cancelled'].includes(d.status)) clearInterval(self.timer)
          } catch (e) { clearInterval(self.timer) }
        }, 2000)
      },
      async t2s() {
        if (!this.prompt.trim()) { this.err = '请输入角色描述'; return }
        this.err = ''
        try { this.t2s = await ctx.invoke('mcskin.text2skin', { prompt: this.prompt, style: 'modern', tone: 'any' }) }
        catch (e) { this.err = (e && e.message) || e }
        this.pollT2s()
      },
      pollT2s() {
        const self = this
        clearInterval(this.timer)
        this.timer = setInterval(async () => {
          try {
            const d = await ctx.invoke('mcskin.text2skin.status', { job_id: self.t2s.job_id })
            self.t2s = d
            if (['done', 'error', 'cancelled'].includes(d.status)) { clearInterval(self.timer); self.loadHist() }
          } catch (e) { clearInterval(self.timer) }
        }, 2000)
      },
      async loadHist() { try { const r = await ctx.invoke('mcskin.text2skin.history'); this.hist = (r && r.history) || [] } catch (e) {} },
    },
    mounted() { this.loadHist() },
    unmounted() { clearInterval(this.timer) },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      const skin = this.result ? (this.result.png ? 'data:image/png;base64,' + this.result.png : '') : ''
      return h('div', null, [
        h('div', { class: 'section-title' }, '图片转皮肤'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [t('convert', '转皮肤'), t('paint', 'AI 上色'), t('t2s', '文生肤')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'convert' ? h('div', null, [
          h('input', { type: 'file', accept: 'image/*', onchange: (e) => this.pick(e, 'img'), class: 'input', style: 'width:100%;margin-bottom:8px;' }),
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('select', { class: 'input', value: this.model, onchange: (e) => (this.model = e.target.value) }, ['wide', 'slim'].map((m) => h('option', { value: m }, m === 'wide' ? 'Steve(宽)' : 'Alex(窄)'))),
            h('button', { class: 'btn', onclick: () => this.convert() }, '生成皮肤'),
          ]),
          skin ? h('img', { src: skin, style: 'max-width:260px;image-rendering:pixelated;border:1px solid var(--border);border-radius:6px;' }) : null,
        ]) : null,
        this.tab === 'paint' ? h('div', null, [
          h('input', { type: 'file', accept: 'image/*', onchange: (e) => this.pick(e, 'pImg'), class: 'input', style: 'width:100%;margin-bottom:8px;' }),
          h('input', { class: 'input', style: 'width:100%;margin-bottom:8px;', placeholder: '提示词(可选)', value: this.prompt, oninput: (e) => (this.prompt = e.target.value) }),
          h('button', { class: 'btn', onclick: () => this.paint() }, '开始 AI 上色(异步)'),
          this.paint ? h('p', { class: 'mono faint', style: 'font-size:12px;margin-top:6px;' }, '任务 ' + (this.paint.job_id || this.paint.id) + ': ' + (this.paint.status || '') + ' ' + (this.paint.progress || 0) + '%') : null,
          this.paint && this.paint.png ? h('img', { src: 'data:image/png;base64,' + this.paint.png, style: 'max-width:260px;margin-top:6px;image-rendering:pixelated;' }) : null,
        ]) : null,
        this.tab === 't2s' ? h('div', null, [
          h('input', { class: 'input', style: 'width:100%;margin-bottom:8px;', placeholder: '角色描述', value: this.prompt, oninput: (e) => (this.prompt = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.t2s() } }),
          h('button', { class: 'btn', onclick: () => this.t2s() }, '生成(异步)'),
          this.t2s ? h('p', { class: 'mono faint', style: 'font-size:12px;margin:6px 0;' }, '任务 ' + (this.t2s.job_id || this.t2s.id) + ': ' + (this.t2s.status || '') + ' ' + (this.t2s.progress || 0) + '%') : null,
          this.hist.length ? h('div', { class: 'section', style: 'margin-top:8px;' }, [
            h('div', { class: 'section-title' }, '历史'),
            this.hist.slice(0, 10).map((x) => h('div', { key: x.id, style: 'font-size:12px;padding:3px 0;border-bottom:1px solid var(--border);' }, (x.prompt || '').slice(0, 60) + ' · ' + (x.status || '') + ' · ' + (x.candidates || []).length + ' 候选')),
          ]) : null,
        ]) : null,
      ])
    },
  }
  const vm = createApp(App)
  const stop = () => { if (App.unmounted) App.unmounted(); vm.unmount() }
  vm.mount(container)
  return stop
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '图片转皮肤' }], mount }
}
if (typeof window !== 'undefined') register(window)