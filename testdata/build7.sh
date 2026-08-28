#!/bin/bash
cd ~/raincough-dev
echo "=== 解压新前端 ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 构建 7 个新前端 assets ==="
node tools/build-plugin-frontend.js compress dltool filehash imagetool ocrqr texttool webspy 2>&1 | tail -9
echo "=== 产物大小 ==="
for n in compress dltool filehash imagetool ocrqr texttool webspy; do
  [ -f "plugins/$n/assets/plugin.js" ] && echo "  $n: $(stat -c%s plugins/$n/assets/plugin.js) B" || echo "  $n: 缺!"
done
echo "=== assets 网关可达 ==="
for n in compress dltool filehash imagetool ocrqr texttool webspy; do
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3900/api/plugins/$n/assets/plugin.js")
  echo "  $n: $RC"
done