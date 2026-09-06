package pluginx

import (
	"encoding/json"
	"time"
)

// probeLoop 周期探活: ping 在线插件, 更新延迟/状态; 超 lease 置 expired。
func (x *PluginX) probeLoop() {
	t := time.NewTicker(x.opts.ProbeEvery)
	defer t.Stop()
	for {
		select {
		case <-x.stopCh:
			return
		case <-t.C:
			x.probeAll()
		}
	}
}

func (x *PluginX) probeAll() {
	x.mu.Lock()
	names := make([]string, 0, len(x.plugins))
	for n, p := range x.plugins {
		if p.conn != nil || p.LastSeen > 0 {
			names = append(names, n)
		}
	}
	x.mu.Unlock()

	now := time.Now().Unix()
	for _, name := range names {
		x.mu.Lock()
		p := x.plugins[name]
		x.mu.Unlock()
		if p == nil {
			continue
		}
		if p.Kind == "system" {
			continue // 内置系统 Provider 常驻, 不探活
		}
		if p.conn == nil {
			// 已注册未连接: 超期则 expired
			lease := int64(p.HeartbeatSec) * 4
			if lease <= 0 {
				lease = 120
			}
			if now-p.LastSeen > lease && p.Status != StatusExpired {
				x.mu.Lock()
				p.Status = StatusExpired
				x.mu.Unlock()
				x.persistPlugin(p)
			}
			continue
		}
		start := time.Now()
		resp, err := p.conn.request("ping", map[string]interface{}{}, 3*time.Second)
		ms := time.Since(start).Milliseconds()
		x.mu.Lock()
		if err == nil {
			var pr struct {
				Pong    bool   `json:"pong"`
				Version string `json:"version"`
			}
			_ = json.Unmarshal(resp, &pr)
			p.Status = StatusOnline
			p.LastSeen = time.Now().Unix()
			p.LatencyMs = ms
			p.FailCount = 0
		} else {
			p.FailCount++
			p.LatencyMs = ms
			if p.FailCount >= 3 {
				p.Status = StatusOffline
				if p.conn != nil {
					p.conn.close()
					p.conn = nil
				}
				for _, it := range x.ifaces {
					if it.Plugin == name {
						it.Online = false
					}
				}
			}
		}
		x.mu.Unlock()
		if err == nil || p.FailCount < 3 {
			x.persistPlugin(p)
		}
	}
}
