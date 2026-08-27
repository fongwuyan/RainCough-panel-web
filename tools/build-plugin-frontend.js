// 插件前端统一构建: 把 plugins/<name>/frontend/*.js 编译为 assets/plugin.js
// 用法: node tools/build-plugin-frontend.js [插件名...]
// 产物: plugins/<name>/assets/plugin.js (IIFE, window.__rcPlugin_<name>)
// Vue 直接打包进产物 —— 插件完全自包含, 不依赖主系统注入运行时。
// (主面板 web/node_modules 提供 esbuild 与 vue 源码)

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PLUGINS = path.join(ROOT, 'plugins')

// 从主面板 web/node_modules 解析 esbuild, 避免插件方再装依赖
const esbuild = require(path.join(ROOT, 'web', 'node_modules', 'esbuild'))

// 打包 vue 进产物: 把 import 'vue' 解析到主面板内的 vue ESM(浏览器版)
const VUE_ESM = path.join(ROOT, 'web', 'node_modules', 'vue', 'dist', 'vue.esm-browser.js')

async function buildPlugin(name) {
  const dir = path.join(PLUGINS, name)
  const frontend = path.join(dir, 'frontend')
  const entry = path.join(frontend, 'plugin.js')
  if (!fs.existsSync(entry)) {
    console.log(`[skip] ${name}: 无 frontend/plugin.js`)
    return false
  }
  const outDir = path.join(dir, 'assets')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'plugin.js')
  try {
    await esbuild.build({
      entryPoints: [entry],
      outfile: outFile,
      bundle: true,
      format: 'iife',
      // Vue 内联打包: 插件产物自包含(可用主面板 vue 的 ESM 作为依赖来源)
      plugins: [{
        name: 'vue-inline',
        setup(build) {
          build.onResolve({ filter: /^vue$/ }, () => ({ path: VUE_ESM }))
        },
      }],
      target: 'es2020',
      minify: false,
    })
    console.log(`[ok]   ${name}: ${path.relative(ROOT, outFile)}`)
    return true
  } catch (e) {
    console.error(`[fail] ${name}:`, e.message)
    return false
  }
}

async function main() {
  const names = process.argv.slice(2)
  const all = names.length ? names : fs.readdirSync(PLUGINS)
    .filter(d => fs.existsSync(path.join(PLUGINS, d, 'frontend', 'plugin.js')))
  let ok = 0
  for (const n of all) {
    if (await buildPlugin(n)) ok++
  }
  console.log(`\n构建完成: ${ok}/${all.length}`)
}

main()