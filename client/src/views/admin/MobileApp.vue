<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <div>
        <h3 class="page-title"><i class="fas fa-mobile-alt text-primary me-2"></i>移动端APP管理</h3>
        <p class="text-muted mb-0">配置和生成Android/iOS移动应用</p>
      </div>
      <el-button type="primary" @click="openDialog()"><i class="fas fa-plus me-2"></i>新建APP配置</el-button>
    </div>

    <!-- 平台Tab -->
    <div class="platform-tabs mb-3">
      <button class="platform-tab" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
        <i class="fas fa-th-large me-1"></i>全部
      </button>
      <button class="platform-tab" :class="{ active: activeTab === 'android' }" @click="activeTab = 'android'">
        <i class="fab fa-android me-1"></i>Android
      </button>
      <button class="platform-tab" :class="{ active: activeTab === 'ios' }" @click="activeTab = 'ios'">
        <i class="fab fa-apple me-1"></i>iOS
      </button>
    </div>

    <!-- APP卡片列表 -->
    <div class="app-cards" v-loading="loading">
      <div v-if="filteredConfigs.length === 0" class="empty-state">
        <i class="fas fa-mobile-alt"></i>
        <p>暂无APP配置，点击右上角创建</p>
      </div>
      <div v-for="item in filteredConfigs" :key="item.id" class="app-card">
        <div class="app-card-header">
          <div class="app-icon-wrapper">
            <i :class="item.platform === 'android' ? 'fab fa-android' : 'fab fa-apple'" 
               :style="{ color: item.platform === 'android' ? '#3DDC84' : '#333' }"></i>
          </div>
          <div class="app-info">
            <h4>{{ item.app_name || '未命名应用' }}</h4>
            <span class="badge" :class="statusClass(item.status)">{{ statusText(item.status) }}</span>
          </div>
        </div>
        <div class="app-card-body">
          <div class="app-meta">
            <div class="meta-item"><span class="meta-label">平台</span><span class="meta-value">{{ item.platform === 'android' ? 'Android' : 'iOS' }}</span></div>
            <div class="meta-item"><span class="meta-label">包名</span><span class="meta-value">{{ item.package_name || '-' }}</span></div>
            <div class="meta-item"><span class="meta-label">版本</span><span class="meta-value">v{{ item.version || '1.0.0' }}</span></div>
            <div class="meta-item"><span class="meta-label">API地址</span><span class="meta-value text-truncate">{{ item.api_base_url || '-' }}</span></div>
          </div>
          <p class="app-desc">{{ item.description || '暂无描述' }}</p>
        </div>
        <div class="app-card-actions">
          <el-button size="small" @click="openDialog(item)"><i class="fas fa-edit me-1"></i>编辑</el-button>
          <el-button size="small" type="success" :loading="item._building" @click="buildApp(item)" :disabled="item.status === 'building'">
            <i class="fas fa-hammer me-1"></i>{{ item.status === 'building' ? '构建中...' : '构建' }}
          </el-button>
          <el-button v-if="item.download_url && item.status === 'published'" size="small" type="primary">
            <i class="fas fa-download me-1"></i>下载
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(item)"><i class="fas fa-trash me-1"></i>删除</el-button>
        </div>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showDialog" :title="form.id ? '编辑APP配置' : '新建APP配置'" width="650px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="平台" required>
          <el-radio-group v-model="form.platform">
            <el-radio value="android"><i class="fab fa-android me-1"></i>Android</el-radio>
            <el-radio value="ios"><i class="fab fa-apple me-1"></i>iOS</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="应用名称" required>
          <el-input v-model="form.app_name" placeholder="如: ExpatHome内容检索" />
        </el-form-item>
        <el-form-item label="应用ID">
          <el-input v-model="form.app_id" placeholder="如: com.expatshome.app" />
        </el-form-item>
        <el-form-item label="包名">
          <el-input v-model="form.package_name" placeholder="如: com.expatshome.app" />
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="form.version" placeholder="如: 1.0.0" />
        </el-form-item>
        <el-form-item label="应用描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="应用功能简介" />
        </el-form-item>
        <el-form-item label="API地址">
          <el-input v-model="form.api_base_url" placeholder="后端API基础地址" />
        </el-form-item>
        <el-form-item label="主题色">
          <el-color-picker v-model="form.theme_color" />
        </el-form-item>
        <el-form-item label="应用图标URL">
          <el-input v-model="form.icon_url" placeholder="图标图片URL" />
        </el-form-item>
        <el-form-item label="启动图URL">
          <el-input v-model="form.splash_url" placeholder="启动屏幕图片URL" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const configs = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const form = ref({})
