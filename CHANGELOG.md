# 更新日志（面板）

本项目遵循：**版本号只在明确确认后递增**，任何代码改动默认不动版本号。
每个版本一个 git tag（`vX.Y.Z`），并发布同名 Release，资产为 `raincough-linux-x86_64-<版本>.tar.gz`。
每个版本有独立安装命令（见 README / releases.json）。

## Unreleased — 插件环境准备（P1/P2/P3）+ 内置功能审计 + 市场免口令 + 登录方式可切换
### 市场安装接入环境预检与阶段时间轴（P3）

- **安装流程改成「先预检后落盘」**：zipball 先解到暂存目录 → 校验清单 →
  环境预检 → 才写入 pluginsDir。端口被别人占这类**硬冲突**直接中止安装，
  不再留下一个装了却用不了的插件
- **阶段枚举**：`download / extract / validate / precheck / write / env / start / verify`
  八个阶段写进任务的 `phase`，前端浮窗时间轴按同样的 key 逐段点亮
- **装完自动启动 + 开机自启**：插件"装上却不跑"是最常见的困惑来源；
  没有自启的话面板一重启它又静默停掉。市场与上传两条链路统一
- **任务返回真实 id**：之前返回的是字面量 `"queued"`，前端只能靠名字猜
  哪个任务是自己的，一次装两个插件就会串
- **环境报告挂进任务 meta**：装完一次拿全，前端不用再单独查一次接口
- **市场列表显示前置条件**：要占哪些端口、哪些能面板代劳、哪些只能手动 ——
  装之前就说清楚，而不是装完才发现少东西
- `gen_registry.py` 去掉"插件=独立 systemd 单元, 无端口"的旧假设，
  改为把清单里的 environment 压成摘要写进 registry.json

### 插件环境准备：装完能一键补齐环境（P1 + P2）

P0 只能"看"环境差什么；P1 把报告接进安装流程，P2 让面板能真的把它补齐。

- **上传安装的响应里带 `env`**：装完不再只说一句"安装成功"，而是
  "已更新 X v1.2.3(3 个文件), **还需 1 步环境准备**"，前端浮窗直接吃这份报告
- **新增执行器** `internal/pluginrt/envapply.go` + `POST /api/plugins/{name}/environment/apply`
  - **前端只传步骤 id，绝不传命令原文** —— 传原文等于让任何登录用户
    在面板上执行任意 shell。命令永远来自插件清单，确认页把它原样摊开
  - `level=check` 的清单拒绝执行；`needs=root` 的步骤在非 root 面板上直接拒绝
    （不 sudo、不降级）
  - 必须 `confirm:true`；步骤失败即停；可用 `check` 字段做幂等（点第二次不会重装）
- **新增安装浮窗**（`InstallDock.vue` / `InstallTimeline.vue` / `ConfirmSheet.vue`）
  - 胶囊 ↔ 浮窗两态，挂根组件 → **切路由不消失**
  - 时间轴把未到达的阶段**置灰但显示**，用户不用盯百分比猜还有几步
  - 确认遮罩里命令**不折叠不省略**，横向滚动不折行（折行会让人读错命令）
  - 窄屏变底部抽屉；同时装多个包胶囊显示数量
- **报告新增 `apply[]` 步骤清单与每项的 `apply_steps`**：前端不用猜"哪个步骤修哪一项"

**实施中修掉两个真问题：**

1. **"读不到"被当成"缺失"** —— 非 root 面板读不到 root 的私有文件时，
   检查会永远报"缺东西"，把真正缺的那项盖掉。
   现在有**退出码约定**：`1`=确定缺失、`2`=无法确定(unknown)、`3`=状态可疑(degraded)。
   `2`/`3` 不计入 pending。
2. **只探"NapCat 在跑"没探"QQ 登录了"** —— 程序活着 WebUI 就返回 200，
   但 QQ 掉线时机器人其实不回话，报告却显示正常。
   改看 OneBot 端口（**QQ 登录后才监听**）才算真判据。

### 登录方式：可关闭系统（SSH）密码，并可在设置页改面板密码

起因：面板同时接受「系统密码（`/etc/shadow`）」和「面板密码」两条通道，
但没有任何开关 —— 想只用面板密码做不到；而面板密码忘了只能上服务器跑 CLI。

