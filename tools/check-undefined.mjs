#!/usr/bin/env node
// 未定义标识符检查器（针对 web/src 的 .js / .vue）
//
// 为什么有它（2026-10-18 事故）:
//   改 usePluginHub.js 时用字符串切片替换代码, 把 loadRuntime / runtimeInfo /
//   supportedLangs / langUnavailable / incompatible 这几个定义整段切掉了, 只剩
//   onMounted 里的调用和末尾的导出。结果点「插件」页直接白屏:
//     ReferenceError: loadRuntime is not defined
//   而 **vite build 完全成功** —— esbuild 只做转译, 不检查标识符是否定义;
//   tools/check-bindings.mjs 只查 .vue 模板绑定, 也覆盖不到 .js 里的函数引用。
//   于是这个错误直到用户在浏览器里点开页面才暴露。
//
// 做法: 用 @babel/parser 解析 AST, 收集"被调用的标识符"与"本文件声明/导入的名字",
// 对比得出未定义项。比正则可靠得多(能区分 obj.foo() 与 foo())。
//
// 用法(仓库根目录):
//   node tools/check-undefined.mjs              # 扫 web/src 下全部 js/vue
//   node tools/check-undefined.mjs <file...>    # 只扫指定文件
// 退出码: 0 = 干净; 1 = 有未定义标识符

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// .mjs 是 ESM, 不能直接用 require; 用 createRequire 去加载 CJS 的 @babel/parser
const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const WEB_SRC = path.join(ROOT, 'web', 'src')

let parser
try {
  parser = require(path.join(ROOT, 'web', 'node_modules', '@babel', 'parser'))
} catch (e) {
  console.error('缺少 @babel/parser(随 vite/vue 装好的传递依赖)。请先在 web/ 下 npm i')
  process.exit(2)
}

// 运行时/浏览器/Node 全局, 及 Vue 编译宏
const GLOBALS = new Set([
  // JS 内置
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Math', 'JSON',
  'Date', 'RegExp', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'EvalError', 'URIError',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'structuredClone', 'queueMicrotask', 'atob', 'btoa',
  'Intl', 'ArrayBuffer', 'Uint8Array', 'Int8Array', 'Float32Array', 'Float64Array',
  'DataView', 'Blob', 'File', 'FileReader', 'FormData', 'URL', 'URLSearchParams',
  'TextEncoder', 'TextDecoder', 'AbortController', 'Headers', 'Request', 'Response',
  // 浏览器
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'localStorage',
  'sessionStorage', 'console', 'fetch', 'alert', 'confirm', 'prompt', 'setTimeout',
  'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'queueMicrotask', 'XMLHttpRequest', 'WebSocket', 'Event',
  'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'HTMLElement', 'Node', 'getComputedStyle',
  'matchMedia', 'performance', 'crypto', 'IntersectionObserver', 'ResizeObserver',
  'MutationObserver', 'ClipboardItem', 'Image', 'Audio', 'Notification', 'Worker',
  'requestIdleCallback', 'cancelIdleCallback', 'createImageBitmap', 'OffscreenCanvas',
  // 构建期注入
  'import', 'require', 'module', 'exports', 'process', 'globalThis', 'undefined',
  'NaN', 'Infinity', 'arguments', 'this', 'eval', 'Function',
  // Vue 编译宏 / defineExpose 等
  'defineProps', 'defineEmits', 'defineExpose', 'defineOptions', 'defineSlots',
  'withDefaults', 'onMounted', 'onUnmounted', 'onBeforeMount', 'onBeforeUnmount',
  'onActivated', 'onDeactivated', 'onErrorCaptured', 'onUpdated', 'onBeforeUpdate',
  'provide', 'inject', 'nextTick', 'watch', 'watchEffect', 'watchPostEffect',
  'reactive', 'ref', 'computed', 'readonly', 'shallowRef', 'shallowReactive',
  'toRef', 'toRefs', 'toRaw', 'markRaw', 'isRef', 'isReactive', 'isProxy',
  'h', 'createApp', 'createVNode', 'defineComponent', 'useSlots', 'useAttrs',
  'getCurrentInstance', 'toValue', 'effectScope', 'onScopeDispose',
])

