// 对比旧前端端点 vs 新后端路由, 找出缺失端点
const fs = require('fs')
const oldEps = fs.readFileSync('E:/jiaob/RainCough-Core/testdata/old_ep.txt', 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean)
const newRoutes = fs.readFileSync('E:/jiaob/RainCough-Core/testdata/new_routes.txt', 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean)

// 归类: 新后端每条路由是精确路径或前缀(以 / 结尾可匹配子路径)
function matches(ep, route) {
  if (route === ep) return true
  if (route.endsWith('/') && ep.startsWith(route)) return true
  return false
}

const missing = []
const matched = []
for (const ep of oldEps) {
  const hit = newRoutes.find(r => matches(ep, r))
  if (hit) matched.push({ ep, route: hit })
  else missing.push(ep)
}

// 忽略 /api/plugins/* (网关已代理所有插件)
const missingReal = missing.filter(ep => !ep.startsWith('/api/plugins/'))
const missingPlugins = missing.filter(ep => ep.startsWith('/api/plugins/'))

console.log('=== 新后端缺失端点(非插件): ' + missingReal.length + ' ===')
missingReal.forEach(ep => console.log(ep))
console.log('\n=== 插件端点(走网关, 不缺失): ' + missingPlugins.length + ' ===')
console.log('=== 已匹配: ' + matched.length + ' ===')