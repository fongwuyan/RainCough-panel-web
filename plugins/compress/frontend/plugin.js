// compress 插件 Vue3 前端(独立构建, 完全自包含, esbuild 内联 vue)
// 契约: window.__rcPlugin_compress = { name:'compress', mount(container, ctx) }
// 与 plugins/compress/server.py 对齐的路由契约:
//   GET  /decompress/check    -> {ok, 7z?, error?}
//   POST /decompress/list     (file/files)                  -> {ok, name, files[], total, total_size}
//   POST /decompress/extract  (file/files, password, organize) -> {ok, count, download}
//   POST /decompress/compress (files, format, level, password, name) -> {ok, size, download}
//   POST /decompress/convert  (file/files, format)          -> {ok, size, download}
//   POST /decompress/compare  (files x2+)                   -> {ok, a, b, only_a[], only_b[], diff[], same}
//   GET  /file/<session>/<name>                             结果文件下载
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_compress = {
    name: 'compress',
    mount: function (container, ctx) {
      const BASE = '/api/plugins/compress'

      // ---- 通用工具(闭包) ----
      // multipart POST: 后端失败时返回 {ok:false,error}, 网络错误兜底
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

      // 文件写入 FormData: 首个文件用 field 'file', 其余 'files'
      // 与后端 save_uploads(fields=('file','files')) 的收集顺序一致
      function appendFiles(fd, files, firstAsFile) {
        files.forEach((f, i) => fd.append(i === 0 && firstAsFile ? 'file' : 'files', f, f.name))
      }

      function errNode(txt) {
        return h('p', { style: 'color:var(--danger);font-size:12px;margin:8px 0;' }, txt || '操作失败')
      }

      function okNode(txt) {
        return h('p', { class: 'hint', style: 'margin:8px 0;' }, txt)
      }

      // 结果下载按钮: 后端 download 形如 /file/<session>/<name>
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

      // ---- ① /decompress/list 结果 ----
      function renderList(res) {
        if (!res.ok) return errNode(res.error || '解析失败')
        const rows = (res.files || []).filter((f) => !f.isDir).map((f) =>
          h('tr', { key: f.path }, [
            h('td', { class: 'mono', style: 'word-break:break-all;' }, f.path),
            h('td', null, fmtSize(f.size)),
            h('td', null, f.packed !== undefined ? fmtSize(f.packed) : '-'),
            h('td', { class: 'mono' }, f.crc || '-'),
          ]))
        return h('div', { class: 'card', style: 'margin-top:10px;' }, [
          okNode('压缩包: ' + res.name + ' · 共 ' + res.total + ' 项 · 解压后 ' + fmtSize(res.total_size)),
          h('table', { class: 'table' }, [
            h('thead', null, h('tr', null, [
              h('th', null, '路径'), h('th', null, '大小'), h('th', null, '压缩后'), h('th', null, 'CRC'),
            ])),
            h('tbody', null, rows.length ? rows : [h('tr', null, h('td', { colspan: 4 }, '无文件'))]),
          ]),
        ])
      }

      // ---- ② 解压 / ③ 压缩 / ④ 转换 通用结果(ok/count|size/download) ----
      function renderWithDownload(res, okText) {
        if (!res.ok) return errNode(res.error || '操作失败')
        return h('div', { class: 'card', style: 'margin-top:10px;' }, [
          okNode(okText(res)),
          dlBtn(res.download),
        ])
      }

      // ---- ⑤ /decompress/compare 结果 ----
      function renderCompare(res) {
        if (!res.ok) return errNode(res.error || '对比失败')
        const li = (arr) => (arr && arr.length)
          ? arr.map((p) => h('li', { class: 'mono', style: 'word-break:break-all;' }, p))
          : [h('li', { class: 'hint' }, '无')]
        return h('div', { class: 'card', style: 'margin-top:10px;' }, [
          okNode('对比 ' + res.a + ' ↔ ' + res.b + ' · 相同 ' + res.same + ' 项'),
          h('div', { class: 'card-grid', style: 'grid-template-columns:1fr 1fr 1fr;' }, [
            h('div', { class: 'card' }, [h('b', null, '仅 A(' + res.a + ')'), h('ul', null, li(res.only_a))]),
            h('div', { class: 'card' }, [h('b', null, '仅 B(' + res.b + ')'), h('ul', null, li(res.only_b))]),
            h('div', { class: 'card' }, [h('b', null, '大小不同'), h('ul', null, li(res.diff))]),
          ]),
        ])
      }

      const App = {
        data() {
          return {
            tab: 'list',        // list | extract | compress | convert | compare
            env: null,          // /decompress/check 结果
            // ① 列表
            listFiles: [], listBusy: false, listRes: null, listErr: '',
            // ② 解压
            extFiles: [], extPwd: '', extOrg: 'none', extBusy: false, extRes: null, extErr: '',
            // ③ 压缩
            cmpFiles: [], cmpFmt: '7z', cmpLevel: '5', cmpPwd: '', cmpName: 'archive',
            cmpBusy: false, cmpRes: null, cmpErr: '',
            // ④ 转换
            cvtFiles: [], cvtFmt: '7z', cvtBusy: false, cvtRes: null, cvtErr: '',
            // ⑤ 对比
            cprFiles: [], cprBusy: false, cprRes: null, cprErr: '',
          }
        },
        methods: {
          // 环境检查: 7z 是否可用
          async loadEnv() {
            try {
              const r = await fetch(BASE + '/decompress/check')
              this.env = await r.json()
            } catch (e) { this.env = { ok: false, error: String(e) } }
          },
          async doList() {
            if (!this.listFiles.length) { this.listErr = '请先选择压缩包'; return }
            const fd = new FormData()
            appendFiles(fd, this.listFiles, true)
            this.listBusy = true; this.listErr = ''
            const { ok, data } = await postForm('/decompress/list', fd)
            this.listBusy = false
            if (!ok) { this.listErr = data.error || '解析失败'; this.listRes = null; return }
            this.listRes = data
          },
          async doExtract() {
            if (!this.extFiles.length) { this.extErr = '请先选择压缩包'; return }
            const fd = new FormData()
            appendFiles(fd, this.extFiles, true)
            fd.append('password', this.extPwd)
            fd.append('organize', this.extOrg)
            this.extBusy = true; this.extErr = ''
            const { ok, data } = await postForm('/decompress/extract', fd)
            this.extBusy = false
            if (!ok) { this.extErr = data.error || '解压失败'; this.extRes = null; return }
            this.extRes = data
          },
          async doCompress() {
            if (!this.cmpFiles.length) { this.cmpErr = '请先选择要压缩的文件'; return }
            const fd = new FormData()
            appendFiles(fd, this.cmpFiles, false)
            fd.append('format', this.cmpFmt)
            fd.append('level', String(this.cmpLevel))
            fd.append('password', this.cmpPwd)
            fd.append('name', this.cmpName || 'archive')
            this.cmpBusy = true; this.cmpErr = ''
            const { ok, data } = await postForm('/decompress/compress', fd)
            this.cmpBusy = false
            if (!ok) { this.cmpErr = data.error || '压缩失败'; this.cmpRes = null; return }
            this.cmpRes = data
          },
          async doConvert() {
            if (!this.cvtFiles.length) { this.cvtErr = '请先选择压缩包'; return }
            const fd = new FormData()
            appendFiles(fd, this.cvtFiles, true)
            fd.append('format', this.cvtFmt)
            this.cvtBusy = true; this.cvtErr = ''
            const { ok, data } = await postForm('/decompress/convert', fd)
            this.cvtBusy = false
            if (!ok) { this.cvtErr = data.error || '转换失败'; this.cvtRes = null; return }
            this.cvtRes = data
          },
          async doCompare() {
            if (this.cprFiles.length < 2) { this.cprErr = '请至少选择两个压缩包'; return }
            const fd = new FormData()
            appendFiles(fd, this.cprFiles, false)
            this.cprBusy = true; this.cprErr = ''
            const { ok, data } = await postForm('/decompress/compare', fd)
            this.cprBusy = false
            if (!ok) { this.cprErr = data.error || '对比失败'; this.cprRes = null; return }
            this.cprRes = data
          },
        },
        mounted() { this.loadEnv() },
        render() {
          const self = this
          // 顶部环境状态
          const envLine = self.env === null
            ? h('p', { class: 'hint' }, '检查 7z 环境...')
            : (self.env.ok
              ? h('p', { class: 'hint' }, '7z 已就绪: ' + (self.env['7z'] || ''))
              : errNode('7z 不可用: ' + (self.env.error || '')))

          const tabBtn = (k, label) => h('button', {
            class: 'btn btn-sm' + (self.tab === k ? ' btn-primary' : ''),
            onclick: () => { self.tab = k },
          }, label)

          // ---------- ① 列表 ----------
          const paneList = h('div', { style: { display: self.tab === 'list' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '① 查看压缩包内容'),
              okNode('上传压缩包, 列出内部文件清单(7z l -slt)'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.listFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.listFiles),
              h('button', { class: 'btn btn-primary', disabled: self.listBusy, onclick: () => self.doList() },
                self.listBusy ? '解析中...' : '列出内容'),
              self.listErr ? errNode(self.listErr) : null,
              self.listRes ? renderList(self.listRes) : null,
            ]),
          ])

          // ---------- ② 解压 ----------
          const paneExtract = h('div', { style: { display: self.tab === 'extract' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '② 解压压缩包'),
              okNode('上传压缩包解压, 可设置密码与整理方式; 结果打包为 zip 供下载'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.extFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.extFiles),
              h('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap;margin:8px 0;' }, [
                sel([['none', '不整理'], ['type', '按类型'], ['date', '按日期'], ['ext', '按扩展名'], ['name', '按首字母']],
                  self.extOrg, (v) => { self.extOrg = v }),
                h('input', { type: 'password', class: 'input', placeholder: '解压密码(可选)', value: self.extPwd, oninput: (e) => { self.extPwd = e.target.value }, style: 'flex:1;' }),
              ]),
              h('button', { class: 'btn btn-primary', disabled: self.extBusy, onclick: () => self.doExtract() },
                self.extBusy ? '解压中...' : '解压'),
              self.extErr ? errNode(self.extErr) : null,
              self.extRes ? renderWithDownload(self.extRes, (r) => '已解压 ' + r.count + ' 个文件') : null,
            ]),
          ])

          // ---------- ③ 压缩 ----------
          const paneCompress = h('div', { style: { display: self.tab === 'compress' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '③ 压缩文件'),
              okNode('上传多个文件/目录打包; 格式任选, 支持密码与压缩等级'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.cmpFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.cmpFiles),
              h('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap;margin:8px 0;' }, [
                sel([['7z', '7z'], ['zip', 'zip'], ['tar', 'tar'], ['gz', 'gz'], ['bz2', 'bz2'], ['xz', 'xz'], ['rar', 'rar']],
                  self.cmpFmt, (v) => { self.cmpFmt = v }),
                h('input', { type: 'number', class: 'input', min: '0', max: '9', placeholder: '等级 0-9', value: self.cmpLevel, oninput: (e) => { self.cmpLevel = e.target.value }, style: 'width:90px;' }),
                h('input', { type: 'password', class: 'input', placeholder: '加密密码(可选)', value: self.cmpPwd, oninput: (e) => { self.cmpPwd = e.target.value } }),
                h('input', { class: 'input', placeholder: '输出名(不含扩展名)', value: self.cmpName, oninput: (e) => { self.cmpName = e.target.value }, style: 'flex:1;' }),
              ]),
              h('button', { class: 'btn btn-primary', disabled: self.cmpBusy, onclick: () => self.doCompress() },
                self.cmpBusy ? '压缩中...' : '开始压缩'),
              self.cmpErr ? errNode(self.cmpErr) : null,
              self.cmpRes ? renderWithDownload(self.cmpRes, (r) => '压缩完成 · ' + fmtSize(r.size)) : null,
            ]),
          ])

          // ---------- ④ 转换 ----------
          const paneConvert = h('div', { style: { display: self.tab === 'convert' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '④ 格式转换'),
              okNode('上传压缩包, 打包为 7z / zip / tar'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.cvtFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.cvtFiles),
              h('div', { class: 'flex', style: 'gap:8px;margin:8px 0;' }, [
                sel([['7z', '7z'], ['zip', 'zip'], ['tar', 'tar']], self.cvtFmt, (v) => { self.cvtFmt = v }),
              ]),
              h('button', { class: 'btn btn-primary', disabled: self.cvtBusy, onclick: () => self.doConvert() },
                self.cvtBusy ? '转换中...' : '转换'),
              self.cvtErr ? errNode(self.cvtErr) : null,
              self.cvtRes ? renderWithDownload(self.cvtRes, (r) => '转换完成 · ' + fmtSize(r.size)) : null,
            ]),
          ])

          // ---------- ⑤ 对比 ----------
          const paneCompare = h('div', { style: { display: self.tab === 'compare' ? '' : 'none' } }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '⑤ 压缩包对比'),
              okNode('上传两个压缩包, 按内部文件路径对比差异(仅看文件大小)'),
              h('input', { type: 'file', multiple: true, class: 'input', onchange: (e) => { self.cprFiles = Array.from(e.target.files || []) } }),
              fileChoice(self.cprFiles),
              h('button', { class: 'btn btn-primary', disabled: self.cprBusy, onclick: () => self.doCompare() },
                self.cprBusy ? '对比中...' : '开始对比'),
              self.cprErr ? errNode(self.cprErr) : null,
              self.cprRes ? renderCompare(self.cprRes) : null,
            ]),
          ])

          return h('div', { class: 'compress-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, [
                '解压压缩工具',
                h('span', { style: 'float:right;font-weight:normal;' }, envLine),
              ]),
              h('div', { class: 'flex', style: 'gap:6px;flex-wrap:wrap;' }, [
                tabBtn('list', '压缩包列表'),
                tabBtn('extract', '解压'),
                tabBtn('compress', '压缩'),
                tabBtn('convert', '格式转换'),
                tabBtn('compare', '对比'),
              ]),
            ]),
            paneList,
            paneExtract,
            paneCompress,
            paneConvert,
            paneCompare,
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