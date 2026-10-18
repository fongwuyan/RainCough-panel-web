#!/usr/bin/env node
// 设置页「密钥」区块 + 插件页极简上锁面板 验收探针
//
// 检查:
//   设置页 → 仓库配置:
//     1) 不再有「访问令牌」区块、Token 输入框、ghp_ 提示
//     2) 有「密钥」区块: password 输入框 + 解锁按钮
//     3) 无多余说明文字(不要提示词)
//     4) 输错密钥 → 报错; 输对 → 显示已解锁, 出现「上锁」按钮
//   插件页 → 插件市场(未解锁时):
//     5) 只有输入框 + 解锁按钮
//     6) 无图标 / 无标题 / 无说明文字 / 无额外提示
//
// 用法: node tools/settings-gate-probe.mjs http://192.168.2.200:3910/ --port 9444 --pw 1 --gate '<插件库口令>'

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')
const gatePW = argOf('--gate', '')
const outDir = argOf('--out', '')

const fails = []
const ok = (c, l, e) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? '  ' + e : ''}`); if (!c) fails.push(l) }

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

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

async function goto(url, wait = 2200) {
  await send('Page.navigate', { url })
  await sleep(wait)
}
// 填值 + 分两步点按钮(避免点到仍 disabled 的按钮)
async function typeInto(sel, val) {
  return ev(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(val)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
}
async function clickByText(sel, text) {
  return ev(`(() => {
    const b = Array.from(document.querySelectorAll(${JSON.stringify(sel)})).find(x => x.innerText.trim() === ${JSON.stringify(text)})
    if (!b) return false
    b.click()
    return true
  })()`)
}

// ---- 登录 ----
await goto('about:blank', 300)
await goto(base + '/', 2400)
if (await ev(`!!document.querySelector('.login-card')`)) {
  if (!loginPW) { console.error('需要登录但未提供 --pw'); process.exit(1) }
  await typeInto('.field-input', loginPW)
  await sleep(250)
  await ev(`(() => { document.querySelector('.btn-primary').click(); return true })()`)
  await sleep(2500)
}
ok(await ev(`!document.querySelector('.login-card') && !!document.querySelector('.sidebar')`), '面板登录成功')

// ================= 设置页 =================
// ★ 先主动上锁: 之前的探针可能已解锁并留下 cookie, 否则"输错密钥"这组用例
//   的前置条件(未解锁)不成立, 会误报失败。
await ev(`fetch('/api/store/gate/lock', {method:'POST', credentials:'same-origin'}).then(r=>r.json()).catch(()=>null)`)
await sleep(600)

await goto(base + '/#/settings', 2400)
// 切到「仓库配置」
await clickByText('.st-nav-item', '仓库配置')
await sleep(900)
const onRepo = await ev(`(() => {
  const t = document.querySelector('.st-group-title')
  return t ? t.innerText.trim() : ''
})()`)
if (!/仓库|插件仓库/.test(onRepo || '')) {
  // 兜底: 用导航按钮的点法再试一次
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('button, .st-nav-item, a')).find(x => (x.innerText||'').includes('仓库配置'))
    if (b) b.click()
    return true
  })()`)
  await sleep(900)
}

const s1 = await ev(`(() => {
  const body = document.body.innerText || ''
  const titles = Array.from(document.querySelectorAll('.st-group-title')).map(x => x.innerText.trim())
  const inputs = Array.from(document.querySelectorAll('input')).map(x => ({
    type: x.type, placeholder: x.placeholder || '', cls: x.className
  }))
  const tokenInput = inputs.find(x => (x.placeholder || '').includes('ghp_'))
  return {
    titles,
    hasTokenTitle: titles.some(t => t.includes('访问令牌')),
    hasKeyTitle: titles.some(t => t === '密钥'),
    hasTokenInput: !!tokenInput,
    hasGhpPlaceholder: body.includes('ghp_'),
    hasGithubTokenText: body.includes('GitHub Token'),
    hasPrivateRepoText: body.includes('私有仓库需要'),
    pwdInputs: inputs.filter(x => x.type === 'password').length,
    allText: body.slice(0, 600),
  }
})()`)
console.log('  区块标题: ' + JSON.stringify(s1 && s1.titles))
ok(s1 && !s1.hasTokenTitle, '不再有「访问令牌」区块')
ok(s1 && !s1.hasTokenInput && !s1.hasGhpPlaceholder, '不再有 GitHub Token 输入框')
ok(s1 && !s1.hasGithubTokenText, '不再出现「GitHub Token」文案')
ok(s1 && !s1.hasPrivateRepoText, '不再出现「私有仓库需要…」提示词')
ok(s1 && s1.hasKeyTitle, '有「密钥」区块')
ok(s1 && s1.pwdInputs >= 1, '有 password 输入框', `count=${s1 && s1.pwdInputs}`)

