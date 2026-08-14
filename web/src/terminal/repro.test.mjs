import { VT100Terminal } from './vt100.js'
import { readFileSync } from 'fs'

const data = readFileSync('C:/Users/fongwuyan/AppData/Local/Temp/opencode/cap.raw', 'utf8')
const t = new VT100Terminal({ cols: 80, rows: 24, scrollback: 5000 })
t.write(data)
console.log('maxScroll:', t.maxScroll())
console.log('viewOffset:', t.viewOffset)
console.log('screenTop:', t.screenTop, 'buffer.length:', t.buffer.length)
const g = t.getGrid()
console.log('=== visible bottom (offset 0) line0 ===')
console.log(JSON.stringify(t.lineText(0)))
console.log('=== visible line23 ===')
console.log(JSON.stringify(t.lineText(23)))
console.log('=== cur ===', JSON.stringify(g.cur))
console.log('=== scroll up maxScroll, line0 ===')
t.setViewOffset(t.maxScroll())
console.log(JSON.stringify(t.lineText(0)))
console.log('ALL DONE')