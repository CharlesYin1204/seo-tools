import api from '@/api'

export const authApi = {
  /** 公开：是否开放注册等（无需登录） */
  getPublicSettings: () => api.get('/auth/settings'),
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  phoneLogin: (data) => api.post('/auth/phone-login', data),
  logout: () => api.get('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
}