// 密钥区块不应带说明文字: 检查该区块内没有 st-hint
const s1b = await ev(`(() => {
  const titles = Array.from(document.querySelectorAll('.st-group-title'))
  const keyTitle = titles.find(t => t.innerText.trim() === '密钥')
  if (!keyTitle) return { err: 'no key title' }
  // 取密钥标题之后、下一个 group-title 之前的所有 st-hint
  let el = keyTitle.nextElementSibling
  const hints = []
  while (el && !(el.classList && el.classList.contains('st-group-title'))) {
    if (el.classList && el.classList.contains('st-hint')) hints.push(el.innerText.trim())
    if (el.classList && el.classList.contains('st-form')) {
      // st-form 里也可能夹 hint
    }
    el = el.nextElementSibling
  }
  const form = keyTitle.nextElementSibling
  return { hints, hintCount: hints.length, firstSiblingCls: form ? form.className : '' }
})()`)
ok(s1b && s1b.hintCount === 0, '密钥区块无提示词', s1b && JSON.stringify(s1b.hints))

// ---- 输错密钥 ----
// 定位密钥输入框: 找到「密钥」label 下的 input
const keyInputSel = '.st-field.wide input[type=password]'
const hasKeyInput = await ev(`!!document.querySelector('${keyInputSel}')`)
ok(hasKeyInput, '定位到密钥输入框')

if (hasKeyInput) {
  await typeInto(keyInputSel, 'wrong-key-xyz')
  await sleep(250)
  await clickByText('.st-actions button', '解锁')
  await sleep(1600)
  const s2 = await ev(`({
    status: (document.querySelector('.st-status') || {}).innerText || '',
    statusCls: (document.querySelector('.st-status') || {}).className || '',
    pingText: (document.querySelector('.st-ping') || {}).innerText || '',
    stillValue: (document.querySelector('${keyInputSel}') || {}).value || '',
    locked: (document.body.innerText || '').includes('未解锁'),
  })`)
  ok(s2 && (s2.status.includes('错误') || s2.status.includes('口令')), '错密钥显示错误', s2 && s2.status)
  ok(s2 && s2.locked, '错密钥后仍为未解锁')

  // ---- 输对密钥 ----
  if (gatePW) {
    await typeInto(keyInputSel, gatePW)
    await sleep(250)
    await clickByText('.st-actions button', '解锁')
    await sleep(1800)
    const s3 = await ev(`({
      status: (document.querySelector('.st-status') || {}).innerText || '',
      statusCls: (document.querySelector('.st-status') || {}).className || '',
      inputCleared: (document.querySelector('${keyInputSel}') || {}).value === '',
      hasLockBtn: Array.from(document.querySelectorAll('.st-actions button')).some(b => b.innerText.trim() === '上锁'),
      unlocked: (document.body.innerText || '').includes('已解锁'),
    })`)
    ok(s3 && s3.status.includes('生效'), '正确密钥提示已生效', s3 && s3.status)
    ok(s3 && s3.unlocked, '显示「已解锁」')
    ok(s3 && s3.inputCleared, '成功后清空输入框')
    ok(s3 && s3.hasLockBtn, '出现「上锁」按钮')

    // ---- 点「上锁」 ----
    await clickByText('.st-actions button', '上锁')
    await sleep(1600)
    const s4 = await ev(`({ locked: (document.body.innerText || '').includes('未解锁'), status: (document.querySelector('.st-status') || {}).innerText || '' })`)
    ok(s4 && s4.locked, '点「上锁」回到未解锁')
  }
}

// ================= 插件页极简上锁面板 =================
await goto(base + '/#/plugins', 2400)
await ev(`(() => {
  const t = Array.from(document.querySelectorAll('.ph-tab')).find(x => x.innerText.includes('市场'))
  if (t) t.click()
  return true
})()`)
await sleep(1600)

const p1 = await ev(`(() => {
  const g = document.querySelector('.ph-gate')
  if (!g) return { hasGate: false }
  return {
    hasGate: true,
    hasIcon: !!document.querySelector('.ph-gate-lock'),
    hasTitle: !!document.querySelector('.ph-gate-title'),
    hasSub: !!document.querySelector('.ph-gate-sub'),
    hasHint: !!document.querySelector('.ph-gate-hint'),
    hasInput: !!document.querySelector('.ph-gate-input'),
    hasBtn: !!document.querySelector('.ph-gate-form button'),
    // 面板内文字(只应有按钮文字, 无说明)
    innerText: g.innerText.trim(),
    // 是否还有任何 emoji/图标字符
    hasEmoji: /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(g.innerText),
  }
})()`)
ok(p1 && p1.hasGate, '插件市场显示上锁面板')
ok(p1 && !p1.hasIcon, '无锁图标')
ok(p1 && !p1.hasTitle, '无标题文字')
ok(p1 && !p1.hasSub, '无说明文字')
ok(p1 && !p1.hasHint, '无额外提示(连续错误提示已移除)')
ok(p1 && !p1.hasEmoji, '无 emoji 图标', p1 && JSON.stringify(p1.innerText))
ok(p1 && p1.hasInput && p1.hasBtn, '只有输入框 + 按钮')

// 数据层不应再返回 has_token 字段(前端已不用)
const st = await ev(`fetch('/api/store/settings', {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({}))`)
ok(st && st.config && !('has_token' in st.config), '设置接口不再返回 has_token', JSON.stringify(st && st.config))

ok(jsErrors.length === 0, '无 JS 异常', jsErrors.slice(0, 3).join(' | '))

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
