# 驱动补丁数据（主面板库）

本目录只放**补丁数据**（KB 级）。魔改驱动的官方 `.run` 由面板「驱动」扩展从 NVIDIA 官网下载后**本地打补丁**
（路线 A）：不占仓库容量、不依赖任何第三方打包的驱动二进制，也不执行第三方 shell 脚本。

## 目录

```
drivers/
  registry.json           扩展读取的唯一清单（当前为空，等你放入第一个补丁）
  patches/<id>.patch.json 由 tools/nvpatch.py make 生成（声明式补丁数据，约 1KB/个）
  README.md               本文件
```

扩展取清单的来源阶梯（与系统扩展同一套思路）：主面板库 raw（`raw.githubusercontent.com`）
→ gh-proxy 镜像 → 本地目录 `<面板安装目录>/driver-src/drivers`（离线/手放）。

## 靶点（2026-10-01 真机实测 NVIDIA 580.178.04）

```
sh NVIDIA-Linux-x86_64-<ver>.run --check          # 校验完整性（实测通过）
sh NVIDIA-Linux-x86_64-<ver>.run --extract-only
kernel/nvidia/nv-kernel.o_binary        112,677,456 字节   ← 默认靶点（闭源内核模块）
    sha256 = 5269a23ffba19a17fe16f076463e7ad4151254659441d1711bee6c6221ff6f4b
kernel-open/nvidia/nv-kernel.o_binary    17,319,944 字节   ← 开源内核模块
    sha256 = 43d59d125312df2cfed9231deb1b77a4dd17fa142470a1f9e46e08eff9a046e5
（470/535 一代的靶点在 kernel/nv-kernel.o_binary，用 --target 指定）
```

官方 `.run` 的直链与大小（实测）：
`https://download.nvidia.com/XFree86/Linux-x86_64/<ver>/NVIDIA-Linux-x86_64-<ver>.run`
（580.178.04 = 397,214,534 字节，sha256 `5975a86ee45bffcb626f51ae33d1169b108186a2ea47ad651e72f13fa4b6d6f9`；
`us.download.nvidia.com` 与 `cn.download.nvidia.cn` 实测 403，不用）

## 维护流程

1. 取官方驱动并解包：
   ```
   sh NVIDIA-Linux-x86_64-<ver>.run --check
   sh NVIDIA-Linux-x86_64-<ver>.run --extract-only
   cp -a NVIDIA-Linux-x86_64-<ver>/kernel/nvidia/nv-kernel.o_binary orig.bin
   ```
2. 把你准备好的魔改版拿来，生成补丁数据（工具会闭环校验：重打结果必须逐字节等于魔改版）：
   ```
   python3 tools/nvpatch.py make --original orig.bin --patched patched.bin \
       --target kernel/nvidia/nv-kernel.o_binary --id <id> \
       --out entries/patches/<id>.patch.json
   ```
3. 写 `entries/<id>.entry.json`（卡 PCI ID、驱动版本、收尾动作），再生成清单：
   ```
   python3 tools/build-driver-registry.py --src ./entries --out ./out \
       --base-run NVIDIA-Linux-x86_64-<ver>.run
   ```
4. 把 `out/drivers/registry.json` 与本目录 `patches/*.patch.json` 提交到主面板库的 `drivers/` 下。

提交前自测（不用联网、不用显卡）：
```
python3 tools/serve-driver-repo.py --root ./out --port 8199
curl -s http://127.0.0.1:8199/fongwuyan/RainCough-panel-web/main/drivers/registry.json
```
