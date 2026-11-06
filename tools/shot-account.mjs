#!/usr/bin/env node
// 截图：QQ 账户页（可选点扫码登录，看 SnowLuma 的 iframe 远程桌面）
import fs from 'fs'

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const pw = argOf('--pw', '')
const out = argOf('--out', 'account.png')
const clickScan = argv.includes('--scan')
const waitMs = Number(argOf('--wait', '8000'))
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
async function goto(url, wait = 2500) { await send('Page.navigate', { url }); await sleep(wait) }
async function shot(f) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
  console.log('截图:', f)
}

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
await goto('about:blank', 300)
await goto(base + '/', 2200)

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
    if (btn && !btn.disabled) { btn.click(); return true }
    const f = document.querySelector('.login-card')
    if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    return false
  })()`)
  await sleep(2800)
}

await goto(base + '/#/plugin/QQBot', 4500)
await ev(`(() => {
  const el = [...document.querySelectorAll('.rcq-tab')].find(x => x.textContent.trim() === 'QQ 账户')
  if (el) el.click(); return !!el
})()`)
await sleep(2200)

console.log('账户卡:', ((await ev(`(document.querySelector('.rcq-acct')||{}).innerText||'(无)'`)) || '').replace(/\n/g, ' | '))
console.log('框架下拉:', await ev(`(document.querySelector('.rcq-ph select')||{}).value || '(无)'`))

if (clickScan) {
  const ok = await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /扫码登录|重新登录/.test(x.textContent))
    if (b) { b.click(); return true }
    return false
  })()`)
  console.log('点扫码登录:', ok)
  await sleep(waitMs)
}

const info = await ev(`(() => {
  const f = document.querySelector('iframe.rcq-vnc')
  return {
    hasIframe: !!f,
    src: f ? (f.getAttribute('src') || '').slice(0, 120) : '',
    w: f ? f.clientWidth : 0,
    h: f ? f.clientHeight : 0,
    scan: ((document.querySelector('.rcq-scan') || {}).innerText || '').replace(/\\n/g, ' | ').slice(0, 260),
  }
})()`)
console.log('iframe:', JSON.stringify({ has: info?.hasIframe, w: info?.w, h: info?.h }))
if (info?.src) console.log('src:', info.src)
if (info?.scan) console.log('扫码区:', info.scan)
if (jsErrors.length) console.log('JS 异常:', jsErrors.slice(0, 3))

await shot(out)
process.exit(0)
