# 叶酱游戏（yegames）v1.1

RainCough 面板 v6 的 v4 插件：**多源真实挖掘叶酱汉化作品 → 卡片库 → 内置下载器**。

- 插件名 `yegames`，后端 Python（仅标准库），前端 Vue（构建产物内联）
- 页面：侧栏「插件 → 叶酱游戏」

## v1.1 的六件事

| 需求 | 实现 |
|---|---|
| 内置下载器 | `yegames.dl.start` 起后台线程流式下载到 `download_dir/<作品>/<文件>`，支持 **Range 断点续传**、并发上限、取消、实时字节/速度/ETA |
| 取直链弹悬浮窗 | 卡片点「直链 / 下载」→ 居中悬浮窗：密码、目录入口、备用镜像、逐文件「下载 / 复制直链」、任务进度条都在窗里；不再在页面顶部堆信息 |
| 挖掘实时进度 | 挖掘跑在后台线程，前端 700ms 轮询 `yegames.mine.status`：阶段名、已完成/总数、百分比、**逐条明细日志**（每个源、每个桶、每页核实都上报），可取消 |
| 其他操作也走悬浮窗 | 绑定目录、设置、下载任务列表都是悬浮窗；点遮罩或「关闭」收起 |
| 卡片库持久化 + 增量更新 | `library.json` 保存卡片；重新挖掘走 upsert：新卡 `new`、字段变化 `updated`（并记录变更字段）、未变 `active`、本轮没出现 `stale`（**保留不删**，界面可筛） |
| 多源 + 解压密码 | 源：83youxi、sncyyx、zfsya（WordPress REST）+ mgamehub（ZBlog HTML 搜索，逐页核实标题与正文）。每个源带自己的解压密码，卡片与下载窗都显示 |

## 数据来源与真实挖掘

1. **83youxi** `https://www.83youxi.com/wp-json/wp/v2/posts?search=叶酱` — 密码 `gacg`
2. **sncyyx** `https://www.sncyyx.com/wp-json/wp/v2/posts?search=叶酱` — 密码 `www.facg.ru`
3. **宅方社 zfsya** `https://www.zfsya.moe/wp-json/wp/v2/posts?search=叶酱` — 密码见资源页
4. **mgamehub** `https://www.mgamehub.com/search.php?q=叶酱` — ZBlog 只有 HTML 搜索：先收链接，再逐页取 `<title>`/og:title 与正文，**正文里没有「叶酱」的直接丢弃**（上限 `verify_zblog_pages`，默认 15 页）

合并：按作品名归一化去重（`uid = sha1(规范化名)[:16]`），同一部作品的多来源合并到 `sources_detail`，标签取并集。

镜像：公开 AList（`h.suyunm.com` / `m.mydizhi.com`），`fs/list` 建目录索引（缓存 12h），`fs/get` 取 4 小时签名直链；`ALIASES` 表覆盖已人工核对的 40 部，支持同作品多版本按版本号选目录。

## 接口（15 个）

| 接口 | 可见性 | 说明 |
|---|---|---|
| `yegames.info` | all | 版本、源清单、下载目录 |
| `yegames.config.get/save` | all / main | 配置（源开关、关键词、密码、下载目录、并发、TTL） |
| `yegames.library.list` | all | 卡片库 + 计数（all/new/updated/stale/linked） |
| `yegames.mine.start` | main | 后台开始挖掘（立即返回） |
| `yegames.mine.status` | all | 实时进度快照（phase/done/total/percent/log/stats） |
| `yegames.mine.cancel` | main | 取消挖掘 |
| `yegames.item.links` | all | 直链 + 目录入口 + 密码 + 下载目录 |
| `yegames.item.bind` | main | 手动绑定镜像目录（写入 bindings.json） |
| `yegames.folder.list` | main | 试探任意镜像目录 |
| `yegames.index.stats` | all | 索引条目/新鲜度 |
| `yegames.dl.start/status/list/cancel` | main/all/all/main | 内置下载器 |

另外声明了三条 REST 路由：`GET /library`、`GET /links`、`GET /progress`（手机端可用）。

## 实测（本机）

```
mine: 4 源 → 78 张卡片（83youxi 43 / sncyyx 7 / zfsya 23 / mgamehub 5）
      可直链 42 张，78 张都带解压密码；索引复用 4193 个目录；两轮 7–8s
增量: 第二轮 → new 0 / updated 1（人为改版本）/ active 77
过期: 关掉 zfsya 再挖 → stale 23，卡片保留
下载: 533MB 包 → 3s 收到 1.3MB（0.5MB/s）→ 取消，part 1.57MB 保留
      → 重启任务 resumed_from=1572864，续传后 9MB/s，ETA 60s；取消生效
```

## 配置项

```jsonc
{
  "alist_host": "h.suyunm.com",
  "download_dir": "<插件目录>/downloads",
  "max_parallel_dl": 2,
  "index_ttl_min": 720,
  "verify_zblog_pages": 15,
  "show_cover": true,
  "sources": [
    {"id":"83youxi","kind":"wp","base":"https://www.83youxi.com","search":"叶酱","password":"gacg","enabled":true},
    {"id":"sncyyx","kind":"wp","base":"https://www.sncyyx.com","search":"叶酱","password":"www.facg.ru","enabled":true},
    {"id":"zfsya","kind":"wp","base":"https://www.zfsya.moe","search":"叶酱","password":"见资源页","enabled":true},
    {"id":"mgamehub","kind":"zblog","base":"https://www.mgamehub.com","search":"叶酱","password":"见资源页","enabled":true}
  ]
}
```

设置界面可以逐源开关、改关键词（改成别的作者名就能挖别人）、改密码。

## 构建与自测

```bash
node tools/build-plugin-frontend.js yegames     # → assets/plugin.js（186 KB，vue=prod）
python -m py_compile server_v4.py
python -u _minetest.py    # 两轮挖掘 + 卡片状态 + 源统计
python -u _dltest.py      # 签名直链下载 + 取消 + 断点续传
```

## 已知限制

- 目录名是拼音/罗马字，中文标题无法可靠反推：新作品默认「未对上镜像」，可手动绑定；`ALIASES` 可继续扩充。
- mgamehub 每页要抓正文，源多时耗时随 `verify_zblog_pages` 线性增长（15 页约 1.5s）。
- 封面来自第三方图床，可能慢/失效，可在设置里关。
- 签名直链 4 小时过期；过期后重开一次「直链」窗口即可重签。下载器识别到镜像返回 JSON（过期）会直接报错而不是存成垃圾文件。

## 合规

只抓各源公开搜索页与公开镜像的文件元数据；不破解、不绕过付费墙、不代理分发内容。下载与使用请遵守所在地法律与原作品授权。
