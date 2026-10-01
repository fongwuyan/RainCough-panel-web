# 驱动补丁数据（主面板库）

本目录只放**补丁数据**（KB 级）。魔改驱动的官方 `.run` 由面板「驱动」扩展从 NVIDIA 官网下载后**本地打补丁**
（路线 A）：不占仓库容量、不下载任何第三方打包的驱动二进制、也不执行第三方 shell 脚本 —— 补丁是**数据**。

## 目录

```
drivers/
  registry.json            扩展读取的唯一清单
  entries/<id>.entry.json  条目元数据（卡、版本、收尾动作）—— 构建输入，也留档
  patches/<id>.patch.json  声明式补丁数据（find/replace 十六进制 + 期望命中数）
  README.md                本文件
```

扩展取清单的来源阶梯：主面板库 raw（`raw.githubusercontent.com`）→ gh-proxy 镜像 →
本地目录 `<面板安装目录>/driver-src/drivers`（离线/手放）→（仅私有化时）令牌。

## 当前条目

| 条目 | 适用卡（PCI ID） | 驱动版本 | 靶点 | 官方 `.run` | 补丁结果 sha256 |
|---|---|---|---|---|---|
| `p1xx-580.178.04` | P102-100 `1b07`、**P104-100 `1b87`**、P104-101 `1bc7`、**P106-100 `1c07`**、P106-090 `1c09` | 580.178.04 | `kernel/nvidia/nv-kernel.o_binary` | 397,214,534 B<br>`5975a86e…b6d6f9` | `715fb477…aca647` |
| `cmp-615.71.09` | CMP 50HX `1e09`、40HX `1f0b`、170HX `2082`/`20c2`、**30HX `2189`**、90HX `220d`、70HX `248a` | 615.71.09 | 同上 | 529,618,784 B<br>`cdceed22…3b70fe` | `5b588fa1…d56670` |

收尾动作：两条都 `blacklist-nouveau` + `initramfs`；CMP 那条另加 `gsp-off`（Turing/Ampere 建议关闭 GSP 固件）。
前置依赖：`dkms`、`linux-headers-<kver>`、`build-essential`。两条都 `reboot_required`。

## 已验证（2026-10-01，Debian 12 真机，无需显卡）

| 验证 | 结果 |
|---|---|
| 两个官方 `.run` 的 `sh --check` + sha256 | 通过（哈希见上表） |
| 两个版本未打补丁时的靶点 sha256 | 580: `5269a23f…ff6f4b`（112,677,456 B）；615: `56a870c6…a919bc`（115,549,872 B） |
| **我们的补丁 vs 上游 `linux.sh`，逐字节比对** | 全表：580 `6896e5cb…` / 615 `912ec2ca…` 一致；只取该行：580 `715fb477…` / 615 `5b588fa1…` 一致 —— 4/4 通过 |
| 补丁文件 sha256 与 `registry.json` 声明 | 一致（p1xx `87daae10…`、cmp `2e97b2d2…`） |
| 命中次数 | 两个 pattern 在各自驱动里都恰好命中 1 处（`expect_hits: 1`） |

> 说明：上游 `linux.sh` 本质是 `sed s/search/replace/g` 的 pattern 表；我们把它的表**程序化提取**后转成
> 声明式补丁数据（命中数取自真实文件），因此"与上游一致"是被实测过的，而不是照抄声明。

## 维护流程（新增一张卡/一个版本）

1. 下载并解包官方驱动：
   ```
   sh NVIDIA-Linux-x86_64-<ver>.run --check
   sh NVIDIA-Linux-x86_64-<ver>.run --extract-only
   ```
   靶点：`NVIDIA-Linux-x86_64-<ver>/kernel/nvidia/nv-kernel.o_binary`
   （开核模块版在 `kernel-open/nvidia/nv-kernel.o_binary`；470/535 一代在 `kernel/nv-kernel.o_binary`）
2. 备好 pattern 表（每行 `名称|search_hex|replace_hex`）。用上游的 `linux.sh` 时可直接提取：
   ```
   sed -n '/^PATTERNS=(/,/^)/p' linux.sh | grep '|' | sed 's/^[[:space:]]*//; s/,$//' | tr -d '"' > patterns.txt
   ```
3. 生成补丁数据（工具会校验长度、统计命中数、算出结果哈希）：
   ```
   python3 tools/nvpatch.py from-patterns \
       --file NVIDIA-Linux-x86_64-<ver>/kernel/nvidia/nv-kernel.o_binary \
       --patterns patterns.txt --only P1xx --id <id> --out patches/<id>.patch.json
   ```
4. 在**原始**驱动上 dry-run 复核（不写文件）：
   ```
   python3 tools/nvpatch.py apply --file <靶点> --patch patches/<id>.patch.json
   ```
5. 写 `entries/<id>.entry.json`（卡 PCI ID、驱动版本、`base.size_b`/`sha256_expected`、收尾动作），生成清单：
   ```
   python3 tools/build-driver-registry.py --src drivers --out . --no-readme
   ```
6. 提交 `registry.json` 与 `patches/`。（`entries/` 一起提交，便于以后重建清单。）

## 注意

- 补丁**只把矿卡的设备 ID 改成 `0xffff`**（上游做法），作用是让官方驱动不再把它当"非零售型号"处理。
- 一张卡能在 Linux 上真正跑起来，还取决于目标机器（内核/headers/dkms/关闭 Secure Boot、重启后加载新模块）。
  **本目录的验证覆盖到"补丁字节与上游一致 + 命中数正确"，硬件侧启用需在插卡机器上确认。**
- 分卷/大文件上传的路线（`nvidia-run`）在清单 schema 里**预留但当前不用**；本仓库不放大文件。
