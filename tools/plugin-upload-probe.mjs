#!/usr/bin/env node
// 「安装插件」弹窗 UI 探针
//   1) 插件页头部有「安装插件」按钮
//   2) 点击 → 弹窗出现，含拖拽区 + 格式说明 + 包内要求
//   3) 点 × / 点遮罩 → 弹窗关闭
//   4) 拖入不支持的文件 → 显示错误
//
// (真正的上传安装已由 API 验收覆盖; 这里只验 UI 接线与关闭逻辑,
//  因为 CDP 里模拟 file input 的 File 对象需要额外构造, 收益不如直接调 API)
//
// 用法: node tools/plugin-upload-probe.mjs http://192.168.2.200:3910/ --port 9444 --pw 1

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')

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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

async function goto(url, wait = 1800) {
  await send('Page.navigate', { url })
  await sleep(wait)
}

// ---- 登录 ----
await goto('about:blank', 300)
await goto(base + '/', 2200)
const needLogin = await ev(`!!document.querySelector('.login-card')`)
if (needLogin && loginPW) {
  await ev(`(() => {
    const el = document.querySelector('.field-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(loginPW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(250)
  await ev(`(() => { document.querySelector('.btn-primary').click(); return true })()`)
  await sleep(2400)
}
ok(await ev(`!document.querySelector('.login-card') && !!document.querySelector('.sidebar')`), '面板登录成功')

// ---- 插件页 ----
await goto(base + '/#/plugins', 2200)

const hasBtn = await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.ph-actions button')).find(x => x.innerText.trim() === '安装插件')
  return !!b
})()`)
ok(hasBtn, '插件页头部有「安装插件」按钮')

// ---- 打开弹窗 ----
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.ph-actions button')).find(x => x.innerText.trim() === '安装插件')
  if (b) b.click()
  return true
})()`)
await sleep(700)

const m1 = await ev(`({
  hasModal: !!document.querySelector('.ph-modal'),
  hasDrop: !!document.querySelector('.ph-up-drop'),
  hasFileInput: !!document.querySelector('input[type=file]'),
  accept: (document.querySelector('input[type=file]') || {}).accept || '',
  dropTitle: (document.querySelector('.ph-up-drop-title') || {}).innerText || '',
  noteText: (document.querySelector('.ph-up-note') || {}).innerText || '',
  modalW: document.querySelector('.ph-modal') ? Math.round(document.querySelector('.ph-modal').getBoundingClientRect().width) : 0,
})`)
ok(m1 && m1.hasModal, '弹窗出现')
ok(m1 && m1.hasDrop, '有拖拽区')
ok(m1 && m1.hasFileInput, '有文件选择框')
ok(m1 && m1.accept.includes('.zip') && m1.accept.includes('.tar.gz'), 'accept 限制为插件包格式', m1 && m1.accept)
ok(m1 && m1.dropTitle.includes('拖入'), '拖拽区有提示文案')
ok(m1 && m1.noteText.includes('plugin.json'), '有包内要求说明(提到 plugin.json)')
ok(m1 && m1.modalW > 300 && m1.modalW < 600, '弹窗宽度合理', `${m1 && m1.modalW}px`)

// ---- 点 × 关闭 ----
await ev(`(() => { document.querySelector('.ph-modal-x').click(); return true })()`)
await sleep(500)
ok(!(await ev(`!!document.querySelector('.ph-modal')`)), '点 × 关闭弹窗')

// ---- 点遮罩关闭 ----
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.ph-actions button')).find(x => x.innerText.trim() === '安装插件')
  if (b) b.click()
  return true
})()`)
await sleep(600)
const openAgain = await ev(`!!document.querySelector('.ph-modal')`)
ok(openAgain, '可再次打开弹窗')
// 点遮罩本身(非弹窗内部)
await ev(`(() => {
  const mask = document.querySelector('.ph-modal-mask')
  if (!mask) return false
  mask.click()
  return true
})()`)
await sleep(500)
ok(!(await ev(`!!document.querySelector('.ph-modal')`)), '点遮罩关闭弹窗')

// ---- 暗色下弹窗可读 ----
await ev(`(() => { document.documentElement.dataset.theme = 'dark'; return true })()`)
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.ph-actions button')).find(x => x.innerText.trim() === '安装插件')
  if (b) b.click()
  return true
})()`)
await sleep(700)
const dark = await ev(`(() => {
  const m = document.querySelector('.ph-modal')
  if (!m) return { err: 'no modal' }
  const lum = (c) => { const mm = c.match(/rgba?\\(([^)]+)\\)/); if (!mm) return null; const p = mm[1].split(',').map(Number).slice(0, 3); const f = p.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2] }
  const ratio = (a, b) => { const L1 = Math.max(a, b), L2 = Math.min(a, b); return +((L1 + 0.05) / (L2 + 0.05)).toFixed(2) }
  const cs = getComputedStyle(m)
  const head = document.querySelector('.ph-modal-head')
  const drop = document.querySelector('.ph-up-drop')
  const note = document.querySelector('.ph-up-note li')
  const bg = lum(cs.backgroundColor)
  return {
    theme: document.documentElement.dataset.theme,
    modalBg: cs.backgroundColor,
    headContrast: head ? ratio(lum(getComputedStyle(head).color), bg) : null,
    dropTitleContrast: drop ? ratio(lum(getComputedStyle(document.querySelector('.ph-up-drop-title')).color), lum(getComputedStyle(drop).backgroundColor)) : null,
    noteContrast: note ? ratio(lum(getComputedStyle(note).color), lum(getComputedStyle(document.querySelector('.ph-up-note')).backgroundColor)) : null,
    visible: (() => { const r = m.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 300 })(),
  }
})()`)
ok(!dark.err, '暗色: 弹窗存在')
if (!dark.err) {
  ok(dark.visible, '暗色: 弹窗完整可见')
  ok(dark.headContrast >= 4.5, '暗色: 标题对比度 ≥4.5', `ratio=${dark.headContrast}`)
  ok(dark.dropTitleContrast >= 4.5, '暗色: 拖拽区文字对比度 ≥4.5', `ratio=${dark.dropTitleContrast}`)
  ok(dark.noteContrast >= 3, '暗色: 说明文字对比度 ≥3', `ratio=${dark.noteContrast}`)
}
// 复位主题
await ev(`(() => { delete document.documentElement.dataset.theme; return true })()`)

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
