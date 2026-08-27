#!/bin/bash
echo "=== 定时关机/重启任务 ==="
crontab -l 2>/dev/null | grep -iE 'shutdown|poweroff|reboot|halt' || echo "(用户 cron 无)"
sudo -n cat /etc/crontab 2>/dev/null | grep -iE 'shutdown|reboot' || echo "(系统 cron 无或需密码)"
ls /etc/cron.d/ 2>/dev/null && grep -rliE 'shutdown|reboot|poweroff' /etc/cron.d/ 2>/dev/null || echo "(/etc/cron.d 无)"
echo "=== systemd 定时器(关机相关) ==="
systemctl list-timers --all 2>/dev/null | grep -iE 'shutdown|power|halt' | head -5 || echo "(无)"
echo "=== 上次关机/启动时间 ==="
who -b 2>/dev/null
last -x 2>/dev/null | grep -iE 'shutdown|reboot' | head -6
echo "=== uptime ==="
uptime
echo "=== 电源管理(临时禁用?) ==="
cat /sys/power/autosleep 2>/dev/null || true
cat /sys/module/autosleep/parameters/enabled 2>/dev/null || true
echo "=== 是否有后台脚本在定时关机 ==="
grep -rliE 'shutdown|poweroff' ~/ 2>/dev/null --include='*.sh' | grep -v raincough-dev/testdata | head -5 || echo "(home 无可疑脚本)"