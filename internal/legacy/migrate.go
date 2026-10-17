package legacy

// rc.db → data/kv 迁移
//
// 旧版面板(SQLite)的存储模型与新 v6(KV 日志)是**一一对应**的:
//
//	SQLite 表 ns_<namespace>_kv (key TEXT PK, value TEXT, updated_at INTEGER)
//	v6    文件 <dir>/<namespace>.log, 每行 {"k":key,"v":<json>,"t":updated_at}
//
// 所以迁移本质是"把每张表的每行搬成一行日志", 不需要理解业务语义。
//
// 但**不能无脑全搬** —— 有些命名空间是运行时缓存, 搬过去会制造幽灵数据:
//
//	迁移     core_terminal  用户保存的 SSH 主机 / 常用命令(真正的用户数据)
//	迁移     core_store     GitHub token 的 AES 密钥(搬过去旧 token 仍可解密)
//	迁移     core_tasks     历史任务记录(任务队列里能看到)
//	迁移     <插件名>        各插件自己的设置/收藏/历史 —— 17 插件用户最在意的部分
//	跳过     core_registry  插件注册缓存: 启动时由插件重新注册, 且会按清单存在性过滤;
//	                        搬过去只是 201 行死数据
//	跳过     core_backup / core_envpkg / core_media / core_scheduler
//	                        这些功能在 v6 已整体移除, 搬过去没有任何代码会读
//
// 冲突策略: **已有键一律不覆盖**(新面板跑过一次后的数据优先), 只在报告里计数。

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	// 明确要迁移的 core 命名空间(其余 core_* 按跳过处理, 见上方说明)
	// 白名单比黑名单安全: 将来新增 core_xxx 时默认不搬, 避免再次引入幽灵数据
	legacyMarkerFile = ".legacy-migration.json"
)

// coreKeep 允许迁移的 core 命名空间及其迁移理由(用于报告)
var coreKeep = map[string]string{
	"core_terminal": "SSH 主机与常用命令",
	"core_store":    "仓库配置与 token 加密密钥",
	"core_tasks":    "历史任务记录",
}

// pluginKeep 允许迁移的插件命名空间(白名单)。
//
// ★ 用户决定(2026-10-17): 旧面板的 17 个插件只保留 JMComic, 其余全部抛弃。
// 抛弃的原因不是"技术不可行", 而是产品决策 —— 那些插件(vpn/webspy/mcserver/docker/…)
// 在 v6 下没有对应实现, 搬数据只会留下永远读不到的死记录。
//
// 新增插件要迁移时, 把它加到这里; 不在表里的插件命名空间一律跳过。
var pluginKeep = map[string]string{
	"jmcomic": "JMComic(唯一保留的旧插件)",
}

// coreSkip core 命名空间的跳过理由
var coreSkip = map[string]string{
	"core_registry":   "插件注册缓存, 启动时由插件重新注册",
	"core_backup":     "备份功能已在 v6 移除",
	"core_envpkg":     "环境包功能已在 v6 移除",
	"core_media":      "媒体中心已在 v6 移除",
	"core_scheduler":  "调度器已在 v6 移除",
	"core_supervisor": "v6 新增, 旧库没有",
}

// pluginDropReason 非保留插件的跳过理由(统一文案, 报告里一眼能懂)
const pluginDropReason = "旧插件未在 v6 保留(仅保留 JMComic), 数据不再迁移"

// NSOption 单个命名空间的迁移结果
type NSOption struct {
	Namespace       string `json:"namespace"`
	Table           string `json:"table"`
	Action          string `json:"action"` // migrated | would-migrate | skipped
	Reason          string `json:"reason,omitempty"`
	Rows            int    `json:"rows"`
	Written         int    `json:"written"`
	SkippedExisting int    `json:"skipped_existing"`
	InvalidJSON     int    `json:"invalid_json"`
	Bytes           int64  `json:"bytes"`
}

// Report 迁移报告
type Report struct {
	Src          string     `json:"src"`
	Dst          string     `json:"dst"`
	DryRun       bool       `json:"dry_run"`
	Tables       []NSOption `json:"tables"`
	TotalRows    int        `json:"total_rows"`
	TotalWritten int        `json:"total_written"`
	WALWarning   string     `json:"wal_warning,omitempty"`
	DurationMS   int64      `json:"duration_ms"`
}

// Migrated 是否有实际写入
func (r *Report) Migrated() bool { return r.TotalWritten > 0 }

