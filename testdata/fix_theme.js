// 调整 main.css: 默认浅色(dark 改为可选), 文件含中文注释故用 Node 处理
const fs = require('fs')
const p = 'E:/jiaob/RainCough-Core/web/src/styles/main.css'
let s = fs.readFileSync(p, 'utf8')

// 提取 :root 深色块 与 [data-theme="light"] 浅色块
const rootBlock = s.match(/^:root \{[^}]*\}/m)
const lightBlock = s.match(/^\[data-theme="light"\] \{[\s\S]*?\n\}/m)
if (!rootBlock || !lightBlock) {
  console.error('block extract failed')
  process.exit(1)
}
// 交换: 默认 :root 用浅色变量, [data-theme="dark"] 用深色变量
const lightVars = lightBlock[0].replace(/^\[data-theme="light"\]/, '')
const darkVars = rootBlock[0].replace(/^:root \{\n/, '').replace(/\n\}$/, '\n}')
s = s.replace(rootBlock[0], ':root ' + lightVars)
s = s.replace(lightBlock[0], ':root[data-theme="dark"] ' + darkVars)
// color-scheme: 默认 light, dark 可选
s = s.replace(':root { color-scheme: dark; }', ':root { color-scheme: light; }')
s = s.replace('[data-theme="light"] { color-scheme: light; }', ':root[data-theme="dark"] { color-scheme: dark; }')
fs.writeFileSync(p, s, 'utf8')
console.log('done; dark-now-optional:', s.includes(':root[data-theme="dark"] {'))
console.log('default-light:', /^:root \{\n  --bg: #f5f6f8/m.test(s))