package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"raincough/internal/auth"
	"raincough/internal/core"
)

// 全局插件市场(main 中初始化)。
var globalStore *core.Store

// globalGate 插件库口令闸门。
// 为 nil 表示闸门未启用(默认), 所有接口直接放行。
var globalGate *auth.StoreGate

// globalAPIKey 移动端 REST 访问密钥(见 internal/auth/apikey.go)。
// 为 nil 表示校验被关闭(RC_REST_KEY=off)或初始化失败 —— 后者一律拒绝, 不放行。
var globalAPIKey *auth.APIKeyStore

// gateLocked 返回 true 表示该请求未通过闸门 —— 已经写好 403 响应, 调用方直接 return。
// note: 这是"面板内可见性"的锁, 防不住知道 GitHub 地址的人直接 clone(见 gate.go 注释)。
func gateLocked(w http.ResponseWriter, r *http.Request) bool {
	if globalGate == nil {
		return false
	}
	if globalGate.Unlocked(r) {
		return false
	}
	writeJSON(w, http.StatusForbidden, map[string]interface{}{
		"error":         "插件库已上锁: 需要输入口令",
		"need_password": true,
	})
	return true
}

// handleStoreGate GET /api/store/gate  +  POST /api/store/gate/unlock  +  POST /api/store/gate/lock
func (s *server) handleStoreGate(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/store/gate")
	sub = strings.Trim(sub, "/")

	// 闸门关闭时: 一律视为已解锁, 前端不显示解锁面板
	if globalGate == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"locked": false, "enabled": false})
		return
	}

	switch {
	case sub == "" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"locked":  !globalGate.Unlocked(r),
			"enabled": true,
		})

	case sub == "unlock" && r.Method == http.MethodPost:
		var b struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		remaining, err := globalGate.Unlock(r, w, b.Password)
		if err != nil {
			log.Printf("[gate] 口令失败 from %s: %v", r.RemoteAddr, err)
			code := http.StatusUnauthorized
			if remaining < 0 {
				code = http.StatusTooManyRequests
			}
			writeJSON(w, code, map[string]interface{}{
				"error": err.Error(), "locked": true, "remaining": remaining,
			})
			return
		}
		log.Printf("[gate] 插件库已解锁 from %s", r.RemoteAddr)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "locked": false})

	case sub == "lock" && r.Method == http.MethodPost:
		globalGate.Lock(w)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "locked": true})

	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unknown"})
	}
}

