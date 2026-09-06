# RainCough 插件后端 RPC 协议（interface_version=1）

传输层: Unix Domain Socket（生产）/ 127.0.0.1 TCP（Windows 开发, `RC_PLUGIN_TRANSPORT=tcp`）。
消息: JSON-RPC 2.0, 每消息一行 JSON（`\n` 分隔, 无嵌套换行; 大负载 base64 编码进 params/result）。

## 通用形状

```json
{"jsonrpc":"2.0","id":1,"method":"register","params":{...}}
{"jsonrpc":"2.0","id":1,"result":{...}}
{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"...","data":null}}
```

## 方法

### register（插件→主系统, 连接后第一条）
```json
{
  "token": "",
  "name": "uptime",
  "version": "3.0.0",
  "manifest": { "label": "Uptime 监控", "description": "..." },
  "frontend": { "pages": [{"path":"","title":"概览"}] },
  "iface_ids": ["uptime.targets.list"],
  "heartbeat_sec": 30
}
→ result: {"ok":true}
```

### heartbeat（插件→主系统）
```json
{"method":"heartbeat","params":{"version":"3.0.0"}}
→ result: {"ok":true}
```

### unregister（插件→主系统, 正常退出）
```json
{"method":"unregister","params":{}}
→ result: {"ok":true}
```

### ping（主系统→插件, 健康探针）
```json
{"method":"ping","params":{}}
→ result: {"pong":true,"version":"3.0.0"}
```

### invoke（主系统→插件, 业务执行）
```json
{"method":"invoke","params":{"iface":"uptime.targets.list","params":{...}}}
→ result: <插件返回值>
```

### call（插件→主系统, 跨插件调用）
```json
{"method":"call","params":{"iface":"docker.ps","params":{},"timeoutMs":15000}}
→ result: <目标插件返回值>   // 主系统接口库路由; 未见返回错误码 40xx/42xx/43xx
```

### log.tail（主系统→插件, 可选能力）
```json
{"method":"log.tail","params":{"lines":200,"grep":""}}
→ result: {"text":"...","total_lines":123,"size":4567}
```

## 错误码
| code | 含义 |
|---|---|
| -32600~-32603 | JSON-RPC 标准错误 |
| 3000 | 插件业务错误（data 为业务详情） |
| 4001 | 接口未注册/下架 |
| 4101 | 参数校验失败 |
| 4201 | 无权限（visibility） |
| 4301 | 目标插件离线 |
| 4401 | 接口版本不匹配 |

## 插件 SDK 最小行为
1. 连接（断线指数重连 1s→30s 封顶）
2. register → 心跳循环（30s）→ 优雅 unregister
3. 接口路由表: 收到 invoke 按 `iface` 分发, 未实现返回 4001
4. 所有日志写 `.runtime.log`（主系统诊断可读）