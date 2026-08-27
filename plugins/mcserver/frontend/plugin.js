// mcserver 插件 Vue3 前端(独立构建, esbuild IIFE)
// 契约: window.__rcPlugin_mcserver = { mount(container, ctx) }
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_mcserver = {
    name: 'mcserver',
    mount: function (container, ctx) {
      
      const App = {
        data() {
          return { instances: [], newName: '', newDir: '', newPort: 25565, err: '', console: null, polling: false }
        },
        methods: {
          async load() {
            try {
              const d = await (await fetch('/api/plugins/mcserver/instances')).json()
              this.instances = d.instances || []
            } catch (e) { this.err = e.message }
          },
          async add() {
            if (!this.newName) return
            try {
              await fetch('/api/plugins/mcserver/instance/add', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.newName, dir: this.newDir || ('/opt/mc/' + this.newName), port: this.newPort })
              })
              this.newName = ''; this.load()
            } catch (e) { this.err = e.message }
          },
          async act(name, action) {
            try {
              const d = await (await fetch('/api/plugins/mcserver/' + action, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
              })).json()
              if (d && d.ok === false) this.err = d.error || ''
              this.load()
            } catch (e) { this.err = e.message }
          },
          async del(name) {
            if (!confirm('删除实例 ' + name + ' ?')) return
            try {
              await fetch('/api/plugins/mcserver/instance/remove', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
              })
              this.load()
            } catch (e) { this.err = e.message }
          },
          async showConsole(name) {
            try {
              const d = await (await fetch('/api/plugins/mcserver/console?name=' + name)).json()
              alert(d.console || '(空控制台)')
            } catch (e) { this.err = e.message }
          }
        },
        mounted() { this.load() },
        render() {
          const rows = this.instances.map((it) => h('tr', { key: it.name }, [
            h('td', { class: 'mono' }, it.name),
            h('td', { class: 'mono faint', style: 'font-size:11px;' }, it.dir || '-'),
            h('td', { class: 'mono' }, it.port || 25565),
            h('td', null, it.running
              ? h('span', { class: 'tag-chip', style: 'background:var(--success);color:#fff;' }, '运行中')
              : h('span', { class: 'tag-chip' }, '已停止')),
            h('td', null, it.online ? h('span', { style: 'color:var(--success);font-size:12px;' }, '在线') : h('span', { style: 'color:var(--text-faint);font-size:12px;' }, '离线')),
            h('td', null, h('div', { class: 'flex', style: 'gap:4px;justify-content:flex-end;' }, [
              h('button', { class: 'btn btn-sm', onclick: () => this.act(it.name, 'start') }, '启动'),
              h('button', { class: 'btn btn-sm', onclick: () => this.act(it.name, 'stop') }, '停止'),
              h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.showConsole(it.name) }, '控制台'),
              h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.del(it.name) }, '删除'),
            ])),
          ]))
          return h('div', { class: 'mc-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;' }, [
                h('span', null, 'MC 服务器实例'),
                h('button', { class: 'btn btn-sm', onclick: () => this.load() }, '刷新'),
              ]),
              this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
              h('div', { class: 'flex', style: 'gap:8px;margin-bottom:8px;' }, [
                h('input', { placeholder: '实例名(如 smp)', value: this.newName, oninput: (e) => (this.newName = e.target.value), class: 'input', style: 'width:120px;' }),
                h('input', { placeholder: '目录(默认 /opt/mc/<名>)', value: this.newDir, oninput: (e) => (this.newDir = e.target.value), class: 'input', style: 'flex:1;' }),
                h('input', { placeholder: '端口', value: this.newPort, oninput: (e) => (this.newPort = e.target.value), class: 'input', style: 'width:70px;' }),
                h('button', { class: 'btn btn-primary', onclick: () => this.add() }, '+ 实例'),
              ]),
              h('table', { class: 'table' }, [
                h('thead', null, h('tr', null, [h('th', null, '名称'), h('th', null, '目录'), h('th', null, '端口'), h('th', null, '状态'), h('th', null, '在线'), h('th', null, '')])),
                h('tbody', null, rows),
              ]),
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