# 更新日志（面板）

本项目遵循：**版本号只在明确确认后递增**，任何代码改动默认不动版本号。
每个版本一个 git tag（`vX.Y.Z`），并发布同名 Release，资产为 `raincough-linux-x86_64-<版本>.tar.gz`。
每个版本有独立安装命令（见 README / releases.json）。

## 未发布 — 设置页「密钥」替换「访问令牌」
- 设置 → 仓库配置：移除「访问令牌」(GitHub Token) 输入，换成「密钥」(插件库口令)
  - 密钥不保存：口令哈希写死在二进制里，输入只用于解锁，解锁后 30 天有效
  - 提供「解锁 / 上锁」两个动作与当前状态（未解锁 / 已解锁）
  - `GET/POST /api/store/settings` 不再返回/接收 token 字段
- 插件市场未解锁时的上锁面板改为极简形态：**只有输入框 + 解锁按钮**
  - 去掉 🔒 图标、标题、说明段落、"连续输错 5 次会锁定" 提示
  - 仅在输错时显示一行错误
- 新增探针 `tools/settings-gate-probe.mjs`（25 项）

## 未发布 — 插件「面板内直接安装」
- **新增「安装插件」**：上传本地插件包直接在面板内安装，与「从仓库安装」是两套独立逻辑
  - 仓库安装：读 registry.json → 下载整仓 zipball → 从 `<repo>-<sha>/<name>/` 提取（需外网 + token）
  - 面板内安装：上传单个插件包 → 解压 → 定位 plugin.json → 校验 → 落盘（**完全离线**）
  - 支持 `.zip` / `.tar.gz` / `.tgz` / `.tar`（零依赖，不支持 `.tar.xz`），上限 128MB
  - 包结构两种都认：`plugin.json` 在包根目录，或包内唯一一层子目录下
- 安全与健壮性
  - 安装目录一律取 `plugin.json` 的 `name`，**不按压缩包文件名**建目录
    （旧版系统扩展踩过：包名与清单 name 不一致 → 错位安装，既打不开也卸不掉）
  - 清单必须是 v4（name / frontend.entry / backend.exec），name 必须是安全目录名
  - zip-slip 穿越防护复用现有解压器；包内有多个 plugin.json 直接拒绝
  - 覆盖安装为**整目录替换**（不是合并），先备份再原子 rename，失败自动回滚到旧版本
  - 解压后自动给 `backend.exec` 声明的二进制补执行位（zip 常丢权限，否则 fork 会 EACCES）
  - 启动时清理安装中途崩溃留下的 `.installing-*` 残留目录
- 接口 `POST /api/store/plugin/upload`（multipart，字段 `file`），同样受插件库口令闸门保护
- 前端：插件页头部「安装插件」按钮 → 弹窗支持拖拽/选择文件、上传进度、
  成功态展示（名称/版本/文件数）与「查看已安装」跳转；空态也提供入口
- 新增探针：`tools/plugin-upload-probe.mjs`（UI 接线 18 项）、
  `tools/plugin-upload-e2e.mjs`（真实上传端到端 11 项）

## 未发布 — 插件库口令闸门
- **插件库上锁**：插件仓库（RainCough-Plugin）改为公开仓库后，插件内容仍需口令才能获取
  - 拉取市场清单 / 安装插件 / 更新插件 / 拉插件仓更新日志 → 未解锁一律 `403 + need_password`
  - 口令哈希**写死在二进制里**（`$6$` SHA-512 crypt，5000 轮 + 随机盐），仓库与产物里没有明文
  - 解锁状态用签名 cookie `rc_store_gate`（HMAC-SHA256，密钥首次启动随机生成并存 KV）
    保持 30 天，服务重启/整机重启后仍有效
  - 在线爆破防护：同 IP 连续 5 次错误 → 锁定 60 秒；每次错误固定延迟 300ms
  - 插件页「插件市场」页签显示上锁面板（口令框 + 连续错误提示），解锁后出现「重新上锁」
  - `RC_STORE_GATE=off` 可关闭闸门
- ⚠️ 能力边界：闸门只拦「知道面板地址的人随手拿插件」。**仓库一旦公开，知道 GitHub 仓库地址的人
  可以直接 clone 走全部插件**，面板侧无法阻止。要真正保护插件内容必须保持仓库私有 + token
- install.sh 无需改动（口令是编译进二进制的）

