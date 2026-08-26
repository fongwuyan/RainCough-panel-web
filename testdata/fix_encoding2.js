// 批量修复 syscenter_ext.go 的 GBK 乱码汉字(反引号模板+Node 写, 无编码问题)
const fs = require('fs')
const p = 'E:/jiaob/RainCough-Core/cmd/raincough/syscenter_ext.go'
let s = fs.readFileSync(p, 'utf8')

// 乱码 -> 正确中文(用码点, 不写汉字字面量)
const fixes = [
  ['鏃犺鍒?', '\u65e0\u8ba1\u5212'],                 // 无计划
  ['实战镀?', '\u5df2\u5237\u65b0'],                 // 已刷新(备用)
  ['宸插埛鏂?', '\u5df2\u5237\u65b0'],                 // 已刷新
  ['鍗囩骇宸插湪鍚庡彴鎵ц', '\u5347\u7ea7\u5df2\u5728\u540e\u53f0\u6267\u884c'], // 升级已在后台执行
  ['宸插湪鍚庡彴鎵ц', '\u5df2\u5728\u540e\u53f0\u6267\u884c'],
]
for (const [bad, good] of fixes) {
  s = s.split(bad).join(good)
}
fs.writeFileSync(p, s, 'utf8')

// 验证无残留乱码
const re = /[\uFFFD]|鍗|宸|插|埛|鏂|鍒|鎵|ц|忻|鍚/g
const bad = s.match(re)
console.log('remaining suspicious:', bad ? bad.join(' ') : 'none')

// 简单括号平衡检查: 数引号
const quotes = (s.match(/"/g) || []).length
console.log('double quotes:', quotes, quotes % 2 === 0 ? 'OK' : 'UNBALANCED')