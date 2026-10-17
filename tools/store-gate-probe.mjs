#!/usr/bin/env node
// 插件库口令闸门 UI 探针
//   1) 登录面板 → 进「插件」页 → 切「插件市场」→ 应看到上锁面板(无插件列表)
//   2) 输错口令 → 应显示错误且仍锁定
//   3) 输对口令 → 应解锁并出现清单(或空态), 上锁面板消失
//   4) 刷新页面 → 应保持解锁(cookie)
//   5) 点「重新上锁」→ 回到上锁面板
//
// 用法: node tools/store-gate-probe.mjs http://192.168.2.200:3910/ --port 9444 --pw 1 --gate REDACTED-GATE-PW

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')
const gatePW = argOf('--gate', '')

const fails = []
const ok = (c, l, e) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? '  ' + e : ''}`); if (!c) fails.push(l) }

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const jsErrors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params && m.params.exceptionDetails
    jsErrors.push((d && (d.text || (d.exception && d.exception.description))) || 'unknown')
  }
}
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)) }
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable'); await send('Runtime.enable')
await send('Network.enable')
await send('Network.clearBrowserCookies')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

async function goto(url, wait = 1800) {
  await send('Page.navigate', { url })
  await sleep(wait)
}

// ---- 登录 ----
// ★ 填完必须等一帧再点: 登录按钮是 :disabled="!pw", 同一 tick 内填+点会点到 disabled 按钮上,
//   表现为"点了没反应"(auth-probe.mjs 里也有同样的坑, 那边多了一次 sleep)
await goto('about:blank', 300)
await goto(base + '/', 2200)
if (loginPW) {
  const filled = await ev(`(() => {
    const el = document.querySelector('.field-input')
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(loginPW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  ok(filled, '找到登录密码框')
  await sleep(250)
  await ev(`(() => { document.querySelector('.btn-primary').click(); return true })()`)
  await sleep(2400)
}
const loggedIn = await ev(`!document.querySelector('.login-card') && !!document.querySelector('.sidebar')`)
ok(loggedIn, '面板登录成功')

// ---- 进插件页 → 市场页签 ----
await goto(base + '/#/plugins', 2000)
const tabs = await ev(`Array.from(document.querySelectorAll('.ph-tab')).map(t => t.innerText.trim())`)
ok(Array.isArray(tabs) && tabs.length >= 2, '插件页有两个页签', JSON.stringify(tabs))

// 点第二个页签(插件市场)
await ev(`(() => {
  const t = Array.from(document.querySelectorAll('.ph-tab')).find(x => x.innerText.includes('市场'))
  if (t) { t.click(); return true }
  return false
})()`)
await sleep(1600)

const s1 = await ev(`({
  hasGate: !!document.querySelector('.ph-gate'),
  gateTitle: (document.querySelector('.ph-gate-title') || {}).innerText || '',
  hasInput: !!document.querySelector('.ph-gate-input'),
  inputType: (document.querySelector('.ph-gate-input') || {}).type || '',
  hasList: !!document.querySelector('.ph-list'),
  rowCount: document.querySelectorAll('.ph-row').length,
  relayVisible: !!document.querySelector('.ph-relock'),
})`)
ok(s1 && s1.hasGate, '未解锁时显示上锁面板', JSON.stringify(s1 && { title: s1.gateTitle }))
ok(s1 && s1.inputType === 'password', '口令框 type=password')
ok(s1 && !s1.hasList, '未解锁时不渲染插件列表')
ok(s1 && !s1.relayVisible, '未解锁时不显示「重新上锁」')

// ---- 输错口令 ----
await ev(`(() => {
  const el = document.querySelector('.ph-gate-input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, 'definitely-wrong')
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`)
await sleep(150)
await ev(`(() => { document.querySelector('.ph-gate-form button').click(); return true })()`)
await sleep(1600)
const s2 = await ev(`({
  hasGate: !!document.querySelector('.ph-gate'),
  err: (document.querySelector('.ph-gate-err') || {}).innerText || '',
  inputValue: (document.querySelector('.ph-gate-input') || {}).value || '',
})`)
ok(s2 && s2.hasGate, '错口令后仍锁定')
ok(s2 && s2.err.length > 0, '错口令显示错误提示', s2 && s2.err)
ok(s2 && s2.inputValue === '', '错口令后清空输入框')

// ---- 输对口令 ----
ok(!!gatePW, '提供了 --gate 参数')
if (gatePW) {
  await ev(`(() => {
    const el = document.querySelector('.ph-gate-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(gatePW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(150)
  await ev(`(() => { document.querySelector('.ph-gate-form button').click(); return true })()`)
  await sleep(2200)
  const s3 = await ev(`({
    hasGate: !!document.querySelector('.ph-gate'),
    hasList: !!document.querySelector('.ph-list'),
    hasEmpty: !!document.querySelector('.ph-empty'),
    hasErr: !!document.querySelector('.error'),
    errText: (document.querySelector('.error') || {}).innerText || '',
    relayVisible: !!document.querySelector('.ph-relock'),
    source: (document.querySelector('.ph-source') || {}).innerText || '',
  })`)
  ok(s3 && !s3.hasGate, '正确口令后上锁面板消失', JSON.stringify(s3 && { err: s3.errText }))
  ok(s3 && (s3.hasList || s3.hasEmpty || s3.hasErr), '解锁后进入正常清单视图')
  ok(s3 && s3.relayVisible, '解锁后显示「重新上锁」按钮')

  // ---- 刷新保持解锁 ----
  await send('Page.reload', { ignoreCache: true })
  await sleep(2400)
  const s4 = await ev(`({
    hasGate: !!document.querySelector('.ph-gate'),
    hasSidebar: !!document.querySelector('.sidebar'),
    hash: location.hash,
  })`)
  // 刷新后回到默认页签(已安装), 需要再点市场
  await ev(`(() => {
    const t = Array.from(document.querySelectorAll('.ph-tab')).find(x => x.innerText.includes('市场'))
    if (t) { t.click(); return true }
    return false
  })()`)
  await sleep(1500)
  const s5 = await ev(`({ hasGate: !!document.querySelector('.ph-gate'), hasSidebar: !!document.querySelector('.sidebar') })`)
  ok(s5 && !s5.hasGate, '刷新后仍保持解锁(cookie 生效)')

  // ---- 重新上锁 ----
  const hasRelock = await ev(`!!document.querySelector('.ph-relock')`)
  if (hasRelock) {
    await ev(`(() => { document.querySelector('.ph-relock').click(); return true })()`)
    await sleep(1500)
    const s6 = await ev(`({ hasGate: !!document.querySelector('.ph-gate'), rowCount: document.querySelectorAll('.ph-row').length })`)
    ok(s6 && s6.hasGate, '点「重新上锁」回到上锁面板')
  } else {
    ok(false, '找不到「重新上锁」按钮')
  }
}

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
