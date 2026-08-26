package shared

import "encoding/json"

// Namespace 单个插件/模块的独立数据空间。
type Namespace struct {
	sd *Shared
	ns string
}

// Ns 返回 namespace 名。
func (n *Namespace) Ns() string { return n.ns }

// Get 读取单键; ok=false 表示键不存在。
func (n *Namespace) Get(key string) (interface{}, bool, error) {
	return n.sd.kvGet(n.ns, key)
}

// GetString 读取字符串值(不存在返回 default)。
func (n *Namespace) GetString(key, def string) (string, error) {
	v, ok, err := n.sd.kvGet(n.ns, key)
	if err != nil || !ok {
		return def, err
	}
	if s, isStr := v.(string); isStr {
		return s, nil
	}
	b, err := jsonMarshal(v)
	if err != nil {
		return def, err
	}
	return string(b), nil
}

// Set 写入单键(JSON 序列化)。
func (n *Namespace) Set(key string, value interface{}) error {
	return n.sd.kvSet(n.ns, key, value)
}

// Delete 删除单键。
func (n *Namespace) Delete(key string) error {
	return n.sd.kvDelete(n.ns, key)
}

// List 按键前缀列出键值。
func (n *Namespace) List(prefix string, limit int) (map[string]interface{}, error) {
	return n.sd.kvList(n.ns, prefix, limit)
}

// Exec 受限 SQL: 仅本 namespace 的表(ns_<name>_* 前缀)。
// SELECT 返回行列表; 其他返回影响行数。
func (n *Namespace) Exec(query string, args ...interface{}) ([]map[string]interface{}, int64, error) {
	return n.sd.nsExec(n.ns, query, args...)
}

// ExportAll 全量导出(迁移/备份用)。
func (n *Namespace) ExportAll() (map[string]interface{}, error) {
	return n.sd.kvList(n.ns, "", 1000)
}

// ImportAll 全量导入(迁移用)。
func (n *Namespace) ImportAll(items map[string]interface{}) error {
	for k, v := range items {
		if err := n.sd.kvSet(n.ns, k, v); err != nil {
			return err
		}
	}
	return nil
}

func jsonMarshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}
