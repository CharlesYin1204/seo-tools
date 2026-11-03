<template>
  <div>
    <div class="page-header"><h3 class="page-title">主题管理</h3></div>

    <div v-loading="loading">
      <div class="row g-4" v-if="themes.length">
        <div class="col-md-4" v-for="theme in themes" :key="theme.id">
          <el-card :class="['h-100', { 'border-primary': theme.active }]" shadow="hover">
            <div class="text-center mb-3">
              <div class="p-4 rounded mb-3" :style="{ background: theme.preview_color || '#f5f5f5' }">
                <el-icon :size="48" color="#fff"><Monitor /></el-icon>
              </div>
              <h5>{{ theme.name }}</h5>
              <p class="text-muted small">{{ theme.description }}</p>
            </div>
            <div class="text-center">
              <el-tag v-if="theme.active" type="success" class="mb-2">当前主题</el-tag>
              <br>
              <el-button v-if="!theme.active" type="primary" size="small" @click="activateTheme(theme)">激活主题</el-button>
            </div>
          </el-card>
        </div>
      </div>
      <el-empty v-else description="暂无可用主题" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { Monitor } from '@element-plus/icons-vue'

const themes = ref([])
const loading = ref(false)

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/themes')
    themes.value = res.data || []
  } catch {}
  loading.value = false
}

async function activateTheme(theme) {
  try {
    await api.post('/admin/themes/activate', { theme_id: theme.id })
    ElMessage.success('主题已激活')
    loadData()
  } catch {}
}
</script>
