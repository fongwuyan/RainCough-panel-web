#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 插件独立前端资产(PluginView 将 import) ==="
for pl in uptime aigen laizhangsetu vpn docker mcserver JMComic; do
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$B/api/plugins/$pl/assets/plugin.js")
  echo "  $pl/assets/plugin.js -> $RC"
done
echo "=== 验证产物含 mount 契约 ==="
curl -s --max-time 5 "$B/api/plugins/aigen/assets/plugin.js" | grep -c '__rcPlugin_aigen'
curl -s --max-time 5 "$B/api/plugins/uptime/assets/plugin.js" | grep -c '__rcPlugin_uptime'
echo "=== 插件路由仍通 ==="
curl -s --max-time 5 "$B/api/plugins/aigen/models" | head -c 80
echo
echo "=== srv.log PluginView 相关错误? ==="
grep -ai 'pluginview\|assets' ~/raincough-dev/srv.log | tail -3 || echo "(无错误)"