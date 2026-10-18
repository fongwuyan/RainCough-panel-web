#!/usr/bin/env bash
# ============================================================================
# 打包 Release 资产: dist/raincough-linux-x86_64-<版本>.tar.gz
#
#   用法: tools/pack-release.sh [版本]
#         不给版本则读仓库根 VERSION
#
# 做的事(顺序固定, 任何一步失败即中止):
#   1. 前端 build 前先跑静态检查(npm run release, 含 check-undefined/bindings)
#   2. 交叉编译 linux/amd64 静态二进制(-trimpath -ldflags "-s -w")
#   3. ★ 文本文件行尾强制 LF —— 见下
#   4. 组装包目录 → 打 tar.gz → 算 md5/sha256 → 回写 releases.json
#
# ★ 为什么必须校验行尾:
#   Windows 上 `core.autocrlf=true` 会让**工作区**的 .sh 变成 CRLF。
#   仓库 blob 本身是 LF(.gitattributes 已固定), 所以 curl 下载得到的脚本没问题,
#   但只要从工作区 cp 进包, 就会带进 CRLF。到 Linux 上执行时:
#       #!/usr/bin/env bash\r  → 解释器路径带 \r 找不到 → 回退 sh(dash)
#       set -euo pipefail      → "pipefail: 无效的选项名" → 安装当场失败
#   2026-10-18 实际踩到过一次, 所以这里做硬校验: 有 CR 就转, 转不掉就报错退出。
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VER="${1:-$(tr -d ' \t\r\n' < VERSION)}"
[ -n "$VER" ] || { echo "[X] 无法确定版本(仓库根 VERSION 为空)" >&2; exit 1; }

PKG="raincough-${VER}"
BUILD="dist-build/${PKG}"
OUT="dist/raincough-linux-x86_64-${VER}.tar.gz"

ok()   { echo "[OK] $*"; }
info() { echo "[..] $*"; }
fail() { echo "[X] $*" >&2; exit 1; }

# ---------- 1) 前端: 检查 + 构建 ----------
info "前端: npm run release (check + build)"
if [ -d web/node_modules ]; then
    ( cd web && npm run release >/dev/null ) || fail "前端检查或构建失败(先看 npm run check 的输出)"
    ok "前端产物: $(ls public/assets/*.js | head -1)"
else
    fail "web/node_modules 不存在, 先执行: cd web && npm install"
fi

# ---------- 2) Go 二进制 ----------
info "交叉编译 linux/amd64"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
    go build -trimpath -ldflags "-s -w" -o dist-build/raincough ./cmd/raincough || fail "go build 失败"
ok "二进制 $(stat -c '%s' dist-build/raincough 2>/dev/null || stat -f '%z' dist-build/raincough) B"

