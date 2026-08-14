/*
 * vt100.js — 100% 自研 ANSI/VT100/xterm 终端模拟器（字符网格 + 状态机解析）。
 * 无第三方解析依赖，兼容 vim/top/htop 等 TUI 程序。
 *
 * 数据模型：
 *   this.buffer[]        — 全部行（含回滚区），顺序排列，可无限增长但按 scrollback 上限裁剪
 *   this.screenTop       — buffer 中当前屏幕第一行对应的下标；buffer[0..screenTop-1] 为回滚区
 *                           屏幕(实际可见) = buffer[screenTop .. screenTop+rows-1]
 *   当整屏向上滚动时：已见顶行进入回滚区（screenTop++），底部补充新行
 *   非全屏滚动区域：仅在该区域内的可见窗格上移位
 *
 * 单元格: {ch,fg,bg,bold,dim,ital,ul,rev,cross,blink,hidden,skip(宽字符次格),wide}
 */
const PALETTE16 = [
  '#000000', '#cd3131', '#0dbc79', '#e5e510',
  '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
  '#666666', '#f14c4c', '#23d18b', '#f5f543',
  '#3b8eea', '#d670d6', '#29b8db', '#ffffff',
]
const CUBE = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff]
const GRAY = [0x08, 0x12, 0x1c, 0x26, 0x30, 0x3a, 0x44, 0x4e, 0x58, 0x62,
  0x6c, 0x76, 0x80, 0x8a, 0x94, 0x9e, 0xa8, 0xb2, 0xbc, 0xc6,
  0xd0, 0xda, 0xe4, 0xee]

function hex(v) { return ('0' + Math.round(v).toString(16)).slice(-2) }
export function ansiColor256(idx) {
  if (idx < 16) return PALETTE16[idx]
  if (idx < 232) {
    idx -= 16
    return '#' + hex(CUBE[Math.floor(idx / 36) % 6]) + hex(CUBE[Math.floor(idx / 6) % 6]) + hex(CUBE[idx % 6])
  }
  const g = GRAY[idx - 232]
  return '#' + hex(g) + hex(g) + hex(g)
}
export function resolveColor(fg) {
  // 负值表示 256 色 (-(256+n))；>=90000000000 表示 24 位 (GRB编码)；else 基础16
  if (fg < 0) return ansiColor256(-fg - 256)
  if (fg && fg >= 90000000000) {
    const r = Math.floor(fg / 1000000) % 1000
    const g = Math.floor(fg / 1000) % 1000
    const b = fg % 1000
    return '#' + hex(r) + hex(g) + hex(b)
  }
  return PALETTE16[fg % 16]
}

function emptyCell() {
  return { ch: ' ', fg: 7, bg: 0, bold: 0, dim: 0, ital: 0, ul: 0, rev: 0, cross: 0, blink: 0, hidden: 0, skip: 0, wide: 0 }
}
function cloneCell(c) { return Object.assign({}, c) }

export class VT100Terminal {
  constructor({ cols = 80, rows = 24, scrollback = 5000 } = {}) {
    this.cols = cols
    this.rows = rows
    this.scrollback = scrollback
    this.viewOffset = 0   // 0=底部；>0 上滚查看回滚
    this.reset()
  }

  reset() {
    this.buffer = []
    this.screenTop = 0
    this.cur = { x: 0, y: 0 }
    this.attrs = emptyCell(); this.attrs.fg = 7
    this.mode = { wrap: true, insert: false, alt: false, cursorVisible: true, appCursorKeys: false }
    this.scrollTop = 0
    this.scrollBottom = this.rows - 1
    this.savedCursor = {}
    this.altBuf = []
    this.altCur = { x: 0, y: 0 }
    this.altScreenTop = 0
    this.title = ''
    this.tabStops = new Set()
    for (let t = 8; t < this.cols; t += 8) this.tabStops.add(t)
    this.bell = false
    this.redrawFull = true
    for (let i = 0; i < this.rows; i++) this._pushBlankRow()
    this.screenTop = 0
  }

  _newRow() {
    const r = []
    for (let i = 0; i < this.cols; i++) r.push(emptyCell())
    return r
  }
  _rowFromAttrs() {
    const r = []
    for (let i = 0; i < this.cols; i++) r.push(cloneCell(this.attrs))
    return r
  }
  _pushBlankRow() { this.buffer.push(this._newRow()) }
  _pushAttrsRow() { this.buffer.push(this._rowFromAttrs()) }

