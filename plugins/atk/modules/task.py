#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""任务: 导出与统计。

导出给人看用 markdown, 给机器读用 json —— 两者字段一致, 只是呈现不同。
"""
import json
import time

from core import store

LEVEL_ORDER = {"高危": 0, "中危": 1, "低危": 2}


def stats(task_id):
    assets = store.asset_list(task_id)
    risks = store.risk_list(task_id)
    by_kind = {}
    for a in assets:
        by_kind[a["kind"]] = by_kind.get(a["kind"], 0) + 1
    by_level = {"高危": 0, "中危": 0, "低危": 0}
    for r in risks:
        by_level[r["level"]] = by_level.get(r["level"], 0) + 1
    return {
        "assets": len(assets), "by_kind": by_kind,
        "risks": len(risks), "by_level": by_level,
        "pending": sum(1 for r in risks if r["status"] == "待确认"),
        "confirmed": sum(1 for r in risks if r["status"] == "已确认"),
        "dropped": sum(1 for r in risks if r["status"] == "误报"),
        "artifacts": len(store.artifact_list(task_id)),
    }


def export(task_id, fmt="md"):
    t = store.task_get(task_id)
    if not t:
        raise ValueError("任务不存在")
    assets = store.asset_list(task_id)
    risks = store.risk_list(task_id)
    arts = store.artifact_list(task_id)
    st = stats(task_id)

    if fmt == "json":
        data = {
            "task": {"id": t["id"], "name": t["name"], "target": t["target"],
                     "created_at": t["created_at"], "updated_at": t["updated_at"]},
            "stats": st,
            "assets": assets,
            "risks": risks,
            "artifacts": [{"id": a["id"], "filename": a["filename"], "kind": a["kind"]} for a in arts],
            "exported_at": int(time.time()),
        }
        return {"format": "json", "filename": "%s.json" % _safe(t["name"]),
                "content": json.dumps(data, ensure_ascii=False, indent=2)}

    lines = []
    lines.append("# %s" % t["name"])
    lines.append("")
    lines.append("- 目标: `%s`" % (t["target"] or "—"))
    lines.append("- 创建: %s" % _ts(t["created_at"]))
    lines.append("- 导出: %s" % _ts(int(time.time())))
    lines.append("")
    lines.append("## 概览")
    lines.append("")
    lines.append("| 项 | 数量 |")
    lines.append("|---|---|")
    lines.append("| 资产 | %d |" % st["assets"])
    for k, v in sorted(st["by_kind"].items()):
        lines.append("| · %s | %d |" % (k, v))
    lines.append("| 风险 | %d (高危 %d / 中危 %d / 低危 %d) |" % (
        st["risks"], st["by_level"].get("高危", 0),
        st["by_level"].get("中危", 0), st["by_level"].get("低危", 0)))
    lines.append("| 提取物 | %d |" % st["artifacts"])
    lines.append("")

    if risks:
        lines.append("## 风险")
        lines.append("")
        lines.append("| 等级 | 类型 | 目标 | 证据 | 状态 |")
        lines.append("|---|---|---|---|---|")
        for r in risks:
            lines.append("| %s | %s | `%s` | %s | %s |" % (
                r["level"], r["kind"], r["target"], _md(r["evidence"]), r["status"]))
        lines.append("")
        confirmed = [r for r in risks if r["status"] == "已确认"]
        if confirmed:
            lines.append("### 已确认项复现说明")
            lines.append("")
            for r in confirmed:
                lines.append("**%s · %s**" % (r["kind"], r["target"]))
                lines.append("")
                lines.append("```")
                lines.append(r["evidence"])
                lines.append("```")
                if r.get("detail"):
                    lines.append("")
                    lines.append(r["detail"])
                lines.append("")

    if assets:
        lines.append("## 资产")
        lines.append("")
        lines.append("| 地址 | 端口 | 类型 | 技术栈 | 来源 |")
        lines.append("|---|---|---|---|---|")
        for a in assets:
            lines.append("| `%s` | %s | %s | %s | %s |" % (
                a["addr"], a["port"] or "—", a["kind"], _md(a["stack"]), a["source"]))
        lines.append("")

    if arts:
        lines.append("## 提取物")
        lines.append("")
        for a in arts:
            lines.append("- `%s` — %s" % (a["filename"], a["kind"]))
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("由 RainCough atk 插件导出。风险结论仅代表本次自动化核查结果, 需人工复核。")
    return {"format": "md", "filename": "%s.md" % _safe(t["name"]), "content": "\n".join(lines)}


def _md(s):
    return str(s or "").replace("|", "\\|").replace("\n", " ")[:160]


def _safe(name):
    import re
    return re.sub(r"[^\w\u4e00-\u9fa5\-]", "_", name or "task")[:60]


def _ts(v):
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(int(v)))
    except Exception:
        return str(v)
