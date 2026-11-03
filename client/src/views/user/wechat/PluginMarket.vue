<template>
  <div>
    <div class="page-header"><h3 class="page-title">插件市场</h3></div>

    <div v-loading="loading">
      <div class="row g-4" v-if="plugins.length">
        <div class="col-md-4 col-lg-3" v-for="plugin in plugins" :key="plugin.id">
          <el-card shadow="hover" class="h-100">
            <div class="text-center mb-3">
              <el-icon :size="48" color="var(--primary-color)"><component :is="plugin.icon || 'Opportunity'" /></el-icon>
            </div>
            <h5 class="text-center">{{ plugin.name }}</h5>
            <p class="text-muted small text-center">{{ plugin.description }}</p>
            <div class="text-center mt-auto">
              <el-button v-if="plugin.installed" type="danger" size="small" @click="uninstall(plugin)">卸载</el-button>
              <el-button v-else type="primary" size="small" @click="install(plugin)">安装</el-button>
            </div>
          </el-card>
        </div>
      </div>
      <el-empty v-else description="暂无可用插件" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const plugins = ref([])
const loading = ref(false)

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/user/wechat/plugin-market')
    plugins.value = res.data || []
  } catch {}
  loading.value = false
}

async function install(plugin) {
  try {
    await api.post('/user/wechat/plugin-market/install', { plugin_id: plugin.id })
    ElMessage.success('安装成功')
    plugin.installed = true
  } catch {}
}

async function uninstall(plugin) {
  try {
    await api.post('/user/wechat/plugin-market/uninstall', { plugin_id: plugin.id })
    ElMessage.success('卸载成功')
    plugin.installed = false
  } catch {}
}
</script>
