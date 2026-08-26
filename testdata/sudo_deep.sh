#!/bin/bash
echo "=== sudoers.d/touchgal-disk 内容 ==="
cat /etc/sudoers.d/touchgal-disk 2>/dev/null
echo "=== f 完整的 sudo 权限 ==="
sudo -n -l 2>&1 | tail -8
echo "=== GitHub 仓库可访问性 ==="
curl -s -o /dev/null -w "plugin repo: %{http_code}\n" --max-time 8 "https://api.github.com/repos/fongwuyan/RainCough-Plugin"
curl -s --max-time 8 "https://api.github.com/repos/fongwuyan/RainCough-Plugin/contents/registry.json" | head -c 150