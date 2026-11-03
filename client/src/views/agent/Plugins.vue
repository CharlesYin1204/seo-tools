<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">插件管理</h3>
      <router-link to="/agent/market" class="btn btn-outline-primary btn-sm">
        <i class="fas fa-store me-1"></i>应用市场
      </router-link>
    </div>

    <div v-loading="loading" class="row g-3">
      <div v-for="plugin in plugins" :key="plugin.id" class="col-md-6 col-lg-4">
        <el-card shadow="hover" class="plugin-card">
          <div class="d-flex align-items-start gap-3">
            <div class="plugin-icon">
              <i :class="plugin.icon || 'fas fa-puzzle-piece'"></i>
            </div>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <h5 class="plugin-name mb-0">{{ plugin.name }}</h5>
                <el-tag size="small" :type="plugin.enabled ? 'success' : 'info'">
                  {{ plugin.enabled ? '已启用' : '已停用' }}
                </el-tag>
              </div>
              <p class="plugin-desc text-muted small mb-2">{{ plugin.description }}</p>
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted" style="font-size: 12px">v{{ plugin.version || '1.0.0' }}</span>
                <el-switch v-model="plugin.enabled" size="small" @change="togglePlugin(plugin)" />
                <el-button size="small" type="danger" text @click="uninstallPlugin(plugin)">
                  <el-icon class="me-1"><Delete /></el-icon>卸载
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <div v-if="!loading && plugins.length === 0" class="col-12">
        <el-empty description="暂未安装任何插件">
          <router-link to="/agent/market" class="btn btn-primary btn-sm">去应用市场</router-link>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'

const plugins = ref([])
const loading = ref(false)

onMounted(() => loadPlugins())

async function loadPlugins() {
  loading.value = true
  try {
    const res = await api.get('/agent/plugins')
    plugins.value = res.data?.data || []
  } catch { /* 错误由拦截器处理 */ }
  loading.value = false
}

async function togglePlugin(plugin) {
  try {
    await api.post('/agent/plugins/toggle', { plugin_id: plugin.id, enabled: plugin.enabled })
    ElMessage.success(plugin.enabled ? '插件已启用' : '插件已停用')
  } catch {
    plugin.enabled = !plugin.enabled
  }
}

async function uninstallPlugin(plugin) {
  try {
    await ElMessageBox.confirm(`确定卸载插件「${plugin.name}」吗？`, '确认卸载', { type: 'warning' })
    await api.post('/agent/plugins/uninstall', { plugin_id: plugin.id })
    ElMessage.success('卸载成功')
    plugins.value = plugins.value.filter(p => p.id !== plugin.id)
  } catch { /* 取消或错误 */ }
}
</script>

<style scoped>
.plugin-card { transition: transform 0.3s ease; }
.plugin-card:hover { transform: translateY(-3px); }
.plugin-icon {
  width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.plugin-name { font-size: 15px; font-weight: 600; color: #1e293b; }
.plugin-desc {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; line-height: 1.5;
}
</style>
