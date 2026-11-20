# -*- coding: utf-8 -*-
"""GitHub 下载器后端。

功能：
- 扫描仓库：整仓 archive、Git clone、Release 资产、仓库内全部 blob 文件
- 下载到面板插件目录 downloads/，再通过面板 REST 桥下载到本机/其他机器
- 下载线路：直连 GitHub，或 https://gh-proxy.org/ + 原始 URL
- 可选 GitHub Token（私有仓库 / 提高 API 限额）
"""
import json
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from datetime import datetime

import rcplugin as rc

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DL_ROOT = os.path.join(APP_DIR, "cache", "github")
os.makedirs(DL_ROOT, exist_ok=True)
PROXY = "https://gh-proxy.org/"
UA = "RainCough-GithubDownloader/1.0"
GITHUB_API = "https://api.github.com"
_tasks = {}
_lock = threading.RLock()


def _p(params):
    return params if isinstance(params, dict) else {}


def _err(msg):
    raise rc.RCError(3000, msg)


def _now():
    return int(time.time())


def _safe(s, default="file"):
    s = re.sub(r"[^0-9A-Za-z._\-]+", "_", str(s or "")).strip("._")
    return s[:180] or default


def _github_url(url):
    """只允许 GitHub 相关地址，防止把插件当任意 SSRF 代理。"""
    try:
        u = urllib.parse.urlsplit(url)
    except Exception:
        return False
    host = (u.hostname or "").lower()
    return host in ("github.com", "api.github.com", "raw.githubusercontent.com",
                    "codeload.github.com", "objects.githubusercontent.com") or host.endswith(".githubusercontent.com")


def _with_proxy(url, proxy):
    if not proxy:
        return url
    return PROXY + url


def _headers(token="", proxy=False):
    h = {"User-Agent": UA, "Accept": "application/vnd.github+json"}
    if token and not proxy:
        h["Authorization"] = "Bearer " + token
    return h


def _api(path, token="", timeout=30):
    url = GITHUB_API + path
    req = urllib.request.Request(url, headers=_headers(token))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw.decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        if e.code == 401:
            _err("GitHub Token 无效或已过期")
        if e.code == 404:
            _err("仓库不存在，或 Token 无权限访问")
        if e.code == 403 and "rate limit" in body.lower():
            _err("GitHub API 限流，请填写 Token 后重试")
        _err("GitHub API HTTP %s: %s" % (e.code, body))
    except Exception as e:
        _err("连接 GitHub API 失败: %s" % str(e)[:160])


def _parse_repo(url):
    raw = str(url or "").strip()
    m = re.match(r"^(?:https?://)?(?:www\.)?github\.com/([^/]+)/([^/#?]+)(/.*)?$", raw, re.I)
    if not m:
        m = re.match(r"^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$", raw, re.I)
        if not m:
            _err("不是有效的 GitHub 仓库链接")
        return m.group(1), m.group(2).replace(".git", ""), ""
    owner, repo, rest = m.group(1), m.group(2).replace(".git", ""), m.group(3) or ""
    ref = ""
    mm = re.match(r"^/(?:tree|blob)/([^/]+)", rest)
    if mm:
        ref = urllib.parse.unquote(mm.group(1))
    return owner, repo, ref


def _archive_url(owner, repo, ref, fmt):
    return "https://github.com/%s/%s/archive/refs/%s/%s.%s" % (
        owner, repo, "heads" if fmt == "zip" else "heads", ref, fmt)


def _raw_url(owner, repo, ref, path):
    return "https://raw.githubusercontent.com/%s/%s/%s/%s" % (
        owner, repo, urllib.parse.quote(ref, safe=""), urllib.parse.quote(path, safe="/"))


@rc.interface("ghdl.info")
def ghdl_info(params):
    return {"ok": True, "name": "GithubDownloader", "version": "1.0.0",
            "root": DL_ROOT, "proxy": PROXY}


