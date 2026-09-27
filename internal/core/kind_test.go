package core

import "testing"

// FileKind 的取值域必须与前端 kindName/kindIcon 完全一致:
// dir|image|video|audio|archive|text|file —— 多一个少一个都会让对应入口失效。

func TestFileKind(t *testing.T) {
	cases := []struct {
		name string
		dir  bool
		want string
	}{
		{"下载", true, "dir"},
		{"a.JPG", false, "image"},
		{"b.png", false, "image"},
		{"c.MP4", false, "video"},
		{"d.mkv", false, "video"},
		{"e.flac", false, "audio"},
		{"f.mp3", false, "audio"},
		{"g.tar.gz", false, "archive"}, // Ext=.gz
		{"h.7z", false, "archive"},
		{"i.zip", false, "archive"},
		{"j.md", false, "text"},
		{"k.py", false, "text"},
		{"L.LOG", false, "text"},
		{"Dockerfile", false, "text"},
		{"dockerfile", false, "text"},
		{"Makefile", false, "text"},
		{"README", false, "text"},
		{".gitignore", false, "text"},
		{".env", false, "text"},
		{"x.bin", false, "file"},
		{"noext", false, "file"},
		{"y.", false, "file"},
	}
	for _, c := range cases {
		if got := FileKind(c.dir, c.name); got != c.want {
			t.Errorf("FileKind(%q, dir=%v) = %q, want %q", c.name, c.dir, got, c.want)
		}
	}
	// 取值域守护: 只允许前端认识的7种
	allowed := map[string]bool{"dir": true, "image": true, "video": true, "audio": true, "archive": true, "text": true, "file": true}
	for _, c := range cases {
		if !allowed[FileKind(c.dir, c.name)] {
			t.Fatalf("出现前端不认识的 kind: %q", FileKind(c.dir, c.name))
		}
	}
}
