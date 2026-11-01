#!/usr/bin/env node
// atk 验证队列 UI 探针: 登录 → 打开插件页 → 检测页勾选 → 送验证 → 队列页截图
//
// 用法: node tools/atk-vq-ui.mjs http://192.168.2.200:3910 --port 9455 --pw 1 --png-dir /tmp/atk-ui
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9455')
const pw = argOf('--pw', '')
const pngDir = argOf('--png-dir', '')
if (pngDir) mkdirSync(pngDir, { recursive: true })

const fails = []
const ok = (c, l, e) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? '  ' + e : ''}`); if (!c) fails.push(l) }

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
const send = (m, pa = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: pa })); return new Promise((r) => pending.set(i, r)) }
const ev = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })
  if (r.result && r.result.exceptionDetails) return { __err: r.result.exceptionDetails.text }
  return r.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (name) => {
  if (!pngDir) return
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(pngDir, name + '.png'), Buffer.from(r.result.data, 'base64'))
}

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 980, deviceScaleFactor: 1, mobile: false })

// ── 登录
await send('Page.navigate', { url: base + '/' }); await sleep(2400)
if (await ev(`!!document.querySelector('.login-card')`)) {
  if (!pw) { console.error('需要登录但未给 --pw'); process.exit(1) }
  await ev(`(() => {
    const el = document.querySelector('.field-input')
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, ${JSON.stringify(pw)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(250)
  await ev(`document.querySelector('.btn-primary').click()`)
  await sleep(2400)
}
ok(await ev(`!document.querySelector('.login-card')`), '登录成功')

// ── 打开插件页
await send('Page.navigate', { url: base + '/#/plugin/atk' }); await sleep(3200)
const hasApp = await ev(`!!document.querySelector('.rcat-app')`)
ok(hasApp, '插件已挂载 (.rcat-app)')
if (!hasApp) {
  console.log('页面文本: ' + JSON.stringify(String(await ev(`document.body.innerText.slice(0,400)`))))
  process.exit(1)
}

// ── 选任务（有风险的那个）
const picked = await ev(`(() => {
  const el = document.querySelector('.rcat-task')
  if (!el) return { err: 'no task chip' }
  el.click()
  return { text: el.innerText }
})()`)
console.log('  当前任务: ' + JSON.stringify(picked))
await sleep(1500)

// ── 切到检测
await ev(`(() => {
  const m = Array.from(document.querySelectorAll('.rcat-mod')).find(x => x.innerText.includes('检测'))
  if (m) m.click(); return !!m
})()`)
await sleep(1600)
const det = await ev(`(() => {
  const chks = document.querySelectorAll('.rcat-tbl tbody .rcat-chk input')
  return { rows: document.querySelectorAll('.rcat-tbl tbody tr').length, chks: chks.length,
           hasSend: !!Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('送验证')) }
})()`)
ok(det && det.hasSend, '检测页有「送验证」按钮', JSON.stringify(det))
ok(det && det.chks > 0, '检测页有勾选列', 'checkbox ' + (det && det.chks))
await shot('01-detect')

// ── 全选 + 送验证
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.trim() === '全选')
  if (b) b.click(); return !!b
})()`)
await sleep(400)
const sel = await ev(`document.querySelectorAll('.rcat-tbl tbody .rcat-chk input:checked').length`)
ok(sel > 0, '全选生效', sel + ' 条')
await shot('02-picked')

await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('送验证'))
  if (b) b.click(); return !!b
})()`)
await sleep(2200)

// ── 验证页队列
const q = await ev(`(() => {
  const tabs = Array.from(document.querySelectorAll('.rcat-tab')).map(t => t.innerText.trim())
  const rows = document.querySelectorAll('.rcat-tbl tbody tr').length
  const btns = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim())
  return { tabs, rows, hasRun: btns.includes('开始执行') }
})()`)
console.log('  验证页: ' + JSON.stringify(q))
ok(q && q.hasRun, '验证页有「开始执行」按钮')
ok(q && q.rows > 0, '队列列表有条目', (q && q.rows) + ' 行')
await shot('03-queue')

// ── 执行
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.trim() === '开始执行')
  if (b) b.click(); return !!b
})()`)
await sleep(4000)
const after = await ev(`(() => {
  const stats = Array.from(document.querySelectorAll('.rcat-stat')).map(s => s.innerText.replace(/\\n/g, '='))
  const verdicts = Array.from(document.querySelectorAll('.rcat-tbl tbody .rcat-badge')).map(b => b.innerText.trim())
  return { stats, verdicts: verdicts.slice(0, 8) }
})()`)
console.log('  执行后: ' + JSON.stringify(after))
ok(after && after.verdicts.some(v => ['确认', '疑似', '未命中', '需人工'].includes(v)), '出现判定结果', JSON.stringify(after && after.verdicts))
await shot('04-done')

// ── 展开详情
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.trim() === '详情')
  if (b) b.click(); return !!b
})()`)
await sleep(700)
const snip = await ev(`!!document.querySelector('.rcat-vq-snip')`)
ok(snip, '详情能展开响应片段')
await shot('05-detail')

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))
console.log('\n结果: ' + (fails.length ? fails.length + ' 项失败' : '全部通过'))
process.exit(fails.length ? 1 : 0)
