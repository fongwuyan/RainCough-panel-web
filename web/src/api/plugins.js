// 插件 API: 注册表 + 网关代理 + 设置。
import { request } from './client'

export const pluginsApi = {
  list: () => request.get('/api/plugins'),
  info: (name) => request.get(`/api/plugins/${name}/info`),
  call: (name, subpath, method = 'GET', data, timeout) => {
    const url = `/api/plugins/${name}/${subpath}`
    switch (method) {
      case 'POST': return request.post(url, data, timeout)
      case 'DELETE': return request.del(url, timeout)
      default: return request.get(url, timeout)
    }
  },
  install: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request.form('/api/plugins/install', fd)
  },
  remove: (name) => request.del(`/api/plugins/${name}`),
  settings: (name) => request.get(`/api/plugins/${name}/settings`),
  saveSettings: (name, data) => request.post(`/api/plugins/${name}/settings`, data),
  // 插件前端构建产物(远程组件挂载)
  assetUrl: (name, entry) => `/api/plugins/${name}/assets/${entry.replace(/^\//, '')}`,
}