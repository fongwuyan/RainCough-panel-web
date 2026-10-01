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

## 安装参数（固定，不再提问）

| 项 | 值 |
|---|---|
| 安装目录 | **锁死 `/opt/raincough`**（不提问；仅测试可用 `RC_APP_DIR` 覆盖） |
| 运行用户 | **当前调用安装脚本的用户**（`sudo` 调用取 `SUDO_USER`，否则取登录用户；不提问） |
| 端口 | **自动挑选**：从 `3900` 起取第一个空闲端口；被本面板自己占用（重装）则沿用原端口；可用 `RC_PORT` 指定 |

向导只剩三个问题：是否开始、是否装 `p7zip-full`/`ffmpeg`、是否把当前地址固定为静态。

> ⚠️ 服务以普通用户运行时，需要 root 的操作（安装/更新系统扩展、面板自更新重启）走的是**面板设置里
> 配置的 sudo 密码**（内部执行 `echo <密码> | sudo -S ...`）。装完请在面板设置里填上该用户的 sudo 密码，
> 否则扩展安装/更新、自更新重启这类功能会失败。想让这些功能免配置，就保持以 root 运行（`sudo bash install.sh`）。

## 覆盖项（脚本化/离线用）

| 变量 | 作用 |
|---|---|
| `RC_VERSION=1.0.0` | 强制安装指定版本（等价于用该版本 tag 的脚本） |
| `RC_MIRROR=https://github.com` | 换下载镜像（默认 gh-proxy） |
| `RC_UNIT_NAME=` | 覆盖 systemd 单元名（多实例/测试隔离） |
| `RC_APP_DIR=` | 覆盖安装目录（默认锁死 `/opt/raincough`） |
| `RC_RUN_USER=` | 覆盖服务运行用户（默认取调用安装脚本的用户） |
| `RC_PORT=` | 覆盖面板端口（默认从 3900 起自动挑空闲端口） |
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

## 卸载

```bash
# 先看要做什么(不修改任何东西)
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/uninstall.sh | sudo bash -s -- --dry-run

# 卸载(保留数据: data/ 与 plugins/)
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/uninstall.sh | sudo bash -s -- --yes
```

默认会：停用并删除面板单元 `raincough.service`、停用并删除**系统扩展后端**单元 `rc-ext-*.service`、
删除程序文件（`raincough`/`public/`/`VERSION`/`install.sh`/`CHANGELOG.md`/`.update/`/`*.bak`/`extensions/`/
`extension-src/`）、清理 `/run/raincough`。

**默认保留**：`<安装目录>/data`（`rc.db` 面板数据 + 工作台历史）、`<安装目录>/plugins`（插件与其数据）、
插件单元 `plugin-*.service`、安装时固定的静态 IP 配置。安装程序装的系统包（python 依赖/p7zip/ffmpeg）也不动。

| 参数 | 作用 |
|---|---|
| `--purge` | 连 `data/` 与 `plugins/` 一起删（彻底清空安装目录） |
| `--with-plugins` | 同时停用并删除 `plugin-*.service` 单元（插件目录仍保留） |
| `--unset-static-ip` | 还原安装程序写的静态 IP（从 `/root/raincough-net-backup-*` 恢复；改动下次重启生效） |
| `--app-dir=<路径>` | 指定安装目录（默认 `/opt/raincough`，也可用 `RC_APP_DIR`） |
| `--dry-run` | 只打印将执行的动作 |
| `--yes` | 不提问直接执行（无交互终端时必须显式给，否则默认取消） |

**卸载驱动扩展**（面板内）：系统扩展 → 已装扩展里的「驱动」→ 卸载（会停 `rc-ext-drivers.service`、删单元、
删扩展目录、摘掉 8 个接口）。**卸载魔改驱动**：驱动页 → 退路 → 官方卸载 / 回 Debian 包 / 回补丁前。

**手工卸载**（不想用脚本时）：

```bash
sudo systemctl disable --now raincough
sudo rm -f /etc/systemd/system/raincough.service
sudo systemctl disable --now rc-ext-drivers.service && sudo rm -f /etc/systemd/system/rc-ext-drivers.service
sudo systemctl daemon-reload
sudo rm -rf /run/raincough
sudo cp -a /opt/raincough/data /opt/raincough/plugins /tmp/    # 想留数据就先备份
sudo rm -rf /opt/raincough
```

## 面板更新（面板内）

面板**不会自动更新**。设置之外，侧边栏标题旁的下载按钮 →「面板更新」悬浮窗可：
检查新版本 → 查看该版本更新日志 → 下载并应用（手动确认）→ **由你确认是否立即重启**。
更新只使用本仓 Release 资产，手动三步，绝不静默替换或重启。