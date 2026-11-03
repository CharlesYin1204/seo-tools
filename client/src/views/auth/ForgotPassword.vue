<template>
  <div class="card-container p-4">
    <h4 class="text-center mb-4 fw-bold">忘记密码</h4>
    <el-form ref="formRef" :model="form" @submit.prevent="handleSubmit">
      <el-form-item>
        <el-input v-model="form.email" placeholder="请输入注册邮箱" prefix-icon="Message" size="large" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" native-type="submit" class="w-100" size="large">发送重置链接</el-button>
      </el-form-item>
    </el-form>
    <div class="text-center mt-3">
      <router-link to="/auth/login" class="text-primary small">返回登录</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const form = reactive({ email: '' })

function handleSubmit() {
  if (!form.email) return ElMessage.warning('请输入邮箱')
  loading.value = true
  setTimeout(() => {
    ElMessage.success('重置链接已发送到您的邮箱')
    loading.value = false
  }, 1000)
}
</script>
