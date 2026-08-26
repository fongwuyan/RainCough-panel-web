#!/bin/bash
echo "=== sys/processes ==="
curl -s --max-time 6 "http://127.0.0.1:3900/api/sys/processes?sort=cpu" | head -c 200
echo
echo "=== scheduler 兼容字段 ==="
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/scheduler/jobs -H 'Content-Type: application/json' -d '{"name":"s1","cron":"0 4 * * *","action":"shell","params":{"cmd":"ls"}}' | head -c 220
echo
echo "=== media roots(name) ==="
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/media/roots -H 'Content-Type: application/json' -d '{"roots":[{"name":"etc","label":"ETC","path":"/etc"}]}'
echo
curl -s --max-time 6 http://127.0.0.1:3900/api/media/roots
echo
echo "=== media list(by name) ==="
curl -s --max-time 8 "http://127.0.0.1:3900/api/media/list?root=etc" | head -c 150
echo
echo "=== envpkg catalog ==="
curl -s --max-time 6 http://127.0.0.1:3900/api/envpkg/catalog | head -c 200
echo