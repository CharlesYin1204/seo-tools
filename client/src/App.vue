<template>
  <router-view />
</template>

<script setup>
import { onMounted, onErrorCaptured } from 'vue'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()

onErrorCaptured((err, instance, info) => {
  console.error('[App] 全局组件错误:', err, info)
  return false
})

onMounted(async () => {
  try {
    await authStore.fetchPublicSettings()
  } catch {
    /* ignore */
  }
  if (authStore.token) {
    try {
      await authStore.fetchProfile()
    } catch (err) {
      console.error('[App] fetchProfile failed:', err)
      // 不再主动清除认证，401 由 Axios 拦截器统一处理
    }
  }
})
</script>