@rc.interface("ghdl.scan")
def ghdl_scan(params):
    url = str(_p(params).get("url") or "").strip()
    token = str(_p(params).get("token") or "").strip()
    owner, repo, initial_ref = _parse_repo(url)
    info = _api("/repos/%s/%s" % (owner, repo), token)
    default = info.get("default_branch") or "main"
    ref = initial_ref or default

    # 分支 / Tag（最多 100 个，避免接口爆炸）
    branches, tags = [], []
    try:
        for b in _api("/repos/%s/%s/branches?per_page=100" % (owner, repo), token):
            if b.get("name"):
                branches.append(b["name"])
    except Exception:
        pass
    try:
        for t in _api("/repos/%s/%s/tags?per_page=100" % (owner, repo), token):
            if t.get("name"):
                tags.append(t["name"])
    except Exception:
        pass
    if default not in branches:
        branches.insert(0, default)
    if ref not in branches and ref not in tags:
        tags.insert(0, ref)

    archives = []
    seen_archive = set()
    ref_kinds = []
    for r in [ref] + branches[:20] + tags[:20]:
        kind = "heads" if (r in branches or r == default) else "tags"
        if r and (r, kind) not in seen_archive:
            seen_archive.add((r, kind)); ref_kinds.append((r, kind))
    for r, kind in ref_kinds:
        for fmt in ("zip", "tar.gz"):
            suffix = "tar.gz" if fmt == "tar.gz" else "zip"
            archives.append({
                "kind": "archive", "ref": r, "format": fmt,
                "name": "%s-%s-%s.%s" % (owner, repo, _safe(r, "ref"), suffix),
                "url": "https://github.com/%s/%s/archive/refs/%s/%s.%s" % (
                    owner, repo, kind, urllib.parse.quote(r, safe=""), fmt),
                "title": "整仓 %s · %s" % (r, fmt.upper()),
            })

    releases = []
    try:
        rels = _api("/repos/%s/%s/releases?per_page=30" % (owner, repo), token)
        for rel in rels:
            assets = []
            for a in rel.get("assets") or []:
                assets.append({
                    "kind": "asset", "name": a.get("name") or ("asset-%s" % a.get("id")),
                    "size": int(a.get("size") or 0),
                    "url": a.get("browser_download_url") or "",
                    "content_type": a.get("content_type") or "",
                    "download_count": a.get("download_count") or 0,
                })
            releases.append({
                "tag": rel.get("tag_name") or "", "name": rel.get("name") or rel.get("tag_name") or "",
                "published": rel.get("published_at") or "", "prerelease": bool(rel.get("prerelease")),
                "assets": assets,
                "zip": "https://github.com/%s/%s/archive/refs/tags/%s.zip" % (owner, repo, urllib.parse.quote(str(rel.get("tag_name") or ""), safe="")),
                "targz": "https://github.com/%s/%s/archive/refs/tags/%s.tar.gz" % (owner, repo, urllib.parse.quote(str(rel.get("tag_name") or ""), safe="")),
            })
    except Exception:
        pass

    files, truncated = [], False
    try:
        tree = _api("/repos/%s/%s/git/trees/%s?recursive=1" % (
            owner, repo, urllib.parse.quote(ref, safe="")), token)
        truncated = bool(tree.get("truncated"))
        for e in tree.get("tree") or []:
            if e.get("type") != "blob":
                continue
            p = e.get("path") or ""
            if not p:
                continue
            files.append({
                "kind": "file", "path": p, "name": p,
                "size": int(e.get("size") or 0),
                "url": _raw_url(owner, repo, ref, p),
            })
        files.sort(key=lambda x: x["path"].lower())
        if len(files) > 5000:
            files = files[:5000]
            truncated = True
    except Exception:
        pass

    return {
        "ok": True,
        "repo": {
            "owner": owner, "name": repo, "full_name": info.get("full_name") or (owner + "/" + repo),
            "description": info.get("description") or "",
            "default_branch": default, "ref": ref,
            "stars": info.get("stargazers_count") or 0,
            "forks": info.get("forks_count") or 0,
            "private": bool(info.get("private")),
            "html_url": info.get("html_url") or "",
        },
        "branches": branches, "tags": tags,
        "archives": archives,
        "git": {
            "url": "https://github.com/%s/%s.git" % (owner, repo),
            "ref": ref, "default_branch": default,
        },
        "releases": releases,
        "files": files,
        "truncated": truncated,
        "warnings": ["文件树超过 5000 条，已截断"] if truncated else [],
    }


