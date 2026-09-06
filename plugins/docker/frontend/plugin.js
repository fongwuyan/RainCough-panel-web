// docker 插件前端(接口库 v4): 概览 / 容器 / 镜像 / 卷 / 网络 / Compose / 清理 / 创建
import { createApp, h } from 'vue'

const NAME = 'docker'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'ctr', info: null, status: null, env: null, containers: [], images: [], volumes: [], networks: [], cps: null, create: { image: '', name: '', ports: '', env: '', volumes: '' }, err: '' } },
    methods: {
      async load() {
        try {
          const [info, status, env, ctr] = await Promise.all([
            ctx.invoke('docker.info').catch(() => null),
            ctx.invoke('docker.status').catch(() => null),
            ctx.invoke('docker.env').catch(() => null),
            ctx.invoke('docker.containers.list'),
          ])
          this.info = info; this.status = status; this.env = env; this.containers = (ctr && ctr.containers) || []
        } catch (e) { this.err = (e && e.message) || e }
      },
      async act(cid, action) {
        try { const r = await ctx.invoke('docker.containers.' + action, { id: cid }); if (r.ok === false) this.err = r.error || ''; this.load() }
        catch (e) { this.err = (e && e.message) || e }
      },
      async logs(cid) {
        try { const r = await ctx.invoke('docker.containers.logs', { id: cid }); alert((r && r.log) || '(空日志)') }
        catch (e) { this.err = (e && e.message) || e }
      },
      async tabLoad(k) {
        this.err = ''
        try {
          if (k === 'img') this.images = ((await ctx.invoke('docker.images.list')).images) || []
          if (k === 'vol') this.volumes = ((await ctx.invoke('docker.volumes.list')).volumes) || []
          if (k === 'net') this.networks = ((await ctx.invoke('docker.networks.list')).networks) || []
          if (k === 'cp') this.cps = await ctx.invoke('docker.compose.ps', { path: this.cpPath || '/' }).catch(() => null)
        } catch (e) { this.err = (e && e.message) || e }
      },
      async imgAct(id, act) {
        try { const r = await ctx.invoke('docker.images.' + (act === 'remove' ? 'remove' : 'pull'), act === 'remove' ? { id } : { name: this.pullName }); if (r.ok === false) this.err = r.error || ''; this.tabLoad('img') }
        catch (e) { this.err = (e && e.message) || e }
      },
      async volRm(name) { try { await ctx.invoke('docker.volume.remove', { name }); this.tabLoad('vol') } catch (e) { this.err = (e && e.message) || e } },
      async prune() { try { await ctx.invoke('docker.system.prune', { all: true, volumes: true }); this.load() } catch (e) { this.err = (e && e.message) || e } },
      async create() {
        try {
          await ctx.invoke('docker.containers.create', {
            image: this.create.image, name: this.create.name,
            ports: this.create.ports.split(',').map((s) => s.trim()).filter(Boolean),
            env: this.create.env.split(',').map((s) => s.trim()).filter(Boolean),
            volumes: this.create.volumes.split(',').map((s) => s.trim()).filter(Boolean),
          })
          this.load()
        } catch (e) { this.err = (e && e.message) || e }
      },
      async cp(action) {
        if (!this.cpPath) { this.err = '请输入 compose 目录'; return }
        this.err = ''
        try { const map = { up: 'docker.compose.up', down: 'docker.compose.down', ps: 'docker.compose.ps' }; const r = await ctx.invoke(map[action], { path: this.cpPath }); this.cps = r; if (action !== 'ps') this.tabLoad('cp') }
        catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() { this.load(); this.tabLoad('img') },
    render() {
      const st = this.status || {}
      let v = null
      if (this.tab === 'ctr') {
        const rows = this.containers.map((c) => h('tr', { key: c.id }, [
          h('td', { class: 'mono' }, c.name), h('td', { class: 'faint' }, c.image),
          h('td', { style: { color: c.state === 'running' ? '#2e9e5b' : '#888' } }, c.status),
          h('td', { class: 'faint' }, (c.ports || []).join(', ') || '-'),
          h('td', null, h('div', { class: 'flex', style: 'gap:4px;' }, [
            c.state === 'running'
              ? [h('button', { class: 'btn btn-sm', onclick: () => this.act(c.id, 'stop') }, '停'), h('button', { class: 'btn btn-sm', onclick: () => this.act(c.id, 'restart') }, '重启')]
              : h('button', { class: 'btn btn-sm', onclick: () => this.act(c.id, 'start') }, '启'),
            h('button', { class: 'btn btn-sm btn-ghost', onclick: () => this.logs(c.id) }, '日志'),
            h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.act(c.id, 'remove') }, '删'),
          ])),
        ]))
        v = h('div', null, [
          h('button', { class: 'btn btn-sm btn-danger', style: 'margin-bottom:6px;', onclick: () => this.prune() }, '清理未用资源(prune -a --volumes)'),
          h('table', { class: 'table' }, [h('thead', null, h('tr', null, ['名称', '镜像', '状态', '端口', ''].map((x) => h('th', null, x)))), h('tbody', null, rows)]),
        ])
      } else if (this.tab === 'img') {
        v = h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:6px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: '镜像名(拉取)', value: this.pullName || '', oninput: (e) => (this.pullName = e.target.value) }),
            h('button', { class: 'btn btn-sm', onclick: () => this.imgAct(null, 'pull') }, '拉取(后台)'),
          ]),
          this.images.map((i) => h('div', { key: i.id, class: 'flex', style: 'justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);' }, [
            h('div', null, [h('b', null, (i.tags && i.tags[0]) || i.id), h('span', { class: 'faint' }, ' · ' + i.size + ' B')]),
            h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.imgAct(i.id, 'remove') }, '删除'),
          ])),
        ])
      } else if (this.tab === 'vol') {
        v = h('div', null, this.volumes.map((x) => h('div', { key: x.name, class: 'flex', style: 'justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);' }, [
          h('span', null, x.name + ' (' + x.driver + ')'), h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.volRm(x.name) }, '删除'),
        ])))
      } else if (this.tab === 'net') {
        v = h('table', { class: 'table' }, [h('thead', null, h('tr', null, ['ID', '名称', '驱动', '范围'].map((x) => h('th', null, x)))), h('tbody', null, this.networks.map((n) => h('tr', { key: n.id }, [h('td', { class: 'mono' }, n.id), h('td', null, n.name), h('td', null, n.driver), h('td', null, n.scope)])))])
      } else if (this.tab === 'create') {
        const fields = [['image', '镜像*'], ['name', '名称'], ['ports', '端口映射 80:80,8080:80'], ['env', '环境 A=1,B=2'], ['volumes', '卷 /data:/data']]
        v = h('div', { class: 'section' }, fields.map((f) => h('input', { class: 'input', style: 'width:100%;margin-bottom:6px;', placeholder: f[1], value: this.create[f[0]], oninput: (e) => (this.create[f[0]] = e.target.value) })).concat(h('button', { class: 'btn btn-primary', onclick: () => this.create() }, '创建并运行')))
      } else if (this.tab === 'cp') {
        v = h('div', { class: 'section' }, [
          h('div', { class: 'flex', style: 'gap:6px;' }, [
            h('input', { class: 'input', style: 'flex:1;', placeholder: 'compose 项目目录', value: this.cpPath || '', oninput: (e) => (this.cpPath = e.target.value) }),
            h('button', { class: 'btn btn-sm', onclick: () => this.cp('up') }, 'up -d'), h('button', { class: 'btn btn-sm', onclick: () => this.cp('down') }, 'down'),
            h('button', { class: 'btn btn-sm', onclick: () => this.cp('ps') }, 'ps'),
          ]),
          this.cps ? h('pre', { class: 'faint', style: 'white-space:pre-wrap;font-size:12px;margin-top:6px;' }, JSON.stringify(this.cps).slice(0, 500)) : null,
        ])
      }
      const tabs = [['ctr', '容器'], ['img', '镜像'], ['vol', '卷'], ['net', '网络'], ['create', '创建'], ['cp', 'Compose']]
      return h('div', null, [
        h('div', { class: 'section-title' }, 'Docker 管理' + (this.info ? ' · v' + this.info.server_version + ' · ' + (this.info.containers_running || 0) + '/' + (this.info.containers || 0) + ' 容器' : '')),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' }, tabs.map((x) => h('button', { class: 'btn btn-sm' + (this.tab === x[0] ? ' btn-primary' : ''), onclick: () => { this.tab = x[0]; this.tabLoad(x[0]) } }, x[1]))),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        v,
      ])
    }  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '容器管理' }], mount }
}
if (typeof window !== 'undefined') register(window)