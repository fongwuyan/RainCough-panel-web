// 验证滚动到底后所有位置（尤其最后几排）都能加载封面
// 用法: node tools/jm-cover-bottom.mjs http://127.0.0.1:3900/ --port 9444 --kw 关键词
const args = process.argv.slice(2)
const base = (args[0] || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const keyword = argOf('--kw', '百合')
const waitSec = Number(argOf('--wait', '90'))

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
  if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description }
  return r.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const scrollBottom = () => ev(`(() => {
  let el = document.querySelector('.plugin-mount')
  while (el) {
    const oy = getComputedStyle(el).overflowY
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 10) {
      el.scrollTop = el.scrollHeight; return 'container'
    }
    el = el.parentElement
  }
  window.scrollTo(0, document.documentElement.scrollHeight); return 'window'
})()`)

/** 每个位置是否有封面 */
const snap = () => ev(`(() => {
  const cards = [...document.querySelectorAll('.plugin-mount .rcjm-card')]
  const withCover = []
  const missing = []
  cards.forEach((c, i) => {
    if (c.querySelector('.rcjm-thumb')) withCover.push(i); else missing.push(i)
  })
  return { total: cards.length, have: withCover.length, missing }
})()`)

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

await ev(`location.hash = '#/plugin/JMComic'; true`)
await sleep(4000)
errs.length = 0

// 搜索
await ev(`(() => {
  const el = document.querySelector('.plugin-mount input')
  if (!el) return false
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(el, ${JSON.stringify(keyword)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`)
await sleep(1000)
await ev(`(() => {
  const b = [...document.querySelectorAll('.plugin-mount button')].find((x) => x.innerText.trim() === '搜索')
  if (b) b.click(); return !!b
})()`)
await sleep(4000)

const first = await snap()
console.log(`关键词「${keyword}」 共 ${first.total} 个卡片`)
console.log('')
console.log('  阶段            有封面   缺失位置（前 30）')
console.log('  --------------  ------   ------------------------------')

const show = (label, s) => {
  const m = s.missing.slice(0, 30).join(',')
  console.log(`  ${label.padEnd(14)}  ${String(s.have).padStart(4)}/${s.total}  ${m || '（无缺失）'}`)
}
show('搜索后', first)

// 反复滚到底，模拟用户行为
for (let round = 1; round <= 6; round++) {
  await scrollBottom()
  await sleep(1500)
  await scrollBottom()
  await sleep(2500)
  const s = await snap()
  show(`滚到底 x${round}`, s)
  if (s.missing.length === 0) break
}

// 长时间等待，看剩余是否补齐
console.log('')
console.log('  等待补齐中…')
const t0 = Date.now()
let last = -1
while ((Date.now() - t0) / 1000 < waitSec) {
  await scrollBottom()
  await sleep(3000)
  const s = await snap()
  if (s.have !== last) {
    last = s.have
    show(`+${Math.round((Date.now() - t0) / 1000)}s`, s)
  }
  if (s.missing.length === 0) break
}

const fin = await snap()
console.log('')
console.log('结论:')
console.log(`  卡片总数: ${fin.total}`)
console.log(`  已有封面: ${fin.have}`)
console.log(`  仍缺失:   ${fin.missing.length}${fin.missing.length ? ' → ' + fin.missing.join(',') : ''}`)
console.log(`  最后两个位置 (${Math.max(0, fin.total - 16)}-${fin.total - 1}) 是否都有封面: ${
  fin.missing.filter((i) => i >= fin.total - 16).length === 0 ? '✅ 是' : '❌ 否'
}`)
console.log('  JS 异常:', errs.length ? errs.slice(0, 2).join(' | ') : '无')

ws.close()
