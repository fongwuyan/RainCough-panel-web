package shared

import (
	"encoding/json"
	"sort"
	"strings"
)

// Namespace 单个插件/模块的独立数据空间。
type Namespace struct {
	s  *Shared
	sp *space
	ns string
}

// Ns 返回 namespace 名。
func (n *Namespace) Ns() string { return n.ns }

// Get 读取单键; ok=false 表示键不存在。
func (n *Namespace) Get(key string) (interface{}, bool, error) {
	raw, ok := n.sp.get(key)
	if !ok {
		return nil, false, nil
	}
	var v interface{}
	if err := json.Unmarshal(raw, &v); err != nil {
		return string(raw), true, nil // 非 JSON 文本原样返回
	}
	return v, true, nil
}

// GetString 读取字符串值(不存在返回 default)。
func (n *Namespace) GetString(key, def string) (string, error) {
	v, ok, err := n.Get(key)
	if err != nil || !ok {
		return def, err
	}
	if s, isStr := v.(string); isStr {
		return s, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return def, err
	}
	return string(b), nil
}

// Set 写入单键(JSON 序列化)。
func (n *Namespace) Set(key string, value interface{}) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return n.sp.set(key, raw)
}

// Delete 删除单键。
func (n *Namespace) Delete(key string) error { return n.sp.del(key) }

// List 按键前缀列出键值(键名升序, limit<=0 或 >1000 时取 100, 与旧实现一致)。
func (n *Namespace) List(prefix string, limit int) (map[string]interface{}, error) {
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	raws := n.sp.list(prefix, limit)
	out := make(map[string]interface{}, len(raws))
	for k, raw := range raws {
		var v interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			out[k] = string(raw)
			continue
		}
		out[k] = v
	}
	return out, nil
}

// Keys 返回当前 namespace 的全部键名(升序), 不分页。
func (n *Namespace) Keys() []string {
	raws := n.sp.list("", 0)
	keys := make([]string, 0, len(raws))
	for k := range raws {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// ExportAll 全量导出(迁移/备份用), 不受 1000 条限制。
func (n *Namespace) ExportAll() (map[string]interface{}, error) {
	raws := n.sp.list("", 0)
	out := make(map[string]interface{}, len(raws))
	for k, raw := range raws {
		var v interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			out[k] = string(raw)
			continue
		}
		out[k] = v
	}
	return out, nil
}

// ImportAll 全量导入(迁移用)。
func (n *Namespace) ImportAll(items map[string]interface{}) error {
	keys := make([]string, 0, len(items))
	for k := range items {
		keys = append(keys, k)
	}
	sort.Strings(keys) // 固定写入顺序, 便于复现
	for _, k := range keys {
		if err := n.Set(k, items[k]); err != nil {
			return err
		}
	}
	return nil
}

// HasPrefix 便捷判断(保留给调用方做前缀筛选)。
func HasPrefix(s, prefix string) bool { return strings.HasPrefix(s, prefix) }
