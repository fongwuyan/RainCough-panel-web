// imagetool 插件 Vue3 前端(独立构建, esbuild IIFE)
// 契约: window.__rcPlugin_imagetool = { mount(container, ctx) }
// 区块: 相似度对比(两图 → dHash 汉明距离/百分比/判断) · 图像处理(格式/缩放/质量/旋转 → 结果表+下载)
// 路由: POST /image/similar(multipart files×2) · POST /image/process(multipart files + format/resize/quality/rotate)
// 下载: 后端返回相对路径 /file/<session>/<name>, 前端拼接 /api/plugins/imagetool 前缀
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_imagetool = {
    name: 'imagetool',
    mount: function (container, ctx) {
      const BASE = '/api/plugins/imagetool'
      const FORMATS = [['', '原格式'], ['jpg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP'], ['gif', 'GIF']]

      const App = {
        data() {
          return {
            info: null,
            // 相似度对比
            fileA: null,
            fileB: null,
            simBusy: false,
            simErr: '',
            simResult: null,
            // 图像处理
            procFiles: [],
            procBusy: false,
            procErr: '',
            procResult: null,
            procFormat: '',
            procResize: '',
            procQuality: '',
            procRotate: ''
          }
        },
        methods: {
          async loadInfo() {
            try {
              const r = await fetch(BASE + '/info')
              this.info = await r.json()
            } catch (e) {}
          },
          pickA(e) {
            this.fileA = e.target.files ? e.target.files[0] : null
            this.simErr = ''
            this.simResult = null
            e.target.value = ''
          },
          pickB(e) {
            this.fileB = e.target.files ? e.target.files[0] : null
            this.simErr = ''
            this.simResult = null
            e.target.value = ''
          },
          // POST /image/similar -> {hamming,similarity,verdict,a,b}
          async runSimilar() {
            if (!this.fileA || !this.fileB) { this.simErr = '请选择两张图片'; return }
            this.simBusy = true
            this.simErr = ''
            this.simResult = null
            try {
              const fd = new FormData()
              fd.append('files', this.fileA)
              fd.append('files', this.fileB)
              const r = await fetch(BASE + '/image/similar', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) { this.simErr = d.error || '对比失败'; return }
              this.simResult = d
            } catch (e) { this.simErr = e.message }
            this.simBusy = false
          },
          pickProc(e) {
            this.procFiles = Array.from(e.target.files || [])
            this.procErr = ''
            this.procResult = null
            e.target.value = ''
          },
          // POST /image/process -> {results,single,download}
          async runProcess() {
            if (!this.procFiles.length) { this.procErr = '请选择要处理的图片'; return }
            this.procBusy = true
            this.procErr = ''
            this.procResult = null
            try {
              const fd = new FormData()
              for (const f of this.procFiles) fd.append('files', f)
              if (this.procFormat) fd.append('format', this.procFormat)
              if ((this.procResize || '').trim()) fd.append('resize', this.procResize.trim())
              if (this.procQuality) fd.append('quality', String(this.procQuality))
              if (this.procRotate !== '') fd.append('rotate', String(this.procRotate))
              const r = await fetch(BASE + '/image/process', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) { this.procErr = d.error || '处理失败'; return }
              this.procResult = d
              this.procResult.downloadUrl = d.download ? BASE + d.download : ''
            } catch (e) { this.procErr = e.message }
            this.procBusy = false
          },
          renderSim() {
            const r = this.simResult
            if (!r) return null
            const color = r.hamming <= 4 ? '#3fb950' : (r.hamming <= 10 ? '#d29922' : '#f85149')
            return h('div', { class: 'flex', style: 'gap:16px;align-items:center;flex-wrap:wrap;margin-top:10px;' }, [
              h('div', null, [
                h('div', { style: 'font-size:28px;font-weight:700;color:' + color + ';' }, r.similarity + '%'),
                h('div', { class: 'hint' }, '相似度(dHash)')
              ]),
              h('div', null, [
                h('div', { style: 'font-weight:600;color:' + color + ';' }, r.verdict),
                h('div', { class: 'hint' }, '汉明距离 ' + r.hamming + ' / 64'),
                h('div', { class: 'hint' }, 'A: ' + r.a + ' · B: ' + r.b)
              ])
            ])
          },
          renderProc() {
            const r = this.procResult
            if (!r) return null
            const rows = (r.results || []).map((x) =>
              h('tr', { key: x.name }, [
                h('td', { class: 'mono' }, x.name),
                h('td', null, x.ok
                  ? h('span', { style: 'color:#3fb950;' }, '✓ 成功')
                  : h('span', { style: 'color:#f85149;' }, '✗ ' + (x.error || '处理失败'))),
                h('td', { class: 'mono' }, x.output || '-')
              ]))
            return h('div', { style: 'margin-top:10px;' }, [
              h('table', { class: 'table' }, [
                h('thead', null, h('tr', null, [h('th', null, '文件'), h('th', null, '状态'), h('th', null, '输出')])),
                h('tbody', null, rows)
              ]),
              r.downloadUrl ? h('p', { style: 'margin-top:8px;' },
                h('a', { class: 'btn btn-primary', href: r.downloadUrl, target: '_blank', rel: 'noopener' },
                  '下载结果文件' + (r.single ? '' : ' (ZIP)'))) : null
            ])
          }
        },
        mounted() { this.loadInfo() },
        render() {
          const info = this.info
          return h('div', { class: 'imagetool-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' },
                '图像工具' + (info ? ' · v' + info.version + ' ' + (info.description || '') : '')),
              // 相似度对比
              h('div', { class: 'card', style: 'padding:14px;margin-bottom:12px;' }, [
                h('div', { class: 'section-title', style: 'margin-bottom:8px;' }, '相似度对比'),
                h('div', { class: 'flex', style: 'gap:8px;align-items:center;flex-wrap:wrap;' }, [
                  h('input', { class: 'input', type: 'file', accept: 'image/*', onchange: (e) => this.pickA(e) }),
                  h('span', { class: 'hint' }, 'vs'),
                  h('input', { class: 'input', type: 'file', accept: 'image/*', onchange: (e) => this.pickB(e) }),
                  h('button', {
                    class: 'btn btn-primary',
                    disabled: !this.fileA || !this.fileB || this.simBusy,
                    onclick: () => this.runSimilar()
                  }, this.simBusy ? '对比中...' : '开始对比')
                ]),
                h('p', { class: 'hint' }, '两张图片 dHash 相似度(汉明距离 ≤4 高度相似, ≤10 相似)'),
                this.simErr ? h('p', { class: 'hint', style: 'color:#f85149;' }, this.simErr) : null,
                this.renderSim()
              ]),
              // 图像处理
              h('div', { class: 'card', style: 'padding:14px;' }, [
                h('div', { class: 'section-title', style: 'margin-bottom:8px;' }, '图像处理'),
                h('div', { class: 'flex', style: 'gap:8px;align-items:center;flex-wrap:wrap;' }, [
                  h('input', { class: 'input', type: 'file', accept: 'image/*', multiple: true, onchange: (e) => this.pickProc(e) }),
                  h('button', {
                    class: 'btn btn-primary',
                    disabled: !this.procFiles.length || this.procBusy,
                    onclick: () => this.runProcess()
                  }, this.procBusy ? '处理中...' : '开始处理')
                ]),
                h('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap;margin-top:8px;' }, [
                  h('select', { class: 'input', style: 'width:110px;', value: this.procFormat, onchange: (e) => (this.procFormat = e.target.value) },
                    FORMATS.map(([v, l]) => h('option', { value: v }, l))),
                  h('input', {
                    class: 'input',
                    placeholder: '缩放 如 800x600 / 50%',
                    style: 'width:170px;',
                    value: this.procResize,
                    oninput: (e) => (this.procResize = e.target.value)
                  }),
                  h('input', {
                    class: 'input',
                    type: 'number',
                    placeholder: '质量 0-100',
                    min: 0, max: 100,
                    style: 'width:110px;',
                    value: this.procQuality,
                    oninput: (e) => (this.procQuality = e.target.value)
                  }),
                  h('input', {
                    class: 'input',
                    type: 'number',
                    placeholder: '旋转角度',
                    style: 'width:110px;',
                    value: this.procRotate,
                    oninput: (e) => (this.procRotate = e.target.value)
                  })
                ]),
                h('p', { class: 'hint' }, '支持多图批量: 转换格式 / 缩放 / 质量 / 旋转(ImageMagick convert)'),
                this.procErr ? h('p', { class: 'hint', style: 'color:#f85149;' }, this.procErr) : null,
                this.renderProc()
              ])
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