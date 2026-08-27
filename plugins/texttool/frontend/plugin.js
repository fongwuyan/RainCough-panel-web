// texttool 插件 Vue3 前端(独立构建, esbuild IIFE, 完全自包含)
// 契约: window.__rcPlugin_texttool = { name, mount(container, ctx) }
// 后端: plugins/texttool/server.py
//    POST /text/regex   (JSON {pattern, text, flags})   -> {ok, count, matches:[{start,end,match,groups}]}
//    POST /text/replace (multipart: files + find,replace,regex) -> {ok, results, download}
//    POST /text/convert (JSON {content, action})        -> {ok, output}   action: json2yaml|yaml2json|jsonfmt|jsonmin
//    POST /text/stats   (multipart: file/files)         -> {ok, chars, chars_no_space, words, lines, bytes, top_chars}
//    GET  /file/<session>/<name>  结果文件下载(download 路径清洗后补前缀)
import { createApp, h } from 'vue'

const BASE = '/api/plugins/texttool'

// Python re 标志位(re.IGNORECASE=2, re.MULTILINE=8, re.DOTALL=16)
const FLAG_OPTS = [
  { k: 'i', l: '忽略大小写', v: 2 },
  { k: 'm', l: '多行模式', v: 8 },
  { k: 's', l: '点号匹配换行', v: 16 },
]

const CV_ACTIONS = [
  { v: 'json2yaml', l: 'JSON → YAML' },
  { v: 'yaml2json', l: 'YAML → JSON' },
  { v: 'jsonfmt', l: 'JSON 格式化' },
  { v: 'jsonmin', l: 'JSON 压缩' },
]

