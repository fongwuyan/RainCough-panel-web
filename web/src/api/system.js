// 系统核心 API(TODO M4 前保持与旧后端契约一致)
import { request } from './client'

export const systemApi = {
  info: (timeout) => request.get('/api/system', timeout),
  storage: () => request.get('/api/storage'),
  disks: () => request.get('/api/disks'),
  diskUnmount: (device) => request.post('/api/disks/unmount', { device }),
  saveStorage: (plugin, cfg) => request.post(`/api/plugins/${plugin}/config`, cfg),
  logs: (params) => request.get(`/api/sys/logs?${new URLSearchParams(params || {})}`),
}