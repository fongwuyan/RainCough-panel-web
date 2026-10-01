#!/usr/bin/env node
// 面板交互冒烟探针(Chrome DevTools Protocol)。
//
// 为什么有它(2026-10-01 实测教训): 「面板更新」悬浮窗有两个真 bug 靠读代码没看出来 ——
//   ① Sidebar.vue 的 showUpdate 从未声明成 ref: 点击只写到未跟踪的 ctx 上, 不触发重渲染,
//      表现成"点了没反应 / 过一会儿才弹出";
//   ② api.js 里 panel* 一整组方法从未提交过: 悬浮窗一调用就抛 TypeError, 永远停在
//      "当前版本 -/最新版本 未检查"的空壳, 检查/更新按钮全是死的。
// 真浏览器里点一下 + 量延迟 + 读 DOM, 两个问题当场暴露。改动任何交互后请跑一遍。
//
// 用法:
//   1) 先起一个开了调试端口的 Chrome(不需要装依赖, 用系统 Chrome/Edge 即可):
//      chrome --headless=new --remote-debugging-port=9333 \
//             --user-data-dir=/tmp/rc-probe --window-size=1400,900 http://127.0.0.1:3900/
//      (Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" 同理)
//   2) node tools/ui-probe.mjs http://127.0.0.1:3900/ [--port 9333] [--png-dir DIR]
//
// 检查项: 悬浮窗出现延迟 / 版本行是否有真实数据 / 更新日志是否读到 / 有无 JS 异常 /
//         点外部是否关闭 / 有新版本时确认弹窗是否自动弹出(含更新内容与确认按钮)。
// 想看"有新版本"那一路, 把面板实例的 VERSION 改成比最新 Release 低的版本号即可(如 0.9.0)。
// 退出码 0 = 全通过, 1 = 有失败(可接 CI)。

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const url = argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/'
const argOf = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const cdpPort = argOf('--port', '9333')
const pngDir = argOf('--png-dir', '')

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
await new Promise((r) => setTimeout(r, 3500))

async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result && r.result.exceptionDetails) return { __error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }
  return r.result && r.result.result ? r.result.result.value : r
}
async function shot(name) {
  if (!pngDir) return
  const s = await send('Page.captureScreenshot', { format: 'png' })
  if (s.result && s.result.data) { const p = join(pngDir, name); writeFileSync(p, Buffer.from(s.result.data, 'base64')); console.log('截图 ' + p) }
}

// 0) 若检测到新版本, 打开页面后应自动弹出确认窗 —— 先看它(它会盖住悬浮窗)
await new Promise((r) => setTimeout(r, 2500))
const dlg = await ev(`(() => {
  const d = document.querySelector('.pu-dlg')
  if (!d) return { open: false }
  return { open: true,
           hasNotes: !!d.querySelector('.pu-pre'),
           logLen: ((d.querySelector('.pu-pre') || {}).textContent || '').length,
           text: d.innerText.replace(/\\s+/g, ' ').trim().slice(0, 160),
           btns: [...d.querySelectorAll('.pu-dlg-foot button')].map((e) => e.textContent.trim()) }
})()`)
if (dlg.open) {
  ok(dlg.hasNotes && dlg.logLen > 0, '检测到新版本 → 确认弹窗自动弹出且含更新内容', dlg.text)
  ok((dlg.btns || []).indexOf('确认更新') >= 0, '弹窗内含「确认更新」', (dlg.btns || []).join('/'))
  if (pngDir) await shot('ui-dialog.png')
  await ev(`document.querySelector('.pu-dlg .pu-x').click()`)
  await new Promise((r) => setTimeout(r, 500))
  ok(!(await ev(`!!document.querySelector('.pu-dlg')`)), '弹窗可关闭')
} else {
  console.log('SKIP  当前实例没有新版本, 跳过确认弹窗检查(想验证就把实例 VERSION 调低, 如 0.9.0)')
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
              badge: (p.querySelector('.pu-badge') || {}).textContent || '' })
  })
  obs.observe(document.documentElement, { childList: true, subtree: true })
  btn.click()
  setTimeout(() => { obs.disconnect(); resolve({ ok: false, err: '3s 内悬浮窗未出现' }) }, 3000)
})`)
ok(opened && opened.ok, '点击下载按钮后悬浮窗出现', opened && opened.ok ? `${opened.ms}ms` : JSON.stringify(opened))
if (opened && opened.ok) {
  ok(opened.ms < 500, '出现延迟 < 500ms', `${opened.ms}ms`)
  ok(!!opened.title, '标题存在', opened.title)
  ok(opened.box.w > 300, '弹窗宽度像对话框(>300px)', `w=${opened.box.w}`)
}

// 2) 等数据填充, 断言不是空壳; 只有四件事: 版本行 / 更新日志 / 检查更新 / 更新面板
await new Promise((r) => setTimeout(r, 2500))
const filled = await ev(`(() => {
  const p = document.querySelector('.pu-pop')
  if (!p) return { ok: false, err: 'no popover' }
  const rows = [...p.querySelectorAll('.pu-ver-row')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())
  const btns = [...p.querySelectorAll('button')].map((e) => e.textContent.trim())
  return { ok: true, rows, btns,
           badge: (p.querySelector('.pu-badge') || {}).textContent || '',
           logLen: ((p.querySelector('.pu-pre') || {}).textContent || '').length,
           hasHistory: !!p.querySelector('.pu-log-row'),
           hasInstallCmd: !!p.querySelector('.pu-cmdrow') }
})()`)
const rowsText = (filled.rows || []).join(' | ')
ok(!!filled.ok && !/当前版本\s*-/.test(rowsText), '版本行有真实数据(不是空壳 "-")', rowsText)
ok(!/未检查|—/.test(rowsText), '打开后已自动检查到版本', rowsText)
ok((filled.logLen || 0) > 0 || /已是最新/.test(filled.badge || ''), '读到更新日志或明确已是最新', `logLen=${filled.logLen} badge=${filled.badge}`)
ok(filled.btns && filled.btns.indexOf('检查更新') >= 0, '有「检查更新」', (filled.btns || []).join('/'))
ok(!filled.hasHistory && !filled.hasInstallCmd, '悬浮窗只保留四件事(无历史/安装命令块)')

// 3) 截图 + 点外部关闭 + 无 JS 异常
if (pngDir) await shot('ui-popover.png')
const outside = await ev(`new Promise((resolve) => {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  setTimeout(() => resolve({ closed: !document.querySelector('.pu-pop') }), 250)
})`)
ok(outside && outside.closed, '点击外部关闭悬浮窗')
ok(exceptions.length === 0, '无未捕获 JS 异常', exceptions.slice(0, 2).join(' / '))

ws.close()
console.log(fails.length ? `\n${fails.length} 项失败: ${fails.join('; ')}` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
