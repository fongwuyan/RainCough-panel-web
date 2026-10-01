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
#       -> 5 输入信息(含可选的"把当前 DHCP 地址固定为静态") -> 6 安装 + 固定静态 IP -> 7 完成
#
# 固定静态 IP(一步到位, 避免面板地址漂移): 安装时读默认路由网卡的当前地址/网关/上游 DNS,
#   原样写成静态配置(NetworkManager / netplan / ifupdown 自动识别, 只动这块网卡),
#   改前备份到 /root/raincough-net-backup-<时间戳>, 并打印回滚命令;
#   ★只写配置、默认不立即重启网络 —— 静态配置在下次重启后生效, 安装会话不会被踢掉。
#   相关开关: RC_NET_STATIC=yes|no|dry(默认问一次, 回车=yes) RC_NET_FORCE=1(已是静态也强写)
#             RC_NET_DRYRUN=1(只看将写什么) RC_ONLY_NET=1(只跑这一步)
#
# 范围: 只装面板主体 = 主程序 + 内置功能(工作台/文件管理/终端/系统扩展/插件/设置/开发文档)。
#       不含插件, 也不含系统扩展: 插件在面板内【插件】页安装;
#       系统扩展(媒体中心/任务队列/调度器等)在面板内【系统扩展】页安装, 扩展包存放于主面板库
#       extensions/ 目录。
# ============================================================================
set -euo pipefail

REPO="fongwuyan/RainCough-panel-web"
# 版本: RC_VERSION 覆盖 > 本脚本内嵌版本(发布时写入, = 所在 tag 的版本) > latest
# 未替换的占位符(开发树)与空值都按 latest 解析, 见下方「版本解析」。
RC_PANEL_VERSION="${RC_VERSION:-1.0.0}"
RELEASE_TAG="env-offline-0.1.0"   # 环境包资产另挂此 Release
ENV_ASSET="env-offline-linux-x86_64-0.1.0.tar.gz"
MIRROR="${RC_MIRROR:-https://gh-proxy.com/https://github.com}"
UNIT_NAME="${RC_UNIT_NAME:-raincough.service}"   # 单元名可覆盖(测试/多实例隔离)
# 面板核心 python 环境(与主仓 requirements.txt 保持一致; 供插件运行基座)
CORE_PIP_PKGS="flask flask-cors curl_cffi psutil cryptography apscheduler Pillow numpy onnxruntime requests gunicorn"

C_G=$'\033[32m'; C_Y=$'\033[33m'; C_C=$'\033[36m'; C_R=$'\033[31m'; C_0=$'\033[0m'
ok()   { echo "${C_G}[OK]${C_0} $*"; }
info() { echo "${C_C}[..]${C_0} $*"; }
warn() { echo "${C_Y}[!!]${C_0} $*"; }
fail() {
    echo "${C_R}[X] FAILED${C_0} $*" >&2
    echo "    [X] install aborted. If the text above looks garbled (non-UTF-8 terminal), re-run with:" >&2
    echo "        curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/v1.0.0/install.sh | LANG=C.UTF-8 bash" >&2
    exit 1
}

# 端口是否已被监听
port_in_use() {
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":$1\$"
}

