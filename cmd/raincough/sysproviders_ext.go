package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"raincough/internal/core"
	"raincough/internal/pluginx"
)

// registerSystemProvidersMore 补充 system.* 接口: 覆盖 文件/终端/媒体/任务/调度/
// 环境包/插件市场/系统中心 的完整系统功能面(只读=all, 管理=main)。
func registerSystemProvidersMore(px *pluginx.PluginX) {
	// ---------- 文件管理 ----------
	px.RegisterSystemProvider("system", "系统功能(内置)", []pluginx.SystemIface{
		{ID: "system.fm.delete", Visibility: "main", Version: "1", Description: "删除文件/目录",
			Handler: func(params interface{}) (interface{}, error) {
				abs, err := resolveFM(strParam(params, "path"))
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"ok": true, "path": abs}, core.Delete(abs)
			}},
		{ID: "system.fm.mkdir", Visibility: "main", Version: "1", Description: "创建目录",
			Handler: func(params interface{}) (interface{}, error) {
				abs, err := resolveFM(strParam(params, "path"))
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"ok": true, "path": abs}, core.Mkdir(abs)
			}},
		{ID: "system.fm.rename", Visibility: "main", Version: "1", Description: "重命名/移动",
			Handler: func(params interface{}) (interface{}, error) {
				oldAbs, err := resolveFM(strParam(params, "old"))
				if err != nil {
					return nil, err
				}
				nw := strParam(params, "new")
				if nw == "" {
					return nil, fmt.Errorf("new 必填")
				}
				newAbs := nw
				if !filepath.IsAbs(newAbs) {
					newAbs = filepath.Join(filepath.Dir(oldAbs), filepath.Base(nw))
				}
				return map[string]interface{}{"ok": true}, core.Rename(oldAbs, newAbs)
			}},
		{ID: "system.fm.save", Visibility: "main", Version: "1", Description: "保存文本文件",
			Handler: func(params interface{}) (interface{}, error) {
				abs, err := resolveFM(strParam(params, "path"))
				if err != nil {
					return nil, err
				}
				content := strParam(params, "content")
				return map[string]interface{}{"ok": true, "path": abs}, core.SaveFileText(abs, []byte(content), core.SaveLimitMax)
			}},
		{ID: "system.fm.search", Visibility: "all", Version: "1", Description: "文件名搜索",
			Handler: func(params interface{}) (interface{}, error) {
				root, err := resolveFM(strParam(params, "path"))
				if err != nil {
					return nil, err
				}
				q := strings.ToLower(strParam(params, "q"))
				if q == "" {
					return nil, fmt.Errorf("q 必填")
				}
				results := []map[string]interface{}{}
				_ = filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
					if err != nil || !strings.Contains(strings.ToLower(info.Name()), q) {
						return nil
					}
					rel := strings.TrimPrefix(p, root)
					results = append(results, map[string]interface{}{
						"path": rel, "name": info.Name(), "is_dir": info.IsDir(), "size": info.Size(),
					})
					return nil
				})
				if len(results) > 500 {
					results = results[:500]
				}
				return map[string]interface{}{"ok": true, "root": root, "count": len(results), "results": results}, nil
			}},
		{ID: "system.fm.size", Visibility: "all", Version: "1", Description: "目录/文件大小",
			Handler: func(params interface{}) (interface{}, error) {
				paths := strList(params, "paths")
				out := map[string]int64{}
				for _, p := range paths {
					if abs, err := resolveFM(p); err == nil {
						out[p], _ = core.DirSize(abs)
					}
				}
				return map[string]interface{}{"sizes": out}, nil
			}},
		{ID: "system.fm.ops.start", Visibility: "main", Version: "1", Description: "启动文件任务(copy/move/delete/archive)",
			Handler: func(params interface{}) (interface{}, error) {
				op := strParam(params, "op")
				paths := strList(params, "paths")
				if op == "" || len(paths) == 0 {
					return nil, fmt.Errorf("op 与 paths 必填")
				}
				abs := make([]string, 0, len(paths))
				for _, p := range paths {
					a, err := resolveFM(p)
					if err != nil {
						return nil, err
					}
					abs = append(abs, a)
				}
				t := core.NewFmTask(op, paths, strParam(params, "dest"))
				if op == "archive" {
					t.Message = "format=" + strParam(params, "format") + " name=" + strParam(params, "name")
				}
				fmOps.Add(t)
				go core.RunFmTask(t, abs, strParam(params, "destAbs"))
				return map[string]interface{}{"status": "queued", "id": t.ID}, nil
			}},
		{ID: "system.fm.ops.list", Visibility: "all", Version: "1", Description: "文件任务列表",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"tasks": fmOps.List()}, nil
			}},
		{ID: "system.fm.ops.cancel", Visibility: "main", Version: "1", Description: "取消文件任务",
			Handler: func(params interface{}) (interface{}, error) {
				t := fmOps.Get(strParam(params, "id"))
				if t == nil {
					return nil, fmt.Errorf("任务不存在")
				}
				t.Cancel()
				return map[string]interface{}{"ok": true}, nil
			}},

		// ---------- 终端 ----------
		{ID: "system.term.sessions", Visibility: "all", Version: "1", Description: "终端会话列表",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"sessions": globalTerm.List()}, nil
			}},
		{ID: "system.term.open", Visibility: "main", Version: "1", Description: "打开本地终端会话",
			Handler: func(params interface{}) (interface{}, error) {
				sess, err := globalTerm.Open(intFrom(params, "rows", 24), intFrom(params, "cols", 80))
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"sid": sess.ID}, nil
			}},
		{ID: "system.term.send", Visibility: "main", Version: "1", Description: "向会话发送输入(base64)",
			Handler: func(params interface{}) (interface{}, error) {
				sess, ok := globalTerm.Get(strParam(params, "sid"))
				if !ok {
					return nil, fmt.Errorf("会话不存在")
				}
				raw, err := base64.StdEncoding.DecodeString(strParam(params, "data"))
				if err != nil {
					return nil, fmt.Errorf("data 需为 base64")
				}
				return map[string]interface{}{"ok": true}, sess.Write(raw)
			}},
		{ID: "system.term.close", Visibility: "main", Version: "1", Description: "关闭会话",
			Handler: func(params interface{}) (interface{}, error) {
				globalTerm.Close(strParam(params, "sid"))
				return map[string]interface{}{"ok": true}, nil
			}},
		{ID: "system.term.resize", Visibility: "main", Version: "1", Description: "调整会话尺寸",
			Handler: func(params interface{}) (interface{}, error) {
				sess, ok := globalTerm.Get(strParam(params, "sid"))
				if !ok {
					return nil, fmt.Errorf("会话不存在")
				}
				return map[string]interface{}{"ok": true}, sess.Resize(intFrom(params, "rows", 24), intFrom(params, "cols", 80))
			}},
		{ID: "system.term.hosts.list", Visibility: "all", Version: "1", Description: "SSH 主机列表",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"hosts": termGet("hosts", []map[string]interface{}{})}, nil
			}},
		{ID: "system.term.hosts.save", Visibility: "main", Version: "1", Description: "保存 SSH 主机列表",
			Handler: func(params interface{}) (interface{}, error) {
				termSave("hosts", []map[string]interface{}{{"list": params}})
				return map[string]interface{}{"ok": true}, nil
			}},
		{ID: "system.term.commands.list", Visibility: "all", Version: "1", Description: "常用命令列表",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"commands": termGet("commands", []map[string]interface{}{})}, nil
			}},
		{ID: "system.term.commands.save", Visibility: "main", Version: "1", Description: "保存常用命令列表",
			Handler: func(params interface{}) (interface{}, error) {
				termSave("commands", []map[string]interface{}{{"list": params}})
				return map[string]interface{}{"ok": true}, nil
			}},

		// ---------- 媒体 ----------
		{ID: "system.media.roots.get", Visibility: "all", Version: "1", Description: "媒体根目录",
			Handler: func(params interface{}) (interface{}, error) {
				if mediaSvc == nil {
					return map[string]interface{}{"roots": []interface{}{}}, nil
				}
				return map[string]interface{}{"roots": mediaSvc.Roots()}, nil
			}},
		{ID: "system.media.roots.save", Visibility: "main", Version: "1", Description: "保存媒体根目录",
			Handler: func(params interface{}) (interface{}, error) {
				if mediaSvc == nil {
					return nil, fmt.Errorf("媒体服务未初始化")
				}
				list := []interface{}{}
				if m, ok := params.(map[string]interface{}); ok {
					if arr, ok := m["roots"].([]interface{}); ok {
						list = arr
					}
				}
				mediaSvc.SaveRoots(list)
				return map[string]interface{}{"ok": true, "roots": mediaSvc.Roots()}, nil
			}},
		{ID: "system.media.list", Visibility: "all", Version: "1", Description: "媒体文件分页列表",
			Handler: func(params interface{}) (interface{}, error) {
				if mediaSvc == nil {
					return map[string]interface{}{"items": []interface{}{}, "total": 0}, nil
				}
				items, total := mediaSvc.List(strParam(params, "root"), strParam(params, "kind"), strParam(params, "tag"), intFrom(params, "page", 0))
				return map[string]interface{}{"items": items, "total": total}, nil
			}},
		{ID: "system.media.dedup", Visibility: "all", Version: "1", Description: "相似图片检测(按大小分组)",
			Handler: func(params interface{}) (interface{}, error) {
				if mediaSvc == nil {
					return map[string]interface{}{"groups": []interface{}{}, "scanned": 0}, nil
				}
				groups, scanned := mediaSvc.Dedup(strParam(params, "root"))
				return map[string]interface{}{"groups": groups, "scanned": scanned}, nil
			}},
		{ID: "system.media.tool", Visibility: "all", Version: "1", Description: "媒体工具端点(兼容占位)",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"ok": true, "message": "工具端点已就绪(文件处理在插件层)"}, nil
			}},

		// ---------- 任务队列 ----------
		{ID: "system.tasks.detail", Visibility: "all", Version: "1", Description: "任务详情",
			Handler: func(params interface{}) (interface{}, error) {
				t, ok := globalTasks.Get(strParam(params, "id"))
				if !ok {
					return nil, fmt.Errorf("任务不存在")
				}
				return t, nil
			}},
		{ID: "system.tasks.purge", Visibility: "main", Version: "1", Description: "清理已完成任务",
			Handler: func(params interface{}) (interface{}, error) {
				n := globalTasks.Cleanup(0)
				return map[string]interface{}{"cleaned": n}, nil
			}},

		// ---------- 调度器 ----------
		{ID: "system.sched.list", Visibility: "all", Version: "1", Description: "调度任务列表",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"jobs": globalSched.List()}, nil
			}},
		{ID: "system.sched.get", Visibility: "all", Version: "1", Description: "调度任务详情",
			Handler: func(params interface{}) (interface{}, error) {
				j, ok := globalSched.Get(strParam(params, "id"))
				if !ok {
					return nil, fmt.Errorf("任务不存在")
				}
				return j, nil
			}},
		{ID: "system.sched.create", Visibility: "main", Version: "1", Description: "创建调度任务",
			Handler: func(params interface{}) (interface{}, error) {
				j, err := globalSched.Create(strParam(params, "name"), strParam(params, "cron"), strParam(params, "action"), map[string]string{})
				if err != nil {
					return nil, err
				}
				return j, nil
			}},
		{ID: "system.sched.update", Visibility: "main", Version: "1", Description: "更新调度任务",
			Handler: func(params interface{}) (interface{}, error) {
				return nil, globalSched.Update(strParam(params, "id"), strParam(params, "name"), strParam(params, "cron"), strParam(params, "action"), map[string]string{}, nil)
			}},
		{ID: "system.sched.delete", Visibility: "main", Version: "1", Description: "删除调度任务",
			Handler: func(params interface{}) (interface{}, error) {
				return nil, globalSched.Delete(strParam(params, "id"))
			}},
		{ID: "system.sched.runnow", Visibility: "main", Version: "1", Description: "立即执行调度任务",
			Handler: func(params interface{}) (interface{}, error) {
				out, err := globalSched.RunNow(strParam(params, "id"))
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"output": out}, nil
			}},

		// ---------- 环境包 ----------
		{ID: "system.envpkg.catalog", Visibility: "all", Version: "1", Description: "可安装环境目录",
			Handler: func(params interface{}) (interface{}, error) {
				return envpkgRecipeList(), nil
			}},
		{ID: "system.envpkg.run", Visibility: "main", Version: "1", Description: "获取运行前缀环境变量",
			Handler: func(params interface{}) (interface{}, error) {
				env, ok := globalEnv.EnvRunPrefix(strParam(params, "name"))
				if !ok {
					return nil, fmt.Errorf("环境未安装")
				}
				return map[string]interface{}{"env": env}, nil
			}},
		{ID: "system.envpkg.install", Visibility: "main", Version: "1", Description: "安装环境(异步)",
			Handler: func(params interface{}) (interface{}, error) {
				id, err := globalEnv.Install(strParam(params, "type"), strParam(params, "version"), defaultDownloader)
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"task_id": id}, nil
			}},
		{ID: "system.envpkg.uninstall", Visibility: "main", Version: "1", Description: "卸载环境",
			Handler: func(params interface{}) (interface{}, error) {
				return nil, globalEnv.Uninstall(strParam(params, "name"))
			}},
		{ID: "system.envpkg.task", Visibility: "all", Version: "1", Description: "安装任务状态",
			Handler: func(params interface{}) (interface{}, error) {
				t, ok := globalEnv.TaskStatus(strParam(params, "id"))
				if !ok {
					return nil, fmt.Errorf("任务不存在")
				}
				return t, nil
			}},

		// ---------- 插件市场 ----------
		{ID: "system.store.settings.get", Visibility: "all", Version: "1", Description: "市场设置",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{
					"plugin_repo": globalStore.GetConfig().PluginRepo,
					"panel_repo":  globalStore.GetConfig().PanelRepo,
					"has_token":   globalStore.Token() != "",
				}, nil
			}},
		{ID: "system.store.settings.save", Visibility: "main", Version: "1", Description: "保存市场设置",
			Handler: func(params interface{}) (interface{}, error) {
				m, _ := params.(map[string]interface{})
				globalStore.Config(core.StoreConfig{
					PluginRepo: repoFromStr(strAny(m, "plugin_repo")),
					PanelRepo:  repoFromStr(strAny(m, "panel_repo")),
				})
				if tok, ok := m["github_token"].(string); ok && tok != "" {
					if err := globalStore.SetToken(tok); err != nil {
						return nil, err
					}
				}
				return map[string]interface{}{"ok": true}, nil
			}},
		{ID: "system.store.ping", Visibility: "all", Version: "1", Description: "市场连通性",
			Handler: func(params interface{}) (interface{}, error) {
				p, _ := globalStore.Ping()
				return p, nil
			}},
		{ID: "system.store.install", Visibility: "main", Version: "1", Description: "安装插件",
			Handler: func(params interface{}) (interface{}, error) {
				msg, err := globalStore.InstallPlugin(strParam(params, "name"), globalTasks)
				if err != nil {
					return nil, err
				}
				globalPX.Reload()
				return map[string]interface{}{"message": msg}, nil
			}},
		{ID: "system.store.remove", Visibility: "main", Version: "1", Description: "卸载插件",
			Handler: func(params interface{}) (interface{}, error) {
				if err := globalStore.RemovePlugin(strParam(params, "name")); err != nil {
					return nil, err
				}
				globalPX.Reload()
				return map[string]interface{}{"ok": true}, nil
			}},

		// ---------- 系统中心 ----------
		{ID: "system.sys.services", Visibility: "all", Version: "1", Description: "systemd 服务列表",
			Handler: func(params interface{}) (interface{}, error) {
				svcs, err := globalSys.ServiceList()
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"services": svcs}, nil
			}},
		{ID: "system.sys.processes", Visibility: "all", Version: "1", Description: "进程列表",
			Handler: func(params interface{}) (interface{}, error) {
				procs, err := globalSys.ProcessList()
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"processes": procs}, nil
			}},
		{ID: "system.sys.firewall", Visibility: "all", Version: "1", Description: "防火墙状态",
			Handler: func(params interface{}) (interface{}, error) {
				fw, _ := globalSys.FirewallStatus()
				return fw, nil
			}},
		{ID: "system.sys.users", Visibility: "all", Version: "1", Description: "可登录用户",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"users": globalSys.Users()}, nil
			}},
		{ID: "system.sys.sshkeys.get", Visibility: "all", Version: "1", Description: "读取 SSH 公钥",
			Handler: func(params interface{}) (interface{}, error) {
				k, err := globalSys.SSHKeys(strParam(params, "user"))
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"keys": k}, nil
			}},
		{ID: "system.sys.sshkeys.save", Visibility: "main", Version: "1", Description: "保存 SSH 公钥",
			Handler: func(params interface{}) (interface{}, error) {
				if err := globalSys.SaveSSHKeys(strParam(params, "user"), strParam(params, "keys")); err != nil {
					return nil, err
				}
				return map[string]interface{}{"ok": true}, nil
			}},
		{ID: "system.sys.cron.get", Visibility: "all", Version: "1", Description: "读取 crontab",
			Handler: func(params interface{}) (interface{}, error) {
				c, err := globalSys.CronTab(strParam(params, "user"))
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"content": c}, nil
			}},
		{ID: "system.sys.cron.save", Visibility: "main", Version: "1", Description: "保存 crontab",
			Handler: func(params interface{}) (interface{}, error) {
				return nil, globalSys.SaveCronTab(strParam(params, "user"), strParam(params, "content"))
			}},
		{ID: "system.sys.clean.scan", Visibility: "all", Version: "1", Description: "清理候选扫描",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"items": globalSys.CleanScan()}, nil
			}},
		{ID: "system.sys.pwr.state", Visibility: "all", Version: "1", Description: "关机/重启排程状态",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"state": globalSys.PwrState()}, nil
			}},
		{ID: "system.sys.kernels", Visibility: "all", Version: "1", Description: "内核包列表",
			Handler: func(params interface{}) (interface{}, error) {
				k, err := globalSys.KernelList()
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"kernels": k}, nil
			}},
		{ID: "system.sys.time.status", Visibility: "all", Version: "1", Description: "时间/时区状态",
			Handler: func(params interface{}) (interface{}, error) {
				out, err := globalSys.TimeStatus()
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"status": out}, nil
			}},
		{ID: "system.sys.health", Visibility: "all", Version: "1", Description: "健康检查",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"checks": globalSys.HealthChecks("raincough")}, nil
			}},
		{ID: "system.sys.events", Visibility: "all", Version: "1", Description: "事件时间线",
			Handler: func(params interface{}) (interface{}, error) {
				ev, err := globalSys.Events(intFrom(params, "limit", 50))
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"events": ev}, nil
			}},
		{ID: "system.sys.logrotate.get", Visibility: "all", Version: "1", Description: "logrotate 配置",
			Handler: func(params interface{}) (interface{}, error) {
				c, err := globalSys.LogrotateList()
				if err != nil {
					return nil, err
				}
				return map[string]interface{}{"content": c}, nil
			}},
		{ID: "system.sys.logrotate.save", Visibility: "main", Version: "1", Description: "保存 logrotate 配置",
			Handler: func(params interface{}) (interface{}, error) {
				return nil, globalSys.LogrotateSave(strParam(params, "name"), strParam(params, "content"))
			}},
		{ID: "system.sys.boot", Visibility: "all", Version: "1", Description: "启动历史",
			Handler: func(params interface{}) (interface{}, error) {
				return map[string]interface{}{"rows": globalSys.BootHistory(), "boot_started": time.Now().Format("2006-01-02 15:04:05")}, nil
			}},
		{ID: "system.sys.perf", Visibility: "all", Version: "1", Description: "性能趋势",
			Handler: func(params interface{}) (interface{}, error) {
				pts, rx, tx := perf.Snapshot()
				return map[string]interface{}{"points": pts, "net": map[string]uint64{"rx": rx, "tx": tx}}, nil
			}},
		{ID: "system.sys.net", Visibility: "all", Version: "1", Description: "网络状态",
			Handler: func(params interface{}) (interface{}, error) {
				return sysMon.NetStatus(), nil
			}},
	})
}

// ---- 小工具 ----

func strList(params interface{}, key string) []string {
	out := []string{}
	if m, ok := params.(map[string]interface{}); ok {
		if arr, ok := m[key].([]interface{}); ok {
			for _, v := range arr {
				if s, ok := v.(string); ok && s != "" {
					out = append(out, s)
				}
			}
		}
	}
	return out
}

func strAny(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func intFrom(params interface{}, key string, def int) int {
	if m, ok := params.(map[string]interface{}); ok {
		switch v := m[key].(type) {
		case float64:
			return int(v)
		case string:
			if n, err := strconv.Atoi(v); err == nil {
				return n
			}
		}
	}
	return def
}

// repoFromStr 解析 "owner/repo[/branch]" 为 core.Repo。
func repoFromStr(s string) core.Repo {
	if s == "" {
		return core.Repo{}
	}
	parts := strings.Split(s, "/")
	r := core.Repo{Owner: parts[0], Branch: "main"}
	if len(parts) > 1 {
		r.Repo = parts[1]
	}
	if len(parts) > 2 && parts[2] != "" {
		r.Branch = parts[2]
	}
	return r
}
