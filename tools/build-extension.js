// 系统扩展统一构建: extensions/<name>/frontend/ -> assets/extension.js
// 用法: node tools/build-extension.js [扩展名...]
//
// 与插件前端不同: 扩展产物【不打包 Vue 与主面板 api】, 运行时统一从宿主
// window.__rcHost 取(见 web/src/ext-host.js), 因此产物通常只有几十 KB。
//
// 支持 .vue 单文件组件(用 web/node_modules/@vue/compiler-sfc 在本工具内编译):
//   扩展源码可直接搬运主面板的 SFC, 只需把 `from '../../api'` 改成 `from 'rc-api'`,
//   `from 'vue'` 保持不动(构建时映射到宿主 Vue 的 shim)。

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const EXTS = path.join(ROOT, 'extensions')
const NODE_MODULES = path.join(ROOT, 'web', 'node_modules')
const esbuild = require(path.join(NODE_MODULES, 'esbuild'))
const sfc = require(path.join(NODE_MODULES, '@vue', 'compiler-sfc'))

// 宿主 Vue / api 的 shim: 以 CommonJS 形式暴露 window.__rcHost 上的实例。
// 用 CJS 而不是 ESM 具名导出, 是因为 esbuild 对 CJS 允许任意具名导入(降级为属性访问),
// 于是模板编译产生的运行时辅助函数(openBlock/createElementVNode/…)不必逐个列举;
// 而 vue 的 ESM 产物只是转发壳, 枚举导出名既不可靠也不完整。
const hostShim = {
  name: 'rc-host-shim',
  setup(build) {
    build.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'rc-host' }))
    build.onResolve({ filter: /^rc-api$/ }, () => ({ path: 'rc-api', namespace: 'rc-host' }))
    build.onLoad({ filter: /.*/, namespace: 'rc-host' }, (args) => {
      if (args.path === 'rc-api') {
        return {
          loader: 'js',
          contents: `
            var host = window.__rcHost
            if (!host || !host.api) throw new Error('系统扩展宿主运行时缺失: window.__rcHost.api')
            module.exports = host.api
          `,
        }
      }
      return {
        loader: 'js',
        contents: `
          var host = window.__rcHost
          if (!host || !host.Vue) throw new Error('系统扩展宿主运行时缺失: window.__rcHost.Vue')
          module.exports = host.Vue
        `,
      }
    })
  },
}

// .vue 单文件组件编译(script setup + template + style scoped)
const vueSFC = {
  name: 'rc-vue-sfc',
  setup(build) {
    build.onLoad({ filter: /\.vue$/ }, (args) => {
      const source = fs.readFileSync(args.path, 'utf8')
      const filename = path.basename(args.path)
      const id = 'data-v-' + hash(filename + source.length)
      const { descriptor, errors } = sfc.parse(source, { filename })
      if (errors && errors.length) {
        return { errors: errors.map((e) => ({ text: String(e.message || e) })) }
      }

      let code = ''
      if (descriptor.script || descriptor.scriptSetup) {
        const compiled = sfc.compileScript(descriptor, {
          id,
          inlineTemplate: true,
          templateOptions: { compilerOptions: { whitespace: 'condense' } },
        })
        code = compiled.content
      } else if (descriptor.template) {
        const tpl = sfc.compileTemplate({
          source: descriptor.template.content,
          filename,
          id,
          scoped: true,
          compilerOptions: { whitespace: 'condense' },
        })
        code = `export default { render: ${tpl.code.replace(/^export function render/, 'function render')} }\n`
        if (tpl.code.startsWith('export function render')) {
          code = `${tpl.code}\nexport default { render }\n`
        }
      } else {
        code = 'export default {}\n'
      }

      // 让 SFC 的 scoped 样式生效: 给组件挂 __scopeId
      if (descriptor.styles.some((s) => s.scoped)) {
        code = code.replace(/export default/, 'const __sfc_main =')
        code += `\n__sfc_main.__scopeId = ${JSON.stringify(id)}\nexport default __sfc_main\n`
      }

      // 样式: 编译后注入 <style>(每个文件一份, 用 id 去重)
      descriptor.styles.forEach((style, i) => {
        const res = sfc.compileStyle({
          source: style.content,
          filename,
          id,
          scoped: !!style.scoped,
        })
        if (res.errors && res.errors.length) return
        const css = JSON.stringify(res.code)
        code += `
;(function(){
  var key = 'rc-ext-css-' + ${JSON.stringify(id + '-' + i)}
  if (document.getElementById(key)) return
  var el = document.createElement('style')
  el.id = key
  el.textContent = ${css}
  document.head.appendChild(el)
})()
`
      })

      return { loader: 'js', contents: code, resolveDir: path.dirname(args.path) }
    })
  },
}

function hash(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

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
    const res = await esbuild.build({
      entryPoints: [entry],
      outfile: outFile,
      bundle: true,
      format: 'iife',
      target: 'es2020',
      minify: false,
      plugins: [hostShim, vueSFC],
      banner: { js: `/* RainCough 系统扩展产物 · ${name} · 由 tools/build-extension.js 生成 */` },
    })
    if (res.errors && res.errors.length) throw new Error(res.errors[0].text)
    const size = fs.statSync(outFile).size
    console.log(`[ok]   ${name}: ${path.relative(ROOT, outFile)} (${size}B)`)
    return true
  } catch (e) {
    console.error(`[fail] ${name}:`, e.message)
    return false
  }
}

// 清单校验(名称/版本/产物路径), 避免坏包提交进库
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
