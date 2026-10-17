// Package raincough 根包只做一件事: 把前端构建产物内嵌进二进制。
//
// 构建顺序: cd web && npm run build  →  public/  →  go build ./cmd/raincough
// 产物是单文件, 运行时不再需要外部 public/ 目录。
package raincough

import "embed"

//go:embed all:public
var WebFS embed.FS