## 未发布 — 登录鉴权
- **新增登录鉴权**（此前全站无鉴权，任何能访问端口的人都能改设置、开终端、装插件）
  - 后端 `internal/auth`：session 生命周期 + 中间件 + `/api/auth/{login,logout,status}`
  - 除登录接口外，全部 `/api/*` 未登录返回 401；前端路由守卫未登录一律跳 `/login`
  - 登录页：单密码框，错误统一提示「密码错误」（不区分账号是否存在），失败固定延迟 500ms 防爆破
- **纯标准库手写 SHA-512 crypt(3)**（`internal/auth/crypt.go`，约 300 行）
  - 与 libxcrypt 逐位一致，已用 `openssl passwd -6` 与 Python `crypt` 双向对拍：
    覆盖 rounds=1000/5000/10000/50000、UTF-8 中文密码、100 字节长密码、1 字节密码、含 `$ \ *` 特殊字符
  - 支持 `$6$salt$hash` 与 `$6$rounds=N$salt$hash` 两种存储格式
- **两条登录通道**
  - ① 系统密码：读 `/etc/shadow` 当前用户的哈希离线校验 —— 真正的「用 SSH 密码登录」
  - ② 面板密码：`<data>/secret/admin.pw` 存 `$6$` 哈希（不再存明文）；未设置时首次启动随机生成 32 字符并打印到 journal
- **yescrypt(`$y$`) 说明**：Debian 12 / Ubuntu 24.04+ 默认 yescrypt，算法复杂（C 参考实现约 1500 行），
  零依赖红线内不实现。此场景由安装器引导「把面板密码设成同一个 SSH 密码」，
  用户感知一致（仍用 SSH 密码登录），实测可用
- 新增 CLI：`raincough -set-password`（从 stdin 读密码，写 `$6$` 哈希）、`-hash-password`、
  `-verify-hash <hash>`（诊断用）
- **session 持久化**：`<data>/sessions/<id>.json`（mode 0600），默认 30 天有效，
  进程重启/整机重启后仍有效（用户感知「永久保留登录状态」）；cookie `rc_session`，HttpOnly + SameSite=Strict
- 侧栏底部新增「登出」按钮
- install.sh：`User` 改为默认 `root`（读 `/etc/shadow` 需要），新增步骤 4b 登录密码引导，
  支持 `RC_PANEL_PASSWORD` / `RC_SKIP_PANEL_PASSWORD=1` / `RC_ADMIN_PASSWORD`
- 新增探针工具：`tools/auth-probe.mjs`（登录流程 11 项）、`tools/login-layout-check.mjs`（亮/暗色布局与对比度 22 项）

## v1.0.0 — 2026-10-01
- 面板功能分层成型：内置仅 工作台/文件管理/终端/系统扩展/插件/设置/开发文档 七项
- 新增「系统扩展」系统功能：扩展包格式 + 构建工具 + 安装/卸载/更新 API + 加载器
- 媒体中心、任务队列、调度器、系统中心迁为扩展包（extensions/）
- 任务队列全面修复：purge/详情方法守卫、清理边界、失败原因与进度可见
- 插件页：版本口径统一、失败提示常驻、启动/重启按在线状态、任务跟踪防假完成
- 插件页：「更新日志」入口（读插件仓 CHANGELOG.md，未配凭据时明确提示去「设置 → 仓库配置」）
- 文案校正：「进度见任务队列」改为指向「系统扩展」里的任务队列扩展（任务队列已是扩展包）
- 插件/扩展的更新判断改为语义比较（verNewer）：只有仓库版本**严格更高**才算可更新；
  本机版本更高时如实标注「本机版本较新」，不再把降级点亮成"有更新"
- 系统扩展机制：扩展包可**自带后端与接口**（`extension.json` 增 `backend{lang,exec}` 与 `interfaces[]`）——
  安装后生成并启用 `rc-ext-<name>.service`、接口库自动预建端点并接管注册；卸载停服务、删单元、摘接口。
  新增 `/api/ext/backend`（状态）与 `/api/ext/backend/restart`，系统扩展页显示后端状态、提供的接口与「重启后端」
- 修复接口库两处真 bug：`Reload()` 从不给新端点起 accept 循环（运行期新装的插件/扩展注册必超时）、
  `Drop()` 不关端点（卸载后 socket 仍 listen，可被连上注册成幽灵插件）
- 系统扩展子系统修正：安装时校验清单 name 与包名一致（错位会让扩展既打不开也卸不掉）、
  AssetPath/卸载统一按清单定位目录（历史错位安装也能打开与卸载）、启动清扫安装中断残留的
  `*.tmp`（不再被当成已装扩展）、扩展加载器取不到产物时丢弃旧注册（不挂过期代码）