  _isAlt() { return this.mode.alt }
  _buf() { return this.mode.alt ? this.altBuf : this.buffer }
  _top() { return this.mode.alt ? this.altScreenTop : this.screenTop }

  _cell(y, x) {
    const b = this._buf()
    const row = b[this._top() + y]
    return row ? row[x] : emptyCell()
  }

  _clip() {
    this.cur.x = Math.max(0, Math.min(this.cols - 1, this.cur.x))
    this.cur.y = Math.max(0, Math.min(this.rows - 1, this.cur.y))
  }

  /* ---------- 输入 ---------- */
  write(str) {
    if (!str) return
    this._state = this._state || 'ground'
    for (const ch of str) this._feed(ch)
    this._trimScrollback()
  }

  _feed(ch) {
    switch (this._state) {
      case 'ground':
        if (ch === '\x1b') { this._state = 'escape'; break }
        if (ch === '\x9b') { this._beginCsi(); break }
        if (ch === '\x07') { this.bell = true; break }
        if (ch === '\r') { this.cur.x = 0; break }
        if (ch === '\n' || ch === '\x0b' || ch === '\x0c') { this._lineFeed(); break }
        if (ch === '\x08') { this.cur.x = Math.max(0, this.cur.x - 1); break }
        if (ch === '\t') { this._tab(); break }
        if (ch === '\x00') break
        this._printChar(ch)
        break

      case 'escape':
        if (ch === '[') { this._beginCsi(); break }
        if (ch === ']') { this._state = 'osc'; this._osc = ''; break }
        if (ch === '7') { this._saveCursor(); this._state = 'ground'; break }
        if (ch === '8') { this._restoreCursor(); this._state = 'ground'; break }
        if (ch === 'M') { this._reverseIndex(); this._state = 'ground'; break }
        if (ch === 'D') { this.cur.y++; this._clip(); this._state = 'ground'; break }
        if (ch === 'E') { this.cur.y++; this.cur.x = 0; this._clip(); this._state = 'ground'; break }
        if (ch === '=' || ch === '>') { this._state = 'ground'; break }
        if (ch === 'H') { this.tabStops.add(this.cur.x); this._state = 'ground'; break }
        if (ch === '(' || ch === ')') { this._state = 'charset'; break }
        else { this._state = 'ground'; break }

      case 'charset':
        this._state = 'ground'
        break

      case 'osc':
        if (ch === '\x07') { this._oscEnd(); this._state = 'ground'; break }
        if (ch === '\x1b') { this._state = 'oscEsc'; break }
        this._osc += ch
        if (this._osc.length > 4096) this._state = 'ground'
        break
      case 'oscEsc':
        if (ch === '\\') { this._oscEnd(); this._state = 'ground' }
        else { this._osc += '\x1b' + ch; this._state = 'osc' }
        break

      case 'csi':
        this._csiFeed(ch)
        break
    }
  }

  /* ---------- CSI ---------- */
  _beginCsi() {
    this._state = 'csi'
    this._csiParams = []
    this._csiPref = ''
    this._csiBuff = ''
  }

  _csiFeed(ch) {
    const o = ch.codePointAt(0)
    if (ch >= '0' && ch <= '9') { this._csiBuff += ch; return }
    if (ch === ';') { this._csiParams.push(this._csiBuff === '' ? 0 : parseInt(this._csiBuff, 10) || 0); this._csiBuff = ''; return }
    if (ch === '?' || ch === '>' || ch === '=' || ch === '<') { this._csiPref += ch; return }
    if (ch === ' ' || ch === '!' || ch === '*' || ch === '"' || ch === '\'') { this._consumedBytes++; return }
    // 除上述外均视为最终字符
    this._csiParams.push(this._csiBuff === '' ? 0 : parseInt(this._csiBuff, 10) || 0)
    this._execCsi(ch)
    this._state = 'ground'
  }