- **新增登录策略** `GET/POST /api/auth/login-policy`（需登录，不在鉴权白名单里）
  - 关闭后 `Verify()` 真的跳过 shadow 那条分支，不是只在界面上藏起来
  - 状态落盘 `<data>/secret/login.json`（0600），重启保持；文件损坏时**回退到允许**，
    宁可多开一条通道也不能把自己锁在外面
- **设置页新增「登录」分区**：开关 + 三条只读状态（系统密码通道 / 系统用户名 / 面板密码）
  - 系统密码不可用时开关置灰，并显示真实原因（见下）
  - 开关失败会重新拉一次服务端状态，不让开关停在用户点的位置
- **新增 `POST /api/auth/password`**：设置页直接改面板密码（≥8 位）
  - 当前会话保留，其它设备下线 —— 否则改完自己就被踢出去，等于没法改
  - 同时把它暴露到 UI，是因为关掉系统密码后**这就是唯一入口**，
    不让人只能去服务器上跑 `raincough -set-password`

**实测发现：这台机器的系统密码通道从来没生效过。**

| 实例 | 运行身份 | 结果 |
|---|---|---|
| prod 3900 | root | `shadow 使用 yescrypt($y$), 无法离线验证` —— Debian 12 默认 yescrypt，代码只支持 SHA-512(`$6$`) |
| dev 3910 | f | `无法读取 /etc/shadow(需 root 或 shadow 组)` |

也就是说两台都一直在走面板密码。开关配上之后这个事实第一次在界面上说得清。
yescrypt 支持要另做（libxcrypt 的 KDF），没在本次范围。

### 内置功能审计（2026-11-01）

起因：`docs/功能清单.md` 第 101 行早就点出「前端 api 方法 ↔ 后端路由无自动对拍，
历史上的空壳/死按钮全部出在这里」，但一直没有守卫。这次逐项查了一遍并修掉。

- **插件启停完全没有 UI**（最严重）：supervisor 的 start/stop/restart/autostart 四个能力、
  三个接口都在，前端一次都没调过。后果是插件崩了只能重启整个面板；新装插件默认不开自启，
  面板重启后它静默停着（当天 QQBot 实测踩到）
  - `api.serviceAction` 的签名还是 v3 的 `(unit, action)` + 下发 `{unit, action}`，
    按 v4 契约会被解析成空名 → 400。改成 `(name, action)`
  - 新增 `serviceAutostart` / `serviceLog` 两个方法
  - 「插件」页每行新增「管理」面板：启动 / 停止 / 重启、开机自启开关、运行日志
    替换掉原来与「打开」完全重复的「设置」按钮
- **插件运行日志没有入口**：supervisor 一直写 `.runtime.log`，`/api/services/log` 也在，
  但没有任何页面能看。现在「管理」面板里可以看最近 200 行并刷新
- **侧栏版本号是硬编码字符串**（`v1.0.0-beta.2`）：升版本要改四处，漏一处就显示旧号。
  改为从 `GET /api/panel/version` 读
- **删除死代码 `handleStoreProject`**（22 行）：从未在 mux 里注册过，注释却写着
  "归 404 而不是返回假数据"，让人以为它还活着
- **删除 8 个死配置字段**：`RC_DB_POOL_SIZE` / `RC_DB_QUERY_TIMEOUT` /
  `RC_PLUGIN_HOST_PORT` / `RC_PLUGIN_TIMEOUT` / `RC_PLUGIN_MAX` / `RC_PLUGIN_KEEPALIVE` /
  `RC_PLUGIN_PROXY_TIMEOUT` / `RC_SUDO_PW` —— 全是 v3 遗留，设了不生效。
  尤其 `RC_SUDO_PW` 读一个 sudo 密码却从未使用，"看起来存着 root 密码的死字段"比没有更危险
- **新增契约守卫** `tools/check-api-contract.mjs`，接进 `npm run check`：
  - 组件调 `api.X` 但 api.js 没有 X → 直接失败（PanelUpdate 白屏那类）
  - api.js 的路径在后端找不到路由 → 直接失败（点了 404 那类）
  - 扫描范围含 `cmd/` 与 `internal/`（auth 三个路由注册在 internal/auth，只扫 cmd 会误报）