export function register(g) {
  g.__rcPlugin_texttool = {
    name: 'texttool',
    mount: function (container, ctx) {
      const App = {
        data() {
          return {
            tab: 'regex',
            // --- 正则 ---
            rePattern: '', reText: '', reFlags: { i: false, m: false, s: false },
            reRes: null, reErr: '',
            // --- 替换(文件) ---
            repFiles: [], repFind: '', repReplace: '', repRegex: false,
            repRes: null, repErr: '',
            // --- 转换 ---
            cvContent: '', cvAction: 'json2yaml', cvRes: null, cvErr: '',
            // --- 统计 ---
            stFile: null, stRes: null, stErr: '',
            copied: false,
          }
        },
        methods: {
          dlUrl(p) {
            if (!p) return ''
            let path = String(p)
            const idx = path.indexOf('/api/plugins/')
            if (idx >= 0) {
              const rest = path.slice(idx + '/api/plugins/'.length)
              const slash = rest.indexOf('/')
              path = slash >= 0 ? rest.slice(slash) : rest
            }
            return BASE + (path.charAt(0) === '/' ? path : '/' + path)
          },
          trunc(s, n) {
            s = String(s == null ? '' : s)
            return s.length > n ? s.slice(0, n) + '…' : s
          },
          flagsInt() {
            let f = 0
            for (const o of FLAG_OPTS) if (this.reFlags[o.k]) f |= o.v
            return f
          },
          async copy(text) {
            try {
              await navigator.clipboard.writeText(String(text))
              this.copied = true
              setTimeout(() => (this.copied = false), 1200)
            } catch (e) { /* 剪贴板不可用时忽略 */ }
          },
          // ---- 正则匹配(JSON) ----
          async doRegex() {
            this.reErr = ''; this.reRes = null
            if (!this.rePattern) { this.reErr = '请输入正则表达式'; return }
            try {
              const r = await fetch(BASE + '/text/regex', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pattern: this.rePattern, text: this.reText, flags: this.flagsInt() }),
              })
              const d = await r.json()
              if (!d.ok) this.reErr = d.error || '正则执行失败'
              else this.reRes = d
            } catch (e) { this.reErr = '请求失败: ' + e }
          },
          // ---- 文件替换(multipart) ----
          async doReplace() {
            this.repErr = ''; this.repRes = null
            if (!this.repFiles.length) { this.repErr = '请选择要处理的文本文件'; return }
            if (!this.repFind) { this.repErr = '查找内容不能为空'; return }
            try {
              const fd = new FormData()
              for (const f of this.repFiles) fd.append('files', f)
              fd.append('find', this.repFind)
              fd.append('replace', this.repReplace)
              fd.append('regex', this.repRegex ? '1' : '0')
              const r = await fetch(BASE + '/text/replace', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) this.repErr = d.error || '替换失败'
              else this.repRes = d
            } catch (e) { this.repErr = '请求失败: ' + e }
          },
          // ---- 格式转换(JSON) ----
          async doConvert() {
            this.cvErr = ''; this.cvRes = null
            if (!this.cvContent.trim()) { this.cvErr = '请输入要转换的内容'; return }
            try {
              const r = await fetch(BASE + '/text/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: this.cvContent, action: this.cvAction }),
              })
              const d = await r.json()
              if (!d.ok) this.cvErr = d.error || '转换失败'
              else this.cvRes = d
            } catch (e) { this.cvErr = '请求失败: ' + e }
          },
          // ---- 文本统计(multipart) ----
          async doStats() {
            this.stErr = ''; this.stRes = null
            if (!this.stFile) { this.stErr = '请选择文本文件'; return }
            try {
              const fd = new FormData()
              fd.append('files', this.stFile)
              const r = await fetch(BASE + '/text/stats', { method: 'POST', body: fd })
              const d = await r.json()
              if (!d.ok) this.stErr = d.error || '统计失败'
              else this.stRes = d
            } catch (e) { this.stErr = '请求失败: ' + e }
          },
        },
        render() {
          const TABS = [['regex', '正则'], ['replace', '替换'], ['convert', '转换'], ['stats', '统计']]

          // ---- Tab 正则 ----
          const tabRegex = h('div', { class: 'section' }, [
            h('div', { class: 'section-title' }, '正则匹配'),
            h('div', { class: 'flex', style: 'gap:10px;margin-bottom:8px;align-items:center;flex-wrap:wrap;' }, [
              h('input', { class: 'input', style: 'flex:1;min-width:200px;', placeholder: '正则表达式，如 \\d+', value: this.rePattern, oninput: (e) => (this.rePattern = e.target.value) }),
              FLAG_OPTS.map((o) => h('label', { key: o.k, style: 'display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;' }, [
                h('input', { type: 'checkbox', checked: this.reFlags[o.k], onchange: (e) => (this.reFlags[o.k] = e.target.checked) }),
                o.l,
              ])),
              h('button', { class: 'btn btn-primary', onclick: () => this.doRegex() }, '匹配'),
            ]),
            h('textarea', {
              class: 'input', style: 'width:100%;min-height:140px;resize:vertical;font-family:var(--rc-mono,monospace);',
              placeholder: '待匹配文本…',
              value: this.reText,
              oninput: (e) => (this.reText = e.target.value),
            }),
            this.reErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.reErr) : null,
            this.reRes ? h('div', { style: 'margin-top:10px;' }, [
              h('p', { class: 'hint' }, '共 ' + this.reRes.count + ' 处匹配' + (this.reRes.count > 200 ? '（仅显示前 200 条）' : '')),
              this.reRes.matches && this.reRes.matches.length
                ? h('table', { class: 'table', style: 'margin-top:6px;' }, [
                    h('thead', null, h('tr', null, [
                      h('th', { style: 'width:40px;' }, '#' ),
                      h('th', { style: 'width:120px;' }, '位置'),
                      h('th', null, '匹配内容'),
                      h('th', null, '分组'),
                    ])),
                    h('tbody', null, this.reRes.matches.map((m, i) => h('tr', { key: i }, [
                      h('td', { class: 'mono faint' }, i + 1),
                      h('td', { class: 'mono faint' }, m.start + '–' + m.end),
                      h('td', { class: 'mono', style: 'word-break:break-all;' }, this.trunc(m.match, 160)),
                      h('td', { class: 'mono faint', style: 'word-break:break-all;' },
                        (m.groups && m.groups.length)
                          ? (m.groups.map((gr) => (gr == null ? '' : String(gr))).join(' | ') || '∅')
                          : '∅'),
                    ]))),
                  ])
                : h('p', { class: 'hint' }, '无匹配'),
            ]) : null,
          ])

          // ---- Tab 替换(文件) ----
          const tabReplace = h('div', { class: 'section' }, [
            h('div', { class: 'section-title' }, '文件批量替换'),
            h('input', { type: 'file', multiple: true, onchange: (e) => (this.repFiles = Array.from(e.target.files || [])) }),
            h('div', { class: 'flex', style: 'gap:10px;margin-top:8px;align-items:center;flex-wrap:wrap;' }, [
              h('input', { class: 'input', style: 'flex:1;min-width:170px;', placeholder: '查找文本 / 正则', value: this.repFind, oninput: (e) => (this.repFind = e.target.value) }),
              h('input', { class: 'input', style: 'flex:1;min-width:170px;', placeholder: '替换为（留空 = 删除）', value: this.repReplace, oninput: (e) => (this.repReplace = e.target.value) }),
              h('label', { style: 'display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;' }, [
                h('input', { type: 'checkbox', checked: this.repRegex, onchange: (e) => (this.repRegex = e.target.checked) }),
                '按正则执行',
              ]),
              h('button', { class: 'btn btn-primary', onclick: () => this.doReplace() }, '替换'),
            ]),
            this.repFiles.length ? h('p', { class: 'hint' }, '已选 ' + this.repFiles.length + ' 个文件（UTF-8 文本）') : null,
            this.repErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.repErr) : null,
            this.repRes ? h('div', { style: 'margin-top:8px;' }, [
              h('table', { class: 'table' }, [
                h('thead', null, h('tr', null, [h('th', null, '文件'), h('th', null, '状态'), h('th', null, '是否变化')])),
                h('tbody', null, (this.repRes.results || []).map((r, i) => h('tr', { key: i }, [
                  h('td', { class: 'mono' }, this.trunc(r.name, 50)),
                  h('td', null, r.ok
                    ? h('span', { style: 'color:var(--success);' }, '成功')
                    : h('span', { style: 'color:var(--danger);' }, this.trunc(r.error || '失败', 50))),
                  h('td', null, r.replaced ? '是' : '否'),
                ]))),
              ]),
              this.repRes.download
                ? h('p', { style: 'margin-top:8px;' }, h('a', {
                    class: 'btn btn-sm',
                    href: this.dlUrl(this.repRes.download),
                    style: 'color:var(--accent);text-decoration:none;',
                  }, '下载替换结果 replaced.zip'))
                : null,
            ]) : null,
          ])

          // ---- Tab 转换 ----
          const tabConvert = h('div', { class: 'section' }, [
            h('div', { class: 'section-title' }, '格式转换'),
            h('textarea', {
              class: 'input', style: 'width:100%;min-height:150px;resize:vertical;font-family:var(--rc-mono,monospace);',
              placeholder: '粘贴 JSON / YAML 内容…',
              value: this.cvContent,
              oninput: (e) => (this.cvContent = e.target.value),
            }),
            h('div', { class: 'flex', style: 'gap:10px;margin-top:8px;align-items:center;' }, [
              h('span', { class: 'hint' }, '操作：'),
              h('select', { class: 'input', style: 'width:150px;', onchange: (e) => (this.cvAction = e.target.value) },
                CV_ACTIONS.map((a) => h('option', { value: a.v, selected: a.v === this.cvAction }, a.l))),
              h('button', { class: 'btn btn-primary', onclick: () => this.doConvert() }, '转换'),
            ]),
            this.cvErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.cvErr) : null,
            this.cvRes ? h('div', { style: 'margin-top:10px;' }, [
              h('div', { class: 'flex', style: 'gap:8px;align-items:center;margin-bottom:6px;' }, [
                h('span', { class: 'hint' }, '输出：'),
                h('button', { class: 'btn btn-sm', onclick: () => this.copy(this.cvRes.output) },
                  this.copied ? '已复制' : '复制'),
                h('button', { class: 'btn btn-sm', onclick: () => (this.cvContent = this.cvRes.output) }, '应用到输入'),
              ]),
              h('textarea', {
                class: 'input', style: 'width:100%;min-height:150px;resize:vertical;font-family:var(--rc-mono,monospace);',
                readonly: true, value: this.cvRes.output,
              }),
            ]) : null,
          ])

          // ---- Tab 统计 ----
          const statCards = this.stRes
            ? h('div', { class: 'flex', style: 'gap:10px;flex-wrap:wrap;margin:8px 0;' },
                [['chars', '字符数'], ['chars_no_space', '去空白字符'], ['words', '单词数'],
                 ['lines', '行数'], ['bytes', '字节数']].map((s) =>
                  h('div', { key: s[0], class: 'card', style: 'padding:8px 14px;text-align:center;min-width:88px;' }, [
                    h('div', { class: 'mono', style: 'font-size:18px;' }, String(this.stRes[s[0]] != null ? this.stRes[s[0]] : '-')),
                    h('div', { class: 'hint' }, s[1]),
                  ])))
            : null
          const tabStats = h('div', { class: 'section' }, [
            h('div', { class: 'section-title' }, '文本统计'),
            h('div', { class: 'flex', style: 'gap:10px;align-items:center;flex-wrap:wrap;' }, [
              h('input', { type: 'file', onchange: (e) => (this.stFile = e.target.files && e.target.files[0] || null) }),
              h('span', { class: 'hint' }, this.stFile ? '已选: ' + this.stFile.name : '未选择文件'),
              h('button', { class: 'btn btn-primary', onclick: () => this.doStats() }, '统计'),
            ]),
            this.stErr ? h('p', { class: 'hint', style: 'color:var(--danger);' }, this.stErr) : null,
            statCards,
            this.stRes && this.stRes.top_chars && this.stRes.top_chars.length
              ? h('table', { class: 'table', style: 'margin-top:6px;max-width:420px;' }, [
                  h('thead', null, h('tr', null, [
                    h('th', null, '字符'), h('th', null, '出现次数'), h('th', null, '占比'),
                  ])),
                  h('tbody', null, (() => {
                    const total = this.stRes.chars_no_space || 1
                    return this.stRes.top_chars.map((tc, i) => h('tr', { key: i }, [
                      h('td', { class: 'mono' }, tc.char),
                      h('td', { class: 'mono' }, tc.count),
                      h('td', null, h('div', { style: 'display:flex;align-items:center;gap:6px;' }, [
                        h('div', { style: 'width:80px;height:6px;background:rgba(127,127,127,.15);border-radius:3px;overflow:hidden;' },
                          h('div', { style: 'width:' + Math.min(100, Math.round(tc.count / total * 100)) + '%;height:100%;background:var(--accent,#4f8cff);' })),
                        h('span', { class: 'hint' }, (tc.count / total * 100).toFixed(1) + '%'),
                      ])),
                    ]))
                  })()),
                ])
              : null,
          ])

          return h('div', { class: 'texttool-panel' }, [
            h('div', { class: 'section' }, [
              h('div', { class: 'section-title' }, '文本工具'),
              h('div', { class: 'flex', style: 'gap:8px;margin-bottom:10px;' },
                TABS.map((t) => h('button', {
                  key: t[0],
                  class: 'btn btn-sm' + (this.tab === t[0] ? ' btn-primary' : ''),
                  onclick: () => (this.tab = t[0]),
                }, t[1]))),
            ]),
            this.tab === 'regex' ? tabRegex
              : this.tab === 'replace' ? tabReplace
                : this.tab === 'convert' ? tabConvert
                  : tabStats,
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