package shared

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

func isNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

// ns 前缀: 表名统一 ns_<name>_kv 等。
func (s *Shared) kvTable(ns string) string { return "ns_" + ns + "_kv" }

// ensureKVTable 按需建 KV 表(幂等)。
func (s *Shared) ensureKVTable(ns string) error {
	tbl := s.kvTable(ns)
	ctx, cancel := s.ctx()
	defer cancel()
	var err error
	if s.sqlite {
		_, err = s.db.ExecContext(ctx, fmt.Sprintf(
			"CREATE TABLE IF NOT EXISTS %s ("+
				" key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)", tbl))
	} else {
		_, err = s.db.ExecContext(ctx, fmt.Sprintf(
			"CREATE TABLE IF NOT EXISTS %s ("+
				" `key` VARCHAR(255) PRIMARY KEY, `value` TEXT NOT NULL, "+
				" `updated_at` BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", tbl))
	}
	return err
}

// kvGet 读取单键(JSON 反序列化)。
func (s *Shared) kvGet(ns, key string) (interface{}, bool, error) {
	if err := s.ensureKVTable(ns); err != nil {
		return nil, false, err
	}
	tbl := s.kvTable(ns)
	ctx, cancel := s.ctx()
	defer cancel()
	var raw string
	err := s.db.QueryRowContext(ctx, fmt.Sprintf(
		"SELECT value FROM %s WHERE key = ?", tbl), key).Scan(&raw)
	if err != nil {
		if isNoRows(err) {
			return nil, false, nil
		}
		return nil, false, err
	}
	var v interface{}
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return raw, true, nil // 非 JSON 文本原样返回
	}
	return v, true, nil
}

// kvSet 写入单键(JSON 序列化)。
func (s *Shared) kvSet(ns, key string, value interface{}) error {
	if err := s.ensureKVTable(ns); err != nil {
		return err
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	tbl := s.kvTable(ns)
	now := time.Now().Unix()
	ctx, cancel := s.ctx()
	defer cancel()
	if s.sqlite {
		_, err = s.db.ExecContext(ctx, fmt.Sprintf(
			"INSERT INTO %s (key, value, updated_at) VALUES (?, ?, ?) "+
				"ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
			tbl), key, string(raw), now)
		return err
	}
	_, err = s.db.ExecContext(ctx, fmt.Sprintf(
		"INSERT INTO %s (`key`,`value`,`updated_at`) VALUES (?, ?, ?) "+
			"ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), `updated_at`=VALUES(`updated_at`)",
		tbl), key, string(raw), now)
	return err
}

// kvDelete 删除单键。
func (s *Shared) kvDelete(ns, key string) error {
	if err := s.ensureKVTable(ns); err != nil {
		return err
	}
	ctx, cancel := s.ctx()
	defer cancel()
	_, err := s.db.ExecContext(ctx,
		fmt.Sprintf("DELETE FROM %s WHERE key = ?", s.kvTable(ns)), key)
	return err
}

// kvList 按前缀列出键值。
func (s *Shared) kvList(ns, prefix string, limit int) (map[string]interface{}, error) {
	if err := s.ensureKVTable(ns); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	ctx, cancel := s.ctx()
	defer cancel()
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf(
		"SELECT key, value FROM %s WHERE key LIKE ? ORDER BY key LIMIT ?",
		s.kvTable(ns)), prefix+"%", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]interface{}{}
	for rows.Next() {
		var k, raw string
		if err := rows.Scan(&k, &raw); err != nil {
			return nil, err
		}
		var v interface{}
		if err := json.Unmarshal([]byte(raw), &v); err != nil {
			out[k] = raw
		} else {
			out[k] = v
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// SQLite 模式下 rows.Err 已检查; mysql 下需要更多行读取, 直接返回
	return out, nil
}

// nsExec 受限 SQL: 仅允许操作本 namespace 的表(ns_<name>_*)。
func (s *Shared) nsExec(ns, query string, args ...interface{}) ([]map[string]interface{}, int64, error) {
	// 提取首个表名白名单
	matches := tableRE.FindAllString(query, -1)
	allowed := false
	for _, m := range matches {
		if m == s.kvTable(ns) || (len(m) > len("ns_"+ns+"_") &&
			m[:len("ns_"+ns+"_")] == "ns_"+ns+"_") {
			allowed = true
			break
		}
	}
	if !allowed {
		return nil, 0, fmt.Errorf("仅允许访问本插件 namespace 的表(ns_%s_*): %q", ns, query)
	}
	trim := strings.TrimSpace(strings.ToUpper(query))
	isSelect := strings.HasPrefix(trim, "SELECT")
	ctx, cancel := s.ctx()
	defer cancel()
	if isSelect {
		rows, err := s.db.QueryContext(ctx, query, args...)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		cols, _ := rows.Columns()
		out := []map[string]interface{}{}
		for rows.Next() {
			vals := make([]interface{}, len(cols))
			ptrs := make([]interface{}, len(cols))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				return nil, 0, err
			}
			row := map[string]interface{}{}
			for i, c := range cols {
				row[c] = vals[i]
			}
			out = append(out, row)
		}
		return out, int64(len(out)), rows.Err()
	}
	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	n, _ := res.RowsAffected()
	return nil, n, nil
}