- 抛弃旧「系统功能」：删除主面板库 `extensions/` 下全部扩展包（媒体中心 / 任务队列 / 调度器 / 系统中心），
  `extensions/registry.json` 置空；双机同步卸载。面板只保留内置 7 项（工作台/文件管理/终端/系统扩展/
  插件/设置/开发文档），插件不受影响；扩展机制（ExtStore + 系统扩展页）保留，以后可再放扩展包
- 系统扩展页重做：只留「已装扩展（打开/更新/卸载）」与「可安装的扩展（来自主面板库）」两段；
  不再列内置 7 项（它们随主体安装、不可卸载，入口在侧边栏），可安装列表也不再与已装列表重复
- 扩展安装改为**主面板库优先**（与清单同源）：此前本地源优先，部署机上恰好有 extension-src，
  于是"列表显示仓库版本、装进来的却是本地那份"；主面板库不可用时才回退本地源
- 界面：去掉页面上的静态提示文字（系统扩展「随面板主体安装, 不可卸载。」、插件仓更新日志的
  说明与版本规则提示、仓库配置的「保存后回插件市场刷新」提示、文件管理「操作参数」后的参数清单），
  只保留加载中/空态/错误/进度这类动态反馈
- 界面：内置功能页（插件/系统扩展/文件管理/设置）去掉内容区上方的页头标题行，
  内容区直接开始（计数在各页卡片与筛选里都有）
- 面板更新：GitHub Release 资产 + 手动三步（检查 → 下载并应用 → 由你确认是否立即重启）
- 面板更新界面：侧边栏标题右侧下载按钮的悬浮窗只留 当前/最新版本 + 更新日志 + 检查更新，
  检测到新版本时自动弹确认窗（更新内容 + 确认更新），更新完成后在同一窗里确认重启
- 下载源回退：直连 github.com 不通或过慢时自动走只读镜像（RC_GH_MIRROR 可覆盖或关闭）
- 版本基线：面板/扩展/插件全部 1.0.0
- 资产重发：2026-10-01 重发一次 v1.0.0 资产（tag 移到修正提交，版本号不变）
- 修复系统扩展后端的**"假重启"**：单元启动原用 `systemctl enable --now`，对已在运行的单元是空操作 ——
  更新扩展（换掉 server.py / 前端产物）后旧进程会继续跑旧代码，「重启后端」按钮同样是空操作。
  改为 `enable` + `restart`（未运行=启动、已运行=真正换上新代码）
- 新增系统扩展「**驱动**」（自带后端 + 8 个接口，装在目标机上按需安装）：
  - 只读体检 `drivers.gpu`：NVIDIA 卡型号/架构/算力、驱动来源（run/deb/none）、输出接口与链路、GSP、
    是否矿卡（P1XX / CMP 系列）、匹配到的补丁条目、版本偏好、容器直通状态
  - 补丁清单 `drivers.repo`：来源阶梯 本地目录 → GitHub raw → 三个 gh-proxy 镜像；**GPG 强制验签**
    （临时 keyring + pin 指纹，签名损坏/指纹不符即拒绝使用该来源）；`drivers.repo.config` 可配分支/镜像/
    本地目录/令牌/签名开关与指纹（令牌只写不读）
  - 两阶段安装 `drivers.install`：precheck 出计划（不发任何命令）→ apply 起异步任务；
    官方 `.run` **多路 Range 并发下载（断点续传 + 单段重试）** → sha256 → `sh --check` → `--extract-only` →
    声明式补丁（命中数校验 + 结果 sha256 校验 + 原子写入 + `.orig-*` 备份）→ 移除冲突的发行版 nvidia 包 →
    `nvidia-installer --silent --dkms` → 写托管 `rc-drivers.conf`（nouveau 黑名单，CMP 另加关 GSP）→
    `depmod` + `update-initramfs` → `nvidia-smi` 校验 → 标需重启（不自动重启）
  - 任务与回滚：`drivers.task`（进度/命令流/补丁报告）、`drivers.cancel`、`drivers.log`（审计 NDJSON）、
    `drivers.revert` 三条退路（官方卸载 / 回 Debian 包 / 回补丁前）
  - 容器直通：`drivers.install{kind:"container-toolkit"}` 一键装 NVIDIA 容器工具包
    （官方源 + `signed-by` keyring，均 `rc-` 前缀可精确回滚；有 docker 时自动配 runtime 并重启）
  - 补丁数据放主面板库 `drivers/`（`registry.json` + `patches/*.patch.json` + `pubkey.asc` + `.asc` 签名），
    KB 级、不占仓库容量；已支持 P104-100 / P106-100（580.178.04）与 CMP 30HX（615.71.09），
    补丁输出与上游 patcher 脚本**逐字节一致（4/4 比对通过）**
