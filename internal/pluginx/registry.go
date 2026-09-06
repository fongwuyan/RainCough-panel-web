package pluginx

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// ---- 注册/心跳/注销 ----

type registerParams struct {
	Token           string      `json:"token"`
	Name            string      `json:"name"`
	Version         string      `json:"version"`
	Manifest        interface{} `json:"manifest"`
	Frontend        interface{} `json:"frontend"`
	IfaceIDs        []string    `json:"iface_ids"`
	HeartbeatSec    int         `json:"heartbeat_sec"`
	ProtocolVersion int         `json:"protocol_version"`
}

func (x *PluginX) handleRegister(c *conn, raw json.RawMessage) (interface{}, *rpcError) {
	var p registerParams
	if err := parseParams(raw, &p); err != nil {
		return nil, &rpcError{Code: -32602, Message: "register 参数错误: " + err.Error()}
	}
	if p.Name == "" || p.Name != c.name {
		return nil, &rpcError{Code: -32602, Message: "register.name 与端点不匹配"}
	}
	if x.opts.Token != "" && p.Token != x.opts.Token {
		return nil, &rpcError{Code: -32602, Message: "注册 token 错误"}
	}
	if p.ProtocolVersion > 0 && p.ProtocolVersion != 1 {
		return nil, &rpcError{Code: 4401, Message: fmt.Sprintf("接口版本不匹配: 插件=%d 主系统=1", p.ProtocolVersion)}
	}
	// 清单(enrich: schemas/pages 来自插件目录 plugin.json v4)
	m, _ := x.loadManifestFor(p.Name)
	ifaces := []Iface{}
	if m != nil {
		for _, id := range unique(p.IfaceIDs) {
			def := findInterfaceDef(m, id)
			ifaces = append(ifaces, Iface{
				ID:          id,
				Plugin:      p.Name,
				Visibility:  orDefault(def.Visibility, "all"),
				Version:     orDefault(def.Version, "1"),
				Description: def.Description,
				Input:       def.Input,
				Output:      def.Output,
			})
		}
	} else {
		for _, id := range unique(p.IfaceIDs) {
			ifaces = append(ifaces, Iface{ID: id, Plugin: p.Name, Visibility: "all", Version: "1"})
		}
	}

	x.mu.Lock()
	pl := x.plugins[p.Name]
	if pl == nil {
		pl = &Plugin{Name: p.Name, Kind: "plugin"}
		x.plugins[p.Name] = pl
	}
	pl.Label = fmtLabel(p.Manifest, m, p.Name)
	pl.Version = orDefaultAny(p.Version, "0.0.0")
	pl.HeartbeatSec = p.HeartbeatSec
	if pl.HeartbeatSec <= 0 {
		pl.HeartbeatSec = 30
	}
	pl.Status = StatusOnline
	pl.LastSeen = time.Now().Unix()
	pl.FailCount = 0
	if m != nil {
		pl.Manifest = *m
		pl.Pages = m.Frontend.Pages
		pl.Capabilities = m.Backend.Capabilities
	}
	pl.Ifaces = unique(p.IfaceIDs)
	pl.conn = c
	for i := range ifaces {
		it := ifaces[i]
		prev := x.ifaces[it.ID]
		if prev != nil {
			it.Calls, it.AvgMs, it.P95Ms, it.LastError, it.durations = prev.Calls, prev.AvgMs, prev.P95Ms, prev.LastError, prev.durations
		}
		it.Online = true
		x.ifaces[it.ID] = &it
	}
	x.mu.Unlock()

	x.persistPlugin(pl)
	for _, it := range ifaces {
		rec := x.ifaces[it.ID]
		x.persistIface(rec)
	}
	return map[string]interface{}{"ok": true}, nil
}

func (x *PluginX) handleHeartbeat(c *conn, raw json.RawMessage) (interface{}, *rpcError) {
	var p struct {
		Version string `json:"version"`
	}
	_ = parseParams(raw, &p)
	x.mu.Lock()
	pl := x.plugins[c.name]
	if pl == nil {
		x.mu.Unlock()
		return nil, &rpcError{Code: -32602, Message: "未注册插件"}
	}
	pl.Status = StatusOnline
	pl.LastSeen = time.Now().Unix()
	pl.FailCount = 0
	if p.Version != "" {
		pl.Version = p.Version
	}
	x.mu.Unlock()
	x.persistPlugin(pl)
	return map[string]interface{}{"ok": true}, nil
}

