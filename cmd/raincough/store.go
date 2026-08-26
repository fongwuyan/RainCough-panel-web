package main

import (
	"encoding/json"
	"net/http"

	"raincough/internal/core"
)

// 全局插件市场(main 中初始化)。
var globalStore *core.Store

// handleStoreSettings GET/POST /api/store/settings
func (s *server) handleStoreSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"plugin_repo": globalStore.GetConfig().PluginRepo,
			"panel_repo":  globalStore.GetConfig().PanelRepo,
			"has_token":   globalStore.Token() != "",
		})
	case http.MethodPost:
		var b struct {
			PluginRepo core.Repo `json:"plugin_repo"`
			PanelRepo  core.Repo `json:"panel_repo"`
			Token      string    `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		globalStore.Config(core.StoreConfig{PluginRepo: b.PluginRepo, PanelRepo: b.PanelRepo})
		if b.Token != "" {
			if err := globalStore.SetToken(b.Token); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
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