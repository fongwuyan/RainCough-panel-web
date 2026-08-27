#!/bin/bash
echo "=== JMComic .runtime.log(子进程 stdout/stderr) ==="
cat ~/raincough-dev/plugins/JMComic/.runtime.log 2>/dev/null | tail -20 || echo "(无 runtime log)"
echo "=== aigen .runtime.log(同缺进程对照) ==="
cat ~/raincough-dev/plugins/aigen/.runtime.log 2>/dev/null | tail -8 || echo "(无)"
echo "=== docker .runtime.log ==="
cat ~/raincough-dev/plugins/docker/.runtime.log 2>/dev/null | tail -8 || echo "(无)"