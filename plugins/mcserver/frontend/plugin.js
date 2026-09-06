// mcserver 插件前端(接口库 v4): 实例 CRUD / 启停 / 控制台 / 监控 / 核心切换
import { createApp, h } from 'vue'

const NAME = 'mcserver'

function mount(container, ctx) {
  const App = {
    data() {
      return { tab: 'list', list: [], status: null, metrics: null, console: '', cmd: '', detail: null, javas: [], cores: null,
        add: { id: '', label: '', dir: '/opt/mcserver', jar: '', port: 25565, java: '', mem_max: '4G' }, timer: null, err: '' }
    },
    methods: {
      async load() {
        try {
          const [l, s] = await Promise.all([ctx.invoke('mcserver.instances.list').catch(() => ({ instances: [] })), ctx.invoke('mcserver.status').catch(() => null)])
          this.list = (l && l.instances) || []; this.status = s
        } catch (e) { this.err = (e && e.message) || e }
      },
      async pick(id) { try { await ctx.invoke('mcserver.instance.set', { id }); this.load() } catch (e) { this.err = (e && e.message) || e } },
      async action(act) { try { await ctx.invoke('mcserver.' + act); setTimeout(() => this.load(), 600) } catch (e) { this.err = (e && e.message) || e } },
      async consoleGet() { try { const r = await ctx.invoke('mcserver.console.get', { lines: 120 }); this.console = (r && r.log) || '' } catch (e) {} },
      async send() { if (!this.cmd.trim()) return; try { await ctx.invoke('mcserver.console.send', { command: this.cmd }); this.cmd = ''; setTimeout(() => this.consoleGet(), 400) } catch (e) { this.err = (e && e.message) || e } },
      async tabLoad(k) {
        this.err = ''
        try {
          if (k === 'detail') this.detail = await ctx.invoke('mcserver.instance.detail')
          else if (k === 'javas') this.javas = ((await ctx.invoke('mcserver.javas')).javas) || []
          else if (k === 'cores') this.cores = await ctx.invoke('mcserver.core.jars')
        } catch (e) { this.err = (e && e.message) || e }
        if (k === 'monitor') {
          clearInterval(this.timer)
          const fn = async () => { try { this.metrics = await ctx.invoke('mcserver.metrics') } catch (e) {} }
          await fn(); this.timer = setInterval(fn, 3000)
        }
      },
      async addInst() {
        if (!this.add.id) { this.err = 'ID 必填'; return }
        this.err = ''
        try { await ctx.invoke('mcserver.instance.add', this.add); this.add.id = ''; this.load() } catch (e) { this.err = (e && e.message) || e }
      },
      async rmInst(id) { try { await ctx.invoke('mcserver.instance.remove', { id }); this.load() } catch (e) { this.err = (e && e.message) || e } },
      async switchCore(jar) { try { await ctx.invoke('mcserver.core.switch', { jar }); this.tabLoad('cores') } catch (e) { this.err = (e && e.message) || e } },
    },
    mounted() { this.load(); this.consoleGet(); this.timer = setInterval(() => { this.load(); this.consoleGet() }, 4000) },
    unmounted() { clearInterval(this.timer) },
    render() {
      const s = this.status || {}
      let v = null
      if (this.tab === 'list') {
        const rows = this.list.map((i) => h('tr', { key: i.id, style: i.active ? 'background:rgba(53,121,168,.08)' : '' }, [
          h('td', null, i.label + (i.active ? ' ★' : '')), h('td', null, i.running ? h('b', { style: { color: '#2e9e5b' } }, '运行中') : h('span', { style: { color: '#d9524e' } }, '已停止')),
          h('td', { class: 'faint' }, (i.version || '-') + ' · ' + (i.port || '-')),
          h('td', null, h('div', { class: 'flex', style: 'gap:4px;' }, [
            h('button', { class: 'btn btn-sm', onclick: () => this.pick(i.id) }, '切换'),
            i.running ? h('button', { class: 'btn btn-sm', onclick: () => this.action('stop') }, '停') : h('button', { class: 'btn btn-sm', onclick: () => this.action('start') }, '启'),
            h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.rmInst(i.id) }, '删'),
          ])),
        ]))
        v = h('table', { class: 'table' }, [h('thead', null, h('tr', null, ['实例', '状态', '版本·端口', '操作'].map((x) => h('th', null, x)))), h('tbody', null, rows)])
      } else if (this.tab === 'add') {
        const fields = [['id', 'ID*'], ['label', '名称'], ['dir', '目录'], ['jar', 'Jar'], ['java', 'Java 路径'], ['mem_max', '内存上限']]
        v = h('div', { class: 'section' }, fields.map((f) => h('input', { class: 'input', style: 'width:100%;margin-bottom:6px;', placeholder: f[1], value: this.add[f[0]], oninput: (e) => (this.add[f[0]] = e.target.value) })).concat(h('div', { class: 'flex', style: 'gap:6px;' }, [
          h('input', { class: 'input', style: 'width:100px;', type: 'number', placeholder: '端口', value: this.add.port, oninput: (e) => (this.add.port = e.target.value) }),
          h('button', { class: 'btn btn-primary', onclick: () => this.addInst() }, '新增实例'),
        ])))
      } else if (this.tab === 'console') {
        v = h('div', null, [
          h('pre', { style: 'background:#0d1117;color:#c9d1d9;padding:10px;border-radius:6px;height:260px;overflow:auto;font-size:12px;' }, this.console || '(空)'),
          h('div', { class: 'flex', style: 'gap:6px;margin-top:8px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '命令', value: this.cmd, oninput: (e) => (this.cmd = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.send() } }),
            h('button', { class: 'btn', onclick: () => this.send() }, '发送'),
          ]),
        ])
      } else if (this.tab === 'monitor' && this.metrics) {
        v = h('div', { class: 'section' }, [
          h('p', null, 'CPU ' + this.metrics.cpu + '% · 内存 ' + this.metrics.mem_percent + '% (' + this.metrics.mem_used + '/' + this.metrics.mem_total + ') · JVM ' + this.metrics.jvm_cpu + '% ' + this.metrics.jvm_rss_mb + 'MB'),
          h('div', { class: 'faint', style: 'font-size:12px;' }, '历史 CPU: ' + (this.metrics.hist_cpu || []).map((x) => x.toFixed(0)).join(',')),
        ])
      } else if (this.tab === 'detail' && this.detail) {
        v = h('pre', { class: 'faint', style: 'white-space:pre-wrap;font-size:12px;' }, JSON.stringify(this.detail, null, 1))
      } else if (this.tab === 'cores' && this.cores) {
        v = h('div', null, (this.cores.jars || []).map((j) => h('div', { key: j, class: 'flex', style: 'justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);' }, [
          h('span', { class: 'mono' }, j + (this.cores.current === j ? ' (当前)' : '')),
          h('button', { class: 'btn btn-sm', onclick: () => this.switchCore(j) }, '切换'),
        ])))
      } else if (this.tab === 'javas') {
        v = h('div', null, this.javas.map((j) => h('div', { key: j, style: 'padding:4px 0;font-family:var(--font-mono);' }, j)))
      }
      const tabs = [['list', '实例'], ['add', '新增'], ['console', '控制台'], ['monitor', '监控'], ['detail', '详情'], ['cores', '核心'], ['javas', 'Java']]
      return h('div', null, [
        h('div', { class: 'section-title' }, 'MC 服务器' + (s.inst_label ? ' · ' + s.inst_label : '') + (s.player_count != null ? ' · ' + s.player_count + ' 人在线' : '')),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' }, tabs.map((x) => h('button', { class: 'btn btn-sm' + (this.tab === x[0] ? ' btn-primary' : ''), onclick: () => { this.tab = x[0]; this.tabLoad(x[0]) } }, x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        v,
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
if (typeof window !== 'undefined') register(window)