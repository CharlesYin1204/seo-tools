<template>
  <div class="card-container p-4">
    <h4 class="text-center mb-4 fw-bold">用户登录</h4>
    <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
      <el-form-item prop="username">
        <el-input v-model="form.username" placeholder="用户名或邮箱" prefix-icon="User" size="large" />
      </el-form-item>
      <el-form-item prop="password">
        <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" native-type="submit" class="w-100" size="large">
          登 录
        </el-button>
      </el-form-item>
    </el-form>
    <div class="text-center mt-3">
      <template v-if="authStore.allowRegister">
        <router-link to="/auth/register" class="text-primary small">没有账号？立即注册</router-link>
        <span class="mx-2 text-muted">|</span>
      </template>
      <router-link to="/auth/forgot-password" class="text-muted small">忘记密码</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

onMounted(async () => {
  await authStore.fetchPublicSettings()
  if (route.query.reason === 'register_closed') {
    ElMessage.warning('当前未开放新用户注册，如有需要请联系管理员')
  }
})
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名或邮箱', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.login(form)
    ElMessage.success('登录成功')
    const defaultPath = authStore.user?.role === 'tenant' ? '/tenant/dashboard' : '/user/dashboard'
    const redirect = route.query.redirect || defaultPath
    router.push(redirect)
  } catch (err) {
    // Error handled by axios interceptor
  } finally {
    loading.value = false
  }
}
</script>