# 占用该端口的是不是"本项目自己的面板"(重装场景: 旧面板还占着默认端口, 不该当成冲突)
# 注意: ss -ltnp 在非 root 下看不到别人进程的 PID —— 本机面板多以 root 运行, 必须用 $SUDO 才能看到
port_holder_is_us() {
    local pid main exe
    pid=$($SUDO ss -ltnp 2>/dev/null | grep -F ":$1 " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
    if [ -z "$pid" ]; then
        pid=$($SUDO ss -ltnp 2>/dev/null | awk -v p=":$1" 'index($4,p)>0 {print $NF}' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
    fi
    [ -n "$pid" ] || return 1
    if [ -n "${UNIT_NAME:-}" ]; then
        main=$($SUDO systemctl show -p MainPID --value "$UNIT_NAME" 2>/dev/null || echo "")
        [ -n "$main" ] && [ "$main" != "0" ] && [ "$pid" = "$main" ] && return 0
    fi
    exe=$($SUDO readlink -f "/proc/$pid/exe" 2>/dev/null || echo "")
    [ -n "$exe" ] && [ "$exe" = "$APP_DIR/raincough" ] && return 0
    return 1
}

# 终端能力探测:
#   HAVE_TTY=1 stdin 就是终端; =2 有 /dev/tty 可读(curl|bash 场景); =0 没有交互终端
#     —— 网页终端/自动化/ssh 不带 -t 时就是 0, 此时所有提问取默认值继续, 绝不因为读不到输入而中止
HAVE_TTY=0
if [ -t 0 ]; then
    HAVE_TTY=1
elif [ -c /dev/tty ] && { true < /dev/tty; } 2>/dev/null; then
    HAVE_TTY=2
fi

# 终端能否显示 UTF-8: 不能时提示以 ASCII 为主, 免得满屏乱码看不懂该输入什么
TERM_UTF8=0
case "${LC_ALL:-${LC_CTYPE:-${LANG:-}}}" in
    *UTF-8*|*utf8*|*UTF8*|*utf-8*) TERM_UTF8=1 ;;
esac
if [ "$TERM_UTF8" = 0 ] && command -v locale >/dev/null 2>&1; then
    case "$(locale charmap 2>/dev/null)" in UTF-8|utf8) TERM_UTF8=1 ;; esac
fi

# 从终端读一行: 交互终端走 stdin; curl|bash 管道执行时 stdin 是脚本流, 改读 /dev/tty;
# 没有交互终端时返回空(由调用方按默认值处理), 且不打印 shell 自己的报错。
# ★带读超时(RC_PROMPT_TIMEOUT, 默认 120s): /dev/tty 可读但没人输入时(某些网页终端/自动化)
#   绝不能永久阻塞 —— 超时就按默认值继续。
read_tty() {
    local __r="" tmo="${RC_PROMPT_TIMEOUT:-120}"
    case "$HAVE_TTY" in
        1) IFS= read -t "$tmo" -r __r 2>/dev/null || __r="" ;;
        2) IFS= read -t "$tmo" -r __r < /dev/tty 2>/dev/null || __r="" ;;
    esac
    if [ -z "$__r" ] && [ "$HAVE_TTY" != 0 ]; then
        echo "  (no input within ${tmo}s / 输入超时 -> 使用默认值)" >&2
    fi
    printf '%s' "$__r"
}
confirm_yes() {   # 必须输入 yes 才返回 0(回车=no)    local a
    if [ "$HAVE_TTY" = 0 ]; then
        echo "  (no tty) $1 -> no" >&2
        return 1
    fi
    printf '  %s [yes/no]: ' "$1"
    a="$(read_tty)"
    case "$a" in yes|YES|Yes|y|Y) return 0 ;; *) return 1 ;; esac
}
confirm_default() {   # $1 提示 $2 默认值(yes/no); 回车取默认; 无 tty 也取默认
    local a
    if [ "$HAVE_TTY" = 0 ]; then
        echo "  (no tty) $1 -> default: $2" >&2
        case "$2" in yes|YES|Yes|y|Y) return 0 ;; *) return 1 ;; esac
    fi
    printf '  %s [%s]: ' "$1" "$2"
    a="$(read_tty)"
    a="${a:-$2}"
    case "$a" in yes|YES|Yes|y|Y) return 0 ;; *) return 1 ;; esac
}
ask_default() {   # $1 提示 $2 默认值 -> 输出答案; 提示走 stderr(避免被 $( ) 捕获吞掉); 无 tty 直接取默认
    local a
    if [ "$HAVE_TTY" = 0 ]; then
        echo "  (no tty) $1 -> default: $2" >&2
        printf '%s' "$2"
        return 0
    fi
    printf '  %s [%s]: ' "$1" "$2" >&2
    a="$(read_tty)"
    printf '%s' "${a:-$2}"
}
fetch() {         # $1 仓库相对路径 $2 输出文件; 镜像失败回退直连; ?ts 防镜像缓存旧资产
    local rel="$1" out="$2" base
    for base in "$MIRROR" "https://github.com"; do
        info "下载 $base/$rel"
        if curl -fL --connect-timeout 20 --retry 2 -o "$out" "$base/$rel?ts=$(date +%s)"; then
            return 0
        fi
        warn "镜像失败, 尝试下一个源..."
    done
    return 1
}
pip_install() {   # $@ = 参数; 以特权系统级安装(服务以 RUN_USER 运行, 用户级 ~/.local 不可见)
    $SUDO python3 -m pip install --no-input --disable-pip-version-check \
        --break-system-packages "$@" 2>/dev/null \
        || $SUDO python3 -m pip install --no-input --disable-pip-version-check "$@"
}

