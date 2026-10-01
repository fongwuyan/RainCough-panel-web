# 安装命令（每个版本独立）

面板版本与 git tag 一一对应：`v<版本>`。**每个版本都有自己的安装命令，永久有效**，
命令里的 tag 决定装哪个版本，不会漂到最新版。

## 最新版（跟随 main）

```bash
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/install.sh | bash
```

## 指定版本

```bash
# v1.0.0
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/v1.0.0/install.sh | bash
```

> 以后每发一个版本，就多一条 `…/v<版本>/install.sh` 命令；清单见仓库根 `releases.json`。

## 覆盖项（脚本化/离线用）

| 变量 | 作用 |
|---|---|
| `RC_VERSION=1.0.0` | 强制安装指定版本（等价于用该版本 tag 的脚本） |
| `RC_MIRROR=https://github.com` | 换下载镜像（默认 gh-proxy） |
| `RC_UNIT_NAME=` | 覆盖 systemd 单元名（多实例/测试隔离） |
| `RC_NET_STATIC=yes\|no\|dry` | 是否把当前 DHCP 地址固定为静态（默认在向导里问一次，回车=yes） |
| `RC_NET_FORCE=1` | 已经是静态也强写一遍（默认跳过） |
| `RC_NET_DRYRUN=1` | 只看"将要写入什么"，不落盘 |
| `RC_ONLY_NET=1` | 只跑固定静态 IP 这一步并退出（便于脚本化） |

```bash
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/install.sh | RC_VERSION=1.0.0 bash
```

## 固定静态 IP（安装时可选，一步到位）

面板地址 = `http://<机器IP>:<端口>`，而 IP 由系统网络配置决定。安装向导会读取**默认路由所在网卡**当前的
地址/网关/上游 DNS，原样写成静态配置（免得以后 DHCP 续租漂移）：

| 网络栈 | 写法 |
|---|---|
| NetworkManager（`nmcli` 在管） | `nmcli con mod <连接> ipv4.method manual ipv4.addresses <ip/前缀> ipv4.gateway <网关> [ipv4.dns ...]` |
| netplan（Ubuntu/云镜像） | 写 `/etc/netplan/99-raincough-static.yaml`，把原网卡定义改名为 `*.raincough-disabled`，并写 `cloud-init` 禁管网络文件 |
| ifupdown（Debian 默认） | 写 `/etc/network/interfaces.d/raincough-<网卡>.cfg`，并注释主文件里原有的 `inet dhcp` 段 |

安全约定：

- **只动默认路由那块网卡**，其它网卡不碰；已经是静态的直接跳过（要强写用 `RC_NET_FORCE=1`）
- 改前备份到 `/root/raincough-net-backup-<时间戳>/`，并打印回滚命令
- **只写配置、不立即重启网络**：静态配置下次重启生效，安装会话不会因为改网络而断开
- 写完先 `netplan generate` 校验；**校验失败自动回滚**（删掉我们写的文件、恢复原定义，并把报错存进备份目录）
- 提醒：固定下来的地址若落在路由器 DHCP 池里，将来可能与别的设备冲突 —— 更稳的是在路由器上做 DHCP 保留，或另选池外地址

## 面板更新（面板内）

面板**不会自动更新**。设置之外，侧边栏标题旁的下载按钮 →「面板更新」悬浮窗可：
检查新版本 → 查看该版本更新日志 → 下载并应用（手动确认）→ **由你确认是否立即重启**。
更新只使用本仓 Release 资产，手动三步，绝不静默替换或重启。