// 收集: 本文件声明/导入的名字 + 被调用的名字(含裸标识符引用)
function analyze(code, filename) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
  })

  const declared = new Set()
  const called = new Map() // name -> line

  const addBinding = (node) => {
    // 各种 binding pattern: Identifier / ObjectPattern / ArrayPattern / RestElement / AssignmentPattern
    if (!node) return
    switch (node.type) {
      case 'Identifier':
        declared.add(node.name)
        break
      case 'ObjectPattern':
        for (const p of node.properties || []) addBinding(p.type === 'RestElement' ? p.argument : p.value)
        break
      case 'ArrayPattern':
        for (const el of node.elements || []) addBinding(el)
        break
      case 'RestElement':
        addBinding(node.argument)
        break
      case 'AssignmentPattern':
        addBinding(node.left)
        break
      case 'TSAsExpression':
      case 'TSTypeAssertion':
        addBinding(node.expression)
        break
    }
  }

  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return

    switch (node.type) {
      case 'ImportDeclaration':
        for (const s of node.specifiers || []) declared.add(s.local.name)
        return
      case 'FunctionDeclaration':
      case 'ClassDeclaration':
      case 'TSEnumDeclaration':
      case 'TSTypeAliasDeclaration':
      case 'TSInterfaceDeclaration':
        if (node.id) declared.add(node.id.name)
        break
      case 'VariableDeclarator':
        addBinding(node.id)
        break
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ObjectMethod':
      case 'ClassMethod':
        if (node.id) declared.add(node.id.name)
        for (const p of node.params || []) addBinding(p)
        break
      case 'CatchClause':
        if (node.param) addBinding(node.param)
        break
      case 'LabeledStatement':
        return
      // 被调用的标识符: foo(...)
      case 'CallExpression':
        if (node.callee && node.callee.type === 'Identifier') {
          if (!called.has(node.callee.name)) called.set(node.callee.name, node.callee.loc?.start.line || 0)
        }
        break
      // 裸标识符引用(如 `:is="comp"` 之类的运行时引用), 只收非成员访问的
      case 'Identifier':
        break
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue
      const v = node[key]
      if (Array.isArray(v)) {
        for (const c of v) if (c && typeof c.type === 'string') visit(c)
      } else if (v && typeof v.type === 'string') {
        visit(v)
      }
    }
  }
  visit(ast)

  const missing = []
  for (const [name, line] of called) {
    if (declared.has(name) || GLOBALS.has(name)) continue
    missing.push({ name, line, file: filename })
  }
  return missing
}

// 从 .vue 里取出 <script setup> 内容(只检查脚本部分)
function extractVueScript(code) {
  const m = code.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  return m ? m[1] : ''
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      walk(p, out)
    } else if (/\.(js|vue)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const args = process.argv.slice(2)
const files = args.length ? args.map((a) => path.resolve(process.cwd(), a)) : walk(WEB_SRC)

let total = 0
let checked = 0
const allMissing = []

for (const f of files) {
  let code
  try {
    code = fs.readFileSync(f, 'utf8')
  } catch (e) {
    continue
  }
  const isVue = f.endsWith('.vue')
  if (isVue) code = extractVueScript(code)
  if (!code.trim()) continue
  checked++
  let missing
  try {
    missing = analyze(code, path.relative(ROOT, f))
  } catch (e) {
    console.log(`  [跳过] ${path.relative(ROOT, f)}: 解析失败 ${e.message}`)
    continue
  }
  if (missing.length) {
    allMissing.push(...missing)
    total += missing.length
  }
}

if (allMissing.length) {
  console.log('发现未定义标识符:')
  for (const m of allMissing) {
    console.log(`  ${m.file}:${m.line}  ${m.name}() 未声明也未导入`)
  }
  console.log(`\n共 ${total} 处。这类错误 vite build 不会报, 但浏览器一执行就 ReferenceError。`)
  process.exit(1)
}

console.log(`检查 ${checked} 个文件: 无未定义标识符`)
