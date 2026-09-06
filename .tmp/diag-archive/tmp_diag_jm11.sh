#!/bin/bash
echo "=== JMComic .runtime.log 完整(可能卡半截) ==="
ls -la ~/raincough-dev/plugins/JMComic/.runtime.log 2>/dev/null
cat ~/raincough-dev/plugins/JMComic/.runtime.log 2>/dev/null
echo "--- END ---"
echo "=== JMComic 线程/进程当前状态 ==="
pgrep -af 'JMComic' | head -3
pgrep -af 'jmcomic' | head -3