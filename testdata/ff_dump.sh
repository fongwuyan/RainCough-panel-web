#!/bin/bash
B=http://127.0.0.1:3900
echo "=== firefox dump webspy 页(等待 SPA 渲染) ==="
timeout 40 firefox --headless --dump-dom "$B/#/plugin/webspy" > /tmp/ws_dom.html 2>/tmp/ff_err.log
echo "DOM 大小: $(stat -c%s /tmp/ws_dom.html 2>/dev/null)"
echo "=== 搜索关键 UI 元素(firefox 渲染后) ==="
grep -c 'section-title\|搜索\|RSS' /tmp/ws_dom.html 2>/dev/null || echo "0"
grep -oE '采集解析|简介|搜索|RSS|正文提取' /tmp/ws_dom.html | sort | uniq -c | head -8
echo "=== 是否含 PluginView 非 generic 标记 ==="
grep -oE '__rcPlugin_webspy|加载插件前端失败|GenericPlugin' /tmp/ws_dom.html | head -3
echo "=== firefox stderr(错误) ==="
tail -5 /tmp/ff_err.log