// 版本比较(语义化) —— 面板与插件共用的唯一实现。
//
// 为什么需要语义比较而不是 `!==`(2026-10-01 实测踩到): 插件仓做版本基线归一后,
// 仓库清单是 1.0.0, 而机器上早先装的插件 plugin.json 还是 2.0.0/3.0.0 —— 用 `!==`
// 判断会把"降级"也点亮成"有更新 → 1.0.0", 等于劝用户把插件装回旧号。
// 只有仓库版本严格更高才算可更新。
//
// 2026-10-17 补强(版本号开始带 beta/前导零):
//   · 支持 v 前缀          v1.0.0-beta  ==  1.0.0-beta
//   · 支持预发布后缀       1.0.0-beta    <   1.0.0
//   · 支持前导零           01.0.0        ==  1.0.0
//   · 支持 2 段/3 段混写    1.2           ==  1.2.0

// parseVer 把版本串拆成 { nums: [1,0,0], pre: 'beta' }
// pre 为空表示正式版(正式版比同号预发布更高)。
export function parseVer(v) {
  if (v == null) return { nums: [], pre: '' }
  let s = String(v).trim()
  s = s.replace(/^[vV]/, '') // 去掉 git tag 前缀
  s = s.split('+')[0] // 丢弃 build metadata
  const dash = s.indexOf('-')
  let pre = ''
  if (dash >= 0) {
    pre = s.slice(dash + 1)
    s = s.slice(0, dash)
  }
  const nums = s.split('.').map((x) => {
    const n = parseInt(x, 10)
    return Number.isNaN(n) ? 0 : n // 前导零/空段都归 0
  })
  return { nums, pre }
}

// cmpVer 返回 1(a>b) / 0(相等) / -1(a<b)
export function cmpVer(a, b) {
  const pa = parseVer(a)
  const pb = parseVer(b)
  const n = Math.max(pa.nums.length, pb.nums.length)
  for (let i = 0; i < n; i++) {
    const x = pa.nums[i] || 0
    const y = pb.nums[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  // 主版本号相同: 带预发布后缀的更低(1.0.0-beta < 1.0.0)
  if (pa.pre && !pb.pre) return -1
  if (!pa.pre && pb.pre) return 1
  if (pa.pre === pb.pre) return 0
  return pa.pre > pb.pre ? 1 : -1 // 预发布之间按字典序(beta < rc)
}

// verNewer 市场版本是否严格高于已装版本(只有这时才该提示"可更新")
export function verNewer(latest, cur) {
  if (!latest || !cur) return false
  return cmpVer(latest, cur) > 0
}

// verOlderInRepo 本机版本比仓库更高(如本地 2.0.0、仓库基线 1.0.0)
// —— 界面要如实说明, 不能谎称"已是最新", 更不能引导用户点"更新"去降级
export function verOlderInRepo(latest, cur) {
  if (!latest || !cur) return false
  return cmpVer(latest, cur) < 0
}
