#!/usr/bin/env node
// 面板交互冒烟探针(Chrome DevTools Protocol)。
//
// 为什么有它(2026-10-01 实测教训): 「面板更新」悬浮窗有两个真 bug 靠读代码没看出来 ——
//   ① Sidebar.vue 的 showUpdate 从未声明成 ref: 点击只写到未跟踪的 ctx 上, 不触发重渲染,
//      表现成"点了没反应 / 过一会儿才弹出";
//   ② api.js 里 panel* 一整组方法从未提交过: 悬浮窗一调用就抛 TypeError, 永远停在
//      "当前版本 -/最新版本 未检查"的空壳, 检查/应用/回滚按钮全是死的。
// 真浏览器里点一下 + 量延迟 + 读 DOM, 两个问题当场暴露。改动任何交互后请跑一遍。
//
// 用法:
//   1) 先起一个开了调试端口的 Chrome(不需要装依赖, 用系统 Chrome/Edge 即可):
//      chrome --headless=new --remote-debugging-port=9333 \
//             --user-data-dir=/tmp/rc-probe --window-size=1400,900 http://127.0.0.1:3900/
//      (Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" 同理)
//   2) node tools/ui-probe.mjs http://127.0.0.1:3900/ [--port 9333] [--png shot.png]
//
// 检查项: 悬浮窗出现延迟 / 版本行是否有真实数据 / 更新日志是否读到 / 有无 JS 异常 /
//         点外部是否关闭。退出码 0 = 全通过, 1 = 有失败(可接 CI)。

import { writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const url = argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/'
const argOf = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const cdpPort = argOf('--port', '9333')
const pngPath = argOf('--png', '')

const fails = []
const ok = (cond, label, extra) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!cond) fails.push(label)
}

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.error('没找到 page target, 确认 Chrome 带 --remote-debugging-port 启动'); process.exit(1) }

const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const exceptions = []
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  else if (m.method === 'Runtime.exceptionThrown') exceptions.push(JSON.stringify(m.params.exceptionDetails).slice(0, 240))
})
const send = (method, params) => new Promise((res) => {
  const i = ++seq
  pending.set(i, res)
  ws.send(JSON.stringify({ id: i, method, params: params || {} }))
})
await new Promise((r) => ws.addEventListener('open', r))
await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Page.navigate', { url: url.replace(/\/$/, '/') + '?ts=' + Date.now() })
await new Promise((r) => setTimeout(r, 3000))

async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result && r.result.exceptionDetails) return { __error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }
  return r.result && r.result.result ? r.result.result.value : r
}

// 1) 点击侧边栏下载按钮 → 悬浮窗出现在 DOM 的延迟
const opened = await ev(`new Promise((resolve) => {
  const btn = document.querySelector('.upd-btn')
  if (!btn) return resolve({ ok: false, err: '侧边栏 .upd-btn 不存在' })
  const t0 = performance.now()
  const obs = new MutationObserver(() => {
    const p = document.querySelector('.pu-pop')
    if (!p) return
    obs.disconnect()
    const r = p.getBoundingClientRect()
    resolve({ ok: true, ms: +(performance.now() - t0).toFixed(2),
              box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
              title: (p.querySelector('.pu-title') || {}).textContent || '',
              badge: (p.querySelector('.pu-badge') || {}).textContent || '',
              closeBtn: !!p.querySelector('.pu-x'),
              foot: [...p.querySelectorAll('.pu-foot button')].map((e) => e.textContent.trim()) })
  })
  obs.observe(document.documentElement, { childList: true, subtree: true })
  btn.click()
  setTimeout(() => { obs.disconnect(); resolve({ ok: false, err: '3s 内悬浮窗未出现' }) }, 3000)
})`)
ok(opened && opened.ok, '点击下载按钮后悬浮窗出现', opened && opened.ok ? `${opened.ms}ms` : JSON.stringify(opened))
if (opened && opened.ok) {
  ok(opened.ms < 500, '出现延迟 < 500ms', `${opened.ms}ms`)
  ok(!!opened.title && opened.closeBtn, '标题与关闭按钮存在', opened.title)
  ok(opened.box.w > 300, '弹窗宽度像对话框(>300px)', `w=${opened.box.w}`)
}

// 2) 等数据填充, 断言不是空壳
await new Promise((r) => setTimeout(r, 2500))
const filled = await ev(`(() => {
  const p = document.querySelector('.pu-pop')
  if (!p) return { ok: false, err: 'no popover' }
  const rows = [...p.querySelectorAll('.pu-ver-row')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())
  return { ok: true, rows,
           badge: (p.querySelector('.pu-badge') || {}).textContent || '',
           logLen: ((p.querySelector('.pu-pre') || {}).textContent || '').length,
           cmd: ((p.querySelector('.pu-cmdrow code') || {}).textContent || '').trim().slice(0, 50),
           history: p.querySelectorAll('.pu-log-row').length }
})()`)
const rowsText = (filled.rows || []).join(' | ')
ok(!!filled.ok && !/当前版本\\s*-/.test(rowsText), '版本行有真实数据(不是空壳 "-")', rowsText)
ok(!/未检查/.test(rowsText), '打开后已自动检查到版本', rowsText)
ok((filled.logLen || 0) > 0 || /已是最新/.test(filled.badge || ''), '读到更新日志或明确已是最新', `logLen=${filled.logLen} badge=${filled.badge}`)
ok((filled.cmd || '').length > 0, '安装命令已填充', filled.cmd)

// 3) 点外部关闭 + 无 JS 异常
const outside = await ev(`new Promise((resolve) => {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  setTimeout(() => resolve({ closed: !document.querySelector('.pu-pop') }), 250)
})`)
ok(outside && outside.closed, '点击外部关闭悬浮窗')
ok(exceptions.length === 0, '无未捕获 JS 异常', exceptions.slice(0, 2).join(' / '))

// 4) 截图(可选)
if (pngPath) {
  await ev(`document.querySelector('.upd-btn').click()`)
  await new Promise((r) => setTimeout(r, 2000))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot.result && shot.result.data) { writeFileSync(pngPath, Buffer.from(shot.result.data, 'base64')); console.log(`截图已写入 ${pngPath}`) }
}
ws.close()
console.log(fails.length ? `\n${fails.length} 项失败: ${fails.join('; ')}` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
