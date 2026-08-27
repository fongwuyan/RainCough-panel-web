#!/bin/bash
echo "=== 内核日志(崩溃) ==="
sudo -n dmesg 2>/dev/null | grep -iE 'panic|oom|killed process|thermal|hardware error|watchdog' | tail -8 || dmesg 2>/dev/null | grep -iE 'panic|oom|killed|thermal' | tail -8 || echo "(dmesg 不可用)"
echo "=== journal 崩溃记录 ==="
journalctl -b -1 -p err --no-pager 2>/dev/null | tail -10 || echo "(journal 无权限或不可用)"
echo "=== 当前负载/内存 ==="
free -h | head -2
echo "=== 谁在重启? 用户进程? ==="
ps aux --sort=-rss 2>/dev/null | head -6
echo "=== /var/log/syslog 崩溃段 ==="
grep -aiE 'panic|oom|killed process' /var/log/syslog 2>/dev/null | tail -6 || echo "(无 syslog 权限)"