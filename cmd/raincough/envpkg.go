package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"raincough/internal/core"
)

// 全局环境包管理器(main 中初始化)。
var globalEnv *core.EnvManager

// defaultDownloader 官方源下载(内网可覆盖 RC_ENVPKG_MIRROR 为镜像前缀)。
func defaultDownloader(url, dest string) error {
	mirror := os.Getenv("RC_ENVPKG_MIRROR")
	finalURL := url
	if mirror != "" {
		finalURL = mirror + url
	}
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Get(finalURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return errHTTPCode(resp.StatusCode)
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, resp.Body)
	return err
}

type httpCodeErr int

func (e httpCodeErr) Error() string {
	return "HTTP " + strconv.Itoa(int(e))
}

func errHTTPCode(code int) error { return httpCodeErr(code) }

// envpkgRecipeList 运行时配方表(静态清单)。
func envpkgRecipeList() []map[string]interface{} {
	return []map[string]interface{}{
		{"type": "node", "label": "Node.js", "versions": []string{"20.12.0", "22.0.0"}},
		{"type": "python", "label": "Python", "versions": []string{"3.11.0", "3.12.0"}},
		{"type": "go", "label": "Go", "versions": []string{"1.22.0", "1.23.0"}},
		{"type": "java", "label": "Java (OpenJDK)", "versions": []string{"17.0.10", "21.0.2"}},
		{"type": "php", "label": "PHP", "versions": []string{"8.2.0", "8.3.0"}},
	}
}

// handleEnvRecipes GET /api/envpkg/recipes
func (s *server) handleEnvRecipes(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"recipes": envpkgRecipeList()})
}

// handleEnvList GET /api/envpkg/envs
func (s *server) handleEnvList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"envs": globalEnv.List()})
}

// handleEnvCatalog GET /api/envpkg/catalog (目录: {catalog: {type: [{label,version,type,installed}]}})
func (s *server) handleEnvCatalog(w http.ResponseWriter, r *http.Request) {
	recipes := envpkgRecipeList()
	catalog := map[string][]map[string]interface{}{}
	for _, rc := range recipes {
		typeName := rc["type"].(string)
		label := rc["label"].(string)
		for _, v := range rc["versions"].([]string) {
			installed := globalEnv.Has(typeName, v)
			catalog[typeName] = append(catalog[typeName], map[string]interface{}{
				"type": typeName, "version": v, "label": label + " " + v,
				"installed": installed,
			})
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"catalog": catalog})
}

// handleEnvInstall POST /api/envpkg/install {type, version}
func (s *server) handleEnvInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Type    string `json:"type"`
		Version string `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if b.Type == "" || b.Version == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "type 与 version 必填"})
		return
	}
	// 用官方源下载器(内网可覆盖为镜像)
	id, err := globalEnv.Install(b.Type, b.Version, defaultDownloader)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"task": id, "status": "queued"})
}

// handleEnvTask GET /api/envpkg/tasks/<id>
func (s *server) handleEnvTask(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Path[len("/api/envpkg/tasks/"):]
	task, ok := globalEnv.TaskStatus(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "任务不存在"})
		return
	}
	writeJSON(w, http.StatusOK, task)
}

// handleEnvUninstall POST /api/envpkg/uninstall {name}
func (s *server) handleEnvUninstall(w http.ResponseWriter, r *http.Request) {
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
	if err := globalEnv.Uninstall(b.Name); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// handleEnvRun POST /api/envpkg/run {name, cmd} — 在指定运行时环境执行命令
func (s *server) handleEnvRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Name string `json:"name"`
		Cmd  string `json:"cmd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	env, ok := globalEnv.EnvRunPrefix(b.Name)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "运行时未安装: " + b.Name})
		return
	}
	out, err := core.RunShell("PATH="+env["PATH"]+" "+b.Cmd, 300)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": err.Error(), "output": out,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "output": out})
}