// handleStoreSettings GET/POST /api/store/settings
// 注: GitHub token 不再由前端提供 —— 插件库改公开后不需要; 保留后端兼容(环境变量/旧数据仍可用)。
func (s *server) handleStoreSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"config": map[string]interface{}{
				"plugin_repo": globalStore.GetConfig().PluginRepo,
				"panel_repo":  globalStore.GetConfig().PanelRepo,
			},
		})
	case http.MethodPost:
		var b struct {
			PluginRepo core.Repo `json:"plugin_repo"`
			PanelRepo  core.Repo `json:"panel_repo"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		globalStore.Config(core.StoreConfig{PluginRepo: b.PluginRepo, PanelRepo: b.PanelRepo})
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"config": map[string]interface{}{
				"plugin_repo": globalStore.GetConfig().PluginRepo,
				"panel_repo":  globalStore.GetConfig().PanelRepo,
			},
		})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

// handleStorePing POST /api/store/ping
func (s *server) handleStorePing(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	status, _ := globalStore.Ping()
	writeJSON(w, http.StatusOK, status)
}

// handleStoreRegistry GET /api/store/registry
// 附带 source(github|local) 与 has_token: local 说明仓库清单拉取失败已回退到
// 本机扫描, 前端据此明确提示"当前仅显示已装插件、无法安装新插件"。
func (s *server) handleStoreRegistry(w http.ResponseWriter, r *http.Request) {
	if gateLocked(w, r) {
		return
	}
	plugins, source, err := globalStore.RegistryWithSource()
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"plugins": plugins, "source": source, "has_token": globalStore.Token() != "",
	})
}

// handleStoreChangelog GET /api/store/changelog
// 插件仓的仓级版本 + 更新日志(CHANGELOG.md)。插件页「更新日志」悬浮窗用。
// 仓库不可用(未配仓库/token 无效/网络不通)时 502, 前端只提示"仓库不可用"。
func (s *server) handleStoreChangelog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "环境未就绪"})
		return
	}
	if gateLocked(w, r) {
		return
	}
	cl, err := globalStore.Changelog()
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{"error": err.Error()})
		return
	}
	cl.Source = "github"
	writeJSON(w, http.StatusOK, cl)
}

// handleStorePluginInstall POST /api/store/plugin/install {name}
func (s *server) handleStorePluginInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if b.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	if gateLocked(w, r) {
		return
	}
	status, err := globalStore.InstallPlugin(b.Name, globalTasks)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{"error": err.Error()})
		return
	}
	log.Printf("[store] 插件安装: %s (status=%s)", b.Name, status)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": status, "task": "queued"})
}

// handleStorePluginRemove POST /api/store/plugin/remove {name}
func (s *server) handleStorePluginRemove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if err := globalStore.RemovePlugin(b.Name); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	log.Printf("[store] 插件移除: %s", b.Name)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// handleStorePluginUpdate POST /api/store/plugin/update {name}
func (s *server) handleStorePluginUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	if gateLocked(w, r) {
		return
	}
	// ★ 更新前校验版本方向: 市场清单版本必须严格高于已装版本。
	//   否则"更新"按钮等于把用户降级 —— 本地开发版/预发布/市场清单滞后时都可能发生。
	//   前端已经改了判断(verNewer), 但接口也必须挡: 直接 POST 这个接口的人不该被降级。
	if cur := installedPluginVersion(b.Name); cur != "" {
		if wv := marketPluginVersion(b.Name); wv != "" && !verLess(cur, wv) {
			writeJSON(w, http.StatusConflict, map[string]interface{}{
				"error":     "市场版本 v" + wv + " 不高于已装版本 v" + cur + ", 无需更新(避免降级)",
				"installed": cur, "market": wv,
			})
			return
		}
	}
	status, err := globalStore.InstallPlugin(b.Name, globalTasks)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": status, "message": "已提交更新"})
}

// installedPluginVersion 读已装插件的 plugin.json 版本; 未装返回空串。
func installedPluginVersion(name string) string {
	if globalStore == nil {
		return ""
	}
	dir := filepath.Join(globalStore.PluginsDir(), name)
	raw, err := os.ReadFile(filepath.Join(dir, "plugin.json"))
	if err != nil {
		return ""
	}
	var m struct {
		Version string `json:"version"`
	}
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	return m.Version
}

// marketPluginVersion 从市场清单里取某插件的版本; 取不到返回空串(此时不拦, 交给安装器)。
func marketPluginVersion(name string) string {
	if globalStore == nil {
		return ""
	}
	plugins, err := globalStore.Registry()
	if err != nil {
		return ""
	}
	for _, p := range plugins {
		if p.Name == name {
			return p.Version
		}
	}
	return ""
}

// 面板自更新现在走 /api/panel/update/*(check → apply → restart → rollback)。
//
// 这里曾有一个 handleStoreProject, 返回 /api/store/project/status|install。
// 它从未在 main.go 里注册过路由(mux 里没有 store/project), 属于死代码,
// 2026-11-01 面板内置功能审计时删除。旧版那套返回伪造 current/latest 的逻辑
// (2026-09-28 定位)随之彻底消失。
//
// ★ 别再把它加回来: 需要版本信息用 GET /api/panel/version, 需要更新用
//   /api/panel/update/*。两个入口并存只会让"到底哪个是真的"再变成一次事故。
