#!/usr/bin/env node
// 打开页面并抓控制台/异常/失败请求（排查"页面不显示数据"）
//   node tools/cdp-console.mjs <url> [--port 9444] [--wait 9000]
const argv = process.argv.slice(2)
const url = argv[0] || 'http://192.168.2.200:3900/#/plugin/QQBot'
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const port = argOf('--port', '9444')
const wait = Number(argOf('--wait', '9000'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const logs = []
const netFail = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.consoleAPICalled') {
    const a = (m.params.args || []).map((x) => x.value ?? x.description ?? x.type).join(' ')
    logs.push(`[${m.params.type}] ` + String(a).slice(0, 400))
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails
    logs.push('[exception] ' + ((d && (d.text || (d.exception && d.exception.description))) || '?').slice(0, 400))
  } else if (m.method === 'Log.entryAdded') {
    const en = m.params.entry
    logs.push(`[log:${en.level}] ${en.text}`.slice(0, 400))
  } else if (m.method === 'Network.responseReceived') {
    const r = m.params.response
    if (r.status >= 400) netFail.push(`${r.status} ${r.url}`)
  } else if (m.method === 'Network.loadingFailed') {
    netFail.push(`FAIL ${m.params.errorText}`)
  }
}
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => pending.set(i, r))
}

await send('Runtime.enable'); await send('Log.enable')
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url })
await sleep(wait)

const r = await send('Runtime.evaluate', {
  expression: `(() => {
    const el = document.querySelector('.rcq')
    return {
      tab: (document.querySelector('.rcq-tab.on') || {}).innerText || '',
      txt: (el ? el.innerText : '').replace(/\\n+/g, ' | ').slice(0, 500),
      warn: [...document.querySelectorAll('.rcq-warn')].map(e => e.innerText.trim()).join(' / '),
    }
  })()`,
  returnByValue: true,
})
console.log('页签:', r.result?.result?.value?.tab)
console.log('文本:', r.result?.result?.value?.txt)
console.log('警告:', r.result?.result?.value?.warn || '(无)')
console.log('\n--- 控制台 ---')
logs.slice(-25).forEach((l) => console.log(l))
if (netFail.length) {
  console.log('\n--- 失败请求 ---')
  netFail.slice(-10).forEach((l) => console.log(l))
}
process.exit(0)
