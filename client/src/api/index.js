/**
 * Axios HTTP客户端配置
 * 统一API请求处理
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const LONG_RUNNING_API_TIMEOUT = 180000
const DATA_HEAVY_API_TIMEOUT = 120000
const LONG_RUNNING_API_PATHS = ['/user/expat/parse-moments']
const DATA_HEAVY_API_PATHS = [
  '/user/expat/parsed-properties',
  '/admin/property-library',
  '/admin/moments-parsed-list',
]

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let isHandling401 = false

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    const requestUrl = String(config.url || '')
    if (LONG_RUNNING_API_PATHS.some((path) => requestUrl.includes(path))) {
      config.timeout = Math.max(Number(config.timeout) || 0, LONG_RUNNING_API_TIMEOUT)
    } else if (DATA_HEAVY_API_PATHS.some((path) => requestUrl.includes(path))) {
      config.timeout = Math.max(Number(config.timeout) || 0, DATA_HEAVY_API_TIMEOUT)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器：校验 success 并自动解包 data.data → response.data
api.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && body.success === false) {
      if (!response.config?.suppressGlobalError) ElMessage.error(body.message || '操作失败')
      const apiError = new Error(body.message || '操作失败')
      apiError.response = response
      return Promise.reject(apiError)
    }
    if (body && body.data !== undefined) {
      if (body.pagination) {
        response.data = { data: body.data, pagination: body.pagination, total: body.pagination.total }
      } else {
        response.data = body.data
      }
    }
    return response
  },
  (error) => {
    if (axios.isCancel(error) || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
      return Promise.reject(error)
    }
    if (error.config?.suppressGlobalError) {
      return Promise.reject(error)
    }
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          if (!isHandling401) {
            isHandling401 = true
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            ElMessage.error('登录已过期，请重新登录')
            router.push('/auth/login').finally(() => {
              setTimeout(() => { isHandling401 = false }, 2000)
            })
          }
          break
        case 403:
          if (data?.code !== 'FEATURE_REQUIRED') {
            ElMessage.error(data?.message || '没有权限')
          }
          break
        case 404:
          ElMessage.error('资源不存在')
          break
        case 429:
          ElMessage.error(data?.message || '请求过于频繁，请稍后再试')
          break
        default:
          ElMessage.error(data?.message || '服务器错误')
      }
    } else {
      ElMessage.error('网络错误，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

export default api
