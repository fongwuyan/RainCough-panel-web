#!/usr/bin/env bash
# ============================================================================
# RainCough 面板卸载器
#
#   curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/
#   RainCough-panel-web/main/uninstall.sh | sudo bash -s -- --dry-run
#
# 默认行为(安全):
#   · 停止并删除面板单元 raincough.service
#   · 停止并删除【系统扩展后端】单元 rc-ext-*.service(它们属于面板装的)
#   · 删除程序本体(APP_DIR 下的 raincough/public/VERSION/install.sh/CHANGELOG.md/.update/*.bak/extensions/extension-src)
#   · ★保留数据: APP_DIR/data(rc.db 面板数据+工作台历史) 与 APP_DIR/plugins(插件及其数据)
#   · 插件单元 plugin-*.service 默认【不动】(需要时加 --with-plugins)
#   · 安装时固定的静态 IP 默认【不动】(需要时加 --unset-static-ip)
#
# 参数:
#   --purge             连 data/ 与 plugins/ 一起删(彻底清空 APP_DIR)
#   --with-plugins      同时停用并删除 plugin-*.service 单元(不删插件目录)
#   --unset-static-ip   还原安装程序写的静态 IP 配置(从 /root/raincough-net-backup-* 恢复)
#   --app-dir=<路径>    指定安装目录(默认 /opt/raincough, 也可用 RC_APP_DIR)
#   --dry-run           只打印将执行的动作, 什么都不改
#   --yes               不提问, 直接执行
# ============================================================================
set -uo pipefail

APP_DIR="${RC_APP_DIR:-/opt/raincough}"
UNIT_NAME="${RC_UNIT_NAME:-raincough.service}"
PURGE=no; WITH_PLUGINS=no; UNSET_IP=no; DRY=no; YES=no

C_G=$'\033[32m'; C_Y=$'\033[33m'; C_C=$'\033[36m'; C_R=$'\033[31m'; C_0=$'\033[0m'
ok()   { echo "${C_G}[OK]${C_0} $*"; }
info() { echo "${C_C}[..]${C_0} $*"; }
warn() { echo "${C_Y}[!!]${C_0} $*"; }
fail() { echo "${C_R}[X]${C_0} $*" >&2; exit 1; }

usage() { sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'; }

for a in "$@"; do
    case "$a" in
        --purge)            PURGE=yes ;;
        --with-plugins)     WITH_PLUGINS=yes ;;
        --unset-static-ip)  UNSET_IP=yes ;;
        --app-dir=*)        APP_DIR="${a#*=}" ;;
        --dry-run)          DRY=yes ;;
        --yes|-y)           YES=yes ;;
        -h|--help)          usage; exit 0 ;;
        *) echo "未知参数: $a"; echo; usage; exit 2 ;;
    esac
done

# ---- 终端能力(与 install.sh 同款): 无 tty 时不提问 ----
HAVE_TTY=0
if [ -t 0 ]; then HAVE_TTY=1
elif [ -c /dev/tty ] && { true < /dev/tty; } 2>/dev/null; then HAVE_TTY=2; fi
read_tty() {
    local __r=""
    case "$HAVE_TTY" in
        1) IFS= read -t "${RC_PROMPT_TIMEOUT:-120}" -r __r 2>/dev/null || __r="" ;;
        2) IFS= read -t "${RC_PROMPT_TIMEOUT:-120}" -r __r < /dev/tty 2>/dev/null || __r="" ;;
    esac
    printf '%s' "$__r"
}
confirm_default() {
    local a
    if [ "$HAVE_TTY" = 0 ]; then
        echo "  (no tty) $1 -> default: $2" >&2
        case "$2" in yes|y|Y) return 0 ;; *) return 1 ;; esac
    fi
    printf '  %s [%s]: ' "$1" "$2"
    a="$(read_tty)"; a="${a:-$2}"
    case "$a" in yes|y|Y|YES) return 0 ;; *) return 1 ;; esac
}

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
    $SUDO -n true 2>/dev/null || { [ "$YES" = yes ] && fail "需要 root(或免密 sudo)"; }
fi
run() {   # 打印 + 执行(或 dry-run 只打印)
    if [ "$DRY" = yes ]; then
        echo "    [dry-run] $*"
        return 0
    fi
    "$@"
}

