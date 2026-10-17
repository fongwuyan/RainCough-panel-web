#!/usr/bin/env node
// 登录页布局体检(不依赖看图): 量卡片位置/尺寸/对比度/输入框可见性/暗色主题
// 用法: node tools/login-layout-check.mjs http://192.168.2.200:3910/ [--port 9444]

const argv = process.argv.slice(2)
const base = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:3900/').replace(/\/$/, '')
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const cdpPort = argOf('--port', '9444')

const fails = []
const ok = (c, l, e) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? '  ' + e : ''}`); if (!c) fails.push(l) }

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)) }
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable'); await send('Runtime.enable')

async function measure(theme) {
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: base + '/' }); await sleep(2000)
  if (theme === 'dark') {
    await ev(`(async () => {
      localStorage.setItem('rc_theme', 'dark')
      document.documentElement.dataset.theme = 'dark'
      return true
    })()`)
    await sleep(400)
  }
  return await ev(`(() => {
    const card = document.querySelector('.login-card')
    if (!card) return { err: 'no .login-card' }
    const r = card.getBoundingClientRect()
    const cs = getComputedStyle(card)
    const input = document.querySelector('.field-input')
    const ir = input ? input.getBoundingClientRect() : null
    const btn = document.querySelector('.btn-primary')
    const br = btn ? btn.getBoundingClientRect() : null
    const hint = document.querySelector('.hint')
    const bg = (el) => { const s = getComputedStyle(el); return s.backgroundColor }
    const lum = (c) => {
      const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null
      const p = m[1].split(',').map(Number).slice(0, 3)
      const f = p.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
    }
    const ratio = (a, b) => { const L1 = Math.max(a, b), L2 = Math.min(a, b); return (L1 + 0.05) / (L2 + 0.05) }
    const cardBg = lum(cs.backgroundColor)
    const inputCs = input ? getComputedStyle(input) : null
    const inputFg = inputCs ? lum(inputCs.color) : null
    const inputBg = inputCs ? lum(inputCs.backgroundColor) : null
    const hintFg = hint ? lum(getComputedStyle(hint).color) : null
    return {
      theme: document.documentElement.dataset.theme || 'light',
      card: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      vw: innerWidth, vh: innerHeight,
      inputVisible: ir ? (ir.width > 100 && ir.height > 30 && ir.top >= 0 && ir.bottom <= innerHeight) : false,
      inputRect: ir ? { w: Math.round(ir.width), h: Math.round(ir.height) } : null,
      btnVisible: br ? (br.width > 100 && br.height > 30 && br.bottom <= innerHeight) : false,
      cardBgColor: cs.backgroundColor,
      pageBgColor: getComputedStyle(document.querySelector('.login-page')).backgroundColor,
      textColor: cs.color,
      contrastCardText: (lum(cs.color) && cardBg) ? +ratio(lum(cs.color), cardBg).toFixed(2) : null,
      contrastInput: (inputFg && inputBg) ? +ratio(inputFg, inputBg).toFixed(2) : null,
      contrastHint: (hintFg && cardBg) ? +ratio(hintFg, cardBg).toFixed(2) : null,
      borderColor: cs.borderTopColor,
      scrollOverflow: document.documentElement.scrollHeight > innerHeight + 2,
    }
  })()`)
}

const light = await measure('light')
console.log('--- 亮色主题 ---'); console.log(JSON.stringify(light, null, 1))
ok(!light.err, '亮色: 登录卡片存在')
if (!light.err) {
  ok(light.card.w >= 300 && light.card.w <= 420, '亮色: 卡片宽度合理(300-420px)', `${light.card.w}px`)
  ok(Math.abs((light.card.x + light.card.w / 2) - light.vw / 2) < 12, '亮色: 卡片水平居中', `中心偏移 ${Math.round(Math.abs(light.card.x + light.card.w / 2 - light.vw / 2))}px`)
  ok(light.inputVisible, '亮色: 密码框完整可见')
  ok(light.btnVisible, '亮色: 登录按钮完整可见')
  ok(!light.scrollOverflow, '亮色: 无纵向溢出滚动')
  ok(light.contrastCardText >= 4.5, '亮色: 卡片文字对比度 ≥ 4.5', `ratio=${light.contrastCardText}`)
  ok(light.contrastInput >= 4.5, '亮色: 输入框文字对比度 ≥ 4.5', `ratio=${light.contrastInput}`)
  ok(light.contrastHint >= 3.0, '亮色: 提示文字对比度 ≥ 3', `ratio=${light.contrastHint}`)
}

const dark = await measure('dark')
console.log('--- 暗色主题 ---'); console.log(JSON.stringify(dark, null, 1))
ok(!dark.err, '暗色: 登录卡片存在')
if (!dark.err) {
  ok(dark.theme === 'dark', '暗色: 主题已切换', dark.theme)
  ok(dark.inputVisible, '暗色: 密码框完整可见')
  ok(dark.btnVisible, '暗色: 登录按钮完整可见')
  ok(dark.contrastCardText >= 4.5, '暗色: 卡片文字对比度 ≥ 4.5', `ratio=${dark.contrastCardText}`)
  ok(dark.contrastInput >= 4.5, '暗色: 输入框文字对比度 ≥ 4.5', `ratio=${dark.contrastInput}`)
  ok(dark.contrastHint >= 3.0, '暗色: 提示文字对比度 ≥ 3', `ratio=${dark.contrastHint}`)
  // 暗色下卡片背景应比页面背景亮(否则卡片糊在一起)
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').map(Number).slice(0, 3) : null }
  const cb = parse(dark.cardBgColor), pb = parse(dark.pageBgColor)
  ok(!!cb && !!pb && (cb[0] + cb[1] + cb[2]) > (pb[0] + pb[1] + pb[2]),
    '暗色: 卡片背景与页面背景可区分', `${dark.cardBgColor} on ${dark.pageBgColor}`)
}

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
ws.close(); process.exit(fails.length === 0 ? 0 : 1)
