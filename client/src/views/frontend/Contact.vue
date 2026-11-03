<template>
  <div class="container py-5">
    <h2 class="fw-bold text-center mb-4">联系我们</h2>
    <div class="row justify-content-center">
      <div class="col-lg-6">
        <div class="card-container">
          <el-form :model="form" label-position="top">
            <el-form-item label="姓名"><el-input v-model="form.name" placeholder="您的姓名" /></el-form-item>
            <el-form-item label="邮箱"><el-input v-model="form.email" placeholder="您的邮箱" /></el-form-item>
            <el-form-item label="消息"><el-input v-model="form.message" type="textarea" :rows="4" placeholder="请输入您的消息" /></el-form-item>
            <el-button type="primary" class="w-100" @click="submit">发送消息</el-button>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'

const form = reactive({ name: '', email: '', message: '' })

function submit() {
  ElMessage.success('消息已发送，我们会尽快回复您')
  Object.assign(form, { name: '', email: '', message: '' })
}
</script>