unit_exists() { $SUDO systemctl list-unit-files "$1" >/dev/null 2>&1 && $SUDO systemctl cat "$1" >/dev/null 2>&1; }

echo
echo "${C_C}=======================================================${C_0}"
echo "${C_C}   RainCough 面板卸载${C_0}"
echo "${C_C}=======================================================${C_0}"
echo "  安装目录: $APP_DIR"
echo "  面板单元: $UNIT_NAME"
echo "  保留数据: $([ "$PURGE" = yes ] && echo '否(--purge 会一起删)' || echo '是(data/ 与 plugins/)')"
echo "  插件单元: $([ "$WITH_PLUGINS" = yes ] && echo '一并停用删除' || echo '不动')"
echo "  静态 IP : $([ "$UNSET_IP" = yes ] && echo '一并还原' || echo '不动')"
[ "$DRY" = yes ] && echo "  ${C_Y}模式: dry-run(不修改任何东西)${C_0}"

if [ "$YES" != yes ]; then
    echo
    if ! confirm_default "确认卸载? / confirm uninstall?" "no"; then
        echo "已取消 / cancelled."; exit 0
    fi
fi

# ---- 0. 校验这确实是面板安装目录, 避免误删 ----
if [ ! -d "$APP_DIR" ]; then
    warn "目录不存在: $APP_DIR (跳过目录清理)"
elif [ ! -e "$APP_DIR/raincough" ] && [ ! -e "$APP_DIR/VERSION" ]; then
    fail "$APP_DIR 看起来不是面板安装目录(既无 raincough 也无 VERSION) —— 已中止, 请用 --app-dir=<正确路径>"
else
    ok "已确认 $APP_DIR 是面板安装目录"
fi

# ---- 1. 面板单元 ----
info "步骤 1/6: 停止并删除面板单元"
if $SUDO systemctl cat "$UNIT_NAME" >/dev/null 2>&1; then
    run $SUDO systemctl disable --now "$UNIT_NAME" >/dev/null 2>&1 || true
    run $SUDO rm -f "/etc/systemd/system/$UNIT_NAME"
    ok "已停止并删除单元 $UNIT_NAME"
else
    info "单元 $UNIT_NAME 不存在(可能已卸载)"
fi

# ---- 2. 系统扩展后端单元 rc-ext-*.service ----
info "步骤 2/6: 停止并删除系统扩展后端单元"
EXTS=""
for f in /etc/systemd/system/rc-ext-*.service; do
    [ -e "$f" ] || continue
    EXTS="$EXTS $(basename "$f")"
done
if [ -n "$EXTS" ]; then
    for u in $EXTS; do
        run $SUDO systemctl disable --now "$u" >/dev/null 2>&1 || true
        run $SUDO rm -f "/etc/systemd/system/$u"
        info "  已移除 $u"
    done
    ok "共移除 $(echo $EXTS | wc -w) 个扩展后端单元"
else
    info "没有 rc-ext-*.service"
fi

# ---- 3. 插件单元(默认不动) ----
info "步骤 3/6: 插件单元"
PLUGINS=""
for f in /etc/systemd/system/plugin-*.service; do
    [ -e "$f" ] || continue
    PLUGINS="$PLUGINS $(basename "$f")"
done
if [ -n "$PLUGINS" ]; then
    if [ "$WITH_PLUGINS" = yes ]; then
        for u in $PLUGINS; do
            run $SUDO systemctl disable --now "$u" >/dev/null 2>&1 || true
            run $SUDO rm -f "/etc/systemd/system/$u"
        done
        ok "已停用并删除 $(echo $PLUGINS | wc -w) 个插件单元(插件目录保留)"
    else
        warn "检测到 $(echo $PLUGINS | wc -w) 个插件单元, 按默认【保留】; 要一起清理加 --with-plugins"
    fi
else
    info "没有 plugin-*.service"
fi

