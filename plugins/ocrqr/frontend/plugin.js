// ocrqr 插件 Vue3 前端(独立构建, esbuild IIFE)
// 契约: window.__rcPlugin_ocrqr = { mount(container, ctx) }
// 区块: 顶部环境探测条 + tabs [OCR 识别 | 二维码生成 | 二维码解码]
// 路由: GET /ocr/check · POST /ocr(multipart file) · GET /qr/gen?text&size · POST /qr/decode(multipart file)
// 注意: /qr/gen 返回的 url 是旧 toolbox 前缀, 前端按本插件前缀 /api/plugins/ocrqr/cache/<name> 重建
import { createApp, h } from 'vue'

export function register(g) {
  g.__rcPlugin_ocrqr = {
    name: 'ocrqr',
    mount: function (container, ctx) {
      const BASE = '/api/plugins/ocrqr'

      const App = {
        data() {
          return {
            tab: 'ocr',
            env: null,
            // OCR 识别
            ocrFile: null,
            ocrBusy: false,
            ocrText: '',
            ocrLines: 0,
            ocrElapse: null,
            ocrErr: '',
            // 二维码生成
            qrText: '',
            qrSize: 300,
            qrBusy: false,
            qrUrl: '',
            qrErr: '',
            // 二维码解码
            qrFile: null,
            qrBusy2: false,
            qrResults: [],
            qrErr2: ''
          }
        },
        methods: {
          // 环境探测: {ok,models,package,model_dir}
          async checkEnv() {
            try {
              const r = await fetch(BASE + '/ocr/check')
              this.env = await r.json()
            } catch (e) {
              this.env = { ok: false, error: e.message }
            }
          },
          pickOcr(e) {
            this.ocrFile = e.target.files ? e.target.files[0] : null
            this.ocrText = ''
            this.ocrErr = ''
            this.ocrLines = 0
            this.ocrElapse = null
            e.target.value = ''
          },
          // POST /ocr -> {ok,text,lines,elapse}
          async runOcr() {
            if (!this.ocrFile) return
            this.ocrBusy = true
            this.ocrErr = ''
            try {
              const fd = new FormData()
              fd.append('file', this.ocrFile)
              const r = await fetch(BASE + '/ocr', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) { this.ocrErr = d.error || '识别失败'; return }
              this.ocrText = d.text || ''
              this.ocrLines = (d.lines || []).length
              this.ocrElapse = d.elapse
            } catch (e) { this.ocrErr = e.message }
            this.ocrBusy = false
          },
          fmtElapse() {
            const e = this.ocrElapse
            if (e == null) return '-'
            if (typeof e === 'number') return e.toFixed(2) + 's'
            if (Array.isArray(e)) return e.map((x) => (x == null ? 0 : x).toFixed(2)).join(' + ') + 's'
            return String(e)
          },
          async copyText() {
            try { await navigator.clipboard.writeText(this.ocrText) } catch (e) {}
          },
          // GET /qr/gen?text=&size= -> {ok,url}
          async genQr() {
            const text = (this.qrText || '').trim()
            if (!text) { this.qrErr = '内容不能为空'; return }
            this.qrBusy = true
            this.qrErr = ''
            this.qrUrl = ''
            try {
              let size = parseInt(this.qrSize, 10) || 300
              size = Math.max(120, Math.min(1024, size))
              const r = await fetch(BASE + '/qr/gen?text=' + encodeURIComponent(text) + '&size=' + size)
              const d = await r.json()
              if (!d.ok) { this.qrErr = d.error || '生成失败'; return }
              // 后端 url 为旧 toolbox 前缀, 取文件名后按本插件前缀重建缓存直链
              const name = (d.url || '').split('/cache/').pop()
              this.qrUrl = name ? BASE + '/cache/' + name : ''
              if (!this.qrUrl) this.qrErr = '生成失败: 缺少缓存地址'
            } catch (e) { this.qrErr = e.message }
            this.qrBusy = false
          },
          pickQr(e) {
            this.qrFile = e.target.files ? e.target.files[0] : null
            this.qrResults = []
            this.qrErr2 = ''
            e.target.value = ''
          },
          // POST /qr/decode -> {ok,results:[{data,points}]}
          async decodeQr() {
            if (!this.qrFile) return
            this.qrBusy2 = true
            this.qrErr2 = ''
            try {
              const fd = new FormData()
              fd.append('file', this.qrFile)
              const r = await fetch(BASE + '/qr/decode', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) { this.qrErr2 = d.error || '解码失败'; return }
              this.qrResults = d.results || []
            } catch (e) { this.qrErr2 = e.message }
            this.qrBusy2 = false
          },
          renderOcr() {
            return h('div', { class: 'card', style: 'padding:14px;' }, [
              h('div', { class: 'flex', style: 'gap:8px;align-items:center;flex-wrap:wrap;' }, [
                h('input', { class: 'input', type: 'file', accept: 'image/*', onchange: (e) => this.pickOcr(e) }),
                h('button', { class: 'btn btn-primary', disabled: !this.ocrFile || this.ocrBusy, onclick: () => this.runOcr() },
                  this.ocrBusy ? '识别中...' : '开始识别')
              ]),
              h('p', { class: 'hint' }, '上传图片 → 后台 rapidocr 识别, 输出纯文本与行数'),
              this.ocrErr ? h('p', { class: 'hint', style: 'color:#f85149;' }, this.ocrErr) : null,
              this.ocrText ? h('div', { style: 'margin-top:8px;' }, [
                h('div', { class: 'flex', style: 'gap:10px;align-items:center;' }, [
                  h('span', { class: 'hint' }, '耗时 ' + this.fmtElapse() + ' · ' + this.ocrLines + ' 行'),
                  h('button', { class: 'btn btn-sm', onclick: () => this.copyText() }, '复制')
                ]),
                h('textarea', {
                  class: 'input',
                  readonly: true,
                  style: 'width:100%;height:220px;margin-top:8px;resize:vertical;font-family:monospace;',
                  value: this.ocrText
                })
              ]) : null
            ])
          },
          renderGen() {
            return h('div', { class: 'card', style: 'padding:14px;' }, [
              h('div', { class: 'flex', style: 'gap:8px;flex-wrap:wrap;' }, [
                h('input', {
                  class: 'input',
                  placeholder: '二维码内容(文本/链接)',
                  style: 'flex:1;min-width:220px;',
                  value: this.qrText,
                  oninput: (e) => (this.qrText = e.target.value)
                }),
                h('input', {
                  class: 'input',
                  type: 'number',
                  min: 120, max: 1024, step: 10,
                  style: 'width:100px;',
                  value: this.qrSize,
                  oninput: (e) => (this.qrSize = e.target.value)
                }),
                h('button', { class: 'btn btn-primary', onclick: () => this.genQr() },
                  this.qrBusy ? '生成中...' : '生成')
              ]),
              h('p', { class: 'hint' }, '尺寸范围 120–1024 px, 默认 300'),
              this.qrErr ? h('p', { class: 'hint', style: 'color:#f85149;' }, this.qrErr) : null,
              this.qrUrl ? h('div', { style: 'margin-top:10px;' }, [
                h('a', { href: this.qrUrl, target: '_blank', rel: 'noopener' },
                  h('img', {
                    src: this.qrUrl,
                    alt: '二维码预览',
                    style: 'max-width:280px;border:1px solid var(--border,#444);border-radius:4px;display:block;'
                  })),
                h('p', { class: 'hint' }, '点击图片新窗口查看 / 下载原图')
              ]) : null
            ])
          },
          renderDecode() {
            return h('div', { class: 'card', style: 'padding:14px;' }, [
              h('div', { class: 'flex', style: 'gap:8px;align-items:center;flex-wrap:wrap;' }, [
                h('input', { class: 'input', type: 'file', accept: 'image/*', onchange: (e) => this.pickQr(e) }),
                h('button', { class: 'btn btn-primary', disabled: !this.qrFile || this.qrBusy2, onclick: () => this.decodeQr() },
                  this.qrBusy2 ? '解码中...' : '解码')
              ]),
              h('p', { class: 'hint' }, '上传含二维码的图片, 返回识别到的文本(支持多码)'),
              this.qrErr2 ? h('p', { class: 'hint', style: 'color:#f85149;' }, this.qrErr2) : null,
              this.qrResults.length ? h('div', { style: 'margin-top:8px;' }, [
                h('div', { class: 'hint' }, '识别到 ' + this.qrResults.length + ' 个二维码:'),
                this.qrResults.map((r, i) =>
                  h('div', {
                    class: 'mono',
                    style: 'background:rgba(127,127,127,.08);border:1px solid var(--border,#444);border-radius:4px;padding:8px 10px;margin-top:6px;word-break:break-all;'
                  }, [
                    h('div', { style: 'color:#3fb950;font-size:12px;' }, '#' + (i + 1)),
                    h('div', null, r.data)
                  ])
                )
              ]) : null
            ])
          }
        },
        mounted() { this.checkEnv() },
        render() {
          const tabBtn = (key, label) =>
            h('button', {
              class: 'btn btn-sm' + (this.tab === key ? ' btn-primary' : ''),
              onclick: () => (this.tab = key)
            }, label)
          const env = this.env
          const envColor = !env ? 'var(--text-faint,#888)' : (env.ok ? '#3fb950' : '#f85149')
          const envText = !env ? '环境检测中...' : (env.ok ? '环境就绪' : '环境不可用')
          return h('div', { class: 'ocrqr-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, [
                'OCR 识别 / 二维码工具',
                h('span', { style: 'margin-left:10px;font-size:12px;color:' + envColor + ';' }, envText)
              ]),
              env ? h('p', { class: 'hint' },
                '模型 ' + (env.models ? '✓' : '✗') + ' · 依赖包 ' + (env.package ? '✓' : '✗') +
                ' · ' + (env.model_dir || '')) : null
            ]),
            h('div', { class: 'flex', style: 'gap:8px;margin-bottom:10px;' }, [
              tabBtn('ocr', 'OCR 识别'),
              tabBtn('gen', '二维码生成'),
              tabBtn('decode', '二维码解码')
            ]),
            this.tab === 'ocr' ? this.renderOcr() : null,
            this.tab === 'gen' ? this.renderGen() : null,
            this.tab === 'decode' ? this.renderDecode() : null
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