# RainCough 开发文档

> 面板主系统仓库 `RainCough-Core`(Go + Vue3), 宿主 `192.168.2.200`, 端口 3900, 服务 `raincough.service`。
> 当前里程碑: **M0–M5 全部完成** — 17/17 插件 v4 化、拆 v3 完成、系统功能接口化(70 个 `system.*`)、前端全功能页补齐。

## 文档导航

| 文档 | 内容 |
|---|---|
| [架构总览](架构总览.md) | 系统组成、进程模型、目录结构、数据流 |
| [插件开发指南](插件开发指南.md) | 新插件全流程: 骨架/plugin.json/SDK/前端/构建/systemd/验证 |
| [插件接口库-v4设计](插件接口库-v4设计.md) | 接口库协议/传输/RPC/错误码/可见性(已实现) |
| [系统功能接口](系统功能接口.md) | 70 个 `system.*` 内置接口清单与调用方式 |
| [插件v4迁移指南](插件v4迁移指南.md) | 17 插件迁移记录 + 剩余迁移方法(已全部完成) |
| [前端开发指南](前端开发指南.md) | web/ 前端结构、系统页、PluginView v4、构建 |
| [部署档案-防错手册](部署档案-防错手册.md) | 宿主部署流程、备份、验证清单、Git 要点 |
| [插件转化规划(历史)](插件转化规划.md) | v3→v4 转化原始规划(已完结归档) |

## 常用命令(本地开发机)

```bash
# Go 后端
go build ./... && go vet ./...
go test ./... -skip 'TestChildStartAndProxy|TestEnvManagerInstallFlow'

# 前端(输出到 ../public, 即 Go 静态目录)
cd web && node node_modules/vite/bin/vite.js build

# 插件前端(把 plugins/<name>/frontend/plugin.js 打成自包含 assets/plugin.js)
node tools/build-plugin-frontend.js <name>      # 支持多参数, 全部: $(ls -d plugins/*/ | ...)

# 插件清单校验
python interface/tools/validate_manifest.py plugins/<name>/plugin.json
```

## 现状速览(实测 2026-09)

- 服务健康: 18 提供方(system + 17 插件)全部在线
- 接口总览: ~250+ 接口(system 70 + 插件 ~180)
- 前端 bundle: ~347KB(拆 v3 后无内置插件组件)
- 数据库: `data/rc.db`(单一 sqlite, 14 张 KV 表, `core_registry` 196 行)