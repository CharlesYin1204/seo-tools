import api from '@/api'

export const wechatRobotApi = {
  // 账号管理
  getAccounts: () => api.get('/user/wechat-robot/accounts'),
  addAccount: (data) => api.post('/user/wechat-robot/accounts', data),
  deleteAccount: (id) => api.delete(`/user/wechat-robot/accounts/${id}`),
  getLoginQrCode: () => api.get('/user/wechat-robot/login-qrcode'),
  getStats: () => api.get('/user/wechat-robot/stats'),
  getQrCode: (robotId, regionId) => api.get(`/user/wechat-robot/qrcode/${robotId}`, { params: { region_id: regionId } }),
  checkLoginStatus: (robotId) => api.get(`/user/wechat-robot/check-status/${robotId}`),
  checkDeviceStatus: (robotId) => api.get(`/user/wechat-robot/check-device-status/${robotId}`),
  logoutAccount: (robotId) => api.post(`/user/wechat-robot/logout/${robotId}`),

  // API配置
  getApiConfig: () => api.get('/user/wechat-robot/api-config'),
  saveApiConfig: (data) => api.post('/user/wechat-robot/api-config', data),

  // 通讯录
  getContacts: (robotId, params) => api.get(`/user/wechat-robot/${robotId}/contacts`, { params }),
  syncContacts: (robotId) => api.post(`/user/wechat-robot/${robotId}/contacts/sync`),

  // 消息
  getConversations: (robotId) => api.get(`/user/wechat-robot/${robotId}/conversations`),
  getChatHistory: (robotId, wxid, params) => api.get(`/user/wechat-robot/${robotId}/messages/${wxid}`, { params }),
  sendMessage: (robotId, data) => api.post(`/user/wechat-robot/${robotId}/messages`, data),

  // 群组
  getGroups: (robotId, params) => api.get(`/user/wechat-robot/${robotId}/groups`, { params }),
  syncGroups: (robotId) => api.post(`/user/wechat-robot/${robotId}/groups/sync`),

  // 朋友圈
  getMoments: (robotId, params) => api.get(`/user/wechat-robot/${robotId}/moments`, { params }),
  refreshMoments: (robotId) => api.post(`/user/wechat-robot/${robotId}/moments/refresh`),

  // 自动回复
  getAutoReplies: (robotId) => api.get(`/user/wechat-robot/${robotId}/auto-replies`),
  saveAutoReply: (robotId, data) => api.post(`/user/wechat-robot/${robotId}/auto-replies`, data),
  deleteAutoReply: (robotId, ruleId) => api.delete(`/user/wechat-robot/${robotId}/auto-replies/${ruleId}`),

  // 素材库
  getMaterials: (params) => api.get('/user/wechat-robot/materials', { params }),
  getMaterialCategories: () => api.get('/user/wechat-robot/material-categories'),
  saveMaterial: (data) => api.post('/user/wechat-robot/materials', data),
  deleteMaterial: (id) => api.delete(`/user/wechat-robot/materials/${id}`),

  // 定时发送
  getScheduledTasks: (robotId, params) => api.get(`/user/wechat-robot/${robotId}/scheduled-tasks`, { params }),
  saveScheduledTask: (robotId, data) => api.post(`/user/wechat-robot/${robotId}/scheduled-tasks`, data),
  deleteScheduledTask: (robotId, taskId) => api.delete(`/user/wechat-robot/${robotId}/scheduled-tasks/${taskId}`),
  getTaskLogs: (robotId, taskId) => api.get(`/user/wechat-robot/${robotId}/scheduled-tasks/${taskId}/logs`),

  // 朋友圈解析
  getParsedProperties: (params) => api.get('/user/expat/parsed-properties', { params }),
  getParsedPropertyStats: () => api.get('/user/expat/parsed-properties/stats'),
  getParsedPropertyFilters: () => api.get('/user/expat/parsed-properties/filters'),
  updateParsedProperty: (id, data) => api.put(`/user/expat/parsed-properties/${id}`, data),
  deleteParsedProperty: (id) => api.delete(`/user/expat/parsed-properties/${id}`),
  batchDeleteParsedProperties: (ids) => api.post('/user/expat/parsed-properties/batch-delete', { ids }),
  parseMoments: (data) => api.post('/user/expat/parse-moments', data),
  searchCommunityPOI: (params) => api.get('/user/expat/parsed-properties/search-poi', { params }),
  bulkReprocessCommunity: (data) => api.post('/user/expat/parsed-properties/bulk-reprocess', data),

  // 搜索列表
  getSearchLists: () => api.get('/user/expat/search-lists'),
  createSearchList: (data) => api.post('/user/expat/search-lists', data),
  deleteSearchList: (id) => api.delete(`/user/expat/search-lists/${id}`),

  // AI自动回复配置
  getAiConfig: (robotId) => api.get(`/user/wechat-robot/${robotId}/ai-config`),
  saveAiConfig: (robotId, data) => api.post(`/user/wechat-robot/${robotId}/ai-config`, data),

  // 联系人标签
  getContactTags: (robotId) => api.get(`/user/wechat-robot/${robotId}/contact-tags`),
  saveContactTag: (robotId, data) => api.post(`/user/wechat-robot/${robotId}/contact-tags`, data),
  deleteContactTag: (robotId, tagId) => api.delete(`/user/wechat-robot/${robotId}/contact-tags/${tagId}`),

  // 收藏夹
  getFavorites: (robotId, params, prefix = '/user') => api.get(`${prefix}/wechat-robot/${robotId}/favorites`, { params }),
  syncFavorites: (robotId, data = {}, prefix = '/user') => api.post(`${prefix}/wechat-robot/${robotId}/favorites/sync`, data, { timeout: 180000 }),
  addFavorite: (robotId, data, prefix = '/user') => api.post(`${prefix}/wechat-robot/${robotId}/favorites`, data),
  deleteFavorite: (robotId, favoriteId, prefix = '/user') => api.delete(`${prefix}/wechat-robot/${robotId}/favorites/${favoriteId}`),

  // 视频号
  getFinderChannels: (robotId, params) => api.get(`/user/wechat-robot/${robotId}/finder`, { params }),
  syncFinder: (robotId) => api.post(`/user/wechat-robot/${robotId}/finder/sync`),
}