func (x *PluginX) handleUnregister(c *conn) (interface{}, *rpcError) {
	x.mu.Lock()
	if pl := x.plugins[c.name]; pl != nil {
		pl.conn = nil
		pl.Status = StatusRegistered
		pl.FailCount = 0
	}
	x.mu.Unlock()
	// 接口下线标记(记录保留, 等重注册恢复)
	x.mu.Lock()
	for _, it := range x.ifaces {
		if it.Plugin == c.name {
			it.Online = false
		}
	}
	x.mu.Unlock()
	return map[string]interface{}{"ok": true}, nil
}

// onDisconnect 连接断开: 绑定清除 + 状态离线。
func (x *PluginX) onDisconnect(name string) {
	x.mu.Lock()
	var pl *Plugin
	if p := x.plugins[name]; p != nil {
		if p.conn != nil && p.conn.isClosed() {
			p.conn = nil
			p.Status = StatusOffline
			for _, it := range x.ifaces {
				if it.Plugin == name {
					it.Online = false
				}
			}
		}
		pl = p
	}
	x.mu.Unlock()
	if pl != nil {
		x.persistPlugin(pl)
	}
}

// ---- 内置系统 Provider(接口总览 source=system, 本地 handler) ----

// SystemIface 内置系统接口定义(无插件进程, 本地 Go handler 直接执行)。
type SystemIface struct {
	ID          string
	Plugin      string // 所属系统 Provider 名
	Label       string
	Visibility  string // 默认 main
	Version     string
	Description string
	Input       map[string]interface{}
	Output      map[string]interface{}
	Handler     func(params interface{}) (interface{}, error)
}

// RegisterSystemProvider 注册内置系统 Provider(常驻 online, 不可卸载)。
func (x *PluginX) RegisterSystemProvider(provider, label string, ifaces []SystemIface) {
	x.mu.Lock()
	defer x.mu.Unlock()
	now := time.Now().Unix()
	p := x.plugins[provider]
	if p == nil {
		p = &Plugin{Name: provider, Label: label, Kind: "system", Version: "1.0.0",
			Status: StatusOnline, LastSeen: now}
		x.plugins[provider] = p
	} else {
		p.Kind = "system"
		p.Label = label
		p.Status = StatusOnline
		p.LastSeen = now
	}
	for _, it := range ifaces {
		if it.Plugin == "" {
			it.Plugin = provider
		}
		rec := &Iface{
			ID: it.ID, Plugin: it.Plugin,
			Visibility:  orDefault(it.Visibility, "main"),
			Version:     orDefault(it.Version, "1"),
			Description: it.Description,
			Input:       it.Input,
			Output:      it.Output,
			Online:      true,
			handler:     it.Handler,
		}
		x.ifaces[rec.ID] = rec
		p.Ifaces = unique(append(p.Ifaces, rec.ID))
	}
}

// ---- 跨插件调用(接口库总线) ----

type callParams struct {
	Iface     string      `json:"iface"`
	Params    interface{} `json:"params"`
	TimeoutMs int64       `json:"timeout_ms,omitempty"`
}

