// 叶酱游戏 前端 v1.1.1：卡片库 / 多源挖掘实时进度悬浮窗 / 内置下载器悬浮窗
// 构建产物 assets/plugin.js 内联 Vue，面板直接加载。
import { createApp, h } from 'vue'

const NAME = 'yegames'
const IFACE = {
  info: 'yegames.info',
  cfgGet: 'yegames.config.get',
  cfgSave: 'yegames.config.save',
  lib: 'yegames.library.list',
  mineStart: 'yegames.mine.start',
  mineStatus: 'yegames.mine.status',
  mineCancel: 'yegames.mine.cancel',
  links: 'yegames.item.links',
  bind: 'yegames.item.bind',
  folderList: 'yegames.folder.list',
  idx: 'yegames.index.stats',
  dlStart: 'yegames.dl.start',
  dlStatus: 'yegames.dl.status',
  dlList: 'yegames.dl.list',
  dlCancel: 'yegames.dl.cancel',
  dlRemove: 'yegames.dl.remove',
  huntUrl: 'yegames.hunt.url',
  huntItem: 'yegames.hunt.item',
  tgMine: 'yegames.tg.mine',
  tgLinks: 'yegames.tg.links',
}

const RUNNING = ['queued', 'connecting', 'downloading', 'cancelling']
const n = (v) => (typeof v === 'number' ? v : Number(v) || 0)
const fmtSize = (mb) => (mb ? (mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : Math.round(mb) + ' MB') : '—')
const fmtBytes = (b) => {
  b = n(b)
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(0) + ' KB'
  return b + ' B'
}
const fmtEta = (s) => {
  s = n(s)
  if (!s) return '—'
  if (s < 60) return s + 's'
  const m = Math.floor(s / 60)
  return m + 'm' + (s % 60) + 's'
}