- **设置页「密钥」区块**改为按 `gateEnabled` 渲染：闸门默认关闭后，那里原本是个输了也没用的死输入框
- **删除 14 个无调用的前端 API 方法**（ifaces/ifaceDetail/ifaceInvoke/diskUnmount/netStatus/
  fmDelete/fmRead/fmOpsDownload/tmHostSort/storeChangelog/panelInstallCommand/
  panelUpdateLog/servicesHealthLog 等）。删除过程中契约检查抓到 `ifacesSummary`
  仍被工作台使用，已恢复 —— 正好证明守卫有用

### 修掉一个会把人绕晕的 CLI 目录 bug

`config.Load()` 的 `BaseDir` 是 `mustAbs(".")` —— **当前目录**。服务由 systemd 设了
`WorkingDirectory` 所以正确，但手工跑 `raincough -set-password` 时 cwd 可能是 `~` 或 `/tmp`，
密码会写到 `~/data` 或 `/tmp/data`，面板启动时根本不读它 —— 表现为「我明明改了密码，怎么还是旧的」。

新增 `dataDirForCLI()`：`RC_DATA_DIR` → `cwd/data` 已存在 → 退回**可执行文件所在目录的 data**，
并把实际落点打到 stderr。实测从 `/tmp` 执行会打印
`[cli] 当前目录 /tmp 下没有 data/, 改用安装目录: /home/f/raincough-v6/data`，且 `/tmp/data` 不再被创建。

### 移动端访问密钥（新增）

- **`/<插件名>/api/...` 前缀通道不再裸奔**。这条通道为了兼容没有登录能力的
  Android App（JMReader）而绕开登录中间件，此前**任何知道面板地址的人**都能拉
  漫画库、读元数据、下整本图片
- 顺带查明：插件清单里的 `rest_public` 字段（`RESTPublicMatch`）**从未被任何生产代码调用**，
  一直是个死开关 —— "要不要对外开放"其实从不由它决定。该字段已标记废弃，
  JMComic 清单里的 `rest_public: true` 已删除
- 新增访问密钥：存 KV，首次启动自动生成（48 位 hex），
  `GET /api/panel/restkey` 查看、`POST` 重置（重置后旧密钥立刻失效）
- 携带方式：请求头 `X-RC-Key` 或 query `?key=`（图片由 Coil 直接加载，塞不进头）
- 面板「设置 → 移动端访问」可查看 / 复制 / 重置（两步确认）
- `RC_REST_KEY=off` 可临时关闭校验（排障用，等于重新开放）
- **JMReader(Android) 同步修改**：设置页新增密钥输入框；所有请求统一带 `X-RC-Key`；
  封面/图片 URL 追加 `?key=`；401 文案改为直接指向密钥填写位置

### 面板更新：不再需要手工部署二进制

- **新增本地上传更新包** `POST /api/panel/update/upload`（multipart，`.tar.gz`，上限 256MB）：
  在线更新只认 GitHub Release 资产，自己构建的版本（改了代码没发版）永远进不去，
  只能手工 scp + `systemctl restart`。现在「改代码 → 打包 → 面板里上传 → 确认重启」闭环
  - 落盘/解包/校验/备份/覆盖/回滚与在线更新**共用** `applyPanelArchive`，两条路径不会漂
  - 前端「面板更新」浮窗新增「上传面板包更新…」
- **补齐回滚入口**：`POST /api/panel/update/rollback` 一直存在却没有 UI ——
  自更新系统不给退路很危险（新版本起不来只能 ssh 手工救）。浮窗新增「回滚到上一版本」，
  两次点击确认
- **修复"待重启"永久残留**：之前只有走 `handlePanelUpdateRestart` 才会清 `pending_restart`，
  外部 `systemctl restart` / 掉电重启后会永远提示"待重启"。现在启动时比对
  `Applied` 与当前版本，一致即自动清除
- **包结构错误提示**改清楚：缺 VERSION 时直接说明期望结构
  `<顶层目录>/{raincough, VERSION, public/}`（解包会去掉第一层目录），
  而不是让人对着"缺少 VERSION"去翻源码

### 插件市场免口令

