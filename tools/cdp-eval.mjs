#!/usr/bin/env node
// 在已登录的面板页里跑一段 JS（调试用）：
//   node tools/cdp-eval.mjs "<expression>" [--port 9444]
const argv = process.argv.slice(2)
const expr = argv[0] || '1'
const port = (argv.indexOf('--port') >= 0 && argv[argv.indexOf('--port') + 1]) || '9444'

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.error('没有 page target'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => pending.set(i, r))
}
await send('Runtime.enable')
const r = await send('Runtime.evaluate', {
  expression: expr, returnByValue: true, awaitPromise: true, timeout: 60000,
})
const res = r.result?.result
console.log(JSON.stringify(res?.value !== undefined ? res.value : res, null, 1))
process.exit(0)
