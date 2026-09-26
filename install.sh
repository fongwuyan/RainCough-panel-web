#!/usr/bin/env bash
# ============================================================================
# RainCough 主面板 (Go) 一键安装器 — 7 步流程
#
# 全新 Linux 主机(x86_64 + systemd)一条命令安装, 机器上无需预先有任何 sh 文件:
#
#   curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/install.sh | bash
#
# (gh-proxy 不可用时可去掉前缀直连 raw.githubusercontent.com;
#  资产下载默认走 gh-proxy 镜像, 可用 RC_MIRROR=https://github.com 覆盖)
#
# 流程: 1 yes/no 确认 -> 2 环境检查 -> 3 下载缺失环境包并安装 -> 4 下载面板主体
#       -> 5 输入信息 -> 6 安装 -> 7 完成
#
# 范围: 只装面板主体, 不含插件。插件在面板内"插件市场"安装,
#       插件依赖在安装插件时由面板自动 pip 安装(AI 重依赖自动走 env-ai 离线轮子)。
# ============================================================================
set -euo pipefail

REPO="fongwuyan/RainCough-panel-web"
RELEASE_TAG="env-offline-0.1.0"   # 三资产同挂此 Release
BODY_ASSET="raincough-linux-x86_64-0.1.0.tar.gz"
ENV_ASSET="env-offline-linux-x86_64-0.1.0.tar.gz"
MIRROR="${RC_MIRROR:-https://gh-proxy.com/https://github.com}"
# 面板核心 python 环境(与主仓 requirements.txt 保持一致; 供插件运行基座)
CORE_PIP_PKGS="flask flask-cors curl_cffi psutil cryptography apscheduler Pillow numpy onnxruntime requests gunicorn"

C_G=$'\033[32m'; C_Y=$'\033[33m'; C_C=$'\033[36m'; C_R=$'\033[31m'; C_0=$'\033[0m'
ok()   { echo "${C_G}[OK]${C_0} $*"; }
info() { echo "${C_C}[..]${C_0} $*"; }
warn() { echo "${C_Y}[!!]${C_0} $*"; }
fail() { echo "${C_R}[X]${C_0} $*" >&2; exit 1; }

# 从终端读一行: 交互终端走 stdin; curl|bash 管道执行时 stdin 是脚本流, 改读 /dev/tty
read_tty() {
    local __r=""
    if [ -t 0 ]; then
        IFS= read -r __r || __r=""
    else
        IFS= read -r __r < /dev/tty || __r=""
    fi
    printf '%s' "$__r"
}
confirm_yes() {   # 必须输入 yes 才返回 0
    local a
    printf '%s [yes/no]: ' "$1"
    a="$(read_tty)"
    case "$a" in yes|YES|Yes|y|Y) return 0 ;; *) return 1 ;; esac
}
ask_default() {   # $1 提示 $2 默认值 -> 输出答案
    local a
    printf '%s [%s]: ' "$1" "$2"
    a="$(read_tty)"
    printf '%s' "${a:-$2}"
}
fetch() {         # $1 仓库相对路径 $2 输出文件; 镜像失败回退直连
    local rel="$1" out="$2" base
    for base in "$MIRROR" "https://github.com"; do
        info "下载 $base/$rel"
        if curl -fL --connect-timeout 20 --retry 2 -o "$out" "$base/$rel"; then
            return 0
        fi
        warn "镜像失败, 尝试下一个源..."
    done
    return 1
}
pip_install() {   # $@ = 参数; Debian PEP668 兼容
    python3 -m pip install --no-input --disable-pip-version-check \
        --break-system-packages "$@" 2>/dev/null \
        || python3 -m pip install --no-input --disable-pip-version-check "$@"
}

echo
echo "${C_C}=======================================================${C_0}"
echo "${C_C}   RainCough 主面板 (Go) 安装向导  v0.1.0${C_0}"
echo "${C_C}=======================================================${C_0}"
echo "  将安装: 面板主体 + 核心 Python 环境 (不含插件)"
echo "  插件稍后面板内【插件市场】安装, 插件依赖装插件时自动安装"

# ---------- 步骤 1: yes/no 确认 ----------
if ! confirm_yes "步骤 1/7: 是否开始安装?"; then
    echo "已取消安装。"
    exit 0
fi

# ---------- 步骤 2: 环境检查 ----------
echo
info "步骤 2/7: 环境检查"
[ "$(uname -s)" = "Linux" ] || fail "仅支持 Linux, 当前: $(uname -s)"
case "$(uname -m)" in x86_64|amd64) ;; *) fail "仅支持 x86_64, 当前: $(uname -m)" ;; esac
ok "系统 Linux x86_64"
[ -d /run/systemd/system ] || fail "需要 systemd 环境"
ok "systemd 可用"
AVAIL_K=$(df -Pk . | awk 'NR==2{print $4}')
[ "$AVAIL_K" -ge 2097152 ] || fail "磁盘可用不足 2G (当前 $((AVAIL_K/1024))M)"
ok "磁盘可用 $((AVAIL_K/1024))M"
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 || fail "需要 root 或 sudo 权限"
    info "需要特权操作, 请输入 sudo 密码:"
    sudo -v || fail "sudo 验证失败"
    SUDO="sudo"
