// Package shared 共用数据层: 主系统与插件之间唯一的数据通道。
//
// 设计:
//   - 每个插件一个 namespace(ns), 物理隔离: 表前缀 ns_<name>_。
//   - Namespace 提供 KV(JSON 序列化)与受限 SQL(仅本 ns 的表)。
//   - 后端: MariaDB(mysql)/ SQLite(降级), 由 DSN 决定。
//   - 插件侧经 RAINCOUGH_DB_DSN + RAINCOUGH_NS 环境变量接入。
package shared

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql" // mysql 驱动
	_ "modernc.org/sqlite"            // sqlite 驱动(纯 Go)
)

var (
	nsRE    = regexp.MustCompile(`^[a-z0-9_]{1,32}$`)
	tableRE = regexp.MustCompile(`\bns_[a-z0-9_]{1,32}_[a-z0-9_]{1,64}\b`)
)

// ValidateNS 校验 namespace 合法性。
func ValidateNS(ns string) bool {
	return nsRE.MatchString(ns)
}

// Shared 全局数据层入口。
type Shared struct {
	db     *sql.DB
	sqlite bool
}

// Open 按 DSN 打开数据层。支持 mysql:// 与 sqlite:///。
func Open(dsn string) (*Shared, error) {
	var driver, src string
	sqlite := false
	switch {
	case strings.HasPrefix(dsn, "mysql://"):
		driver = "mysql"
		src = mysqlSource(dsn)
	case strings.HasPrefix(dsn, "sqlite:///"):
		driver = "sqlite"
		src = dsn[len("sqlite:///"):]
		sqlite = true
	default:
		return nil, fmt.Errorf("不支持的 DSN: %s (支持 mysql:// 或 sqlite:///)", dsn)
	}
	db, err := sql.Open(driver, src)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("数据层连接失败: %w", err)
	}
	return &Shared{db: db, sqlite: sqlite}, nil
}

// mysqlSource mysql://user:pass@host:port/dbname -> go-sql-driver DSN
func mysqlSource(dsn string) string {
	rest := strings.TrimPrefix(dsn, "mysql://")
	user := "root"
	pass := ""
	host := "127.0.0.1"
	port := "3306"
	dbname := "raincough"
	if at := strings.LastIndex(rest, "@"); at >= 0 {
		cred := rest[:at]
		hp := rest[at+1:]
		if c := strings.SplitN(cred, ":", 2); len(c) == 2 {
			user, pass = c[0], c[1]
		} else {
			user = cred
		}
		rest = hp
	}
	if i := strings.Index(rest, "/"); i >= 0 {
		dbname = rest[i+1:]
		hp := rest[:i]
		if colon := strings.LastIndex(hp, ":"); colon >= 0 {
			host, port = hp[:colon], hp[colon+1:]
		} else {
			host = hp
		}
	} else {
		if colon := strings.LastIndex(rest, ":"); colon >= 0 {
			host, port = rest[:colon], rest[colon+1:]
		} else {
			host = rest
		}
	}
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&timeout=5s",
		user, pass, host, port, dbname)
}

// Namespace 返回指定 namespace 的访问句柄。
func (s *Shared) Namespace(ns string) (*Namespace, error) {
	ns = strings.ToLower(strings.TrimSpace(ns))
	if !ValidateNS(ns) {
		return nil, fmt.Errorf("非法 namespace: %q (仅 a-z0-9_ 1-32 字符)", ns)
	}
	return &Namespace{sd: s, ns: ns}, nil
}

// Close 关闭连接池。
func (s *Shared) Close() error {
	return s.db.Close()
}
