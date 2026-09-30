package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"raincough/internal/config"
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
// 附带 source(github|local) 与 has_token: local 说明仓库清单拉取失败已回退到
// 本机扫描, 前端据此明确提示"当前仅显示已装插件、无法安装新插件"。
func (s *server) handleStoreRegistry(w http.ResponseWriter, r *http.Request) {
	plugins, source, err := globalStore.RegistryWithSource()
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"plugins": plugins, "source": source, "has_token": globalStore.Token() != "",
	})
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
	status, err := globalStore.InstallPlugin(b.Name, globalTasks)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": status, "message": "已重新安装(更新)"})
}

// handleStoreProject GET /api/store/project/status + POST /api/store/project/install
// 面板自更新【未实现】: 运行中的二进制无法就地替换, 更新必须走部署脚本。
// 旧版返回伪造的 current=v1.0.0 / latest=v1.0.0 / up_to_date=true / 环境检查数据,
// 前端据此显示"环境不满足, 将自动拉取离线环境包" "已开始更新…服务将重启" 等不实信息
// (2026-09-28 审计定位)。现在只回真实版本与明确说明; check / update-info 已无调用方,
// 归 404 而不是继续返回假数据。
func (s *server) handleStoreProject(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/store/project/")
	repo := globalStore.GetConfig().PanelRepo
	repoStr := repo.Owner + "/" + repo.Repo
	switch sub {
	case "status":
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"implemented": false,
			"current":      config.Version,
			"repo":         repoStr,
			"message":      "面板更新通过部署脚本完成(运行中的二进制不可就地替换)",
			"howto": "部署机: git pull -> go build -> npm run build -> 同步面板与测试机 -> systemctl restart raincough",
		})
	case "install":
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status": false, "implemented": false, "deferred": true,
			"message": "面板更新请通过部署脚本完成(运行中不可自升级)",
		})
	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unknown"})
	}
}
