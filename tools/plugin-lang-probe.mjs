#!/usr/bin/env node
// 插件语言标签探针
//
// 守住一条历史 bug: 前端曾硬编码 `lang !== 'go' → 不兼容 v6`,
// 而后端早已支持 py/php/java/node, 导致 JMComic(Python) 明明能跑却被标红。
//
// 检查:
//   1) /api/plugins/runtime 可用, 语言列表含 python/php/java/node
//   2) 插件页「已安装」里 JMComic 不出现"不兼容/语言不受支持"
//   3) 语言标签显示 python
//   4) 市场页签同样不误标
//
// 用法: node tools/plugin-lang-probe.mjs http://192.168.2.200:3910/ --port 9444 --pw 1 --gate <口令>

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
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
const goto = async (u, w = 2400) => { await send('Page.navigate', { url: u }); await sleep(w) }

// 登录
await goto('about:blank', 300)
await goto(base + '/', 2400)
if (await ev(`!!document.querySelector('.login-card')`)) {
  if (!loginPW) { console.error('需要登录但未提供 --pw'); process.exit(1) }
  await ev(`(() => {
    const el = document.querySelector('.field-input')
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, ${JSON.stringify(loginPW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(250)
  await ev(`(() => { document.querySelector('.btn-primary').click(); return true })()`)
  await sleep(2500)
}
ok(await ev(`!document.querySelector('.login-card') && !!document.querySelector('.sidebar')`), '面板登录成功')

// 1) 运行时接口
const rt = await ev(`fetch('/api/plugins/runtime', {credentials:'same-origin'}).then(r=>r.json()).catch(e=>({err:String(e)}))`)
ok(rt && Array.isArray(rt.languages), '运行时能力接口可用', JSON.stringify(rt && rt.languages))
for (const lang of ['python', 'php', 'java', 'node']) {
  ok(rt && rt.languages.includes(lang), `运行时声明支持 ${lang}`)
}
ok(rt && Array.isArray(rt.details) && rt.details.length > 0, '运行时带每种语言的详情')
const pyDetail = rt && (rt.details || []).find((d) => d.lang === 'python')
ok(!!pyDetail && pyDetail.available === true, 'python 解释器已就绪', pyDetail && pyDetail.interpreter)

// 2) 已安装页签
await goto(base + '/#/plugins', 2600)
const inst = await ev(`(() => {
  const rows = Array.from(document.querySelectorAll('.ph-row'))
  const jm = rows.find(r => (r.innerText || '').includes('JMComic'))
  if (!jm) return { found: false, all: rows.map(r => (r.innerText||'').slice(0,40)) }
  return {
    found: true,
    text: jm.innerText,
    tags: Array.from(jm.querySelectorAll('.ph-tag')).map(t => ({ text: t.innerText.trim(), cls: t.className })),
    hasIncompatible: /不兼容|语言不受支持/.test(jm.innerText),
    hasLangTag: Array.from(jm.querySelectorAll('.ph-tag')).some(t => /python/i.test(t.innerText)),
  }
})()`)
console.log('  JMComic 行: ' + JSON.stringify(inst && inst.tags))
ok(inst && inst.found, '已安装列表里有 JMComic', inst && JSON.stringify(inst.all))
ok(inst && !inst.hasIncompatible, '★ 不再显示"不兼容 v6"')
ok(inst && inst.hasLangTag, '显示语言标签(python)')

// 3) 市场页签
// ★ 解锁必须在导航到插件页【之前】做: 页面已挂载的话, 组件里的 gateLocked 是旧状态,
//   即使 cookie 已解锁, 界面仍显示上锁面板(要等 reload 才会重新 loadGate)。
if (gatePW) {
  const gateRes = await ev(`fetch('/api/store/gate/unlock', {
    method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({password: ${JSON.stringify(gatePW)}})
  }).then(async r => ({code: r.status, body: await r.json().catch(()=>null)})).catch(e => ({err: String(e)}))`)
  console.log('  解锁结果: ' + JSON.stringify(gateRes))
  ok(gateRes && gateRes.code === 200, '插件库已解锁', JSON.stringify(gateRes))
  await sleep(400)
  // ★ Page.navigate 到相同 URL(含 hash) 不会真正重载, 必须显式 reload,
  //   否则组件的 gateLocked 仍是旧值, 市场页会一直显示上锁面板
  await send('Page.navigate', { url: base + '/#/plugins' })
  await sleep(600)
  await send('Page.reload', { ignoreCache: true })
  await sleep(2800)
}
await ev(`(() => {
  const t = Array.from(document.querySelectorAll('.ph-tab')).find(x => x.innerText.includes('市场'))
  if (t) t.click()
  return true
})()`)
await sleep(2600)
const mkt = await ev(`(() => {
  const rows = Array.from(document.querySelectorAll('.ph-row'))
  const jm = rows.find(r => (r.innerText || '').includes('JMComic'))
  if (!jm) return { found: false, n: rows.length, txt: (document.querySelector('.ph-body')||{}).innerText?.slice(0,120) }
  return {
    found: true,
    hasIncompatible: /不兼容|语言不受支持/.test(jm.innerText),
    tags: Array.from(jm.querySelectorAll('.ph-tag')).map(t => t.innerText.trim()),
  }
})()`)
ok(mkt && mkt.found, '市场列表里有 JMComic', !mkt.found ? (mkt && mkt.txt) : '')
if (mkt && mkt.found) {
  ok(!mkt.hasIncompatible, '★ 市场里也不误标')
  console.log('  市场标签: ' + JSON.stringify(mkt.tags))
  // ★ 已装 2.0.0 / 远端 1.0.0 时不能提示"可更新" —— 点了会降级
  const adv = (mkt.tags || []).some((t) => t.includes('可更新'))
  const localNewer = (mkt.tags || []).some((t) => t.includes('本地版本更高'))
  const same = (mkt.tags || []).some((t) => /已装\s*\d/.test(t))
  if (same) {
    ok(!adv, '★ 本地版本更高时不提示"可更新"(防误降级)', JSON.stringify(mkt.tags))
  }
  if (localNewer) console.log('  已正确识别为"本地版本更高"')
}

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
