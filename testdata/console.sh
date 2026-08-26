#!/bin/bash
# Firefox headless 抓 console 错误: 用 dumpio 模式
cd /tmp
timeout 25 firefox --headless --jsconsole --screenshot=/tmp/shots/diag.png --window-size=1400,900 "http://127.0.0.1:3900/#/" 2>&1 | grep -iE 'error|uncaught|exception|failed|warning' | head -25