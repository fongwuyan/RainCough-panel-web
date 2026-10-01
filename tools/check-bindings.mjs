#!/usr/bin/env node
// Vue SFC 未声明绑定检查器。
//
// 为什么有它(2026-10-01 实测教训): Sidebar.vue 模板里写了 `showUpdate` 却从没在
// <script setup> 里声明 —— 编译不报错、构建不报错, 但点击只写到未跟踪的 ctx 上,
// 不触发重渲染, 表现成"点了没反应 / 过一会儿才弹出"。全仓扫一遍只此一处, 属于
// 静态审查看不见、真机才偶尔露头的一类 bug。
//
// 用法(在仓库根目录):
//   node tools/check-bindings.mjs                  # 扫 web/src 下全部 .vue
//   node tools/check-bindings.mjs web/src/App.vue  # 只扫指定文件
// 退出码: 0 = 全部干净; 1 = 有未声明绑定。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../web/', import.meta.url))
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (n.endsWith('.vue')) out.push(p)
  }
  return out
}

const args = process.argv.slice(2)
const files = args.length ? args : walk('web/src')

let bad = 0
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const { descriptor } = parse(src, { filename: file })
  if (!descriptor.scriptSetup || !descriptor.template) continue
  const script = compileScript(descriptor, { id: 'x' })
  const tpl = compileTemplate({
    source: descriptor.template.content,
    filename: file,
    id: 'x',
    compilerOptions: { bindingMetadata: script.bindings },
  })
  const names = new Set()
  for (const m of tpl.code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  const unknown = [...names].filter((n) => !n.startsWith('$') && !(n in script.bindings))
  if (unknown.length) {
    bad++
    console.log(`${relative(process.cwd(), file)} -> 未声明绑定: ${unknown.join(', ')}`)
  }
}
console.log(bad ? `\n${bad} 个文件有未声明绑定` : `检查 ${files.length} 个文件: 无未声明绑定`)
process.exit(bad ? 1 : 0)
