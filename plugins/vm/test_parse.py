"""虚拟机的解析函数单元测试。

用宿主上真实采集的 virsh 输出做样本(_vmtest/*.txt), 避免"自己编数据自己测"。
运行: python3 plugins/vm/test_parse.py
"""
import os
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

SAMPLE = os.path.join(HERE, "testdata")

import server_v4 as vm  # noqa: E402

FAILS = []


def check(cond, label, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + label + (("  " + str(detail)) if detail and not cond else ""))
    if not cond:
        FAILS.append(label)


def read(name):
    with open(os.path.join(SAMPLE, name), "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def test_state():
    print("\n[状态归一化]")
    cases = [
        ("shut off", "shutoff"), ("running", "running"), ("paused", "paused"),
        ("crashed", "crashed"), ("in shutdown", "shutdown"), ("pmsuspended", "pmsuspended"),
        ("blocked", "blocked"), ("", ""),
    ]
    for raw, want in cases:
        got = vm._state_from_text(raw)
        check(got == want, "%-14r -> %-12s" % (raw, want), "实得 %r" % got)

    # 中文输入不应崩(虽然我们强制 C locale, 防御一下)
    got = vm._state_from_text("关闭")
    check(isinstance(got, str), "中文状态不崩(返回 %r)" % got)

    # domstats 的 state.state 编码
    check(vm.STATE_BY_CODE[1] == "running", "state.state=1 -> running")
    check(vm.STATE_BY_CODE[5] == "shutoff", "state.state=5 -> shutoff")


def test_parse_list():
    print("\n[解析 list --all]")
    txt = read("list_all.txt")
    items = vm._parse_list_all(txt)
    check(len(items) == 3, "解析出 3 台虚拟机", "实得 %d" % len(items))
    names = [x["name"] for x in items]
    check(names == ["rc-deploy", "rc-ref", "ubuntu24"], "名称顺序正确", names)
    check(all(x["state"] == "shutoff" for x in items), "状态全部 shutoff",
          [x["state"] for x in items])
    check(all(x["id"] == 0 for x in items), "关闭态 id 为 0", [x["id"] for x in items])

    # 表头与分隔线不能被当成数据
    check(not any(x["name"].lower() == "name" for x in items), "表头未被误解析")
    # 空输入
    check(vm._parse_list_all("") == [], "空输入返回空列表")


def test_parse_domstats():
    print("\n[解析 domstats]")
    txt = read("domstats.txt")
    blocks = vm._parse_domstats(txt)
    check(set(blocks.keys()) == {"rc-deploy", "rc-ref", "ubuntu24"},
          "按域分块正确", list(blocks.keys()))

    d = blocks["rc-deploy"]
    check("state.state" in d, "含 state.state")
    check(d.get("state.state") == "5", "rc-deploy state.state=5(关闭)", d.get("state.state"))
    check("vcpu.maximum" in d, "含 vcpu.maximum", d.get("vcpu.maximum"))
    check("block.count" in d, "含 block.count")

    # 关键: 每个域的 block.N 索引各自独立, 不能跨域合并
    for name, kv in blocks.items():
        idx = [k for k in kv if k.startswith("block.") and k.endswith(".name")]
        cnt = int(float(kv.get("block.count", 0)))
        check(len(idx) == cnt, "%s 的 block 条目数(%d)与 block.count(%d)一致" % (name, len(idx), cnt))


def test_parse_pools():
    print("\n[解析 pool-list --details]")
    txt = read("pools.txt")
    rows = []
    for line in txt.splitlines():
        s = line.strip()
        if not s or set(s) <= set("-") or s.lower().startswith("name"):
            continue
        parts = s.split()
        if len(parts) >= 5:
            rows.append(parts[0])
    check(rows == ["boot", "images", "rcvm"], "解析出 3 个存储池", rows)


def test_domstats_parse_kv():
    print("\n[domstats key=value]")
    kv = vm._parse_kv("a=1\nb=x y\n  c = 3 \n")
    check(kv.get("a") == "1", "简单键值")
    check(kv.get("b") == "x y", "值含空格")
    check(kv.get("c") == "3", "键值两侧空白被去掉", kv)


def test_xml_detail():
    print("\n[XML 解析]")
    txt = read("dumpxml.xml")
    root = ET.fromstring(txt)
    check(vm._txt(root, "name") == "rc-deploy", "读到 name")
    check(vm._txt(root, "vcpu") == "2", "读到 vcpu=2", vm._txt(root, "vcpu"))
    check(vm._attr(root, "os/type", "arch") == "x86_64", "读到 os arch")

    mem = vm._txt(root, "memory", "0")
    check(vm._byte_to_mb(mem) == 3072.0, "内存 3145728 KiB -> 3072 MB",
          vm._byte_to_mb(mem))

    disks = root.findall("devices/disk")
    check(len(disks) >= 2, "至少 2 个磁盘(系统盘+cdrom)", len(disks))
    check(vm._attr(disks[0], "target", "dev") == "vda", "第一个磁盘 target=vda",
          vm._attr(disks[0], "target", "dev"))

    nets = root.findall("devices/interface")
    check(len(nets) >= 1, "至少 1 个网卡")
    check(vm._attr(nets[0], "mac", "address").startswith("52:54:00"), "MAC 前缀正确",
          vm._attr(nets[0], "mac", "address"))

    gs = [g for g in root.findall("devices/graphics") if g.get("type") == "vnc"]
    check(len(gs) == 1, "有 1 个 VNC 图形设备")


def test_safe_name():
    print("\n[名称校验]")
    ok_names = ["vm1", "web-01", "a.b_c", "A1"]
    for n in ok_names:
        try:
            vm._safe_name(n)
            check(True, "接受 %r" % n)
        except Exception as e:  # noqa: BLE001
            check(False, "接受 %r" % n, e)

    bad = ["", "-x", "../etc", "a b", "a;rm -rf /", "中文名", "a" * 70, "x/y"]
    for n in bad:
        try:
            vm._safe_name(n)
            check(False, "拒绝 %r" % n, "竟然通过了")
        except Exception:
            check(True, "拒绝 %r" % n)


def test_fmt_bytes():
    print("\n[字节格式化]")
    for v, want in [(0, "0 B"), (1023, "1023 B"), (1024, "1.0 KB"),
                    (1048576, "1.0 MB"), (1073741824, "1.0 GB")]:
        got = vm._fmt_bytes(v)
        check(got == want, "%-12d -> %s" % (v, want), got)


def main():
    if not os.path.isdir(SAMPLE):
        print("缺少样本目录 %s, 先采集 virsh 输出" % SAMPLE)
        return 1
    test_state()
    test_parse_list()
    test_parse_domstats()
    test_parse_pools()
    test_domstats_parse_kv()
    test_xml_detail()
    test_safe_name()
    test_fmt_bytes()

    print("\n" + "=" * 50)
    if FAILS:
        print("失败 %d 项:" % len(FAILS))
        for f in FAILS:
            print("  -", f)
        return 1
    print("全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
