#!/usr/bin/env node
// 验「分类/标签筛选芯片」：点芯片 → 结果真的换了。
//
// 用法: node tools/jm-chip-probe.mjs http://192.168.2.200:3910/ --port 9444 --pw 1

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3910/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')

const fails = []
const ok = (c, l, e) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? '  ' + e : ''}`); if (!c) fails.push(l) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.error('没有 page target'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const jsErrors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params && m.params.exceptionDetails
    jsErrors.push((d && (d.text || (d.exception && d.exception.description))) || 'unknown')
  }
}
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)) }
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
const goto = async (url, wait = 2000) => { await send('Page.navigate', { url }); await sleep(wait) }

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

await goto('about:blank', 300)
await goto(base + '/', 2400)
// 等页面进入"登录卡"或"已登录"其中一种，别硬等固定时间
for (let i = 0; i < 20; i++) {
  const s = await ev(`(() => ({ login: !!document.querySelector('.login-card'), side: !!document.querySelector('.sidebar') }))()`)
  if (s && (s.login || s.side)) break
  await sleep(400)
}
for (let attempt = 0; attempt < 3; attempt++) {
  if (!(await ev(`!!document.querySelector('.login-card')`))) break
  await ev(`(() => {
    const el = document.querySelector('.login-card .field-input')
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(loginPW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(300)
  await ev(`(() => {
    const b = document.querySelector('.login-card .btn-primary')
    if (!b) return false
    b.click()
    return true
  })()`)
  for (let i = 0; i < 12; i++) {
    await sleep(400)
    if (!(await ev(`!!document.querySelector('.login-card')`))) break
  }
}
ok(await ev(`!document.querySelector('.login-card')`), '面板登录成功')

await goto(base + '/#/plugin/JMComic', 3500)

const chips = await ev(`(() => {
  const root = document.querySelector('.plugin-mount')
  if (!root) return null
  return Array.from(root.querySelectorAll('.rcjm-chip')).map((c) => c.textContent.trim())
})()`)
console.log('  芯片: ' + JSON.stringify(chips))
ok(Array.isArray(chips) && chips.length >= 8, '筛选芯片已渲染', chips && chips.length)

// 读当前结果：条数文案 + 前两个标题
const readState = () => ev(`(() => {
  const root = document.querySelector('.plugin-mount')
  if (!root) return null
  const txt = (root.innerText || '')
  const m = txt.match(/(\\d+)\\s*条结果/)
  const cards = Array.from(root.querySelectorAll('.rcjm-card')).slice(0, 3)
    .map((c) => (c.innerText || '').split('\\n')[0].slice(0, 24))
  return { total: m ? m[1] : null, cards, text: txt.slice(0, 60) }
})()`)

const clickChip = async (label) => {
  const r = await ev(`(() => {
    const root = document.querySelector('.plugin-mount')
    if (!root) return false
    const c = Array.from(root.querySelectorAll('.rcjm-chip')).find((x) => x.textContent.trim() === ${JSON.stringify(label)})
    if (!c) return false
    c.click()
    return true
  })()`)
  await sleep(3200)
  return r
}

const cases = [
  ['真人', 'tag'],
  ['女性向', 'tag'],
  ['韩漫', 'cat'],
  ['同人', 'cat'],
]
const seen = {}
for (const [label, kind] of cases) {
  const clicked = await clickChip(label)
  ok(clicked, `点到「${label}」芯片`)
  if (!clicked) continue
  const st = await readState()
  console.log(`  「${label}」→ total=${st && st.total}  前几条=${JSON.stringify(st && st.cards)}`)
  ok(st && Number(st.total) > 0, `「${label}」有结果`, st && st.total)
  seen[label] = st && st.cards.join('|')
}

// 不同分类/标签的前几条不该完全一样
const keys = Object.keys(seen)
const uniq = new Set(keys.map((k) => seen[k]))
ok(uniq.size >= 2, '不同筛选的结果确实不同', `${uniq.size}/${keys.length} 种`)

// 回「全部」+ 输关键词，确认关键词搜索没坏
await clickChip('全部')
const typed = await ev(`(() => {
  const root = document.querySelector('.plugin-mount')
  const ins = Array.from(root.querySelectorAll('input'))
  const hit = ins.find(i => /关键词|搜索|标签/.test(i.placeholder || '')) || ins[0]
  if (!hit) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(hit, '鬼畜')
  hit.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`)
await sleep(3200)
const kwState = await readState()
console.log('  关键词「鬼畜」→ total=' + (kwState && kwState.total))
ok(typed && kwState && Number(kwState.total) > 0, '关键词搜索仍然可用', kwState && kwState.total)

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 2).join(' | '))
console.log('')
console.log(fails.length ? '失败: ' + fails.join(' / ') : '全部通过')
process.exit(fails.length ? 1 : 0)
