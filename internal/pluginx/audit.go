package pluginx

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
)

// HandleAudit GET /api/audit?plugin=&iface=&caller=&errors=1&limit=
// 返回最近接口调用审计；不记录参数，避免密钥泄露。
func (x *PluginX) HandleAudit(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	plugin := q.Get("plugin")
	iface := q.Get("iface")
	caller := q.Get("caller")
	errorsOnly := q.Get("errors") == "1"
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	x.mu.Lock()
	items := append([]AuditEvent(nil), x.audit...)
	x.mu.Unlock()
	out := make([]AuditEvent, 0, len(items))
	scanned := len(items)
	for _, e := range items {
		if plugin != "" && e.Plugin != plugin {
			continue
		}
		if iface != "" && !strings.Contains(strings.ToLower(e.Interface), strings.ToLower(iface)) {
			continue
		}
		if caller != "" && e.Caller != caller {
			continue
		}
		if errorsOnly && e.Error == "" {
			continue
		}
		out = append(out, e)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Time > out[j].Time })
	if len(out) > limit {
		out = out[:limit]
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": out, "total": len(out), "scanned": scanned})
}
