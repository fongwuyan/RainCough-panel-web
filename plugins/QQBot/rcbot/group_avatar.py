# -*- coding: utf-8 -*-
"""群头像：把 QQ 客户端缓存里"真正的群头像"捞出来，由本机托管。

背景（2026-11-06 实测）：
  · 群头像的 CDN 接口 https://p.qlogo.cn/gh/<群号>/<群主QQ号>/<尺寸>
    对这些群一律返回同一张默认占位图（1657 字节的"两个人"图标），
    换 UA / 加 Referer 也一样 —— 自定义群头像不对外公开。
  · 但 QQ 客户端自己缓存了真实群头像：
        <QQ配置>/nt_data/avatar/group/s_<md5>
  · md5 ↔ 群号 的映射不在磁盘上（在 group_info.db 里，但那个库被 QQ 加密了，
    sqlite 打不开），**却出现在 QQ 进程内存里** —— protobuf 里群号和头像 md5
    是相邻字段。所以做法是：扫内存找"群号字符串"附近的 md5。

流程：
  1. 容器内列出 avatar/group 下的缓存文件（拿到 md5 名单）
  2. 把扫描脚本送进容器，扫 QQ 进程内存 → 输出 {群号: md5}
  3. 对得上的：docker exec base64 取文件内容 → 写到 media/group_avatars/<群号>.<ext>
  4. 记进 group_avatars 表；会话列表优先用这份本地托管的头像
"""
import base64
import json
import os
import time

from . import logbuf, store, snowluma

# 容器内扫描脚本（自包含，不依赖外部文件）
_SCAN = r'''
import json, os, re, sys, subprocess

AVA_DIR = None
for p in subprocess.run(['sh', '-c',
        'ls -d /app/.config/QQ/nt_qq_*/nt_data/avatar/group 2>/dev/null | head -1'],
        capture_output=True, text=True).stdout.split():
    AVA_DIR = p
if not AVA_DIR:
    print('{}'); sys.exit(0)

names = set()
try:
    for f in os.listdir(AVA_DIR):
        if f.startswith('s_') and len(f) == 34:
            names.add(f[2:])
except Exception:
    pass
if not names:
    print('{}'); sys.exit(0)

targets = [t.strip() for t in (sys.argv[1] if len(sys.argv) > 1 else '').split(',') if t.strip()]
need = set(targets)
res = {}
GID_RE = re.compile(rb'(?<![0-9])([0-9]{9,11})(?![0-9])')
HEX_RE = re.compile(rb'[0-9a-f]{32}')


def scan(pid):
    """扫一个进程的内存：找"头像 md5"附近有没有群号。

    ★ 方向很重要：先找 md5（缓存文件名里的那个），再在它前后找群号。
      反过来（先找群号）会因为群号在内存里出现得太多而匹配到错误的 md5。
    """
    try:
        maps = open('/proc/%d/maps' % pid).read().splitlines()
    except Exception:
        return
    regions = []
    for m in maps:
        parts = m.split()
        if len(parts) < 2 or 'r' not in parts[1]:
            continue
        rng = parts[0]
        if '-' not in rng:
            continue
        a, b = rng.split('-')
        try:
            start, end = int(a, 16), int(b, 16)
        except Exception:
            continue
        if end - start > 200 * 1024 * 1024:
            continue
        regions.append((start, end))
    try:
        mem = open('/proc/%d/mem' % pid, 'rb', 0)
    except Exception:
        return
    for start, end in regions:
        if not need:
            break
        try:
            mem.seek(start)
            data = mem.read(end - start)
        except Exception:
            continue
        for m in HEX_RE.finditer(data):
            h = m.group(0).decode()
            if h not in names:
                continue
            lo = max(0, m.start() - 512)
            hi = min(len(data), m.end() + 512)
            for g in GID_RE.finditer(data[lo:hi]):
                gs = g.group(1).decode()
                if gs in targets and gs not in res:
                    res[gs] = h
                    need.discard(gs)
                    break
    mem.close()


pids = subprocess.run(['pgrep', '-f', 'qq'], capture_output=True, text=True).stdout.split()
for pid in pids:
    if not pid.isdigit() or int(pid) == os.getpid():
        continue
    cmd = ''
    try:
        cmd = open('/proc/%s/cmdline' % pid, 'rb').read().replace(b'\x00', b' ').decode('utf-8', 'ignore')
    except Exception:
        pass
    scan(int(pid))
    sys.stderr.write('scanned pid %s %s -> %d\n' % (pid, cmd[:60].strip(), len(res)))
    if not need:
        break
print(json.dumps({'dir': AVA_DIR, 'names': sorted(names), 'map': res}))
'''

