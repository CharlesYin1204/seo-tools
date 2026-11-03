<template>
  <div class="agent-settings">
    <div class="page-header">
      <h3 class="page-title"><i class="fas fa-cog me-2"></i>个人设置</h3>
    </div>

    <div class="card-container" v-loading="loading">
      <el-form :model="form" label-width="100px" class="max-w-600">
        <el-form-item label="简介">
          <el-input v-model="form.bio" type="textarea" :rows="5" placeholder="请输入您的简介或个人介绍..." />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const submitting = ref(false)
const form = reactive({ bio: '', phone: '' })

onMounted(() => loadSettings())

async function loadSettings() {
  loading.value = true
  try {
    const res = await api.get('/agent/settings')
    const data = res.data || {}
    const profile = data.profile || {}
    form.bio = profile.bio || ''
    form.phone = profile.phone || ''
  } catch (e) {
    console.error('加载设置失败:', e)
  }
  loading.value = false
}

async function saveSettings() {
  submitting.value = true
  try {
    await api.post('/agent/settings', {
      description: form.bio,
      contact_phone: form.phone,
    })
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
  submitting.value = false
}
</script>

<style scoped>
.agent-settings .page-header {
  margin-bottom: 20px;
}
.agent-settings .page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
}
.agent-settings .card-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.agent-settings .max-w-600 {
  max-width: 600px;
}
.me-2 { margin-right: 8px; }
</style>