# ---------- 3) 组装 ----------
info "组装 $BUILD"
rm -rf "$BUILD"
mkdir -p "$BUILD/public/assets"
cp dist-build/raincough      "$BUILD/raincough"
cp install.sh               "$BUILD/install.sh"
[ -f uninstall.sh ] && cp uninstall.sh "$BUILD/uninstall.sh"
cp VERSION                  "$BUILD/VERSION"
cp CHANGELOG.md             "$BUILD/CHANGELOG.md"
cp releases.json            "$BUILD/releases.json"
cp public/index.html        "$BUILD/public/"
cp public/assets/*          "$BUILD/public/assets/"

# ---------- 4) 行尾硬校验 ----------
info "校验文本文件行尾(LF)"
CR_BAD=0
for f in "$BUILD/install.sh" "$BUILD/uninstall.sh" "$BUILD/VERSION" "$BUILD/releases.json"; do
    [ -f "$f" ] || continue
    if LC_ALL=C grep -q $'\r' "$f" 2>/dev/null; then
        # 先尝试就地修正(典型场景: 工作区被 autocrlf 转成了 CRLF)
        if sed -i 's/\r$//' "$f" 2>/dev/null && ! LC_ALL=C grep -q $'\r' "$f" 2>/dev/null; then
            info "  已修正 $(basename "$f") 的 CRLF → LF"
        else
            echo "  [X] $(basename "$f") 仍含 CR, 无法自动修正" >&2
            CR_BAD=1
        fi
    fi
done
[ "$CR_BAD" = 0 ] || fail "包内文本文件行尾不合规, 已中止"
ok "行尾检查通过"

# shell 语法自检(在打包机上验一遍, 避免包里带语法错误的安装器)
bash -n "$BUILD/install.sh" || fail "install.sh 语法错误"
[ -f "$BUILD/uninstall.sh" ] && { bash -n "$BUILD/uninstall.sh" || fail "uninstall.sh 语法错误"; }
ok "shell 语法检查通过"

# ---------- 5) 打包 ----------
info "打包 $(basename "$OUT")"
mkdir -p dist
rm -f "$OUT"
( cd dist-build && tar czf "../$OUT" "$PKG" ) || fail "tar 失败"

SZ=$(stat -c '%s' "$OUT" 2>/dev/null || stat -f '%z' "$OUT")
MD5=$(md5sum "$OUT" | awk '{print $1}')
SHA=$(sha256sum "$OUT" | awk '{print $1}')

# 解包验证: 包结构 + 包内 VERSION
tar tzf "$OUT" >/dev/null 2>&1 || fail "生成的 tar 无法读取"
INNER_VER=$(tar xzf "$OUT" -O "$PKG/VERSION" 2>/dev/null | tr -d ' \t\r\n')
[ "$INNER_VER" = "$VER" ] || fail "包内 VERSION=$INNER_VER 与打包版本 $VER 不一致"

# 包内 install.sh 的内嵌版本应与包版本一致(否则安装时会按内嵌版本去下载, 404)
INNER_PANEL_VER=$(tar xzf "$OUT" -O "$PKG/install.sh" 2>/dev/null \
    | sed -n 's/^RC_PANEL_VERSION="\${RC_VERSION:-\(.*\)}"$/\1/p' | head -1)
[ "$INNER_PANEL_VER" = "$VER" ] || \
    fail "包内 install.sh 内嵌版本=$INNER_PANEL_VER 与 $VER 不一致(发版前需更新 install.sh)"

# ---------- 6) 回写 releases.json ----------
python3 - "$SZ" "$MD5" "$SHA" "$VER" <<'PY'
import json, sys
sz, md5, sha, ver = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
p = "releases.json"
d = json.load(open(p, encoding="utf-8"))
tag = "v" + ver
entries = d.setdefault("panel", [])
hit = [e for e in entries if e.get("tag") == tag]
rec = {
    "version": ver, "tag": tag,
    "size_bytes": int(sz), "md5": md5, "sha256": sha,
    "asset": "raincough-linux-x86_64-%s.tar.gz" % ver,
    "install_command": "curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/%s/install.sh | bash" % tag,
}
if hit:
    hit[0].update(rec)
    print("[..] releases.json 更新已有条目", tag)
else:
    entries.insert(0, rec)
    print("[..] releases.json 新增条目", tag)
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(p, "a", encoding="utf-8").write("\n")
PY
# releases.json 变了, 包内的那份也要同步(它会被解包到安装目录)
cp releases.json "$BUILD/releases.json"
rm -f "$OUT"
( cd dist-build && tar czf "../$OUT" "$PKG" )
SZ=$(stat -c '%s' "$OUT" 2>/dev/null || stat -f '%z' "$OUT")
MD5=$(md5sum "$OUT" | awk '{print $1}')
SHA=$(sha256sum "$OUT" | awk '{print $1}')
python3 - "$SZ" "$MD5" "$SHA" "$VER" <<'PY'
import json, sys
sz, md5, sha, ver = sys.argv[1:5]
p = "releases.json"
d = json.load(open(p, encoding="utf-8"))
for e in d.get("panel", []):
    if e.get("tag") == "v" + ver:
        e.update({"size_bytes": int(sz), "md5": md5, "sha256": sha})
json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(p, "a", encoding="utf-8").write("\n")
PY

echo
ok "打包完成: $OUT"
echo "     size   $SZ"
echo "     md5    $MD5"
echo "     sha256 $SHA"
echo "     VERSION(包内) $INNER_VER"
echo
echo "  下一步:"
echo "     git add releases.json && git commit -m 'build: 重新打包 $VER 资产'"
echo "     git tag -a v$VER -m 'RainCough $VER' && git push <url> master main --follow-tags"
