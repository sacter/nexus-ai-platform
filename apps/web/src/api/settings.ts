import http from './client'
export const settingsApi = {
  get: () => http.get('/api/v1/settings'),
  update: (data: unknown) => http.patch('/api/v1/settings', data),
}
