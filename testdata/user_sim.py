#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""JMComic 用户操作模拟器 v2 — 精确模拟前端 stores/jmcomic.js 真实调用序列。"""
import json
import time
import requests

B = "http://127.0.0.1:3900/api/plugins/jmcomic"
FAILS, PASS = [], []


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
        print("  PASS %s" % name)
    else:
        FAILS.append((name, detail))
        print("  FAIL %s  %s" % (name, str(detail)[:180]))


def main():
    print("=== 1. 搜索(keyword 模式) ===")
    r = requests.get(B + "/search", params={"keyword": "白丝", "page": 1, "mode": "keyword"}, timeout=45)
    d = r.json()
    items = d.get("items", [])
    check("search items", r.status_code == 200 and len(items) > 0, "st=%d items=%d %s" % (r.status_code, len(items), str(d)[:80]))
    check("search id/name", bool(items and items[0].get("id") and items[0].get("name")), "it=%s" % str(items[0])[:80])
    check("search total/page_count", "total" in d and "page_count" in d, "keys=%s" % list(d.keys()))
    pid = items[0]["id"] if items else "1460674"
    print("  pid=%s" % pid)

    print("=== 2. enrichMeta(jmMeta 平铺 author/tags) ===")
    r = requests.get(B + "/meta/%s" % pid, timeout=30)
    m = r.json()
    check("meta 200", r.status_code == 200)
    check("meta author/tags", "author" in m and "tags" in m, "keys=%s" % list(m.keys()))

    print("=== 3. 打开专辑(jmAlbum 顶层) ===")
    r = requests.get(B + "/album/%s" % pid, timeout=30)
    a = r.json()
    check("album 200", r.status_code == 200, "st=%d %s" % (r.status_code, str(a)[:80]))
    check("album id", str(a.get("id")) == str(pid), "id=%s" % a.get("id"))
    check("album name", bool(a.get("name")), "name=%s" % a.get("name"))
    check("album chapters", len(a.get("chapters", [])) > 0, "ch=%d" % len(a.get("chapters", [])))
    chs = a.get("chapters", [])
    cid = chs[1]["cid"] if len(chs) > 1 else (chs[0]["cid"] if chs else "")
    check("album ch cid+name", bool(cid) and "name" in (chs[0] if chs else {}), "ch0=%s" % str(chs[0] if chs else {})[:80])
    check("album authors/related", isinstance(a.get("authors"), list), "keys=%s" % list(a.keys()))

    print("=== 4. 阅读器(jmChapter page_arr + scramble_id) ===")
    r = requests.get(B + "/chapter/%s/%s" % (pid, cid), timeout=40)
    c = r.json()
    check("chapter page_arr", len(c.get("page_arr", [])) > 0, "pages=%d %s" % (len(c.get("page_arr", [])), str(c)[:80]))
    check("chapter scramble", bool(c.get("scramble_id")), "sc=%s" % c.get("scramble_id"))
    check("chapter total", c.get("total") == len(c.get("page_arr", [])), "total=%s pages=%d" % (c.get("total"), len(c.get("page_arr", []))))

    print("=== 5. 阅读器图片(jmImage 真实图+缓存) ===")
    pa = c.get("page_arr", [])
    img_ok = 0
    for i in range(min(3, len(pa))):
        ir = requests.get(B + "/image/%s/%s/%s" % (pid, cid, pa[i]), timeout=60)
        ct = ir.headers.get("Content-Type", "")
        is_img = ir.status_code == 200 and (ct.startswith("image/") or ir.content[:4] in (b"RIFF", b"\xff\xd8\xff", b"\x89PNG"))
        if is_img:
            img_ok += 1
            break
    check("image 真实图", img_ok > 0, "ct=%s st=%d" % (ct, ir.status_code))
    if img_ok:
        t2 = time.time()
        requests.get(B + "/image/%s/%s/%s" % (pid, cid, pa[0]), timeout=10)
        check("image 缓存秒回", time.time() - t2 < 2, "t=%.2fs" % (time.time() - t2))

    print("=== 6. 下载(POST /download/{aid} → GET 状态轮询) ===")
    r = requests.post(B + "/download/%s" % pid, json={}, timeout=20)
    check("start dl 200", r.status_code == 200, "st=%d %s" % (r.status_code, str(r.json())[:80]))
    time.sleep(1.5)
    r = requests.get(B + "/download/%s" % pid, timeout=20)
    d = r.json()
    check("dl 状态字段", all(k in d for k in ("status", "total", "downloaded")), "body=%s" % str(d)[:120])

    print("=== 7. 本子库(jmLibrary cached/total/zip_size) ===")
    r = requests.get(B + "/library", params={"page": 1, "page_size": 45}, timeout=15)
    d = r.json()
    check("library ok", r.status_code == 200 and "page_count" in d, "st=%d keys=%s" % (r.status_code, list(d.keys())))
    lib = d.get("items", [])
    check("library 有下载项", len(lib) > 0, "n=%d" % len(lib))
    if lib:
        chk = all(k in lib[0] for k in ("aid", "name", "cached", "total"))
        check("library item 字段", chk, "it=%s" % str(lib[0])[:100])

    print("=== 8. DELETE 删除本子库条目(do_DELETE) ===")
    r = requests.delete(B + "/library/%s" % pid, timeout=15)
    check("delete 200", r.status_code == 200, "st=%d %s" % (r.status_code, str(r.text)[:80]))

    print("=== 9. 批量(batch start/status/stop) ===")
    r = requests.post(B + "/download/batch", json={"mode": "keyword", "keyword": "百合"}, timeout=15)
    check("batch start", r.status_code in (200, 409), "st=%d %s" % (r.status_code, str(r.json())[:80]))
    time.sleep(2)
    r = requests.get(B + "/download/batch", timeout=15)
    b = r.json()
    check("batch status 字段", all(k in b for k in ("running", "status", "found", "results")), "keys=%s" % list(b.keys()))
    r = requests.post(B + "/download/batch/stop", json={}, timeout=15)
    check("batch stop", r.status_code in (200, 409), "st=%d" % r.status_code)

    print("=== 10. 封面(jmCover 搜索卡片) ===")
    r = requests.get(B + "/cover/%s" % pid, timeout=60)
    check("cover 真图", r.status_code == 200 and (r.headers.get("Content-Type", "").startswith("image/") or r.content[:4] in (b"RIFF", b"\xff\xd8", b"\x89PNG")),
          "st=%d ct=%s" % (r.status_code, r.headers.get("Content-Type")))

    print("\n=== 实时捕捉: PASS %d / FAIL %d ===" % (len(PASS), len(FAILS)))
    for n, dtl in FAILS:
        print("  ❌ %s: %s" % (n, str(dtl)[:250]))
    print(json.dumps({"pass": PASS, "fails": FAILS}, ensure_ascii=False))


if __name__ == "__main__":
    main()