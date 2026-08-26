package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"raincough/internal/core"
)

// 全局插件市场(main 中初始化)。
var globalStore *core.Store

// handleStoreSettings GET/POST /api/store/settings
func (s *server) handleStoreSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"config": map[string]interface{}{
				"plugin_repo": globalStore.GetConfig().PluginRepo,
				"panel_repo":  globalStore.GetConfig().PanelRepo,
				"has_token":   globalStore.Token() != "",
			},
		})
	case http.MethodPost:
		var b struct {
			PluginRepo  core.Repo `json:"plugin_repo"`
			PanelRepo   core.Repo `json:"panel_repo"`
			GithubToken string    `json:"github_token"`
			Token       string    `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		globalStore.Config(core.StoreConfig{PluginRepo: b.PluginRepo, PanelRepo: b.PanelRepo})
		tok := b.Token
		if tok == "" {
			tok = b.GithubToken // 兼容旧前端 github_token 键
		}
		if tok != "" {
			if err := globalStore.SetToken(tok); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"config": map[string]interface{}{
				"plugin_repo": globalStore.GetConfig().PluginRepo,
				"panel_repo":  globalStore.GetConfig().PanelRepo,
				"has_token":   globalStore.Token() != "",
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
func (s *server) handleStoreRegistry(w http.ResponseWriter, r *http.Request) {
	plugins, err := globalStore.Registry()
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"plugins": plugins})
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
	status, err := globalStore.InstallPlugin(b.Name, globalTasks)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{"error": err.Error()})
		return
	}
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
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// handleStorePluginUpdate POST /api/store/plugin/update {name}
func (s *server) handleStorePluginUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct{ Name string `json:"name"` }
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	status, err := globalStore.InstallPlugin(b.Name, globalTasks)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": status, "message": "已重新安装(更新)"})
}

// handleStoreProject GET /api/store/project/status|check|update-info + POST /api/store/project/install
func (s *server) handleStoreProject(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/store/project/")
	repo := globalStore.GetConfig().PanelRepo
	repoStr := repo.Owner + "/" + repo.Repo
	switch sub {
	case "status", "check", "update-info":
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status": "unknown", "repo": repoStr, "current": "v1.0.0",
			"latest": "v1.0.0", "up_to_date": true, "checking": false,
		})
	case "install":
		// 面板更新无法在运行中自升级, 提示需手动
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status": true, "message": "面板更新请通过部署脚本完成(运行中不可自升级)", "deferred": true,
		})
	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unknown"})
	}
}