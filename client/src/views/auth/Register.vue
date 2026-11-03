<template>
  <div class="card-container p-4">
    <h4 class="text-center mb-4 fw-bold">用户注册</h4>
    <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleRegister">
      <el-form-item prop="username">
        <el-input v-model="form.username" placeholder="用户名" prefix-icon="User" size="large" />
      </el-form-item>
      <el-form-item prop="email">
        <el-input v-model="form.email" placeholder="邮箱" prefix-icon="Message" size="large" />
      </el-form-item>
      <el-form-item prop="password">
        <el-input v-model="form.password" type="password" placeholder="密码（至少8位）" prefix-icon="Lock" size="large" show-password />
      </el-form-item>
      <el-form-item label="账号身份">
        <el-radio-group v-model="form.role">
          <el-radio-button label="tenant">我是租客</el-radio-button>
          <el-radio-button label="user">我是中介/房源方</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" prefix-icon="Lock" size="large" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" native-type="submit" class="w-100" size="large">
          注 册
        </el-button>
      </el-form-item>
    </el-form>
    <div class="text-center mt-3">
      <router-link to="/auth/login" class="text-primary small">已有账号？立即登录</router-link>
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
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'tenant',
})

onMounted(() => {
  if (route.query.role === 'user' || route.query.role === 'tenant') {
    form.role = route.query.role
  }
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少8个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.register(form)
    ElMessage.success('注册成功')
    router.push(form.role === 'tenant' ? '/tenant/dashboard' : '/user/dashboard')
  } catch (err) {
    // Error handled by axios interceptor
  } finally {
    loading.value = false
  }
}
</script>
