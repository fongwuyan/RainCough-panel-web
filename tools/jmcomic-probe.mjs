#!/usr/bin/env node
// JMComic 插件前端探针
//   1) 登录面板 → 进插件详情页 /plugin/JMComic
//   2) 前端脚本应被加载并挂载（容器里有内容，不是空白）
//   3) 应能看到搜索框/列表等界面元素
//   4) 真实搜索一次，结果应渲染出来
//   5) 无 JS 异常
//
// 用法: node tools/jmcomic-probe.mjs http://192.168.2.200:3910/ --port 9444 --pw 1 [--shot out.png]

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')
const shot = argOf('--shot', '')

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
const failedReqs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params && m.params.exceptionDetails
    jsErrors.push((d && (d.text || (d.exception && d.exception.description))) || 'unknown')
  }
  if (m.method === 'Network.loadingFailed') {
    failedReqs.push(m.params.errorText + ' ' + (m.params.type || ''))
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

async function goto(url, wait = 2500) { await send('Page.navigate', { url }); await sleep(wait) }

// 登录
await goto('about:blank', 300)
await goto(base + '/', 2400)
if (await ev(`!!document.querySelector('.login-card')`)) {
  if (!loginPW) { console.error('需要登录但未提供 --pw'); process.exit(1) }
  await ev(`(() => {
    const el = document.querySelector('.field-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(loginPW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(250)
  await ev(`(() => { document.querySelector('.btn-primary').click(); return true })()`)
  await sleep(2500)
}
ok(await ev(`!document.querySelector('.login-card') && !!document.querySelector('.sidebar')`), '面板登录成功')

// 进插件详情
await goto(base + '/#/plugin/JMComic', 3500)

const st = await ev(`(() => {
  const main = document.querySelector('.page') || document.body
  const txt = (main.innerText || '').trim()
  return {
    hash: location.hash,
    textLen: txt.length,
    preview: txt.slice(0, 200),
    hasScript: !!document.querySelector('script[src*="/api/plugins/JMComic/assets/plugin.js"]'),
    inputs: document.querySelectorAll('input').length,
    buttons: document.querySelectorAll('button').length,
    imgs: document.querySelectorAll('img').length,
    hasEmptyHint: /暂无|空|加载/.test(txt),
    mounted: !!document.querySelector('.plugin-mount'),
    mode: document.querySelector('.plugin-mount') ? 'plugin' : 'generic',
  }
})()`)
console.log('  页面状态: ' + JSON.stringify({ textLen: st && st.textLen, inputs: st && st.inputs, buttons: st && st.buttons, imgs: st && st.imgs }))
if (st && st.preview) console.log('  首屏文本: ' + JSON.stringify(st.preview.slice(0, 120)))

ok(st && st.textLen > 10, '插件页有内容(不是空白)', `${st && st.textLen} 字符`)
ok(st && st.mounted, '插件前端已挂载(不是兜底信息卡)', `mode=${st && st.mode}`)
ok(st && st.inputs > 0 || (st && st.buttons > 2), '渲染出交互元素', `inputs=${st && st.inputs} buttons=${st && st.buttons}`)

// 在【插件挂载区】里搜索 —— 侧栏也有个 "搜索: 页面/插件…" 的输入框, 全局选会选错
const searchInput = await ev(`(() => {
  const root = document.querySelector('.plugin-mount')
  if (!root) return null
  const ins = Array.from(root.querySelectorAll('input'))
  const hit = ins.find(i => /关键词|搜索|search/i.test(i.placeholder || '')) || ins[0]
  if (!hit) return null
  return { placeholder: hit.placeholder || '', type: hit.type }
})()`)
console.log('  插件搜索框: ' + JSON.stringify(searchInput))

if (searchInput) {
  await ev(`(() => {
    const root = document.querySelector('.plugin-mount')
    const hit = root.querySelector('input[placeholder*="关键词"]') ||
                Array.from(root.querySelectorAll('input'))[0]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(hit, 'test')
    hit.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  // 该插件是"输入即自动搜索"(防抖) + 封面分批懒加载, 要给足时间
  await sleep(9000)

  const after = await ev(`(() => {
    const root = document.querySelector('.plugin-mount')
    const txt = (root && root.innerText) || ''
    return {
      textLen: txt.length,
      imgCount: root ? root.querySelectorAll('img').length : 0,
      hasResult: /条结果|TURING|TEST/.test(txt),
      snippet: txt.slice(0, 160),
    }
  })()`)
  console.log('  搜索后: ' + JSON.stringify({ textLen: after && after.textLen, imgs: after && after.imgCount }))
  ok(after && after.hasResult, '搜索返回结果', after && JSON.stringify(after.snippet))
  ok(after && after.imgCount > 0, '搜索结果渲染出封面图', `imgs=${after && after.imgCount}`)
}

if (shot) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  if (r.result && r.result.data) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(shot, Buffer.from(r.result.data, 'base64'))
    console.log('  截图已保存: ' + shot)
  }
}

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))
// 401 只允许出现在登录前的首屏请求上; 登录后任何 401 都是问题
const badApi = failedReqs.filter((x) => x.includes('/api/') && !x.startsWith('HTTP 401'))
ok(badApi.length === 0, '无失败的 API 请求', badApi.slice(0, 3).join(' | '))

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
