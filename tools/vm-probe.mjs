// 虚拟机插件前端验收探针
// 用法: node tools/vm-probe.mjs http://192.168.2.200:3910/ --port 9444 --pw 1 [--shot out.png]
// 检查: 渲染 / 卡片数 / 状态徽章 / 详情抽屉 / 快照区 / 亮暗主题对比度 / JS 异常
const args = process.argv.slice(2)
const base = (args[0] || 'http://127.0.0.1:3910/').replace(/\/$/, '')
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const cdpPort = argOf('--port', '9444')
const loginPW = argOf('--pw', '')
const shot = argOf('--shot', '')

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) { console.log('FAIL 没有可用的浏览器页面'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })

let id = 0
const pending = new Map()
const errs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails
    errs.push((d.exception && d.exception.description) || d.text || 'unknown')
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errs.push(m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 200))
  }
}
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((r) => pending.set(i, r))
}
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fails = []
const ok = (cond, label, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined && !cond ? '  ' + detail : ''}`)
  if (!cond) fails.push(label)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

// ---- 登录 ----
await send('Page.navigate', { url: 'about:blank' })
await sleep(400)
await send('Page.navigate', { url: base + '/' })
await sleep(2600)
if (loginPW) {
  await ev(`(() => {
    const el = document.querySelector('.field-input')
    if (!el) return false
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, ${JSON.stringify(loginPW)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(300)
  await ev(`(() => { const b = document.querySelector('.btn-primary'); if (b) b.click(); return true })()`)
  await sleep(2600)
}

// ---- 打开插件页 ----
await send('Page.navigate', { url: base + '/#/plugin/vm' })
await sleep(3500)
errs.length = 0

const st = await ev(`(() => {
  const root = document.querySelector('.plugin-mount')
  if (!root) return { err: 'no .plugin-mount' }
  const cards = root.querySelectorAll('.rcvm-card')
  const names = Array.from(root.querySelectorAll('.rcvm-name')).map((x) => x.innerText.trim())
  const badges = Array.from(root.querySelectorAll('.rcvm-badge')).map((x) => x.innerText.trim())
  const bar = Array.from(document.querySelectorAll('div')).find(
    (d) => /^全局错误/.test((d.innerText || '').trim()) && d.style && d.style.position === 'fixed'
  )
  return {
    mounted: true,
    cards: cards.length,
    names,
    badges,
    titleCount: root.querySelectorAll('.rcvm-name').length,
    hasCreateBtn: Array.from(root.querySelectorAll('button')).some((b) => b.innerText.includes('新建虚拟机')),
    hasRefresh: Array.from(root.querySelectorAll('button')).some((b) => /刷新/.test(b.innerText)),
    barText: (root.querySelector('.rcvm-bar') || {}).innerText || '',
    globalErr: bar ? bar.innerText.trim().slice(0, 160) : '',
    text: (root.innerText || '').slice(0, 300),
  }
})()`)

console.log('页面状态:', JSON.stringify(st, null, 1))
ok(st && st.mounted, '插件前端已挂载')
ok(st && !st.globalErr, '无全局错误条', st && st.globalErr)
ok(st && st.cards === 3, '显示 3 台虚拟机', st && st.cards)
ok(st && st.hasCreateBtn, '有「新建虚拟机」按钮')
ok(st && st.hasRefresh, '有「刷新」按钮')
ok(st && /KVM|libvirt/.test(st.barText), '环境条显示 KVM/libvirt', st && st.barText.slice(0, 80))
ok(st && st.badges.every((b) => ['已关闭', '运行中', '已暂停', '已崩溃', '正在关机', '休眠'].includes(b)),
   '状态徽章文案正确', st && JSON.stringify(st.badges))

// ---- 点开详情 ----
if (st && st.cards > 0) {
  await ev(`(() => {
    const b = Array.from(document.querySelectorAll('.rcvm-card button')).find((x) => x.innerText.trim() === '详情')
    if (b) { b.click(); return true }
    return false
  })()`)
  await sleep(2200)
  const dt = await ev(`(() => {
    const dr = document.querySelector('.rcvm-drawer')
    if (!dr) return { err: 'no drawer' }
    const secs = Array.from(dr.querySelectorAll('.rcvm-sec-t')).map((x) => x.innerText.trim())
    return {
      sections: secs,
      kv: Array.from(dr.querySelectorAll('.rcvm-kv .v')).map((x) => x.innerText.trim()).slice(0, 8),
      disks: dr.querySelectorAll('.rcvm-item').length,
      text: (dr.innerText || '').slice(0, 200),
    }
  })()`)
  console.log('详情抽屉:', JSON.stringify(dt, null, 1))
  ok(dt && !dt.err, '详情抽屉已展开', dt && dt.err)
  ok(dt && dt.sections.some((s) => s.includes('基本')), '含「基本」区块')
  ok(dt && dt.sections.some((s) => s.includes('磁盘')), '含「磁盘」区块')
  ok(dt && dt.sections.some((s) => s.includes('网络')), '含「网络」区块')
  ok(dt && dt.sections.some((s) => s.includes('快照')), '含「快照」区块')
  ok(dt && dt.sections.some((s) => s.includes('备注')), '含「备注」区块')
}

// ---- 打开创建弹窗 ----
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.plugin-mount button')).find((x) => x.innerText.includes('新建虚拟机'))
  if (b) { b.click(); return true }
  return false
})()`)
await sleep(1800)
const mdl = await ev(`(() => {
  const m = document.querySelector('.rcvm-modal')
  if (!m) return { err: 'no modal' }
  const opts = Array.from(m.querySelectorAll('select option')).map((o) => o.innerText.trim())
  return {
    fields: Array.from(m.querySelectorAll('label')).map((x) => x.innerText.trim()).filter(Boolean),
    imageOptions: opts.length,
    firstImages: opts.slice(0, 4),
  }
})()`)
console.log('创建弹窗:', JSON.stringify(mdl, null, 1))
ok(mdl && !mdl.err, '创建弹窗已打开', mdl && mdl.err)
ok(mdl && mdl.fields.includes('名称'), '有「名称」字段')
ok(mdl && mdl.fields.includes('基础镜像'), '有「基础镜像」字段')
ok(mdl && mdl.imageOptions > 1, '镜像下拉有选项', mdl && mdl.imageOptions)

// 关掉弹窗
await ev(`(() => {
  const b = Array.from(document.querySelectorAll('.rcvm-modal button')).find((x) => x.innerText.trim() === '取消')
  if (b) b.click()
  return true
})()`)
await sleep(600)

ok(errs.length === 0, '无 JS 异常', errs.slice(0, 3).join(' | '))

// ---- 亮/暗主题对比度 ----
const themes = {}
for (const theme of ['light', 'dark']) {
  await ev(`(() => {
    if (${JSON.stringify(theme)} === 'dark') document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
    return true
  })()`)
  await sleep(500)
  themes[theme] = await ev(`(() => {
    const lum = (c) => {
      const m = c.match(/rgba?\\(([^)]+)\\)/)
      if (!m) return null
      const p = m[1].split(',').map(Number).slice(0, 3)
      const f = p.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
    }
    const ratio = (a, b) => { const L1 = Math.max(a, b), L2 = Math.min(a, b); return +((L1 + 0.05) / (L2 + 0.05)).toFixed(2) }
    const card = document.querySelector('.rcvm-card')
    if (!card) return { err: 'no card' }
    const cs = getComputedStyle(card)
    const name = card.querySelector('.rcvm-name')
    const meta = card.querySelector('.rcvm-meta')
    const bg = lum(cs.backgroundColor)
    return {
      theme: document.documentElement.dataset.theme || 'light',
      cardBg: cs.backgroundColor,
      nameRatio: name ? ratio(lum(getComputedStyle(name).color), bg) : null,
      metaRatio: meta ? ratio(lum(getComputedStyle(meta).color), bg) : null,
      badgeVisible: !!card.querySelector('.rcvm-badge'),
    }
  })()`)
  const t = themes[theme]
  ok(t && !t.err, `${theme}: 卡片渲染`, t && t.err)
  if (t && !t.err) {
    ok(t.nameRatio >= 4.5, `${theme}: 名称对比度 ≥4.5`, `ratio=${t.nameRatio}`)
    ok(t.metaRatio >= 3, `${theme}: 元信息对比度 ≥3`, `ratio=${t.metaRatio}`)
  }
}

// 恢复亮色
await ev(`(() => { delete document.documentElement.dataset.theme; return true })()`)
await sleep(400)

if (shot) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const { writeFileSync } = await import('node:fs')
  writeFileSync(shot, Buffer.from(r.result.data, 'base64'))
  console.log('截图:', shot)
}

console.log('')
console.log(fails.length === 0 ? '全部通过' : `失败 ${fails.length} 项: ` + fails.join(', '))
ws.close()
process.exit(fails.length === 0 ? 0 : 1)