# ---- 4. 程序文件(保留 data/ 与 plugins/) ----
info "步骤 4/6: 删除程序文件"
if [ -d "$APP_DIR" ]; then
    for entry in "$APP_DIR"/* "$APP_DIR"/.[!.]*; do
        [ -e "$entry" ] || continue
        base="$(basename "$entry")"
        case "$base" in
            data|plugins)
                if [ "$PURGE" = yes ]; then run $SUDO rm -rf "$entry"; else info "  保留 $entry"; fi ;;
            *)  run $SUDO rm -rf "$entry" ;;
        esac
    done
    if [ "$PURGE" = yes ]; then
        run $SUDO rm -rf "$APP_DIR"
        ok "已删除 $APP_DIR(含数据)"
    else
        ok "已删除程序文件, 保留 $APP_DIR/data 与 $APP_DIR/plugins"
    fi
fi
run $SUDO rm -rf /run/raincough
run $SUDO rm -rf /tmp/raincough-* 2>/dev/null || true

# ---- 5. 可选的静态 IP 还原 ----
info "步骤 5/6: 静态 IP 还原"
if [ "$UNSET_IP" != yes ]; then
    info "按默认【不动】静态 IP 配置; 需要还原加 --unset-static-ip"
    NETBAK=$(ls -d /root/raincough-net-backup-* 2>/dev/null | tail -1)
    [ -n "$NETBAK" ] && info "  (安装时的备份仍在: $NETBAK)"
else
    NETBAK=$(ls -d /root/raincough-net-backup-* 2>/dev/null | tail -1)
    if [ -z "$NETBAK" ]; then
        warn "找不到 /root/raincough-net-backup-*, 无法自动还原(可能安装时没固定 IP)"
    else
        info "  使用备份: $NETBAK"
        # netplan
        if [ -e /etc/netplan/99-raincough-static.yaml ]; then
            run $SUDO rm -f /etc/netplan/99-raincough-static.yaml
            for f in /etc/netplan/*.raincough-disabled; do
                [ -e "$f" ] || continue
                run $SUDO mv "$f" "${f%.raincough-disabled}"
                info "  已恢复 ${f%.raincough-disabled}"
            done
            run $SUDO rm -f /etc/cloud/cloud.cfg.d/99-raincough-disable-network-config.cfg
            if [ "$DRY" != yes ]; then
                $SUDO netplan generate >/dev/null 2>&1 && ok "netplan 配置已还原并校验通过" \
                    || warn "netplan generate 失败, 请手工检查 /etc/netplan"
            fi
        fi
        # ifupdown
        for f in /etc/network/interfaces.d/raincough-*.cfg; do
            [ -e "$f" ] || continue
            run $SUDO rm -f "$f"
            b="$NETBAK/$(echo "$f" | tr '/' '_')"
            [ -e "$b" ] && run $SUDO cp -a "$b" "$f" && info "  已从备份恢复 $f"
        done
        # NetworkManager: 备份里存的是 nm-<连接名>.txt
        for b in "$NETBAK"/nm-*.txt; do
            [ -e "$b" ] || continue
            con="$(basename "$b")"; con="${con#nm-}"; con="${con%.txt}"
            run $SUDO nmcli con mod "$con" ipv4.method auto ipv4.addresses "" ipv4.gateway "" ipv4.dns "" \
                >/dev/null 2>&1 || true
            info "  已把 NM 连接 $con 改回自动获取"
        done
        warn "网络配置的改动在【下次重启】后生效(本次不动当前连接)"
    fi
fi

# ---- 6. 收尾 ----
info "步骤 6/6: 收尾"
run $SUDO systemctl daemon-reload
run $SUDO systemctl reset-failed 2>/dev/null || true

echo
echo "${C_G}=======================================================${C_0}"
echo "${C_G}  卸载完成${C_0}"
[ "$DRY" = yes ] && echo "  (dry-run: 以上都只是将要执行的动作)"
if [ "$PURGE" != yes ] && [ -d "$APP_DIR" ]; then
    echo "  保留的数据: $APP_DIR/data  $APP_DIR/plugins"
    echo "  想彻底清空: sudo $0 --purge --yes"
fi
echo "  安装程序装的系统包(python 依赖/p7zip/ffmpeg)未动; 需要时:"
echo "    sudo apt-get remove --purge p7zip-full ffmpeg   # 其余 python 包按需处理"
echo "${C_G}=======================================================${C_0}"
