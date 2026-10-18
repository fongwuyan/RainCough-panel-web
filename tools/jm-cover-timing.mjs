// 验证封面"立即显示"：统计每张封面实际出现的时间点
// 用法: node tools/jm-cover-timing.mjs http://127.0.0.1:3900/ --port 9444 --kw 关键词
const args = process.argv.slice(2)
const base = (args[0] || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const keyword = argOf('--kw', '百合')
const maxSec = Number(argOf('--max', '40'))

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

// 触发搜索
await ev(`(() => {
  const el = document.querySelector('.plugin-mount input')
  if (!el) return false
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(el, ${JSON.stringify(keyword)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`)
await sleep(1000)
const t0 = Date.now()
await ev(`(() => {
  const b = [...document.querySelectorAll('.plugin-mount button')].find((x) => x.innerText.trim() === '搜索')
  if (b) b.click(); return !!b
})()`)

// 每 200ms 采样：哪些位置已经有 <img>
const seen = new Map()   // index -> 首次出现秒数
let firstAt = null
console.log(`关键词: ${keyword}   采样间隔 200ms`)
console.log('')
console.log('  秒    有封面   新出现的位置')
console.log('  ----  ------   ----------------')

let lastCount = 0
while ((Date.now() - t0) / 1000 <= maxSec) {
  const snap = await ev(`(() => {
    const cards = [...document.querySelectorAll('.plugin-mount .rcjm-card')]
    const withCover = []
    cards.forEach((c, i) => { if (c.querySelector('.rcjm-thumb')) withCover.push(i) })
    return { total: cards.length, withCover }
  })()`)
  if (snap && snap.withCover) {
    const sec = +((Date.now() - t0) / 1000).toFixed(1)
    const newOnes = []
    for (const i of snap.withCover) {
      if (!seen.has(i)) {
        seen.set(i, sec)
        newOnes.push(i)
        if (firstAt === null) firstAt = sec
      }
    }
    if (newOnes.length) {
      console.log(`  ${String(sec).padStart(5)}  ${String(snap.withCover.length).padStart(6)}   ${newOnes.join(',')}`)
      lastCount = snap.withCover.length
    }
    // 前 12 个都到位就停
    if (seen.size >= 12) break
  }
  await sleep(200)
}

console.log('')
console.log('汇总:')
if (firstAt !== null) {
  console.log(`  第一张封面出现: ${firstAt}s`)
  const times = [...seen.entries()].sort((a, b) => a[1] - b[1])
  const t3 = times[2] ? times[2][1] : null
  const t6 = times[5] ? times[5][1] : null
  const t12 = times[11] ? times[11][1] : null
  if (t3) console.log(`  前 3 张到位:    ${t3}s`)
  if (t6) console.log(`  前 6 张到位:    ${t6}s`)
  if (t12) console.log(`  前 12 张到位:   ${t12}s`)
  console.log(`  共出现:         ${seen.size} 张`)
  // 是否按区域成组出现（同一秒内多个）
  const bySec = {}
  for (const [, t] of times) bySec[t] = (bySec[t] || 0) + 1
  const groups = Object.entries(bySec).map(([t, n]) => `${t}s×${n}`).join('  ')
  console.log(`  出现节奏:       ${groups}`)
} else {
  console.log('  一张都没出现')
}
console.log('  JS 异常:', errs.length ? errs.slice(0, 2).join(' | ') : '无')

ws.close()
