// docker 插件 Vue3 前端(独立构建, esbuild IIFE)
// 契约: window.__rcPlugin_docker = { mount(container, ctx) }
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_docker = {
    name: 'docker',
    mount: function (container, ctx) {
      
      const App = {
        data() {
          return { containers: [], info: null, showAll: false, loading: false, err: '' }
        },
        methods: {
          async load() {
            this.loading = true
            try {
              const r = await fetch('/api/plugins/docker/containers' + (this.showAll ? '?all=1' : ''))
              const d = await r.json()
              this.containers = d.containers || []
            } catch (e) { this.err = e.message }
            this.loading = false
          },
          async loadInfo() {
            try {
              const d = await (await fetch('/api/plugins/docker/info')).json()
              this.info = d
            } catch (e) {}
          },
          async act(cid, action) {
            try {
              const d = await (await fetch('/api/plugins/docker/containers/' + action + '/' + cid, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
              })).json()
              if (d && d.ok === false) this.err = d.error || ''
              this.load()
            } catch (e) { this.err = e.message }
          },
          async logs(cid) {
            try {
              const d = await (await fetch('/api/plugins/docker/containers/logs/' + cid)).json()
              alert(d.logs || '(空日志)')
            } catch (e) { this.err = e.message }
          }
        },
        mounted() { this.load(); this.loadInfo() },
        render() {
          const rows = this.containers.map((c) => h('tr', { key: c.id }, [
            h('td', { class: 'mono' }, c.name),
            h('td', { class: 'mono faint' }, c.image),
            h('td', null, c.status),
            h('td', { class: 'mono faint', style: 'font-size:11px;' }, c.ports || '-'),
            h('td', null, h('div', { class: 'flex', style: 'gap:4px;justify-content:flex-end;' }, [
              h('button', { class: 'btn btn-sm', onclick: () => this.act(c.id, 'start') }, '启动'),
              h('button', { class: 'btn btn-sm', onclick: () => this.act(c.id, 'stop') }, '停止'),
              h('button', { class: 'btn btn-sm', onclick: () => this.act(c.id, 'restart') }, '重启'),
              h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.logs(c.id) }, '日志'),
              h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.act(c.id, 'remove') }, '删除'),
            ])),
          ]))
          return h('div', { class: 'docker-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;align-items:center;' }, [
                h('span', null, 'Docker 容器' + (this.info && this.info.version ? ' · v' + this.info.version : '')),
                h('div', { class: 'flex', style: 'gap:6px;' }, [
                  h('label', { style: 'font-size:12px;display:flex;align-items:center;gap:4px;' }, [
                    h('input', { type: 'checkbox', checked: this.showAll, onchange: (e) => { this.showAll = e.target.checked; this.load() } }), '显示已停止'
                  ]),
                  h('button', { class: 'btn btn-sm', onclick: () => this.load() }, '刷新'),
                ]),
              ]),
              this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
              this.loading ? h('p', { class: 'hint' }, '加载中...') : h('table', { class: 'table' }, [
                h('thead', null, h('tr', null, [h('th', null, '名称'), h('th', null, '镜像'), h('th', null, '状态'), h('th', null, '端口'), h('th', null, '')])),
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