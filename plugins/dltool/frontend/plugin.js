// dltool 插件 Vue3 前端(独立构建, esbuild IIFE, 完全自包含)
// 契约: window.__rcPlugin_dltool = { name, mount(container, ctx) }
// 后端: plugins/dltool/server.py
//    GET  /check                               -> {ok, version, formats}
//    POST /download      (JSON {urls, pack})   -> {ok, message}  后台任务
//    POST /convert       (multipart: files,to) -> {ok, results, single?, download}
//    POST /split         (multipart: files,chunkSize)  -> {ok, parts, download}
//    POST /join          (multipart: files,name)       -> {ok, files, size, download}
//    POST /rename        (multipart: files,mode,value,value2,index) -> {ok, results, download}
//    POST /delete        (multipart: files,passes)     -> {ok, results}
//    GET  /file/<session>/<name>  结果文件下载(前端补 BASE 前缀)
import { createApp, h } from 'vue'

const BASE = '/api/plugins/dltool'

const REN_MODES = [
  { v: 'prefix', l: '前缀',   v1: '追加文本(text1)',       v2: '' },
  { v: 'suffix', l: '后缀',   v1: '追加文本(text1)',       v2: '' },
  { v: 'replace', l: '替换',  v1: '查找文本(text)',        v2: '替换为(text2)' },
  { v: 'regex', l: '正则替换', v1: '正则表达式(text)',      v2: '替换为(text2)' },
  { v: 'case', l: '大小写',   v1: 'upper = 大写 / lower = 小写', v2: '' },
  { v: 'number', l: '编号',   v1: '前缀(如 img_)',         v2: '位数(默认3)' },
]