const activeTab = ref('all')

const filteredConfigs = computed(() => {
  if (activeTab.value === 'all') return configs.value
  return configs.value.filter(c => c.platform === activeTab.value)
})

function statusClass(s) {
  const map = { draft: 'bg-secondary', building: 'bg-warning', published: 'bg-success', failed: 'bg-danger' }
  return map[s] || 'bg-secondary'
}
function statusText(s) {
  const map = { draft: '草稿', building: '构建中', published: '已发布', failed: '构建失败' }
  return map[s] || '草稿'
}

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/mobile-app')
    configs.value = (res.data?.data || res.data || []).map(c => ({ ...c, _building: false }))
  } catch { configs.value = [] }
  loading.value = false
}

function openDialog(row) {
  form.value = row ? { ...row } : { platform: 'android', version: '1.0.0', theme_color: '#4879FF' }
  showDialog.value = true
}

async function saveConfig() {
  if (!form.value.app_name || !form.value.platform) {
    return ElMessage.warning('请填写平台和应用名称')
  }
  saving.value = true
  try {
    if (form.value.id) {
      await api.put(`/admin/mobile-app/${form.value.id}`, form.value)
    } else {
      await api.post('/admin/mobile-app', form.value)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
  }
  saving.value = false
}

async function buildApp(item) {
  try {
    await ElMessageBox.confirm(`确定开始构建 ${item.app_name} (${item.platform}) 吗？`, '确认构建')
    item._building = true
    await api.post(`/admin/mobile-app/${item.id}/build`)
    ElMessage.success('构建任务已提交')
    setTimeout(() => loadData(), 6000)
  } catch { item._building = false }
}

async function handleDelete(item) {
  await ElMessageBox.confirm(`确定删除 ${item.app_name} 的配置吗？`, '确认删除')
  try {
    await api.delete(`/admin/mobile-app/${item.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>

<style scoped>
.platform-tabs { display: flex; gap: 8px; }
.platform-tab {
  padding: 8px 20px; border: 1px solid #e0e0e0; border-radius: 20px;
  background: #fff; cursor: pointer; font-size: 13px; color: #666; transition: all 0.25s;
}
.platform-tab.active { background: #4879FF; color: #fff; border-color: #4879FF; }
.platform-tab:hover:not(.active) { border-color: #4879FF; color: #4879FF; }

.app-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
.app-card {
  background: #fff; border-radius: 10px; border: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; transition: all 0.25s;
}
.app-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); }
.app-card-header { display: flex; align-items: center; gap: 12px; padding: 16px 16px 0; }
.app-icon-wrapper {
  width: 48px; height: 48px; border-radius: 12px; background: #f5f7fa;
  display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;
}
.app-info h4 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
.badge { font-size: 11px; padding: 2px 10px; border-radius: 10px; color: #fff; }
.app-card-body { padding: 12px 16px; }
.app-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
.meta-item { display: flex; gap: 6px; font-size: 12px; }
.meta-label { color: #999; flex-shrink: 0; }
.meta-value { color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-desc { font-size: 12px; color: #888; margin: 0; line-height: 1.5; }
.app-card-actions { padding: 12px 16px; border-top: 1px solid #f0f0f0; display: flex; gap: 6px; flex-wrap: wrap; }

.empty-state { text-align: center; padding: 60px 20px; color: #ccc; grid-column: 1 / -1; }
.empty-state i { font-size: 48px; margin-bottom: 12px; }
.empty-state p { font-size: 14px; }

@media (max-width: 767px) {
  .app-cards { grid-template-columns: 1fr; }
}
</style>
