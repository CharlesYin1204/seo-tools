<template>
  <div>
    <div class="page-header"><h3 class="page-title">首页设置</h3></div>
    <el-card>
      <el-form :model="config" label-width="120px" v-loading="loading">
        <el-form-item label="横幅标题"><el-input v-model="config.banner_title" /></el-form-item>
        <el-form-item label="横幅副标题"><el-input v-model="config.banner_subtitle" /></el-form-item>
        <el-form-item label="横幅图片"><el-input v-model="config.banner_image" placeholder="图片URL" /></el-form-item>
        <el-form-item label="显示搜索框"><el-switch v-model="config.show_search" /></el-form-item>
        <el-form-item label="显示推荐内容资产"><el-switch v-model="config.show_featured" /></el-form-item>
        <el-form-item label="推荐数量"><el-input-number v-model="config.featured_count" :min="1" :max="20" /></el-form-item>
        <el-form-item label="显示统计"><el-switch v-model="config.show_stats" /></el-form-item>
        <el-form-item label="显示博客"><el-switch v-model="config.show_blog" /></el-form-item>
        <el-form-item><el-button type="primary" :loading="saving" @click="saveConfig">保存设置</el-button></el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const config = ref({ show_search: true, show_featured: true, featured_count: 6, show_stats: true, show_blog: true })
const loading = ref(false)
const saving = ref(false)

onMounted(() => loadConfig())

async function loadConfig() {
  loading.value = true
  try {
    const res = await api.get('/admin/homepage-settings')
    if (res.data) config.value = { ...config.value, ...res.data }
  } catch {}
  loading.value = false
}

async function saveConfig() {
  saving.value = true
  try {
    await api.post('/admin/homepage-settings', config.value)
    ElMessage.success('保存成功')
  } catch {}
  saving.value = false
}
</script>
