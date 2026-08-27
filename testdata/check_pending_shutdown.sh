#!/bin/bash
echo "=== 是否有挂起的关机 ==="
ls /run/systemd/shutdown/scheduled 2>/dev/null && cat /run/systemd/shutdown/scheduled 2>/dev/null | head -5 || echo "(无 systemd 定时关机)"
cat /run/systemd/shutdown/scheduled 2>/dev/null | grep -iE 'USEC|WALLE|MODE' | head -3
echo "=== shutdown 进程? ==="
pgrep -af 'shutdown|poweroff' | grep -v grep | head -3 || echo "(无)"
echo "=== 最近系统日志关机相关 ==="
journalctl -b --no-pager 2>/dev/null | grep -iE 'shutdown|poweroff|systemd-logind' | grep -iE 'initiate|requested|scheduled' | tail -5 || echo "(无 journal 权限)"
sudo -n cat /var/log/syslog 2>/dev/null | grep -iE 'shutdown|poweroff' | tail -6 || echo "(syslog 不可读)"