# ---------- 静态 IP 固定(可选): 把 DHCP 拿到的地址原样写成静态配置 ----------
# 设计要点:
#   · 只动"默认路由所在的那块网卡", 其它网卡一律不碰
#   · 只写配置, 默认【不】立即重启网络 —— 装到一半把自己的 SSH 踢掉是最蠢的故障;
#     静态配置在下次重启/重新激活时生效, 当前连接不受影响
#   · 改前备份到 $NET_BAK, 并打印回滚命令
#   · 已经是静态的直接跳过
NET_BAK=""
NET_IFACE=""; NET_CIDR=""; NET_GW=""; NET_DNS=""; NET_STACK=""; NET_DHCP=""

net_mask() {   # 24 -> 255.255.255.0
    local p="$1" i m=0
    for i in 1 2 3 4; do
        if [ "$p" -ge 8 ]; then m=$((m + 255)); p=$((p - 8))
        elif [ "$p" -gt 0 ]; then m=$((m + 256 - (1 << (8 - p)))); p=0; fi
        if [ "$i" -lt 4 ]; then printf '%s.' "$m"; else printf '%s' "$m"; fi
    done
}

net_upstream_dns() {   # 只取真实上游 DNS, 跳过 systemd-resolved 的 127.0.0.53 桩
    local f
    for f in /run/systemd/resolve/resolv.conf /etc/resolv.conf; do
        [ -f "$f" ] || continue
        awk '/^nameserver/{print $2}' "$f" 2>/dev/null | grep -Ev '^127\.|^::1$' | head -2 | tr '\n' ' '
    done
}

