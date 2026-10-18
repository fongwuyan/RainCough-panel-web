// 验证封面是否「按顺序」出现：任意时刻实际渲染的 <img> 应该集中在列表前缀
// 用法: node tools/jm-cover-order.mjs http://127.0.0.1:3900/ --port 9444 --kw 关键词
const args = process.argv.slice(2)
const base = (args[0] || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const keyword = argOf('--kw', '机甲')

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

/** 采样：每个卡片位置实际渲染的是 img 还是 skel */
const sample = () => ev(`(() => {
  const cards = [...document.querySelectorAll('.plugin-mount .rcjm-card')]
  const out = cards.map((c) => c.querySelector('.rcjm-thumb') ? 1 : 0)
  // 有封面的位置（下标）
  const withCover = out.map((v, i) => v ? i : -1).filter((i) => i >= 0)
  return { total: cards.length, withCover, count: withCover.length }
})()`)

/** 判断前缀性：有封面的位置是否构成 [0..k-1] */
const isPrefix = (arr) => {
  if (!arr.length) return true
  for (let i = 0; i < arr.length; i++) if (arr[i] !== i) return false
  return true
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: base + '/' })
await sleep(2600)
if (await ev(`!!document.querySelector('input[type=password]')`)) {
  await ev(`(() => {
    const el = document.querySelector('input[type=password]')
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, '1'); el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(300)
  await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /登录/.test(x.innerText))
    if (b) b.click(); return !!b
  })()`)
  await sleep(2600)
}

// 强制刷新前端资源，避免用到旧版
await ev(`location.hash = '#/'; true`)
await sleep(600)
await ev(`(() => { location.reload(); return true })()`)
await sleep(3500)
if (await ev(`!!document.querySelector('input[type=password]')`)) {
  await ev(`(() => {
    const el = document.querySelector('input[type=password]')
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, '1'); el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(300)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /登录/.test(x.innerText)); if (b) b.click(); return !!b })()`)
  await sleep(2600)
}

await ev(`location.hash = '#/plugin/JMComic'; true`)
await sleep(4000)

console.log('关键词:', keyword)
console.log('')

await ev(`(() => {
  const el = document.querySelector('.plugin-mount input')
  if (!el) return false
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(el, ${JSON.stringify(keyword)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`)
await sleep(1200)
await ev(`(() => {
  const b = [...document.querySelectorAll('.plugin-mount button')].find((x) => x.innerText.trim() === '搜索')
  if (b) b.click(); return !!b
})()`)

console.log('时刻   有封面数量   位置(前 20)             是否连续前缀')
console.log('-----  ----------  -----------------------  ------------')

let allPrefix = true
let peak = 0
for (let t = 0; t <= 40; t++) {
  if (t > 0) await sleep(1000)
  const s = await sample()
  if (!s || s.__err) { console.log(`+${t}s  采样失败`); continue }
  const prefix = isPrefix(s.withCover)
  if (!prefix) allPrefix = false
  peak = Math.max(peak, s.count)
  const shown = s.withCover.slice(0, 20).join(',')
  console.log(
    `+${String(t).padStart(2)}s   ${String(s.count).padStart(6)}      ${shown.padEnd(23)}  ${prefix ? '✅' : '❌ 乱序'}`
  )
  if (s.count >= 12 && t > 8) break
}

console.log('')
console.log('结论:')
console.log('  封面峰值数量:', peak)
console.log('  全程是否始终连续前缀:', allPrefix ? '✅ 是（按顺序从上往下）' : '❌ 出现乱序')
console.log('  JS 异常:', errs.length ? errs.slice(0, 2).join(' | ') : '无')

ws.close()
