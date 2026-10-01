#!/bin/bash
# 给驱动补丁清单签名（GPG detached, armored）。改了 drivers/registry.json 之后必须重跑本脚本。
#
# 私钥位置（不随仓库分发，仅在你的机器上）：默认 GNUPGHOME=/home/f/nvdl/gpghome
# 用法: GNUPGHOME=/path/to/gnupg bash tools/sign-driver-registry.sh
set -e
GNUPGHOME="${GNUPGHOME:-/home/f/nvdl/gpghome}"
export GNUPGHOME
FPR="${RC_DRIVER_GPG_FPR:-0A2352AEAD9DC527DB9339635F36C10321023648}"
D="$(cd "$(dirname "$0")/.." && pwd)/drivers"

[ -f "$D/registry.json" ] || { echo "找不到 $D/registry.json"; exit 1; }
gpg --batch --armor --export "$FPR" > "$D/pubkey.asc"
gpg --batch --yes --armor --detach-sign -u "$FPR" -o "$D/registry.json.asc" "$D/registry.json"
echo "已签名: $D/registry.json.asc"
echo "指纹:   $FPR"
gpg --verify "$D/registry.json.asc" "$D/registry.json" 2>&1 | tail -2