export function register(g) {
  g.__rcPlugin_dltool = {
    name: 'dltool',
    mount: function (container, ctx) {
      const App = {
        data() {
          return {
            // --- 下载工具 ---
            urls: '', pack: false, dlMsg: '', dlErr: '', jobs: [],
            // --- 文档转换 ---
            check: null, checkErr: '', convFiles: [], to: 'html',
            convBusy: false, convRes: null, convErr: '',
            // --- 分片 ---
            splitFiles: [], chunkSize: '100', splitRes: null, splitErr: '',
            // --- 合并 ---
            joinFiles: [], joinName: 'joined', joinRes: null, joinErr: '',
            // --- 重命名 ---
            renFiles: [], renMode: 'prefix', renVal: '', renVal2: '',
            renIndex: '1', renRes: null, renErr: '',
            // --- 安全删除 ---
            delFiles: [], delPasses: '3', delRes: null, delErr: '',
          }
        },
        methods: {
          dlUrl(p) { return BASE + (String(p).charAt(0) === '/' ? p : '/' + p) },
          fmtSize(n) {
            n = Number(n || 0)
            const units = ['B', 'KB', 'MB', 'GB', 'TB']
            let i = 0
            while (n >= 1024 && i < units.length - 1) { n = n / 1024; i++ }
            return (i === 0 ? String(n) : n.toFixed(1)) + ' ' + units[i]
          },
          trunc(s, n) {
            s = String(s == null ? '' : s)
            return s.length > n ? s.slice(0, n) + '…' : s
          },
          async checkConvert() {
            this.checkErr = ''
            try {
              const r = await fetch(BASE + '/check')
              const d = await r.json()
              this.check = d
              if (d.ok && Array.isArray(d.formats)) {
                this.to = d.formats.indexOf('html') >= 0 ? 'html' : (d.formats[0] || 'html')
              }
            } catch (e) { this.checkErr = '检查 pandoc 失败: ' + e }
          },
          // ---- 下载 URL 列表(后台任务) ----
          async doDownload() {
            this.dlErr = ''; this.dlMsg = ''
            const urls = (this.urls || '').split('\n').map((s) => s.trim()).filter(Boolean)
            if (!urls.length) { this.dlErr = '请至少输入一个下载链接'; return }
            try {
              const r = await fetch(BASE + '/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls, pack: this.pack }),
              })
              const d = await r.json()
              if (!d.ok) this.dlErr = d.error || '下载启动失败'
              else {
                this.dlMsg = d.message || '已开始下载'
                this.jobs.unshift({
                  time: new Date().toLocaleTimeString(),
                  count: urls.length, pack: !!this.pack,
                  message: d.message || '',
                })
                if (this.jobs.length > 20) this.jobs = this.jobs.slice(0, 20)
                this.urls = ''
              }
            } catch (e) { this.dlErr = '请求失败: ' + e }
          },
          // ---- 文档转换(multipart) ----
          async doConvert() {
            this.convErr = ''; this.convRes = null
            if (!this.convFiles.length) { this.convErr = '请选择要转换的文档'; return }
            if (this.check && !this.check.ok) { this.convErr = this.check.error || 'pandoc 不可用'; return }
            this.convBusy = true
            try {
              const fd = new FormData()
              for (const f of this.convFiles) fd.append('files', f)
              fd.append('to', this.to)
              const r = await fetch(BASE + '/convert', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) this.convErr = d.error || '转换失败'
              else this.convRes = d
            } catch (e) { this.convErr = '请求失败: ' + e }
            this.convBusy = false
          },
          // ---- 分片(multipart) ----
          async doSplit() {
            this.splitErr = ''; this.splitRes = null
            if (!this.splitFiles.length) { this.splitErr = '请选择要分片的文件'; return }
            try {
              const fd = new FormData()
              for (const f of this.splitFiles) fd.append('files', f)
              fd.append('chunkSize', this.chunkSize || '100')
              const r = await fetch(BASE + '/split', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) this.splitErr = d.error || '分片失败'
              else this.splitRes = d
            } catch (e) { this.splitErr = '请求失败: ' + e }
          },
          // ---- 合并(multipart) ----
          async doJoin() {
            this.joinErr = ''; this.joinRes = null
            if (!this.joinFiles.length) { this.joinErr = '请选择分片文件'; return }
            try {
              const fd = new FormData()
              for (const f of this.joinFiles) fd.append('files', f)
              fd.append('name', (this.joinName || 'joined').trim() || 'joined')
              const r = await fetch(BASE + '/join', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) this.joinErr = d.error || '合并失败'
              else this.joinRes = d
            } catch (e) { this.joinErr = '请求失败: ' + e }
          },
          // ---- 重命名(multipart) ----
          async doRename() {
            this.renErr = ''; this.renRes = null
            if (!this.renFiles.length) { this.renErr = '请选择要重命名的文件'; return }
            try {
              const fd = new FormData()
              for (const f of this.renFiles) fd.append('files', f)
              fd.append('mode', this.renMode)
              fd.append('value', this.renVal)
              fd.append('value2', this.renVal2)
              fd.append('index', this.renIndex || '1')
              const r = await fetch(BASE + '/rename', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) this.renErr = d.error || '重命名失败'
              else this.renRes = d
            } catch (e) { this.renErr = '请求失败: ' + e }
          },
          // ---- 安全删除(multipart) ----
          async doDelete() {
            this.delErr = ''; this.delRes = null
            if (!this.delFiles.length) { this.delErr = '请选择要删除的文件'; return }
            try {
              const fd = new FormData()
              for (const f of this.delFiles) fd.append('files', f)
              fd.append('passes', this.delPasses || '3')
              const r = await fetch(BASE + '/delete', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) this.delErr = d.error || '删除失败'
              else this.delRes = d
            } catch (e) { this.delErr = '请求失败: ' + e }
          },
        },
        mounted() { this.checkConvert() },
        render() {
          // ================= ① 下载工具 =================
          const dl = h('div', { class: 'section' }, [
            h('div', { class: 'section-title' }, '下载工具'),
            h('textarea', {
              class: 'input', style: 'width:100%;min-height:96px;resize:vertical;font-family:var(--rc-mono,monospace);',
              placeholder: '每行一个下载链接，支持 http(s)://',
              value: this.urls,
              oninput: (e) => (this.urls = e.target.value),
            }),
            h('div', { class: 'flex', style: 'gap:12px;margin-top:8px;align-items:center;' }, [
              h('label', { style: 'display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;' }, [
                h('input', { type: 'checkbox', checked: this.pack, onchange: (e) => (this.pack = e.target.checked) }),
                '下载后打包为压缩包 (pack)',
              ]),
              h('button', { class: 'btn btn-primary', onclick: () => this.doDownload() }, '开始下载'),
            ]),
            this.dlErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.dlErr) : null,
            this.dlMsg ? h('p', { class: 'hint', style: 'color:var(--success);' }, this.dlMsg) : null,
            this.jobs.length
              ? h('table', { class: 'table', style: 'margin-top:8px;' }, [
                  h('thead', null, h('tr', null, [
                    h('th', null, '时间'), h('th', null, 'URL 数'), h('th', null, '打包'), h('th', null, '任务'),
                  ])),
                  h('tbody', null, this.jobs.map((j, i) => h('tr', { key: i }, [
                    h('td', { class: 'mono faint' }, j.time),
                    h('td', null, j.count + ' 个'),
                    h('td', null, j.pack ? '是' : '否'),
                    h('td', { class: 'hint' }, j.message),
                  ]))),
                ])
              : null,
            h('p', { class: 'hint' }, '下载在后台执行，实时进度可在主面板“任务”队列中查看。'),
          ])

          // ================= ② 文档转换 =================
          const convStatus = !this.check
            ? h('p', { class: 'hint' }, '正在检查 pandoc 可用性…')
            : !this.check.ok
              ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.check.error || 'pandoc 不可用')
              : h('p', { class: 'hint' }, 'pandoc ' + this.check.version + ' · 输出格式 ' + (this.check.formats || []).length + ' 种')
          const convResult = this.convRes
            ? h('div', { style: 'margin-top:8px;' }, [
                this.convRes.download
                  ? h('p', null, h('a', {
                      class: 'btn btn-sm',
                      href: this.dlUrl(this.convRes.download),
                      style: 'color:var(--accent);text-decoration:none;',
                    }, '下载转换结果 ' + (this.convRes.single ? '文件' : 'converted.zip')) )
                  : null,
                h('table', { class: 'table', style: 'margin-top:6px;' }, [
                  h('thead', null, h('tr', null, [
                    h('th', null, '文件'), h('th', null, '状态'), h('th', null, '输出'),
                  ])),
                  h('tbody', null, (this.convRes.results || []).map((r, i) => h('tr', { key: i }, [
                    h('td', { class: 'mono' }, r.name),
                    h('td', null, r.ok
                      ? h('span', { style: 'color:var(--success);' }, '成功')
                      : h('span', { style: 'color:var(--danger);' }, this.trunc(r.error || '失败', 60))),
                    h('td', { class: 'mono faint' }, r.output || '-'),
                  ]))),
                ]),
              ])
            : null
          const conv = h('div', { class: 'section' }, [
            h('div', { class: 'section-title' }, '文档转换 (pandoc)'),
            convStatus,
            h('div', { class: 'flex', style: 'gap:10px;margin-top:8px;align-items:center;flex-wrap:wrap;' }, [
              h('input', { type: 'file', multiple: true, onchange: (e) => (this.convFiles = Array.from(e.target.files || [])) }),
              h('span', { class: 'hint' }, '→ 转为：'),
              h('select', { class: 'input', style: 'width:110px;', onchange: (e) => (this.to = e.target.value) },
                (this.check && Array.isArray(this.check.formats) && this.check.formats.length
                  ? this.check.formats
                  : ['html']
                ).map((f) => h('option', { value: f, selected: f === this.to }, f))),
              h('button', {
                class: 'btn btn-primary',
                disabled: this.convBusy,
                onclick: () => this.doConvert(),
              }, this.convBusy ? '转换中…' : '转换'),
            ]),
            this.convFiles.length ? h('p', { class: 'hint' }, '已选 ' + this.convFiles.length + ' 个文件（自动识别源格式）') : null,
            this.convErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.convErr) : null,
            convResult,
          ])

          // ================= ③ 文件操作 =================
          const cardSplit = h('div', { class: 'card', style: 'padding:12px;' }, [
            h('div', { class: 'section-title' }, '分片'),
            h('input', { type: 'file', multiple: true, onchange: (e) => (this.splitFiles = Array.from(e.target.files || [])) }),
            h('div', { class: 'flex', style: 'gap:8px;margin-top:8px;align-items:center;' }, [
              h('input', { class: 'input', style: 'width:64px;', type: 'number', min: '1', step: '1', value: this.chunkSize, oninput: (e) => (this.chunkSize = e.target.value) }),
              h('span', { class: 'hint' }, 'MB / 块'),
              h('button', { class: 'btn btn-primary btn-sm', onclick: () => this.doSplit() }, '分片'),
            ]),
            this.splitFiles.length ? h('p', { class: 'hint' }, '已选 ' + this.splitFiles.length + ' 个文件') : null,
            this.splitErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.splitErr) : null,
            this.splitRes
              ? h('p', { class: 'hint', style: 'color:var(--success);' },
                  '生成 ' + this.splitRes.parts + ' 个分片，结果打包 ' +
                  h('a', { href: this.dlUrl(this.splitRes.download), style: 'color:var(--accent);' }, 'parts.zip'))
              : null,
          ])

          const cardJoin = h('div', { class: 'card', style: 'padding:12px;' }, [
            h('div', { class: 'section-title' }, '合并'),
            h('input', { type: 'file', multiple: true, onchange: (e) => (this.joinFiles = Array.from(e.target.files || [])) }),
            h('div', { class: 'flex', style: 'gap:8px;margin-top:8px;align-items:center;' }, [
              h('input', { class: 'input', style: 'flex:1;min-width:90px;', placeholder: '输出文件名', value: this.joinName, oninput: (e) => (this.joinName = e.target.value) }),
              h('button', { class: 'btn btn-primary btn-sm', onclick: () => this.doJoin() }, '合并'),
            ]),
            h('p', { class: 'hint' }, '按文件名排序后逐块拼接（.part001 / .part002 …）'),
            this.joinErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.joinErr) : null,
            this.joinRes
              ? h('p', { class: 'hint', style: 'color:var(--success);' },
                  '合并 ' + this.joinRes.files + ' 个文件 · ' + this.fmtSize(this.joinRes.size) + ' · ' +
                  h('a', { href: this.dlUrl(this.joinRes.download), style: 'color:var(--accent);' }, '下载'))
              : null,
          ])

          const renMode = REN_MODES.find((m) => m.v === this.renMode) || REN_MODES[0]
          const showV2 = ['replace', 'regex', 'number'].indexOf(this.renMode) >= 0
          const cardRename = h('div', { class: 'card', style: 'padding:12px;' }, [
            h('div', { class: 'section-title' }, '重命名'),
            h('input', { type: 'file', multiple: true, onchange: (e) => (this.renFiles = Array.from(e.target.files || [])) }),
            h('div', { class: 'flex', style: 'gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;' }, [
              h('select', { class: 'input', style: 'width:96px;', onchange: (e) => (this.renMode = e.target.value) },
                REN_MODES.map((m) => h('option', { value: m.v, selected: m.v === this.renMode }, m.l))),
              h('input', { class: 'input', style: 'flex:1;min-width:110px;', placeholder: renMode.v1, value: this.renVal, oninput: (e) => (this.renVal = e.target.value) }),
              showV2
                ? h('input', { class: 'input', style: 'flex:1;min-width:110px;', placeholder: renMode.v2, value: this.renVal2, oninput: (e) => (this.renVal2 = e.target.value) })
                : null,
              this.renMode === 'number'
                ? h('input', { class: 'input', style: 'width:56px;', placeholder: '起始', value: this.renIndex, oninput: (e) => (this.renIndex = e.target.value) })
                : null,
              h('button', { class: 'btn btn-primary btn-sm', onclick: () => this.doRename() }, '重命名'),
            ]),
            this.renErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.renErr) : null,
            this.renRes
              ? h('div', { style: 'margin-top:8px;' }, [
                  h('table', { class: 'table' }, [
                    h('thead', null, h('tr', null, [h('th', null, '原名'), h('th', null, '新名')])),
                    h('tbody', null, (this.renRes.results || []).map((r, i) => h('tr', { key: i }, [
                      h('td', { class: 'mono faint' }, this.trunc(r.old, 40)),
                      h('td', { class: 'mono' }, this.trunc(r.new, 40)),
                    ]))),
                  ]),
                  this.renRes.download
                    ? h('p', { style: 'margin-top:6px;' }, h('a', { class: 'btn btn-sm', href: this.dlUrl(this.renRes.download), style: 'color:var(--accent);text-decoration:none;' }, '下载 renamed.zip'))
                    : null,
                ])
              : null,
          ])

          const cardDelete = h('div', { class: 'card', style: 'padding:12px;' }, [
            h('div', { class: 'section-title' }, '安全删除'),
            h('input', { type: 'file', multiple: true, onchange: (e) => (this.delFiles = Array.from(e.target.files || [])) }),
            h('div', { class: 'flex', style: 'gap:8px;margin-top:8px;align-items:center;' }, [
              h('input', { class: 'input', style: 'width:64px;', type: 'number', min: '1', max: '35', step: '1', value: this.delPasses, oninput: (e) => (this.delPasses = e.target.value) }),
              h('span', { class: 'hint' }, '覆写次数 (1–35)'),
              h('button', { class: 'btn btn-sm btn-danger', onclick: () => this.doDelete() }, '安全删除'),
            ]),
            h('p', { class: 'hint', style: 'color:var(--danger);' }, '覆写 + 清零后删除文件，操作不可恢复，请谨慎使用。'),
            this.delErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.delErr) : null,
            this.delRes
              ? h('div', { style: 'margin-top:8px;max-height:160px;overflow:auto;' },
                  (this.delRes.results || []).map((r, i) => h('p', { key: i, class: 'mono', style: 'font-size:12px;line-height:1.6;' },
                    (r.deleted ? '✓ ' : '✗ ') + this.trunc(r.name, 50))))
              : null,
          ])

          const ops = h('div', { class: 'section' }, [
            h('div', { class: 'section-title' }, '文件操作'),
            h('div', { class: 'card-grid', style: 'grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;' },
              [cardSplit, cardJoin, cardRename, cardDelete]),
          ])

          return h('div', { class: 'dltool-panel' }, [dl, conv, ops])
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