// MigrateOptions 迁移参数
type MigrateOptions struct {
	Src    string // 旧 rc.db 路径
	DstDir string // 目标 data/kv 目录
	DryRun bool   // 只报告, 不落盘
	// Force 覆盖已存在的键(默认 false: 已有键跳过)
	Force bool
	// ForceNamespaces 显式指定要迁移的命名空间(含原本会跳过的), 用于特殊情况
	ForceNamespaces []string
}

// Migrate 执行迁移。
//
// 前置条件: **面板必须处于停止状态**。KV 层在内存里维护索引并持有日志文件句柄,
// 运行期往同一个 .log 追加行会被内存索引忽略, 下次压缩还会把它们覆盖掉。
func Migrate(opts MigrateOptions) (*Report, error) {
	start := time.Now()
	if opts.Src == "" || opts.DstDir == "" {
		return nil, errors.New("Src 与 DstDir 必填")
	}
	if _, err := os.Stat(opts.Src); err != nil {
		return nil, fmt.Errorf("旧数据库不存在: %w", err)
	}
	if err := os.MkdirAll(opts.DstDir, 0o750); err != nil {
		return nil, fmt.Errorf("创建目标目录失败: %w", err)
	}

	db, err := OpenDB(opts.Src)
	if err != nil {
		return nil, fmt.Errorf("打开旧数据库失败: %w", err)
	}
	defer db.Close()

	tables, err := db.Tables()
	if err != nil {
		return nil, fmt.Errorf("读取表清单失败: %w", err)
	}

	rep := &Report{Src: opts.Src, Dst: opts.DstDir, DryRun: opts.DryRun}
	if w := db.WALWarning(); w != nil {
		rep.WALWarning = w.Error()
	}

	force := map[string]bool{}
	for _, n := range opts.ForceNamespaces {
		force[strings.ToLower(strings.TrimSpace(n))] = true
	}

	// 按表名排序, 报告稳定
	names := make([]string, 0, len(tables))
	for n := range tables {
		names = append(names, n)
	}
	sort.Strings(names)

	for _, table := range names {
		ns, ok := nsFromTable(table)
		if !ok {
			continue // 不是 KV 表(旧库可能有别的表)
		}
		opt := NSOption{Namespace: ns, Table: table}

		// 决定搬不搬
		if reason, skip := skipReason(ns); skip && !force[ns] {
			opt.Action = "skipped"
			opt.Reason = reason
			rows, _ := db.TableRows(tables[table])
			opt.Rows = len(rows)
			rep.Tables = append(rep.Tables, opt)
			rep.TotalRows += opt.Rows
			continue
		}

		rows, err := db.TableRows(tables[table])
		if err != nil {
			return nil, fmt.Errorf("读取表 %s 失败: %w", table, err)
		}
		opt.Rows = len(rows)

		written, skipped, invalid, bytes, err := writeNamespaceLog(rows, opts.DstDir, ns, opts.DryRun, opts.Force)
		if err != nil {
			return nil, fmt.Errorf("写入 namespace %s 失败: %w", ns, err)
		}
		opt.Written = written
		opt.SkippedExisting = skipped
		opt.InvalidJSON = invalid
		opt.Bytes = bytes
		if opts.DryRun {
			opt.Action = "would-migrate"
		} else {
			opt.Action = "migrated"
		}
		if ns != "" {
			if r, ok := coreKeep[ns]; ok {
				opt.Reason = r
			} else if r, ok := pluginKeep[ns]; ok {
				opt.Reason = r
			}
		}

		rep.Tables = append(rep.Tables, opt)
		rep.TotalRows += opt.Rows
		rep.TotalWritten += written
	}

	rep.DurationMS = time.Since(start).Milliseconds()

	// 落一个标记, 便于"装过一次就不再自动搬"与事后排查
	if !opts.DryRun && rep.TotalWritten > 0 {
		_ = writeMarker(opts.DstDir, rep)
	}
	return rep, nil
}

// nsFromTable `ns_xxx_kv` → `xxx`; 不符合命名约定的表返回 false 并忽略
func nsFromTable(table string) (string, bool) {
	t := strings.ToLower(strings.TrimSpace(table))
	if !strings.HasPrefix(t, "ns_") || !strings.HasSuffix(t, "_kv") {
		return "", false
	}
	ns := strings.TrimSuffix(strings.TrimPrefix(t, "ns_"), "_kv")
	if ns == "" || !validNS(ns) {
		return "", false
	}
	return ns, true
}

