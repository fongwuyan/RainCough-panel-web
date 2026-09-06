// mcserver 插件前端(接口库 v4): Vue3 展示层, ctx.invoke; 控制台轮询替代 SSE。
import { createApp, h } from 'vue'

const NAME = 'mcserver'

function mount(container, ctx) {
  const App = {
    data() { return { list: [], status: null, console: '', cmd: '', err: '', timer: null } },
    methods: {
      async load() {
        try {
          const [l, s] = await Promise.all([
            ctx.invoke('mcserver.instances.list'),
            ctx.invoke('mcserver.status').catch(() => null),
          ])
          this.list = (l && l.instances) || []
          this.status = s
        } catch (e) { this.err = (e && e.message) || e }
      },
      async pick(id) {
        try { await ctx.invoke('mcserver.instance.set', { id }); this.load() }
        catch (e) { this.err = (e && e.message) || e }
      },
      async action(act) {
        try { await ctx.invoke('mcserver.' + act); setTimeout(() => this.load(), 800) }
        catch (e) { this.err = (e && e.message) || e }
      },
      async consoleGet() {
        try { const r = await ctx.invoke('mcserver.console.get', { lines: 120 }); this.console = (r && r.log) || '' }
        catch (e) { /* 服务器未运行等 */ }
      },
      async send() {
        if (!this.cmd.trim()) return
        try { await ctx.invoke('mcserver.console.send', { command: this.cmd }); this.cmd = ''; setTimeout(() => this.consoleGet(), 300) }
        catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() {
      this.load(); this.consoleGet()
      this.timer = setInterval(() => { this.load(); this.consoleGet() }, 4000)
    },
    unmounted() { clearInterval(this.timer) },
    render() {
      const st = this.status || {}
      const rows = this.list.map((i) => h('tr', { key: i.id, style: i.active ? 'background:rgba(53,121,168,.08)' : '' }, [
        h('td', null, i.label + (i.active ? ' ★' : '')),
        h('td', null, i.running ? h('b', { style: 'color:#2e9e5b' }, '运行中') : h('span', { style: 'color:#d9524e' }, '已停止')),
        h('td', { class: 'faint' }, (i.version || '-') + ' · ' + (i.port || '-')),
        h('td', null, [
          h('button', { class: 'btn btn-sm', onclick: () => this.pick(i.id) }, '切换'),
          i.running
            ? h('button', { class: 'btn btn-sm', onclick: () => this.action('stop') }, '停止')
            : h('button', { class: 'btn btn-sm', onclick: () => this.action('start') }, '启动'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.action('restart') }, '重启'),
        ]),
      ]))
      return h('div', { class: 'mc-panel' }, [
        h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;align-items:center;' }, [
          h('span', null, 'MC 服务器' + (st.inst_label ? ' · ' + st.inst_label : '') + (st.players ? ' · ' + st.player_count + ' 人在线' : '')),
          h('div', { class: 'flex', style: 'gap:6px;' }, [
            h('button', { class: 'btn btn-sm', onclick: () => this.load() }, '刷新'),
          ]),
        ]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        h('table', { class: 'table' }, [
          h('thead', null, h('tr', null, [h('th', null, '实例'), h('th', null, '状态'), h('th', null, '版本·端口'), h('th', null, '操作')])),
          h('tbody', null, rows),
        ]),
        h('div', { class: 'section', style: 'margin-top:12px;' }, [
          h('div', { class: 'section-title' }, '控制台(4s 轮询)'),
          h('pre', { style: 'background:#0d1117;color:#c9d1d9;padding:10px;border-radius:6px;height:220px;overflow:auto;font-size:12px;' }, this.console || '(空)'),
          h('div', { class: 'flex', style: 'gap:6px;margin-top:8px;' }, [
            h('input', { class: 'input', placeholder: '输入命令, 如 say hi', value: this.cmd, oninput: (e) => (this.cmd = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.send() }, style: 'flex:1;' }),
            h('button', { class: 'btn', onclick: () => this.send() }, '发送'),
          ]),
        ]),
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
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'MC 服务器' }], mount }
}

if (typeof window !== 'undefined') {
  register(window)
}