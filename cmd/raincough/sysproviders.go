package main

import (
	"fmt"

	"raincough/internal/core"
	"raincough/internal/pluginx"
)

// registerSystemProviders M4: 核心系统功能注册为接口库内置 Provider(source=system)。
// 规则: 管理类接口 visibility=main(仅主系统 UI 可调, 防插件越权);
//
//	只读信息/统计类 = all(插件可发现与复用)。
func registerSystemProviders(px *pluginx.PluginX) {
	px.RegisterSystemProvider("system", "系统功能(内置)", []pluginx.SystemIface{
		{ID: "system.ping", Visibility: "all", Version: "1", Description: "主系统存活探测",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"pong": true, "app": "RainCough"}, nil
			}},
		{ID: "system.info", Visibility: "all", Version: "1", Description: "系统概览状态",
			Handler: func(params interface{}) (interface{}, error) {
				s := sysMon.Snapshot()
				return map[string]interface{}{
					"hostname":       s.Hostname,
					"platform":       s.Platform,
					"arch":           s.Arch,
					"cpu_count":      s.CPUCount,
					"cpu_percent":    s.CPUPercent,
					"memory_percent": s.MemoryPercent,
					"disk_percent":   s.DiskPercent,
					"load_avg":       s.LoadAvg,
					"uptime":         s.Uptime,
					"process_count":  s.ProcessCount,
				}, nil
			}},
		{ID: "system.disks", Visibility: "main", Version: "1", Description: "磁盘列表(lsblk+df)",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"disks": globalSys.LsblkDisks()}, nil
			}},
		{ID: "system.file.list", Visibility: "main", Version: "1",
			Input:       map[string]interface{}{"type": "object", "props": map[string]interface{}{"path": map[string]interface{}{"type": "string"}}},
			Description: "文件列表(路径须在允许根内)",
			Handler: func(params interface{}) (interface{}, error) {
				p := strParam(params, "path")
				if p == "" {
					p = "/"
				}
				abs, err := resolveFM(p)
				if err != nil {
					return nil, err
				}
				entries, err := core.ListDir(abs)
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"path": abs, "items": entries, "count": len(entries)}, nil
			}},
		{ID: "system.file.read", Visibility: "main", Version: "1",
			Input:       map[string]interface{}{"type": "object", "props": map[string]interface{}{"path": map[string]interface{}{"type": "string"}}},
			Description: "读取文本文件(≤5MB)",
			Handler: func(params interface{}) (interface{}, error) {
				p := strParam(params, "path")
				if p == "" {
					return nil, fmt.Errorf("path 必填")
				}
				abs, err := resolveFM(p)
				if err != nil {
					return nil, err
				}
				content, tooBig, err := core.ReadFileText(abs, core.ReadLimitMax)
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"path": abs, "content": content, "too_big": tooBig}, nil
			}},
		{ID: "system.media.stats", Visibility: "all", Version: "1", Description: "媒体中心统计",
			Handler: func(params interface{}) (interface{}, error) {
				if mediaSvc == nil {
					return nil, fmt.Errorf("媒体服务未初始化")
				}
				counts, total := mediaSvc.Stats()
				return map[string]interface{}{"counts": counts, "total_size": total}, nil
			}},
		{ID: "system.tasks.list", Visibility: "main", Version: "1", Description: "任务队列(含已完成)",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"tasks": globalTasks.List(false, 50)}, nil
			}},
		{ID: "system.envpkg.envs", Visibility: "main", Version: "1", Description: "已安装环境包",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"envs": globalEnv.List()}, nil
			}},
		{ID: "system.store.registry", Visibility: "main", Version: "1", Description: "插件市场注册表",
			Handler: func(params interface{}) (interface{}, error) {
				reg, err := globalStore.Registry()
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"registry": reg}, nil
			}},
		{ID: "system.health.services", Visibility: "all", Version: "1", Description: "服务健康汇总",
			Handler: func(params interface{}) (interface{}, error) {
				return px.HealthSummary(), nil
			}},
	})
}

// strParam 取 params(map) 中的字符串字段。
func strParam(params interface{}, key string) string {
	if mm, ok := params.(map[string]interface{}); ok {
		return str(mm, key)
	}
	return ""
}
