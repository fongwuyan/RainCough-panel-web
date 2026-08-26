// 提取当前后端全部已注册路由
const fs = require('fs')
const path = require('path')
const dir = 'E:/jiaob/RainCough-Core/cmd/raincough'
const files = fs.readdirSync(dir).filter(f => f.endsWith('.go'))
const routes = new Set()
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8')
  const re = /HandleFunc\("([^"]+)"/g
  let m
  while ((m = re.exec(src))) routes.add(m[1])
}
const list = [...routes].sort()
fs.writeFileSync('E:/jiaob/RainCough-Core/testdata/new_routes2.txt', list.join('\n'))
console.log('后端路由数:', list.length)
list.forEach(r => console.log(' ', r))