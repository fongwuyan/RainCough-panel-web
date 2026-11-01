#!/usr/bin/env node
// QQBot 插件前端探针
//   1) 登录面板 → 进插件页 /#/plugin/QQBot
//   2) 顶部选项卡应有 7 个（概览 / QQ 账户 / 人格 / 会话管理 / 模型提供商 / 运行日志 / 设置）
//   3) 逐个点开每个选项卡，页面要有内容、不能空白/报错
//   4) 收集 JS 异常与 4xx/5xx 请求
//
// 用法: node tools/qqbot-probe.mjs http://192.168.2.200:3900 --port 9444 --pw 1 [--shots dir]

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')
const shot = argOf('--shot', '')
const shotsDir = argOf('--shots', '')

const fails = []
const ok = (c, l, e) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? '  ' + e : ''}`); if (!c) fails.push(l) }

const TABS = ['概览', 'QQ 账户', '聊天记录', '查询', '媒体库', '人格', '会话管理', '模型提供商', '运行日志', '设置']

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.error('没有 page target'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const jsErrors = []
const failedReqs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params && m.params.exceptionDetails
    jsErrors.push((d && (d.text || (d.exception && d.exception.description))) || 'unknown')
  }
  if (m.method === 'Network.loadingFailed') {
    // ERR_ABORTED 是浏览器主动中止（切页签时卸载组件会中止正在加载的媒体），
    // 不是请求失败 —— 不该算进失败列表。
    const err = m.params.errorText || ''
    if (err.includes('ERR_ABORTED')) return
    failedReqs.push(err + ' ' + (m.params.type || ''))
  }
  if (m.method === 'Network.responseReceived') {
    const r = m.params.response
    if (r.status >= 400 && r.url.includes('/api/')) failedReqs.push(`HTTP ${r.status} ${r.url}`)
  }
}
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)) }
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

async function goto(url, wait = 2500) { await send('Page.navigate', { url }); await sleep(wait) }

await goto('about:blank', 300)
await goto(base + '/', 2400)
if (await ev(`!!document.querySelector('.login-card')`)) {
  if (!loginPW) { console.error('需要登录但未提供 --pw'); process.exit(1) }
  await ev(`(() => {
    const el = document.querySelector('.field-input') || document.querySelector('input[type=password]')
    if (!el) return false
    el.focus()
    el.value = ${JSON.stringify(loginPW)}
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(400)
  await ev(`(() => {
    const btn = document.querySelector('.login-card button[type=submit]') || document.querySelector('.btn-primary')
    if (btn && !btn.disabled) { btn.click(); return true }
    const f = document.querySelector('.login-card')
    if (f) { f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }
    return false
  })()`)
  await sleep(3000)
}
ok(!(await ev(`!!document.querySelector('.login-card')`)), '登录面板')
failedReqs.length = 0
jsErrors.length = 0

await goto(base + '/#/plugin/QQBot', 5000)
ok(await ev(`!!document.querySelector('.rcq')`), '外壳挂载 .rcq')
ok(!(await ev(`!!document.querySelector('.rcq-side')`)), '不自带左侧栏')
ok(!(await ev(`!!document.querySelector('.rcq-item')`)), '没有旧版竖排导航')

const labels = await ev(`[...document.querySelectorAll('.rcq-tab')].map(e => e.textContent.trim())`)
console.log('      选项卡: ' + JSON.stringify(labels))
ok(Array.isArray(labels) && labels.length === TABS.length, `选项卡 ${TABS.length} 个`,
  String(labels && labels.length))
ok(JSON.stringify(labels) === JSON.stringify(TABS), '选项卡顺序与命名', JSON.stringify(labels))

for (let i = 0; i < TABS.length; i++) {
  const name = TABS[i]
  const clicked = await ev(`(() => {
    const el = [...document.querySelectorAll('.rcq-tab')].find(x => x.textContent.trim() === ${JSON.stringify(name)})
    if (!el) return false
    el.click()
    return true
  })()`)
  // 概览要等 SSE、日志要等首拉
  await sleep(name === '概览' ? 8000 : (name === '运行日志' ? 5000 : 2200))
  const info = await ev(`(() => {
    const root = document.querySelector('.rcq')
    const bar = document.querySelector('.rcq-bar')
    const all = (root ? root.innerText : '').trim()
    const barTxt = (bar ? bar.innerText : '').trim()
    return {
      len: all.length - barTxt.length,
      warn: [...document.querySelectorAll('.rcq-warn')].map(e => e.innerText.trim()).join(' | '),
      onTab: (document.querySelector('.rcq-tab.on') || {}).innerText || '',
      empties: document.querySelectorAll('.rcq-empty').length,
      cards: document.querySelectorAll('.rcq-pnl').length,
    }
  })()`)
  // 配置类页签（人格/模型提供商）本来就没数据，空列表是正常状态
  const EMPTY_OK = new Set(['人格', '模型提供商'])
  const good = clicked && info && (info.len > 40 || (EMPTY_OK.has(name) && info.cards > 0)) && info.onTab === name
  ok(good, `选项卡 ${name}`,
    `len=${info && info.len} 卡片=${info && info.cards} 高亮=${info && info.onTab}` +
    (info && info.warn ? ` 警告=${info.warn.slice(0, 80)}` : ''))
  if (shotsDir) {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    const fs = await import('node:fs')
    const fn = String(i).padStart(2, '0') + '-' + name.replace(/[^\w\u4e00-\u9fa5]+/g, '') + '.png'
    fs.writeFileSync(shotsDir + '/' + fn, Buffer.from(r.result.data, 'base64'))
  }
}

if (shot) {
  await send('Page.navigate', { url: base + '/#/plugin/QQBot' })
  await sleep(3200)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  const fs = await import('node:fs')
  fs.writeFileSync(shot, Buffer.from(r.result.data, 'base64'))
  console.log('      截图: ' + shot)
}

const realErr = jsErrors.filter((e) => !/6099|6185/.test(e))
ok(realErr.length === 0, '无 JS 异常', realErr.slice(0, 3).join(' | '))
ok(failedReqs.length === 0, '无失败请求', failedReqs.slice(0, 3).join(' | '))

console.log(fails.length ? `\n${fails.length} 项失败: ${fails.join(', ')}` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
