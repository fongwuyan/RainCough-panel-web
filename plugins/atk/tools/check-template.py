#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查插件前端模板里的转义问题（构建前跑）。

背景：插件前端把整段模板放在 JS 模板字符串（反引号）里。
模板字符串会**先做一次转义**：写 `\n` 会变成真实换行，导致 Vue 编译
`{{ arr.join('` + 换行 + `') }}` 时报 Invalid or unexpected token，
整个插件挂不上（页面空白，只在 console.warn 里留一句）。

所以模板里的 `\n` 必须写成 `\\n`。这个脚本就是查这个。

用法: python3 tools/check-template.py
"""
import re
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), "frontend", "plugin.js")


def main():
    s = open(SRC, encoding="utf-8").read()
    i = s.find("const TPL = `")
    if i < 0:
        print("未找到 TPL 定义")
        return 1
    j = s.find("\n`", i)
    if j < 0:
        print("未找到 TPL 结束反引号")
        return 1
    tpl = s[i:j]
    bad = []
    # 模板里出现单反斜杠 + n/t/r 都算可疑（会被提前转义成控制字符）
    for m in re.finditer(r"(?<!\\)\\[ntr]", tpl):
        line = tpl[:m.start()].count("\n") + 1
        ctx = tpl[max(0, m.start() - 40):m.start() + 20].replace("\n", " ")
        bad.append((line, m.group(), ctx))
    if bad:
        print("模板里发现 %d 处单反斜杠转义（应写成 \\\\n）:" % len(bad))
        for line, esc, ctx in bad[:10]:
            print("  行 %-4d %-3s … %s" % (line, esc, ctx))
        return 1
    print("模板转义检查通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