- 安装程序新增「固定静态 IP」：安装时读默认路由网卡的当前地址/网关/上游 DNS，原样写成静态配置
  （自动识别 NetworkManager / netplan / ifupdown，只动这块网卡；netplan 下会停用旧定义并禁止 cloud-init
  重建网卡配置；ifupdown 下会注释主文件里原有的 `inet dhcp` 段）
  - 改前备份到 `/root/raincough-net-backup-<时间戳>/` 并打印回滚命令；**只写配置不立即重启网络**
    （下次重启生效，安装会话不会被踢掉）；写完先 `netplan generate` 校验，**失败自动回滚**（含把报错存进备份）
  - 已是静态的自动跳过（`RC_NET_FORCE=1` 可强写）；开关 `RC_NET_STATIC=yes|no|dry`、`RC_NET_DRYRUN=1`、`RC_ONLY_NET=1`
  - 实测（Ubuntu 22.04 测试机，netplan+DHCP）：写入后重启，`ip route` 变为
    `default via 192.168.122.1 dev ens3 proto static`（不再是 dhcp），SSH/面板正常；
    故意塞入语法错误的 netplan 文件时，`generate` 报错 → 自动回滚 → 我们的文件删除、原定义恢复
- 安装程序健壮性（用户报告「安装时出现乱码导致无法继续」）：
  - 无控制终端（网页终端 / `ssh` 不带 `-t` / 自动化）时读 `/dev/tty` 失败 → 第一步被当成 no 而取消；
    现在探测终端能力，**无交互终端时所有提问取默认值继续**，并把默认值打印出来（`(no tty) … -> default: x`）
  - 第一步改为回车即开始（不再要求显式 yes）；交互提示以 ASCII 开头（中文随后），非 UTF-8 终端不再满屏乱码；
    输入加超时（`RC_PROMPT_TIMEOUT` 默认 120s），避免可读但无人输入的终端把安装挂死；
    `fail()` 追加 ASCII 说明与可直接复制的重跑命令
  - 重装路径修复：`systemctl enable --now` 对运行中的单元是空操作（新单元不生效、journal 报
    `Current command vanished`）→ 改 `enable` + `restart`；端口检查不再把"本面板自己占用的端口"当冲突
    （按 MainPID/exe 识别，注意 `ss -ltnp` 非 root 看不到别人 PID）；非交互模式下端口冲突自动改用空闲端口
    （或 `RC_PORT=`），不再死循环；步骤 7 验证改为最多 5×2s 重试
- 安装程序：安装参数改为固定，不再逐项提问（用户反馈"目录应该锁死、用户应取当前用户、端口应自填"）
  - **安装目录锁死 `/opt/raincough`**（不再提问；仅测试可用 `RC_APP_DIR` 覆盖）
  - **运行用户 = 当前调用安装脚本的用户**（`SUDO_USER` 优先，否则登录用户；不再提问），
    单元写入 `User=`/`Group=`，并把安装目录 `chown` 给该用户
  - **端口自动挑选**：从 3900 起取第一个空闲端口（被本面板自己占用则沿用原端口，重装不会换端口），
    不再提问；可用 `RC_PORT` 指定
  - 向导只剩三项询问（是否开始 / 是否装 p7zip+ffmpeg / 是否固定静态 IP）
  - 提示：服务以普通用户运行时，需要 root 的功能（系统扩展安装/更新、面板自更新重启）使用**面板设置里的
    sudo 密码**执行 `sudo -S`；不填则这些功能会失败（要免配置就以 root 运行）
  - 实测（Ubuntu 22.04 测试机）：重装时沿用 3900 且 `User=ubuntu`/属主 ubuntu/进程以 ubuntu 运行/面板 200；
    3900 被别的进程占用时**自动改用 3901**；释放后又回到 3900
- 新增卸载器 `uninstall.sh`（`…/main/uninstall.sh`）：停用并删除面板单元与 `rc-ext-*.service`、
  删程序文件、清理 `/run/raincough`；**默认保留** `data/`、`plugins/`、插件单元与静态 IP 配置；
  可选 `--purge`（连数据一起删）、`--with-plugins`、`--unset-static-ip`（从
  `/root/raincough-net-backup-*` 还原）、`--dry-run`、`--yes`。已实测：dry-run 不改动 → 卸载清空
  （单元/目录/端口/运行时全清，数据保留）→ 重装后 data/ 与 plugins/ 仍在、面板 200