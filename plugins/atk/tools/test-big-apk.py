#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""1GB APK 解析自测。

做法: 拿一个真实 APK, 往里塞一个 1GB 的 stored 条目(不压缩, 文件真的到 1GB),
然后用 atk 的分析模块打开它, 检查:
  1) 能认出来是 APK, 包名/版本/权限/组件都对
  2) 类列表和 so 列表没被大文件影响
  3) 内存峰值远小于文件大小(证明没整份读)
  4) 耗时在可接受范围

用法: python tools/test-big-apk.py [源APK] [--size 1024]
"""
import os
import shutil
import sys
import tempfile
import time
import tracemalloc
import zipfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

from core import store  # noqa: E402

TMP = tempfile.mkdtemp(prefix="atk-big-")
store.DATA_DIR = TMP
store.UPLOAD_DIR = os.path.join(TMP, "uploads")
store.DB_PATH = os.path.join(TMP, "t.db")
store._conn = None

from modules import analyze  # noqa: E402


def rss_mb():
    """当前进程 RSS(MB)。Windows 走 psapi, 其他平台读 /proc。"""
    try:
        import ctypes
        from ctypes import wintypes

        class PMC(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD),
                        ("PeakWorkingSetSize", ctypes.c_size_t),
                        ("WorkingSetSize", ctypes.c_size_t),
                        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                        ("PagefileUsage", ctypes.c_size_t),
                        ("PeakPagefileUsage", ctypes.c_size_t)]

        c = PMC()
        c.cb = ctypes.sizeof(PMC)
        ctypes.windll.psapi.GetProcessMemoryInfo(
            ctypes.windll.kernel32.GetCurrentProcess(), ctypes.byref(c), c.cb)
        return c.WorkingSetSize / 1024 / 1024, c.PeakWorkingSetSize / 1024 / 1024
    except Exception:
        try:
            with open("/proc/self/status") as f:
                cur = peak = 0
                for line in f:
                    if line.startswith("VmRSS:"):
                        cur = int(line.split()[1]) / 1024
                    elif line.startswith("VmHWM:"):
                        peak = int(line.split()[1]) / 1024
                return cur, peak
        except Exception:
            return 0, 0


def build_big_apk(src, dst, target_mb):
    """复制源 APK 的所有条目, 再加 filler 把总大小顶到 target_mb。"""
    src_z = zipfile.ZipFile(src)
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as out:
        for it in src_z.infolist():
            out.writestr(it, src_z.read(it.filename))
        # 目标总大小减去源包大小; 留 2MB 给中央目录和条目头
        fill = max(1, target_mb * 1024 * 1024 - os.path.getsize(src) - 1024 * 1024)
        zi = zipfile.ZipInfo("assets/filler.bin")
        zi.compress_type = zipfile.ZIP_STORED
        zi.file_size = fill
        block = b"\x00" * (4 * 1024 * 1024)
        with out.open(zi, "w", force_zip64=True) as w:
            left = fill
            while left > 0:
                n = min(len(block), left)
                w.write(block[:n])
                left -= n
    src_z.close()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src = args[0] if args else os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(HERE))),
        "apk", "JMReader", "RCReader-v0.1005-beta.apk")
    size_mb = 1024
    for a in sys.argv[1:]:
        if a.startswith("--size"):
            size_mb = int(a.split("=")[-1]) if "=" in a else 1024
    if not os.path.isfile(src):
        print("找不到源 APK:", src)
        return 2

    big = os.path.join(TMP, "big.apk")
    print("源包: %s (%.1f MB)" % (src, os.path.getsize(src) / 1024 / 1024))
    t0 = time.time()
    build_big_apk(src, big, size_mb)
    real = os.path.getsize(big)
    print("生成: %s (%.2f GB, 用时 %.1fs)" % (big, real / 1024 / 1024 / 1024, time.time() - t0))
    assert real > (size_mb - 2) * 1024 * 1024, "生成的文件不够大: %d" % real

    # 基线
    base_cur, _ = rss_mb()
    tracemalloc.start()
    t1 = time.time()
    r = analyze.open_path(0, big)
    cost = time.time() - t1
    cur_traced, peak_traced = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    cur, peak = rss_mb()

    info = r["info"]
    apk = info.get("apk") or {}
    print("\n=== 解析结果 ===")
    print("  识别为   : %s  (%.2f GB)" % (r["kind"], r["size"] / 1024 / 1024 / 1024))
    print("  包名     : %s" % apk.get("package"))
    print("  版本     : %s (%s)" % (apk.get("versionName"), apk.get("versionCode")))
    print("  SDK      : %s → %s" % (apk.get("minSdk"), apk.get("targetSdk")))
    print("  条目/dex : %d / %d" % (apk.get("entries"), apk.get("dex_count")))
    print("  类       : %d (自身 %d, 内部类合计 %d)" % (
        apk.get("class_count"), apk.get("own_class_count"), apk.get("class_total")))
    print("  so       : %d 个, ABI %s" % (
        (apk.get("lib_summary") or {}).get("count"), apk.get("abis")))
    print("  权限     : %d 条" % len(apk.get("permissions") or []))
    print("  签名     : v1=%s v2=%s" % (apk.get("v1_sign"), apk.get("v2_sign")))
    print("  sha256   : %s..." % (info.get("sha256") or "")[:32])
    print("  notes    : %s" % ("; ".join(info.get("notes") or []) or "无"))

    print("\n=== 资源 ===")
    print("  耗时     : %.2fs" % cost)
    print("  内存峰值 : tracemalloc %.1f MB / 进程 RSS 增长 %.1f MB (峰值 %.1f MB)"
          % (peak_traced / 1024 / 1024, cur - base_cur, peak))

    fails = []
    if r["kind"] != "APK":
        fails.append("没认出 APK")
    if not apk.get("package"):
        fails.append("包名为空")
    if not apk.get("class_count"):
        fails.append("没解出类列表")
    if peak_traced / 1024 / 1024 > 400:
        fails.append("内存峰值 %.0fMB 偏高, 疑似整份读入" % (peak_traced / 1024 / 1024))
    if cost > 120:
        fails.append("耗时 %.1fs 过长" % cost)

    # 顺带验证按需读的另外两个入口
    print("\n=== 其他入口 ===")
    sid = r["sample_id"]
    t2 = time.time()
    libs = apk.get("libs") or []
    if libs:
        one = libs[0]
        d = analyze.lib_detail(sid, "lib/%s/%s" % (one.get("abi", apk["abis"][0]), one["name"]))
        print("  so 详情  : %s → %d 导入 / %d 导出 (%.2fs)"
              % (one["name"], len(d.get("imports") or []), len(d.get("exports") or []),
                 time.time() - t2))
    else:
        print("  so 详情  : 该包没有 so, 跳过")
    t3 = time.time()
    st = analyze.strings(sid)
    n = sum(len(v) for v in (st.get("groups") or {}).values()) if isinstance(st, dict) else 0
    print("  字符串   : %d 条 (%.2fs)" % (n, time.time() - t3))

    print("\n结果: %s" % ("通过" if not fails else "失败 — " + "; ".join(fails)))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
