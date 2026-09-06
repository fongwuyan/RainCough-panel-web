#!/usr/bin/env python3
import requests, json
# 直连各 python 端口试 search, 找 JMComic 子进程
for port in [38799, 38803, 46869, 38823]:
    try:
        r = requests.get("http://127.0.0.1:%d/search?keyword=test&page=1&mode=keyword" % port, timeout=8)
        body = r.text[:80]
        print("port %s: HTTP %d %s" % (port, r.status_code, body))
    except Exception as e:
        print("port %s: ERR %s" % (port, str(e)[:50]))