// 剪贴板工具：优先 navigator.clipboard（https/localhost），
// 否则回退到隐藏 textarea + document.execCommand('copy')（http 环境可用）

function execCopyFallback(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.top = '-10000px'
  ta.style.left = '-10000px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try { ok = document.execCommand('copy') } catch (e) { ok = false }
  document.body.removeChild(ta)
  return ok
}

export async function copyText(text) {
  if (typeof text !== 'string') text = String(text == null ? '' : text)
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) { /* 继续走回退 */ }
  return execCopyFallback(text)
}

export async function readText() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText()
    }
  } catch (e) { /* 不可用 */ }
  return null
}
