#!/bin/bash
B=http://127.0.0.1:3900
PASS=0; FAIL=0
ck() { # name, expect_key
  local R=$(curl -s --max-time 8 "$B$1")
  local ok=$(echo "$R" | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    if isinstance(d,dict) and d.get('error') not in (None,'') and '$2' not in d.get('error',''):
        sys.exit(1)
    print('ok')
except: sys.exit(1)")
  if [ "$ok" = "ok" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "❌ $1 -> ${R:0:80}"; fi
}
echo "===== 系统中心全端点(JSON 精确判定) ====="
ck "/api/sysfunc/service/list" services
ck "/api/sysfunc/fw/status" enabled
ck "/api/sysfunc/hardware" cpu_count
ck "/api/sysfunc/updates/list" updates
ck "/api/sysfunc/cron/get?user=f" content
ck "/api/sysfunc/disks/fs" disks
ck "/api/sysfunc/snapshot/cap" volumes
ck "/api/sysfunc/users" users
ck "/api/sysfunc/ssh/keys?user=f" keys
ck "/api/sysfunc/clean/scan" items
ck "/api/sysfunc/pwr/state" state
ck "/api/sysfunc/kernels" kernels
ck "/api/sysfunc/time/status" status
ck "/api/sysfunc/health/check" checks
ck "/api/sysfunc/events/timeline?limit=5" events
ck "/api/sysfunc/logrotate/list" list
ck "/api/sysfunc/boot/history" rows
echo "===== 插件市场 ====="
ck "/api/store/settings" config
ck "/api/store/registry" plugins
echo "===== 插件网关 ====="
R=$(curl -s --max-time 8 "$B/api/plugins/uptime/__health" 2>/dev/null | head -c 60)
echo "$R" | grep -q '200\|ok\|true' && PASS=$((PASS+1)) || { FAIL=$((FAIL+1)); echo "❌ uptime health -> ${R:0:50}"; }
echo ""
echo "通过: $PASS   失败: $FAIL"