_DIR = '/opt/rcbot/media/group_avatars'


def _media_root():
    try:
        from . import chats
        return chats.media_root()
    except Exception:
        return '/opt/rcbot/media'


async def _ensure_table():
    if store._db is None:
        return
    await store._db.execute(
        'CREATE TABLE IF NOT EXISTS group_avatars ('
        ' group_id TEXT PRIMARY KEY, md5 TEXT DEFAULT \'\','
        ' rel TEXT DEFAULT \'\', bytes INTEGER DEFAULT 0, mime TEXT DEFAULT \'\','
        ' updated_at INTEGER DEFAULT 0)')
    await store._db.commit()


async def local_map():
    """本地已托管的群头像：{群号: 绝对路径}。"""
    out = {}
    try:
        await _ensure_table()
        cur = await store._db.execute(
            'SELECT group_id, rel FROM group_avatars WHERE rel<>""')
        for r in await cur.fetchall():
            out[str(r['group_id'])] = os.path.join(_media_root(), r['rel'])
    except Exception as e:
        logbuf.debug('avatar', '读本地群头像失败：%s' % str(e)[:120])
    return out


def _sniff(data):
    if data[:3] == b'\xff\xd8\xff':
        return '.jpg', 'image/jpeg'
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return '.png', 'image/png'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return '.gif', 'image/gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return '.webp', 'image/webp'
    return '.jpg', 'image/jpeg'


async def sync(groups, timeout=180):
    """同步群头像：扫内存找映射 → 把缓存文件复制到本机媒体目录。

    返回 {群号: 绝对路径}（本次新托管的）。
    """
    groups = [str(g).strip() for g in (groups or []) if str(g).strip()]
    if not groups or not snowluma.exists() or store._db is None:
        return {}
    await _ensure_table()

    # 已经有本地副本的跳过
    have = await local_map()
    todo = [g for g in groups if g not in have]
    if not todo:
        return {}

    # 1) 扫描脚本送进容器
    b64 = base64.b64encode(_SCAN.encode('utf-8')).decode()
    rc, o = snowluma.sh(
        "docker exec %s sh -c 'echo %s | base64 -d > /tmp/rc_gavatar_scan.py'"
        % (snowluma.CONTAINER, b64), timeout=40)
    if rc != 0:
        logbuf.warn('avatar', '扫描脚本写入容器失败：%s' % (o or '')[:120])
        return {}

    # 2) 跑扫描
    rc, o = snowluma.sh(
        "docker exec %s python3 /tmp/rc_gavatar_scan.py %s"
        % (snowluma.CONTAINER, ','.join(todo)), timeout=timeout)
    # 输出里混着扫描进度（stderr），倒着找最后一行完整 JSON
    data = None
    for line in reversed((o or '').splitlines()):
        line = line.strip()
        if line.startswith('{') and line.endswith('}'):
            try:
                data = json.loads(line)
            except Exception:
                data = None
            if data:
                break
    if not data:
        logbuf.warn('avatar', '扫描结果解析失败：%s' % (o or '')[:160])
        return {}
    mapping = data.get('map') or {}
    if not mapping:
        logbuf.info('avatar', '内存里没扫到群头像映射（群 %d 个）' % len(todo))
        return {}

    # 3) 把命中的缓存文件复制出来
    root = _media_root()
    out = {}
    for gid, md5 in mapping.items():
        src = '%s/s_%s' % (data.get('dir') or '', md5)
        rc, b64raw = snowluma.sh(
            "docker exec %s base64 %s" % (snowluma.CONTAINER, src), timeout=60)
        if rc != 0 or not b64raw:
            continue
        try:
            raw = base64.b64decode(''.join(b64raw.split()))
        except Exception:
            continue
        if not raw:
            continue
        ext, mime = _sniff(raw)
        rel = 'group_avatars/%s%s' % (gid, ext)
        full = os.path.join(root, rel)
        try:
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, 'wb') as f:
                f.write(raw)
        except Exception as e:
            logbuf.warn('avatar', '群头像落盘失败 %s：%s' % (gid, str(e)[:120]))
            continue
        await store._db.execute(
            'INSERT OR REPLACE INTO group_avatars(group_id, md5, rel, bytes, mime, updated_at)'
            ' VALUES(?,?,?,?,?,?)',
            (gid, md5, rel, len(raw), mime, int(time.time())))
        out[gid] = full
    await store._db.commit()
    if out:
        logbuf.info('avatar', '群头像已托管 %d 个（扫到映射 %d 个）' % (len(out), len(mapping)))
    return out
