# 安装与卸载

面板版本与 git tag 一一对应：`v<版本>`。**每个版本都有自己的安装命令，永久有效**——
命令里的 tag 决定装哪个版本，不会漂到最新版。

## 最新版（跟随 main）

```bash
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/install.sh | bash
```

## 指定版本

```bash
# 例如 v1.0.0-beta
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/v1.0.0-beta/install.sh | bash
```

> 每发一个版本就多一条 `…/v<版本>/install.sh` 命令；清单见仓库根 `releases.json`。

## 安装流程与交互

脚本分 5 步：确认 → 环境检查（含 root 密码）→ 插件运行时 → 下载主体 → 安装+验证。

会向你提问的只有以下几处：

| 顺序 | 提问 | 默认 |
|---|---|---|
| 1 | 是否开始安装 | `yes` |
| 2 | **root 密码**（仅当既不是 root 又不免密 sudo 时） | 无默认，最多 3 次 |
| 3 | 是否把当前地址固定为静态配置 | `yes` |
| 4 | 检测到同名 systemd 单元时是否覆盖 | `yes` |
| 5 | 是否把面板密码设成 SSH 登录密码（仅当系统密码可离线校验时） | `yes` |

**关于第 2 步的 root 密码**：输入一次，用于完成后续全部特权操作（创建 `/opt/raincough`、
注册 systemd、按需安装插件运行时）。密码只存在内存和一个 `0600` 临时文件里，脚本退出
即删除；不写日志、不写安装目录、不出现在任何命令行参数中。密码输错会重试，最多 3 次，
每次重试都会先清掉上一次的临时文件。

以下情况不会询问密码：

- 已经是 root（`su -c 'bash install.sh'`）
- sudo 免密（NOPASSWD）
- 用 `RC_ROOT_PASSWORD` 显式传入

无交互终端（例如 `curl | bash` 且没有 tty）时，前四项取默认值；但 **root 密码拿不到默认值**，
此时必须用 root 运行或传 `RC_ROOT_PASSWORD`，否则脚本会明确报错并给出三种可选方式。

## 安装参数（固定）

| 项 | 值 |
|---|---|
| 安装目录 | **`/opt/raincough`**（仅测试可用 `RC_APP_DIR` 覆盖） |
| 运行用户 | **`root`**（可用 `RC_RUN_USER` 覆盖；覆盖后只能用面板密码登录，SSH 密码通道降级） |
| 端口 | 从 `3900` 起取第一个空闲端口；被本面板自己占用（重装）则沿用；`RC_PORT` 可指定 |

## 覆盖项（脚本化 / 离线用）

| 变量 | 作用 |
|---|---|
| `RC_VERSION=1.0.0-beta` | 强制安装指定版本（等价于用该版本 tag 的脚本） |
| `RC_ROOT_PASSWORD=` | 免交互提供 root 密码 |
| `RC_ADMIN_PASSWORD=` | 指定面板登录密码（省略则首次启动随机生成，写进 journal） |
| `RC_MIRROR=https://github.com` | 换下载镜像（默认 gh-proxy） |
| `RC_UNIT_NAME=` | 覆盖 systemd 单元名（多实例 / 测试隔离） |
| `RC_APP_DIR=` | 覆盖安装目录 |
| `RC_RUN_USER=` | 覆盖服务运行用户 |
| `RC_PORT=` | 覆盖面板端口 |
| `RC_PLUGIN_LANGS=python,php,java,node,go` | 要保证的插件运行时（逗号分隔） |
| `RC_SKIP_RUNTIMES=1` | 完全跳过插件运行时安装 |
| `RC_GO_VERSION=1.23.4` | 安装 Go 时用的版本 |
| `RC_NET_STATIC=yes\|no\|dry` | 是否把当前地址固定为静态（默认在向导里问一次） |
| `RC_NET_FORCE=1` | 已经是静态也强写一遍 |
| `RC_NET_DRYRUN=1` | 只看「将写入什么」，不落盘 |
| `RC_ONLY_NET=1` | 只跑固定静态 IP 这一步并退出 |
| `RC_PROMPT_TIMEOUT=120` | 交互读超时秒数（超时按默认值继续） |

```bash
# 完全免交互
curl -fsSL .../main/install.sh | \
  RC_ROOT_PASSWORD='<root密码>' RC_ADMIN_PASSWORD='<面板密码>' \
  RC_PORT=3910 RC_NET_STATIC=no bash
```

## 插件运行时

面板自身零依赖（单 Go 二进制），但插件后端可以是多语言。步骤 2b 会按需补齐：

| 语言 | 安装的包 | 说明 |
|---|---|---|
| Python | `python3` + `python3-pip` | 另补 `python` → `python3` 别名（Debian 12 只有 `python3`） |
| PHP | `php-cli` | |
| Java | `default-jdk-headless` | 装 JDK 而非 JRE：`.java` 源码形式的插件需要 `jdk.compiler` |
| Node | `nodejs` | |
| Go | 官方二进制（默认 1.23.4） | 仅编译 Go 插件用，装不上不影响面板 |

