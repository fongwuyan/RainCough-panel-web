#!/bin/bash
echo "=== JMComic 子进程(38477)直连 ==="
curl -s --max-time 5 http://127.0.0.1:38477/__health; echo
curl -s --max-time 25 "http://127.0.0.1:38477/search?keyword=test&page=1&mode=keyword" | head -c 120
echo
echo "=== 主网关 search ==="
curl -s --max-time 25 "http://127.0.0.1:3900/api/plugins/jmcomic/search?keyword=test&page=1&mode=keyword" | head -c 120
echo
echo "=== 主网关到底转发到哪个端口(JMComic) ==="
# 网关记录: 看 srv.log 无; 直接访问对比
curl -s --max-time 25 "http://127.0.0.1:3900/api/plugins/jmcomic/search?keyword=%E7%99%BD%E4%B8%9D&page=1&mode=keyword" -H 'Content-Type: application/json' | head -c 150