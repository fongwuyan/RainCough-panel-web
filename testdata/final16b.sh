#!/bin/bash
echo "=== touchgal POST /search(正确方法) ==="
curl -s --max-time 20 -X POST http://127.0.0.1:3900/api/plugins/touchgal/search -H 'Content-Type: application/json' -d '{"keyword":"test"}' | head -c 150
echo
echo "=== 其余插件 POST 路由抽查(契约对齐) ==="
echo -n "texttool /text/regex: "
curl -s --max-time 12 -X POST http://127.0.0.1:3900/api/plugins/texttool/text/regex -H 'Content-Type: application/json' -d '{"pattern":"\\d+","text":"abc123"}' | head -c 80
echo
echo -n "webspy /rss/feeds: "
curl -s --max-time 12 http://127.0.0.1:3900/api/plugins/webspy/rss/feeds | head -c 80
echo
echo -n "kvm /info: "
curl -s --max-time 12 http://127.0.0.1:3900/api/plugins/kvm/info | head -c 80
echo
echo -n "mcskin /paint/models: "
curl -s --max-time 15 http://127.0.0.1:3900/api/plugins/mcskin/paint/models | head -c 80
echo
echo -n "ocrqr /ocr/check: "
curl -s --max-time 12 http://127.0.0.1:3900/api/plugins/ocrqr/ocr/check | head -c 80
echo
echo -n "dltool /networktools/download: "
curl -s --max-time 15 http://127.0.0.1:3900/api/plugins/dltool/check | head -c 80