# RainCough Panel Web

一个自托管的 **Linux 服务器 Web 管理面板**。基于 Flask + Vue 构建,把远程服务器的日常维护能力整合进一个网页。

<p align="center">
  <strong>终端 · 文件 · 媒体 · 任务 · 系统监控 —— 浏览器里管理你的服务器</strong>
</p>

---

## 简介

RainCough Panel Web 是「RainCough 面板」的 Web 本体,由 **Vue3 前端**与 **Flask 后端**组成。它部署在**局域网(LAN)**内的服务器上:

- 面板运行于局域网,仅局域网内可访问管理界面;
- 服务器**可访问外部网络**(用于在线更新、下载依赖等出站连接);
- **不向外部网络开放入口端口**,外部网络无法直接访问面板,安全边界明确。

它提供:

- 开箱即用的**图形化运维界面**,无需依赖其他前端框架;
- 后端以 **Flask 蓝图 + 可插拔模块**组织,核心打包在**单一 Python 服务**内,用 **systemd** 托管,**开机自启、崩溃自愈**;
- 通过 **sudo + systemd 编排**管理系统服务与进程;
- 内置 **端口转发 / 反向 SSH 隧道 / WebSocket 终端**等通道,便于在局域网内远程操作,或将流量向服务器外转发;

本仓库即面板**完整可运行项目**(前端源码 + 构建产物 + 后端核心),克隆后按下方安装向导即可部署。

---

## 功能

| 模块 | 说明 |
| --- | --- |
| 系统监控 | CPU / 内存 / 磁盘 / 网络实时图表、设备与接口统计、进程列表 |
| 终端 | WebSocket 终端,支持多主机,浏览器内直接操作 Shell |
| 文件管理 | 在线浏览、上传/下载、重命名、删除、目录分析 |
| 媒体中心 | 媒体资源浏览与基础管理 |
| 任务与调度 | 任务队列、定时调度(Scheduler) |
| 环境包 | 在线环境包构建与安装、软件环境管理 |
| 插件市场 | 在线浏览、安装、更新、卸载可插拔扩展模块 |
| 设置与更新 | 可视化设置面板、面板本体在线更新 |
| 网络与服务 | 端口转发、WebSocket/SSH 隧道、服务管理 |
| 工具箱 | 图片、媒体、OCR、二维码、文本等常见小工具 |

> 面板**本体即自包含**;具体业务扩展模块(若安装)会出现在相应的菜单分类中。

---

## 技术栈

- **后端**: Python 3 · Flask · psutil · paramiko · 服务编排(systemd / sudo)
- **前端**: Vue 3 · Vite · Vue Router · 组件化视图
- **通信**: REST(`/api/...`)+ WebSocket 终端(websockify / PHP 桥接)
- **部署**: systemd 服务、开机自启、崩溃自愈

---

## 安装向导

>> 以下为交互式安装向导。目前仅支持 Linux,需要 **Python 3.9+** 与 **root 权限**(或可 `sudo`)的服务器。

### 方式一:一键安装向导(推荐)

下载并运行安装向导脚本,按提示逐步完成:

```bash
curl -fsSL -o install.sh https://raw.githubusercontent.com/fongwuyan/RainCough-panel-web/main/install.sh
chmod +x install.sh
sudo bash install.sh
```

向导包含以下**交互步骤**:

1. **环境检测** —— 检查 Python 版本、可用性,不满足则提示;
2. **创建虚拟环境** —— 选择安装目录,自动创建 venv;
3. **安装依赖** —— 安装 `requirements.txt` 所需依赖;
4. **启动方式** —— 选择「以 systemd 服务运行」或「前台运行」;
5. **开放端口** —— 可选开启面板端口(默认 `3000`)的防火墙放行;
6. **完成** —— 打印访问地址与使用说明。

### 方式二:手动安装

```bash
# 1. 拉取代码
git clone https://github.com/fongwuyan/RainCough-panel-web.git
cd RainCough-panel-web

# 2. 创建并进入虚拟环境
python3 -m venv venv
source venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 启动(默认 3000 端口)
python app.py

# 5. 浏览器访问
#    http://<服务器IP>:3000
```

### systemd 托管(建议生产使用)

将面板注册为系统服务,随系统自启、崩溃自动拉起:

```ini
# /etc/systemd/system/raincough-panel.service
[Unit]
Description=RainCough Panel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=3
ExecStart=/opt/raincough-panel/venv/bin/python /opt/raincough-panel/app.py

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now raincough-panel
```

---

## 目录结构

```
├── app.py                 # 后端入口:注册各业务蓝图与模块分发路由
├── plugins/               # 可插拔模块基类(Plugin / PluginManager)与公共模块
│   ├── base.py            # Plugin 抽象、路由注册、动态分发
│   └── *_common.py        # 公共工具模块
├── web/                   # Vue3 前端源码(组件化)
│   └── src/components/    # 各功能视图(监控 / 终端 / 文件 / 任务 / 设置等)
├── public/                # 前端构建产物(静态资源)
└── tools/                 # 辅助工具
```

---

## 多语言插件(非 Python)

插件不限于 Python: 在插件目录提供 `plugin.json` + 任意语言入口即可由面板拉起并代理请求。

```json
{ "name": "hello", "label": "示例", "lang": "node",
  "cmd": ["node", "server.js"], "env": "node-22", "timeout": 15 }
```

- 子进程监听环境变量 `RAINCOUGH_PORT` 指定的 127.0.0.1 端口
- `GET /__health` 返回 200 表示就绪; 其余路径与 `/api/plugins/<name>/*` 一一对应
- `env` 可指向面板环境包(envpkg)以注入 PATH, 如 `node-22` / `go-1.26.5`
- 面板删除插件时会自动终止子进程; 进程随面板退出自动清场(atexit)

## License

[MIT](./LICENSE)