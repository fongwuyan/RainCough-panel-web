// 修复 syscenter_ext.go 编码损坏行(UTF-8 安全)
const fs = require('fs')
const p = 'E:/jiaob/RainCough-Core/cmd/raincough/syscenter_ext.go'
let s = fs.readFileSync(p, 'utf8')
// 修复损坏的中文: 49 行 message、13 行注释
s = s.replace(/鍗囩骇宸插湪鍚庡彴鎵ц[^"]*/, '升级已在后台执行(可能数分钟)')
s = s.replace(/\/\/ 绯荤粺[^\n]*/, '// 系统中心扩展端点(对应旧前端 api.js sysf* 契约, 脚本化 sudo 执行)。')
fs.writeFileSync(p, s, 'utf8')
const lines = s.split('\n')
console.log('line49 fixed:', lines[48].includes('升级已在后台'))
console.log('line13 comment:', lines[12].startsWith('// 系统中心'))
// 残留乱码检查
const bad = s.match(/[\uFFFD]/g)
console.log('replacement chars remaining:', bad ? bad.length : 0)