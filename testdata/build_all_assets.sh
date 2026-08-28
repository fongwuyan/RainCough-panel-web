#!/bin/bash
cd ~/raincough-dev
echo "=== 构建全部带 frontend 插件的 assets ==="
node tools/build-plugin-frontend.js 2>&1 | tail -12
echo "=== 重建后 uptime 等 assets 可达 ==="
for n in aigen docker laizhangsetu mcserver uptime vpn JMComic; do
  if [ -f "plugins/$n/assets/plugin.js" ]; then
    echo "  $n: $(stat -c%s plugins/$n/assets/plugin.js) B"
  else
    echo "  $n: (无 assets)"
  fi
done