net_detect() {
    NET_IFACE=$(ip -4 route show default 2>/dev/null | awk '{print $5; exit}')
    [ -n "$NET_IFACE" ] || return 1
    NET_CIDR=$(ip -4 -o addr show dev "$NET_IFACE" scope global 2>/dev/null | awk '{print $4; exit}')
    NET_GW=$(ip -4 route show default 2>/dev/null | awk '{print $3; exit}')
    NET_DNS=$(net_upstream_dns)
    [ -n "$NET_CIDR" ] && [ -n "$NET_GW" ] || return 1

    if command -v nmcli >/dev/null 2>&1 \
       && nmcli -t -f DEVICE,STATE device 2>/dev/null | grep -q "^${NET_IFACE}:connected"; then
        NET_STACK=nm
    elif ls /etc/netplan/*.yaml >/dev/null 2>&1; then
        NET_STACK=netplan
    elif [ -f /etc/network/interfaces ]; then
        NET_STACK=ifupdown
    else
        NET_STACK=unknown
    fi

    case "$NET_STACK" in
      nm)
        local con meth
        con=$(nmcli -t -f NAME,DEVICE con show --active 2>/dev/null | awk -F: -v d="$NET_IFACE" '$2==d{print $1; exit}')
        meth=$(nmcli -g ipv4.method con show "$con" 2>/dev/null || echo "")
        NET_DHCP=$([ "$meth" = "auto" ] && echo yes || echo no) ;;
      netplan)
        # 注意: /etc/netplan/*.yaml 常是 600 root —— 必须用 $SUDO 读, 否则普通用户读不到会误判成"非 DHCP"
        if $SUDO grep -hE "^[[:space:]]+dhcp4:[[:space:]]*(true|yes)" /etc/netplan/*.yaml >/dev/null 2>&1; then
            NET_DHCP=yes
        else
            NET_DHCP=no
        fi ;;
      ifupdown)
        if $SUDO grep -rhE "^[[:space:]]*iface[[:space:]]+$NET_IFACE[[:space:]]+inet[[:space:]]+dhcp" \
             /etc/network/interfaces /etc/network/interfaces.d/ >/dev/null 2>&1; then
            NET_DHCP=yes
        else
            NET_DHCP=no
        fi ;;
      *) NET_DHCP=unknown ;;
    esac
    return 0
}

net_rollback_hint() {
    echo "  回滚: 恢复 $NET_BAK/ 下的备份并删掉 raincough 写的配置, 然后:"
    case "$NET_STACK" in
      nm)       echo "        nmcli con mod <连接名> ipv4.method auto && nmcli con up <连接名>" ;;
      netplan)  echo "        rm -f /etc/netplan/99-raincough-static.yaml && mv /etc/netplan/<备份>.raincough-disabled /etc/netplan/<备份> && netplan generate" ;;
      ifupdown) echo "        rm -f /etc/network/interfaces.d/raincough-$NET_IFACE.cfg && 还原 /etc/network/interfaces" ;;
    esac
}

net_write_static() {
    if [ "$NET_DHCP" != "yes" ] && [ "${RC_NET_FORCE:-0}" != "1" ]; then
        info "当前不是 DHCP(状态=$NET_DHCP), 无需固定为静态 —— 跳过(要强制写可设 RC_NET_FORCE=1)"
        return 0
    fi
    if [ "${RC_NET_DRYRUN:-0}" = "1" ]; then
        echo "  [dry-run] 栈=$NET_STACK 网卡=$NET_IFACE 地址=$NET_CIDR 网关=$NET_GW DNS=${NET_DNS:-无}"
        case "$NET_STACK" in
          netplan)  echo "  [dry-run] 将写 /etc/netplan/99-raincough-static.yaml, 并把现有网卡定义改名为 *.raincough-disabled" ;;
          ifupdown) echo "  [dry-run] 将写 /etc/network/interfaces.d/raincough-$NET_IFACE.cfg, 并注释 /etc/network/interfaces 里的原 dhcp 段" ;;
          nm)       echo "  [dry-run] 将 nmcli con mod <连接> ipv4.method manual ipv4.addresses $NET_CIDR ipv4.gateway $NET_GW" ;;
        esac
        echo "  [dry-run] 备份目录将是 /root/raincough-net-backup-<时间戳>"
        return 0
    fi
    local ts; ts=$(date +%Y%m%d-%H%M%S)
    NET_BAK="/root/raincough-net-backup-$ts"
    $SUDO mkdir -p "$NET_BAK"
    local ip="${NET_CIDR%%/*}" pfx="${NET_CIDR##*/}" mask
    mask=$(net_mask "$pfx")

    case "$NET_STACK" in
      nm)
        local con
        con=$(nmcli -t -f NAME,DEVICE con show --active 2>/dev/null | awk -F: -v d="$NET_IFACE" '$2==d{print $1; exit}')
        [ -n "$con" ] || { warn "找不到 $NET_IFACE 的 NM 连接, 跳过"; return 1; }
        nmcli con show "$con" > /tmp/rc-nm-$$.txt 2>/dev/null || true
        $SUDO cp -a /tmp/rc-nm-$$.txt "$NET_BAK/nm-$con.txt" 2>/dev/null || true
        rm -f /tmp/rc-nm-$$.txt
        $SUDO nmcli con mod "$con" ipv4.method manual ipv4.addresses "$NET_CIDR" ipv4.gateway "$NET_GW" || return 1
        if [ -n "$NET_DNS" ]; then
            $SUDO nmcli con mod "$con" ipv4.dns "$(echo $NET_DNS | tr ' ' ',')" ipv4.ignore-auto-dns yes || true
        fi
        ok "已把 NetworkManager 连接 '$con' 改为静态(下次激活生效)"
        ;;
      netplan)
        # 全程用 $SUDO 读写: /etc/netplan/*.yaml 常是 600 root, 普通用户 grep 读不到会漏掉旧定义,
        # 而旧定义与我们要写的新文件同时存在时 netplan 会判冲突。
        local f base disabled=() errf
        for f in /etc/netplan/*.yaml; do
            case "$f" in *99-raincough-static.yaml) continue ;; esac
            if $SUDO grep -qE "^[[:space:]]+${NET_IFACE}:" "$f" 2>/dev/null; then
                base=$(basename "$f")
                $SUDO cp -a "$f" "$NET_BAK/$base"
                if $SUDO mv "$f" "$f.raincough-disabled"; then
                    disabled+=("$f|$base")
                    echo "  已停用旧定义: $f -> $f.raincough-disabled"
                fi
            fi
        done
        $SUDO tee /etc/netplan/99-raincough-static.yaml >/dev/null <<EOF
# 由 RainCough 安装程序写入: 把安装时的地址固定为静态(备份见 $NET_BAK)
network:
  version: 2
  ethernets:
    $NET_IFACE:
      dhcp4: false
      dhcp6: false
      addresses: [$NET_CIDR]
      routes:
        - to: default
          via: $NET_GW
EOF
        if [ -n "$NET_DNS" ]; then
            $SUDO tee -a /etc/netplan/99-raincough-static.yaml >/dev/null <<EOF
      nameservers:
        addresses: [$(echo $NET_DNS | tr ' ' ',' | sed 's/,$//')]
EOF
        fi
        $SUDO chmod 600 /etc/netplan/99-raincough-static.yaml
        # 让 cloud-init 别再重建网卡配置(否则它可能把我们停用的那份写回来)
        if [ -d /etc/cloud ]; then
            $SUDO mkdir -p /etc/cloud/cloud.cfg.d
            printf 'network: {config: disabled}\n' | $SUDO tee /etc/cloud/cloud.cfg.d/99-raincough-disable-network-config.cfg >/dev/null
            echo "  已写入 cloud-init 禁管网络: /etc/cloud/cloud.cfg.d/99-raincough-disable-network-config.cfg"
        fi
        errf=$(mktemp)     # 不能直接重定向进 /root 下的备份目录(普通用户无权创建)
        if $SUDO netplan generate 2>"$errf"; then
            ok "netplan 校验通过(只生成, 未应用到当前连接)"
            rm -f "$errf"
        else
            warn "netplan generate 报错, 正在回滚:"
            cat "$errf" >&2 || true
            $SUDO cp -a "$errf" "$NET_BAK/netplan-generate.err" 2>/dev/null || true
            rm -f "$errf"
            $SUDO rm -f /etc/netplan/99-raincough-static.yaml
            local pair orig b
            for pair in ${disabled[@]+"${disabled[@]}"}; do
                orig="${pair%%|*}"; b="${pair##*|}"
                if $SUDO mv "$orig.raincough-disabled" "$orig" 2>/dev/null; then
                    echo "  已恢复: $orig"
                else
                    $SUDO cp -a "$NET_BAK/$b" "$orig" && echo "  已从备份恢复: $orig"
                fi
            done
            return 1
        fi
        ;;
      ifupdown)
        local f base
        for f in /etc/network/interfaces /etc/network/interfaces.d/*; do
            [ -f "$f" ] || continue
            grep -qE "^[[:space:]]*iface[[:space:]]+${NET_IFACE}[[:space:]]" "$f" 2>/dev/null || continue
            base=$(echo "$f" | tr '/' '_')
            $SUDO cp -a "$f" "$NET_BAK/$base"
            if grep -qE "^[[:space:]]*iface[[:space:]]+${NET_IFACE}[[:space:]]+inet[[:space:]]+dhcp" "$f"; then
                $SUDO awk -v dev="$NET_IFACE" '
                    $1=="iface" && $2==dev { skip=1; print "# [raincough] 已改为静态, 原 dhcp 段被注释"; print "# "$0; next }
                    $1=="iface" { skip=0 }
                    skip { print "# "$0; next }
                    { print }' "$f" > /tmp/rc-ifaces.$$ && $SUDO cp /tmp/rc-ifaces.$$ "$f" && rm -f /tmp/rc-ifaces.$$
                echo "  已在 $f 中注释 $NET_IFACE 的原 dhcp 段(备份 $NET_BAK/$base)"
            fi
        done
        $SUDO tee /etc/network/interfaces.d/raincough-$NET_IFACE.cfg >/dev/null <<EOF
# 由 RainCough 安装程序写入: 把安装时的地址固定为静态(备份见 $NET_BAK)
auto $NET_IFACE
iface $NET_IFACE inet static
    address $ip
    netmask $mask
    gateway $NET_GW
EOF
        [ -n "$NET_DNS" ] && $SUDO tee -a /etc/network/interfaces.d/raincough-$NET_IFACE.cfg >/dev/null <<EOF
    dns-nameservers $(echo $NET_DNS | sed 's/ *$//')
EOF
        ok "已写入 /etc/network/interfaces.d/raincough-$NET_IFACE.cfg(下次启动生效)"
        ;;
      *)
        warn "无法识别网络栈(既不是 NetworkManager/netplan/ifupdown), 跳过固定 IP"
        return 1 ;;
    esac
    return 0
}

# ---------- 版本解析(必须在 fail/info 定义之后) ----------
# 只认 x.y.z 形态的内嵌版本; 占位符未替换/为空/latest 一律解析最新 Release。
if printf '%s' "$RC_PANEL_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    PANEL_VERSION="$RC_PANEL_VERSION"
    TAG="v$PANEL_VERSION"
else
    TAG=$(curl -fsSL -m 15 "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
          | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)
    [ -n "$TAG" ] || fail "无法获取最新版本(检查网络或改用 RC_VERSION=<版本>)"
    PANEL_VERSION="${TAG#v}"
fi
BODY_ASSET="raincough-linux-x86_64-${PANEL_VERSION}.tar.gz"

# 只跑"固定静态 IP"这一步(便于脚本化/自测): RC_ONLY_NET=1 [RC_NET_DRYRUN=1]
if [ "${RC_ONLY_NET:-0}" = "1" ]; then
    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
    net_detect || fail "无法识别默认路由网卡"
    info "网卡=$NET_IFACE 地址=$NET_CIDR 网关=$NET_GW DNS=${NET_DNS:-无} 栈=$NET_STACK 当前=$([ "$NET_DHCP" = yes ] && echo DHCP || echo 非DHCP)"
    net_write_static || fail "静态 IP 写入失败"
    echo "${C_G}[OK]${C_0} 完成"
    exit 0
fi

echo
echo "${C_C}=======================================================${C_0}"
echo "${C_C}   RainCough 主面板 (Go) 安装向导  v${PANEL_VERSION}${C_0}"
echo "${C_C}=======================================================${C_0}"
echo "  将安装: 面板主体 + 内置功能 + 核心 Python 环境 (不含插件与系统扩展)"
echo "  插件在面板内【插件】页安装; 系统扩展(媒体中心/任务队列等)在【系统扩展】页安装"
echo "  下载源: $MIRROR (失败回退 https://github.com; RC_MIRROR 可覆盖)"
if [ "$HAVE_TTY" = 0 ]; then
    echo "${C_Y}[!!]${C_0} no interactive terminal (no tty): all prompts will use their defaults"
    echo "     无交互终端: 所有提问取默认值继续(不会因为读不到输入而中止)"
fi
if [ "$TERM_UTF8" = 0 ]; then
    echo "${C_Y}[!!]${C_0} non-UTF-8 locale (${LC_ALL:-${LC_CTYPE:-${LANG:-unset}}}): prompts start with ASCII text"
    echo "     终端不是 UTF-8: 交互提示以 ASCII 为主, 中文可能显示为乱码(不影响安装)"
fi

# ---------- 步骤 1: 确认(回车=开始; 无交互终端按默认继续) ----------
if ! confirm_default "Step 1/7: start install? / 步骤 1/7: 是否开始安装?" "yes"; then
    echo "已取消安装 / cancelled."
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
    if sudo -n true 2>/dev/null; then
        SUDO="sudo"   # 免密可用: 绝不弹提示(避免 pty 下 sudo -v 异常索密)
    else
        info "需要特权操作, 请输入 sudo 密码:"
        sudo -v || fail "sudo 验证失败"
        SUDO="sudo"
    fi
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
export DEBIAN_FRONTEND=noninteractive   # 防 apt/needrestart 交互提示卡死(如 TTY 下"重启哪些服务")
export NEEDRESTART_MODE=a
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
    if pip_install --no-index --find-links "$WHEELS" $CORE_PIP_PKGS; then
        ok "核心 Python 环境安装完成 (离线轮子)"
    else
        # 轮子与本机 Python 版本不匹配(如旧资产只含 cp311 而本机 3.10) → 在线兜底
        warn "离线轮子与本机 Python 不匹配, 回退在线安装 (PyPI)..."
        pip_install $CORE_PIP_PKGS || fail "核心环境安装失败"
        ok "核心 Python 环境安装完成 (在线)"
    fi
    rm -rf "$TMPD"
fi

# ---------- 步骤 4: 下载面板主体 (不含插件) ----------
echo
info "步骤 4/7: 下载面板主体"
TMPD=$(mktemp -d)
fetch "$REPO/releases/download/$TAG/$BODY_ASSET" "$TMPD/$BODY_ASSET" || fail "面板主体下载失败"
tar tzf "$TMPD/$BODY_ASSET" >/dev/null 2>&1 || fail "面板主体包损坏"
ok "面板主体就绪: $BODY_ASSET ($(du -h "$TMPD/$BODY_ASSET" | cut -f1))"

# ---------- 步骤 5: 输入信息 ----------
echo
info "步骤 5/7: 输入安装信息"
APP_DIR=$(ask_default "Install dir / 安装目录" "/opt/raincough")
RUN_USER=$(ask_default "Run user / 运行用户" "root")
PORT="${RC_PORT:-$(ask_default "Panel port / 面板端口" "3900")}"
case "$PORT" in
    ''|*[!0-9]) fail "端口必须是数字 / port must be a number: $PORT" ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    fail "端口范围 1-65535 / port out of range: $PORT"
fi
if port_in_use "$PORT" && port_holder_is_us "$PORT"; then
    info "端口 $PORT 由本面板自己占用(重装), 继续使用"
elif port_in_use "$PORT"; then
    if [ "$HAVE_TTY" = 0 ]; then
        # 非交互: 不能反复提问(会死循环) -> 自动往后找一个空闲端口
        FREE=""
        for cand in $(seq $((PORT + 1)) $((PORT + 20))); do
            if ! port_in_use "$cand"; then PORT="$cand"; FREE=yes; break; fi
        done
        [ -n "$FREE" ] || fail "端口被占用且非交互模式无法询问 / no free port (use RC_PORT=<port>)"
        warn "非交互模式: 默认端口被占用, 自动改用 $PORT"
    else
        while port_in_use "$PORT"; do
            warn "端口 $PORT 已被占用, 请换一个"
            PORT=$(ask_default "Panel port / 面板端口" "3900")
            case "$PORT" in ''|*[!0-9]) PORT=3900 ;; esac
        done
    fi
fi
if confirm_yes "Install p7zip-full/ffmpeg? / 是否安装常用功能工具(p7zip/ffmpeg)?"; then
    INSTALL_TOOLS=yes
else
    INSTALL_TOOLS=no
fi
echo "  摘要: 目录=$APP_DIR 用户=$RUN_USER 端口=$PORT 功能工具=$INSTALL_TOOLS"

# 静态 IP 固定(可选): 把当前 DHCP 分配到的地址原样写成静态配置, 免得以后地址漂移
DO_STATIC=no
if net_detect; then
    echo
    echo "  网络: 网卡=$NET_IFACE 地址=$NET_CIDR 网关=$NET_GW DNS=${NET_DNS:-未取到} 栈=$NET_STACK 当前=$([ "$NET_DHCP" = yes ] && echo DHCP || echo 静态/未知)"
    case "${RC_NET_STATIC:-ask}" in
      yes) DO_STATIC=yes ;;
      no)  DO_STATIC=no ;;
      dry) DO_STATIC=dry ;;
      *)
        if [ "$NET_DHCP" = yes ]; then
            if confirm_default "Fix current address as STATIC config? / 是否把上面这个地址固定为静态配置?(改前备份)" "yes"; then
                DO_STATIC=yes
            fi
        else
            info "当前不是 DHCP(已是静态或未知), 无需固定"
        fi ;;
    esac
else
    warn "未能识别默认路由网卡, 跳过固定 IP"
fi

# ---------- 步骤 6: 安装 ----------
echo
info "步骤 6/7: 安装"
if [ -f "/etc/systemd/system/$UNIT_NAME" ]; then
    if ! confirm_default "Unit $UNIT_NAME already exists, overwrite it? / 检测到已有单元, 是否覆盖?" "yes"; then
        echo "已取消(保留原服务) / cancelled (kept existing service)."
        exit 0
    fi
fi
$SUDO mkdir -p "$APP_DIR"
$SUDO tar xzf "$TMPD/$BODY_ASSET" -C "$APP_DIR" --strip-components=1
$SUDO chmod +x "$APP_DIR/raincough"   # Windows 侧打包可能丢执行位, 防御性补回
$SUDO chown -R "$RUN_USER:$RUN_USER" "$APP_DIR" 2>/dev/null || true
[ -f "$APP_DIR/VERSION" ] || printf '%s\n' "$PANEL_VERSION" | $SUDO tee "$APP_DIR/VERSION" >/dev/null
ok "面板文件解压至 $APP_DIR (版本 $(cat "$APP_DIR/VERSION" 2>/dev/null || echo $PANEL_VERSION))"
if [ "$INSTALL_TOOLS" = "yes" ]; then
    $SUDO apt-get install -y p7zip-full ffmpeg && ok "功能工具已安装"
fi
UNIT=/etc/systemd/system/$UNIT_NAME
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
# 注意: 不能用 enable --now —— 对"已在运行"的单元它是空操作, 重装时新单元(端口/目录变了)
# 不会生效, 而且运行中的命令行与单元文件不一致, systemd 会报 "Current command vanished"。
# enable(开机自启) + restart(未运行=启动, 已运行=真正换上新配置) 才是对的。
$SUDO systemctl enable "$UNIT_NAME" >/dev/null 2>&1 || true
$SUDO systemctl restart "$UNIT_NAME"
ok "systemd 服务已注册并启动 ($UNIT_NAME)"
sleep 1
if systemctl is-active --quiet "$UNIT_NAME"; then
    ok "服务状态: active"
else
    warn "服务未处于 active, 请查看: journalctl -u $UNIT_NAME -n 30 --no-pager"
fi

# ---------- 步骤 6b: 固定静态 IP(可选) ----------
if [ "$DO_STATIC" = "yes" ] || [ "$DO_STATIC" = "dry" ]; then
    echo
    info "步骤 6b/7: 固定静态 IP($DO_STATIC)"
    if net_write_static; then
        if [ "$DO_STATIC" = "yes" ]; then
            ok "静态配置已写入(下次重启/重新激活网络后生效, 当前连接不动)"
            LAN_IP="$(echo "$NET_CIDR" | cut -d/ -f1)"
            net_rollback_hint
        fi
    else
        warn "固定静态 IP 未完成(已保持原状, 不影响面板使用)"
    fi
fi

# ---------- 步骤 7: 完成 ----------
echo
info "步骤 7/7: 验证与完成"
CODE=""
for i in 1 2 3 4 5; do
    sleep 2
    CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" || true)
    [ "$CODE" = "200" ] && break
    [ "$i" -lt 5 ] && info "等待面板就绪 ($i/5, HTTP ${CODE:-000})"
done
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
echo "  服务管理:  systemctl {status|restart|stop} $UNIT_NAME"
echo "  日志:      journalctl -u $UNIT_NAME -f"
echo "  下一步:    面板内【系统扩展】安装媒体中心/任务队列等扩展;"
echo "             【插件】页安装插件 —— 插件依赖将自动安装;"
echo "             aigen/mcskin 的 AI 依赖会自动拉取 env-ai 离线轮子。"
echo "${C_G}=======================================================${C_0}"
