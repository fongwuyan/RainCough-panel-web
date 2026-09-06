// mcskin 插件前端(接口库 v4): 转皮肤(上传图) + 文生肤(prompt)
import { createApp, h } from 'vue'

const NAME = 'mcskin'
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'convert', img: '', model: 'wide', result: null, err: '', prompt: '', t2s: null } },
    methods: {
      async pick(e) {
        const f = e.target.files && e.target.files[0]
        if (f) { this.img = await b64(f); e.target.value = '' }
      },
      async convert() {
        if (!this.img) { this.err = '请选择图片'; return }
        this.err = ''
        try { this.result = await ctx.invoke('mcskin.convert', { image: this.img, model: this.model }) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async t2s() {
        if (!this.prompt.trim()) { this.err = '请输入角色描述'; return }
        this.err = ''
        try { this.t2s = await ctx.invoke('mcskin.text2skin', { prompt: this.prompt, style: 'modern', tone: 'any' }) }
        catch (e) { this.err = (e && e.message) || e }
        this.poll()
      },
      poll() {
        const self = this
        const iv = setInterval(async () => {
          try {
            const d = await ctx.invoke('mcskin.text2skin.status', { job_id: self.t2s.job_id })
            self.t2s = d
            if (d.status === 'done' || d.status === 'error') clearInterval(iv)
          } catch (e) { clearInterval(iv) }
        }, 2000)
      },
    },
    render() {
      const tab = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      return h('div', null, [
        h('div', { class: 'section-title' }, '图片转皮肤'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [tab('convert', '转皮肤'), tab('t2s', '文生肤')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'convert' ? h('div', null, [
          h('input', { type: 'file', accept: 'image/*', onchange: (e) => this.pick(e), class: 'input', style: 'margin-bottom:8px;' }),
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [
            h('select', { class: 'input', value: this.model, onchange: (e) => (this.model = e.target.value) }, ['wide', 'slim'].map((m) => h('option', { value: m }, m === 'wide' ? 'Steve(宽)' : 'Alex(窄)'))),
            h('button', { class: 'btn', onclick: () => this.convert() }, '生成皮肤'),
          ]),
          this.result ? h('div', null, [
            this.result.png ? h('img', { src: 'data:image/png;base64,' + this.result.png, style: 'max-width:220px;image-rendering:pixelated;' }) : null,
            h('p', { class: 'faint', style: 'font-size:12px;' }, '尺寸 ' + (this.result.size || []).join('×') + ' · ' + this.result.model),
          ]) : null,
        ]) : null,
        this.tab === 't2s' ? h('div', null, [
          h('input', { class: 'input', style: 'width:100%;margin-bottom:8px;', placeholder: '角色描述, 如 "银发红瞳的狐耳少女"', value: this.prompt, oninput: (e) => (this.prompt = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.t2s() } }),
          h('button', { class: 'btn', onclick: () => this.t2s() }, '生成(异步)'),
          this.t2s ? h('p', { class: 'mono', style: 'font-size:12px;margin-top:8px;' }, '任务 ' + (this.t2s.job_id || this.t2s.id) + ': ' + (this.t2s.status || '') + ' ' + (this.t2s.progress || 0) + '%') : null,
        ]) : null,
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '图片转皮肤' }], mount }
}
if (typeof window !== 'undefined') register(window)