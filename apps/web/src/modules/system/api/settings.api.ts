import http from '@/api/client'
import type { Settings } from '../types/settings'

export const settingsApi = {
  /** 相对路径，勿重复添加 /api/v1（client baseURL 已含） */
  get: () => http.get<Settings>('/settings'),
  update: (data: Settings) => http.put<Settings>('/settings', data),
}