  _execCsi(final) {
    const p = this._csiParams
    const def = (i, d) => (p[i] === undefined || p[i] === 0 ? d : p[i])
    if (this._csiPref === '?' && (final === 'h' || final === 'l')) {
      this._privMode(final === 'h')
      return
    }
    if (final === 'm') { this._sgr(); return }
    switch (final) {
      case 'A': this.cur.y = Math.max(0, this.cur.y - def(0, 1)); break
      case 'B': this.cur.y = Math.min(this.rows - 1, this.cur.y + def(0, 1)); break
      case 'C': this.cur.x = Math.min(this.cols - 1, this.cur.x + def(0, 1)); break
      case 'D': this.cur.x = Math.max(0, this.cur.x - def(0, 1)); break
      case 'E': this.cur.y = Math.min(this.rows - 1, this.cur.y + def(0, 1)); this.cur.x = 0; break
      case 'F': this.cur.y = Math.max(0, this.cur.y - def(0, 1)); this.cur.x = 0; break
      case 'G': this.cur.x = Math.max(0, def(0, 1) - 1); this._clip(); break
      case 'H': case 'f':
        this.cur.y = Math.max(0, (p[0] || 1) - 1); this.cur.x = Math.max(0, (p[1] || 1) - 1); this._clip(); break
      case 'd': this.cur.y = Math.max(0, def(0, 1) - 1); this._clip(); break
      case 'J': this._eraseDisplay(p[0] || 0); break
      case 'K': this._eraseLine(p[0] || 0); break
      case 'X': this._eraseChars(def(0, 1)); break
      case 'L': this._insertLines(def(0, 1)); break
      case 'M': this._deleteLines(def(0, 1)); break
      case 'P': this._deleteChars(def(0, 1)); break
      case '@': this._insertChars(def(0, 1)); break
      case 'S': for (let i = 0; i < def(0, 1); i++) this._scrollUpCur(); break
      case 'T': for (let i = 0; i < def(0, 1); i++) this._scrollDownCur(); break
      case 'r': this._setScrollRegion(); break
      case 's': this._saveCursor(); break
      case 'u': this._restoreCursor(); break
      case 'n': case 't': case 'b': case 'g': break // DSR/窗口/重复/字符集 忽略
      case 'h': case 'l': break // ANSI 模式 (LNM 等) 忽略
    }
  }

  _privMode(set) {
    for (const q of this._csiParams) {
      if (set) {
        if (q === 25) this.mode.cursorVisible = true
        else if (q === 1) this.mode.appCursorKeys = true
        else if (q === 7) this.mode.wrap = true
        else if (q === 47 || q === 1047 || q === 1048 || q === 1049) this._enterAlt()
      } else {
        if (q === 25) this.mode.cursorVisible = false
        else if (q === 1) this.mode.appCursorKeys = false
        else if (q === 7) this.mode.wrap = false
        else if (q === 47 || q === 1047 || q === 1048 || q === 1049) this._exitAlt()
      }
    }
  }

  _sgr() {
    const p = this._csiParams
    let i = 0
    while (i < p.length) {
      const v = p[i]
      if (v === 0) { this.attrs = emptyCell(); this.attrs.fg = 7 }
      else if (v === 1) this.attrs.bold = 1
      else if (v === 2) this.attrs.dim = 1
      else if (v === 3) this.attrs.ital = 1
      else if (v === 4) this.attrs.ul = 1
      else if (v === 5 || v === 6) this.attrs.blink = 1
      else if (v === 7) this.attrs.rev = 1
      else if (v === 8) this.attrs.hidden = 1
      else if (v === 9) this.attrs.cross = 1
      else if (v === 21) this.attrs.bold = 0
      else if (v === 22) this.attrs.bold = 0, this.attrs.dim = 0
      else if (v === 23) this.attrs.ital = 0
      else if (v === 24) this.attrs.ul = 0
      else if (v === 25) this.attrs.blink = 0
      else if (v === 27) this.attrs.rev = 0
      else if (v === 28) this.attrs.hidden = 0
      else if (v === 29) this.attrs.cross = 0
      else if (v >= 30 && v <= 37) this.attrs.fg = v - 30
      else if (v === 38) {
        if (p[i + 1] === 5) { this.attrs.fg = -(256 + p[i + 2]); i += 2 } else if (p[i + 1] === 2) { this.attrs.fg = 90000000000 + p[i + 2] * 1000000 + p[i + 3] * 1000 + p[i + 4]; i += 4 } i++
      } else if (v === 39) this.attrs.fg = 7
      else if (v >= 40 && v <= 47) this.attrs.bg = v - 40
      else if (v === 48) {
        if (p[i + 1] === 5) { this.attrs.bg = -(256 + p[i + 2]); i += 2 } else if (p[i + 1] === 2) { this.attrs.bg = 90000000000 + p[i + 2] * 1000000 + p[i + 3] * 1000 + p[i + 4]; i += 4 } i++
      } else if (v === 49) this.attrs.bg = 0
      else if (v >= 90 && v <= 97) this.attrs.fg = 8 + (v - 90)
      else if (v >= 100 && v <= 107) this.attrs.bg = 8 + (v - 100)
      i++
    }
  }

