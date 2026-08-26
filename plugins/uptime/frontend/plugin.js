// uptime 插件 Vue3 前端组件(独立构建, esbuild IIFE)
// 导出约定: window.__rcPlugin_uptime = { mount, unmount? }
// mount(container, ctx): 挂载 Vue 组件到容器; ctx = { Vue, api }
// Vue 由主面板注入(external), 避免插件自带运行时
export function register(g) {
  g.__rcPlugin_uptime = {
    name: 'uptime',
    mount: function (container, ctx) {
      const { Vue } = ctx
      const { createApp, h, ref, onMounted } = Vue
      // 组件: 目标列表 + 状态
      const App = {
        setup() {
          const targets = ref([])
          const loading = ref(true)
          const newUrl = ref('')
          const newName = ref('')
          async function load() {
            loading.value = true
            try {
              const r = await fetch('/api/plugins/uptime/targets')
              const d = await r.json()
              targets.value = Object.values(d.targets || {})
            } catch (e) { console.error(e) }
            loading.value = false
          }
          async function add() {
            if (!newUrl.value) return
            await fetch('/api/plugins/uptime/targets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: newName.value || 't' + Date.now() % 10000, url: newUrl.value })
            })
            newUrl.value = ''
            load()
          }
          async function del(name) {
            await fetch('/api/plugins/uptime/targets/' + name, { method: 'DELETE' })
            load()
          }
          onMounted(load)
          return { targets, loading, newUrl, newName, add, del }
        },
        render() {
          const { h } = ctx.Vue
          return h('div', { class: 'uptime-panel' }, [
            h('h3', 'Uptime 监控目标'),
            h('div', { class: 'uptime-add' }, [
              h('input', { placeholder: '名称', value: this.newName, oninput: e => (this.newName = e.target.value) }),
              h('input', { placeholder: 'https://...', value: this.newUrl, oninput: e => (this.newUrl = e.target.value) }),
              h('button', { onclick: () => this.add() }, '添加'),
            ]),
            this.loading ? h('p', '加载中...') :
              h('table', { class: 'uptime-table' }, [
                h('thead', null, h('tr', null, [
                  h('th', null, '目标'), h('th', null, '状态'), h('th', null, '延迟'), h('th', null, '可用率'), h('th', null, '')
                ])),
                h('tbody', null, (this.targets || []).map(t =>
                  h('tr', { key: t.name }, [
                    h('td', null, t.name),
                    h('td', { style: { color: t.last_status ? '#3fb950' : '#f85149' } },
                      t.last_status === undefined ? '-' : (t.last_status ? '在线' : '离线')),
                    h('td', null, t.last_ms ? t.last_ms + 'ms' : '-'),
                    h('td', null, t.avail !== undefined ? t.avail + '%' : '-'),
                    h('td', null, h('button', { onclick: () => this.del(t.name) }, '删除')),
                  ])
                ))
              ])
        }
      }
      const vm = createApp(App)
      vm.mount(container)
      return () => vm.unmount()
    }
  }
}

// IIFE 尾巴: 注册到全局(主面板 PluginView 动态 import 后读取)
if (typeof window !== 'undefined') {
  register(window)
}