def _task_public(t):
    return {k: v for k, v in t.items() if k not in ("thread", "cancel", "token", "proc")}


def _new_task(name, kind):
    tid = "gh_" + uuid.uuid4().hex[:12]
    t = {"id": tid, "name": name or "download", "kind": kind,
         "status": "queued", "progress": 0, "total": 0, "done": 0,
         "speed": 0, "path": "", "error": "", "created": _now(),
         "started": 0, "finished": 0, "url": ""}
    _tasks[tid] = t
    return t


def _download_worker(t, url, dest, token, proxy):
    t["status"] = "running"; t["started"] = _now()
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    part = dest + ".part"
    resume = os.path.getsize(part) if os.path.isfile(part) else 0
    headers = _headers(token, proxy)
    if resume:
        headers["Range"] = "bytes=%d-" % resume
    real = _with_proxy(url, proxy)
    try:
        req = urllib.request.Request(real, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as r:
            total = int(r.headers.get("Content-Length") or 0)
            if r.status == 206:
                total += resume
            elif resume and r.status == 200:
                resume = 0
            t["total"] = total
            t["done"] = resume
            mode = "ab" if resume else "wb"
            start = time.time()
            base_done = resume
            with open(part, mode) as f:
                while True:
                    if t["cancel"].is_set():
                        t["status"] = "canceled"; t["finished"] = _now()
                        return
                    chunk = r.read(1024 * 128)
                    if not chunk:
                        break
                    f.write(chunk)
                    t["done"] += len(chunk)
                    t["progress"] = int(t["done"] * 100 / total) if total else 0
                    el = max(time.time() - start, 0.001)
                    t["speed"] = int((t["done"] - base_done) / el)
        os.replace(part, dest)
        t["path"] = dest
        t["progress"] = 100
        t["status"] = "done"; t["finished"] = _now()
    except Exception as e:
        if t["cancel"].is_set():
            t["status"] = "canceled"
        else:
            t["status"] = "error"; t["error"] = str(e)[:300]
        t["finished"] = _now()


def _git_worker(t, url, ref, dest, token, proxy):
    t["status"] = "running"; t["started"] = _now()
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    real = _with_proxy(url, proxy)
    # Token 通过 URL 注入只用于直连；代理线路不携带凭据。
    if token and not proxy:
        real = real.replace("https://", "https://x-access-token:%s@" % urllib.parse.quote(token, safe=""), 1)
    cmd = ["git", "clone", "--depth", "1"]
    if ref:
        cmd += ["--branch", ref, "--single-branch"]
    cmd += [real, dest]
    t["total"] = 100
    try:
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                             text=True, bufsize=1)
        t["proc"] = p
        lines = []
        for line in p.stdout:
            lines.append(line.rstrip())
            t["progress"] = min(90, t["progress"] + 1)
            if t["cancel"].is_set():
                p.terminate()
                break
        code = p.wait()
        if t["cancel"].is_set():
            t["status"] = "canceled"
        elif code != 0:
            t["status"] = "error"; t["error"] = "\n".join(lines[-8:])[:500]
        else:
            t["path"] = dest; t["progress"] = 100; t["status"] = "done"
    except Exception as e:
        t["status"] = "error"; t["error"] = str(e)[:300]
    t["finished"] = _now()


