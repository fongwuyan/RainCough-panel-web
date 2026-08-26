package core

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// ---- 调度器(与旧面板 scheduler.py 契约兼容: jobs CRUD + 自动触发) ----

// ScheduleJob 定时任务定义。
type ScheduleJob struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Cron        string            `json:"cron"`   // 5 段 cron (分 时 日 月 周), * 或数字
	Trigger     string            `json:"trigger"` // cron|interval(兼容旧前端)
	Interval    int               `json:"interval"` // 秒(trigger=interval 时)
	Minute      string            `json:"minute,omitempty"`
	Hour        string            `json:"hour,omitempty"`
	Day         string            `json:"day,omitempty"`
	Month       string            `json:"month,omitempty"`
	DayOfWeek   string            `json:"day_of_week,omitempty"`
	Action      string            `json:"action"` // shell / 系统动作名
	Params      map[string]string `json:"params,omitempty"`
	Enabled     bool              `json:"enabled"`
	Paused      bool              `json:"paused"` // = !enabled(兼容旧前端)
	LastRun     int64             `json:"last_run,omitempty"`
	LastStatus  string            `json:"last_status,omitempty"` // ok|fail|running
	LastMessage string            `json:"last_message,omitempty"`
	CreatedAt   int64             `json:"created_at"`
	History     []map[string]any  `json:"history,omitempty"` // 兼容旧前端(展开用)
}

// Scheduler 调度器: 管理 jobs + 按 cron 触发。
type Scheduler struct {
	ns Namespacelike // cor e_scheduler namespace
	// 动作执行器: 由宿主注入(执行 shell 或业务动作)
	executor func(job *ScheduleJob) (string, error)

	mu   sync.Mutex
	jobs map[string]*ScheduleJob
	stop chan struct{}
}

// NewScheduler 创建调度器 executor 为 nil 时使用默认 shell 执行。
func NewScheduler(ns Namespacelike, executor func(job *ScheduleJob) (string, error)) *Scheduler {
	s := &Scheduler{ns: ns, executor: executor, jobs: map[string]*ScheduleJob{}, stop: make(chan struct{})}
	s.loadPersisted()
	return s
}

// SetExecutor 注入动作执行器。
func (s *Scheduler) SetExecutor(fn func(job *ScheduleJob) (string, error)) { s.executor = fn }

// Start 启动调度循环(每 30s 检查一次)。
func (s *Scheduler) Start() {
	go func() {
		t := time.NewTicker(30 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-s.stop:
				return
			case now := <-t.C:
				s.checkDue(now)
			}
		}
	}()
}

// Stop 停止调度器。
func (s *Scheduler) Stop() { close(s.stop) }

// List 列出任务。
func (s *Scheduler) List() []*ScheduleJob {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]*ScheduleJob, 0, len(s.jobs))
	for _, j := range s.jobs {
		out = append(out, j)
	}
	sort.Slice(out, func(i, k int) bool { return out[i].CreatedAt < out[k].CreatedAt })
	return out
}

// Get 单任务。
func (s *Scheduler) Get(id string) (*ScheduleJob, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	return j, ok
}

// Create 创建任务。
func (s *Scheduler) Create(name, cron, action string, params map[string]string) (*ScheduleJob, error) {
	if err := validateCron(cron); err != nil {
		return nil, err
	}
	if action == "" {
		action = "shell"
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	j := &ScheduleJob{
		ID:   name + "-" + fmt.Sprint(time.Now().UnixNano()),
		Name: name, Cron: cron, Action: action, Params: params,
		Enabled: true, CreatedAt: time.Now().Unix(),
	}
	syncJobCompat(j)
	s.jobs[j.ID] = j
	s.persist(j)
	return j, nil
}

// Update 更新任务。
func (s *Scheduler) Update(id string, name, cron, action string, params map[string]string, enabled *bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok {
		return fmt.Errorf("任务不存在: %s", id)
	}
	if name != "" {
		j.Name = name
	}
	if cron != "" {
		if err := validateCron(cron); err != nil {
			return err
		}
		j.Cron = cron
	}
	if action != "" {
		j.Action = action
	}
	if params != nil {
		j.Params = params
	}
	if enabled != nil {
		j.Enabled = *enabled
	}
	syncJobCompat(j)
	s.persist(j)
	return nil
}

// syncJobCompat 将 cron 拆分为前端分钟/时/日/月/周 + 派生 trigger/paused。
func syncJobCompat(j *ScheduleJob) {
	j.Paused = !j.Enabled
	j.Trigger = "cron"
	if j.Cron == "" {
		j.Trigger = "interval"
	}
	parts := strings.Split(j.Cron, " ")
	if len(parts) == 5 {
		j.Minute, j.Hour, j.Day, j.Month, j.DayOfWeek = parts[0], parts[1], parts[2], parts[3], parts[4]
	}
}

// Delete 删除任务。
func (s *Scheduler) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.jobs[id]; !ok {
		return fmt.Errorf("任务不存在: %s", id)
	}
	delete(s.jobs, id)
	_ = s.ns.Set("job:"+id, nil)
	return nil
}

// RunNow 手动立即执行。
func (s *Scheduler) RunNow(id string) (string, error) {
	s.mu.Lock()
	j, ok := s.jobs[id]
	s.mu.Unlock()
	if !ok {
		return "", fmt.Errorf("任务不存在: %s", id)
	}
	return s.fire(j)
}

// ---- 内部 ----

