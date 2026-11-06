#!/usr/bin/env node
// 截任意一个页签（默认概览），强制禁用缓存 —— 排查"改了前端但页面没变"。
//   node tools/shot-tab.mjs http://192.168.2.200:3900 --pw xxx --tab 概览 --out a.png
import fs from 'fs'

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const pw = argOf('--pw', '')
const tab = argOf('--tab', '概览')
const out = argOf('--out', 'tab.png')
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
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => pending.set(i, r))
}
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: base + '/' })
await sleep(2000)
if (await ev(`!!document.querySelector('.login-card')`)) {
  await ev(`(() => {
    const el = document.querySelector('.field-input') || document.querySelector('input[type=password]')
    if (!el) return false
    el.focus(); el.value = ${JSON.stringify(pw)}
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(400)
  await ev(`(() => {
    const btn = document.querySelector('.login-card button[type=submit]') || document.querySelector('.btn-primary')
    if (btn && !btn.disabled) btn.click()
  })()`)
  await sleep(2800)
}

await send('Page.navigate', { url: base + '/#/plugin/QQBot' })
await sleep(1500)
// ★ 必须强刷一次：面板给插件 JS 发的是 max-age=3600，
//   只改哈希不重新加载文档时，浏览器会用旧的那份（页面看着"没更新"）。
await send('Page.reload', { ignoreCache: true })
await sleep(4200)
// ★ 先退出「消息」整屏页（它是 fixed overlay，会把插件自己的页签盖掉，
//   页签点不到，截图就会停在旧画面）。
await ev(`(() => {
  if (document.querySelector('.rcq-im')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }
  return true
})()`)
await sleep(700)
await ev(`(() => {
  const el = [...document.querySelectorAll('.rcq-tab')].find(x => x.textContent.trim() === ${JSON.stringify(tab)})
  if (el) el.click(); return !!el
})()`)
await sleep(3000)

// 截图前可选再点一下（如打开某个会话）：--click "css选择器"
const clickSel = argOf('--click', '')
if (clickSel) {
  const ok = await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(clickSel)})
    if (el) el.click()
    return !!el
  })()`)
  console.log('点击', clickSel, ok)
}
// 按文字点（如 --click-text "QQ互通群"）
const clickText = argOf('--click-text', '')
if (clickText) {
  const ok = await ev(`(() => {
    const el = [...document.querySelectorAll('.rcq-csess,.rcq-item,.rcq-tab,button')]
      .find(x => x.innerText && x.innerText.indexOf(${JSON.stringify(clickText)}) >= 0)
    if (el) el.click()
    return !!el
  })()`)
  console.log('按文字点击', clickText, ok)
}
// 截图前可再跑一段 JS（--after "..."）：方便打开浮层/按钮态
const afterJs = argOf('--after', '')
if (afterJs) {
  const r5 = await ev(afterJs)
  console.log('after:', JSON.stringify(r5).slice(0, 900))
  await sleep(1200)
}
await sleep(argOf('--after-wait', '4000') * 1)

const info = await ev(`(() => {
  const root = document.querySelector('.rcq')
  return {
    txt: (root ? root.innerText : '(无 .rcq)').slice(0, 1200),
    warn: [...document.querySelectorAll('.rcq-warn')].map(e => e.innerText.trim()).join(' | '),
    t: Date.now(),
  }
})()`)
console.log('页签文本:\n' + (info?.txt || ''))
if (info?.warn) console.log('\n警告:', info.warn)
if (jsErrors.length) console.log('\nJS 异常:', jsErrors.slice(0, 3))

const r = await send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'))
console.log('\n截图:', out)
process.exit(0)
