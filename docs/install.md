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

```bash
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/install.sh | RC_VERSION=1.0.0 bash
```

## 面板更新（面板内）

面板**不会自动更新**。设置之外，侧边栏标题旁的下载按钮 →「面板更新」悬浮窗可：
检查新版本 → 查看该版本更新日志 → 下载并应用（手动确认）→ **由你确认是否立即重启**。
更新只使用本仓 Release 资产，手动三步，绝不静默替换或重启。