// checkDue 检查到期任务(防重复: 同一 cron 分钟内只跑一次)。
func (s *Scheduler) checkDue(now time.Time) {
	s.mu.Lock()
	jobs := make([]*ScheduleJob, 0, len(s.jobs))
	for _, j := range s.jobs {
		jobs = append(jobs, j)
	}
	s.mu.Unlock()
	for _, j := range jobs {
		if !j.Enabled {
			continue
		}
		if cronMatches(j.Cron, now) {
			// 分钟粒度防重
			s.mu.Lock()
			lastMin := time.Unix(j.LastRun, 0).Minute()
			shouldRun := j.LastRun == 0 || lastMin != now.Minute()
			s.mu.Unlock()
			if shouldRun {
				_, _ = s.fire(j)
			}
		}
	}
}

// fire 执行任务并记录结果。
func (s *Scheduler) fire(j *ScheduleJob) (string, error) {
	s.mu.Lock()
	j.LastStatus = "running"
	s.persist(j)
	s.mu.Unlock()

	var msg string
	var err error
	if s.executor != nil {
		msg, err = s.executor(j)
	} else {
		msg, err = s.defaultExec(j)
	}

	s.mu.Lock()
	j.LastRun = time.Now().Unix()
	if err != nil {
		j.LastStatus = "fail"
		j.LastMessage = err.Error()
	} else {
		j.LastStatus = "ok"
		j.LastMessage = msg
	}
	s.persist(j)
	s.mu.Unlock()
	return msg, err
}

// defaultExec 默认动作: shell 直接在面板宿主执行(旧 action 兼容)。
func (s *Scheduler) defaultExec(j *ScheduleJob) (string, error) {
	cmd := j.Params["cmd"]
	if cmd == "" {
		return "", fmt.Errorf("任务无 cmd 参数")
	}
	out, err := RunShell(cmd, 300)
	return out, err
}

// RunShell 执行 shell 命令(带超时)。
func RunShell(cmd string, timeoutSec int) (string, error) {
	if timeoutSec <= 0 {
		timeoutSec = 300
	}
	out, err := runCommand(cmd, timeoutSec)
	return out, err
}

// validateCron 简单校验 5 段 cron。
func validateCron(cron string) error {
	fields := strings.Fields(cron)
	if len(fields) != 5 {
		return fmt.Errorf("cron 必须为 5 段(分 时 日 月 周): %q", cron)
	}
	for i, f := range fields {
		if f == "*" {
			continue
		}
		ranges := map[int][2]int{0: {0, 59}, 1: {0, 23}, 2: {1, 31}, 3: {1, 12}, 4: {0, 7}}[i]
		parts := strings.Split(f, ",")
		for _, p := range parts {
			if p == "*/2" || p == "*/5" || p == "*/10" || p == "*/15" || p == "*/30" {
				continue
			}
			n := 0
			if _, err := fmt.Sscanf(p, "%d", &n); err != nil || n < ranges[0] || n > ranges[1] {
				return fmt.Errorf("cron 字段 %d 非法: %q", i+1, p)
			}
		}
	}
	return nil
}

// cronMatches 判断当前时间是否匹配 cron(分钟级)。
func cronMatches(cron string, t time.Time) bool {
	fields := strings.Fields(cron)
	if len(fields) != 5 {
		return false
	}
	return fieldMatch(fields[0], t.Minute()) &&
		fieldMatch(fields[1], t.Hour()) &&
		fieldMatch(fields[2], t.Day()) &&
		fieldMatch(fields[3], int(t.Month())) &&
		fieldMatch(fields[4], int(t.Weekday()))
}

func fieldMatch(spec string, v int) bool {
	if spec == "*" {
		return true
	}
	for _, p := range strings.Split(spec, ",") {
		step := 1
		base := p
		if strings.HasPrefix(p, "*/") {
			fmt.Sscanf(p, "*/%d", &step)
			base = "*"
		}
		if base == "*" {
			if v%step == 0 {
				return true
			}
			continue
		}
		n := 0
		if _, err := fmt.Sscanf(p, "%d", &n); err == nil && n == v {
			return true
		}
	}
	return false
}

// persist 落库。
func (s *Scheduler) persist(j *ScheduleJob) {
	_ = s.ns.Set("job:"+j.ID, j)
}

// loadPersisted 启动恢复。
func (s *Scheduler) loadPersisted() {
	if lister, ok := s.ns.(interface {
		List(prefix string, limit int) (map[string]interface{}, error)
	}); ok {
		items, err := lister.List("job:", 1000)
		if err == nil {
			s.mu.Lock()
			defer s.mu.Unlock()
			for k, v := range items {
				id := strings.TrimPrefix(k, "job:")
				if m, ok := v.(map[string]interface{}); ok {
					j := jobFromMap(id, m)
					s.jobs[id] = j
				}
			}
		}
	}
}

// jobFromMap 从 map 还原 ScheduleJob。
func jobFromMap(id string, m map[string]interface{}) *ScheduleJob {
	j := &ScheduleJob{ID: id}
	str := func(k string) string {
		if v, ok := m[k].(string); ok {
			return v
		}
		return ""
	}
	j.Name = str("name")
	j.Cron = str("cron")
	j.Action = str("action")
	j.LastStatus = str("last_status")
	j.LastMessage = str("last_message")
	if v, ok := m["enabled"].(bool); ok {
		j.Enabled = v
	}
	if v, ok := m["last_run"].(float64); ok {
		j.LastRun = int64(v)
	}
	if v, ok := m["created_at"].(float64); ok {
		j.CreatedAt = int64(v)
	}
	if v, ok := m["params"].(map[string]interface{}); ok {
		params := map[string]string{}
		for k, v := range v {
			if s, ok := v.(string); ok {
				params[k] = s
			}
		}
		j.Params = params
	}
	syncJobCompat(j)
	return j
}
