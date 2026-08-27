// filehash 插件 Vue3 前端(独立构建, 完全自包含, esbuild 内联 vue)
// 契约: window.__rcPlugin_filehash = { name:'filehash', mount(container, ctx) }
// 与 plugins/filehash/server.py 对齐的路由契约:
//   POST /hash/hash       (files) -> {ok, results:[{name,size,md5,sha1,sha256}]}
//   POST /hash/generate   (files, algo) -> {ok, count, algo, download}
//   POST /hash/verify     (files: 校验文件+数据文件) -> {ok,total,passed,failed,algo,results:[{file,status,expected,actual?}]}
//   POST /diranalyze/stats (files) -> {ok,total_files,total_size,categories:[{name,count,size}],files:[{name,size,type}]}
//   POST /diranalyze/duplicate (files) -> {ok,total_groups,duplicates:[{hash,size,files:[{name,size}]}]}
//   GET  /file/<session>/<name>  结果文件下载
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_filehash = {
    name: 'filehash',
    mount: function (container, ctx) {
      const BASE = '/api/plugins/filehash'

      // ---- 通用工具(闭包) ----
      async function postForm(path, fd) {
        try {
          const r = await fetch(BASE + path, { method: 'POST', body: fd })
          const d = await r.json().catch(() => ({}))
          return { ok: r.ok && d.ok !== false, data: d }
        } catch (e) {
          return { ok: false, data: { error: (e && e.message) || String(e) } }
        }
      }

      function fmtSize(n) {
        if (n === null || n === undefined) return '-'
        n = Number(n) || 0
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        let i = 0
        while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1 }
        return (i === 0 ? String(n) : n.toFixed(1)) + ' ' + units[i]
      }

      // 后端 save_uploads(fields=('files',)): 全部文件用 field 'files'
      function appendFiles(fd, files) {
        files.forEach((f) => fd.append('files', f, f.name))
      }

      function errNode(txt) {
        return h('p', { style: 'color:var(--danger);font-size:12px;margin:8px 0;' }, txt || '操作失败')
      }

      function okNode(txt) {
        return h('p', { class: 'hint', style: 'margin:8px 0;' }, txt)
      }

      function dlBtn(path) {
        return h('a', { class: 'btn btn-sm btn-primary', href: BASE + path, target: '_blank', rel: 'noopener', style: 'margin-top:8px;' }, '下载结果文件')
      }

      function fileChoice(files) {
        const names = files.map((f) => f.name).join(', ')
        return h('p', { class: 'hint', style: 'margin:6px 0;' },
          files.length ? '已选择 ' + files.length + ' 个文件: ' + names : '未选择文件')
      }

      function sel(opts, value, onchange) {
        return h('select', { class: 'input', value, onchange: (e) => onchange(e.target.value) },
          opts.map(([v, label]) => h('option', { value: v }, label)))
      }

      // 校验状态映射
      const ST = { ok: ['通过', 'var(--success)'], mismatch: ['不匹配', 'var(--danger)'], missing: ['缺失', 'var(--text-faint)'] }

      // ---- ① /hash/hash 结果 ----
      function renderHash(res) {
        if (!res.ok) return errNode(res.error || '计算失败')
        const rows = (res.results || []).map((r) =>
          h('tr', { key: r.name }, [
            h('td', { class: 'mono', style: 'word-break:break-all;' }, r.name),
            h('td', null, fmtSize(r.size)),
            h('td', { class: 'mono', style: 'word-break:break-all;' }, r.md5),
            h('td', { class: 'mono', style: 'word-break:break-all;' }, r.sha1),
            h('td', { class: 'mono', style: 'word-break:break-all;' }, r.sha256),
          ]))
        return h('div', { class: 'card', style: 'margin-top:10px;' }, [
          okNode('共计算 ' + (res.results || []).length + ' 个文件'),
          h('table', { class: 'table' }, [
            h('thead', null, h('tr', null, [
              h('th', null, '文件'), h('th', null, '大小'), h('th', null, 'MD5'), h('th', null, 'SHA1'), h('th', null, 'SHA256'),
            ])),
            h('tbody', null, rows),
          ]),
        ])
      }

      // ---- ② /hash/generate 结果 ----
      function renderGen(res) {
        if (!res.ok) return errNode(res.error || '生成失败')
        return h('div', { class: 'card', style: 'margin-top:10px;' }, [
          okNode('已生成 ' + res.count + ' 条 ' + res.algo + ' 校验记录'),
          dlBtn(res.download),
        ])
      }

      // ---- ③ /hash/verify 结果 ----
      function renderVerify(res) {
        if (!res.ok) return errNode(res.error || '校验失败')
        const rows = (res.results || []).map((r, i) => {
          const st = ST[r.status] || [r.status, 'inherit']
          return h('tr', { key: i }, [
            h('td', { class: 'mono', style: 'word-break:break-all;' }, r.file),
            h('td', { style: { color: st[1], fontWeight: 'bold' } }, st[0]),
            h('td', { class: 'mono', style: 'word-break:break-all;' }, r.expected),
            h('td', { class: 'mono', style: 'word-break:break-all;' }, r.actual || '-'),
          ])
        })
        const failed = (res.failed || 0)
        return h('div', { class: 'card', style: 'margin-top:10px;' }, [
          okNode('共 ' + res.total + ' 条 · 通过 ' + (res.passed || 0) +
            ' · 失败 ' + failed + (failed > 0 ? ' ⚠' : '')),
          h('table', { class: 'table' }, [
            h('thead', null, h('tr', null, [
              h('th', null, '文件'), h('th', null, '状态'), h('th', null, '期望值'), h('th', null, '实际值'),
            ])),
            h('tbody', null, rows),
          ]),
        ])
      }

      // ---- ④ /diranalyze/stats 结果 ----
      function renderStats(res) {
        if (!res.ok) return errNode(res.error || '统计失败')
        const catRows = (res.categories || []).map((c) =>
          h('tr', { key: c.name }, [
            h('td', null, c.name),
            h('td', null, c.count),
            h('td', null, fmtSize(c.size)),
          ]))
        const files = (res.files || []).slice(0, 200)
        const fileRows = files.map((f) =>
          h('tr', { key: f.name }, [
            h('td', { class: 'mono', style: 'word-break:break-all;' }, f.name),
            h('td', null, f.type),
            h('td', null, fmtSize(f.size)),
          ]))
        return h('div', { class: 'card', style: 'margin-top:10px;' }, [
          okNode('共 ' + res.total_files + ' 个文件 · ' + fmtSize(res.total_size)),
          h('p', { class: 'section-title', style: 'margin-top:10px;' }, '按类型统计'),
          h('table', { class: 'table' }, [
            h('thead', null, h('tr', null, [h('th', null, '类型'), h('th', null, '数量'), h('th', null, '大小')])),
            h('tbody', null, catRows),
          ]),
          h('p', { class: 'section-title', style: 'margin-top:10px;' }, '文件明细(前 200 项)'),
          fileRows.length
            ? h('table', { class: 'table' }, [
              h('thead', null, h('tr', null, [h('th', null, '文件'), h('th', null, '类型'), h('th', null, '大小')])),
              h('tbody', null, fileRows),
            ])
            : okNode('无文件'),
          (res.files || []).length > 200 ? okNode('…共 ' + res.files.length + ' 项, 仅显示前 200 项') : null,
        ])
      }

      // ---- ⑤ /diranalyze/duplicate 结果 ----
      function renderDup(res) {
        if (!res.ok) return errNode(res.error || '查重失败')
        if (!(res.total_groups > 0)) return h('div', { class: 'card', style: 'margin-top:10px;' }, okNode('未发现重复文件'))
        const groups = (res.duplicates || []).map((g, i) =>
          h('div', { class: 'card', key: i }, [
            h('div', { class: 'flex', style: 'gap:10px;flex-wrap:wrap;align-items:center;' }, [
              h('code', { class: 'mono', style: 'word-break:break-all;' }, g.hash),
              h('span', { class: 'hint' }, fmtSize(g.size)),
              h('span', { class: 'hint' }, (g.files || []).length + ' 个文件'),
            ]),
            h('ul', { style: 'margin:6px 0 0;' }, (g.files || []).map((f) =>
              h('li', { class: 'mono', style: 'word-break:break-all;' }, f.name))),
          ]))
        return h('div', { class: 'card', style: 'margin-top:10px;' }, [
          okNode('发现 ' + res.total_groups + ' 组重复文件'),
          h('div', { class: 'card-grid' }, groups),
        ])
      }

      const App = {
        data() {
          return {
            tab: 'hash',       // hash | gen | verify | stats | dup
            // ① 哈希计算
            hashFiles: [], hashBusy: false, hashRes: null, hashErr: '',
            // ② 生成校验
            genFiles: [], genAlgo: 'sha256', genBusy: false, genRes: null, genErr: '',
            // ③ 校验
            verFiles: [], verBusy: false, verRes: null, verErr: '',
            // ④ 目录统计
            staFiles: [], staBusy: false, staRes: null, staErr: '',
            // ⑤ 查重
            dupFiles: [], dupBusy: false, dupRes: null, dupErr: '',
          }
        },
        methods: {
          async doHash() {
            if (!this.hashFiles.length) { this.hashErr = '请先选择文件'; return }
            const fd = new FormData()
            appendFiles(fd, this.hashFiles)
            this.hashBusy = true; this.hashErr = ''
            const { ok, data } = await postForm('/hash/hash', fd)
            this.hashBusy = false
            if (!ok) { this.hashErr = data.error || '计算失败'; this.hashRes = null; return }
            this.hashRes = data
          },
          async doGen() {
            if (!this.genFiles.length) { this.genErr = '请先选择文件'; return }
            const fd = new FormData()
            appendFiles(fd, this.genFiles)
            fd.append('algo', this.genAlgo)
            this.genBusy = true; this.genErr = ''
            const { ok, data } = await postForm('/hash/generate', fd)
            this.genBusy = false
            if (!ok) { this.genErr = data.error || '生成失败'; this.genRes = null; return }
            this.genRes = data
          },
          async doVerify() {
            if (!this.verFiles.length) { this.verErr = '请同时选择校验文件与数据文件'; return }
            const fd = new FormData()
            appendFiles(fd, this.verFiles)
            this.verBusy = true; this.verErr = ''
            const { ok, data } = await postForm('/hash/verify', fd)
            this.verBusy = false
            if (!ok) { this.verErr = data.error || '校验失败'; this.verRes = null; return }
            this.verRes = data
          },
          async doStats() {
            if (!this.staFiles.length) { this.staErr = '请先选择文件或压缩包'; return }
            const fd = new FormData()
            appendFiles(fd, this.staFiles)
            this.staBusy = true; this.staErr = ''
            const { ok, data } = await postForm('/diranalyze/stats', fd)
            this.staBusy = false
            if (!ok) { this.staErr = data.error || '统计失败'; this.staRes = null; return }
            this.staRes = data
          },
          async doDup() {
            if (!this.dupFiles.length) { this.dupErr = '请先选择文件或压缩包'; return }
            const fd = new FormData()
            appendFiles(fd, this.dupFiles)
            this.dupBusy = true; this.dupErr = ''
            const { ok, data } = await postForm('/diranalyze/duplicate', fd)
            this.dupBusy = false
            if (!ok) { this.dupErr = data.error || '查重失败'; this.dupRes = null; return }
            this.dupRes = data
          },
        },
        render() {
          const self = this
          const tabBtn = (k, label) => h('button', {
            class: 'btn btn-sm' + (self.tab === k ? ' btn-primary' : ''),
            onclick: () => { self.tab = k },
          }, label)

          // ---------- ① 哈希计算 ----------
          const paneHash = h('div', { style: { display: self.tab === 'hash' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '① 哈希计算'),
              okNode('选择文件, 同时计算 MD5 / SHA1 / SHA256'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.hashFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.hashFiles),
              h('button', { class: 'btn btn-primary', disabled: self.hashBusy, onclick: () => self.doHash() },
                self.hashBusy ? '计算中...' : '计算哈希'),
              self.hashErr ? errNode(self.hashErr) : null,
              self.hashRes ? renderHash(self.hashRes) : null,
            ]),
          ])

          // ---------- ② 生成校验文件 ----------
          const paneGen = h('div', { style: { display: self.tab === 'gen' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '② 生成校验文件'),
              okNode('选择文件并指定算法, 生成 checksums.<algo> 校验清单下载'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.genFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.genFiles),
              h('div', { class: 'flex', style: 'gap:8px;margin:8px 0;' }, [
                sel([['md5', 'MD5'], ['sha1', 'SHA1'], ['sha256', 'SHA256']], self.genAlgo, (v) => { self.genAlgo = v }),
              ]),
              h('button', { class: 'btn btn-primary', disabled: self.genBusy, onclick: () => self.doGen() },
                self.genBusy ? '生成中...' : '生成校验文件'),
              self.genErr ? errNode(self.genErr) : null,
              self.genRes ? renderGen(self.genRes) : null,
            ]),
          ])

          // ---------- ③ 校验 ----------
          const paneVerify = h('div', { style: { display: self.tab === 'verify' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '③ 文件校验'),
              okNode('同时选择校验文件(.md5/.sha1/.sha256)与数据文件, 按校验清单逐条核对'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.verFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.verFiles),
              h('button', { class: 'btn btn-primary', disabled: self.verBusy, onclick: () => self.doVerify() },
                self.verBusy ? '校验中...' : '开始校验'),
              self.verErr ? errNode(self.verErr) : null,
              self.verRes ? renderVerify(self.verRes) : null,
            ]),
          ])

          // ---------- ④ 目录统计 ----------
          const paneStats = h('div', { style: { display: self.tab === 'stats' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '④ 目录统计'),
              okNode('上传文件或 .zip 压缩包(自动解包), 统计文件数与类型分布'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.staFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.staFiles),
              h('button', { class: 'btn btn-primary', disabled: self.staBusy, onclick: () => self.doStats() },
                self.staBusy ? '统计中...' : '开始统计'),
              self.staErr ? errNode(self.staErr) : null,
              self.staRes ? renderStats(self.staRes) : null,
            ]),
          ])

          // ---------- ⑤ 查重 ----------
          const paneDup = h('div', { style: { display: self.tab === 'dup' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '⑤ 重复文件查找'),
              okNode('上传文件或 .zip 压缩包(自动解包), 按大小 + MD5 找出重复文件'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.dupFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.dupFiles),
              h('button', { class: 'btn btn-primary', disabled: self.dupBusy, onclick: () => self.doDup() },
                self.dupBusy ? '查重中...' : '开始查重'),
              self.dupErr ? errNode(self.dupErr) : null,
              self.dupRes ? renderDup(self.dupRes) : null,
            ]),
          ])

          return h('div', { class: 'filehash-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '文件校验工具'),
              h('div', { class: 'flex', style: 'gap:6px;flex-wrap:wrap;' }, [
                tabBtn('hash', '哈希计算'),
                tabBtn('gen', '生成校验'),
                tabBtn('verify', '校验'),
                tabBtn('stats', '目录统计'),
                tabBtn('dup', '查重'),
              ]),
            ]),
            paneHash,
            paneGen,
            paneVerify,
            paneStats,
            paneDup,
          ])
        },
      }

      const vm = createApp(App)
      vm.mount(container)
      return () => vm.unmount()
    },
  }
}

if (typeof window !== 'undefined') {
  register(window)
}