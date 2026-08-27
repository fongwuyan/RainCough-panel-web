#!/bin/bash
echo "=== RC_SUDO_PW 是否注入主系统 ==="
grep -rn 'RC_SUDO_PW\|sudoPW\|sudo_pw' ~/raincough-dev/cmd/raincough/*.go 2>/dev/null | grep -v test | head -6
echo "=== 主系统启动 cmd 是否带 --sudo-pw ==="
pgrep -af 'raincough -port' | head -2
echo "=== kvm 插件能读的 sudo_pw 配置 ==="
python3 -c "import json; print(json.load(open('/home/f/raincough-dev/plugins/kvm/config.json')))" 2>/dev/null || echo "(无 config.json 或不可读)"