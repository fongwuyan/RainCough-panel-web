package core

import (
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// ---- 系统备份: 任务 CRUD / 校验 / 持久化 / 删除守卫 ----

func TestBackupJobValidation(t *testing.T) {
	ns := newMockNS()
	m := NewBackupManager(ns, nil)

	cases := []struct {
		name    string
		job     BackupJob
		wantErr bool
	}{
		{"空名", BackupJob{Sources: []string{"/tmp"}, Target: "/tmp/out"}, true},
		{"名含路径分隔", BackupJob{Name: "a/b", Sources: []string{"/tmp"}, Target: "/tmp/out"}, true},
		{"相对来源", BackupJob{Name: "j", Sources: []string{"rel/path"}, Target: "/tmp/out"}, true},
		{"无来源", BackupJob{Name: "j", Target: "/tmp/out"}, true},
		{"相对目标", BackupJob{Name: "j", Sources: []string{"/tmp"}, Target: "out"}, true},
		{"合法", BackupJob{Name: "j1", Sources: []string{"/tmp/a", "/tmp/b"}, Target: "/tmp/out"}, false},
	}
	for _, c := range cases {
		err := m.CreateJob(c.job)
		if c.wantErr && err == nil {
			t.Fatalf("[%s] 应被拒绝", c.name)
		}
		if !c.wantErr && err != nil {
			t.Fatalf("[%s] 应通过: %v", c.name, err)
		}
	}

	// 重名
	if err := m.CreateJob(BackupJob{Name: "j1", Sources: []string{"/tmp"}, Target: "/tmp/out"}); err == nil {
		t.Fatal("重名任务应被拒绝")
	}

	jobs := m.ListJobs()
	if len(jobs) != 1 {
		t.Fatalf("任务数应为 1, 实际 %d", len(jobs))
	}
	if jobs[0].Compress != "gz" || jobs[0].Keep != 5 {
		t.Fatalf("默认值错误: %+v", jobs[0])
	}
	if jobs[0].Running {
		t.Fatal("新任务不应处于 running")
	}
	if len(jobs[0].Sources) != 2 {
		t.Fatalf("来源未清洗: %+v", jobs[0].Sources)
	}
}

func TestBackupUpdateMergeAndPersist(t *testing.T) {
	ns := newMockNS()
	m := NewBackupManager(ns, nil)
	if err := m.CreateJob(BackupJob{Name: "j1", Sources: []string{"/tmp/a"}, Target: "/tmp/out"}); err != nil {
		t.Fatalf("create: %v", err)
	}

	// 部分合并: 只改 paused, 其余字段不动
	if err := m.UpdateJob("j1", map[string]interface{}{"paused": true}); err != nil {
		t.Fatalf("update: %v", err)
	}
	j := m.ListJobs()[0]
	if !j.Paused {
		t.Fatal("paused 未生效")
	}
	if j.Target != filepath.Clean("/tmp/out") || len(j.Sources) != 1 {
		t.Fatalf("合并破坏了其他字段: %+v", j)
	}

	// 拒绝改名 / 不存在的任务
	if err := m.UpdateJob("j1", map[string]interface{}{"name": "other"}); err == nil {
		t.Fatal("重命名应被拒绝")
	}
	if err := m.UpdateJob("nope", map[string]interface{}{"paused": true}); err == nil {
		t.Fatal("不存在的任务应报错")
	}

	// 持久化: 同一 ns 重新加载
	m2 := NewBackupManager(ns, nil)
	jobs := m2.ListJobs()
	if len(jobs) != 1 || !jobs[0].Paused || jobs[0].Name != "j1" {
		t.Fatalf("持久化回读失败: %+v", jobs)
	}

	// 删除
	if err := m2.DeleteJob("j1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if len(m2.ListJobs()) != 0 {
		t.Fatal("删除后仍有任务")
	}
	if err := m2.DeleteJob("j1"); err == nil {
		t.Fatal("重复删除应报错")
	}
}

func TestBackupArchiveNaming(t *testing.T) {
	ts := time.Date(2026, 9, 28, 10, 30, 0, 0, time.Local)
	name := archiveName("my job/备份", "gz", ts)
	if strings.ContainsAny(name, `/\`) {
		t.Fatalf("归档名不应含路径分隔符: %s", name)
	}
	if !strings.HasSuffix(name, ".tar.gz") {
		t.Fatalf("gz 后缀错误: %s", name)
	}
	if !strings.Contains(name, "20260928-103000") {
		t.Fatalf("时间戳缺失: %s", name)
	}
	if n := archiveName("x", "none", ts); !strings.HasSuffix(n, ".tar") {
		t.Fatalf("none 应产出 .tar: %s", n)
	}
}

func TestBackupDeleteRunGuard(t *testing.T) {
	ns := newMockNS()
	m := NewBackupManager(ns, nil)
	base := t.TempDir()
	out := filepath.Join(base, "out")
	if err := m.CreateJob(BackupJob{Name: "j1", Sources: []string{base}, Target: out}); err != nil {
		t.Fatalf("create: %v", err)
	}
	// 目标目录之外 / 扩展名不符: 一律拒绝
	for _, bad := range []string{
		"/etc/passwd",                                  // 任意系统路径
		filepath.Join(base, "evil.tar.gz"),             // 目标目录之外
		filepath.Join(out, "..", "evil2.tar.gz"),       // 归一化后仍在目标之外
		filepath.Join(out, "notes.txt"),                // 目标之内但非归档
	} {
		if err := m.DeleteRun(bad); err == nil {
			t.Fatalf("应拒绝删除: %s", bad)
		}
	}
}

func TestBackupRunRejectsUnknownJob(t *testing.T) {
	m := NewBackupManager(newMockNS(), nil)
	if err := m.RunNow("ghost"); err == nil {
		t.Fatal("不存在的任务不应能启动")
	}
}

func TestBackupScheduleTickLogic(t *testing.T) {
	ns := newMockNS()
	m := NewBackupManager(ns, nil)
	if err := m.CreateJob(BackupJob{
		Name: "sched", Sources: []string{"/tmp"}, Target: t.TempDir(), IntervalHours: 6,
	}); err != nil {
		t.Fatalf("create: %v", err)
	}
	// 尚未运行过 → 应被视为到期(LastRun 为 nil)
	m.mu.Lock()
	var due []string
	now := time.Now().Unix()
	for _, j := range m.jobs {
		if j.Paused || j.IntervalHours <= 0 {
			continue
		}
		if j.LastRun == nil || now-j.LastRun.Start >= int64(j.IntervalHours)*3600 {
			due = append(due, j.Name)
		}
	}
	m.mu.Unlock()
	if len(due) != 1 || due[0] != "sched" {
		t.Fatalf("到期判断错误: %v", due)
	}
	// 暂停后不再到期
	if err := m.UpdateJob("sched", map[string]interface{}{"paused": true}); err != nil {
		t.Fatalf("update: %v", err)
	}
	m.mu.Lock()
	due = nil
	for _, j := range m.jobs {
		if j.Paused || j.IntervalHours <= 0 {
			continue
		}
		due = append(due, j.Name)
	}
	m.mu.Unlock()
	if len(due) != 0 {
		t.Fatalf("暂停的任务不应到期: %v", due)
	}
}
