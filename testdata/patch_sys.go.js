const fs = require('fs');
const f = 'E:/jiaob/RainCough-Core/cmd/raincough/sys.go';
let s = fs.readFileSync(f, 'utf8');
// 在 "func pingTCP" 前插入缺失的 handlePluginsHealth 结尾 + errSuffix
const anchor = 'func pingTCP(port int) bool {';
const idx = s.indexOf(anchor);
if (idx < 0) { console.log('anchor missing'); process.exit(1); }
// 找到该函数前最近的 "}\n\n" (for 循环闭合)
const before = s.slice(0, idx);
const body =
  '\n\t// \u603b\u6c47\n' +
  '\talive := 0\n\thealthy := 0\n' +
  '\tfor _, it := range items {\n' +
  '\t\tif it.Alive {\n\t\t\talive++\n\t\t}\n' +
  '\t\tif it.Alive && it.HealthHTTP {\n\t\t\thealthy++\n\t\t}\n\t}\n' +
  '\twriteJSON(w, http.StatusOK, map[string]interface{}{\n' +
  '\t\t"total": len(items),\n' +
  '\t\t"alive": alive,\n' +
  '\t\t"healthy": healthy,\n' +
  '\t\t"items": items,\n' +
  '\t\t"checked_at": time.Now().Unix(),\n\t})\n' +
  '}\n\n' +
  'func errSuffix(s string) string {\n' +
  '\tif s == "" {\n\t\treturn ""\n\t}\n' +
  '\treturn ":\u300c" + s + "\u300d"\n}\n\n';
s = before + body + s.slice(idx);
fs.writeFileSync(f, s, 'utf8');
console.log('PATCHED');