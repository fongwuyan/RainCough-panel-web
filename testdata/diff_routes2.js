// 对比旧前端 api.js 全部端点 vs 后端路由, 输出缺失列表(处理模板字符串)
const fs = require('fs')
const apiSrc = fs.readFileSync('E:/jiaob/RainCough-Core/web/src/api.js', 'utf8')
const routes = fs.readFileSync('E:/jiaob/RainCough-Core/testdata/new_routes2.txt', 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean)

// 提取 api.js 里所有 API 路径: 单引号字符串 + 模板字符串中的字面前缀
const eps = new Set()
// '...' 形式
for (const m of apiSrc.matchAll(/['"](\/api\/[^'"$`?]*)/g)) {
  const p = m[1].split('?')[0].replace(/\/$/, '')
  if (p) eps.add(p)
}
// 模板字符串中 `${...}` 前缀
for (const m of apiSrc.matchAll(/`(\/api\/[^`]*?)\$\{/g)) {
  const p = m[1].replace(/\/$/, '')
  if (p) eps.add(p)
}

// 后端前缀匹配路由
function match(ep) {
  for (const r of routes) {
    const rr = r.replace(/\/$/, '')
    if (ep === rr) return r
    if (r.endsWith('/') && ep.startsWith(r)) return r
  }
  return null
}

const missing = []
for (const ep of [...eps].sort()) {
  if (ep.startsWith('/api/plugins/')) continue // 网关代理
  if (!match(ep)) missing.push(ep)
}
fs.writeFileSync('E:/jiaob/RainCough-Core/testdata/missing_eps.txt', missing.join('\n'))
console.log('=== 前端端点总数(非插件):', [...eps].filter(e => !e.startsWith('/api/plugins/')).length)
console.log('=== 缺失端点数:', missing.length)
missing.forEach(m => console.log('  MISS:', m))