#!/usr/bin/env node
// 前后端契约对拍 —— 防"空壳按钮"和"死代码"。
//
// 为什么需要(2026-10-17 基线文档第 101 条的结论):
//   前端 149 个 api 方法 ↔ 后端 122 条路由, 两侧各写一份, 没有任何自动校验。
//   历史上所有"点了没反应 / 整页白屏"的事故都出在这里:
//     · panelVersion 整组方法缺失 → PanelUpdate 一调用就 TypeError
//     · pluginSettingsGet / bkpList / fmSearch → 调了不存在的接口, 404
//   人眼对不完, 机器一秒钟能对齐。
//
// 两类检查:
//   A. 组件里调用 api.X, 但 api.js 里没有 X     → 运行必 TypeError
//   B. api.js 里的路径在后端没有对应路由         → 请求必 404
//
// 用法: node tools/check-api-contract.mjs
// 退出码: 0 通过 / 1 有问题

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEB = path.join(ROOT, 'web', 'src')
const API = path.join(WEB, 'api.js')
const CMD = path.join(ROOT, 'cmd', 'raincough')

function walk(dir, exts) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p, exts))
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}

// ---- 1. api.js 的方法名与路径 ----
const apiSrc = fs.readFileSync(API, 'utf8')
const apiLines = apiSrc.split('\n')
const methods = new Map() // name -> { path | null }

const nameRe = /^ {2}([A-Za-z_]\w*)\s*:/
for (let i = 0; i < apiLines.length; i++) {
  const m = apiLines[i].match(nameRe)
  if (!m) continue
  const name = m[1]
  // 方法体到下一个同级键为止
  let body = ''
  for (let j = i; j < Math.min(i + 40, apiLines.length); j++) {
    if (j > i && nameRe.test(apiLines[j])) break
    body += apiLines[j] + '\n'
  }
  const pm = body.match(/['"`](\/api\/[^'"`\s]+)/)
  methods.set(name, { path: pm ? pm[1] : null })
}

// ---- 2. 组件里调用的 api.X ----
const callers = new Map()
for (const f of walk(WEB, ['.vue', '.js', '.mjs'])) {
  if (path.resolve(f) === path.resolve(API)) continue
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\bapi\.([A-Za-z_]\w*)\s*\(/g)) {
    const name = m[1]
    if (!callers.has(name)) callers.set(name, new Set())
    callers.get(name).add(path.relative(WEB, f))
  }
}

const missing = []
for (const [name, files] of callers) {
  if (!methods.has(name)) missing.push({ name, files: [...files] })
}

// ---- 3. 后端路由 ----
// ★ 不能只扫 cmd/raincough: auth 的 /api/auth/{login,logout,status} 注册在
//   internal/auth/auth.go 里。只扫一层会把三个真实路由误判成 404。
const routes = new Set()
for (const f of [...walk(CMD, ['.go']), ...walk(path.join(ROOT, 'internal'), ['.go'])]) {
  if (f.endsWith('_test.go')) continue
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\.HandleFunc\("([^"]+)"/g)) routes.add(m[1])
  for (const m of src.matchAll(/\.Handle\("([^"]+)"/g)) routes.add(m[1])
}

const norm = (p) =>
  p.split('?')[0]
    .replace(/\$\{[^}]*\}/g, ':x')
    .replace(/:[A-Za-z_]\w*/g, ':x')
    .replace(/\/+$/, '') || '/'

const routeSet = new Set([...routes].map(norm))
const subtrees = [...routes].filter((r) => r.endsWith('/')).map(norm)

function hit(p) {
  const n = norm(p)
  if (routeSet.has(n)) return true
  return subtrees.some((s) => n === s || n.startsWith(s + '/'))
}

const noRoute = []
for (const [name, info] of methods) {
  if (info.path && info.path.startsWith('/api') && !hit(info.path)) {
    noRoute.push({ name, path: info.path })
  }
}

// ---- 输出 ----
let failed = 0

console.log(`契约检查: api.js ${methods.size} 个方法 / 后端 ${routes.size} 条路由`)

if (missing.length) {
  failed++
  console.log(`\n[✗] 组件调用了不存在的方法(${missing.length}) —— 运行时会 TypeError:`)
  for (const m of missing) console.log(`    api.${m.name}   ← ${m.files.join(', ')}`)
}

if (noRoute.length) {
  failed++
  console.log(`\n[✗] api.js 的路径在后端没有路由(${noRoute.length}) —— 请求会 404:`)
  for (const m of noRoute) console.log(`    ${m.name.padEnd(24)} ${m.path}`)
}

if (!failed) {
  console.log('[✓] 前后端契约对得上: 无缺失方法, 无悬空路径')
}
process.exit(failed ? 1 : 0)