// validNS 与 shared.ValidateNS 同规则(a-z0-9_, 1-32)
func validNS(ns string) bool {
	if len(ns) == 0 || len(ns) > 32 {
		return false
	}
	for _, c := range ns {
		if (c < 'a' || c > 'z') && (c < '0' || c > '9') && c != '_' {
			return false
		}
	}
	return true
}

// skipReason 判断某命名空间是否应跳过
func skipReason(ns string) (string, bool) {
	if r, ok := coreKeep[ns]; ok {
		_ = r
		return "", false // core 白名单: 迁移
	}
	if strings.HasPrefix(ns, "core_") {
		if r, ok := coreSkip[ns]; ok {
			return r, true
		}
		return "未知的 core 命名空间(v6 无对应模块)", true
	}
	// 非 core_ = 插件命名空间
	if r, ok := pluginKeep[ns]; ok {
		_ = r
		return "", false // 插件白名单: 迁移
	}
	return pluginDropReason, true
}

// writeNamespaceLog 把行写进 <dst>/<ns>.log, 返回(写入数, 已存在跳过数, 非法JSON数, 字节数)
func writeNamespaceLog(rows []Row, dstDir, ns string, dryRun, force bool) (int, int, int, int64, error) {
	path := filepath.Join(dstDir, ns+".log")

	// 先读已有键(不覆盖)
	existing := map[string]bool{}
	if _, err := os.Stat(path); err == nil {
		f, err := os.Open(path)
		if err != nil {
			return 0, 0, 0, 0, err
		}
		sc := bufio.NewScanner(f)
		sc.Buffer(make([]byte, 0, 64*1024), 16*1024*1024) // overflow 类大值可能有几 MB
		for sc.Scan() {
			line := sc.Bytes()
			if len(line) == 0 {
				continue
			}
			var rec struct {
				K string `json:"k"`
				X bool   `json:"x"`
			}
			if json.Unmarshal(line, &rec) == nil && rec.K != "" && !rec.X {
				existing[rec.K] = true
			}
		}
		f.Close()
		if err := sc.Err(); err != nil && !errors.Is(err, os.ErrClosed) {
			return 0, 0, 0, 0, err
		}
	}

	var buf strings.Builder
	written, skipped, invalid := 0, 0, 0
	var bytes int64
	for _, r := range rows {
		if len(r.Cols) < 2 {
			continue
		}
		key := r.Cols[0].AsString()
		if key == "" {
			continue
		}
		if existing[key] && !force {
			skipped++
			continue
		}
		rawVal := r.Cols[1].AsString()
		// value 列本来存的就是 JSON 文本; 若不是合法 JSON, 当作纯字符串存
		var v string
		if json.Valid([]byte(rawVal)) && rawVal != "" {
			v = rawVal
		} else {
			b, _ := json.Marshal(rawVal)
			v = string(b)
			invalid++
		}
		var ts int64
		if len(r.Cols) >= 3 {
			if n, ok := r.Cols[2].AsInt(); ok {
				ts = n
			}
		}
		if ts == 0 {
			ts = time.Now().Unix()
		}
		keyJSON, err := json.Marshal(key)
		if err != nil {
			continue
		}
		// ★ 手工拼行, 不用 json.Marshal(struct{V json.RawMessage}):
		//   Go 会对 RawMessage 做"压缩"(去掉空白), 迁移应原样搬运 value 的字节
		line := `{"k":` + string(keyJSON) + `,"v":` + v + `,"t":` + strconv.FormatInt(ts, 10) + `}`
		buf.WriteString(line)
		buf.WriteByte('\n')
		written++
		bytes += int64(len(line)) + 1
		existing[key] = true
	}

	if dryRun || written == 0 {
		return written, skipped, invalid, bytes, nil
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	if _, err := f.WriteString(buf.String()); err != nil {
		f.Close()
		return 0, 0, 0, 0, err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return 0, 0, 0, 0, err
	}
	return written, skipped, invalid, bytes, f.Close()
}

func writeMarker(dstDir string, rep *Report) error {
	b, err := json.MarshalIndent(struct {
		MigratedAt time.Time  `json:"migrated_at"`
		Src        string     `json:"src"`
		Written    int        `json:"written"`
		Tables     []NSOption `json:"tables"`
	}{time.Now(), rep.Src, rep.TotalWritten, rep.Tables}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dstDir, legacyMarkerFile), b, 0o640)
}

// HasMigrated 目标目录是否已经有迁移标记(install.sh 用来避免重复搬)
func HasMigrated(dstDir string) bool {
	_, err := os.Stat(filepath.Join(dstDir, legacyMarkerFile))
	return err == nil
}
