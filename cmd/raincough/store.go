package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"raincough/internal/auth"
	"raincough/internal/config"
	"raincough/internal/core"
)

// 全局插件市场(main 中初始化)。
var globalStore *core.Store

// globalGate 插件库口令闸门(插件库将改为公开仓库, 用写死口令保护插件内容)。
// 为 nil 表示闸门关闭(RC_STORE_GATE=off), 所有接口直接放行。
var globalGate *auth.StoreGate

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
			"implemented": true,
			"current":     config.Version,
			"repo":        repoStr,
			"message":     "面板更新已支持就地更新: 检查 → 下载并应用 → 由你确认是否立即重启",
			"howto":       "面板内: 侧边栏标题右侧 ↓ → 检查更新 → 下载并应用 → 立即重启; 命令行等价: curl -fsSL https://gh-proxy.com/https://raw.githubusercontent.com/<面板仓>/v<版本>/install.sh | bash",
		})
	case "install":
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status": false, "implemented": false, "deferred": true,
			"message": "请用 /api/panel/update/apply 走手动更新(检查 → 应用 → 确认重启)",
		})
	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unknown"})
	}
}
