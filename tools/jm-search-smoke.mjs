// 验证 JMComic 搜索页：无 JS 错误 + 封面加载情况
// 用法: node tools/jm-search-smoke.mjs http://127.0.0.1:3900/ --port 9444 --kw 关键词
const args = process.argv.slice(2)
const base = (args[0] || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const keyword = argOf('--kw', '测试')
const waitSec = Number(argOf('--wait', '20'))

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
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errs.push(m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300))
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

const snap = () => ev(`(() => {
  const root = document.querySelector('.plugin-mount')
  if (!root) return { noMount: true }
  const txt = root.innerText || ''
  const imgs = [...root.querySelectorAll('.rcjm-thumb')]
  return {
    cards: root.querySelectorAll('.rcjm-card').length,
    thumbs: imgs.length,
    loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    skels: root.querySelectorAll('.rcjm-skel').length,
    resultLine: (txt.match(/[0-9]+ 条结果/) || [''])[0],
    errLine: (txt.split('\\n').find((l) => /not a function|TypeError|undefined is/.test(l)) || ''),
  }
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

// 输入关键词并搜索
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

console.log(`关键词: ${keyword}   生产: ${base}`)
console.log('')
console.log('  时刻   卡片  有图  已解码  骨架  结果行')
console.log('  ----   ----  ----  ------  ----  --------')

let firstOk = null
for (let t = 0; t <= waitSec; t += 2) {
  if (t > 0) await sleep(2000)
  const s = await snap()
  if (!s || s.noMount) { console.log(`  +${t}s   插件未挂载`); continue }
  console.log(`  +${String(t).padStart(2)}s   ${String(s.cards).padStart(4)}  ${String(s.thumbs).padStart(4)}  ${String(s.loaded).padStart(6)}  ${String(s.skels).padStart(4)}  ${s.resultLine}`)
  if (s.loaded > 0 && firstOk === null) firstOk = t
  if (s.errLine) { console.log(`  ❌ 页面错误: ${s.errLine}`); break }
}

const fin = await snap()
console.log('')
console.log('结论:')
console.log(`  卡片数: ${fin.cards}`)
console.log(`  搜索结果行: ${fin.resultLine || '(无)'}`)
console.log(`  有封面元素: ${fin.thumbs}，其中已解码: ${fin.loaded}`)
if (firstOk !== null) console.log(`  首张封面出现: +${firstOk}s`)
console.log(`  页面 is-not-a-function 错误: ${fin.errLine ? '❌ ' + fin.errLine : '✅ 无'}`)
console.log(`  JS 异常: ${errs.length ? '❌ ' + errs.slice(0, 2).join(' | ') : '✅ 无'}`)

const ok = fin.cards > 0 && !fin.errLine && errs.length === 0
console.log('')
console.log(ok ? '✅ 搜索正常' : '❌ 搜索异常')
ws.close()
process.exit(ok ? 0 : 1)
