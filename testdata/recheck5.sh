#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 5 FAIL 实测 ==="
echo "-- envpkg/run --"
curl -s --max-time 6 -X POST $B/api/envpkg/run -H 'Content-Type: application/json' -d '{}' | head -c 100
echo
echo "-- fm/rename 空参 --"
curl -s --max-time 6 -X POST $B/api/fm/rename -H 'Content-Type: application/json' -d '{}' | head -c 100
echo
echo "-- terminal/input --"
curl -s --max-time 6 -X POST $B/api/terminal/input -H 'Content-Type: application/json' -d '{"session":"s1","data":"ls\n"}' | head -c 100
echo
echo "-- terminal/resize --"
curl -s --max-time 6 -X POST $B/api/terminal/resize -H 'Content-Type: application/json' -d '{"session":"s1","cols":80,"rows":24}' | head -c 100
echo
echo "-- kvm/images --"
curl -s --max-time 15 $B/api/plugins/kvm/images | head -c 150
echo
echo "-- 二进制版本(含新路由?) --"
strings ~/raincough-dev/raincough 2>/dev/null | grep -c 'handleTermInput\|handleEnvRun'
echo "-- 主系统 --"
curl -s --max-time 6 $B/api/system | head -c 120