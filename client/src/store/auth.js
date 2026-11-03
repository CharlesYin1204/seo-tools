/**
 * 用户认证状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/modules/auth'
import router from '@/router'

/** 公开认证设置：只拉取一次，并发调用共用一个 Promise */
let publicSettingsLoaded = false
let publicSettingsPromise = null

function safeParseUser() {
  try {
    const raw = localStorage.getItem('user')
    if (!raw || raw === 'undefined') return null
    return JSON.parse(raw)
  } catch { return null }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(safeParseUser())
  const rawToken = localStorage.getItem('token')
  const token = ref(rawToken && rawToken !== 'undefined' ? rawToken : '')

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isTenant = computed(() => user.value?.role === 'tenant')
  const displayName = computed(() => user.value?.display_name || user.value?.username || '')

  /** 与后台「登录注册配置」一致：关闭注册时为 false */
  const allowRegister = ref(true)

  async function login(credentials) {
    const res = await authApi.login(credentials)
    setAuth(res.data)
    return res
  }

  async function register(userData) {
    const res = await authApi.register(userData)
    setAuth(res.data)
    return res
  }

  function setAuth(data) {
    user.value = data.user
    token.value = data.token
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.setItem('token', data.token)
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    clearAuth()
    router.push('/auth/login')
  }

  function clearAuth() {
    user.value = null
    token.value = ''
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  /**
   * 拉取公开认证设置（含 auth_allow_register），供登录页/导航判断是否显示注册入口
   */
  async function fetchPublicSettings() {
    if (publicSettingsLoaded) return
    if (publicSettingsPromise) return publicSettingsPromise
    publicSettingsPromise = (async () => {
      try {
        const res = await authApi.getPublicSettings()
        const data = res.data || {}
        allowRegister.value = data.allow_register !== false && data.allow_register !== 'false' && data.allow_register !== '0'
      } catch {
        allowRegister.value = true
      } finally {
        publicSettingsLoaded = true
        publicSettingsPromise = null
      }
    })()
    return publicSettingsPromise
  }

  /** 强制下次再拉取（例如管理端刚改了注册开关） */
  function resetPublicSettingsCache() {
    publicSettingsLoaded = false
    publicSettingsPromise = null
  }

  async function fetchProfile() {
    try {
      const res = await authApi.getProfile()
      user.value = res.data
      localStorage.setItem('user', JSON.stringify(res.data))
    } catch (err) {
      // 401 由 Axios 拦截器处理（清除 localStorage + 跳转登录）
      // 这里只处理非 401 的异常，不再主动清除认证避免页面闪白
      const status = err?.response?.status
      if (status === 401) return
      console.warn('[auth] fetchProfile 非 401 异常:', err?.message)
    }
  }

  return {
    user,
    token,
    isLoggedIn,
    isAdmin,
    isTenant,
    displayName,
    allowRegister,
    login,
    register,
    setAuth,
    logout,
    clearAuth,
    fetchProfile,
    fetchPublicSettings,
    resetPublicSettingsCache,
  }
})