  /* ---------- 打印 ---------- */
  _printChar(ch) {
    const code = ch.codePointAt(0)
    const wide = code >= 0x1100 && (
      (code <= 0x115f) || (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe30 && code <= 0xfe4f) || (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) || (code >= 0x1f300 && code <= 0x1faff) || (code >= 0x20000 && code <= 0x3fffd)
    )
    if (wide) this._putWide(ch)
    else this._putCell(ch, '')
  }

  _putCell(ch, tail) {
    // 若当前位置是宽字符次格，则退一列覆盖其首格
    if (this.cur.x > 0 && this._cell(this.cur.y, this.cur.x).wide) this.cur.x--
    if (this.cur.x >= this.cols) {
      if (this.mode.wrap) { this.cur.x = 0; this.cur.y++; this._ensureRow(this.cur.y) }
      else this.cur.x = this.cols - 1
    }
    const cell = cloneCell(this.attrs)
    if (tail) { cell.ch = ''; cell.wide = 1; cell.skip = 1 }
    else cell.ch = ch
    this._buf()[this._top() + this.cur.y][this.cur.x] = cell
    if (this.cur.x + 1 >= this.cols) {
      if (this.mode.wrap) { this.cur.x = 0; this.cur.y++; this._ensureRow(this.cur.y) }
      else this.cur.x = this.cols - 1
    } else {
      this.cur.x++
    }
  }

  _putWide(ch) {
    // 需要两格
    if (this.cols - this.cur.x < 2) {
      if (this.mode.wrap) { this.cur.x = 0; this.cur.y++; this._ensureRow(this.cur.y) }
      else return
    }
    const b = this._buf()
    const abs = this._top() + this.cur.y
    if (this.cur.x > 0 && b[abs][this.cur.x].wide) this.cur.x--
    const c1 = cloneCell(this.attrs); c1.ch = ch
    const c2 = cloneCell(this.attrs); c2.ch = ''; c2.skip = 1; c2.wide = 1
    b[abs][this.cur.x] = c1
    b[abs][this.cur.x + 1] = c2
    this.cur.x += 2
    if (this.cur.x >= this.cols) { if (this.mode.wrap) { this.cur.x = 0; this.cur.y++; this._ensureRow(this.cur.y) } else this.cur.x = this.cols - 1 }
  }

  _ensureRow(y) {
    // 确保 buffer 有到屏幕顶+y 的行
    while (this._top() + y >= this._buf().length) this._pushBlankRow()
  }

  /* ---------- 换行 / 滚动 ---------- */
  _lineFeed() {
    if (this.cur.y === this.scrollBottom) {
      if (this.scrollTop === 0 && this.scrollBottom === this.rows - 1) this._scrollFullUp()
      else this._scrollRegionUp()
    } else this.cur.y++
    this._clip()
  }

  // 光标所在行上方内容上移，光标不动（用于区域滚动）
  _scrollRegionUp() {
    const top = this._top() + this.scrollTop
    const bottom = this._top() + this.scrollBottom
    const b = this._buf()
    for (let i = top; i < bottom; i++) b[i] = b[i + 1]
    b[bottom] = this._rowFromAttrs()
    this.redrawFull = true
  }
  _scrollRegionDown() {
    const top = this._top() + this.scrollTop
    const bottom = this._top() + this.scrollBottom
    const b = this._buf()
    for (let i = bottom; i > top; i--) b[i] = b[i - 1]
    b[top] = this._rowFromAttrs()
    this.redrawFull = true
  }

  _scrollFullUp() {
    // 现屏幕首行进入回滚区：screenTop++，新增底部行
    this.buffer.push(this._rowFromAttrs())
    this.screenTop++
    if (this.screenTop > this.scrollback) {
      const excess = this.screenTop - this.scrollback
      this.buffer.splice(0, excess)
      this.screenTop -= excess
    }
    this.redrawFull = true
  }

