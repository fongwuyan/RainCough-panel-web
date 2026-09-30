// 系统扩展统一构建: extensions/<name>/frontend/extension.js -> assets/extension.js
// 用法: node tools/build-extension.js [扩展名...]
//
// 与插件前端不同: 扩展产物【不打包 Vue 与 api】, 运行时统一从宿主 window.__rcHost 取
// (见 web/src/ext-host.js), 因此单个扩展产物通常只有几 KB, 可随主面板库提交。
// 宿主 Vue 使用完整版(带模板编译器), 扩展可直接用 template 字符串写组件。

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const EXTS = path.join(ROOT, 'extensions')
const esbuild = require(path.join(ROOT, 'web', 'node_modules', 'esbuild'))

async function buildExt(name) {
  const dir = path.join(EXTS, name)
  const entry = path.join(dir, 'frontend', 'extension.js')
  if (!fs.existsSync(entry)) {
    console.log(`[skip] ${name}: 无 frontend/extension.js`)
    return false
  }
  const outDir = path.join(dir, 'assets')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'extension.js')
  try {
    await esbuild.build({
      entryPoints: [entry],
      outfile: outFile,
      bundle: true,
      format: 'iife',
      target: 'es2020',
      minify: false,
      // 宿主提供的运行时: 扩展若 import 'vue' 视为外部(不打包), 由 window.__rcHost 取
      external: ['vue'],
      banner: { js: `/* RainCough 系统扩展产物 · ${name} · 由 tools/build-extension.js 生成 */` },
    })
    const size = fs.statSync(outFile).size
    console.log(`[ok]   ${name}: ${path.relative(ROOT, outFile)} (${size}B)`)
    return true
  } catch (e) {
    console.error(`[fail] ${name}:`, e.message)
    return false
  }
}

// 校验扩展清单(名称/版本/产物路径), 避免把坏包提交进库
function checkManifest(name) {
  const p = path.join(EXTS, name, 'extension.json')
  if (!fs.existsSync(p)) {
    console.error(`[fail] ${name}: 缺 extension.json`)
    return false
  }
  let m
  try {
    m = JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    console.error(`[fail] ${name}: extension.json 不是合法 JSON`)
    return false
  }
  if (!m.name || !m.label || !m.version) {
    console.error(`[fail] ${name}: extension.json 需含 name/label/version`)
    return false
  }
  if (m.name !== name) {
    console.error(`[fail] ${name}: 清单里 name=${m.name} 与目录名不一致`)
    return false
  }
  return true
}

async function main() {
  const names = process.argv.slice(2)
  const all = names.length ? names : fs.readdirSync(EXTS).filter((d) => {
    try { return fs.statSync(path.join(EXTS, d)).isDirectory() } catch (e) { return false }
  })
  let ok = 0
  for (const n of all) {
    if (!checkManifest(n)) continue
    if (await buildExt(n)) ok++
  }
  console.log(`\n构建完成: ${ok}/${all.length}`)
}

main()
