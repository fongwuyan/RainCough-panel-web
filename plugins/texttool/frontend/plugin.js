// texttool 插件前端(接口库 v4): Vue3 展示层, ctx.invoke。
import { createApp, h } from 'vue'

const NAME = 'texttool'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'regex', err: '', out: '', pattern: '', text: '', flags: 0, find: '', repl: '', rx: false, content: '', act: 'json2yaml' } },
    methods: {
      async run(iface, payload) {
        this.err = ''; this.out = ''
        try {
          const r = await ctx.invoke(iface, payload)
          this.out = JSON.stringify(r, null, 2)
        } catch (e) { this.err = (e && e.message) || e }
      },
    },
    render() {
      const textarea = (key, hint) => h('textarea', { class: 'input', style: 'width:100%;min-height:130px;font-family:var(--font-mono);', placeholder: hint, value: this[key], oninput: (e) => (this[key] = e.target.value) })
      const tabBtn = (k, label) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, label)
      const views = {
        regex: h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:6px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '正则表达式', value: this.pattern, oninput: (e) => (this.pattern = e.target.value) }),
            h('button', { class: 'btn', onclick: () => this.run('texttool.regex', { pattern: this.pattern, text: this.text, flags: Number(this.flags) }) }, '匹配'),
          ]), textarea('text', '待匹配文本'),
        ]),
        replace: h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:6px;flex-wrap:wrap;' }, [
            h('input', { class: 'input', style: 'flex:1;min-width:140px;', placeholder: '查找', value: this.find, oninput: (e) => (this.find = e.target.value) }),
            h('input', { class: 'input', style: 'flex:1;min-width:140px;', placeholder: '替换为', value: this.repl, oninput: (e) => (this.repl = e.target.value) }),
            h('label', { style: 'font-size:12px;display:flex;align-items:center;' }, h('input', { type: 'checkbox', checked: this.rx, onchange: (e) => (this.rx = e.target.checked) }), '正则'),
            h('button', { class: 'btn', onclick: () => this.run('texttool.replace', { content: this.content, find: this.find, replace: this.repl, regex: this.rx }) }, '替换'),
          ]), textarea('content', '原文'),
        ]),
        convert: h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:6px;' }, [
            h('select', { class: 'input', value: this.act, onchange: (e) => (this.act = e.target.value) }, ['json2yaml', 'yaml2json', 'jsonfmt', 'jsonmin'].map((a) => h('option', { value: a }, a))),
            h('button', { class: 'btn', onclick: () => this.run('texttool.convert', { content: this.content, action: this.act }) }, '转换'),
          ]), textarea('content', '输入内容'),
        ]),
        stats: h('div', null, [
          h('button', { class: 'btn', style: 'margin-bottom:6px;', onclick: () => this.run('texttool.stats', { content: this.content }) }, '统计'), textarea('content', '输入内容'),
        ]),
      }
      return h('div', { class: 'texttool-panel' }, [
        h('div', { class: 'section-title' }, '文本工具'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:10px;' }, [['regex', '正则'], ['replace', '替换'], ['convert', '转换'], ['stats', '统计']].map((x) => tabBtn(x[0], x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        views[this.tab],
        this.out ? h('pre', { style: 'background:#0d1117;color:#c9d1d9;padding:10px;border-radius:6px;white-space:pre-wrap;margin-top:8px;' }, this.out) : null,
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '文本工具' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}