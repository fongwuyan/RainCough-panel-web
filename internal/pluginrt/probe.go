package pluginrt

// 运行时能力探测
//
// 目的: 让"面板支持哪些语言"只有一个事实来源。
//
// 起因(2026-10-17): 前端曾硬编码 `lang !== 'go' → 不兼容 v6`, 而后端早已支持
// py/php/java/node。两侧各写一份判断, 必然脱节 —— 用户看到 JMComic 顶着
// "不兼容 v6", 实际上它能跑。现在由后端探测真实能力, 前端只读结果, 不再自建白名单。

// LangStatus 单个语言的运行时状态
type LangStatus struct {
	Lang string `json:"lang"`
	// Supported 语言是否在内置支持列表里(编译期决定)
	Supported bool `json:"supported"`
	// NeedsInterpreter 是否需要外部解释器(go/binary 为 false)
	NeedsInterpreter bool `json:"needs_interpreter"`
	// Available 当前环境是否真的能用(不需要解释器的恒 true)
	Available bool `json:"available"`
	// Interpreter 解析到的解释器绝对路径(不需要时为二进制自身或空)
	Interpreter string `json:"interpreter,omitempty"`
	// Note 解析提示(如"python 不存在, 已回退到 python3")
	Note string `json:"note,omitempty"`
	// Hint 缺失时的安装建议
	Hint string `json:"hint,omitempty"`
}

// RuntimeInfo 运行时能力总览
type RuntimeInfo struct {
	// Languages 面板支持的语言名(归一化后), 前端据此判断"语言是否受支持"
	Languages []string `json:"languages"`
	// Details 每种语言的详细状态
	Details []LangStatus `json:"details"`
	// Available 当前环境可直接运行的语言
	Available []string `json:"available"`
	// Missing 声明支持但环境缺解释器的语言
	Missing []string `json:"missing"`
}

// needsInterpreter 该语言是否需要外部解释器
func needsInterpreter(l Lang) bool {
	switch l {
	case LangGo, LangBinary:
		return false
	}
	return true
}

// Probe 探测当前环境的运行时能力(会走一遍 PATH 查找, 调用方宜缓存)。
func Probe() RuntimeInfo {
	info := RuntimeInfo{Languages: []string{}, Details: []LangStatus{}, Available: []string{}, Missing: []string{}}
	seen := map[string]bool{}
	for _, l := range Supported() {
		name := string(l)
		fillLangName(&info, seen, name)

		st := LangStatus{Lang: name, Supported: true, NeedsInterpreter: needsInterpreter(l)}
		if !st.NeedsInterpreter {
			// 静态二进制: 无需解释器, 恒可用
			st.Available = true
			info.Available = append(info.Available, name)
			info.Details = append(info.Details, st)
			continue
		}
		bin, note, err := findInterpreter(l)
		if err != nil {
			st.Available = false
			st.Hint = installHint(l)
			info.Missing = append(info.Missing, name)
		} else {
			st.Available = true
			st.Interpreter = bin
			st.Note = note
			info.Available = append(info.Available, name)
		}
		info.Details = append(info.Details, st)
	}
	// 归一化别名也写进 Languages, 让前端用 "python3"/"nodejs"/"sh" 声明时也能命中
	for _, alias := range []string{"python3", "nodejs", "sh", "binary"} {
		fillLangName(&info, seen, alias)
	}
	return info
}

// fillLangName 去重追加
func fillLangName(info *RuntimeInfo, seen map[string]bool, name string) {
	if name == "" || seen[name] {
		return
	}
	seen[name] = true
	info.Languages = append(info.Languages, name)
}

// IsLangSupported 判断某个 lang 声明是否受支持(供后端侧校验复用)。
// 与 Probe().Languages 同源, 避免两处各写一份。
func IsLangSupported(lang string) bool {
	n := string(Normalize(lang))
	if n == "" || n == string(LangGo) {
		return true // 未声明 = 按 Go/二进制处理
	}
	for _, l := range Supported() {
		if string(l) == n {
			return true
		}
	}
	// 别名
	switch n {
	case "python3", "nodejs", "sh":
		return true
	}
	return false
}
