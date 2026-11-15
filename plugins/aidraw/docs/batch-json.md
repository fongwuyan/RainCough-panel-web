# AI 绘图 · JSON 批量格式

适用于 AI 绘图插件「JSON 批量」页。

## 1. 基本结构

推荐使用对象形式：

```json
{
  "defaults": {},
  "items": []
}
```

也支持直接传数组：

```json
[
  { "prompt": "..." },
  { "prompt": "..." }
]
```

`defaults` 是默认参数，`items` 中每一条会覆盖同名字段。

## 2. 字段说明

### defaults

可选，对象。可包含以下任意字段：

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `prompt` | string | 空 | 默认提示词 |
| `negative_prompt` | string | 空 | 负面提示词 |
| `width` | integer | 界面宽 | 宽，任意正整数 |
| `height` | integer | 界面高 | 高，任意正整数 |
| `steps` | integer | 界面步数 | 步数，建议 1–60 |
| `scale` | number | 界面 CFG | CFG，建议 5–10 |
| `seed` | integer | `-1` | `-1` 表示随机 |
| `n` | integer | 界面数量 | 每条生成张数，建议 1–4 |
| `model` | string | 界面模型 | 模型 ID |
| `strength` | number | 界面强度 | 仅图生图，0.05–0.95 |

### items

必填，非空数组。每一项是一个生图任务。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `prompt` | string | 是 | 提示词 |
| `negative_prompt` | string | 否 | 负面提示词 |
| `width` | integer | 否 | 覆盖默认宽 |
| `height` | integer | 否 | 覆盖默认高 |
| `steps` | integer | 否 | 覆盖默认步数 |
| `scale` | number | 否 | 覆盖默认 CFG |
| `seed` | integer | 否 | 覆盖默认 seed |
| `n` | integer | 否 | 覆盖默认数量 |
| `model` | string | 否 | 覆盖默认模型 |
| `strength` | number | 否 | 图生图重绘强度 |
| `image` | string | 否 | 单条底图 data URL；一般不用，批量页会统一使用界面上传的底图 |

## 3. 文生图批量示例

不选择批量底图时，批量任务走文生图。

```json
{
  "defaults": {
    "negative_prompt": "lowres, bad anatomy, bad hands",
    "width": 768,
    "height": 1024,
    "steps": 20,
    "scale": 7,
    "n": 1,
    "model": "sd15-dreamshaper-8"
  },
  "items": [
    { "prompt": "1girl, white dress, garden, soft light", "seed": 1001 },
    { "prompt": "1girl, night city, neon lights", "seed": 1002 },
    { "prompt": "1girl, winter, snow, warm coat", "seed": 1003 }
  ]
}
```

## 4. 图生图批量示例

在「JSON 批量」页先上传一张批量底图，再导入 JSON。

所有条目共用这张底图；每条只写提示词和参数。

```json
{
  "defaults": {
    "negative_prompt": "lowres, bad anatomy, bad hands",
    "width": 768,
    "height": 1024,
    "steps": 24,
    "scale": 7,
    "strength": 0.55,
    "n": 1,
    "model": "sd15-dreamshaper-8"
  },
  "items": [
    { "prompt": "same character, white dress, garden", "seed": 2001 },
    { "prompt": "same character, night city, neon", "seed": 2002 },
    { "prompt": "same character, winter, snow", "seed": 2003 }
  ]
}
```

## 5. 单条覆盖示例

```json
{
  "defaults": {
    "width": 512,
    "height": 768,
    "steps": 20,
    "strength": 0.5
  },
  "items": [
    {
      "prompt": "wide landscape, lake, sunrise",
      "width": 1024,
      "height": 576,
      "seed": 42
    },
    {
      "prompt": "portrait, soft light",
      "width": 640,
      "height": 960,
      "steps": 28,
      "strength": 0.65
    }
  ]
}
```

## 6. 执行规则

- 批量按 `items` 顺序执行
- 单条失败后继续执行下一条
- 批量总进度按条目数计算
- 结果逐张写入服务端历史画廊
- 中途取消会停止后续队列
- 未选择批量底图时：文生图
- 选择了批量底图时：图生图，所有条目共用该底图

## 7. 尺寸规则

`width` / `height` 允许任意正整数。

图生图时：

- 节点会按 JSON / 界面传入的宽高重采样底图
- 不传时使用界面宽高
- 界面宽高默认取自上传底图的原始尺寸

## 8. 底层任务 JSON

单条任务实际提交给面板 `/api/node-jobs` 的格式：

### 文生图

```json
{
  "node_id": "node_xxx",
  "kind": "image",
  "payload": {
    "prompt": "1girl, white dress",
    "negative_prompt": "lowres",
    "width": 768,
    "height": 1024,
    "steps": 20,
    "scale": 7,
    "seed": -1,
    "n": 1,
    "model": "sd15-dreamshaper-8"
  }
}
```

### 图生图

```json
{
  "node_id": "node_xxx",
  "kind": "image",
  "payload": {
    "mode": "img2img",
    "image": "data:image/png;base64,...",
    "prompt": "same character, white dress",
    "negative_prompt": "lowres",
    "width": 768,
    "height": 1024,
    "steps": 20,
    "scale": 7,
    "seed": 1001,
    "n": 1,
    "strength": 0.55,
    "model": "sd15-dreamshaper-8"
  }
}
```

## 9. 注意

- 批量 JSON 里的 `image` 字段是高级用法；普通批量请用页面上传的一张底图
- 图生图节点目前没有逐步进度上报，界面显示“图生图处理中”
- 原图 URL 依赖节点任务；历史画廊的缩略图已服务端持久化，但节点任务被清理后原图可能失效
- 数量 `n` 对图生图可能只返回一张，取决于节点引擎
