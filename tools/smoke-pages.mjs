#!/usr/bin/env node
// 页面冒烟测试: 逐页加载, 断言无 JS 异常 / 无白屏 / 无失败请求
//
// 为什么有它(2026-10-18 事故):
//   usePluginHub.js 里 loadRuntime 的定义被误删, 只留调用。**vite build 全绿**,
//   但用户一点「插件」页就白屏: ReferenceError: loadRuntime is not defined。
//   静态检查(check-undefined/check-bindings)能拦住大部分, 但运行时才暴露的问题
//   (不只是未定义标识符: 还有 undefined 属性访问、响应式 API 误用等) 只能靠真跑。
//   这个脚本就是最后一道闸: 每个路由都真实加载一遍, 有任何 JS 异常立即失败。
//
// 用法:
//   node tools/smoke-pages.mjs http://192.168.2.200:3910/ --pw 1 [--gate <口令>] [--port 9444]
//
// 退出码: 0 = 全部页面干净; 1 = 有异常

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')
const gatePW = argOf('--gate', '')

// 面板路由: path → 页面名。新增页面时在这里补一行。
const PAGES = [
  ['/', '工作台'],
  ['/#/files', '文件管理'],
  ['/#/terminal', '终端'],
  ['/#/plugins', '插件'],
  ['/#/settings', '设置'],
  ['/#/plugin/JMComic', 'JMComic 插件页'],
]

const fails = []
const ok = (c, l, e) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? '  ' + e : ''}`); if (!c) fails.push(l) }

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.error('没有 page target(先启动带 --remote-debugging-port 的 Chrome)'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })

let id = 0
const pending = new Map()
let errs = []          // 当前页面收集到的 JS 异常
let failedApi = []     // 当前页面失败的 /api 请求
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails
    const msg = (d && (d.exception && d.exception.description || d.text)) || 'unknown'
    errs.push(String(msg).split('\n')[0])
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    const txt = m.params.args.map((a) => a.value || a.description || '').join(' ')
    // 只关心真正的 JS 错误, 忽略网络 4xx 之类的噪声(下面单独查 API)
    if (/ReferenceError|TypeError|is not defined|is not a function|Cannot read/.test(txt)) errs.push(txt.slice(0, 200))
  }
  if (m.method === 'Network.responseReceived') {
    const r = m.params.response
    // 401 在登录前是正常的; 登录后不该出现
    if (r.url.includes('/api/') && r.status >= 400 && r.status !== 401) failedApi.push(`HTTP ${r.status} ${r.url.replace(base, '')}`)
  }
}
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)) }
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

// 登录
await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
await send('Page.navigate', { url: base + '/' }); await sleep(2400)
if (await ev(`!!document.querySelector('.login-card')`)) {
  if (!loginPW) { console.error('需要登录但未提供 --pw'); process.exit(1) }
  await ev(`(() => {
    const el = document.querySelector('.field-input')
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, ${JSON.stringify(loginPW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(250)
  await ev(`(() => { document.querySelector('.btn-primary').click(); return true })()`)
  await sleep(2500)
}
ok(await ev(`!document.querySelector('.login-card')`), '登录面板')

// 解锁插件库(让插件页的市场页签也能渲染)
if (gatePW) {
  await ev(`fetch('/api/store/gate/unlock', {
    method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({password: ${JSON.stringify(gatePW)}})
  }).then(r=>r.json()).catch(()=>null)`)
  await sleep(300)
}

// 逐页检查
for (const [route, label] of PAGES) {
  errs = []; failedApi = []
  await send('Page.navigate', { url: 'about:blank' }); await sleep(200)
  await send('Page.navigate', { url: base + route }); await sleep(3000)

  const st = await ev(`(() => {
    const sidebar = !!document.querySelector('.sidebar')
    const main = document.querySelector('.page') || document.querySelector('.ph-page') || document.querySelector('main')
    const txt = ((main && main.innerText) || document.body.innerText || '').trim()
    // ★ 全局错误红条: App.vue 的 onErrorCaptured 会把异常渲染成 "全局错误: ..." 的
    //   红色横条。Vue 捕获后 **不会** 触发 Runtime.exceptionThrown, 只查 errs 会漏报 ——
    //   2026-10-18 的 loadRuntime 事故正是这种形态(用户看到的就是这条红条)。
    const bar = Array.from(document.querySelectorAll('div')).find(
      (d) => /^全局错误/.test((d.innerText || '').trim()) && d.style && d.style.position === 'fixed'
    )
    return {
      sidebar, textLen: txt.length,
      hasLogin: !!document.querySelector('.login-card'),
      globalErr: bar ? (bar.innerText || '').trim().slice(0, 200) : '',
      preview: txt.slice(0, 80),
    }
  })()`)

  const noGlobalErr = !(st && st.globalErr)
  ok(noGlobalErr, `${label}  无全局错误条`, noGlobalErr ? '' : st.globalErr)
  const clean = errs.length === 0
  const rendered = st && !st.hasLogin && st.textLen > 20
  ok(clean, `${label}  无 JS 异常`, clean ? '' : errs.slice(0, 2).join(' | '))
  ok(rendered, `${label}  正常渲染`, rendered ? `${st.textLen} 字符` : `textLen=${st && st.textLen} login=${st && st.hasLogin}`)
  if (failedApi.length) {
    ok(false, `${label}  API 请求正常`, failedApi.slice(0, 2).join(' | '))
  }
}

console.log('')
if (fails.length === 0) {
  console.log('全部通过')
} else {
  console.log(`失败 ${fails.length} 项:`)
  for (const f of fails) console.log('  - ' + f)
}
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
