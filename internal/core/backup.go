package core

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ---- 系统备份(目录打包归档 + 保留轮换 + 定时间隔) ----
// 契约(与前端 BackupMain.vue 对齐):
//   GET  jobs -> {jobs:[BackupJob]}   POST create  -> {status:true}
//   POST update {name,...}            POST delete  {name}
//   POST run {name}(进度进任务队列)     GET  runs -> {runs:[BackupRun]}
//   POST runs/delete {file}

// BackupJob 单个备份任务定义。
type BackupJob struct {
	Name          string     `json:"name"`
	Sources       []string   `json:"sources"`
	Target        string     `json:"target"`
	Compress      string     `json:"compress"` // gz | none
	Keep          int        `json:"keep"`
	IntervalHours int        `json:"interval_hours"` // 0 = 仅手动
	Excludes      []string   `json:"excludes"`
	Paused        bool       `json:"paused"`
	Running       bool       `json:"running"`
	LastRun       *BackupRun `json:"last_run,omitempty"`
}

// BackupRun 一次归档记录(运行历史)。
type BackupRun struct {
	Job      string `json:"job"`
	Start    int64  `json:"start"`
	Duration int64  `json:"duration"`
	Size     int64  `json:"size"`
	Status   string `json:"status"` // done | error
	File     string `json:"file"`
	Message  string `json:"message,omitempty"`
}

const (
	bkpJobsKey     = "jobs"
	bkpRunsKey     = "runs"
	bkpRunsMax     = 200
	bkpExecTimeout = 6 * time.Hour
)

// BackupManager 备份管理器(状态持久化在 core_backup namespace)。
type BackupManager struct {
	ns      Namespacelike
	tasks   *TaskStore
	mu      sync.Mutex
	jobs    []BackupJob
	runs    []BackupRun
	runSet  map[string]bool
	stopCh  chan struct{}
	stopped bool
}

// NewBackupManager 创建并加载持久化状态。
func NewBackupManager(ns Namespacelike, tasks *TaskStore) *BackupManager {
	m := &BackupManager{ns: ns, tasks: tasks, runSet: map[string]bool{}}
	m.loadJobs()
	m.loadRuns()
	return m
}

// ---- 持久化 ----

func (m *BackupManager) loadJobs() {
	v, ok, err := m.ns.Get(bkpJobsKey)
	if err != nil || !ok || v == nil {
		return
	}
	if jobs, is := v.([]BackupJob); is {
		m.jobs = jobs
		return
	}
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	var jobs []BackupJob
	if json.Unmarshal(b, &jobs) == nil {
		m.jobs = jobs
	}
}

func (m *BackupManager) loadRuns() {
	v, ok, err := m.ns.Get(bkpRunsKey)
	if err != nil || !ok || v == nil {
		return
	}
	if runs, is := v.([]BackupRun); is {
		m.runs = runs
		return
	}
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	var runs []BackupRun
	if json.Unmarshal(b, &runs) == nil {
		m.runs = runs
	}
}

func (m *BackupManager) saveJobs() { _ = m.ns.Set(bkpJobsKey, m.jobs) }

func (m *BackupManager) saveRuns() { _ = m.ns.Set(bkpRunsKey, m.runs) }

// ---- 任务 CRUD ----

