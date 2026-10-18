// 面板 JMComic 页封面加载端到端验证
// 用法: node tools/jm-cover-probe.mjs http://127.0.0.1:3900/ --port 9444 --kw 关键词
const args = process.argv.slice(2)
const base = (args[0] || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const keyword = argOf('--kw', '百合')

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.log('FAIL 无可用页面'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })

let id = 0
const pending = new Map()
const errs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails
    errs.push((d.exception && d.exception.description) || d.text || '?')
  }
}
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => pending.set(i, r))
}
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text }
  return r.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })

// ---- 登录 ----
await send('Page.navigate', { url: 'about:blank' })
await sleep(300)
await send('Page.navigate', { url: base + '/' })
await sleep(2500)
const loggedIn = await ev(`(() => {
  const el = document.querySelector('input[type=password]')
  if (!el) return 'already-logged-in'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(el, '1'); el.dispatchEvent(new Event('input', { bubbles: true }))
  return 'filled'
})()`)
console.log('登录表单:', loggedIn)
if (loggedIn === 'filled') {
  await sleep(400)
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /登录/.test(x.innerText))
    if (b) b.click()
    return !!b
  })()`)
  await sleep(3000)
}

// ---- 打开插件页：必须用 hash 路由 ----
// 用 Page.navigate 会整页刷新，SPA 路由状态丢失（登录态靠 cookie 还在，但挂载时机不对）
await ev(`location.hash = '#/plugin/JMComic'; true`)
await sleep(4000)
errs.length = 0

const mounted = await ev(`(() => {
  const root = document.querySelector('.plugin-mount')
  return root ? (root.innerText || '').slice(0, 80) : '(未挂载)'
})()`)
console.log('插件页:', JSON.stringify(mounted))

// ---- 输入关键词搜索 ----
const typed = await ev(`(() => {
  const el = document.querySelector('.plugin-mount input.input[placeholder*="关键词"], .plugin-mount input')
  if (!el) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(el, ${JSON.stringify(keyword)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return 'typed'
})()`)
console.log('输入关键词:', typed, keyword)

// 防抖 + 网络
await sleep(3000)

// 点搜索按钮确保触发
await ev(`(() => {
  const btns = Array.from(document.querySelectorAll('.plugin-mount button'))
  const b = btns.find((x) => (x.innerText || '').trim() === '搜索')
  if (b) b.click()
  return !!b
})()`)

/** 统计当前封面状态 */
const stat = async () => ev(`(() => {
  const root = document.querySelector('.plugin-mount')
  if (!root) return { err: 'no-root' }
  const cards = Array.from(root.querySelectorAll('.rcjm-card, .card'))
  const imgs = Array.from(root.querySelectorAll('.rcjm-thumb'))
  const skels = Array.from(root.querySelectorAll('.rcjm-skel'))
  const ok = imgs.filter((i) => i.complete && i.naturalWidth > 0).length
  const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0).length
  const loading = imgs.filter((i) => !i.complete).length
  // vue 实例里的重试队列长度
  let pend = null
  try {
    const el = root.querySelector('*')
    // 通过 Vue 组件实例读取（plugin.js 挂到 .plugin-mount 上）
    let node = root.firstElementChild
    let vm = null
    while (node && !vm) {
      vm = node.__vueParentComponent || node.__vue_app__ ? (node.__vueParentComponent && node.__vueParentComponent.ctx) : null
      node = node.firstElementChild
    }
    if (vm && vm.coverPending) pend = Object.keys(vm.coverPending).length
  } catch (e) {}
  return {
    cards: cards.length, imgs: imgs.length, skels: skels.length,
    ok, broken, loading, pending: pend,
    text: (root.innerText || '').slice(0, 100).replace(/\\n/g, ' | '),
  }
})()`)

console.log('\n搜索后立刻:')
console.log(JSON.stringify(await stat(), null, 1))

let last = 0
for (const t of [3, 8, 15, 25, 35]) {
  await sleep((t - last) * 1000); last = t
  console.log(`\n+${t}s:`)
  console.log(JSON.stringify(await stat(), null, 1))
}

console.log('\nJS 异常:', errs.length ? errs.slice(0, 3).join(' | ') : '无')
ws.close()
