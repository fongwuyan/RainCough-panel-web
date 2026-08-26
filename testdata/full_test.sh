#!/bin/bash
# 全面功能实测: 以界面调用的 API 为准, 标出失败
B=http://127.0.0.1:3900
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1 -> $2"; }

echo "===== 工作台/系统监控 ====="
R=$(curl -s --max-time 6 $B/api/system | head -c 60)
echo "$R" | grep -q '"hostname"' && ok || bad "GET /api/system" "$R"
R=$(curl -s --max-time 6 $B/api/disks | head -c 60)
echo "$R" | grep -q '"disks"' && ok || bad "GET /api/disks" "$R"
R=$(curl -s --max-time 6 $B/api/storage | head -c 40)
echo "$R" | grep -q '"' && ok || bad "GET /api/storage" "$R"

echo "===== 文件管理 ====="
for ep in "list?path=/" "read?path=/etc/hostname" "preview?path=/etc/hostname"; do
  R=$(curl -s --max-time 6 "$B/api/fm/$ep" | head -c 50)
  echo "$R" | grep -qv '"error"' && ok || bad "GET /api/fm/$ep" "$R"
done
R=$(curl -s --max-time 6 "$B/api/fm/ops" | head -c 40)
echo "$R" | grep -q '"tasks"' && ok || bad "GET /api/fm/ops" "$R"

echo "===== 终端 ====="
R=$(curl -s --max-time 6 -X POST $B/api/terminal/open -H 'Content-Type: application/json' -d '{"rows":24,"cols":100}')
echo "$R" | grep -q '"sid"' && ok || bad "POST /api/terminal/open" "$R"
R=$(curl -s --max-time 6 $B/api/terminal/hosts | head -c 40)
echo "$R" | grep -q '\[\|"hosts"' && ok || bad "GET /api/terminal/hosts" "$R"
R=$(curl -s --max-time 6 $B/api/terminal/commands | head -c 40)
echo "$R" | grep -q '\[\|"commands"' && ok || bad "GET /api/terminal/commands" "$R"

echo "===== 任务/定时 ====="
R=$(curl -s --max-time 6 $B/api/tasks | head -c 40)
echo "$R" | grep -q '"tasks"\|"count"' && ok || bad "GET /api/tasks" "$R"
R=$(curl -s --max-time 6 $B/api/scheduler/jobs | head -c 40)
echo "$R" | grep -q '"jobs"' && ok || bad "GET /api/scheduler/jobs" "$R"
R=$(curl -s --max-time 6 $B/api/scheduler/actions | head -c 40)
echo "$R" | grep -q '"actions"' && ok || bad "GET /api/scheduler/actions" "$R"

echo "===== 环境包 ====="
for ep in envs recipes catalog; do
  R=$(curl -s --max-time 6 "$B/api/envpkg/$ep" | head -c 50)
  echo "$R" | grep -q '"envs"\|"recipes"\|"catalog"' && ok || bad "GET /api/envpkg/$ep" "$R"
done

echo "===== 插件市场 ====="
for ep in settings registry; do
  R=$(curl -s --max-time 6 "$B/api/store/$ep" | head -c 60)
  echo "$R" | grep -qv '"error"' && ok || bad "GET /api/store/$ep" "$R"
done

echo "===== 系统中心(19 子 tab) ====="
for ep in "hardware" "users" "clean/scan" "pwr/state" "time/status" "health/check" "boot/history" "ssh/keys?user=f" "disks/fs" "updates/list" "cron/get?user=f" "snapshot/cap" "kernels" "events/timeline?limit=5" "logrotate/list" "service/list" "process/list" "fw/status"; do
  R=$(curl -s --max-time 8 "$B/api/sysfunc/$ep" | head -c 60)
  echo "$R" | grep -qv '"error"' && ok || bad "GET /api/sysfunc/$ep" "$R"
done

echo "===== 媒体中心 ====="
for ep in "roots" "stats" "list?root=%2Fetc"; do
  R=$(curl -s --max-time 6 "$B/api/media/$ep" | head -c 50)
  echo "$R" | grep -qv '"error"' && ok || bad "GET /api/media/$ep" "$R"
done

echo ""
echo "=================================="
echo "通过: $PASS   失败: $FAIL"