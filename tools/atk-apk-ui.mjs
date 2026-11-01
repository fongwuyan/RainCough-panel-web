#!/usr/bin/env node
// atk 分析页大文件 UI 探针: 用 CDP 把本地 APK 塞进 file input, 看解析与渲染。
//
// 用法: node tools/atk-apk-ui.mjs http://192.168.2.200:3910 --port 9458 --pw 1 \
//        --apk E:/jiaob/apk/JMReader/RCReader-v0.1006-beta.apk --png-dir /tmp/shots
import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9458')
const pw = argOf('--pw', '')
const apk = argOf('--apk', '')
const pngDir = argOf('--png-dir', '')
if (pngDir) mkdirSync(pngDir, { recursive: true })
if (apk && !statSync(apk, { throwIfNoEntry: false })) { console.error('APK 不存在: ' + apk); process.exit(1) }

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
const shot = async (n) => {
  if (!pngDir) return
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(pngDir, n + '.png'), Buffer.from(r.result.data, 'base64'))
}

await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 980, deviceScaleFactor: 1, mobile: false })

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

await send('Page.navigate', { url: base + '/#/plugin/atk' }); await sleep(3000)
ok(await ev(`!!document.querySelector('.rcat-app')`), '插件已挂载')

// 切到分析
await ev(`(() => {
  const m = Array.from(document.querySelectorAll('.rcat-mod')).find(x => x.innerText.includes('分析'))
  if (m) m.click(); return !!m
})()`)
await sleep(1200)
const before = await ev(`(() => ({
  drop: !!document.querySelector('.rcat-drop'),
  text: (document.querySelector('.rcat-drop') || {}).innerText || '',
}))()`)
console.log('  上传区文案: ' + JSON.stringify((before.text || '').slice(0, 60)))
ok(before.drop, '分析页有上传区')
ok((before.text || '').includes('1GB'), '文案标注了 1GB 上限')

// 把文件塞进 input
if (apk) {
  const r = await send('Runtime.evaluate', { expression: `document.querySelector('.rcat-panel input[type=file]')` })
  const oid = r.result?.result?.objectId
  if (!oid) { console.error('找不到 file input'); process.exit(1) }
  await send('DOM.setFileInputFiles', { files: [apk], objectId: oid })
  console.log('  已选择: ' + apk)
  // 等解析: 大包分块上传会走进度条, 轮询直到出结果
  let parsed = false
  for (let i = 0; i < 120; i++) {
    await sleep(1000)
    const st = await ev(`(() => {
      const prog = document.querySelector('.rcat-panel .rcat-progress i')
      const kv = document.querySelector('.rcat-kv')
      return { prog: prog ? prog.style.width : '', kv: !!kv,
               hint: (document.querySelector('.rcat-hint') || {}).innerText || '' }
    })()`)
    if (i % 3 === 0 && st && st.prog) console.log('  进度 ' + st.prog)
    if (st && st.kv) { parsed = true; break }
  }
  ok(parsed, 'APK 解析完成')
  const res = await ev(`(() => {
    const kv = document.querySelector('.rcat-kv')
    const tabs = Array.from(document.querySelectorAll('.rcat-tab')).map(t => t.innerText.trim())
    return { kv: kv ? kv.innerText.replace(/\\n/g, ' | ') : '', tabs }
  })()`)
  console.log('  概览: ' + (res.kv || '').slice(0, 160))
  console.log('  页签: ' + JSON.stringify(res.tabs))
  ok((res.tabs || []).some((t) => t.startsWith('类')), '有「类」页签')
  ok((res.tabs || []).some((t) => t.startsWith('so')), '有「so」页签')
  await shot('01-apk-loaded')

  // 点 so 页签
  await ev(`(() => {
    const t = Array.from(document.querySelectorAll('.rcat-tab')).find(x => x.innerText.startsWith('so'))
    if (t) t.click(); return !!t
  })()`)
  await sleep(900)
  await shot('02-apk-libs')
}

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))
console.log('\n结果: ' + (fails.length ? fails.length + ' 项失败' : '全部通过'))
process.exit(fails.length ? 1 : 0)
