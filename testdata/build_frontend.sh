#!/bin/bash
# 宿主上构建 uptime 插件前端: 装 esbuild -> build-plugin-frontend.js
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar

echo "=== 安装 esbuild(局部) ==="
mkdir -p web-shim && cd web-shim
test -d node_modules/esbuild || npm install --no-save esbuild@0.21.5 --prefix . 2>&1 | tail -2
cd ~/raincough-dev

echo "=== 构建插件前端 ==="
node -e "
const path = require('path');
const fs = require('fs');
// 用 web-shim 的 esbuild
const esbuild = require(path.join(process.env.HOME, 'raincough-dev', 'web-shim', 'node_modules', 'esbuild'));
const ROOT = process.env.HOME + '/raincough-dev';
const name = 'uptime';
const entry = ROOT + '/plugins/uptime/frontend/plugin.js';
const out = ROOT + '/plugins/uptime/assets/plugin.js';
esbuild.build({ entryPoints: [entry], outfile: out, bundle: true, format: 'iife', external: ['vue'], target: 'es2020' })
  .then(() => console.log('built:', out, fs.statSync(out).size, 'bytes'))
  .catch(e => { console.error('fail:', e.message); process.exit(1) });
" 2>&1 | tail -3
echo "=== 产物 ==="
cat ~/raincough-dev/plugins/uptime/assets/plugin.js 2>/dev/null | head -20