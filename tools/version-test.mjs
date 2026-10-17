import { cmpVer, verNewer, verOlderInRepo, parseVer } from '../web/src/version.js'

let fail = 0
const eq = (got, want, label) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)
  if (!ok) fail++
}

// parseVer
eq(parseVer('v1.0.0-beta'), { nums: [1, 0, 0], pre: 'beta' }, 'v前缀+beta')
eq(parseVer('01.00.1'), { nums: [1, 0, 1], pre: '' }, '前导零')
eq(parseVer('1.2'), { nums: [1, 2], pre: '' }, '两段')
eq(parseVer('1.0.0+build5'), { nums: [1, 0, 0], pre: '' }, 'build metadata')

// cmpVer 基本
eq(cmpVer('1.0.0-beta', '1.0.0'), -1, 'beta < 正式版')
eq(cmpVer('1.0.0', '1.0.0-beta'), 1, '正式版 > beta')
eq(cmpVer('v1.0.0-beta', '1.0.0-beta'), 0, 'v前缀不影响')
eq(cmpVer('01.00.1', '1.0.1'), 0, '前导零等价')
eq(cmpVer('1.00.1', '1.0.1'), 0, '1.00.1 == 1.0.1')
eq(cmpVer('1.2', '1.2.0'), 0, '两段与三段')
eq(cmpVer('1.2.10', '1.2.9'), 1, '数值比较不是字符串')
eq(cmpVer('1.0.0-beta', '1.0.0-rc'), -1, 'beta < rc')
eq(cmpVer('1.0.0-alpha', '1.0.0-beta'), -1, 'alpha < beta')

// 业务语义
eq(verNewer('1.0.0-beta', '1.0.0-beta'), false, '同版本不算可更新')
eq(verNewer('1.00.2', '1.00.1'), true, '更高才算可更新')
eq(verNewer('1.00.1', '1.00.1'), false, '相等不算')
eq(verOlderInRepo('1.00.1', '2.0.0'), true, '本地更高')
eq(verOlderInRepo('1.00.1', '1.00.1'), false, '相等不算本地更高')
eq(verNewer('', '1.0.0'), false, '空值不崩')
eq(verNewer(null, null), false, 'undefined 不崩')

console.log('')
console.log(fail === 0 ? '全部通过' : `失败 ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)
