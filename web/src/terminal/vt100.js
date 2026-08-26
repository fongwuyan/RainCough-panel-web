// vt100 — 极简 VT100/ANSI 终端模拟器(支持 CSI 序列: 光标移动/颜色/清屏/滚动)
// 供终端页渲染用; scrollback 保留历史行。

class VT100Terminal {
  constructor(opts = {}) {
    this.cols = opts.cols || 80
    this.rows = opts.rows || 24
    this.scrollback = opts.scrollback || 5000
    this.reset()
  }

  reset() {
    this.grid = []            // 每行: array of {ch, fg, bg, bold, dim}
    this.scroll = []          // scrollback 行(移出屏幕的)
    this.x = 0
    this.y = 0
    this.fg = 7
    this.bg = 0
    this.bold = false
    this.dim = false
    this.saved = null
    this._pending = ''        // 未完成的 UTF-8 字节
    this._buf = ''            // ANSI 序列缓冲(遇到 ESC 开始)
    this._bufRaw = ''
    this.alt = null           // 备用屏(简化为空)
    for (let r = 0; r < this.rows; r++) this.grid.push(this.blankRow())
  }

  blankRow() {
    const row = []
    for (let c = 0; c < this.cols; c++) row.push({ ch: ' ', fg: 7, bg: 0, bold: false, dim: false })
    return row
  }

  write(text) {
    // 增量 UTF-8 解码
    const bytes = this._pending + text
    const out = []
    let i = 0
    while (i < bytes.length) {
      const b = bytes.charCodeAt(i)
      if (b < 0x80) { out.push(bytes[i]); i++; continue }
      let len = 1, cp
      if ((b >> 5) === 0x6) { len = 2; cp = b & 0x1f }
      else if ((b >> 4) === 0xe) { len = 3; cp = b & 0x0f }
      else if ((b >> 3) === 0x1e) { len = 4; cp = b & 0x07 }
      else { out.push('\ufffd'); i++; continue }
      if (i + len > bytes.length) { this._pending = bytes.slice(i); return }
      for (let k = 1; k < len; k++) {
        const nb = bytes.charCodeAt(i + k)
        if ((nb >> 6) !== 0x2) { i += len; cp = 0xfffd; break }
        cp = (cp << 6) | (nb & 0x3f)
      }
      out.push(String.fromCodePoint(cp))
      i += len
    }
    this._pending = ''
    const s = out.join('')
    for (const ch of s) this.handleChar(ch)
  }

  handleChar(ch) {
    // ANSI 转义处理
    if (this._bufRaw !== '') {
      this._bufRaw += ch
      if (ch === '[') { this._buf = ''; return }         // ESC[
      if (ch === ']') { this._osc = ''; return }          // OSC(忽略至 BEL)
      if (ch === '\\' || ch === '^' || ch === '_' || ch === 'P' || ch === ']') { this._bufRaw = ''; return }
      // 单字符转义(ESC 7/8/c/=/>/M/E/D ...)
      this._bufRaw = ''
      if (ch === '7') this.saved = { x: this.x, y: this.y, fg: this.fg, bg: this.bg }
      else if (ch === '8' && this.saved) { this.x = this.saved.x; this.y = this.saved.y; this.fg = this.saved.fg; this.bg = this.saved.bg }
      else if (ch === 'c') this.reset()
      else if (ch === 'D') { if (this.y < this.rows - 1) this.y++ }
      else if (ch === 'M') { if (this.y > 0) this.y-- }
      else if (ch === 'E') { this.y = Math.min(this.rows - 1, this.y + 1); this.x = 0 }
      else if (ch === '=' || ch === '>') { /* 模式, 忽略 */ }
      return
    }
    if (ch === '\x1b') { this._bufRaw = '\x1b'; return }
    if (this._osc !== undefined) {
      if (ch === '\x07') this._osc = undefined
      return
    }
    if (ch === '\x07') return // BEL
    if (this._buf !== '') { this._buf += ch; if (this.dispatchCsi(this._buf)) this._buf = ''; return }
    switch (ch) {
      case '\n': this.linefeed(); break
      case '\r': this.x = 0; break
      case '\b': if (this.x > 0) this.x--; break
      case '\t': this.x = Math.min(this.cols - 1, this.x + 8 - (this.x % 8)); break
      case '\x0f': /* 普通字符集 */ break
      default: this.putChar(ch)
    }
  }

  putChar(ch) {
    const row = this.grid[this.y]
    if (this.x >= this.cols) { this.linefeed(); this.x = 0; }
    const cell = row[this.x]
    cell.ch = ch; cell.fg = this.fg; cell.bg = this.bg; cell.bold = this.bold; cell.dim = this.dim
    this.x++
  }

