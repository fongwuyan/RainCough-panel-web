package main

// 插件「面板内直接安装」的上传接口
//
// ★ 与「从仓库安装」完全是两套逻辑:
//   POST /api/store/plugin/install  {name}         → 从 GitHub 仓库拉整仓 zipball 提取
//   POST /api/store/plugin/upload   multipart 包    → 本地插件包直接装(本文件)
//
// 为什么要两套: 前者适合官方插件库(有 registry.json 与版本管理), 后者适合
// 第三方/自研/离线环境的插件 —— 用户手上就一个 .zip/.tar.gz, 不该被迫先进仓库。
//
// 保护: 同样受插件库口令闸门约束(装插件属于"获取插件内容")。
// 上传大小: 上限 core.PluginPackMaxBytes(128MB), 超限直接断开, 不落盘。

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"raincough/internal/core"
)

// handleStorePluginUpload POST /api/store/plugin/upload
//
// form-data:
//
//	file  插件包(zip / tar.gz / tgz / tar), 必填
//
// 响应: {ok:true, task:"<任务id>", name:"<插件名>", replaced:bool, ...}
// 前端随后轮询 /api/tasks 看进度(与其他安装一样走任务队列)。
func (s *server) handleStorePluginUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	if gateLocked(w, r) {
		return
	}
	if globalStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "环境未就绪"})
		return
	}

	// 限制请求体大小(防止磁盘被灌满); multipart 边界/头部额外留 1MB 余量
	maxBody := int64(core.PluginPackMaxBytes) + (1 << 20)
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)

	if err := r.ParseMultipartForm(8 << 20); err != nil {
		msg := err.Error()
		if strings.Contains(msg, "too large") || strings.Contains(msg, "MaxBytesReader") {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]interface{}{
				"error": fmt.Sprintf("插件包过大(上限 %d MB)", core.PluginPackMaxBytes>>20),
			})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "上传解析失败(需 multipart/form-data, 字段名 file): " + msg,
		})
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	part, hdr, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "缺少 file 字段(插件包)"})
		return
	}
	defer part.Close()

	filename := strings.TrimSpace(hdr.Filename)
	if filename == "" {
		filename = "plugin.zip"
	}
	// 只留 basename: 客户端可能传完整路径(某些浏览器会带 C:\...)
	filename = filepath.Base(strings.ReplaceAll(filename, `\`, "/"))
	lower := strings.ToLower(filename)
	switch {
	case strings.HasSuffix(lower, ".zip"),
		strings.HasSuffix(lower, ".tar.gz"),
		strings.HasSuffix(lower, ".tgz"),
		strings.HasSuffix(lower, ".tar"):
		// ok
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "不支持的包格式(仅 .zip / .tar.gz / .tgz / .tar): " + filename,
		})
		return
	}

	// 落临时文件(安装器会把它 rename/拷贝走, 这里只负责收完整)
	tf, err := os.CreateTemp("", "rc-plugin-upload-*")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "创建临时文件失败: " + err.Error()})
		return
	}
	tmpPath := tf.Name()
	cleanup := func() { _ = os.Remove(tmpPath) }

	written, err := io.Copy(tf, part)
	if cerr := tf.Close(); cerr != nil && err == nil {
		err = cerr
	}
	if err != nil {
		cleanup()
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "接收文件失败: " + err.Error()})
		return
	}
	if written == 0 {
		cleanup()
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "插件包为空"})
		return
	}
	if written > int64(core.PluginPackMaxBytes) {
		cleanup()
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]interface{}{
			"error": fmt.Sprintf("插件包过大(%d MB, 上限 %d MB)", written>>20, core.PluginPackMaxBytes>>20),
		})
		return
	}

	// 同步安装(包已在本地, 无需网络; 128MB 包解压 + 校验通常 1-2 秒, 不必再套异步任务)。
	// 这样能直接把"装上了 / 清单不对"的确切结果返回给用户, 比轮询任务体验好。
	info, err := core.InstallFromPackage(tmpPath, filename, s.cfg.PluginsDir)
	cleanup() // InstallFromPackage 内部已把它移走/拷贝, 这里清残留(幂等)
	if err != nil {
		log.Printf("[store] 本地安装失败 %s: %v", filename, err)
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": err.Error(), "file": filename,
		})
		return
	}

	// 触发重扫: 新插件要立刻出现在侧栏/接口库
	if globalPX != nil {
		globalPX.Reload()
	}
	if globalSUP != nil {
		globalSUP.Rescan()
	}

	log.Printf("[store] 本地安装成功: %s v%s (%d 文件, %.1f MB, 覆盖=%v)",
		info.Name, info.Version, info.Files, float64(info.Bytes)/(1<<20), info.Replaced)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":       true,
		"name":     info.Name,
		"label":    info.Label,
		"version":  info.Version,
		"author":   info.Author,
		"files":    info.Files,
		"bytes":    info.Bytes,
		"replaced": info.Replaced,
		"message":  uploadMessage(info),
	})
}

func uploadMessage(info *core.PluginPackInfo) string {
	verb := "已安装"
	if info.Replaced {
		verb = "已更新"
	}
	return fmt.Sprintf("%s %s v%s(%d 个文件)", verb, info.Label, info.Version, info.Files)
}