- **插件市场不再需要口令**：口令闸门改为**默认关闭**，只有显式
  `RC_STORE_GATE=on` + `RC_STORE_GATE_HASH=...` 才启用
  - 删掉二进制里写死的口令哈希 —— 写死的口令等于"所有人都拿得到密文、只有主人
    不知道明文"，忘掉就只能重编译（本次就是这么卡住的）
  - 口令哈希改由环境变量提供，`raincough -hash-password` 生成
  - 开启但没给哈希时**降级为不锁 + 日志写明原因**，不再 `Fatalf` 让面板起不来：
    悄悄启动一个以为锁着其实没锁的闸门，比直接不锁更危险
  - 删掉注释里那条从未实现的 `-store-gate-reset` 指令（全仓只有注释提到它，
    按它操作会得到"命令不存在"）
- **新增插件环境声明**：`plugin.json` 可选 `environment` 块（`level` / `check[]` / `apply[]`），
  让插件能说明自己需要什么：Python 包、系统包、外部客户端、systemd 服务、端口
- **新增只读接口** `GET /api/plugins/{name}/environment`：逐项探测并返回结构化报告
  （`ready` / `pending` / `items`），可反复调用、无副作用
- **检查项两种形态**：`run`（shell 命令，cwd=插件目录）与 `type:"port"`（结构化端口检查）。
  端口不交给作者写 shell：`ss` 输出解析、非 root 看不到别人 PID、以及
  **"升级时自己占着端口不能算冲突"**，每条都足以让手写版本出错
- **端口归属判定**：先比 `systemctl show -p MainPID`，再比本插件进程 PID，
  都对不上才算冲突（判定顺序对齐 install.sh 的 `port_holder_is_us()`）
- **旧式 `requirements` 仍只检查不安装**：翻译成 import 探测项，`fix` 标 `manual`
  ——没有对应 `apply` 步骤就不能显示成"可一键修复"，否则按钮点了没反应
- **清单非法不影响安装**：`environment` 解析失败只丢弃该块并在 `warn` 里说明，
  不阻断插件安装（环境是增强，不该把能用的插件卡死）
- **超时真的会生效**：`exec.CommandContext` 只杀 `sh`，孙进程仍持有管道会让 `Wait`
  一直等，实测 `sleep 5` + `timeout 1` 会跑满 5 秒；加 `WaitDelay` 后 1.5 秒返回
- 前端：「插件」页已安装列表新增「环境」按钮，行内展开环境报告（P0 只读，无修复按钮）
- 面板版本号不变

## v1.0.0-beta.2 — 侧栏收起与悬浮球
- **侧栏可收起**：`Sidebar.vue` 顶部加 `≡` 按钮；`App.vue` 按 `sidebarHidden` 条件渲染；
  状态存 `localStorage['rc_sidebar_hidden']`，刷新后保持；「设置」页有「显示侧栏」开关
- **新增悬浮球** `PanelBall.vue`（236 行）：侧栏收起后用它把侧栏叫回来
  - 可拖动，位置 `clamp` 在视口内并记忆；右键菜单换黑/白底色
  - 可上传自定义图标（base64 存 localStorage，>1MB 拒绝，避免撑爆存储）
  - 「设置」页有「显示悬浮球」「球归位」
- **版本号** `1.0.0-beta` → `1.0.0-beta.2`：`VERSION`、`internal/config/config.go` 的 `Version`、
  `web/package.json` 三处同步
- 新增探针 `tools/panel-ball-probe.mjs`（校验侧栏收起与悬浮球）

## v1.0.0-beta — 安装器与文档收口
- **install.sh 第 2 步要 root 密码**：输入 `yes` 后明确询问一次，用 `sudo -A` + 0600
  askpass 助手完成后续全部特权操作；密码只存内存与临时文件，退出即删，输错重试 3 次
  - 不用 `echo pw | sudo -S`：sudo 时间戳仅 15 分钟，装 java/go 容易超时后再次索密
  - 修掉一个自己引入的泄漏：重试时旧临时目录（含密码文件）无人引用会残留
  - 免交互：`RC_ROOT_PASSWORD=<密码>`；已是 root 或免密 sudo 时不询问
- **环境包修正 6 处**（此前新机器上插件跑不起来）
  - 补 `apt-get update`（全新镜像索引为空 → `Unable to locate package`）
  - 补 `python3-pip`（JMComic 的 requirements 装不上，插件启动即 ImportError）
  - 补 `DEBIAN_FRONTEND=noninteractive`（否则 apt 可能弹配置界面卡住无 tty 安装）
  - Java 改装 `default-jdk-headless`（纯 JRE 跑不了 `java Foo.java` 源码形式）
  - 每个分支装完复验；非 apt 发行版打印对应安装命令而非 `command not found`