  _reverseIndex() {
    if (this.cur.y === this.scrollTop) {
      if (this.scrollTop === 0 && this.scrollBottom === this.rows - 1) this._scrollFullDown()
      else this._scrollRegionDown()
    } else this.cur.y--
    this._clip()
  }
  _scrollFullDown() {
    // 顶部插入新行（从回滚区下移）——用 buffer 前插并 screenTop--
    if (this.screenTop > 0) { this.screenTop--; return }
    this.buffer.unshift(this._rowFromAttrs())
    if (this.buffer.length > this.scrollback + this.rows) this.buffer.length = this.scrollback + this.rows
    this.redrawFull = true
  }
  _scrollUpCur() {
    if (this.scrollTop === 0 && this.scrollBottom === this.rows - 1) this._scrollFullUp()
    else this._scrollRegionUp()
  }
  _scrollDownCur() {
    if (this.scrollTop === 0 && this.scrollBottom === this.rows - 1) this._scrollFullDown()
    else this._scrollRegionDown()
  }

  _setScrollRegion() {
    const t = this._csiParams[0] || 1
    const b = this._csiParams[1] || this.rows
    this.scrollTop = Math.max(0, t - 1)
    this.scrollBottom = Math.min(this.rows - 1, b - 1)
    if (this.scrollTop >= this.scrollBottom) { this.scrollTop = 0; this.scrollBottom = this.rows - 1 }
    this.cur.x = 0; this.cur.y = 0
  }

  /* ---------- 清除 ---------- */
  _eraseDisplay(mode) {
    const b = this._buf()
    const top = this._top()
    if (mode === 2 || mode === 3) {
      for (let y = 0; y < this.rows; y++) { if (!b[top + y]) b[top + y] = this._newRow(); b[top + y] = this._rowFromAttrs() }
      this.cur.x = 0; this.cur.y = 0
    } else if (mode === 1) {
      for (let y = 0; y <= this.cur.y; y++) {
        for (let x = 0; x < (y === this.cur.y ? this.cur.x + 1 : this.cols); x++) b[top + y][x] = cloneCell(this.attrs)
      }
    } else {
      for (let y = this.cur.y; y < this.rows; y++) {
        for (let x = (y === this.cur.y ? this.cur.x : 0); x < this.cols; x++) b[top + y][x] = cloneCell(this.attrs)
      }
    }
    this.redrawFull = true
  }
  _eraseLine(mode) {
    const b = this._buf()
    const top = this._top()
    const y = this.cur.y
    if (mode === 2) { for (let x = 0; x < this.cols; x++) b[top + y][x] = cloneCell(this.attrs) }
    else if (mode === 1) { for (let x = 0; x <= this.cur.x; x++) b[top + y][x] = cloneCell(this.attrs) }
    else { for (let x = this.cur.x; x < this.cols; x++) b[top + y][x] = cloneCell(this.attrs) }
    this.redrawFull = true
  }
  _eraseChars(n) {
    const b = this._buf(); const top = this._top(); const y = this.cur.y
    for (let i = 0; i < n && this.cur.x + i < this.cols; i++) b[top + y][this.cur.x + i] = cloneCell(this.attrs)
  }

  /* ---------- 插入/删除 ---------- */
  _insertLines(n) {
    const b = this._buf(); const topAbs = this._top() + this.scrollTop
    const bottomAbs = this._top() + this.scrollBottom
    const count = Math.min(n, this.scrollBottom - this.scrollTop + 1)
    for (let k = 0; k < count; k++) {
      for (let i = bottomAbs; i > topAbs + this.cur.y; i--) b[i] = b[i - 1]
      b[topAbs + this.cur.y] = this._rowFromAttrs()
    }
    this.redrawFull = true
  }
  _deleteLines(n) {
    const b = this._buf(); const topAbs = this._top() + this.cur.y
    const bottomAbs = this._top() + this.scrollBottom
    const count = Math.min(n, bottomAbs - topAbs + 1)
    for (let k = 0; k < count; k++) {
      for (let i = topAbs; i < bottomAbs; i++) b[i] = b[i + 1]
      b[bottomAbs] = this._rowFromAttrs()
    }
    this.redrawFull = true
  }
  _deleteChars(n) {
    const b = this._buf(); const row = b[this._top() + this.cur.y]
    const count = Math.min(n, this.cols - this.cur.x)
    for (let i = this.cur.x; i + count < this.cols; i++) row[i] = row[i + count]
    for (let i = Math.max(this.cur.x, this.cols - count); i < this.cols; i++) row[i] = cloneCell(this.attrs)
  }
  _insertChars(n) {
    const b = this._buf(); const row = b[this._top() + this.cur.y]
    const count = Math.min(n, this.cols - this.cur.x)
    for (let i = this.cols - 1; i >= this.cur.x + count; i--) row[i] = row[i - count]
    for (let i = this.cur.x; i < this.cur.x + count && i < this.cols; i++) row[i] = cloneCell(this.attrs)
  }

