#!/bin/bash
PW='1'
echo "=== 带 root 查 shutdown 命令来源 ==="
echo "$PW" | sudo -S journalctl --since '2026-08-27 17:00' --no-pager 2>/dev/null | grep -iE 'shutdown|poweroff|System is going down|logind.*(Power|Halt|Reboot)' | head -20
echo "=== PAUSE - grep Our deployment timestamps ==="
echo "=== auth.log 里 sudo shutdown ==="
echo "$PW" | sudo -S grep -iE 'shutdown|poweroff|COMMAND=.*shutdown' /var/log/auth.log 2>/dev/null | tail -12