#!/bin/bash
echo "=== 1. 关机/启动时间线(判断是否周期/间隔规律) ==="
last -x 2>/dev/null | grep -iE 'shutdown|reboot|system boot|system down' | head -20
echo
echo "=== 2. uptime 当前 ==="
uptime
echo
echo "=== 3. 系统级定时器(所有) ==="
systemctl list-timers --all --no-pager 2>/dev/null | head -25
echo
echo "=== 4. at 队列(一次性定时任务!) ==="
atq 2>/dev/null || echo "(无 atq 或无 at 权限)"
echo
echo "=== 5. crontab 全局+用户 ==="
cat /etc/crontab 2>/dev/null | grep -vE '^#|^$' | head -8 || echo "(无)"
crontab -l 2>/dev/null | grep -vE '^#|^$' | head -8 || echo "(用户 cron 空)"
ls /etc/cron.d/ 2>/dev/null && echo "--- cron.d 内容 ---" && grep -rE 'shutdown|poweroff|reboot|halt' /etc/cron.d/ /etc/cron.hourly/ /etc/cron.daily/ 2>/dev/null | head -5 || echo "(cron.d 无)"
echo
echo "=== 6. logind 电源策略(空闲自动关机?) ==="
grep -rE 'IdleAction|HandlePowerKey|KillUserProcesses' /etc/systemd/logind.conf /etc/systemd/logind.conf.d/* 2>/dev/null | head -6 || echo "(logind 默认)"
systemctl show systemd-logind 2>/dev/null | grep -iE 'IdleAction|IdleActionSec' | head -3
echo
echo "=== 7. 桌面电源管理(gnome) ==="
timeout 3 dbus-send --system --print-reply --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.GetCriticalAction 2>/dev/null | tail -2 || echo "(UPower 不可查)"
gsettings get org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 2>/dev/null || echo "(gsettings 不可用)"
echo
echo "=== 8. 关机请求来源记录(auth.log) ==="
sudo -n grep -iE 'shutdown|poweroff|halt' /var/log/auth.log 2>/dev/null | tail -10 || grep -iE 'shutdown|poweroff' /var/log/auth.log 2>/dev/null | tail -10 || echo "(auth.log 不可读)"
echo
echo "=== 9. 系统是否有 watchdog/acpid ==="
pgrep -af 'watchdog|acpid' | head -3 || echo "(无 watchdog/acpid)"
echo
echo "=== 10. journal 里 root 执行的 shutdown 命令 ==="
journalctl -b --no-pager 2>/dev/null | grep -iE 'shutdown -|poweroff|systemctl poweroff|logind.*Shutdown' | tail -8 || echo "(journal 不可用)"