- 首次安装包前会先 `apt-get update` 刷新索引（全新镜像的索引可能是空的）
- 全程 `DEBIAN_FRONTEND=noninteractive`，不会弹 tzdata 之类的配置界面
- 非 apt 发行版不硬失败：面板照常可用，对应语言的插件会跑不起来，脚本会打印该发行版的安装命令
- 插件自己的依赖（如 JMComic 需要 `jmcomic`）不在这里装。面板启动插件前会预检，
  缺包时日志会明确写缺哪个模块并给出 `pip install` 命令
- Debian 12+ 的 pip 受 PEP 668 保护，装依赖需要 `--break-system-packages`：
  ```bash
  python3 -m pip install --break-system-packages "jmcomic>=2.7" "requests>=2.31"
  ```

## 固定静态 IP（安装时可选）

面板地址是 `http://<机器IP>:<端口>`，而 IP 由系统网络配置决定。向导会读取**默认路由所在
网卡**的当前地址/网关/上游 DNS，原样写成静态配置（免得以后 DHCP 续租漂移）：

| 网络栈 | 写法 |
|---|---|
| NetworkManager（`nmcli` 在管） | `nmcli con mod <连接> ipv4.method manual ipv4.addresses <ip/前缀> ipv4.gateway <网关> [ipv4.dns ...]` |
| netplan（Ubuntu/云镜像） | 写 `/etc/netplan/99-raincough-static.yaml`，把原网卡定义改名，并写 cloud-init 禁管文件 |
| ifupdown（Debian 默认） | 写 `/etc/network/interfaces.d/raincough-<网卡>.cfg`，并注释主文件里原有的 `inet dhcp` 段 |

安全约定：

- **只动默认路由那块网卡**，其它网卡不碰；已经是静态直接跳过（`RC_NET_FORCE=1` 强写）
- 改前备份到 `/root/raincough-net-backup-<时间戳>/`，并打印回滚命令
- **只写配置、不立即重启网络**：下次重启生效，安装会话不会被踢掉
- 写完先 `netplan generate` 校验；**校验失败自动回滚**
- 提醒：固定下来的地址若落在路由器 DHCP 池里，将来可能与别的设备冲突——更稳的是在路由器做 DHCP 保留

## 卸载

```bash
# 先看要做什么（不修改任何东西）
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/uninstall.sh | sudo bash -s -- --dry-run

# 卸载（保留数据：data/ 与 plugins/）
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/uninstall.sh | sudo bash -s -- --yes
```

默认会：停用并删除 `raincough.service`、删除程序文件（`raincough` / `public/` / `VERSION` /
`install.sh` / `CHANGELOG.md` / `.update/` / `*.bak` / `extensions/` / `extension-src/`）、
清理 `/run/raincough`。

**默认保留**：`<安装目录>/data`（KV 数据、面板密码、插件配置）、`<安装目录>/plugins`、
插件单元 `plugin-*.service`、安装时固定的静态 IP 配置。

| 参数 | 作用 |
|---|---|
| `--purge` | 连 `data/` 与 `plugins/` 一起删 |
| `--with-plugins` | 同时停用并删除 `plugin-*.service` 单元（插件目录仍保留） |
| `--unset-static-ip` | 还原安装程序写的静态 IP（从 `/root/raincough-net-backup-*` 恢复，重启生效） |
| `--app-dir=<路径>` | 指定安装目录（默认 `/opt/raincough`，也可用 `RC_APP_DIR`） |
| `--dry-run` | 只打印将执行的动作 |
| `--yes` | 不提问直接执行（无交互终端时必须显式给，否则默认取消） |

**手工卸载**（不想用脚本时）：

```bash
sudo systemctl disable --now raincough.service
sudo rm -f /etc/systemd/system/raincough.service
sudo systemctl daemon-reload
sudo rm -rf /run/raincough
sudo cp -a /opt/raincough/data /opt/raincough/plugins /tmp/   # 想留数据先备份
sudo rm -rf /opt/raincough
```

## 面板更新（面板内）

面板**不会自动更新**。侧边栏标题旁的下载按钮 →「面板更新」悬浮窗可：

检查新版本 → 查看该版本更新日志 → 下载并应用（手动确认）→ **由你确认是否立即重启**。

更新只使用本仓 Release 资产，手动三步，绝不静默替换或重启。

## 常见问题

**装了插件起不来，日志只有 `exit=-1`**
检查对应语言的解释器是否就绪：面板「插件」页会显示语言标签，缺解释器时标「缺 xx 环境」。
也可以在「设置 → 仓库配置」点「测试连接」看运行时探测结果。

**市场里只有已装的插件，装不了新的**
看清单来源标签：显示「本地清单（GitHub 不可达）」说明面板拉不到 GitHub，回退到了本地扫描。
先确认机器能访问 `api.github.com`。若仓库已公开，面板里残留的失效 Token 会被自动忽略
（日志出现 `GitHub token 无效, 改用匿名请求`），不影响使用。

**插件库提示已上锁**
输入插件库口令解锁，30 天内免输。忘掉口令可点「重新上锁」后重试；连续输错 5 次锁定 60 秒。
