#!/usr/bin/env bash
# ============================================================================
#  RainCough Panel Web — 安装向导 (Install Wizard)
#  功能: 环境检测 -> 虚拟环境 -> 依赖安装 -> 启动方式 -> 端口 -> 完成
#  仅支持 Linux, 需 Python 3.9+ 与 root(或可 sudo)。
#  用法:  sudo bash install.sh
# ============================================================================
set -euo pipefail

C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'; C_RED=$'\033[31m'
C_RESET=$'\033[0m'
ok()   { echo "${C_GREEN}[✓]${C_RESET} $1"; }
warn() { echo "${C_YELLOW}[!]${C_RESET} $1"; }
info() { echo "${C_CYAN}[·]${C_RESET} $1"; }
err()  { echo "${C_RED}[✗]${C_RESET} $1"; exit 1; }

APP_DIR="/opt/raincough-panel"
PORT=3000

echo
echo "${C_CYAN}=============================================================${C_RESET}"
echo "${C_CYAN}   RainCough Panel Web 安装向导${C_RESET}"
echo "${C_CYAN}=============================================================${C_RESET}"
echo

# ---------- 0. root 检查 ----------
if [[ "$(id -u)" -ne 0 ]]; then
    # 尝试通过 sudo 重新执行
    if command -v sudo >/dev/null 2>&1; then
        warn "需要 root 权限, 正在通过 sudo 重新执行..."; exec sudo bash "$0" "$@"
    fi
    err "请以 root 运行:  sudo bash install.sh"
fi

# ---------- 1. 环境检测 ----------
info "1/6 环境检测"
PY=python3
command -v "$PY" >/dev/null 2>&1 || err "未找到 python3, 请先安装:  apt install python3 python3-venv python3-pip"
PY_VERSION="$($PY -c 'import sys;print("%d.%d"%sys.version_info[:2])')"
IFS=. read -r PY_MAJ PY_MIN <<<"$PY_VERSION"
if (( PY_MAJ < 3 || (PY_MAJ == 3 && PY_MIN < 9) )); then
    err "需要 Python 3.9+, 当前: $PY_VERSION"
fi
ok "Python $PY_VERSION"

# ---------- 2. 拉取代码 / 安装目录 ----------
info "2/6 准备代码目录"
read -r -p "安装目录 [默认 ${APP_DIR}]: " INPUT_DIR
[[ -n "$INPUT_DIR" ]] && APP_DIR="$INPUT_DIR"
if [[ ! -d "$APP_DIR" ]]; then
    info "未找到代码, 从 GitHub 克隆到 ${APP_DIR} ..."
    command -v git >/dev/null 2>&1 || err "未找到 git"
    git clone --depth 1 https://github.com/fongwuyan/RainCough-panel-web.git "$APP_DIR"
fi
cd "$APP_DIR"
ok "代码就绪: $APP_DIR"

# ---------- 3. 虚拟环境 + 依赖 ----------
info "3/6 创建虚拟环境并安装依赖"
$PY -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip >/dev/null 2>&1 || true
pip install -r requirements.txt
ok "依赖安装完成"

# ---------- 4. 启动方式 ----------
info "4/6 选择启动方式"
echo "  1) systemd 服务(推荐, 开机自启/崩溃自愈)"
echo "  2) 前台运行(调试)"
read -r -p "请选择 [1/2, 默认 1]: " RUNMODE
RUNMODE="${RUNMODE:-1}"

if [[ "$RUNMODE" == "1" ]]; then
    UNIT=/etc/systemd/system/raincough-panel.service
    command -v systemctl >/dev/null 2>&1 || { warn "无 systemd, 改为前台运行模式"; RUNMODE=2; }
fi
if [[ "$RUNMODE" == "1" ]]; then
    cat > "$UNIT" <<EOF
[Unit]
Description=RainCough Panel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=3
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/venv/bin/python ${APP_DIR}/app.py

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable --now raincough-panel.service >/dev/null 2>&1 || true
    ok "已注册并启动 systemd 服务: raincough-panel"
fi

# ---------- 5. 开放端口 ----------
info "5/6 开放端口"
read -r -p "面板端口 [默认 ${PORT}]: " INPUT_PORT
[[ -n "$INPUT_PORT" ]] && PORT="$INPUT_PORT"
if command -v ufw >/dev/null 2>&1; then
    read -r -p "是否用 ufw 放行 ${PORT}/tcp? [y/N]: " A
    [[ "${A,,}" == "y" ]] && { ufw allow "$PORT"/tcp; ok "ufw 已放行 $PORT/tcp"; }
elif command -v firewall-cmd >/dev/null 2>&1; then
    read -r -p "是否用 firewalld 放行 ${PORT}/tcp? [y/N]: " A
    [[ "${A,,}" == "y" ]] && { firewall-cmd --permanent --add-port="$PORT/tcp"; firewall-cmd --reload; ok "firewalld 已放行 $PORT/tcp"; }
else
    warn "未检测到 ufw/firewalld, 请按需自行放行端口 $PORT"
fi

# ---------- 6. 完成 ----------
info "6/6 完成"
if [[ "$RUNMODE" == "1" ]]; then
    systemctl restart raincough-panel.service || true
fi
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "${C_GREEN}=============================================================${C_RESET}"
echo "${C_GREEN}  安装完成!${C_RESET}"
echo "  访问地址:  http://${LAN_IP:-<服务器IP>}:${PORT}"
[[ "$RUNMODE" == "1" ]] && echo "  服务管理:  systemctl {status|restart|stop} raincough-panel"
echo "${C_GREEN}=============================================================${C_RESET}"
echo