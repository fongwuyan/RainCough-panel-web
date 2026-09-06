# RainCough 插件接口库 v4

插件与主系统之间的**唯一契约**：展示层(Vue3) / 接口层(Service Bus) / 逻辑层(后端) 三层分离。

```
interface/
├─ schema/plugin.json.v4.schema.json   # 插件清单 JSON Schema
├─ spec/backend-rpc.md                 # 后端 RPC 协议(JSON-RPC 2.0 over UDS/TCP)
├─ sdk/vue3/plugin-vue.js              # 前端共用库(definePlugin/createCtx/registerGlobal)
├─ sdk/backend-python/rcplugin.py      # Python 后端 SDK(纯 stdlib, 零依赖)
└─ tools/validate_manifest.py          # plugin.json v4 快速校验
```

## 关键规则
- 插件**不占用端口**：生产走 Unix Domain Socket（`/run/raincough/plugins/<name>.sock`），Windows 开发机允许 `RC_PLUGIN_TRANSPORT=tcp` 降级。
- 插件**没有独立网页**：Vue3 前端产物存入主系统 `public/plugins/<name>/`，仅在主系统 `/plugin/<name>` 内渲染。
- 插件**安装时注册接口**(`interfaces`)，其他插件可经接口库调用：`sdk.call("other.iface", params)`。
- 主系统只负责：接口注册/路由/权限/统计 + 健康诊断 + 界面托管。
- 后端逻辑层任意语言；SDK 唯一职责=连接+注册+心跳+接口路由+跨插件调用。

## 最小接入(任意语言后端 + Vue3 前端)
见 `plugins/demo/`：（plugin.json v4 + server.py 用 rcplugin SDK + frontend 用 plugin-vue 约定）。