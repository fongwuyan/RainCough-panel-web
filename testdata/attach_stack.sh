#!/bin/bash
# 卡住时 attach 看堆栈
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 15
PID=$(pgrep -f 'raincough -port' | head -1)
echo "pid=$PID"
echo "=== 进程状态 ==="
ps -o pid,stat,etime,wchan,cmd -p $PID
echo "=== goroutine 栈(Go 原生) ==="
kill -SIGQUIT $PID 2>/dev/null; sleep 1
echo "=== SIGQUIT 后日志尾部(含 goroutine dump) ==="
tail -40 srv.log