  _tab() {
    let x = this.cur.x
    while (x < this.cols && !this.tabStops.has(x)) x++
    this.cur.x = x >= this.cols ? this.cols - 1 : x
  }

  _saveCursor() {
    this.savedCursor = { x: this.cur.x, y: this.cur.y, attrs: cloneCell(this.attrs) }
  }
  _restoreCursor() {
    if (this.savedCursor && this.savedCursor.x !== undefined) {
      this.cur.x = this.savedCursor.x; this.cur.y = this.savedCursor.y
      this.attrs = cloneCell(this.savedCursor.attrs)
      this._clip()
    }
  }

  _enterAlt() {
    if (this.mode.alt) return
    this.savedCursor = { x: this.cur.x, y: this.cur.y }
    this.altBuf = []; this.altScreenTop = 0
    for (let i = 0; i < this.rows; i++) this.altBuf.push(this._newRow())
    this.mode.alt = true
    this.cur.x = 0; this.cur.y = 0
    this.redrawFull = true
  }
  _exitAlt() {
    if (!this.mode.alt) return
    this.mode.alt = false
    if (this.savedCursor) { this.cur.x = this.savedCursor.x; this.cur.y = this.savedCursor.y }
    this.redrawFull = true
  }

  _oscEnd() {
    const m = /^(0|2);?(.*)$/s.exec(this._osc)
    if (m) this.title = m[2]
  }

  /* ---------- 裁剪回滚 ---------- */
  _trimScrollback() {
    if (!this.mode.alt && this.screenTop > this.scrollback) {
      const excess = this.screenTop - this.scrollback
      this.buffer.splice(0, excess)
      this.screenTop -= excess
    }
  }

  /* ---------- 尺寸 ---------- */
  resize(cols, rows) {
    if (cols === this.cols && rows === this.rows) return
    const oldRows = this.rows
    this.cols = cols
    for (let i = 0; i < this.buffer.length; i++) {
      const r = this.buffer[i]
      while (r.length < cols) r.push(emptyCell())
      if (r.length > cols) r.length = cols
    }
    for (let i = 0; i < this.altBuf.length; i++) {
      const r = this.altBuf[i]
      while (r.length < cols) r.push(emptyCell())
      if (r.length > cols) r.length = cols
    }
    // 行数
    while (this.screenTop + rows > this.buffer.length) this.buffer.push(this._newRow())
    if (this.screenTop + rows < this.buffer.length) { this.buffer.length = this.screenTop + rows }
    while (this.altBuf.length < rows) this.altBuf.push(this._newRow())
    if (this.altBuf.length > rows) this.altBuf.length = rows
    this.rows = rows
    if (this.scrollBottom >= rows) this.scrollBottom = rows - 1
    if (this.scrollTop >= rows) this.scrollTop = 0
    else if (this.scrollTop === 0 && this.scrollBottom === oldRows - 1) this.scrollBottom = rows - 1
    this._clip()
    this.redrawFull = true
  }

  setViewOffset(o) {
    this.viewOffset = Math.max(0, Math.min(this.maxScroll(), o))
  }
  maxScroll() {
    if (this.mode.alt) return 0
    return Math.max(0, this.screenTop)
  }

  /* ---------- 渲染网格 ---------- */
  getGrid() {
    const b = this._buf()
    const top = this._top()
    const off = Math.min(this.viewOffset, this.maxScroll())
    const start = top - off
    const grid = []
    for (let i = 0; i < this.rows; i++) {
      grid.push(b[start + i] || this._newRow())
    }
    return { grid, cur: Object.assign({}, this.cur), cursorVisible: this.mode.cursorVisible }
  }

  getTitle() { return this.title }
  consumeBell() { const b = this.bell; this.bell = false; return b }

  // 供选区/测试
  lineText(relY) {
    const row = this.getGrid().grid[relY]
    let s = ''
    for (const c of row) s += c.skip ? '' : c.ch
    return s
  }
}

export function ctrlSequence(key, e) {
  if (e.ctrlKey) return String.fromCharCode(key.charCodeAt(0) - 96)
  if (e.altKey) return '\x1b' + key
  return key
}