- **版本回退**：内嵌版本尚未发 Release 时自动回退 latest 并提示，不再硬失败
- **健康检查**改查根路径 `/`（原来查 `/api/auth/status`，装旧 Release 时会误报未响应）
- 新增 `.gitattributes`：`*.sh` / `*.py` / `*.json` 固定 LF
  （`core.autocrlf=true` 下工作区变 CRLF，传上 Linux 会因 `#!/usr/bin/env bash\r` 退化成 dash）
- 文档重写：`docs/README.md` 删除过时的「现状速览」，`docs/install.md` 整篇重写

## v1.0.0-beta — 版本号体系与两条更新链路
- 版本号：面板 **1.0.0-beta**（tag `v1.0.0-beta`）、JMComic **1.00.1**
- 版本号带 beta/前导零后，暴露并修掉 4 处"只认 x.y.z"的硬编码
  - `install.sh`：内嵌版本不认 `-beta` → 被判占位符 → **静默回退查 latest Release**
  - `panelTagRe`：带 `-beta` 的 Release 被整体过滤 → 更新检查看不到自己这版
  - `verParts`：丢弃 `-beta` → `1.0.0-beta == 1.0.0` → **beta→正式版检测不到**
  - 前端两份版本比较（`version.js` 从未被引用）→ 统一到一份
- 插件更新链路修 3 个 bug
  - 更新前不停进程（覆盖目录时插件仍跑旧代码）
  - `Copy` 是合并语义 → 旧版独有文件残留；改用 `replaceDir`（整目录替换+回滚）
  - 更新接口不校验方向 → 直接 POST 会降级；现返回 409 并说明两边版本
- JMComic 版本号改为**单一来源**（读 plugin.json），修掉注册时上报硬编码 `2.0.0`
- 新增 `panel_ver_test.go`（19 用例）、`tools/version-test.mjs`（20 项）

## 未发布 — 语言兼容判断修正 + 版本比较修正
- **修「JMComic 仍提示不兼容 v6」**：前端硬编码 `lang !== 'go' → 不兼容 v6`，
  这是 v6 早期"只支持 Go 二进制"时代的判断，后端早已支持 py/php/java/node，前端没跟着改
  - 新增 `GET /api/plugins/runtime`：返回支持的语言、各解释器是否就绪、缺什么怎么装
  - 前端改为**读后端能力**判断，不再自建白名单（两侧各写一份必然脱节）
  - 语言标签改为中性显示（`python` / `php` / `java` …），只有真的不支持才标红
  - 新增"缺 XX 环境"提示：语言受支持但解释器没装时给出具体安装建议
  - `/api/store/registry` 与本地扫描都会带上 `lang`（registry 没写时从已装 plugin.json 补）
  - 兜底：runtime 接口不可用时退到一个内置列表，不会因接口失败而误禁
- **修「可更新」误报**：`hasUpdate` 只判断"版本不相等"，已装版本比市场高时也提示可更新，
  点下去等于**降级**（实测：远端 registry 1.0.0 / 本地已装 2.0.0）
  - 改为语义化版本比较，仅"市场版本 > 已装版本"才提示
  - 新增「本地版本更高」标签与「无需更新」按钮文案（悬停显示两边版本）
- 测试：`TestProbe_coversAllSupported` 守"Supported() 与 Probe() 不脱节"；
  新增探针 `tools/plugin-lang-probe.mjs`（14 项）

## 未发布 — 卸载残留修复 + JMComic 适配优化
- **修「无法移除插件」**（实测 echopi）：目录删了但注册表与 supervisor 记录没清，
  界面上插件仍在，看起来像移除失败。根因是三处都只增不删：
  - `PluginX.Reload()` 只调 `scanAndListen()`，从不摘除已消失的插件
    → `/api/plugins` 仍返回它、接口总览还留着它的接口
  - `Supervisor.Rescan()` 同理，`procs` 里的旧记录永远不删
    → `/api/services/list` 仍显示 running
  - `Store.RemovePlugin()` 直接 `os.RemoveAll`，**没先停进程**
    → 插件进程变成持有已删文件的孤儿
  - 修法：新增 `Supervisor.RemovePlugin`（停进程+删记录+清 autostart）、
    `Reload/Rescan` 增加"清单已不存在就摘除"的自愈、`Store.RemovePlugin`
    先走 `onBeforeRemove` 停进程并校验目录确实删除
  - 已有 `PluginX.Drop()` 但**生产代码从未调用过**（只有测试在用），本次接上
