#!/bin/bash
cd ~/raincough-dev
echo "=== jsdom 可用? ==="
node -e "require('jsdom'); console.log('jsdom OK')" 2>/dev/null || echo "无 jsdom(web/node_modules 有?)"
node -e "const r = require('./web/node_modules/jsdom'); console.log('web jsdom OK')" 2>/dev/null || echo "web 无 jsdom"
echo "=== playwright 可用? ==="
node -e "require('playwright'); console.log('pw OK')" 2>/dev/null || echo "无 playwright"
ls web/node_modules/ | grep -iE 'jsdom|playwright|puppeteer' | head -5 || echo "(web 无这些)"