// handleCall 插件 → 主系统 的跨插件调用(由 conn 读循环触发)。
func (x *PluginX) handleCall(c *conn, raw json.RawMessage) (interface{}, *rpcError) {
	var p callParams
	if err := parseParams(raw, &p); err != nil {
		return nil, &rpcError{Code: -32602, Message: "call 参数错误: " + err.Error()}
	}
	if p.Iface == "" {
		return nil, &rpcError{Code: -32602, Message: "call 缺少 iface"}
	}
	timeout := time.Duration(p.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	result, err := x.invokeFrom(c.name, p.Iface, p.Params, timeout)
	if err != nil {
		var re *RPCError
		if errors.As(err, &re) {
			return nil, &rpcError{Code: re.Code, Message: re.Message, Data: re.Data}
		}
		return nil, &rpcError{Code: -32603, Message: err.Error()}
	}
	return result, nil
}

// invokeFrom 接口库路由: 调用方 ctx("ui"=主系统界面 或 插件名) → 目标接口。
func (x *PluginX) invokeFrom(caller, ifaceID string, params interface{}, timeout time.Duration) (interface{}, error) {
	x.mu.Lock()
	it := x.ifaces[ifaceID]
	var target *Plugin
	if it != nil {
		target = x.plugins[it.Plugin]
	}
	x.mu.Unlock()

	if it == nil {
		return nil, &RPCError{Code: 4001, Message: "接口未注册: " + ifaceID}
	}
	// 可见性/权限
	switch it.Visibility {
	case "private":
		if caller != it.Plugin {
			return nil, &RPCError{Code: 4201, Message: "private 接口仅本插件可调: " + ifaceID}
		}
	case "main":
		if caller != "ui" && caller != it.Plugin {
			return nil, &RPCError{Code: 4201, Message: "main 接口仅主系统界面可调: " + ifaceID}
		}
	}
	// 系统内置接口: 本地直接执行(无插件进程)
	if it.handler != nil {
		start := time.Now()
		result, err := it.handler(params)
		ms := time.Since(start).Milliseconds()
		x.recordCall(it, ms, err)
		if err != nil {
			return nil, &RPCError{Code: 3000, Message: err.Error()}
		}
		return result, nil
	}
	if target == nil || target.conn == nil {
		return nil, &RPCError{Code: 4301, Message: "目标插件离线: " + it.Plugin}
	}
	start := time.Now()
	resp, err := target.conn.request("invoke", map[string]interface{}{
		"iface": ifaceID, "params": params,
	}, timeout)
	ms := time.Since(start).Milliseconds()
	var resVal interface{}
	if err == nil {
		_ = json.Unmarshal(resp, &resVal)
	}
	x.recordCall(it, ms, err)
	return resVal, err
}

// recordCall 更新接口调用统计(滚动窗口 p95)。
func (x *PluginX) recordCall(it *Iface, ms int64, err error) {
	x.mu.Lock()
	defer x.mu.Unlock()
	it.Calls++
	if err != nil {
		it.LastError = err.Error()
		return
	}
	it.durations = append(it.durations, ms)
	if len(it.durations) > 100 {
		it.durations = it.durations[len(it.durations)-100:]
	}
	if it.Calls == 1 {
		it.AvgMs = ms
	} else {
		it.AvgMs = (it.AvgMs*(it.Calls-1) + ms) / it.Calls
	}
	sorted := append([]int64(nil), it.durations...)
	sort.Slice(sorted, func(a, b int) bool { return sorted[a] < sorted[b] })
	if n := len(sorted); n > 0 {
		idx := (n * 95) / 100
		if idx >= n {
			idx = n - 1
		}
		it.P95Ms = sorted[idx]
	}
}

// ---- 工具 ----

func (x *PluginX) loadManifestFor(name string) (*ManifestV4, error) {
	if x.opts.PluginsDir == "" {
		return nil, nil
	}
	dir := filepath.Join(x.opts.PluginsDir, name)
	if _, err := os.Stat(dir); err != nil {
		return nil, err
	}
	return LoadManifestV4(dir)
}

func findInterfaceDef(m *ManifestV4, id string) InterfaceDef {
	for _, d := range m.Interfaces {
		if d.ID == id {
			return d
		}
	}
	return InterfaceDef{ID: id}
}

func unique(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, s := range in {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func orDefaultAny(v interface{}, def string) string {
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return def
}

func fmtLabel(man interface{}, m *ManifestV4, name string) string {
	if m != nil && m.Label != "" {
		return m.Label
	}
	if man != nil {
		if mm, ok := man.(map[string]interface{}); ok {
			if l, ok := mm["label"].(string); ok && l != "" {
				return l
			}
		}
	}
	return name
}

// ---- 持久化(KV: core_registry) ----

func (x *PluginX) persistPlugin(p *Plugin) {
	if x.ns == nil {
		return
	}
	b, _ := json.Marshal(p)
	x.ns.Set("plugin:"+p.Name, string(b))
}

func (x *PluginX) persistIface(it *Iface) {
	if x.ns == nil {
		return
	}
	b, _ := json.Marshal(it)
	x.ns.Set("iface:"+it.ID, string(b))
}

func (x *PluginX) loadPersisted() {
	if x.ns == nil {
		return
	}
	items, _ := x.ns.List("plugin:", 1000)
	for k, v := range items {
		name := strings.TrimPrefix(k, "plugin:")
		var p Plugin
		if err := json.Unmarshal([]byte(fmt.Sprint(v)), &p); err != nil {
			continue
		}
		// 只保留仍存在 v4 清单的插件(避免僵尸记录); 状态重置等待重注册
		if _, err := x.loadManifestFor(name); err != nil {
			continue
		}
		p.Status = StatusRegistered
		p.conn = nil
		x.plugins[name] = &p
	}
	ifaceItems, _ := x.ns.List("iface:", 2000)
	for k, v := range ifaceItems {
		id := strings.TrimPrefix(k, "iface:")
		var it Iface
		if err := json.Unmarshal([]byte(fmt.Sprint(v)), &it); err != nil {
			continue
		}
		if _, ok := x.plugins[it.Plugin]; !ok {
			continue
		}
		it.Online = false
		x.ifaces[id] = &it
	}
}
