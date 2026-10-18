# RainCough 开发文档

> 面板主系统仓库 `RainCough-panel-web`（Go + Vue3，单二进制零依赖）。
> 当前版本 **1.0.0-beta**，默认端口 3900 起找空闲，systemd 单元 `raincough.service`。

## 安装

### 一条命令（Linux x86_64 + systemd）

```bash
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/install.sh | bash
```

安装过程分两步交互：

1. **确认** —— 输入 `yes` 开始
2. **root 密码** —— 输入一次，用于建目录、注册 systemd、按需安装插件运行时

密码只存在内存与一个 `0600` 临时文件里，退出即删；不写日志、不写 `/opt`、不出现在
命令行参数中。已是 root 或 sudo 免密时不会询问。

安装完成后会打印访问地址、安装目录、数据目录与服务管理命令。

### 免交互安装（批量部署 / CI）

```bash
RC_ROOT_PASSWORD='<root密码>' \
RC_ADMIN_PASSWORD='<面板登录密码>' \
RC_PORT=3910 \
RC_NET_STATIC=no \
  bash install.sh
```

### 常用环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `RC_VERSION` | 指定面板版本（省略则用脚本内嵌版本，不存在时回退 latest） | 内嵌 |
| `RC_PORT` | 面板端口 | 3900 起找空闲 |
| `RC_APP_DIR` | 安装目录 | `/opt/raincough` |
| `RC_PLUGIN_LANGS` | 要保证的插件运行时，逗号分隔 | `python,php,java,node,go` |
| `RC_SKIP_RUNTIMES` | 设 `1` 完全跳过插件运行时安装 | 未设 |
| `RC_ROOT_PASSWORD` | 免交互提供 root 密码 | 未设 |
| `RC_ADMIN_PASSWORD` | 指定面板登录密码 | 首次启动随机生成 |
| `RC_NET_STATIC` | 是否把当前 IP 写成静态（`yes`/`no`/`dry`） | 询问 |
| `RC_MIRROR` | 资产下载镜像 | `https://gh-proxy.com/https://github.com` |

### 卸载

```bash
curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/uninstall.sh | bash
```

默认保留 `data/`（配置与插件数据）。要连数据一起删，加 `RC_PURGE_DATA=1`。

### 安装器做了什么

五步：确认 → 环境检查（含 root 密码）→ 插件运行时 → 下载主体 → 解压建目录写 systemd → 验证。

需要注意的几点：

- **只装面板主体**。插件在面板内「插件」页安装，插件自己的依赖（例如 JMComic 需要
  `jmcomic`）由插件侧处理，面板启动时会预检并提示缺哪个包
- **版本回退**：若脚本内嵌版本的 Release 还没发布，会自动回退到 latest 并明确提示，
  而不是报一句「下载失败」
- **runner 用户**：默认以 root 运行，这样能用 SSH 登录密码进面板；`RC_RUN_USER` 覆盖后
  该通道降级，只能用面板自带密码登录
- **静态 IP** 只写配置，默认不立即重启网络，安装会话不会被踢掉

## 文档导航

| 文档 | 内容 |
|---|---|
| [架构总览](架构总览.md) | 系统组成、进程模型、目录结构、数据流 |
| [插件开发指南](插件开发指南.md) | 新插件全流程：骨架 / plugin.json / SDK / 前端 / 构建 / systemd / 验证 |
| [插件接口库-v4设计](插件接口库-v4设计.md) | 接口库协议 / 传输 / RPC / 错误码 / 可见性 |
| [系统功能接口](系统功能接口.md) | `system.*` 内置接口清单与调用方式 |
| [插件v4迁移指南](插件v4迁移指南.md) | 插件 v4 化记录与迁移方法 |
| [前端开发指南](前端开发指南.md) | `web/` 结构、系统页、PluginView v4、构建 |
| [部署档案-防错手册](部署档案-防错手册.md) | 宿主部署流程、备份、验证清单、Git 要点 |
| [功能清单](功能清单.md) | 面板已实现功能一览 |
| [install.md](install.md) | 安装细节与故障排查 |

## 常用命令（本地开发机）

```bash
# Go 后端
go build ./... && go vet ./...
go test ./...

# 前端检查 + 构建（check 必须先跑，构建本身不检查未定义标识符）
cd web && npm run check && npm run build

# 页面冒烟（真实浏览器加载每一页，查 JS 异常 / 全局错误条 / API 4xx）
node tools/smoke-pages.mjs http://127.0.0.1:3910/ --port 9444 --pw <面板密码>

# 插件前端（frontend/plugin.js → 自包含 assets/plugin.js，内联 Vue）
node tools/build-plugin-frontend.js <name>
```

`npm run release` = `check && build`，发布前用它，别直接 `build`。

## 仓库结构

```
RainCough-Core/
├── cmd/raincough/        入口、HTTP 路由、各功能 handler
├── internal/
│   ├── auth/             登录鉴权 + 插件库口令闸门
│   ├── core/             文件管理 / 终端 / 任务 / 插件市场 / 插件包安装
│   ├── pluginx/          插件接口库（RPC + 声明式 REST 桥 + 资产服务）
│   ├── pluginrt/         多语言插件运行时（py/php/java/node/go/bash 解析与探测）
│   ├── supervisor/       插件进程管理（fork / 退避重启 / 日志）
│   ├── legacy/           旧 SQLite 数据库迁移（零依赖手写读取器）
│   └── shared/           KV 存储层（按命名空间的追加日志）
├── web/                  Vue3 前端源码（构建产物进 public/）
├── plugins/              随仓库分发的插件（当前仅 JMComic）
├── docs/                文档
├── tools/               构建脚本与验收探针
└── install.sh           一键安装器
```

## 数据目录

```
<data>/
├── kv/                  KV 日志（core_store / core_terminal / core_tasks / <插件> …）
├── secret/admin.pw      面板密码（$6$ SHA-512 哈希，0600）
└── log/plugins/         插件 stdout/stderr
```

`RC_DATA_DIR` 可覆盖（默认 `<APP_DIR>/data`）。
