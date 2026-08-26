#!/bin/bash
echo "=== POST /api/fm/ops 原始返回 ==="
curl -s -i --max-time 5 -X POST http://127.0.0.1:3900/api/fm/ops -H 'Content-Type: application/json' -d '{"op":"archive","paths":["/etc/hostname"],"format":"zip","name":"t"}' | head -12
echo "=== GET 列表 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/fm/ops
echo
echo "=== zip 缺失, 用 python 打包 ==="
python3 -c "import zipfile; z=zipfile.ZipFile('/tmp/fmtest/t.zip','w'); z.write('/tmp/fmtest/a.txt','a.txt'); z.close()" 2>&1
curl -s --max-time 5 -X POST http://127.0.0.1:3900/api/fm/unzip -H 'Content-Type: application/json' -d '{"path":"/tmp/fmtest/t.zip"}' | head -c 80