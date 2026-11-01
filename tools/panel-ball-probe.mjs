#!/usr/bin/env node
// 面板 1.0.0-beta.2：侧栏收起 + 悬浮球 探针
// 用法: node tools/panel-ball-probe.mjs http://192.168.2.200:3910/ --port 9444 --pw 1
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
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0; const pending = new Map(); const jsErrors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params && m.params.exceptionDetails
    jsErrors.push((d && (d.text || (d.exception && d.exception.description))) || 'unknown')
  }
}
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)) }
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: base + '/' }); await sleep(2400)
for (let i = 0; i < 20; i++) {
  const s = await ev(`(() => ({ login: !!document.querySelector('.login-card'), side: !!document.querySelector('.sidebar') }))()`)
  if (s && (s.login || s.side)) break
  await sleep(400)
}
for (let a = 0; a < 3; a++) {
  if (!(await ev(`!!document.querySelector('.login-card')`))) break
  await ev(`(() => {
    const el = document.querySelector('.login-card .field-input'); if (!el) return false
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(el, ${JSON.stringify(loginPW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(300)
  await ev(`(() => { const b = document.querySelector('.login-card .btn-primary'); if (b) b.click(); return true })()`)
  for (let i = 0; i < 12; i++) { await sleep(400); if (!(await ev(`!!document.querySelector('.login-card')`))) break }
}
ok(await ev(`!document.querySelector('.login-card')`), '登录成功')
await sleep(1200)

ok(await ev(`!!document.querySelector('.sidebar')`), '默认显示侧栏')
ok(await ev(`!!document.querySelector('.rc-ball')`), '悬浮球存在')
ok(await ev(`document.body.innerText.includes('1.0.0-beta.2')`), '版本号 1.0.0-beta.2')

// 点球 → 侧栏收起
await ev(`(() => { const b = document.querySelector('.rc-ball'); const r = b.getBoundingClientRect();
  const opt = { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 1, button: 0 }
  b.dispatchEvent(new PointerEvent('pointerdown', opt)); b.dispatchEvent(new PointerEvent('pointerup', opt)); return true })()`)
await sleep(500)
ok(await ev(`!document.querySelector('.sidebar')`), '点球后侧栏收起')

// 再点 → 展开
await ev(`(() => { const b = document.querySelector('.rc-ball'); const r = b.getBoundingClientRect();
  const opt = { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 2, button: 0 }
  b.dispatchEvent(new PointerEvent('pointerdown', opt)); b.dispatchEvent(new PointerEvent('pointerup', opt)); return true })()`)
await sleep(500)
ok(await ev(`!!document.querySelector('.sidebar')`), '再点球侧栏展开')

// 侧栏 ≡ 按钮
await ev(`(() => { const b = Array.from(document.querySelectorAll('.sidebar .upd-btn')).find(x => x.textContent.trim() === '≡'); if (b) b.click(); return !!b })()`)
await sleep(500)
ok(await ev(`!document.querySelector('.sidebar')`), '侧栏 ≡ 按钮可收起')
await ev(`(() => { const b = document.querySelector('.rc-ball'); const r = b.getBoundingClientRect();
  const opt = { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 3, button: 0 }
  b.dispatchEvent(new PointerEvent('pointerdown', opt)); b.dispatchEvent(new PointerEvent('pointerup', opt)); return true })()`)
await sleep(400)

// 右键菜单 + 换白底
await ev(`(() => { const b = document.querySelector('.rc-ball'); b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); return true })()`)
await sleep(300)
ok(await ev(`!!document.querySelector('.rc-ball-menu')`), '右键打开外观菜单')
const toneBefore = await ev(`getComputedStyle(document.querySelector('.rc-ball')).backgroundColor`)
await ev(`(() => { const b = Array.from(document.querySelectorAll('.rc-ball-menu button')).find(x => x.textContent.trim() === '白'); if (b) b.click(); return !!b })()`)
await sleep(300)
const toneAfter = await ev(`getComputedStyle(document.querySelector('.rc-ball')).backgroundColor`)
ok(toneBefore !== toneAfter && toneAfter.includes('255'), '切白底生效', toneBefore + ' → ' + toneAfter)

// 拖动后位置落库
await ev(`(() => { const b = document.querySelector('.rc-ball'); const r = b.getBoundingClientRect();
  const d = { bubbles: true, pointerId: 4, button: 0 }
  b.dispatchEvent(new PointerEvent('pointerdown', { ...d, clientX: r.left + 20, clientY: r.top + 20 }))
  b.dispatchEvent(new PointerEvent('pointermove', { ...d, clientX: r.left - 180, clientY: r.top - 120 }))
  b.dispatchEvent(new PointerEvent('pointerup', { ...d, clientX: r.left - 180, clientY: r.top - 120 }))
  return true })()`)
await sleep(400)
const saved = await ev(`localStorage.getItem('rc_ball')`)
ok(!!saved && JSON.parse(saved).x != null, '拖动后坐标已保存', saved)

// 带图片图标时仍能拖动（防"拖出图片"回归）
await ev(`(() => {
  const b = JSON.parse(localStorage.getItem('rc_ball') || '{}')
  b.icon = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#e11"/><circle cx="20" cy="20" r="12" fill="#fff"/></svg>')
  localStorage.setItem('rc_ball', JSON.stringify(b)); return true })()`)
await send('Page.navigate', { url: base + '/' }); await sleep(2200)
const hasImg = await ev(`!!document.querySelector('.rc-ball img')`)
ok(hasImg, '图标已渲染为 img')
const before = await ev(`(() => { const r = document.querySelector('.rc-ball').getBoundingClientRect(); return { x: r.left, y: r.top } })()`)
await ev(`(() => { const b = document.querySelector('.rc-ball'); const r = b.getBoundingClientRect()
  const d = { bubbles: true, pointerId: 9, button: 0 }
  b.dispatchEvent(new PointerEvent('pointerdown', { ...d, clientX: r.left + 20, clientY: r.top + 20 }))
  b.dispatchEvent(new PointerEvent('pointermove', { ...d, clientX: r.left + 120, clientY: r.top + 60 }))
  b.dispatchEvent(new PointerEvent('pointerup', { ...d, clientX: r.left + 120, clientY: r.top + 60 }))
  return true })()`)
await sleep(400)
const after = await ev(`(() => { const r = document.querySelector('.rc-ball').getBoundingClientRect(); return { x: r.left, y: r.top } })()`)
ok(Math.abs(after.x - before.x) > 50, '带图标的球仍可拖动', JSON.stringify(before) + ' → ' + JSON.stringify(after))
const imgNoDrag = await ev(`(() => { const i = document.querySelector('.rc-ball img'); if (!i) return null
  return { draggable: i.getAttribute('draggable'), pe: getComputedStyle(i).pointerEvents } })()`)
ok(imgNoDrag && imgNoDrag.draggable === 'false' && imgNoDrag.pe === 'none', '图标不接管指针事件', JSON.stringify(imgNoDrag))

// 菜单跟着球走
await ev(`(() => { const b = document.querySelector('.rc-ball'); b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); return true })()`)
await sleep(350)
const near = await ev(`(() => {
  const b = document.querySelector('.rc-ball').getBoundingClientRect()
  const m = document.querySelector('.rc-ball-menu')
  if (!m) return null
  const r = m.getBoundingClientRect()
  const dx = Math.max(b.left - r.right, r.left - b.right, 0)
  const dy = Math.max(b.top - r.bottom, r.top - b.bottom, 0)
  return { dx: Math.round(dx), dy: Math.round(dy) }
})()`)
ok(near && near.dx <= 24 && near.dy <= 24, '右键菜单贴着球', JSON.stringify(near))
await ev(`(() => { const b = document.querySelector('.rc-ball'); b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); return true })()`)
await sleep(200)

// 设置页布局开关
await send('Page.navigate', { url: base + '/#/settings' }); await sleep(1800)
ok(await ev(`document.body.innerText.includes('显示悬浮球') && document.body.innerText.includes('显示侧栏')`), '设置页有布局开关')

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 2).join(' | '))
console.log(fails.length ? `\n${fails.length} 项失败: ${fails.join(', ')}` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
