#!/bin/bash
echo "=== 搜索引擎已知的 JM 镜像域可达性 ==="
for d in "api.jm-comic.vip" "api.jmcomic.fun" "api.jmcomic.win" "api.18comic-fan.org" "www.18comic.vip" "api.18comic.vip"; do
  echo -n "  $d: "
  getent hosts $d >/dev/null 2>&1 && { R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://$d/" 2>&1); echo "解析OK http=$R"; } || echo "解析失败"
done
echo "=== web 搜索确认当前可用镜像(次轮) ==="