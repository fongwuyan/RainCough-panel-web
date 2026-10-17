package legacy

// WAL(Write-Ahead Log)回放
//
// 为什么必须做: 旧面板用 journal_mode=wal。WAL 里的页是"已提交但还没写回主库"的数据,
// 只读主库会丢掉最近的写入(实测那台机器 WAL 1.2MB > 主库 725KB)。
//
// WAL 文件结构:
//
//	[32 字节头] [帧1] [帧2] ...
//
//	头: magic(4) version(4) pageSize(4) checkpointSeq(4) salt1(4) salt2(4) cksum1(4) cksum2(4)
//	帧: pageNo(4) dbSizeAfterCommit(4) salt1(4) salt2(4) cksum1(4) cksum2(4) [pageSize 字节页内容]
//
// 有效性判定:
//   · 帧的 salt1/salt2 必须与头一致(否则是上一个 WAL 周期的残留)
//   · 帧校验和必须与累积校验和一致(否则是写到一半的帧)
//   · 只应用"到最后一个提交点(dbSizeAfterCommit != 0)"为止的帧 —— 提交点之后的帧属于
//     未完成的事务, 应用它们会读到半截事务
//
// 校验和的字节序: 规范用 magic 最低位标记(0x...82 一种, 0x...83 另一种)。
// 这里不去推语义, 而是**两种字节序都试**, 用能自洽通过的那一种 —— 更省心也更容易验证。

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
)

const (
	walHeaderSize = 32
	walFrameHdr   = 24
	walVersion    = 3007000
)

// applyWAL 回放 WAL 到 db.pages(只保留最终提交点之前的有效帧)。
func (db *DB) applyWAL(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	hdr := make([]byte, walHeaderSize)
	if _, err := io.ReadFull(f, hdr); err != nil {
		return fmt.Errorf("WAL 头读取失败: %w", err)
	}
	magic := binary.BigEndian.Uint32(hdr[0:4])
	if magic != 0x377f0682 && magic != 0x377f0683 {
		return fmt.Errorf("WAL magic 0x%08x 非法", magic)
	}
	version := binary.BigEndian.Uint32(hdr[4:8])
	if version != walVersion {
		return fmt.Errorf("WAL 版本 %d 不支持", version)
	}
	wps := int(binary.BigEndian.Uint32(hdr[8:12]))
	if wps != db.pageSize {
		return fmt.Errorf("WAL 页大小 %d 与主库 %d 不一致", wps, db.pageSize)
	}
	salt1 := binary.BigEndian.Uint32(hdr[16:20])
	salt2 := binary.BigEndian.Uint32(hdr[20:24])
	hdrCk1 := binary.BigEndian.Uint32(hdr[24:28])
	hdrCk2 := binary.BigEndian.Uint32(hdr[28:32])

	// 用两种字节序验证头校验和, 选定一种
	bigEndian, ok := detectWALEndian(hdr[:24], hdrCk1, hdrCk2)
	if !ok {
		return errors.New("WAL 头校验和不匹配(可能损坏)")
	}

	// 逐帧扫描: 累积到 map, 记录最后一个有效提交点
	type frame struct {
		pageNo uint32
		data   []byte
	}
	var frames []frame
	var commitAt = -1
	s0, s1 := hdrCk1, hdrCk2 // 校验和链式累积(从头部开始)
	buf := make([]byte, walFrameHdr+wps)
	for idx := 0; ; idx++ {
		n, err := io.ReadFull(f, buf)
		if err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				// 尾部半截帧: WAL 被截断(崩溃), 到此为止
				break
			}
			return err
		}
		if n < walFrameHdr+wps {
			break
		}
		fh := buf[:walFrameHdr]
		pageNo := binary.BigEndian.Uint32(fh[0:4])
		dbSize := binary.BigEndian.Uint32(fh[4:8])
		fs1 := binary.BigEndian.Uint32(fh[8:12])
		fs2 := binary.BigEndian.Uint32(fh[12:16])
		fc1 := binary.BigEndian.Uint32(fh[16:20])
		fc2 := binary.BigEndian.Uint32(fh[20:24])

		if fs1 != salt1 || fs2 != salt2 {
			break // 上个周期的残留帧, 之后都不属于当前 WAL
		}
		// 帧校验: 覆盖帧头的 pageNo+dbSize 与页内容
		c1, c2 := walChecksum(fh[:8], s0, s1, bigEndian)
		c1, c2 = walChecksum(buf[walFrameHdr:], c1, c2, bigEndian)
		if c1 != fc1 || c2 != fc2 {
			break // 半截帧/损坏, 停止(后面的也不可信)
		}
		s0, s1 = c1, c2

		data := make([]byte, wps)
		copy(data, buf[walFrameHdr:])
		frames = append(frames, frame{pageNo: pageNo, data: data})
		if dbSize != 0 {
			commitAt = len(frames) - 1 // 这是一个提交点
		}
	}

	if commitAt < 0 {
		return nil // 没有任何已提交帧
	}
	// 只应用 [0, commitAt] 的帧
	applied := 0
	for i := 0; i <= commitAt; i++ {
		db.pages[frames[i].pageNo] = frames[i].data
		applied++
	}
	if applied == 0 {
		return errors.New("WAL 无可应用帧")
	}
	return nil
}

// detectWALEndian 用两种字节序算头校验和, 返回能匹配的那一种。
func detectWALEndian(head24 []byte, want1, want2 uint32) (bigEndian bool, ok bool) {
	for _, be := range []bool{false, true} {
		c1, c2 := walChecksum(head24, 0, 0, be)
		if c1 == want1 && c2 == want2 {
			return be, true
		}
	}
	return false, false
}

// walChecksum SQLite WAL 校验和: 按 8 字节一组, 两组 32 位字交替累加。
func walChecksum(data []byte, s0, s1 uint32, bigEndian bool) (uint32, uint32) {
	i := 0
	for ; i+8 <= len(data); i += 8 {
		var x0, x1 uint32
		if bigEndian {
			x0 = binary.BigEndian.Uint32(data[i : i+4])
			x1 = binary.BigEndian.Uint32(data[i+4 : i+8])
		} else {
			x0 = binary.LittleEndian.Uint32(data[i : i+4])
			x1 = binary.LittleEndian.Uint32(data[i+4 : i+8])
		}
		s0 += x0 + s1
		s1 += x1 + s0
	}
	return s0, s1
}
