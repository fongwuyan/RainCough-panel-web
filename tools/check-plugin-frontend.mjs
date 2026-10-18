// 检查插件前端：所有 this.xxx 调用/读取是否都有定义
// 用法: node tools/check-plugin-frontend.mjs plugins/<name>/frontend/plugin.js
import fs from 'node:fs'

const file = process.argv[2] || 'plugins/JMComic/frontend/plugin.js'
const src = fs.readFileSync(file, 'utf8')
const lines = src.split('\n')

// ---- 1) 调用：this.foo( ----
const calls = new Set()
for (const m of src.matchAll(/this\.([A-Za-z_$][\w$]*)\s*\(/g)) calls.add(m[1])

// ---- 2) 读取：this.foo（后面不是 ( ）
//
// ⚠️ 不要写成 /this\.(\w+)(?!\s*\()/ ：
//    `\w*` 是可回溯的，遇到 this.foo( 时它会回退一个字符，
//    让断言在 foo( 上成立 —— 结果把 foo 误判成"读取"，还截断成 fo。
//    正确做法：先贪婪匹配完整标识符，再在代码里判断后续字符。
const reads = new Set()
const readMap = new Map()   // name -> [行号]
for (const m of src.matchAll(/this\.([A-Za-z_$][\w$]*)/g)) {
  const name = m[1]
  const after = src.slice(m.index + m[0].length).match(/^\s*/)[0]
  const nextCh = src[m.index + m[0].length + after.length]
  if (nextCh === '(') continue          // 这是方法调用，不算读取
  reads.add(name)
  if (!readMap.has(name)) readMap.set(name, [])
}

// ---- 3) 方法定义 ----
const defs = new Set()
//   foo() {   /   async foo() {   /   foo: function
for (const m of src.matchAll(/^\s+(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) defs.add(m[1])
for (const m of src.matchAll(/^\s+([A-Za-z_$][\w$]*)\s*:\s*function/gm)) defs.add(m[1])
for (const m of src.matchAll(/^\s+([A-Za-z_$][\w$]*)\s*:\s*\(/gm)) defs.add(m[1])

// ---- 4) data() 字段 ----
const dataFields = new Set()
const dm = src.match(/data\(\)\s*\{\s*return\s*\{([\s\S]*?)\n\s{4,8}\}\s*\n\s{2,6}\}/)
if (dm) {
  for (const m of dm[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) dataFields.add(m[1])
}

const BUILTIN = new Set([
  '$el', '$refs', '$nextTick', '$forceUpdate', '$emit', '$watch', '$set', '$delete',
  '$options', '$parent', '$root', '$data', '$props', '$slots', '$attrs', '$on',
])

const lineOf = (name, withParen) => {
  // 用词边界收尾，避免 foo 匹配到 foobar
  const esc = name.replace(/\$/g, '\\$')
  const pat = withParen
    ? 'this\\.' + esc + '\\s*\\('
    : 'this\\.' + esc + '(?![\\w$])'
  const re = new RegExp(pat)
  const out = []
  lines.forEach((l, i) => { if (re.test(l)) out.push(i + 1) })
  return out.slice(0, 4).join(',')
}

let bad = 0

console.log(`文件: ${file}`)
console.log(`  调用 ${calls.size} 个 · 读取 ${reads.size} 个 · 方法定义 ${defs.size} 个 · data 字段 ${dataFields.size} 个`)
console.log('')

const missMethods = [...calls].filter((n) => !defs.has(n) && !BUILTIN.has(n)).sort()
if (missMethods.length) {
  bad += missMethods.length
  console.log('❌ 调用了但没定义的方法（运行时会报 "is not a function"）:')
  for (const n of missMethods) console.log(`   this.${n}(...)   行 ${lineOf(n, true)}`)
} else {
  console.log('✅ 所有 this.xxx() 调用都有定义')
}

console.log('')

const missFields = [...reads]
  .filter((n) => !dataFields.has(n) && !defs.has(n) && !BUILTIN.has(n))
  .sort()
if (missFields.length) {
  bad += missFields.length
  console.log('⚠️ 读取了但 data 里没声明的字段（可能是 undefined）:')
  for (const n of missFields) console.log(`   this.${n}   行 ${lineOf(n, false)}`)
} else {
  console.log('✅ 所有 this.xxx 读取都在 data 或 methods 中')
}

// ---- 5) 未定义就调用的常量（全大写标识符）----
//
// 先把注释和字符串挖空再扫，否则注释里提到 "CDN"、日志文案里的词都会误报。
const codeOnly = src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')        // 块注释
  .replace(/\/\/[^\n]*/g, ' ')               // 行注释
  .replace(/'(?:\\.|[^'\\])*'/g, "''")       // 单引号字符串
  .replace(/"(?:\\.|[^"\\])*"/g, '""')       // 双引号字符串
  .replace(/`(?:\\.|[^`\\])*`/g, '``')       // 模板字符串

// 任意层级的 const（含函数内局部），都算"已定义"
const consts = new Set()
for (const m of codeOnly.matchAll(/\b(?:const|let|var)\s+([A-Z][A-Z0-9_]{2,})\s*=/g)) consts.add(m[1])
const usedConsts = new Set()
for (const m of codeOnly.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) usedConsts.add(m[1])
const KNOWN_JS = new Set(['JSON', 'Math', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'Set', 'Map', 'URL', 'NaN', 'Infinity', 'Intl', 'RegExp', 'Error', 'MAX_SAFE_INTEGER'])
const missConsts = [...usedConsts].filter((n) => !consts.has(n) && !KNOWN_JS.has(n) && !BUILTIN.has(n))
if (missConsts.length) {
  console.log('')
  console.log('⚠️ 使用了但本文件未定义的常量（可能在别处定义，确认一下）:')
  console.log('   ' + missConsts.join(', '))
}

console.log('')
console.log(bad === 0 ? '结果: 通过' : `结果: ${bad} 个问题`)
process.exit(bad === 0 ? 0 : 1)