- **JMComic 适配**
  - `exec` 从 `["python", …]` 改为 `["python3", …]`（Debian 12 无 `python`）
  - 补回丢失的 `requirements`（jmcomic>=2.7 / requests>=2.31）
  - registry.json 版本同步 1.0.0 → 2.0.0（与 plugin.json 一致，避免市场误报"可更新"）
- **JMComic 前端优化**：构建脚本改用 `vue.esm-browser.prod.js` + 开启压缩
  - 619KB → **184.5KB（-70%）**，同时消除 "You are running a development build of Vue" 警告
  - `RC_VUE_DEV=1` 可切回 dev，`RC_NO_MINIFY=1` 可关闭压缩（排查产物时用）
- **Python 依赖启动前自检**：插件声明了 `requirements` 但环境缺包时，
  日志直接给出缺什么 + 具体 pip 命令，不再是"插件莫名一直崩"
- 新增探针 `tools/jmcomic-probe.mjs`（登录→插件页→真实搜索→封面渲染）

## 未发布 — 多语言插件运行时 + 旧库迁移
- **插件不再限于 Go 二进制**：新增 `internal/pluginrt` 运行时适配层，支持
  **Python / PHP / Java / Node / Go / Bash / 任意静态二进制**
  - 解释器解析带别名回退链：`python3 → python → python3.x`、`node → nodejs`、
    `php → php8.x`、`java → $JAVA_HOME/bin/java`
  - 缺解释器时给出**可执行的错误**（含 apt/apk 安装命令），不再是 exit=-1 的黑盒崩溃
  - 自动补环境变量：`PYTHONUNBUFFERED=1`（否则插件日志卡在缓冲区，崩溃时一片空白）、
    `PYTHONDONTWRITEBYTECODE=1`
  - `.jar` 自动补 `java -jar`；`.py/.php/.js/.sh` 按后缀推断语言
  - `CheckPythonModules`：插件声明 `requirements` 时可预先探测缺失模块
- **实测修复的两个真 bug**
  - `exec[0]` 是**绝对路径解释器**（如 `/bin/sh`）时被误当脚本，拼出 `bash /bin/sh run.sh`，
    bash 把 ELF 当脚本读 → **exit=126**。echopi 插件因此一直起不来。（已加回归测试）
  - `/api/services/autostart` 缺 `on` 字段时**静默设为 false**，现在兼容 `autostart` 键并在两者都缺时报错
  - install.sh 新增步骤 2b：自动补 `python` 别名（Debian 12 只有 python3）、按需装 php/java/node、装 Go 官方二进制
- **旧面板数据迁移** `internal/legacy`：零依赖手写 SQLite 只读解析器
  - 支持表 b-tree 多层、varint/record 全类型、**overflow 页链**（旧库有 310KB 单值）、
    **WAL 回放**（旧库 WAL 1.2MB > 主库 725KB，只读主库会丢掉最近写入）
  - 用真实 SQLite 3.53 产出的库做 golden 对拍：606 个键值逐字节一致
  - 迁移策略**白名单**：`core_terminal` / `core_store` / `core_tasks` + **仅 jmcomic** 插件；
    其余 6 个旧插件（uptime/webspy/vpn/touchgal/laizhangsetu/mcserver）与已移除功能一律跳过并说明理由
  - 不覆盖已有键（新面板数据优先）、干跑、幂等、失败不留残留；迁移标记写在 `<kv>/.legacy-migration.json`
  - CLI：`raincough -migrate-db <rc.db> [-migrate-dry-run] [-migrate-force] [-migrate-also ns1,ns2]`
- **JMComic 修复**：`jmcomic.search` 的 `return` 被插在错误位置（在搜索逻辑之前），
  导致 `items` 未定义 + 后续整段成死代码。修复后搜索返回真实结果
- 实测四种语言插件全部跑通并返回正确结果：
  python 3.11.2 / php 8.2.33 / node v18.20.4 / java 17.0.20.1

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