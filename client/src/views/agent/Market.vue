<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">应用市场</h3>
      <router-link to="/agent/plugins" class="btn btn-outline-primary btn-sm">
        <i class="fas fa-cog me-1"></i>已安装插件
      </router-link>
    </div>

    <!-- 搜索与分类 -->
    <div class="d-flex gap-2 mb-3 flex-wrap align-items-center">
      <el-input v-model="keyword" placeholder="搜索应用..." clearable style="width: 240px" @keyup.enter="loadMarket">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-radio-group v-model="category" size="small" @change="loadMarket">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="property">房源</el-radio-button>
        <el-radio-button value="client">客户</el-radio-button>
        <el-radio-button value="marketing">营销</el-radio-button>
        <el-radio-button value="tool">工具</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 应用卡片 -->
    <div v-loading="loading" class="row g-3">
      <div v-for="app in apps" :key="app.id" class="col-md-6 col-lg-4 col-xl-3">
        <el-card shadow="hover" class="market-card" :body-style="{ padding: '0' }">
          <div class="card-top">
            <div class="app-icon-wrapper">
              <i :class="app.icon || 'fas fa-cube'"></i>
            </div>
          </div>
          <div class="card-body-custom">
            <h5 class="app-name">{{ app.name }}</h5>
            <p class="app-desc text-muted">{{ app.description }}</p>
            <div class="d-flex justify-content-between align-items-center">
              <div class="app-meta">
                <span v-if="app.price" class="app-price">¥{{ app.price }}</span>
                <span v-else class="app-free">免费</span>
                <span class="text-muted ms-2" style="font-size: 11px">{{ app.install_count || 0 }} 次安装</span>
              </div>
              <el-button v-if="app.installed" size="small" type="success" disabled plain>已安装</el-button>
              <el-button v-else size="small" type="primary" :loading="app._installing" @click="installApp(app)">安装</el-button>
            </div>
          </div>
        </el-card>
      </div>

      <div v-if="!loading && apps.length === 0" class="col-12">
        <el-empty description="暂无可用应用" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const apps = ref([])
const loading = ref(false)
const keyword = ref('')
const category = ref('')

onMounted(() => loadMarket())

async function loadMarket() {
  loading.value = true
  try {
    const res = await api.get('/agent/market', { params: { keyword: keyword.value, category: category.value } })
    apps.value = (res.data?.data || []).map(a => ({ ...a, _installing: false }))
  } catch { /* 错误由拦截器处理 */ }
  loading.value = false
}

async function installApp(app) {
  app._installing = true
  try {
    await api.post('/agent/plugins/install', { app_id: app.id })
    app.installed = true
    ElMessage.success(`${app.name} 安装成功`)
  } catch { /* 错误由拦截器处理 */ }
  app._installing = false
}
</script>

<style scoped>
.market-card { transition: transform 0.3s ease; overflow: hidden; }
.market-card:hover { transform: translateY(-4px); }
.card-top {
  height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex; align-items: center; justify-content: center;
}
.app-icon-wrapper {
  width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center; color: white; font-size: 22px;
}
.card-body-custom { padding: 16px; }
.app-name { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 6px; }
.app-desc {
  font-size: 13px; line-height: 1.5; margin-bottom: 12px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.app-price { font-weight: 600; color: #e74c3c; font-size: 14px; }
.app-free { font-weight: 600; color: #27ae60; font-size: 14px; }
</style>
