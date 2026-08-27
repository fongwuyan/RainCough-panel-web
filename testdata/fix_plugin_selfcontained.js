// 批量把 6 个 P1 插件前端从 ctx.Vue 改为自带 vue import(自包含)
const fs = require('fs')
const path = require('path')

const plugins = ['aigen', 'laizhangsetu', 'vpn', 'docker', 'mcserver', 'JMComic']

for (const p of plugins) {
  const file = path.join(__dirname, '..', 'plugins', p, 'frontend', 'plugin.js')
  let s = fs.readFileSync(file, 'utf8')
  // 1) 在 export function register 前注入 import vue(若还没有)
  if (!s.includes("import { createApp, h } from 'vue'")) {
    s = s.replace(/export function register\(g\) \{/, "import { createApp, h } from 'vue'\n\nexport function register(g) {")
  }
  // 2) 删除 ctx.Vue 解构两行
  s = s.replace(/const \{ Vue \} = ctx\n\s*const \{ createApp, h \} = Vue\n/, '')
  s = s.replace(/const \{ Vue \} = ctx\n/, '')
  fs.writeFileSync(file, s, 'utf8')
  console.log('fixed', p, '| hasImport:', s.includes("import { createApp, h }"), '| ctxVue left:', s.includes('ctx.Vue'), '| ' + (s.includes('const { Vue }') ? 'WARN still destructuring' : 'clean'))
}