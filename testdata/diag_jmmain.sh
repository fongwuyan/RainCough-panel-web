#!/bin/bash
cd ~/raincough-dev
JS=public/assets/index-qCUIw25T.js
echo "=== 主 bundle 含 JmMain? ==="
grep -c '章节列表' $JS
echo "=== 独立插件 chunk? ==="
ls public/assets/ | head -8
echo "=== 本地 JmMain 该段源码 ==="
grep -nE 'chapters\.length|downloaded|/total' /home/f/raincough-dev/web/src/components/jmcomic/JmMain.vue 2>/dev/null | head -6 || echo "(宿主 JmMain 无)"
grep -nE 'chapters\.length|downloaded|/total' /home/f/raincough-dev/web/src/components/jmcomic/JmReader.vue 2>/dev/null | head -6 || echo "(宿主 JmReader 无)"