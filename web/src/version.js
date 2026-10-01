// 版本比较(点分数字)。用于"仓库里的版本 vs 本机已装版本"。
//
// 为什么需要语义比较而不是 `!==`(2026-10-01 实测踩到): 插件仓做版本基线归一后,
// 仓库清单是 1.0.0, 而机器上早先装的插件 plugin.json 还是 2.0.0/3.0.0 —— 用 `!==`
// 判断会把"降级"也点亮成"有更新 → 1.0.0", 等于劝用户把插件装回旧号。
// 只有仓库版本严格更高才算可更新。
export function verNewer(latest, cur) {
  if (!latest || !cur) return false
  const a = String(latest).split('.')
  const b = String(cur).split('.')
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const x = Number(a[i] || 0)
    const y = Number(b[i] || 0)
    if (Number.isNaN(x) || Number.isNaN(y)) return String(latest) !== String(cur)
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

// 本机版本比仓库更高(如本地 2.0.0、仓库基线 1.0.0) —— 界面要如实说明, 不能谎称"已是最新"
export function verOlderInRepo(latest, cur) {
  return !!latest && !!cur && String(latest) !== String(cur) && !verNewer(latest, cur)
}
