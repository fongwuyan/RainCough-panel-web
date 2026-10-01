package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"raincough/internal/core"
)

// ---- 系统扩展的后端进程 ----
//
// 扩展清单(extension.json)可以声明 backend{lang,exec} 与 interfaces[]:
// 声明了 backend 的扩展在安装后由这里生成 systemd 单元 rc-ext-<name>.service 并启用,
// 后端进程连到接口库(pluginx)预建的 UDS 端点(端点写在扩展目录的 .rc.endpoint 里)注册接口;
// 卸载时停单元、删单元、摘接口注册。
//
// 与插件一致: 后端只管跑, 面板不托管它的生命周期; 面板重启不影响后端。

// extUnitName 扩展后端单元名。
func extUnitName(name string) string { return "rc-ext-" + name + ".service" }

// extUnitPath 单元文件路径。
func extUnitPath(name string) string {
	return filepath.Join("/etc/systemd/system", extUnitName(name))
}

// privRun 以特权执行一条固定命令(扩展后端管理只用固定模板, 不接受任意 shell)。
// root 直接跑; 否则用配置的 sudo 密码(宿主)或 sudo -n(免密)。
func (s *server) privRun(args ...string) (string, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("空命令")
	}
	if os.Geteuid() == 0 {
		out, err := exec.Command(args[0], args[1:]...).CombinedOutput()
		return string(out), err
	}
	var cmd *exec.Cmd
	if s.cfg != nil && s.cfg.SudoPW != "" {
		cmd = exec.Command("sh", "-c", "echo "+shellQuote(s.cfg.SudoPW)+" | sudo -S "+shellJoin(args))
	} else {
		all := append([]string{"-n"}, args...)
		cmd = exec.Command("sudo", all...)
	}
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func shellQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'" }

func shellJoin(args []string) string {
	parts := make([]string, 0, len(args))
	for _, a := range args {
		parts = append(parts, shellQuote(a))
	}
	return strings.Join(parts, " ")
}

// extBackendSpec 取已装扩展声明的后端(没有后端返回 nil)。
func extBackendSpec(name string) *core.Extension {
	if globalExt == nil {
		return nil
	}
	ext, ok := globalExt.InstalledByName(name)
	if !ok || !ext.HasBackend() {
		return nil
	}
	return &ext
}

// extBackendUnit 拼单元内容(命令只来自清单, 不接受外部输入)。
func extBackendUnit(ext core.Extension, dir string) string {
	var b strings.Builder
	b.WriteString("[Unit]\n")
	fmt.Fprintf(&b, "Description=RainCough extension backend: %s\n", ext.Name)
	b.WriteString("After=network.target\n\n")
	b.WriteString("[Service]\n")
	b.WriteString("Type=simple\n")
	b.WriteString("User=root\n")
	fmt.Fprintf(&b, "WorkingDirectory=%s\n", dir)
	fmt.Fprintf(&b, "ExecStart=%s\n", strings.Join(ext.Backend.Exec, " "))
	b.WriteString("Restart=always\nRestartSec=5\n")
	fmt.Fprintf(&b, "Environment=RC_EXT_NAME=%s\n", ext.Name)
	fmt.Fprintf(&b, "Environment=RC_EXT_DIR=%s\n", dir)
	b.WriteString("\n[Install]\nWantedBy=multi-user.target\n")
	return b.String()
}