  linefeed() {
    if (this.y === this.rows - 1) { this.scrollLines(1) }
    else this.y++
  }

  scrollLines(n) {
    const removed = this.grid.splice(0, n)
    this.scroll.push(...removed.map((r) => this.rowText(r)))
    if (this.scroll.length > this.scrollback) this.scroll.splice(0, this.scroll.length - this.scrollback)
    for (let i = 0; i < n; i++) this.grid.push(this.blankRow())
  }

  rowText(row) { return row.map((c) => c.ch).join('') }

  // CSI dispatch; buf 形如 "0;31m" / "2J" / "10A" ...
  dispatchCsi(buf) {
    const m = buf.match(/^([0-9;?]*)([A-Za-z@`])$/)
    if (!m) return false // 未完
    const params = m[1] ? m[1].split(';').map((p) => (p === '' ? 0 : parseInt(p, 10) || 0)) : [0]
    const final = m[2]
    switch (final) {
      case 'A': this.y = Math.max(0, this.y - (params[0] || 1)); break
      case 'B': this.y = Math.min(this.rows - 1, this.y + (params[0] || 1)); break
      case 'C': this.x = Math.min(this.cols - 1, this.x + (params[0] || 1)); break
      case 'D': this.x = Math.max(0, this.x - (params[0] || 1)); break
      case 'G': this.x = Math.max(0, Math.min(this.cols - 1, (params[0] || 1) - 1)); break
      case 'd': this.y = Math.max(0, Math.min(this.rows - 1, (params[0] || 1) - 1)); break
      case 'H': case 'f': {
        const r = (params[0] || 1) - 1, c = (params[1] || 1) - 1
        this.y = Math.max(0, Math.min(this.rows - 1, r)); this.x = Math.max(0, Math.min(this.cols - 1, c)); break
      }
      case 'J': {
        if ((params[0] || 0) === 2 || (params[0] || 0) === 3) for (let r = 0; r < this.rows; r++) this.grid[r] = this.blankRow()
        else if ((params[0] || 0) === 1) { for (let c = 0; c <= this.x; c++) this.grid[this.y][c] = this.blankRow()[c] }
        else { for (let c = this.x; c < this.cols; c++) this.grid[this.y][c] = this.blankRow()[c] }
        break
      }
      case 'K': {
        const r = this.grid[this.y]
        if ((params[0] || 0) === 2) for (let c = 0; c < this.cols; c++) r[c] = this.blankRow()[c]
        else if ((params[0] || 0) === 1) for (let c = 0; c <= this.x; c++) r[c] = this.blankRow()[c]
        else for (let c = this.x; c < this.cols; c++) r[c] = this.blankRow()[c]
        break
      }
      case 'm': this.setSgr(params); break
      case 'L': this.scrollLines(1); break
      case 'M': this.scrollLines(1); break
      case 'S': this.scrollLines(params[0] || 1); break
      case 'T': this.scrollLines(params[0] || 1); break
      case 'r': {/* 滚动区, 简化 */} break
      case 'h': case 'l': break // 模式设置
      case 't': break
      default: break
    }
    return true
  }

  setSgr(params) {
    const p = params[0] || 0
    if (p === 0) { this.fg = 7; this.bg = 0; this.bold = false; this.dim = false; return }
    if (p === 1) this.bold = true
    else if (p === 2 || p === 22) { this.dim = true; this.bold = p === 2 }
    else if (p >= 30 && p <= 37) this.fg = p - 30
    else if (p === 38 || p === 48) { /* true color 简化: 取下一参数 */ }
    else if (p >= 40 && p <= 47) this.bg = p - 40
    else if (p === 90 || p === 91 || p === 92 || p === 93 || p === 94 || p === 95 || p === 96 || p === 97) this.fg = p - 90 + 8
    else if (p === 100 || p === 101 || p === 102 || p === 103 || p === 104 || p === 105 || p === 106 || p === 107) this.bg = p - 100 + 8
  }

  // 渲染成带颜色的 DOM 行数组(纯文本行 + 每行 cells, 供 TerminalDom 用)
  renderLines() {
    const out = []
    for (const row of this.grid) {
      out.push({
        text: row.map((c) => c.ch).join(''),
        cells: row.map((c) => ({ ch: c.ch, fg: c.fg, bg: c.bg, bold: c.bold, dim: c.dim })),
      })
    }
    return out
  }

  // 存取 scrollback 全文
  toText() {
    const sb = this.scroll.slice(-2000)
    return sb.concat(this.grid.map((r) => this.rowText(r))).join('\n')
  }
}

export { VT100Terminal }