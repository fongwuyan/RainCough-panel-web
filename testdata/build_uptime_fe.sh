#!/bin/bash
# 构建 uptime 插件前端(宿主)
cd ~/raincough-dev
tar -xf src.tar 2>/dev/null && rm -f src.tar
node - <<'EOF'
const path = require('path')
const fs = require('fs')
const esbuild = require(path.join(process.env.HOME, 'raincough-dev', 'web-shim', 'node_modules', 'esbuild'))
esbuild.build({
  entryPoints: ['plugins/uptime/frontend/plugin.js'],
  outfile: 'plugins/uptime/assets/plugin.js',
  bundle: true, format: 'iife', external: ['vue'], target: 'es2020'
}).then(() => console.log('built:', fs.statSync('plugins/uptime/assets/plugin.js').size, 'bytes'))
  .catch(x => { console.error('fail:', x.message); process.exit(1) })
EOF