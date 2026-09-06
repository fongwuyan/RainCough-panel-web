// laizhangsetu 插件前端(接口库 v4): 拉图 + 历史 + 设置
import { createApp, h } from 'vue'

const NAME = 'laizhangsetu'

function mount(container, ctx) {
  const App = {
    data() { return { tab: 'fetch', tags: '', r18: false, items: [], history: [], cfg: null, settings: null, err: '', loading: false } },
    methods: {
      async fetch() {
        this.loading = true; this.err = ''
        try {
          const r = await ctx.invoke('laizhangsetu.fetch', { tags: this.tags.split(/[,\s。]+/).filter(Boolean), r18: this.r18 })
          this.items = (r && r.items) || []
          this.loadHistory()
        } catch (e) { this.err = (e && e.message) || e }
        this.loading = false
      },
      async loadHistory() { try { const r = await ctx.invoke('laizhangsetu.history.list'); this.history = (r && r.history) || [] } catch (e) {} },
      async clearHistory() { try { await ctx.invoke('laizhangsetu.history.clear'); this.history = []; this.items = [] } catch (e) { this.err = (e && e.message) || e } },
      async loadCfg() {
        try {
          const [c, s] = await Promise.all([ctx.invoke('laizhangsetu.config.get'), ctx.invoke('laizhangsetu.settings')])
          this.cfg = c; this.settings = s
        } catch (e) { this.err = (e && e.message) || e }
      },
      async saveCfg() {
        try {
          await ctx.invoke('laizhangsetu.config.save', { r18: this.cfg.r18, exclude_ai: this.cfg.exclude_ai, flip_h: this.cfg.flip_h, flip_v: this.cfg.flip_v, blur_chance: Number(this.cfg.blur_chance) || 5, proxy: this.cfg.proxy, exclude_seen: this.cfg.exclude_seen, storage_paths: this.cfg.storage_paths })
          this.loadCfg()
        } catch (e) { this.err = (e && e.message) || e }
      },
    },
    mounted() { this.loadHistory(); this.loadCfg() },
    render() {
      const t = (k, l) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, l)
      const imgs = (this.items.length ? this.items : this.history).map((it) =>
        h('div', { key: it.pid || Math.random(), class: 'card', style: 'padding:6px;' }, [
          it.url ? h('img', { src: it.url, loading: 'lazy', style: 'width:100%;display:block;' }) : null,
          h('div', { style: 'font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, it.title || ('PID ' + it.pid)),
        ]))
      const sw = (k, label) => h('label', { style: 'display:flex;gap:6px;align-items:center;font-size:13px;margin-bottom:6px;' },
        h('input', { type: 'checkbox', checked: !!this.cfg[k], onchange: (e) => (this.cfg[k] = e.target.checked) }), label)
      return h('div', null, [
        h('div', { class: 'section-title' }, '来张涩图(Lolicon)'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;' }, [t('fetch', '获取/历史'), t('cfg', '设置')]),
        this.err ? h('p', { style: 'color:var(--danger);font-size:12px;' }, this.err) : null,
        this.tab === 'fetch' ? h('div', null, [
          h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' }, [
            h('input', { class: 'input', style: 'flex:1;min-width:160px;', placeholder: '标签, 逗号分隔', value: this.tags, oninput: (e) => (this.tags = e.target.value), onkeyup: (e) => { if (e.key === 'Enter') this.fetch() } }),
            h('label', { style: 'display:flex;align-items:center;font-size:12px;' }, h('input', { type: 'checkbox', checked: this.r18, onchange: (e) => (this.r18 = e.target.checked) }), 'R18'),
            h('button', { class: 'btn', disabled: this.loading, onclick: () => this.fetch() }, this.loading ? '获取中...' : '获取'),
            h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.clearHistory() }, '清空历史'),
          ]),
          h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;' }, imgs.length ? imgs : h('p', { class: 'hint' }, '暂无图片, 点击获取')),
        ]) : h('div', { class: 'section' }, [
          this.cfg ? h('div', null, [
            sw('r18', 'R18'), sw('exclude_ai', '排除 AI'), sw('flip_h', '水平翻转'), sw('flip_v', '垂直翻转'), sw('exclude_seen', '排除已见'),
            h('div', { style: 'margin:6px 0;' }, ['模糊概率 % ', h('input', { class: 'input', style: 'width:70px;', type: 'number', value: this.cfg.blur_chance, oninput: (e) => (this.cfg.blur_chance = e.target.value) })]),
            h('div', { style: 'margin:6px 0;' }, ['代理 ', h('input', { class: 'input', style: 'width:200px;', value: this.cfg.proxy, oninput: (e) => (this.cfg.proxy = e.target.value) })]),
            h('button', { class: 'btn', onclick: () => this.saveCfg() }, '保存'),
          ]) : null,
          this.settings ? h('div', { class: 'faint', style: 'font-size:12px;margin-top:8px;' }, '存储路径: ' + (this.settings.storage_paths || []).map((p) => p.path + (p.exists ? '' : ' (不存在)')).join(' · ')) : null,
        ]),
      ])
    },
  }
  const vm = createApp(App); vm.mount(container); return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '来张涩图' }], mount }
}
if (typeof window !== 'undefined') register(window)