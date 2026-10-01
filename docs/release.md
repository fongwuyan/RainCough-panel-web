# 发布流程（面板）

## 铁律

1. **版本号只在明确确认后递增**（用户说了才改），代码里不做任何自动 bump。
2. 一个版本 = 一个 git tag `v<版本>` + 一个同名 Release + 一个资产
   `raincough-linux-x86_64-<版本>.tar.gz`。
3. 资产内容：`raincough`(二进制) + `VERSION` + `install.sh` + `CHANGELOG.md` + `public/`。
4. 发布后 tag 不再移动；如需修正，发下一个版本（v1.0.1）。

## 步骤

```bash
# 1) 改版本号(仅在被要求时)
echo 1.0.1 > VERSION

# 2) 写更新日志
$EDITOR CHANGELOG.md          # 顶部新增 ## v1.0.1 — YYYY-MM-DD 分节

# 3) 构建资产(Windows 交叉编译示例)
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o dist-build/raincough-1.0.1/raincough ./cmd/raincough
cp VERSION install.sh CHANGELOG.md dist-build/raincough-1.0.1/
cp -r public dist-build/raincough-1.0.1/
tar -czf dist/raincough-linux-x86_64-1.0.1.tar.gz -C dist-build raincough-1.0.1
md5sum dist/raincough-linux-x86_64-1.0.1.tar.gz

# 4) 提交 + 打 tag + 推送(带重试: 直连 github.com 偶发超时)
git add VERSION CHANGELOG.md releases.json && git commit -m "发布 v1.0.1"
git tag v1.0.1 && git push <url> main:main main:master && git push <url> v1.0.1

# 5) 建 Release 并上传资产(GitHub API)
#    POST /repos/fongwuyan/RainCough-panel-web/releases            {tag_name:"v1.0.1",...}
#    POST https://uploads.github.com/repos/.../releases/<id>/assets?name=<资产名>
#    (注意: Release 响应里的 upload_url 在 PowerShell 里可能取空, 直接用 release id 拼)

# 6) 更新 releases.json 的条目(版本/tag/资产/大小/md5/安装命令) 并推送
```

## 安装命令的来源

`install.sh` 的版本解析：`RC_VERSION` → tag 内嵌 `PANEL_VERSION` → `latest`（查 `releases/latest`）。
tag 里的 `install.sh` 与资产同名版本，故 `…/v<版本>/install.sh` 永远装该版本。
清单与命令表见 `releases.json` 与 `docs/install.md`，面板内「面板更新」悬浮窗会展示本版本命令。