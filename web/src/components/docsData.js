// 内置开发文档数据(v4 接口库时代, 与仓库 docs/ 对齐)
// 渲染: PluginDocs.vue; 导出: exportMd()
export const DOC = [
  {
    label: "架构总览",
    title: "架构总览",
    items: [
      { t: "h", x: "现状" },
      { t: "p", x: "RainCough Core = Go 主系统 + Vue3 前端 + 接口库(pluginx) + 17 个 v4 插件。里程碑 M0–M5 已全部完成：插件无端口自注册、拆 v3 完成、系统功能接口化。宿主 192.168.2.200:3900。" },
      { t: "h", x: "进程模型" },
      { t: "ul", x: [
        "主系统: Go 单二进制, 监听 :3900(HTTP+静态前端), 内置 internal/pluginx 注册中心/接口路由/健康探针",
        "插件: 各自独立 systemd 单元 plugin-<name>.service(User=f, Restart=always), 无任何 TCP 端口",
        "通信: 生产 UDS /run/raincough/plugins/<name>.sock; 开发机 Windows 用 RC_PLUGIN_TRANSPORT=tcp 降级",
        "每插件 = plugins/<name>/server_v4.py(Python, import server.py 复用 v3 逻辑) + rcplugin.py(SDK)"
      ]},
      { t: "h", x: "三套契约" },
      { t: "ul", x: [
        "plugin.json v4: 清单(frontend/backend/interfaces) — 见「插件开发」",
        "RPC(JSON-RPC 2.0, 行分隔): register/heartbeat/unregister/ping/invoke/log.tail",
        "前端 ctx: ctx.invoke(iface, params, {timeoutMs}) 是唯一业务入口"
      ]},
      { t: "h", x: "健康与自愈" },
      { t: "ul", x: [
        "在线 = 注册 + 心跳(30s); 主系统 ping 探针测延迟, 超 deadline 标 offline",
        "服务健康中心(注册表驱动)是唯一健康视图; 展开行看接口与日志(/api/services/health/log)",
        "自愈: systemd Restart=always + SDK 指数重连(1s→30s), 主系统重启后插件自动重连重注册"
      ]},
      { t: "h", x: "数据层" },
      { t: "ul", x: [
        "单 sqlite(data/rc.db), shared.Namespace 提供 KV 表(ns_<ns>_kv)",
        "core_registry 持久化注册表; 各插件/系统模块各自 namespace",
        "默认 DSN sqlite:///rc.db(相对 DataDir → data/rc.db)"
      ]}
    ]
  },
  {
    label: "接口库",
    title: "接口库(pluginx)",
    items: [
      { t: "h", x: "是什么" },
      { t: "p", x: "主系统内置的服务总线：插件安装/启动时注册接口，接口可被主系统 UI 与任意插件调用。" },
      { t: "h", x: "生命周期" },
      { t: "ul", x: [
        "安装: 校验 plugin.json → 前端产物入主系统 → 接口登记 core_registry(registered)",
        "启动: 后端连接(UDS) → register(声明实现接口) → 心跳(30s) → online",
        "离线: 探针失败/超 lease → offline(调用返回 43xx)",
        "卸载: 注销接口 + 删前端产物(提示停后端)"
      ]},
      { t: "h", x: "RPC 方法" },
      { t: "ul", x: [
        "register / heartbeat / unregister: 插件→主系统",
        "ping: 健康探针; invoke: 执行业务; log.tail: 诊断日志(可选)"
      ]},
      { t: "h", x: "错误码(实测)" },
      { t: "ul", x: [
        "-32601 插件请求超时(主系统默认 15s, 可传 timeout_ms)",
        "-32603 内部错误; 3000 业务错误(rc.RCError(3000, msg))",
        "4001 接口未注册 / 4101 参数校验 / 4201 无权限 / 4301 目标离线 / 4401 版本不匹配"
      ]},
      { t: "h", x: "可见性" },
      { t: "ul", x: [
        "all: 主系统 UI + 任意插件",
        "main: 仅主系统 UI(管理类接口默认)",
        "private: 仅本插件"
      ]}
    ]
  },
  {
    label: "插件开发",
    title: "插件开发(全流程)",
    items: [
      { t: "h", x: "骨架" },
      { t: "pre", x: "python tools/migrate-plugin-v4.py plugins/<name> -o v4-out/<name>\n# 输出 plugin.json + server_v4.py 占位 + rcplugin.py + systemd + MIGRATE.md" },
      { t: "h", x: "清单 plugin.json v4" },
      { t: "pre", x: "{\n  \"name\": \"uptime\", \"label\": \"Uptime\", \"version\": \"2.0.0\",\n  \"description\": \"...\",\n  \"frontend\": {\"entry\": \"assets/plugin.js\", \"vue\": \"3.5\",\n                 \"pages\": [{\"path\": \"\", \"title\": \"概览\"}]},\n  \"backend\": {\"lang\": \"python\", \"exec\": [\"python\", \"server_v4.py\"],\n               \"capabilities\": [\"invoke\", \"heartbeat\", \"log.tail\"]},\n  \"interfaces\": [\n    {\"id\": \"uptime.targets.list\", \"visibility\": \"all\", \"version\": \"1\", \"description\": \"列表\"}\n  ]\n}\n# 校验: python interface/tools/validate_manifest.py plugins/<name>/plugin.json\n# name 正则 ^[a-zA-Z0-9_-]{1,32}$(允许大写如 JMComic)" },
      { t: "h", x: "后端接口" },
      { t: "pre", x: "import os, sys\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\nimport rcplugin as rc\nimport server as M            # 复用 v3 业务(可无)\n\n@rc.interface(\"uptime.targets.list\")\ndef list_targets(params):\n    return {\"targets\": [...]}\n\n@rc.interface(\"uptime.targets.create\")\ndef create_target(params):\n    if not (params or {}).get(\"url\"):\n        raise rc.RCError(3000, \"url 必填\")\n    ...\n\nif __name__ == \"__main__\":\n    rc.serve(endpoint=os.environ.get(\"RC_ENDPOINT\", \"\"), name=\"uptime\",\n             version=\"2.0.0\", manifest={\"label\": \"Uptime\"},\n             frontend={\"pages\": [{\"path\": \"\", \"title\": \"概览\"}]},\n             iface_ids=[\"uptime.targets.list\", ...],\n             plugin_dir=os.path.dirname(os.path.abspath(__file__)))" },
      { t: "h", x: "关键点" },
      { t: "ul", x: [
        "SDK: 读 .rc.endpoint → 连接 → register/heartbeat 自动 → 后台读循环 + 每请求 worker(防嵌套 rc.call 死锁)",
        "跨插件: rc.call(\"other.iface.id\", params)",
        "文件输入: 前端上传统一 base64 data URL → 插件解码",
        "产物下载: 插件写 work/, 主系统经 /api/plugins/<name>/work/<session>/<file> 代发"
      ]}
    ]
  },
  {
    label: "前端页面",
    title: "前端页面(Vue3, 存主系统)",
    items: [
      { t: "h", x: "frontend/plugin.js 契约" },
      { t: "pre", x: "import { createApp, h } from 'vue'\nconst NAME = 'uptime'\n\nfunction mount(container, ctx) {\n  const App = {\n    data() { return { list: [] } },\n    async mounted() {\n      this.list = (await ctx.invoke('uptime.targets.list'))?.targets || []\n    },\n    render() {\n      return h('div', null, [\n        h('div', { class: 'section-title' }, 'Uptime'),\n        this.list.map((t) => h('div', null, t.name)),\n      ])\n    },\n  }\n  const vm = createApp(App); vm.mount(container)\n  return () => vm.unmount()          // 卸载清理\n}\n\nexport function register(g) {\n  g.__rcPluginV4__ = g.__rcPluginV4__ || {}\n  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '概览' }], mount }\n}\nif (typeof window !== 'undefined') register(window)" },
      { t: "h", x: "ctx 提供" },
      { t: "ul", x: [
        "invoke(iface, params, {timeoutMs}): 调后端/其他插件接口",
        "on(event, cb) / emit(event, payload): 事件",
        "toast(msg, kind) / navigate(to)",
        "plugin: { name }"
      ]},
      { t: "h", x: "构建产物" },
      { t: "pre", x: "node tools/build-plugin-frontend.js <name>   # esbuild 内联 vue → assets/plugin.js" },
      { t: "h", x: "注意" },
      { t: "ul", x: [
        "只允许 ctx.invoke 调后端; 禁止直连(插件无端口)",
        "null 属性加 v-if 兜底",
        "setInterval 记得 unmounted 清理"
      ]}
    ]
  },
  {
    label: "系统接口",
    title: "系统功能接口(system.*, 70 个)",
    items: [
      { t: "h", x: "入口与调用" },
      { t: "p", x: "「接口总览」source=system 列出全部; 试调用 POST /api/interfaces/<id>/invoke 带 {params}。" },
      { t: "h", x: "分组" },
      { t: "ul", x: [
        "基础(10): ping/info/disks/file.list/file.read/media.stats/tasks.list/envpkg.envs/store.registry/health.services",
        "fm.*: mkdir/delete/rename/save/search/size/ops.start|list|cancel",
        "term.*: sessions/open/send/close/resize/hosts|commands",
        "media.*: roots.get|save/list/dedup/tool",
        "tasks.*: detail/purge; sched.*: list/get/create/update/delete/runnow",
        "envpkg.*: catalog/run/install/uninstall/task; store.*: settings/ping/install/remove",
        "sys.*: services/processes/firewall/users/sshkeys/cron/clean.scan/pwr.state/kernels/time.status/health/events/logrotate/boot/perf/net"
      ]},
      { t: "h", x: "可见性" },
      { t: "p", x: "只读=all; 管理(写/启停/安装/删除)=main(仅主系统 UI)。" },
      { t: "h", x: "已知边界" },
      { t: "ul", x: [
        "system.sys.cron.get 普通用户读 /var/spool/cron/crontabs/* 受限(需 sudo 或 user=f 空)",
        "system.sys.sshkeys.get 需指定 user(f 可读, root 无权限)",
        "危险能力(关机/重启/apt upgrade/卸载根/快照创建/清理执行)未以接口暴露, 保持安全边界"
      ]}
    ]
  },
  {
    label: "部署运维",
    title: "部署与运维",
    items: [
      { t: "h", x: "插件 systemd 单元" },
      { t: "pre", x: "[Unit]\nDescription=RainCough Plugin <name> (v4, portless)\nAfter=network.target raincough.service\nWants=raincough.service\n\n[Service]\nType=simple\nUser=f\nWorkingDirectory=/home/f/raincough-dev/plugins/<name>\nExecStart=/usr/bin/python3 server_v4.py\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n# sudo systemctl enable --now plugin-<name>.service" },
      { t: "h", x: "上传部署" },
      { t: "ul", x: [
        "逐文件上传: plugin.json server_v4.py rcplugin.py frontend/plugin.js assets/plugin.js",
        "宿主无 fresh web 源, 前端必须本地构建后上传",
        "改后端: sudo systemctl restart plugin-<name>.service"
      ]},
      { t: "h", x: "验收清单(每插件)" },
      { t: "ol", x: [
        "systemctl is-active plugin-<name>.service = active",
        "服务健康中心 online; 接口总览出现全部接口且试调用成功",
        "/api/plugins/<name>/assets/plugin.js → 200; /plugin/<name> 可渲染并 ctx.invoke",
        "自愈: kill 进程 → 短暂离线 → 自动拉起恢复"
      ]},
      { t: "h", x: "全量验证(部署后)" },
      { t: "pre", x: "curl -s :3900/api/services/health => 18 providers, offline 无\ncurl -s :3900/api/interfaces?source=system  => 70\n客户端的 bundle 中死端点(/api/plugins/aigen/ping 等)计数 = 0" }
    ]
  },
  {
    label: "FAQ",
    title: "常见问题",
    items: [
      { t: "h", x: "为什么插件没有端口？" },
      { t: "p", x: "v4 采用 Unix Domain Socket(生产)/TCP 仅限开发机降级。插件 = 独立 systemd 进程, 靠注册+心跳接入总线, 无需监听端口、无独立网页。" },
      { t: "h", x: "主系统重启会怎样？" },
      { t: "p", x: "插件检测连接断开后指数重连(1s→30s), 主系统恢复后自动重注册回归 online; systemd Restart=always 兜底插件崩溃。" },
      { t: "h", x: "invoke 报 -32601 超时？" },
      { t: "p", x: "主系统单次 invoke 默认 15s。长任务应在插件内用线程+任务队列异步, 或前端 invoke 传 {timeoutMs}。若首调用需加载模型(如 ocrqr), 可在启动时预热。" },
      { t: "h", x: "新增插件名大小写？" },
      { t: "p", x: "plugin.json name 允许大小写(兼容 JMComic)。前端 PluginView 会大小写不敏感查找注册表。" },
      { t: "h", x: "文件/产物如何提供给前端？" },
      { t: "p", x: "插件写 cache/(图) output/(AI 图) work/(压缩/分片产物), 主系统经 /api/plugins/<name>/<sub>/<file> 代发, 支持下载/预览。" }
    ]
  }
]