function copyText(text) {
  const s = String(text || '')
  if (!s) return Promise.resolve(false)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(s).then(() => true).catch(() => fallbackCopy(s))
  }
  return Promise.resolve(fallbackCopy(s))
}
function fallbackCopy(s) {
  try {
    const ta = document.createElement('textarea')
    ta.value = s
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (e) { return false }
}

const STATE_LABEL = { new: '新增', updated: '有更新', active: '未变', stale: '已过期' }
const STATE_COLOR = { new: '#2e9e5b', updated: '#d68910', active: 'rgba(127,127,127,.55)', stale: '#c0392b' }
const JOB_LABEL = {
  queued: '排队中', connecting: '连接中', downloading: '下载中',
  cancelling: '取消中', cancelled: '已取消', done: '已完成', error: '失败',
}

function mount(container, ctx) {
  const App = {
    data() {
      return {
        cards: [], counts: {}, libTs: 0,
        cfg: null, info: null, idx: null,
        keyword: '', stateFilter: '', sortBy: 'recent', onlyLinked: false,
        kindFilter: '', tgPages: 3, tgKeyword: '', tgLinks: null, tgLoading: false,
        modal: null,
        mine: null, mineTimer: null,
        links: null, linksLoading: false,
        jobs: {}, dlTimer: null,
        bindInput: '', probe: null,
        hunt: null, hunting: false, huntUrl: '',
        err: '', msg: '', loading: false, nowTs: Math.floor(Date.now() / 1000),
      }
    },
    computed: {
      shown() {
        const kw = this.keyword.trim().toLowerCase()
        let list = this.cards.slice()
        if (this.kindFilter) list = list.filter((c) => (c.kind || 'yegames') === this.kindFilter)
        if (this.stateFilter) list = list.filter((c) => (c.state || 'active') === this.stateFilter)
        if (this.onlyLinked) list = list.filter((c) => c.folder)
        if (kw) {
          list = list.filter((c) => ((c.title || '') + ' ' + (c.name || '')).toLowerCase().includes(kw))
        }
        const by = this.sortBy
        list.sort((a, b) => {
          if (by === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'zh')
          if (by === 'size') return n(b.size_mb) - n(a.size_mb)
          if (by === 'state') return String(a.state || '').localeCompare(String(b.state || ''))
          return n(b.last_seen) - n(a.last_seen)
        })
        return list
      },
      activeJobs() {
        return Object.values(this.jobs).filter((j) => RUNNING.includes(j.state))
      },
    },
    methods: {
      stamp(ts) {
        if (!ts) return '—'
        const d = new Date(n(ts) * 1000)
        const p = (x) => String(x).padStart(2, '0')
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
          ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
      },
      async loadBase() {
        try {
          const [c, i, s] = await Promise.all([
            ctx.invoke(IFACE.cfgGet), ctx.invoke(IFACE.info), ctx.invoke(IFACE.idx).catch(() => null),
          ])
          this.cfg = c || {}
          this.info = i || null
          this.idx = s || null
        } catch (e) { this.err = (e && e.message) || String(e) }
      },
      async loadLibrary() {
        this.loading = true
        try {
          const r = await ctx.invoke(IFACE.lib, {}, { timeoutMs: 30000 })
          this.cards = (r && r.items) || []
          this.counts = (r && r.counts) || {}
          this.libTs = (r && r.updated_at) || 0
        } catch (e) { this.err = (e && e.message) || String(e) }
        this.loading = false
      },
      async startMine(rebuild) {
        this.err = ''
        this.msg = ''
        this.modal = { kind: 'mine' }
        try {
          await ctx.invoke(IFACE.mineStart, { rebuild_index: !!rebuild }, { timeoutMs: 20000 })
        } catch (e) { this.err = (e && e.message) || String(e) }
        this.pollMine(true)
      },
      pollMine(force) {
        if (this.mineTimer && !force) return
        const tick = async () => {
          try {
            const p = await ctx.invoke(IFACE.mineStatus, {}, { timeoutMs: 15000 })
            this.mine = p || null
            this.nowTs = Math.floor(Date.now() / 1000)
            if (p && !p.running) {
              this.stopPoll('mineTimer')
              if (p.stats && p.stats.total !== undefined) {
                this.msg = '挖掘完成：共 ' + p.stats.total + ' 张（新增 ' + (p.stats.new || 0) +
                  ' / 更新 ' + (p.stats.updated || 0) + ' / 过期 ' + (p.stats.stale || 0) + '）'
              }
              this.loadLibrary()
            }
          } catch (e) {
            this.stopPoll('mineTimer')
            this.err = (e && e.message) || String(e)
          }
        }
        tick()
        this.mineTimer = window.setInterval(tick, 700)
      },
      async cancelMine() {
        try { await ctx.invoke(IFACE.mineCancel, {}, { timeoutMs: 10000 }) } catch (e) { /* noop */ }
      },
      async resumeMineIfRunning() {
        try {
          const p = await ctx.invoke(IFACE.mineStatus, {}, { timeoutMs: 10000 })
          this.mine = p || null
          if (p && p.running) {
            this.modal = { kind: 'mine' }
            this.pollMine(true)
          }
        } catch (e) { /* noop */ }
      },
      stopPoll(key) {
        if (this[key]) {
          window.clearInterval(this[key])
          this[key] = null
        }
      },
      async tgMine() {
        this.err = ''
        this.modal = { kind: 'mine' }
        try {
          await ctx.invoke(IFACE.tgMine, { pages: Number(this.tgPages) || 3, keyword: this.tgKeyword || '' },
            { timeoutMs: 20000 })
          this.pollMine(true)
        } catch (e) { this.err = (e && e.message) || String(e) }
      },
      async openTgLinks(card) {
        this.modal = { kind: 'tg', card }
        this.tgLinks = null
        this.tgLoading = true
        this.err = ''
        try {
          this.tgLinks = await ctx.invoke(IFACE.tgLinks, { uid: card.uid }, { timeoutMs: 60000 })
        } catch (e) { this.err = (e && e.message) || String(e) }
        this.tgLoading = false
      },
      async huntLinks(card, url) {
        this.hunting = true
        this.err = ''
        this.hunt = null
        try {
          if (url) {
            this.hunt = await ctx.invoke(IFACE.huntUrl, { url }, { timeoutMs: 45000 })
          } else if (card && card.uid) {
            this.hunt = await ctx.invoke(IFACE.huntItem, { uid: card.uid }, { timeoutMs: 90000 })
          }
          this.msg = (this.hunt && this.hunt.message) || ''
          if (card && card.uid) this.loadLibrary()
        } catch (e) { this.err = (e && e.message) || String(e) }
        this.hunting = false
      },
      async openLinks(card) {
        this.modal = { kind: 'links', card, title: card && card.title }
        this.links = null
        this.linksLoading = true
        this.err = ''
        this.hunt = null
        this.huntUrl = ''
        this.bindInput = (card && card.folder) || ''
        if (!card || !card.uid) { this.linksLoading = false; return }
        try {
          this.links = await ctx.invoke(IFACE.links, { uid: card.uid }, { timeoutMs: 45000 })
        } catch (e) { this.err = (e && e.message) || String(e) }
        this.linksLoading = false
      },
      async startDownload(file) {
        if (!file || !file.url) { this.err = '直链为空，重新取一次'; return }
        try {
          const title = (this.modal && this.modal.card && this.modal.card.name) || 'yegames'
          const r = await ctx.invoke(IFACE.dlStart, { url: file.url, name: file.name, title },
            { timeoutMs: 20000 })
          const job = (r && r.job) || null
          if (job) {
            this.jobs = Object.assign({}, this.jobs, { [job.id]: job })
            this.pollJobs(true)
          }
        } catch (e) { this.err = (e && e.message) || String(e) }
      },
      pollJobs(force) {
        if (this.dlTimer && !force) return
        const tick = async () => {
          this.nowTs = Math.floor(Date.now() / 1000)
          const ids = Object.keys(this.jobs)
          for (const id of ids) {
            const j = this.jobs[id]
            if (!j || !RUNNING.includes(j.state)) continue
            try {
              const s = await ctx.invoke(IFACE.dlStatus, { id }, { timeoutMs: 12000 })
              if (s) this.jobs = Object.assign({}, this.jobs, { [id]: s })
            } catch (e) { /* 任务可能已被清理 */ }
          }
          if (!Object.values(this.jobs).some((j) => RUNNING.includes(j.state))) {
            this.stopPoll('dlTimer')
          }
        }
        tick()
        if (this.dlTimer) window.clearInterval(this.dlTimer)
        this.dlTimer = window.setInterval(tick, 800)
      },
      async cancelJob(job) {
        try {
          const r = await ctx.invoke(IFACE.dlCancel, { id: job.id }, { timeoutMs: 12000 })
          if (r && r.job) this.jobs = Object.assign({}, this.jobs, { [job.id]: r.job })
        } catch (e) { this.err = (e && e.message) || String(e) }
      },
      async loadJobs() {
        try {
          const r = await ctx.invoke(IFACE.dlList, {}, { timeoutMs: 15000 })
          const m = {}
          ;((r && r.jobs) || []).forEach((j) => { m[j.id] = j })
          this.jobs = m
          if (Object.values(m).some((j) => RUNNING.includes(j.state))) this.pollJobs(true)
        } catch (e) { /* noop */ }
      },
      async removeJob(job) {
        try {
          await ctx.invoke(IFACE.dlRemove, { id: job.id }, { timeoutMs: 15000 })
          const m = Object.assign({}, this.jobs)
          delete m[job.id]
          this.jobs = m
          this.msg = '已从列表移除'
        } catch (e) { this.err = (e && e.message) || String(e) }
      },
      async clearFinished() {
        const done = Object.values(this.jobs).filter((j) => !RUNNING.includes(j.state))
        for (const j of done) {
          try { await ctx.invoke(IFACE.dlRemove, { id: j.id }, { timeoutMs: 12000 }) } catch (e) { /* noop */ }
        }
        const m = Object.assign({}, this.jobs)
        done.forEach((j) => { delete m[j.id] })
        this.jobs = m
        this.msg = done.length ? ('已清理 ' + done.length + ' 条已结束任务') : '没有可清理的任务'
      },
      openBind(card) {
        this.modal = { kind: 'bind', card }
        this.bindInput = (card && card.folder) || ''
        this.probe = null
      },
      async probeFolder() {
        if (!this.bindInput.trim()) { this.err = '先填镜像目录，例如 /A6-7QIAN/LuoLiTa-v1-08'; return }
        try {
          this.probe = await ctx.invoke(IFACE.folderList, { folder: this.bindInput.trim() }, { timeoutMs: 45000 })
          this.msg = '目录可读：' + ((this.probe.files || []).length) + ' 个文件'
        } catch (e) { this.err = (e && e.message) || String(e); this.probe = null }
      },
      async doBind() {
        const card = this.modal && this.modal.card
        if (!card) return
        try {
          await ctx.invoke(IFACE.bind, { uid: card.uid, folder: this.bindInput.trim() }, { timeoutMs: 20000 })
          this.msg = this.bindInput.trim() ? '已绑定目录' : '已解绑'
          this.modal = null
          this.loadLibrary()
        } catch (e) { this.err = (e && e.message) || String(e) }
      },
      async saveCfg() {
        try {
          const r = await ctx.invoke(IFACE.cfgSave, Object.assign({}, this.cfg), { timeoutMs: 20000 })
          this.cfg = (r && r.config) || this.cfg
          this.msg = '设置已保存（下次挖掘生效）'
          this.loadBase()
        } catch (e) { this.err = (e && e.message) || String(e) }
      },
      async doCopy(text) {
        const ok = await copyText(text)
        this.msg = ok ? '已复制' : '复制失败，请手动选中'
      },
      openUrl(u) { if (u && window.open) window.open(u, '_blank', 'noopener') },
      closeModal() {
        this.modal = null
        this.links = null
        this.probe = null
      },
    },
    mounted() {
      this.loadBase()
      this.loadLibrary()
      this.loadJobs()
      this.resumeMineIfRunning()
    },
    beforeUnmount() {
      this.stopPoll('mineTimer')
      this.stopPoll('dlTimer')
    },
    render() {
      const badge = (text, color) => h('span', {
        style: 'display:inline-block;font-size:11px;line-height:1.7;padding:0 6px;margin:0 4px 4px 0;' +
          'border-radius:4px;border:1px solid ' + (color || 'rgba(127,127,127,.45)') + ';color:inherit;opacity:.92;',
      }, text)
      const btn = (label, onClick, cls) => h('button', {
        class: 'btn btn-sm ' + (cls || ''), onClick,
      }, label)
      const bar = (percent, color) => h('div', {
        style: 'height:8px;border-radius:4px;background:rgba(127,127,127,.18);overflow:hidden;',
      }, [h('div', {
        style: 'height:100%;width:' + Math.max(0, Math.min(100, n(percent))) + '%;' +
          'background:' + (color || 'var(--primary,#4a8cff)') + ';transition:width .3s;',
      })])

      const modalShell = (title, body, footer) => h('div', {
        style: 'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-start;' +
          'justify-content:center;padding:6vh 12px;background:rgba(10,14,22,.46);backdrop-filter:blur(2px);',
        onClick: (e) => { if (e.target === e.currentTarget) this.closeModal() },
      }, [
        h('div', {
          style: 'width:100%;max-width:820px;max-height:84vh;display:flex;flex-direction:column;' +
            'background:var(--card-bg,#fff);border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.28);' +
            'border:1px solid rgba(127,127,127,.22);overflow:hidden;',
        }, [
          h('div', {
            style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;' +
              'padding:14px 16px;border-bottom:1px solid rgba(127,127,127,.2);',
          }, [
            h('div', { style: 'font-size:14px;font-weight:600;line-height:1.4;' }, title),
            h('button', { class: 'btn btn-sm', onClick: () => this.closeModal() }, '关闭'),
          ]),
          h('div', { style: 'padding:14px 16px;overflow:auto;flex:1;' }, body),
          footer ? h('div', { style: 'padding:10px 16px;border-top:1px solid rgba(127,127,127,.2);' }, footer) : null,
        ]),
      ])

      const mineModal = () => {
        const p = this.mine || {}
        const logs = (p.log || []).slice(-60)
        return modalShell(
          '挖掘进度 · ' + (p.phase_label || '准备中'),
          h('div', null, [
            h('div', { style: 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;' }, [
              h('span', null, '阶段：' + (p.phase || '-') + '　已用 ' + (p.elapsed || 0) + 's'),
              h('span', null, (p.done || 0) + ' / ' + (p.total || 0) + '　' + n(p.percent) + '%'),
            ]),
            bar(p.percent, p.running ? 'var(--primary,#4a8cff)' : '#2e9e5b'),
            p.stats && p.stats.total !== undefined
              ? h('div', { style: 'margin-top:10px;font-size:12px;line-height:1.9;' }, [
                  h('div', null, '卡片库合计 ' + p.stats.total + ' 张'),
                  h('div', null, '新增 ' + (p.stats.new || 0) + ' · 更新 ' + (p.stats.updated || 0) +
                    ' · 未变 ' + (p.stats.same || 0) + ' · 过期 ' + (p.stats.stale || 0)),
                  h('div', null, '镜像目录 ' + (p.stats.index_dirs || 0) + ' 个'),
                ])
              : null,
            h('div', {
              style: 'margin-top:10px;max-height:44vh;overflow:auto;background:rgba(127,127,127,.08);' +
                'border-radius:8px;padding:8px 10px;font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:1.7;',
            }, logs.length
              ? logs.map((l, i) => h('div', { key: i, style: 'white-space:pre-wrap;word-break:break-all;' },
                  '[' + l.t + 's] ' + l.msg))
              : [h('div', { class: 'faint' }, '等待第一条日志…')]),
          ]),
          p.running
            ? h('div', null, [btn('取消挖掘', () => this.cancelMine(), 'btn-danger')])
            : h('div', { class: 'faint', style: 'font-size:12px;' },
                p.phase === 'error' ? ('出错：' + (p.error || '')) : '已完成，可以关闭窗口')
        )
      }

      const jobRow = (job) => {
        const running = RUNNING.includes(job.state)
        const waited = job.started_at ? Math.max(0, this.nowTs - Math.floor(job.started_at)) : 0
        return h('div', {
          key: job.id,
          style: 'border:1px solid rgba(127,127,127,.22);border-radius:8px;padding:8px 10px;margin-top:8px;',
        }, [
          h('div', { style: 'display:flex;justify-content:space-between;gap:8px;font-size:12px;' }, [
            h('span', { style: 'word-break:break-all;' }, job.name),
            h('span', {
              class: 'faint',
              style: job.state === 'error' ? 'color:#c0392b;' : (job.state === 'done' ? 'color:#2e9e5b;' : ''),
            }, (JOB_LABEL[job.state] || job.state) +
              ((job.state === 'connecting' || job.state === 'queued') && waited ? ('（已等 ' + waited + 's）') : '') +
              (job.mode === 'segments' ? ('　' + (job.segments || 1) + ' 线程') :
                (job.mode === 'single' ? '　单线程' : ''))),
          ]),
          bar(job.percent, job.state === 'done' ? '#2e9e5b' : (job.state === 'error' ? '#c0392b' : 'var(--primary,#4a8cff)')),
          h('div', { class: 'faint', style: 'font-size:11px;margin-top:4px;line-height:1.7;' }, [
            h('div', null, fmtBytes(job.received) + ' / ' + fmtBytes(job.total) + '　' +
              fmtBytes(job.speed) + '/s　剩余 ' + fmtEta(job.eta) +
              (job.resumed_from ? ('　续传自 ' + fmtBytes(job.resumed_from)) : '')),
            job.state === 'connecting'
              ? h('div', null, '正在和存储建立连接（镜像慢时首字节可能要等几十秒，超过 ' +
                  (job.stall_sec || 45) + ' 秒会判为停滞）')
              : null,
            job.path ? h('div', { style: 'word-break:break-all;' }, '落盘：' + job.path) : null,
            job.error ? h('div', { style: 'color:#c0392b;' }, job.error) : null,
          ]),
          running ? h('div', { style: 'margin-top:6px;' }, [btn('取消', () => this.cancelJob(job))]) : null,
          !running
            ? h('div', { style: 'margin-top:6px;' }, [btn('从列表移除', () => this.removeJob(job))])
            : null,
        ])
      }

      const linksModal = () => {
        const L = this.links
        const card = (this.modal && this.modal.card) || {}
        const pw = (L && L.passwords) || card.passwords || []
        const jobs = Object.values(this.jobs)
        return modalShell(
          (card.name ? ('直链与下载 · ' + card.name.slice(0, 40)) : '下载任务'),
          h('div', null, [
            h('div', { style: 'font-size:12px;line-height:1.9;' }, [
              h('div', null, ['解压密码：', pw.length
                ? h('b', { style: 'color:#d68910;' }, pw.join(' / '))
                : h('span', { class: 'faint' }, '该源未标注'),
                '　', btn('复制密码', () => this.doCopy(pw[0] || ''))]),
              L && L.entry_url ? h('div', { style: 'word-break:break-all;' }, ['目录入口：' + L.entry_url + ' ',
                btn('复制', () => this.doCopy(L.entry_url)), btn('打开', () => this.openUrl(L.entry_url))]) : null,
              L && L.mirror_entry ? h('div', { style: 'word-break:break-all;' }, ['备用镜像：' + L.mirror_entry + ' ',
                btn('复制', () => this.doCopy(L.mirror_entry))]) : null,
              this.cfg ? h('div', { class: 'faint' }, '下载目录：' + this.cfg.download_dir) : null,
            ]),
            card.uid ? h('div', { style: 'margin:10px 0 6px;font-size:13px;font-weight:600;' }, '文件') : null,
            this.linksLoading ? h('p', { class: 'hint' }, '正在取直链（签名 4 小时有效）…') : null,
            L && (L.files || []).length
              ? h('div', null, L.files.map((f) => h('div', {
                  key: f.name,
                  style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;' +
                    'border-top:1px solid rgba(127,127,127,.18);',
                }, [
                  h('div', { style: 'flex:1;min-width:200px;font-size:12px;word-break:break-all;' },
                    f.name + '　' + fmtSize(n(f.size_mb))),
                  btn('下载', () => this.startDownload(f), 'btn-primary'),
                  f.alt_url ? btn('备用线路', () => this.startDownload({ url: f.alt_url, name: f.name })) : null,
                  btn('复制直链', () => this.doCopy(f.url)),
                ])))
              : (this.linksLoading ? null : (card.uid ? h('p', { class: 'hint' }, '没有文件，或该目录不存在。') : null)),
            h('div', {
              style: 'margin-top:14px;padding-top:10px;border-top:1px dashed rgba(127,127,127,.3);',
            }, [
              h('div', { style: 'font-size:13px;font-weight:600;margin-bottom:6px;' }, '直链猎手（从源页挖网盘直链）'),
              h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;' }, [
                h('input', {
                  class: 'input', style: 'flex:1;min-width:240px;',
                  placeholder: '粘贴任意资源页 URL，或直接对这张卡片抓它的源页',
                  value: this.huntUrl, onInput: (e) => { this.huntUrl = e.target.value },
                }),
                btn(this.hunting ? '抓取中…' : '抓这个 URL',
                  () => this.huntLinks(card, this.huntUrl.trim())),
                card.uid ? btn('抓卡片的源页', () => this.huntLinks(card, ''), 'btn-primary') : null,
              ]),
              h('div', { class: 'faint', style: 'font-size:11px;line-height:1.7;margin-top:6px;' },
                '会还原 HTML 实体、JS 转义与 base64 里藏的链接；需要登录/会员才显示链接的源，先在设置里填该源的 Cookie。'),
              this.hunt ? h('div', { style: 'margin-top:8px;' }, [
                (this.hunt.found || this.hunt.links || []).length
                  ? h('div', null, (this.hunt.found || this.hunt.links).map((f) => h('div', {
                      key: f.url,
                      style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;' +
                        'border-top:1px solid rgba(127,127,127,.14);font-size:12px;',
                    }, [
                      badge(f.kind || '网盘'),
                      h('span', { style: 'flex:1;min-width:200px;word-break:break-all;' }, f.url),
                      f.code ? h('span', { style: 'color:#d68910;' }, '码 ' + f.code) : null,
                      btn('复制', () => this.doCopy(f.url)),
                      btn('打开', () => this.openUrl(f.url)),
                    ])))
                  : h('p', { class: 'hint' }, (this.hunt.message || '没挖到链接') +
                      ((this.hunt.notes || []).length ? ('　' + this.hunt.notes.join('；')) : '')),
                (this.hunt.candidates || []).length
                  ? h('div', { style: 'margin-top:8px;' }, [
                      h('div', { class: 'faint', style: 'font-size:12px;margin-bottom:4px;' },
                        '相近候选（未确认，可能是别的作品，仅供核对）：'),
                      this.hunt.candidates.map((f) => h('div', {
                        key: 'c-' + f.url,
                        style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 0;' +
                          'font-size:11px;opacity:.85;',
                      }, [
                        badge(f.kind || '网盘', 'rgba(214,137,16,.8)'),
                        h('span', { style: 'min-width:120px;' }, (f.hit || '') + ' (' + (f.score || 0) + ')'),
                        h('span', { style: 'flex:1;min-width:180px;word-break:break-all;' }, f.url),
                        btn('复制', () => this.doCopy(f.url)),
                        btn('打开', () => this.openUrl(f.url)),
                      ])),
                    ])
                  : null,
              ]) : null,
            ]),
            jobs.length ? h('div', { style: 'margin-top:12px;' }, [
              h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;' }, [
                h('div', { style: 'font-size:13px;font-weight:600;' }, '下载任务'),
                btn('清理已结束', () => this.clearFinished()),
              ]),
              jobs.map(jobRow),
            ]) : null,
          ]),
          card.uid
            ? h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' }, [
                btn('手动绑定目录', () => this.openBind(card)),
                h('span', { class: 'faint', style: 'font-size:11px;line-height:2;' },
                  '直链 4 小时过期；过期后再点一次「直链」即可重新签发。'),
              ])
            : null
        )
      }

      const tgModal = () => {
        const card = (this.modal && this.modal.card) || {}
        const rows = (this.tgLinks && this.tgLinks.links) || []
        return modalShell('TouchGal 网盘直链 · ' + ((card.name || '').slice(0, 36)),
          h('div', null, [
            h('div', { class: 'faint', style: 'font-size:12px;line-height:1.9;' }, [
              h('div', null, '这些是网盘分享链接（夸克/百度等），不是文件直链：点「打开」在网盘里转存，提取码已一并列出。'),
              card.source_url ? h('div', { style: 'word-break:break-all;' }, ['资源页：' + card.source_url + ' ',
                btn('打开', () => this.openUrl(card.source_url))]) : null,
            ]),
            this.tgLoading ? h('p', { class: 'hint' }, '读取资源列表…') : null,
            rows.length
              ? h('div', { style: 'margin-top:8px;' }, rows.map((f) => h('div', {
                  key: f.url,
                  style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:7px 0;' +
                    'border-top:1px solid rgba(127,127,127,.16);font-size:12px;',
                }, [
                  badge(f.kind || '网盘'),
                  h('span', { style: 'flex:1;min-width:200px;word-break:break-all;' }, f.url),
                  f.code ? h('span', { style: 'color:#d68910;' }, '码 ' + f.code) : null,
                  btn('复制', () => this.doCopy(f.url)),
                  btn('打开', () => this.openUrl(f.url)),
                ])))
              : (this.tgLoading ? null : h('p', { class: 'hint' }, (this.tgLinks && this.tgLinks.message) || '没有链接')),
          ]))
      }

      const bindModal = () => {
        const card = (this.modal && this.modal.card) || {}
        return modalShell('绑定镜像目录 · ' + ((card.name || '').slice(0, 36)),
          h('div', null, [
            h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' }, [
              h('input', {
                class: 'input', style: 'flex:1;min-width:260px;',
                placeholder: '镜像目录，例如 /A6-7QIAN/LuoLiTa-v1-08',
                value: this.bindInput, onInput: (e) => { this.bindInput = e.target.value },
              }),
              btn('试探目录', () => this.probeFolder()),
            ]),
            this.probe && (this.probe.files || []).length
              ? h('div', { style: 'margin-top:8px;font-size:12px;line-height:1.8;' },
                  this.probe.files.map((f) => h('div', { key: f.name },
                    f.name + '　' + fmtSize(n(f.size_mb)) + (f.url ? '　✔ 直链可用' : '　✘ 无直链'))))
              : null,
          ]),
          h('div', null, [btn('保存绑定', () => this.doBind(), 'btn-primary')]))
      }

      const settingsModal = () => {
        if (!this.cfg) return modalShell('设置', h('p', { class: 'hint' }, '配置加载中…'))
        const srcRow = (s, i) => h('div', {
          key: s.id,
          style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;' +
            'border-top:1px solid rgba(127,127,127,.16);font-size:12px;',
        }, [
          h('label', { style: 'display:flex;gap:6px;align-items:center;min-width:170px;' }, [
            h('input', {
              type: 'checkbox', checked: !!s.enabled,
              onChange: (e) => { this.cfg.sources[i].enabled = e.target.checked },
            }), s.label,
          ]),
          h('span', { class: 'faint' }, (s.kind === 'zblog' || s.kind === 'html') ? 'HTML 搜索' : 'REST'),
          h('input', {
            class: 'input', style: 'width:110px;', value: s.search,
            onInput: (e) => { this.cfg.sources[i].search = e.target.value },
          }),
          h('input', {
            class: 'input', style: 'width:150px;', value: s.password,
            onInput: (e) => { this.cfg.sources[i].password = e.target.value },
            placeholder: '解压密码',
          }),
        ])
        return modalShell('设置', h('div', null, [
          h('div', { style: 'font-size:13px;line-height:2.2;' }, [
            h('div', null, ['镜像主机 ',
              h('select', {
                class: 'input', style: 'width:200px;', value: this.cfg.alist_host,
                onChange: (e) => { this.cfg.alist_host = e.target.value },
              }, (this.cfg.alist_hosts || []).map((x) => h('option', { value: x }, x)))]),
            h('div', null, ['下载目录 ',
              h('input', {
                class: 'input', style: 'width:360px;', value: this.cfg.download_dir,
                onInput: (e) => { this.cfg.download_dir = e.target.value },
              })]),
            h('div', null, ['并发下载 ',
              h('input', {
                class: 'input', style: 'width:70px;', type: 'number', value: this.cfg.max_parallel_dl,
                onInput: (e) => { this.cfg.max_parallel_dl = Number(e.target.value) },
              }), '　分段线程 ',
              h('input', {
                class: 'input', style: 'width:70px;', type: 'number', min: 1, max: 16, value: this.cfg.dl_segments,
                onInput: (e) => { this.cfg.dl_segments = Number(e.target.value) },
              }), '　分段阈值 ',
              h('input', {
                class: 'input', style: 'width:80px;', type: 'number', value: this.cfg.dl_min_split_mb,
                onInput: (e) => { this.cfg.dl_min_split_mb = Number(e.target.value) },
              }), ' MB']),
            h('div', null, ['停滞判定 ',
              h('input', {
                class: 'input', style: 'width:80px;', type: 'number', value: this.cfg.dl_stall_sec,
                onInput: (e) => { this.cfg.dl_stall_sec = Number(e.target.value) },
              }), ' 秒　索引 TTL ',
              h('input', {
                class: 'input', style: 'width:80px;', type: 'number', value: this.cfg.index_ttl_min,
                onInput: (e) => { this.cfg.index_ttl_min = Number(e.target.value) },
              }), ' 分钟']),
            h('div', null, ['补齐封面最多抓 ',
              h('input', {
                class: 'input', style: 'width:70px;', type: 'number', value: this.cfg.cover_backfill_pages,
                onInput: (e) => { this.cfg.cover_backfill_pages = Number(e.target.value) },
              }), ' 页']),
          ]),
          h('div', { style: 'margin:10px 0 4px;font-size:13px;font-weight:600;' }, '挖掘源（可开关 / 改关键词 / 改密码）'),
          (this.cfg.sources || []).map(srcRow),
          h('div', { style: 'margin:12px 0 4px;font-size:13px;font-weight:600;' }, '源 Cookie（需要登录/会员才显示链接的源）'),
          h('div', { class: 'faint', style: 'font-size:11px;line-height:1.7;margin-bottom:6px;' },
            '把浏览器里该站的 Cookie 整段粘进来即可复用登录态；只存在插件本机 config.json，不会外发。'),
          (this.cfg.sources || []).map((s) => h('div', {
            key: 'ck-' + s.id,
            style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 0;font-size:12px;',
          }, [
            h('span', { style: 'min-width:150px;' }, s.label),
            h('input', {
              class: 'input', style: 'flex:1;min-width:260px;', placeholder: 'Cookie（可留空）',
              value: (this.cfg.cookies || {})[s.id] || '',
              onInput: (e) => {
                if (!this.cfg.cookies) this.cfg.cookies = {}
                this.cfg.cookies[s.id] = e.target.value
              },
            }),
          ])),
          h('label', { style: 'display:flex;gap:6px;align-items:center;font-size:13px;margin-top:10px;' }, [
            h('input', {
              type: 'checkbox', checked: this.cfg.force_ipv4 !== false,
              onChange: (e) => { this.cfg.force_ipv4 = e.target.checked },
            }), '强制 IPv4（本机有 IPv6、但到 R2/B2 的 v6 路径很慢时，下载会迟迟不开始）',
          ]),
          h('label', { style: 'display:flex;gap:6px;align-items:center;font-size:13px;margin-top:6px;' }, [
            h('input', {
              type: 'checkbox', checked: !!this.cfg.show_cover,
              onChange: (e) => { this.cfg.show_cover = e.target.checked },
            }), '显示封面图',
          ]),
          h('div', { class: 'faint', style: 'font-size:11px;margin-top:8px;line-height:1.8;' },
            this.idx ? ('镜像索引：' + this.idx.dirs + ' 个目录（' + this.idx.host + '，' +
              (this.idx.age_min >= 0 ? this.idx.age_min + ' 分钟前' : '未生成') + '）') : ''),
        ]), h('div', null, [btn('保存设置', () => this.saveCfg(), 'btn-primary')]))
      }

      const coverBlock = (c, st) => {
        const chip = h('div', {
          style: 'position:absolute;left:6px;top:6px;font-size:11px;padding:1px 6px;border-radius:4px;' +
            'background:' + (STATE_COLOR[st] || '#666') + ';color:#fff;',
        }, STATE_LABEL[st] || st)
        if (c.cover) {
          return h('div', { style: 'position:relative;height:148px;background:rgba(127,127,127,.08);' }, [
            h('img', {
              src: c.cover, loading: 'lazy',
              style: 'width:100%;height:148px;object-fit:cover;display:block;',
              onError: (e) => {
                if (e && e.target) {
                  e.target.style.display = 'none'
                  if (e.target.parentNode) {
                    e.target.parentNode.style.background =
                      'linear-gradient(135deg,rgba(74,140,255,.16),rgba(127,127,127,.14))'
                  }
                }
              },
            }),
            chip,
          ])
        }
        return h('div', {
          style: 'position:relative;height:148px;display:flex;align-items:center;justify-content:center;' +
            'background:linear-gradient(135deg,rgba(74,140,255,.16),rgba(127,127,127,.14));',
        }, [
          h('div', { style: 'font-size:26px;font-weight:700;opacity:.42;' },
            String(c.name || '?').trim().slice(0, 2)),
          chip,
          h('div', { style: 'position:absolute;right:6px;bottom:6px;font-size:10px;opacity:.6;' }, '无封面'),
        ])
      }

      const card = (c) => {
        const st = c.state || 'active'
        return h('div', {
          key: c.uid,
          class: 'card',
          style: 'padding:0;overflow:hidden;display:flex;flex-direction:column;' +
            (st === 'stale' ? 'opacity:.62;' : ''),
        }, [
          this.cfg && this.cfg.show_cover
            ? coverBlock(c, st)
            : h('div', { style: 'padding:8px 10px 0;font-size:11px;color:' + (STATE_COLOR[st] || '#666') + ';' },
                STATE_LABEL[st] || st),
          h('div', { style: 'padding:10px;display:flex;flex-direction:column;flex:1;' }, [
            h('div', {
              style: 'font-size:13px;font-weight:600;line-height:1.45;max-height:3.9em;overflow:hidden;',
              title: c.title,
            }, c.name || c.title),
            h('div', { style: 'margin-top:6px;' }, [
              badge(c.type || 'RPG'), c.version ? badge('v' + c.version) : null,
              badge(c.platform || 'PC'),
              c.kind === 'touchgal' ? badge('TouchGal', 'rgba(46,158,91,.7)') : null,
              c.size_mb ? badge(fmtSize(n(c.size_mb))) : null,
              c.downloads ? badge('下载 ' + c.downloads, 'rgba(74,140,255,.55)') : null,
              (c.sources_detail || []).filter((x) => x.id !== 'touchgal')
                .map((x) => badge(x.label, 'rgba(74,140,255,.7)')),
            ]),
            c.passwords && c.passwords.length
              ? h('div', { style: 'font-size:11px;line-height:1.7;color:#d68910;' },
                  '解压密码：' + c.passwords.join(' / '))
              : null,
            h('div', { class: 'faint', style: 'font-size:11px;line-height:1.6;margin-top:4px;word-break:break-all;' },
              c.kind === 'touchgal'
                ? ('评 ' + (c.rating || '-') + '　' + ((c.tags || []).slice(0, 3).join(' · ') || ''))
                : (c.folder ? ('目录 ' + c.folder + (c.matched_by === 'manual' ? '（手动）' : '')) : '未对上镜像')),
            h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;' },
              c.kind === 'touchgal'
                ? [
                    h('button', { class: 'btn btn-sm btn-primary', onClick: () => this.openTgLinks(c) }, '网盘直链'),
                    btn('资源页', () => this.openUrl(c.source_url)),
                  ]
                : [
                    h('button', {
                      class: 'btn btn-sm ' + (c.folder ? 'btn-primary' : ''),
                      onClick: () => (c.folder ? this.openLinks(c) : this.openBind(c)),
                    }, c.folder ? '直链 / 下载' : '绑定目录'),
                    btn('绑定', () => this.openBind(c)),
                    btn('源页', () => this.openUrl(((c.sources_detail || [])[0] || {}).url)),
                  ]),
          ]),
        ])
      }

      const chip = (label, active, onClick) => h('button', {
        class: 'btn btn-sm' + (active ? ' btn-primary' : ''),
        style: 'margin-right:6px;', onClick,
      }, label)

      const counts = this.counts || {}
      return h('div', null, [
        h('div', { class: 'section-title' }, '叶酱游戏 · 多源挖掘 / 卡片库 / 内置下载器'),
        h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center;' }, [
          h('button', {
            class: 'btn btn-sm btn-primary',
            disabled: !!(this.mine && this.mine.running),
            onClick: () => this.startMine(false),
          }, this.mine && this.mine.running ? '挖掘中…' : '开始挖掘'),
          btn('重建索引并挖掘', () => this.startMine(true)),
          h('span', { style: 'display:inline-flex;gap:4px;align-items:center;' }, [
            h('input', {
              class: 'input', style: 'width:64px;', type: 'number', min: 1, max: 20,
              value: this.tgPages, title: 'TouchGal 导入页数（每页 24 部）',
              onInput: (e) => { this.tgPages = Number(e.target.value) || 1 },
            }),
            h('input', {
              class: 'input', style: 'width:110px;', placeholder: '关键词（可空）',
              value: this.tgKeyword, onInput: (e) => { this.tgKeyword = e.target.value },
            }),
            btn('TouchGal 导入', () => this.tgMine()),
          ]),
          btn('下载任务 (' + this.activeJobs.length + ')', () => { this.loadJobs(); this.modal = { kind: 'links', card: {} } }),
          btn('设置', () => { this.loadBase(); this.modal = { kind: 'settings' } }),
          h('input', {
            class: 'input', style: 'width:200px;', placeholder: '过滤标题…', value: this.keyword,
            onInput: (e) => { this.keyword = e.target.value },
          }),
          h('select', {
            class: 'input', style: 'width:130px;', value: this.sortBy,
            onChange: (e) => { this.sortBy = e.target.value },
          }, [
            h('option', { value: 'recent' }, '按最近发现'),
            h('option', { value: 'size' }, '按体积'),
            h('option', { value: 'name' }, '按名称'),
            h('option', { value: 'state' }, '按状态'),
          ]),
        ]),
        h('div', { style: 'margin-bottom:8px;' }, [
          chip('全部 ' + (counts.all || 0), !this.stateFilter && !this.onlyLinked && !this.kindFilter,
            () => { this.stateFilter = ''; this.onlyLinked = false; this.kindFilter = '' }),
          chip('叶酱 ' + (counts.yegames || 0), this.kindFilter === 'yegames',
            () => { this.kindFilter = this.kindFilter === 'yegames' ? '' : 'yegames'; this.stateFilter = ''; this.onlyLinked = false }),
          chip('TouchGal ' + (counts.touchgal || 0), this.kindFilter === 'touchgal',
            () => { this.kindFilter = this.kindFilter === 'touchgal' ? '' : 'touchgal'; this.stateFilter = ''; this.onlyLinked = false }),
          chip('新增 ' + (counts.new || 0), this.stateFilter === 'new', () => { this.stateFilter = 'new'; this.onlyLinked = false }),
          chip('有更新 ' + (counts.updated || 0), this.stateFilter === 'updated', () => { this.stateFilter = 'updated'; this.onlyLinked = false }),
          chip('已过期 ' + (counts.stale || 0), this.stateFilter === 'stale', () => { this.stateFilter = 'stale'; this.onlyLinked = false }),
          chip('可直链 ' + (counts.linked || 0), this.onlyLinked, () => { this.onlyLinked = !this.onlyLinked; this.stateFilter = '' }),
        ]),
        h('div', { class: 'faint', style: 'font-size:12px;line-height:1.8;margin-bottom:8px;' },
          '卡片库更新于 ' + this.stamp(this.libTs) + '　源 ' +
          ((this.cfg && (this.cfg.sources || []).filter((s) => s.enabled).map((s) => s.label).join(' / ')) || '—') +
          (this.idx ? ('　索引 ' + this.idx.dirs + ' 个目录') : '')),
        this.err ? h('p', { style: 'color:var(--danger,#c33);font-size:12px;' }, this.err) : null,
        this.msg ? h('p', { style: 'color:var(--ok,#2a8);font-size:12px;' }, this.msg) : null,
        this.activeJobs.length
          ? h('div', { class: 'card', style: 'padding:10px;margin-bottom:10px;' }, [
              h('div', { style: 'font-size:12px;font-weight:600;margin-bottom:4px;' }, '正在下载'),
              this.activeJobs.map(jobRow),
            ])
          : null,
        this.loading && !this.cards.length
          ? h('p', { class: 'hint' }, '读取卡片库…')
          : (this.shown.length
              ? h('div', {
                  class: 'card-grid',
                  style: 'grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;',
                }, this.shown.map(card))
              : h('p', { class: 'hint' },
                  this.cards.length ? '当前筛选没有结果。' : '卡片库是空的，点「开始挖掘」跑一轮（会开悬浮窗显示实时进度）。')),
        this.modal && this.modal.kind === 'mine' ? mineModal() : null,
        this.modal && this.modal.kind === 'links' ? linksModal() : null,
        this.modal && this.modal.kind === 'bind' ? bindModal() : null,
        this.modal && this.modal.kind === 'tg' ? tgModal() : null,
        this.modal && this.modal.kind === 'settings' ? settingsModal() : null,
        h('div', {
          class: 'faint',
          style: 'font-size:11px;line-height:1.7;margin-top:14px;border-top:1px solid rgba(127,127,127,.2);padding-top:8px;',
        }, [
          h('div', null, '挖掘的是各发布源的公开搜索接口；直链来自公开 AList 镜像，插件不内置、不分发游戏文件。'),
          h('div', null, (this.info && this.info.tips) || '镜像包解压密码通常为 gacg。'),
          this.info ? h('div', null, this.info.label + ' v' + this.info.version + ' · 下载目录 ' + this.info.download_dir) : null,
        ]),
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '叶酱游戏' }], mount }
}
if (typeof window !== 'undefined') register(window)