@rc.interface("ghdl.start")
def ghdl_start(params):
    p = _p(params)
    items = p.get("items") or []
    if not isinstance(items, list) or not items:
        _err("没有选择下载项")
    token = str(p.get("token") or "").strip()
    proxy = bool(p.get("proxy"))
    owner, repo, _ = _parse_repo(p.get("repo_url") or p.get("url") or "https://github.com/x/x")
    base = os.path.join(DL_ROOT, _safe(owner), _safe(repo))
    out = []
    for item in items[:200]:
        if not isinstance(item, dict):
            continue
        kind = item.get("kind") or "file"
        name = item.get("name") or item.get("path") or "download"
        url = item.get("url") or ""
        if kind == "git":
            ref = item.get("ref") or ""
            dest = os.path.join(base, _safe(name or (repo + "-git")))
            t = _new_task(name or (repo + "-git"), "git")
            t["url"] = _with_proxy(url, proxy)
            t["thread"] = threading.Thread(
                target=_git_worker, args=(t, url, ref, dest, token, proxy), daemon=True)
        else:
            if not _github_url(url) and not url.startswith(PROXY):
                continue
            dest = os.path.join(base, _safe(name))
            n = 2
            while os.path.exists(dest) or os.path.exists(dest + ".part"):
                root, ext = os.path.splitext(_safe(name))
                dest = os.path.join(base, "%s_%d%s" % (root, n, ext)); n += 1
            t = _new_task(name, kind)
            t["url"] = _with_proxy(url, proxy)
            t["thread"] = threading.Thread(
                target=_download_worker, args=(t, url, dest, token, proxy), daemon=True)
        t["cancel"] = threading.Event()
        t["thread"].start()
        out.append(_task_public(t))
    if not out:
        _err("没有可下载的 GitHub 地址")
    return {"ok": True, "tasks": out}


@rc.interface("ghdl.tasks")
def ghdl_tasks(params):
    with _lock:
        return {"ok": True, "tasks": [_task_public(t) for t in sorted(
            _tasks.values(), key=lambda x: x.get("created", 0), reverse=True)[:200]]}


@rc.interface("ghdl.cancel")
def ghdl_cancel(params):
    tid = str(_p(params).get("tid") or "")
    t = _tasks.get(tid)
    if not t:
        _err("任务不存在")
    try:
        t["cancel"].set()
    except Exception:
        pass
    return {"ok": True}


@rc.interface("ghdl.file")
def ghdl_file(params):
    tid = str(_p(params).get("tid") or "")
    t = _tasks.get(tid)
    if not t:
        _err("任务不存在")
    if t.get("status") != "done" or not t.get("path"):
        _err("任务尚未完成")
    path = t["path"]
    if os.path.isdir(path):
        zip_path = path.rstrip("/") + ".zip"
        if not os.path.isfile(zip_path) or os.path.getmtime(zip_path) < os.path.getmtime(path):
            shutil.make_archive(path.rstrip("/"), "zip", path)
        path = zip_path
    rel = os.path.relpath(path, DL_ROOT).replace("\\", "/")
    return {"ok": True, "file": "/api/plugins/GithubDownloader/cache/github/" + urllib.parse.quote(rel),
            "name": os.path.basename(path), "size": os.path.getsize(path)}


if __name__ == "__main__":
    rc.serve(
        endpoint=os.environ.get("RC_ENDPOINT", ""),
        name="GithubDownloader",
        version="1.0.0",
        manifest={"label": "GitHub 下载器",
                  "description": "扫描并下载 GitHub 整仓、Git 克隆、Release 资产和仓库文件"},
        frontend={"pages": [{"path": "", "title": "GitHub 下载器"}]},
        iface_ids=None,
        plugin_dir=os.path.dirname(os.path.abspath(__file__)),
    )
