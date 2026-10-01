# 发布流程（面板）

## 铁律

1. **版本号只在明确确认后递增**（用户说了才改），代码里不做任何自动 bump。
2. 一个版本 = 一个 git tag `v<版本>` + 一个同名 Release + 一个资产
   `raincough-linux-x86_64-<版本>.tar.gz`。
3. 资产内容：`raincough`(二进制) + `VERSION` + `install.sh` + `CHANGELOG.md` + `public/`。
4. **发布后 tag 不再移动**；如需修正，发下一个版本（v1.0.1）。
   例外仅一次：v1.0.0 首个基线资产曾重发（tag 移到修正提交，版本号仍 1.0.0），此后按本规则执行。
5. 下载源：面板更新与安装脚本都**先直连 github.com，失败自动回退只读镜像**
   `https://gh-proxy.com/`（`RC_GH_MIRROR` 可覆盖；设为 `off`/`none`/`-` 关闭回退）。
   国内主机直连 `github.com` 下载资产常 TLS 超时，故回退是必需的，不要删。

## 步骤

```bash
# 1) 改版本号(仅在被要求时) —— 两处必须一致: VERSION 与 install.sh 的内嵌版本
echo 1.0.1 > VERSION
sed -i 's/^RC_PANEL_VERSION=.*/RC_PANEL_VERSION="${RC_VERSION:-1.0.1}"/' install.sh
grep -n '^RC_PANEL_VERSION' install.sh   # 确认内嵌版本 == VERSION
#   理由: 内嵌版本决定 …/v<版本>/install.sh 装哪一版; 忘了改就会装成上一版。
#   若内嵌版本缺失/非 x.y.z, install.sh 会退回「解析最新 Release」。

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

`install.sh` 的版本解析：`RC_VERSION` → 内嵌 `RC_PANEL_VERSION`（= 该 tag 的版本，发布时写入）
→ 查 `releases/latest`（仅当前两者都不是合法 `x.y.z` 时）。
故 `…/v<版本>/install.sh` 永远装该版本（tag 冻结），`…/main/install.sh` 装最近一次发布的版本。
清单与命令表见 `releases.json` 与 `docs/install.md`，面板内「面板更新」悬浮窗会展示本版本命令。

发布后必须实测一次：`bash -n install.sh` 语法 + `RC_VERSION=<版本> bash install.sh` 走到下载步骤
（资产名/pinned tag 是否真存在，只靠肉眼容易漏）。