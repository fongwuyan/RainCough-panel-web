#!/bin/bash
echo "=== 宿主 PluginView.vue 是否新版(含 __rcPlugin 动态加载) ==="
grep -c '__rcPlugin' ~/raincough-dev/web/src/components/PluginView.vue
grep -c 'VueExports' ~/raincough-dev/web/src/components/PluginView.vue
echo "=== 宿主 PluginView 关键行 ==="
grep -nE '__rcPlugin|assets/plugin|import \* as Vue' ~/raincough-dev/web/src/components/PluginView.vue | head -8
echo "=== git HEAD 上 PluginView ==="
cd ~/raincough-dev 2>/dev/null
ls -la web/src/components/PluginView.vue