// ListJobs 任务列表(Running 取实时值)。
func (m *BackupManager) ListJobs() []BackupJob {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]BackupJob, len(m.jobs))
	copy(out, m.jobs)
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// isAbsPath 绝对路径判定(Linux 语义 "/" 开头; Windows 上单测 filepath.Clean
// 会把 "/a" 变成 "\a", 故两种前缀都认)。
func isAbsPath(p string) bool {
	return filepath.IsAbs(p) || strings.HasPrefix(p, "/") || strings.HasPrefix(p, `\`)
}

// validateJob 校验任务定义。
func validateJob(j *BackupJob) error {
	j.Name = strings.TrimSpace(j.Name)
	j.Target = strings.TrimSpace(j.Target)
	if j.Name == "" {
		return fmt.Errorf("任务名称不能为空")
	}
	if strings.ContainsAny(j.Name, `/\`) || strings.Contains(j.Name, "..") {
		return fmt.Errorf("任务名称不能包含路径分隔符")
	}
	if len(j.Sources) == 0 {
		return fmt.Errorf("至少需要一个来源路径")
	}
	clean := j.Sources[:0]
	for _, s := range j.Sources {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if !isAbsPath(s) {
			return fmt.Errorf("来源必须是绝对路径: %s", s)
		}
		clean = append(clean, filepath.Clean(s))
	}
	j.Sources = clean
	if len(j.Sources) == 0 {
		return fmt.Errorf("至少需要一个来源路径")
	}
	if j.Target == "" {
		return fmt.Errorf("目标目录不能为空")
	}
	if !isAbsPath(j.Target) {
		return fmt.Errorf("目标目录必须是绝对路径")
	}
	j.Target = filepath.Clean(j.Target)
	if j.Compress != "none" {
		j.Compress = "gz"
	}
	if j.Keep < 1 {
		j.Keep = 5
	}
	if j.IntervalHours < 0 {
		j.IntervalHours = 0
	}
	return nil
}

// CreateJob 新建任务。
func (m *BackupManager) CreateJob(in BackupJob) error {
	if err := validateJob(&in); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, j := range m.jobs {
		if j.Name == in.Name {
			return fmt.Errorf("任务已存在: %s", in.Name)
		}
	}
	in.Running = false
	m.jobs = append(m.jobs, in)
	m.saveJobs()
	return nil
}

// UpdateJob 更新任务(部分字段合并; 不支持改名)。
func (m *BackupManager) UpdateJob(name string, patch map[string]interface{}) error {
	if name == "" {
		return fmt.Errorf("缺少任务名")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	idx := -1
	for i, j := range m.jobs {
		if j.Name == name {
			idx = i
			break
		}
	}
	if idx < 0 {
		return fmt.Errorf("任务不存在: %s", name)
	}
	if pn, ok := patch["name"].(string); ok && strings.TrimSpace(pn) != "" && pn != name {
		return fmt.Errorf("不支持重命名任务")
	}
	merged := m.jobs[idx]
	b, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, &merged); err != nil {
		return err
	}
	merged.Name = name
	merged.Running = m.runSet[name]
	if err := validateJob(&merged); err != nil {
		return err
	}
	m.jobs[idx] = merged
	m.saveJobs()
	return nil
}

// DeleteJob 删除任务(不删已产生的归档)。
func (m *BackupManager) DeleteJob(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.runSet[name] {
		return fmt.Errorf("任务正在运行, 请等待完成")
	}
	for i, j := range m.jobs {
		if j.Name == name {
			m.jobs = append(m.jobs[:i], m.jobs[i+1:]...)
			m.saveJobs()
			return nil
		}
	}
	return fmt.Errorf("任务不存在: %s", name)
}

// ---- 运行历史 ----

// Runs 归档运行历史(最新在前)。
func (m *BackupManager) Runs() []BackupRun {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]BackupRun, len(m.runs))
	copy(out, m.runs)
	sort.Slice(out, func(i, j int) bool { return out[i].Start > out[j].Start })
	return out
}

// DeleteRun 删除归档文件(仅允许各任务 target 目录内)。
func (m *BackupManager) DeleteRun(file string) error {
	abs, err := filepath.Abs(file)
	if err != nil {
		return err
	}
	abs = filepath.Clean(abs)
	m.mu.Lock()
	defer m.mu.Unlock()
	allowed := false
	for _, j := range m.jobs {
		t := filepath.Clean(j.Target)
		if abs == t || strings.HasPrefix(abs, t+string(filepath.Separator)) {
			allowed = true
			break
		}
	}
	if !allowed {
		// 孤儿归档: 任务已删除但运行记录仍在 —— 允许按记录路径删除(与旧面板行为一致)
		for _, r := range m.runs {
			if filepath.Clean(r.File) == abs {
				allowed = true
				break
			}
		}
	}
	if !allowed {
		return fmt.Errorf("拒绝删除: 不在任何任务的目标目录内, 也不是已记录的归档")
	}
	ext := strings.ToLower(filepath.Ext(abs))
	if ext != ".gz" && ext != ".tar" && !strings.HasSuffix(strings.ToLower(abs), ".tar.gz") {
		return fmt.Errorf("仅允许删除 .tar.gz / .tar 归档")
	}
	if err := os.Remove(abs); err != nil && !os.IsNotExist(err) {
		return err
	}
	for i, r := range m.runs {
		if filepath.Clean(r.File) == abs {
			m.runs = append(m.runs[:i], m.runs[i+1:]...)
			break
		}
	}
	m.saveRuns()
	return nil
}

// ---- 执行 ----

// RunNow 立即执行一次备份(异步, 进度接入任务队列)。
func (m *BackupManager) RunNow(name string) error {
	m.mu.Lock()
	var job *BackupJob
	for i := range m.jobs {
		if m.jobs[i].Name == name {
			job = &m.jobs[i]
			break
		}
	}
	if job == nil {
		m.mu.Unlock()
		return fmt.Errorf("任务不存在: %s", name)
	}
	if m.runSet[name] {
		m.mu.Unlock()
		return fmt.Errorf("任务正在运行中")
	}
	snapshot := *job
	m.runSet[name] = true
	job.Running = true
	m.saveJobs()
	m.mu.Unlock()

	go m.execute(snapshot)
	return nil
}

// safeJobName 任务名 → 文件名片段(仅保留安全字符)。
func safeJobName(job string) string {
	safe := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r == '-', r == '_', r == '.':
			return r
		default:
			return '_'
		}
	}, job)
	if safe == "" {
		safe = "backup"
	}
	return safe
}

// archiveName 归档文件名: <safeJob>-YYYYmmdd-HHMMSS.tar[.gz]
func archiveName(job string, compress string, ts time.Time) string {
	ext := ".tar"
	if compress == "gz" {
		ext = ".tar.gz"
	}
	return fmt.Sprintf("%s-%s%s", safeJobName(job), ts.Format("20060102-150405"), ext)
}

// execute 打包 + 落运行记录 + 保留轮换(阻塞, 由 goroutine 调用)。
func (m *BackupManager) execute(job BackupJob) {
	start := time.Now()
	taskID := ""
	if m.tasks != nil {
		taskID = m.tasks.Begin("backup", "备份 "+job.Name, "backup",
			map[string]interface{}{"job": job.Name, "target": job.Target})
		m.tasks.Update(taskID, "准备", 5, "检查目标目录")
	}

	finish := func(status, file string, size int64, msg string) {
		if taskID != "" {
			if status == "done" {
				m.tasks.Finish(taskID, true, msg, "", 100)
			} else {
				m.tasks.Finish(taskID, false, "", msg, -1)
			}
		}
		dur := int64(time.Since(start).Seconds())
		if dur == 0 && status == "done" {
			dur = 1 // 秒级粒度: 不足 1s 的成功备份显示 1s
		}
		run := BackupRun{
			Job: job.Name, Start: start.Unix(), Duration: dur,
			Size: size, Status: status, File: file, Message: msg,
		}
		m.mu.Lock()
		m.runs = append(m.runs, run)
		if len(m.runs) > bkpRunsMax {
			m.runs = m.runs[len(m.runs)-bkpRunsMax:]
		}
		m.saveRuns()
		for i := range m.jobs {
			if m.jobs[i].Name == job.Name {
				r := run
				m.jobs[i].LastRun = &r
				m.jobs[i].Running = false
			}
		}
		delete(m.runSet, job.Name)
		m.saveJobs()
		m.mu.Unlock()
		if status == "done" {
			m.prune(job)
		}
	}

	if err := os.MkdirAll(job.Target, 0o755); err != nil {
		finish("error", "", 0, "目标目录不可用: "+err.Error())
		return
	}
	// 校验来源可读(至少存在)
	var missing []string
	for _, s := range job.Sources {
		if _, err := os.Lstat(s); err != nil {
			missing = append(missing, s)
		}
	}
	if len(missing) == len(job.Sources) {
		finish("error", "", 0, "全部来源不存在: "+strings.Join(missing, ", "))
		return
	}

	final := filepath.Join(job.Target, archiveName(job.Name, job.Compress, start))
	tmp := filepath.Join(job.Target, "."+filepath.Base(final)+".partial")
	defer os.Remove(tmp) // 成功时已被 rename, 此调用无害

	args := []string{}
	if job.Compress == "gz" {
		args = append(args, "-czf", tmp)
	} else {
		args = append(args, "-cf", tmp)
	}
	for _, e := range job.Excludes {
		e = strings.TrimSpace(e)
		if e != "" {
			args = append(args, "--exclude="+e)
		}
	}
	args = append(args, "-C", "/")
	for _, s := range job.Sources {
		args = append(args, strings.TrimPrefix(filepath.Clean(s), "/"))
	}
	if len(missing) > 0 {
		args = append(args, "--ignore-failed-read")
	}

	if taskID != "" {
		m.tasks.Update(taskID, "打包中", 40, "tar 归档 "+job.Name)
	}
	ctx, cancel := context.WithTimeout(context.Background(), bkpExecTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "tar", args...)
	outBytes, err := cmd.CombinedOutput()
	out := string(outBytes)
	if len(out) > 4000 {
		out = "…" + out[len(out)-4000:]
	}
	if err != nil {
		msg := strings.TrimSpace(out)
		if msg == "" {
			msg = err.Error()
		}
		finish("error", "", 0, "tar 失败: "+msg)
		return
	}
	fi, err := os.Stat(tmp)
	if err != nil {
		finish("error", "", 0, "归档文件缺失: "+err.Error())
		return
	}
	if err := os.Rename(tmp, final); err != nil {
		finish("error", "", 0, "归档落盘失败: "+err.Error())
		return
	}
	if taskID != "" {
		m.tasks.Update(taskID, "完成", 95, filepath.Base(final))
	}
	finish("done", final, fi.Size(), fmt.Sprintf("%d 来源 · %.1f MB", len(job.Sources), float64(fi.Size())/1048576))
}

// prune 保留轮换: 同任务归档超出 keep 的最旧文件删除。
func (m *BackupManager) prune(job BackupJob) {
	if job.Keep < 1 {
		return
	}
	entries, err := os.ReadDir(job.Target)
	if err != nil {
		return
	}
	prefix := safeJobName(job.Name) + "-"
	type arc struct {
		path string
		t    time.Time
	}
	var list []arc
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), prefix) {
			continue
		}
		if !strings.HasSuffix(e.Name(), ".tar") && !strings.HasSuffix(e.Name(), ".tar.gz") {
			continue
		}
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		list = append(list, arc{filepath.Join(job.Target, e.Name()), info.ModTime()})
	}
	if len(list) <= job.Keep {
		return
	}
	sort.Slice(list, func(i, j int) bool { return list[i].t.After(list[j].t) })
	for _, a := range list[job.Keep:] {
		_ = os.Remove(a.path)
		m.mu.Lock()
		for i, r := range m.runs {
			if filepath.Clean(r.File) == a.path {
				m.runs = append(m.runs[:i], m.runs[i+1:]...)
				break
			}
		}
		m.saveRuns()
		m.mu.Unlock()
	}
}

// ---- 定时间隔 ----

// Start 启动定时器(每分钟检查 interval_hours 到期任务)。
func (m *BackupManager) Start() {
	m.mu.Lock()
	if m.stopCh != nil {
		m.mu.Unlock()
		return
	}
	m.stopCh = make(chan struct{})
	stop := m.stopCh
	m.mu.Unlock()
	go func() {
		t := time.NewTicker(time.Minute)
		defer t.Stop()
		for {
			select {
			case <-stop:
				return
			case <-t.C:
				m.tick()
			}
		}
	}()
}

// Stop 停止定时器。
func (m *BackupManager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.stopCh != nil && !m.stopped {
		close(m.stopCh)
		m.stopped = true
	}
}

// tick 扫描到期任务并触发执行。
func (m *BackupManager) tick() {
	now := time.Now().Unix()
	m.mu.Lock()
	var due []string
	for _, j := range m.jobs {
		if j.Paused || j.IntervalHours <= 0 || m.runSet[j.Name] {
			continue
		}
		if j.LastRun == nil || now-j.LastRun.Start >= int64(j.IntervalHours)*3600 {
			due = append(due, j.Name)
		}
	}
	m.mu.Unlock()
	for _, name := range due {
		_ = m.RunNow(name)
	}
}