fi
ok "权限就绪 (root${SUDO:+ via sudo})"
curl -fsSL -m 10 -o /dev/null https://api.github.com 2>/dev/null \
    && ok "GitHub 连通" || warn "api.github.com 不通(将依赖镜像下载, 市场功能以后需自行解决)"
command -v python3 >/dev/null 2>&1 || warn "python3 缺失 (步骤3 将安装)"
command -v curl >/dev/null 2>&1 || fail "缺少 curl (apt install curl)"

# ---------- 步骤 3: 下载缺失环境包并安装 ----------
echo
info "步骤 3/7: 环境包检查与安装"
NEED_APT=""
command -v python3 >/dev/null 2>&1 || NEED_APT="python3"
if ! python3 -m pip --version >/dev/null 2>&1; then NEED_APT="$NEED_APT python3-pip"; fi
if [ -n "$NEED_APT" ]; then
    info "安装系统包:$NEED_APT"
    $SUDO apt-get update -qq
    $SUDO apt-get install -y $NEED_APT
    ok "系统包就绪"
fi
if python3 -c "import flask,flask_cors,curl_cffi,psutil,cryptography,apscheduler,PIL,numpy,onnxruntime,requests" 2>/dev/null; then
    ok "核心 Python 环境已齐, 无需下载环境包"
else
    info "核心环境缺失, 下载环境包 $ENV_ASSET ..."
    TMPD=$(mktemp -d)
    fetch "$REPO/releases/download/$RELEASE_TAG/$ENV_ASSET" "$TMPD/env.tgz" || fail "环境包下载失败"
    tar xzf "$TMPD/env.tgz" -C "$TMPD" || fail "环境包解压失败"
    WHEELS=$(find "$TMPD" -type d -name wheels | head -n1)
    [ -n "$WHEELS" ] || fail "环境包中未找到 wheels/"
    info "离线安装核心环境 (wheels)..."
    pip_install --no-index --find-links "$WHEELS" $CORE_PIP_PKGS || fail "核心环境安装失败"
    ok "核心 Python 环境安装完成"
    rm -rf "$TMPD"
fi

# ---------- 步骤 4: 下载面板主体 (不含插件) ----------
echo
info "步骤 4/7: 下载面板主体"
TMPD=$(mktemp -d)
fetch "$REPO/releases/download/$RELEASE_TAG/$BODY_ASSET" "$TMPD/$BODY_ASSET" || fail "面板主体下载失败"
tar tzf "$TMPD/$BODY_ASSET" >/dev/null 2>&1 || fail "面板主体包损坏"
ok "面板主体就绪: $BODY_ASSET ($(du -h "$TMPD/$BODY_ASSET" | cut -f1))"

# ---------- 步骤 5: 输入信息 ----------
echo
info "步骤 5/7: 输入安装信息"
APP_DIR=$(ask_default "安装目录" "/opt/raincough")
RUN_USER=$(ask_default "运行用户" "root")
while :; do
    PORT=$(ask_default "面板端口" "3900")
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${PORT}\$"; then
        warn "端口 $PORT 已被占用, 请换一个"
    else
        break
    fi
done
if confirm_yes "是否安装常用功能工具(p7zip/ffmpeg, 插件 compress/mediatools 需要)?"; then
    INSTALL_TOOLS=yes
else
    INSTALL_TOOLS=no
fi
echo "  摘要: 目录=$APP_DIR 用户=$RUN_USER 端口=$PORT 功能工具=$INSTALL_TOOLS"

# ---------- 步骤 6: 安装 ----------
echo
info "步骤 6/7: 安装"
$SUDO mkdir -p "$APP_DIR"
$SUDO tar xzf "$TMPD/$BODY_ASSET" -C "$APP_DIR" --strip-components=1
$SUDO chown -R "$RUN_USER:$RUN_USER" "$APP_DIR" 2>/dev/null || true
ok "面板文件解压至 $APP_DIR"
if [ "$INSTALL_TOOLS" = "yes" ]; then
    $SUDO apt-get install -y p7zip-full ffmpeg && ok "功能工具已安装"
fi
UNIT=/etc/systemd/system/raincough.service
$SUDO tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=RainCough Core Panel (Go)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/raincough -port $PORT
Restart=always
RestartSec=5
RuntimeDirectory=raincough
RuntimeDirectoryMode=0700

[Install]
WantedBy=multi-user.target
EOF
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now raincough.service
ok "systemd 服务已注册并启动 (raincough.service)"

# ---------- 步骤 7: 完成 ----------
echo
info "步骤 7/7: 验证与完成"
sleep 2
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ "$CODE" = "200" ]; then
    ok "面板响应 HTTP 200"
else
    warn "面板暂未响应 (HTTP $CODE), 请查看: journalctl -u raincough -f"
fi
rm -rf "$TMPD"
echo
echo "${C_G}=======================================================${C_0}"
echo "${C_G}  安装完成!${C_0}"
echo "  访问地址:  http://${LAN_IP:-<服务器IP>}:$PORT"
echo "  服务管理:  systemctl {status|restart|stop} raincough"
echo "  日志:      journalctl -u raincough -f"
echo "  下一步:    面板内【插件市场】安装插件 —— 插件依赖将自动安装;"
echo "             aigen/mcskin 的 AI 依赖会自动拉取 env-ai 离线轮子。"
echo "${C_G}=======================================================${C_0}"
