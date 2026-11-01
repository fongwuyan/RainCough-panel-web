package main

// 移动端 REST 访问密钥的查看与重置。
//
//	GET  /api/panel/restkey   -> 当前密钥
//	POST /api/panel/restkey   -> 重置(旧值立刻失效, App 要重填)
//
// 鉴权: 走 /api/ 前缀 → 需要登录 session。密钥本身是凭证, 绝不能免登录给人看。

import (
	"log"
	"net/http"

	"raincough/internal/auth"
)

func (s *server) handleRESTKey(w http.ResponseWriter, r *http.Request) {
	if globalAPIKey == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"error":    "访问密钥未启用(可能 RC_REST_KEY=off, 或初始化失败)",
			"required": auth.RESTKeyRequired(),
		})
		return
	}

	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"key":      globalAPIKey.Key(),
			"required": true,
			"header":   auth.RESTKeyHeader,
			"query":    auth.RESTKeyQuery,
		})
	case http.MethodPost:
		k, err := globalAPIKey.Rotate()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		log.Printf("[restkey] 访问密钥已重置, 已配对的 App 需要重新填写")
		writeJSON(w, http.StatusOK, map[string]interface{}{"key": k, "rotated": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "支持 GET 查看 / POST 重置"})
	}
}
