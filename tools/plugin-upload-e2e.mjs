#!/usr/bin/env node
// 「安装插件」端到端探针: 真实走一遍「打开弹窗 → 选文件 → 上传 → 成功态 → 查看已安装」
//
// 与 plugin-upload-probe.mjs 的分工:
//   plugin-upload-probe.mjs  只验 UI 接线(按钮/弹窗/拖拽区/关闭/暗色对比度), 不传真文件
//   本脚本                    传真实插件包, 验端到端(含后端安装落盘与列表刷新)
//
// 用法:
//   node tools/plugin-upload-e2e.mjs http://192.168.2.200:3910/ \
//        --port 9444 --pw <面板密码> --gate <插件库口令> \
//        --pkg C:/path/to/plugin-0.2.0.tar.gz [--expect-name testplugin]
//
// ⚠️ 口令一律从命令行传, 不写进仓库(插件库口令是写死在二进制的哈希, 明文不该入库)。
// ⚠️ --pkg 必须是 Chrome 能读到的【本机绝对路径】。Chrome 在 Windows 上跑时,
//    Git Bash 的 /tmp 它读不到(会得到 xhr.onerror "网络错误"), 请用 C:/... 形式。

import { existsSync } from 'node:fs'

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')
const gatePW = argOf('--gate', '')
const pkg = argOf('--pkg', '')
const expectName = argOf('--expect-name', '')
const expectLabel = argOf('--expect-label', '')

const fails = []
const ok = (c, l, e) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? '  ' + e : ''}`); if (!c) fails.push(l) }

if (!pkg || !existsSync(pkg)) {
  console.error('缺少 --pkg 或文件不存在: ' + pkg)
  process.exit(1)
}

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.error('没有可用的 page target'); process.exit(1) }
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

await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

async function goto(url, wait = 2000) {
  await send('Page.navigate', { url })
  await sleep(wait)
}

// ---- 登录 ----
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

// ---- 解锁插件库闸门(上传也受闸门保护) ----
const gate = await ev(`(async () => {
  const st = await fetch('/api/store/gate', { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({ locked: true }))
  if (!st || !st.locked) return { already: true }
  const r = await fetch('/api/store/gate/unlock', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ${JSON.stringify(gatePW)} })
  })
  const d = await r.json().catch(() => ({}))
  return { code: r.status, d }
})()`)
ok(gate && (gate.already || gate.code === 200), '插件库闸门已解锁', JSON.stringify(gate))

// ---- 进插件页, 打开弹窗 ----
await goto(base + '/#/plugins', 2400)
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.ph-actions button')).find(x => x.innerText.trim() === '安装插件')
  if (b) b.click()
  return true
})()`)
await sleep(800)
ok(await ev(`!!document.querySelector('.ph-modal')`), '安装弹窗已打开')

// ---- 塞文件(真实走 input change → 组件逻辑) ----
const doc = await send('DOM.getDocument')
const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' })
if (!q.result || !q.result.nodeId) {
  console.log('FAIL  找不到 file input')
  process.exit(1)
}
await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [pkg] })
await sleep(3500)

const r = await ev(`({
  hasOk: !!document.querySelector('.ph-up-ok'),
  okTitle: (document.querySelector('.ph-up-ok-title') || {}).innerText || '',
  okMeta: (document.querySelector('.ph-up-ok-meta') || {}).innerText || '',
  err: (document.querySelector('.ph-up-err') || {}).innerText || '',
})`)
console.log('  结果: ' + JSON.stringify(r))
ok(r && r.hasOk, '上传安装成功(显示成功态)', r && r.err ? 'err=' + r.err : '')
ok(r && r.okTitle.length > 0, '成功态显示插件名', r && r.okTitle)
ok(r && /v\d/.test(r.okMeta), '成功态显示版本', r && r.okMeta)

// ---- 点「查看已安装」 ----
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.ph-up-ok-actions button')).find(x => x.innerText.includes('查看已安装'))
  if (b) b.click()
  return true
})()`)
await sleep(1300)
const r2 = await ev(`({
  hasModal: !!document.querySelector('.ph-modal'),
  tabActive: (document.querySelector('.ph-tab.active') || {}).innerText || '',
  rows: Array.from(document.querySelectorAll('.ph-row .ph-name')).map(x => x.innerText),
})`)
ok(r2 && !r2.hasModal, '点「查看已安装」关闭弹窗')
ok(r2 && r2.tabActive.includes('已安装'), '切到「已安装」页签', r2 && r2.tabActive)
// 列表里显示的是 label(不是 name), 所以用「label 或 name 命中」判断。
// label 从成功态的标题里取("已安装 <label>"), 不依赖调用方额外传参。
if (expectName || expectLabel) {
  const want = [expectName, expectLabel].filter(Boolean)
  ok(r2 && r2.rows.some((x) => want.some((w) => x.includes(w))),
    '列表中出现目标插件', r2 && JSON.stringify(r2.rows))
}

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
