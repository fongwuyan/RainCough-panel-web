#!/bin/bash
echo "=== 候选 API 域可达性 ==="
for d in "cdn-msp.jmapiproxy1.cc" "cdn-msp.jmapiproxy2.cc" "api.jmcomic.io" "18comic.vip"; do
  echo -n "  $d: "
  getent hosts $d >/dev/null 2>&1 && { R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 "https://$d/" 2>&1); echo "解析OK, http=$R"; } || echo "解析失败"
done
echo "=== jmcomic Python 库可用? ==="
pip3 show jmcomic 2>/dev/null | head -2 || pip3 list 2>/dev/null | grep -i jmcomic || echo "(宿主未装 jmcomic 库)"
echo "=== 官方库内置 API 域(若装了) ==="
python3 -c "from jmcomic import JmOption; print(JmOption.default())" 2>&1 | head -3 || true