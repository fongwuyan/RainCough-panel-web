#!/usr/bin/env node
// 鉴权 UI 冒烟探针:
//   1) 打开面板 → 应看到登录页(无侧栏、有密码框)
//   2) 未登录直接访问 #/fm → 应被守卫踢回 #/login
//   3) 输入密码提交 → 应进入工作台 #/
//   4) 刷新页面 → 应保持登录(不回登录页) —— 核心需求「永久保留登录状态」
//   5) 点「登出」→ 应回到登录页
//
// 用法: node tools/auth-probe.mjs http://192.168.2.200:3910/ [--port 9444] [--pw 1] [--out DIR]

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const password = argOf('--pw', '')
const outDir = argOf('--out', '')

if (outDir) mkdirSync(outDir, { recursive: true })
const shots = []
const fails = []
function ok(cond, label, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!cond) fails.push(label)
}

// --- 最小 CDP 客户端(无依赖) ---
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.error('没有可用的 page target'); process.exit(1) }

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const events = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  else if (m.method) events.push(m)
}
function send(method, params = {}) {
  const myId = ++id
  ws.send(JSON.stringify({ id: myId, method, params }))
  return new Promise((r) => pending.set(myId, r))
}
async function evalJS(expr, awaitPromise = true) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true })
  if (r.result && r.result.exceptionDetails) return { __err: r.result.exceptionDetails.text }
  return r.result && r.result.result ? r.result.result.value : undefined
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(name) {
  if (!outDir) return
  const r = await send('Page.captureScreenshot', { format: 'png' })
  if (r.result && r.result.data) {
    const p = join(outDir, name + '.png')
    writeFileSync(p, Buffer.from(r.result.data, 'base64'))
    shots.push(p)
    console.log('      截图: ' + p)
  }
}
async function goto(url) {
  await send('Page.navigate', { url })
  await sleep(1400)
}
async function reload() {
  await send('Page.reload', { ignoreCache: true })
  await sleep(1600)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

// 收集 JS 异常
const jsErrors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params && m.params.exceptionDetails
    jsErrors.push((d && (d.text || (d.exception && d.exception.description))) || 'unknown')
  }
})

// ---------- 1. 打开面板 -> 应看到登录页 ----------
await send('Page.navigate', { url: 'about:blank' })
await sleep(300)
await goto(base + '/')
await sleep(800)

const state1 = await evalJS(`(() => {
  const hash = location.hash || ''
  const card = document.querySelector('.login-card')
  const sidebar = document.querySelector('.sidebar')
  const input = document.querySelector('.field-input')
  return {
    hash,
    hasCard: !!card,
    hasSidebar: !!sidebar,
    hasInput: !!input,
    inputType: input ? input.type : '',
    title: (card && card.innerText || '').slice(0, 80),
  }
})()`)
ok(state1 && state1.hasCard, '未登录访问根路径 → 显示登录页', JSON.stringify(state1 && { hash: state1.hash }))
ok(state1 && !state1.hasSidebar, '登录页不渲染侧栏')
ok(state1 && state1.inputType === 'password', '密码框 type=password')
await shot('01-login')

// ---------- 2. 未登录访问 #/fm -> 应被踢回 #/login ----------
await goto(base + '/#/fm')
await sleep(700)
const state2 = await evalJS(`({ hash: location.hash, hasCard: !!document.querySelector('.login-card') })`)
ok(state2 && state2.hasCard, '未登录访问 #/fm → 仍停在登录页', JSON.stringify(state2))
ok(state2 && /#\/login/.test(state2.hash), '#/fm 被重定向到 #/login', state2 && state2.hash)

// ---------- 3. 输入密码登录 ----------
if (!password) {
  console.log('SKIP  未提供 --pw, 跳过登录流程')
} else {
  // 用原生 setter 触发 v-model
  await evalJS(`(() => {
    const el = document.querySelector('.field-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(password)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(200)
  await shot('02-login-filled')
  await evalJS(`(() => { document.querySelector('.btn-primary').click(); return true })()`)
  await sleep(2200)

  const state3 = await evalJS(`({
    hash: location.hash,
    hasCard: !!document.querySelector('.login-card'),
    hasSidebar: !!document.querySelector('.sidebar'),
    bodyLen: (document.body.innerText || '').length,
    err: (document.querySelector('.hint-err') || {}).innerText || '',
  })`)
  ok(state3 && !state3.hasCard, '输入密码后离开登录页', JSON.stringify(state3 && { hash: state3.hash, err: state3.err }))
  ok(state3 && state3.hasSidebar, '登录后渲染侧栏(进入面板)')
  await sleep(1200)
  await shot('03-workspace')

  // ---------- 4. 刷新保持登录 ----------
  await reload()
  await sleep(1200)
  const state4 = await evalJS(`({ hash: location.hash, hasCard: !!document.querySelector('.login-card'), hasSidebar: !!document.querySelector('.sidebar') })`)
  ok(state4 && !state4.hasCard && state4.hasSidebar, '刷新页面仍保持登录(不回登录页)', JSON.stringify(state4))
  await shot('04-after-reload')

  // ---------- 4b. cookie 属性 ----------
  const ck = await evalJS(`(async () => {
    // document.cookie 读不到 HttpOnly, 这里只验证它"不可被 JS 读取"
    return { visible: document.cookie || '(空, 说明 HttpOnly 生效)' }
  })()`)
  ok(!/rc_session/.test(ck && ck.visible), 'session cookie 为 HttpOnly(JS 读不到)', ck && ck.visible)

  // ---------- 5. 登出 ----------
  const hasLogout = await evalJS(`!!document.querySelector('.logout-btn')`)
  ok(hasLogout, '侧栏有登出按钮')
  if (hasLogout) {
    await evalJS(`(() => { document.querySelector('.logout-btn').click(); return true })()`)
    await sleep(1800)
    const state5 = await evalJS(`({ hash: location.hash, hasCard: !!document.querySelector('.login-card') })`)
    ok(state5 && state5.hasCard, '点登出 → 回到登录页', JSON.stringify(state5))
    await shot('05-after-logout')
  }
}

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
if (shots.length) console.log('截图: ' + shots.join(' '))
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
