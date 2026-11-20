// GitHub 下载器前端
import { createApp, h } from 'vue'

const NAME = 'GithubDownloader'

function mount(container, ctx) {
  const App = {
    data() {
      return {
        url: '', token: '', proxy: false,
        tab: 'archives', loading: false, err: '', scan: null,
        selected: {}, fileQ: '', fileLimit: 1000, tasks: [], taskTimer: null,
        archiveBusy: {}, cloning: false,
      }
    },
    computed: {
      repo() { return (this.scan && this.scan.repo) || {} },
      files() {
        const q = this.fileQ.trim().toLowerCase()
        const list = (this.scan && this.scan.files) || []
        return (q ? list.filter(x => (x.path || '').toLowerCase().includes(q)) : list).slice(0, this.fileLimit)
      },
      selectedFiles() {
        return ((this.scan && this.scan.files) || []).filter(x => this.selected[x.path])
      },
    },
    methods: {
      fmt(n) {
        n = Number(n) || 0
        if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB'
        if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(2) + ' MB'
        if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
        return n + ' B'
      },
      async scanRepo() {
        if (!this.url.trim()) { this.err = '请输入 GitHub 仓库链接'; return }
        this.loading = true; this.err = ''; this.selected = {}; this.scan = null
        try {
          const st = await ctx.invoke('ghdl.scan.start', { url: this.url.trim(), token: this.token.trim() })
          const sid = st.scan_id
          for (let i = 0; i < 300; i++) {
            await new Promise(r => setTimeout(r, 1200))
            const d = await ctx.invoke('ghdl.scan.status', { scan_id: sid })
            if (d.status === 'done') { this.scan = d.result; break }
            if (d.status === 'error') throw new Error(d.error || '扫描失败')
          }
          if (!this.scan) throw new Error('扫描超时')
        } catch (e) { this.err = (e && e.message) || String(e) }
        finally { this.loading = false }
      },
      async start(items, label) {
        if (!items.length) { this.err = '没有选择下载项'; return }
        this.loading = true; this.err = ''
        try {
          const r = await ctx.invoke('ghdl.start', {
            repo_url: this.scan ? this.scan.repo.html_url : this.url,
            token: this.token.trim(), proxy: this.proxy, items,
          })
          this.tasks = (r && r.tasks) ? r.tasks.concat(this.tasks) : this.tasks
          this.tab = 'tasks'
          this.loadTasks()
        } catch (e) { this.err = (e && e.message) || String(e) }
        finally { this.loading = false }
      },
      dlArchive(a) {
        this.start([{ kind: 'archive', name: a.name, url: a.url, ref: a.ref }], a.title)
      },
      dlAsset(rel, a) {
        this.start([{ kind: 'asset', name: a.name, url: a.url, rel: rel.tag }], a.name)
      },
      cloneRepo() {
        if (!this.scan) return
        const g = this.scan.git
        this.cloning = true
        this.start([{ kind: 'git', name: this.repo.name + '-' + g.ref, url: g.url, ref: g.ref }], 'git clone')
        this.cloning = false
      },
      toggle(path) { this.selected[path] = !this.selected[path] },
      selectAllFiles() {
        const n = {}
        ;((this.scan && this.scan.files) || []).forEach(x => { n[x.path] = true })
        this.selected = n
      },
      selectAll(on) {
        const n = {}
        if (on) this.files.forEach(x => { n[x.path] = true })
        this.selected = n
      },
      dlFiles() {
        const items = this.selectedFiles.map(x => ({ kind: 'file', name: x.path, url: x.url, path: x.path }))
        this.start(items, '仓库文件')
      },
      async loadTasks() {
        try {
          const r = await ctx.invoke('ghdl.tasks', {})
          this.tasks = (r && r.tasks) || []
        } catch (e) { /* ignore polling errors */ }
      },
      async cancel(tid) {
        try { await ctx.invoke('ghdl.cancel', { tid }); this.loadTasks() } catch (e) { this.err = e.message || String(e) }
      },
      async delTask(tid) {
        if (!confirm('删除任务和已下载文件？')) return
        try { await ctx.invoke('ghdl.delete', { tid }); this.loadTasks() } catch (e) { this.err = e.message || String(e) }
      },
      async copyLink(t) {
        try { await navigator.clipboard.writeText(location.origin + this.fileUrl(t)); this.err = '链接已复制' }
        catch (e) { this.err = '复制失败: ' + (e.message || e) }
      },
      fileUrl(t) { return '/api/plugins/GithubDownloader/download/' + encodeURIComponent(t.id) },
      taskState(t) {
        if (t.status === 'done') return '完成'
        if (t.status === 'error') return '失败'
        if (t.status === 'canceled') return '已取消'
        if (t.status === 'running') return '下载中'
        return '等待'
      },
    },
    mounted() { this.loadTasks(); this.taskTimer = setInterval(() => this.loadTasks(), 2500) },
    unmounted() { clearInterval(this.taskTimer) },
    render() {
      const btn = (text, fn, cls = 'btn btn-sm') => h('button', { class: cls, onclick: fn }, text)
      const tab = (k, text) => h('button', { class: 'btn btn-sm' + (this.tab === k ? ' btn-primary' : ''), onclick: () => (this.tab = k) }, text)
      const card = (children, key) => h('div', { key, class: 'card', style: 'padding:10px;margin-bottom:8px;' }, children)
      const small = (t) => h('div', { class: 'faint', style: 'font-size:11px;margin-top:3px;' }, t)
      const taskList = this.tasks.length ? this.tasks.map((t, i) => card([
        h('div', { class: 'flex', style: 'justify-content:space-between;gap:8px;' }, [h('b', null, t.name), h('span', { class: 'faint', style: 'font-size:11px;' }, this.taskState(t))]),
        h('div', { style: 'height:6px;background:var(--border);border-radius:3px;margin:6px 0;overflow:hidden;' }, [h('div', { style: 'height:100%;width:' + (t.progress || 0) + '%;background:var(--primary);' })]),
        small(this.fmt(t.done) + (t.total ? ' / ' + this.fmt(t.total) : '') + (t.speed ? ' · ' + this.fmt(t.speed) + '/s' : '') + (t.error ? ' · ' + t.error : '')),
        h('div', { class: 'flex', style: 'gap:6px;margin-top:6px;' }, [
          t.status === 'done' ? h('a', { class: 'btn btn-sm btn-primary', href: this.fileUrl(t) }, '下载到本机') : null,
          t.status === 'done' ? btn('复制链接', () => this.copyLink(t), 'btn btn-sm') : null,
          (t.status === 'running' || t.status === 'queued') ? btn('取消', () => this.cancel(t.id), 'btn btn-sm btn-danger') : null,
          (t.status !== 'running' && t.status !== 'queued') ? btn('删除', () => this.delTask(t.id), 'btn btn-sm btn-danger') : null,
          t.path ? h('span', { class: 'faint', style: 'font-size:10px;word-break:break-all;' }, t.path) : null,
        ]),
      ], 't' + i)) : [h('div', { class: 'faint' }, '暂无任务')]
      return h('div', null, [
        h('div', { class: 'section-title' }, 'GitHub 下载器'),
        h('div', { class: 'flex', style: 'gap:6px;flex-wrap:wrap;margin-bottom:8px;' }, [
          h('input', { class: 'input', style: 'flex:1;min-width:260px;', placeholder: 'https://github.com/owner/repo', value: this.url, oninput: e => this.url = e.target.value, onkeyup: e => { if (e.key === 'Enter') this.scanRepo() } }),
          h('input', { class: 'input', style: 'width:220px;', type: 'password', placeholder: 'GitHub Token（可选）', value: this.token, oninput: e => this.token = e.target.value }),
          h('label', { class: 'check', style: 'display:flex;align-items:center;gap:4px;' }, [h('input', { type: 'checkbox', checked: this.proxy, onchange: e => this.proxy = e.target.checked }), 'gh-proxy 加速']),
          btn(this.loading ? '扫描中…' : '扫描', () => this.scanRepo(), 'btn btn-primary'),
        ]),
        this.err ? h('div', { style: 'color:var(--danger);font-size:12px;margin-bottom:8px;' }, this.err) : null,
        this.scan ? h('div', null, [
          card([
            h('div', { style: 'font-weight:600;font-size:15px;' }, this.repo.full_name),
            h('div', { style: 'font-size:12px;margin-top:4px;' }, this.repo.description || ''),
            small('默认分支 ' + (this.repo.default_branch || '-') + ' · ★ ' + (this.repo.stars || 0) + ' · Fork ' + (this.repo.forks || 0) + (this.repo.private ? ' · 私有' : '')),
          ], 'repo'),
          h('div', { class: 'flex', style: 'gap:6px;flex-wrap:wrap;margin-bottom:8px;' }, [
            tab('archives', '整仓下载'), tab('releases', 'Release 资产'), tab('files', '仓库文件'), tab('tasks', '下载任务'),
          ]),
          this.tab === 'archives' ? h('div', null, [
            card([
              h('b', null, 'Git clone'),
              small('在面板服务器实际执行 git clone --depth 1，完成后可打包下载目录。'),
              h('div', { style: 'margin-top:6px;' }, [btn(this.cloning ? '创建中…' : '克隆 ' + (this.scan.git.ref || ''), () => this.cloneRepo(), 'btn btn-primary btn-sm')]),
            ], 'git'),
            (this.scan.archives || []).map((a, i) => card([
              h('div', { class: 'flex', style: 'justify-content:space-between;gap:8px;' }, [
                h('div', null, [h('b', null, a.title), small(a.url)]),
                btn('下载', () => this.dlArchive(a)),
              ]),
            ], 'a' + i)),
          ]) : null,
          this.tab === 'releases' ? h('div', null, ((this.scan.releases || []).length ? (this.scan.releases || []).map((r, i) => card([
            h('b', null, r.name + '  ' + (r.tag || '')),
            small((r.published || '') + (r.prerelease ? ' · Pre-release' : '')),
            h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;' }, [
              btn('源码 ZIP', () => this.start([{ kind: 'archive', name: (this.repo.name || 'repo') + '-' + r.tag + '.zip', url: r.zip, ref: r.tag }], '源码 ZIP'), 'btn btn-sm'),
              btn('源码 TAR.GZ', () => this.start([{ kind: 'archive', name: (this.repo.name || 'repo') + '-' + r.tag + '.tar.gz', url: r.targz, ref: r.tag }], '源码 TAR.GZ'), 'btn btn-sm'),
            ]),
            (r.assets || []).map((a, j) => h('div', { key: 'as' + j, class: 'flex', style: 'justify-content:space-between;border-top:1px solid var(--border);padding:5px 0;gap:8px;' }, [
              h('div', null, [h('span', null, a.name), small(this.fmt(a.size) + ' · ' + (a.download_count || 0) + ' 次下载')]),
              btn('下载', () => this.dlAsset(r, a)),
            ])),
          ], 'r' + i)) : [card([h('div', null, '没有 Release')], 'norel')])) : null,
          this.tab === 'files' ? h('div', null, [
            h('div', { class: 'flex', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap;' }, [
              h('input', { class: 'input', style: 'flex:1;', placeholder: '过滤文件路径', value: this.fileQ, oninput: e => this.fileQ = e.target.value }),
              btn('全选当前', () => this.selectAll(true)),
              btn('全选全部', () => this.selectAllFiles()),
              btn('清空', () => this.selectAll(false)),
              btn('下载选中 (' + this.selectedFiles.length + ')', () => this.dlFiles(), 'btn btn-primary btn-sm'),
              this.scan.files.length > this.fileLimit ? btn('加载更多', () => this.fileLimit += 1000) : null,
            ]),
            this.scan.truncated ? h('div', { class: 'faint', style: 'font-size:11px;margin-bottom:6px;' }, '文件树过大，已截断；可用搜索过滤。') : null,
            this.files.map((f, i) => h('div', { key: f.path, class: 'flex', style: 'align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid var(--border);' }, [
              h('input', { type: 'checkbox', checked: !!this.selected[f.path], onchange: () => this.toggle(f.path) }),
              h('span', { style: 'flex:1;font-size:12px;word-break:break-all;' }, f.path),
              h('span', { class: 'faint', style: 'font-size:11px;' }, this.fmt(f.size)),
            ])),
            !this.files.length ? h('div', { class: 'faint' }, '没有文件') : null,
          ]) : null,
          this.tab === 'tasks' ? h('div', null, taskList) : null,
        ]) : null,
      ])
    },
  }
  const vm = createApp(App)
  vm.mount(container)
  return () => vm.unmount()
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'GitHub 下载器' }], mount }
}
if (typeof window !== 'undefined') register(window)
