// 统一请求封装: 轻量 fetch 包装, 支持 JSON/FormData, 错误规范化。
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function req(method, url, body, isForm, timeout = 30000) {
  const opts = { method, headers: {} }
  if (body) {
    if (isForm) {
      opts.body = body
    } else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  if (ctrl) {
    opts.signal = ctrl.signal
    setTimeout(() => ctrl.abort(), timeout)
  }
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError((data && data.error) || `HTTP ${res.status}`, res.status)
  }
  return data
}

export function reqForm(url, fd) {
  return req('POST', url, fd, true)
}

export const request = {
  get: (url, timeout) => req('GET', url, null, false, timeout),
  post: (url, data, timeout) => req('POST', url, data ?? {}, false, timeout),
  put: (url, data, timeout) => req('PUT', url, data ?? {}, false, timeout),
  del: (url, timeout) => req('DELETE', url, null, false, timeout),
  form: (url, fd, timeout) => req('POST', url, fd, true, timeout),
}