// extBackendUp 生成并启用后端单元(幂等: 每次覆盖单元以跟随清单变化)。
func (s *server) extBackendUp(name string) error {
	ext := extBackendSpec(name)
	if ext == nil {
		return nil // 纯前端扩展: 没有后端要起
	}
	dir := filepath.Join(globalExt.Dir(), name)
	unit := extBackendUnit(*ext, dir)
	tmp, err := os.CreateTemp("", "rc-ext-unit-*.service")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.WriteString(unit); err != nil {
		tmp.Close()
		return err
	}
	tmp.Close()

	if out, err := s.privRun("install", "-m", "0644", tmp.Name(), extUnitPath(name)); err != nil {
		return fmt.Errorf("写单元失败: %s", strings.TrimSpace(out))
	}
	_, _ = s.privRun("systemctl", "daemon-reload")
	// 注意: 这里必须是 enable + restart，不能是 enable --now。
	// enable --now 对"已经在运行"的单元是空操作 —— 更新扩展（换掉 server.py / 产物）后
	// 旧进程会继续跑旧代码，界面上还以为更新生效了（2026-10-01 实测：更新后
	// ExecMainStartTimestamp 不变、接口返回仍是旧字段）。restart 对未运行的单元等于启动，
	// 对已运行的就是真正换上新代码。
	if out, err := s.privRun("systemctl", "enable", extUnitName(name)); err != nil {
		return fmt.Errorf("启用后端失败: %s", strings.TrimSpace(out))
	}
	if out, err := s.privRun("systemctl", "restart", extUnitName(name)); err != nil {
		return fmt.Errorf("启动后端失败: %s", strings.TrimSpace(out))
	}
	return nil
}

// extBackendDown 停用并删除后端单元(扩展卸载时调用)。
func (s *server) extBackendDown(name string) error {
	unit := extUnitName(name)
	if _, err := os.Stat(extUnitPath(name)); err != nil {
		// 没有单元文件也不报错: 可能本来就纯前端, 或从未起过
		return nil
	}
	if out, err := s.privRun("systemctl", "disable", "--now", unit); err != nil {
		return fmt.Errorf("停后端失败: %s", strings.TrimSpace(out))
	}
	if out, err := s.privRun("rm", "-f", extUnitPath(name)); err != nil {
		return fmt.Errorf("删单元失败: %s", strings.TrimSpace(out))
	}
	_, _ = s.privRun("systemctl", "daemon-reload")
	return nil
}

// extBackendState 查询后端单元状态(给界面用)。
func (s *server) extBackendState(name string) map[string]interface{} {
	ext := extBackendSpec(name)
	out := map[string]interface{}{"name": name, "has_backend": ext != nil}
	if ext == nil {
		return out
	}
	dir := filepath.Join(globalExt.Dir(), name)
	out["exec"] = strings.Join(ext.Backend.Exec, " ")
	out["lang"] = ext.Backend.Lang
	out["dir"] = dir
	ifaces := []core.ExtIface{}
	if ext.Interfaces != nil {
		ifaces = ext.Interfaces
	}
	out["interfaces"] = ifaces
	out["unit"] = extUnitName(name)
	out["unit_file"] = false
	if _, err := os.Stat(extUnitPath(name)); err == nil {
		out["unit_file"] = true
	}
	active := false
	if _, err := os.Stat(extUnitPath(name)); err == nil {
		if o, err := s.privRun("systemctl", "is-active", extUnitName(name)); err == nil {
			active = strings.TrimSpace(o) == "active"
		} else {
			active = strings.TrimSpace(o) == "active" // is-active 非 0 退出时也会打印状态
		}
	}
	out["active"] = active
	return out
}

// handleExtBackend GET /api/ext/backend[?name=] -> 全部或单个扩展后端状态
func (s *server) handleExtBackend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalExt == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "扩展仓储未初始化"})
		return
	}
	if n := strings.TrimSpace(r.URL.Query().Get("name")); n != "" {
		writeJSON(w, http.StatusOK, s.extBackendState(n))
		return
	}
	list := map[string]interface{}{}
	for _, x := range globalExt.Installed() {
		if x.HasBackend() {
			list[x.Name] = s.extBackendState(x.Name)
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"backends": list})
}

// handleExtBackendRestart POST /api/ext/backend/restart {name}
func (s *server) handleExtBackendRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || strings.TrimSpace(b.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	name := strings.TrimSpace(b.Name)
	if extBackendSpec(name) == nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "该扩展没有声明后端"})
		return
	}
	if err := s.extBackendUp(name); err != nil { // 覆盖单元再启用 = 重启
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	if globalPX != nil {
		globalPX.Reload()
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "name": name, "unit": extUnitName(name)})
}
