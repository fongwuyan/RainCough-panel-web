//go:build unix

package pluginrt

import "os"

// IsRoot 面板进程是否以 root 运行。
//
// 只判一次、写进报告, 由前端决定 fix=root 的项能不能点 ——
// 不在执行时反复猜, 也不尝试 sudo 提权(面板以什么身份跑就该按那个身份给出建议)。
func IsRoot() bool { return os.Geteuid() == 0 }
