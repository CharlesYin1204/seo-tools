<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <div>
        <h3 class="page-title"><i class="fas fa-puzzle-piece text-primary me-2"></i>插件中心管理</h3>
        <p class="text-muted mb-0">管理官方 SEO 插件的版本、计费、权限与发布状态</p>
      </div>
      <el-button type="primary" @click="openDialog()" v-if="activeTab === 'list'"><i class="fas fa-plus me-2"></i>新增插件</el-button>
    </div>

    <!-- Tab切换 -->
    <el-tabs v-model="activeTab" class="mb-3">
      <el-tab-pane label="插件列表" name="list" />
      <el-tab-pane label="插件数据看板" name="dashboard" />
    </el-tabs>

    <!-- 数据看板 -->
    <div v-if="activeTab === 'dashboard'">
      <div v-loading="dashboardLoading">
        <div class="row g-3 mb-4">
          <div class="col-md-3 col-6"><el-card shadow="never"><el-statistic title="总插件数" :value="dashboard.overview?.total_plugins || 0" /></el-card></div>
          <div class="col-md-3 col-6"><el-card shadow="never"><el-statistic title="已启用插件" :value="dashboard.overview?.active_plugins || 0" /></el-card></div>
          <div class="col-md-3 col-6"><el-card shadow="never"><el-statistic title="付费订阅" :value="dashboard.overview?.active_subscriptions || 0" /></el-card></div>
          <div class="col-md-3 col-6"><el-card shadow="never"><el-statistic title="活跃用户" :value="dashboard.overview?.active_users || 0" /></el-card></div>
        </div>

        <div class="row g-4">
          <div class="col-lg-6">
            <el-card>
              <template #header><span><i class="fas fa-chart-bar"></i> 热门插件 TOP10</span></template>
              <el-table :data="dashboard.topPlugins || []" size="small" border>
                <el-table-column prop="plugin_name" label="插件" />
                <el-table-column prop="install_count" label="安装数" width="80" />
                <el-table-column prop="total_usage" label="使用次数" width="80" />
                <el-table-column prop="active_subs" label="付费用户" width="80" />
              </el-table>
            </el-card>
          </div>
          <div class="col-lg-6">
            <el-card>
              <template #header><span><i class="fas fa-users"></i> 最近安装用户</span></template>
              <el-table :data="dashboard.recentUsers || []" size="small" border max-height="360">
                <el-table-column label="用户" width="120">
                  <template #default="{row}">{{ row.display_name || row.username }}</template>
                </el-table-column>
                <el-table-column prop="plugin_name" label="插件" />
                <el-table-column prop="usage_count" label="使用" width="60" />
                <el-table-column prop="installed_at" label="安装时间" width="150" />
              </el-table>
            </el-card>
          </div>
        </div>

        <el-card class="mt-4" v-if="(dashboard.paidPluginUsers || []).length">
          <template #header><span><i class="fas fa-money-bill"></i> 付费插件用户</span></template>
          <el-table :data="dashboard.paidPluginUsers || []" size="small" border>
            <el-table-column label="用户" width="120">
              <template #default="{row}">{{ row.display_name || row.username }}</template>
            </el-table-column>
            <el-table-column prop="plugin_name" label="插件" />
            <el-table-column prop="start_time" label="开始时间" width="150" />
            <el-table-column prop="end_time" label="到期时间" width="150" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{row}">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">{{ row.status === 'active' ? '有效' : '已过期' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>

    <!-- 插件列表(原有内容) -->
    <div v-show="activeTab === 'list'">

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card"><div class="stat-value text-primary">{{ stats.total }}</div><div class="stat-label">总插件数</div></div>
      <div class="stat-card"><div class="stat-value text-success">{{ stats.active }}</div><div class="stat-label">已启用</div></div>
      <div class="stat-card"><div class="stat-value text-warning">{{ stats.premium }}</div><div class="stat-label">付费插件</div></div>
      <div class="stat-card"><div class="stat-value text-info">{{ stats.free }}</div><div class="stat-label">免费插件</div></div>
    </div>

    <!-- 筛选区 -->
    <div class="card-container">
      <div class="filter-bar mb-3">
        <el-select v-model="filterStatus" placeholder="状态" clearable @change="loadData" style="width: 120px;">
          <el-option label="已启用" value="active" />
          <el-option label="已停用" value="inactive" />
        </el-select>
        <el-select v-model="filterCategory" placeholder="分类" clearable @change="loadData" style="width: 140px;">
          <el-option v-for="(label, value) in catMap" :key="value" :label="label" :value="value" />
        </el-select>
      </div>

      <el-table :data="plugins" stripe v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="55" />
        <el-table-column label="插件信息" min-width="220">
          <template #default="{ row }">
            <div class="d-flex align-items-center gap-2">
              <div class="plugin-icon-sm" :style="{ background: getIconBg(row.plugin_category) }">
                <i :class="row.plugin_icon || 'fas fa-puzzle-piece'"></i>
              </div>
              <div>
                <div class="fw-bold" style="font-size: 13px;">{{ row.name || row.plugin_name }}
                  <el-tag v-if="row.is_featured" type="warning" size="small" round>推荐</el-tag>
                </div>
                <div class="text-muted" style="font-size: 11px;">{{ row.slug || row.plugin_slug }} · v{{ row.version || row.plugin_version }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ categoryName(row.plugin_category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="月费" width="100" align="center">
          <template #default="{ row }">
            <span v-if="parseFloat(row.monthly_price) === 0" class="text-success fw-bold">免费</span>
            <span v-else class="text-warning fw-bold">¥{{ row.monthly_price }}</span>
          </template>
        </el-table-column>
        <el-table-column label="安装量" width="80" align="center" prop="install_count" />
        <el-table-column label="兼容套餐" min-width="150">
          <template #default="{ row }">
            <span class="text-muted" style="font-size:12px">{{ (row.compatible_plans || []).join(' / ') || '未配置' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row._active" @change="togglePlugin(row)" active-text="" inactive-text="" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="center">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">下架</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showDialog" :title="form.id ? '编辑插件' : '新增插件'" width="620px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="插件名称" required>
          <el-input v-model="form.name" placeholder="插件名称" />
        </el-form-item>
        <el-form-item label="插件标识">
          <el-input v-model="form.slug" placeholder="如: wechat-video-download" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="插件功能描述" />
        </el-form-item>
        <el-form-item label="图标类名">
          <el-input v-model="form.icon" placeholder="如: fas fa-video">
            <template #prefix><i :class="form.icon || 'fas fa-puzzle-piece'"></i></template>
          </el-input>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" placeholder="选择分类">
            <el-option v-for="(label, value) in catMap" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="form.version" placeholder="如: 1.0.0" />
        </el-form-item>
        <el-form-item label="每月费用">
          <el-input-number v-model="form.monthly_price" :min="0" :step="9.9" :precision="2" />
          <span class="ms-2 text-muted" style="font-size: 12px;">设为0即为免费</span>
        </el-form-item>
        <el-form-item label="AI 点数">
          <el-input-number v-model="form.credit_amount" :min="0" :step="5" />
        </el-form-item>
        <el-form-item label="兼容套餐">
          <el-checkbox-group v-model="form.compatible_plans">
            <el-checkbox value="free">Free</el-checkbox><el-checkbox value="starter">Starter</el-checkbox>
            <el-checkbox value="growth">Growth</el-checkbox><el-checkbox value="agency">Agency</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="权限范围">
          <el-select v-model="form.permissions" multiple allow-create filterable default-first-option placeholder="输入权限后回车" style="width:100%" />
        </el-form-item>
        <el-form-item label="数据去向">
          <el-input v-model="form.data_destination" placeholder="说明插件读取或写入数据的位置" />
        </el-form-item>
        <el-form-item label="推荐">
          <el-switch v-model="form.is_featured" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePlugin">保存</el-button>
      </template>
    </el-dialog>

    </div><!-- /v-show list -->
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const plugins = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const form = ref({})
const filterStatus = ref('')
const filterCategory = ref('')

const catMap = {
  integration: '站点连接', indexing: '收录与推送', content: '内容与 AI',
  optimization: '站内优化', technical: '技术 SEO', geo: 'GEO/AEO', reporting: '报告交付',
}
function categoryName(cat) { return catMap[cat] || cat || '未分类' }

const bgColors = {
  media: '#52606D',
  marketing: 'linear-gradient(135deg, #f093fb, #f5576c)',
  ai: 'linear-gradient(135deg, #4facfe, #00f2fe)',
  crm: 'linear-gradient(135deg, #43e97b, #38f9d7)',
  tools: 'linear-gradient(135deg, #fa709a, #fee140)',
  analytics: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
}
function getIconBg(cat) { return bgColors[cat] || 'linear-gradient(135deg, #89f7fe, #66a6ff)' }

const stats = computed(() => {
  const total = plugins.value.length
  const active = plugins.value.filter(p => p._active).length
  const premium = plugins.value.filter(p => parseFloat(p.monthly_price) > 0).length
  return { total, active, premium, free: total - premium }
})

const activeTab = ref('list')
const dashboard = ref({})
const dashboardLoading = ref(false)

async function loadDashboard() {
  dashboardLoading.value = true
  try {
    const res = await api.get('/admin/plugin-dashboard')
    dashboard.value = res.data?.data || res.data || {}
  } catch {}
  dashboardLoading.value = false
}

watch(activeTab, (tab) => {
  if (tab === 'dashboard' && !dashboard.value.overview) loadDashboard()
})

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    const params = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (filterCategory.value) params.category = filterCategory.value
    const res = await api.get('/admin/plugins', { params })
    const rawData = res.data?.data || res.data || []
    plugins.value = rawData.map(p => ({
      ...p,
      _active: p.is_active === 1 || p.status === 'active',
    }))
  } catch { plugins.value = [] }
  loading.value = false
}

function openDialog(row) {
  if (row) {
    let allowedIds = []
    if (row.allowed_users) {
      try {
        allowedIds = typeof row.allowed_users === 'string' ? JSON.parse(row.allowed_users) : row.allowed_users
      } catch { allowedIds = [] }
    }
    form.value = {
      id: row.id,
      name: row.plugin_name || row.name,
      slug: row.plugin_slug || row.slug,
      description: row.plugin_description || row.description,
      icon: row.plugin_icon || row.icon || 'fas fa-puzzle-piece',
      category: row.plugin_category || row.category || 'general',
      version: row.plugin_version || row.version || '1.0.0',
      monthly_price: parseFloat(row.monthly_price) || 0,
      credit_amount: Number(row.credit_amount || 0),
      compatible_plans: row.compatible_plans || [],
      permissions: row.permissions || [],
      data_destination: row.data_destination || '',
      is_featured: row.is_featured === 1,
      enabled: row._active || row.is_active === 1,
    }
  } else {
    form.value = {
      enabled: true, version: '1.0.0', monthly_price: 0,
      credit_amount: 0, compatible_plans: ['free','starter','growth','agency'],
      permissions: [], data_destination: '',
      is_featured: false, icon: 'fas fa-puzzle-piece', category: 'integration',
    }
  }
  showDialog.value = true
}

async function savePlugin() {
  if (!form.value.name) return ElMessage.warning('请填写插件名称')
  saving.value = true
  try {
    const payload = {
      name: form.value.name,
      slug: form.value.slug,
      description: form.value.description,
      version: form.value.version,
      status: form.value.enabled ? 'active' : 'inactive',
      config: {},
      icon: form.value.icon,
      category: form.value.category,
      monthly_price: form.value.monthly_price,
      credit_type: form.value.credit_amount > 0 ? 'per_use' : 'free',
      credit_amount: form.value.credit_amount,
      is_featured: form.value.is_featured,
      compatible_plans: form.value.compatible_plans,
      permissions: form.value.permissions,
      data_destination: form.value.data_destination,
    }
    if (form.value.id) {
      await api.put(`/admin/plugins/${form.value.id}`, payload)
    } else {
      await api.post('/admin/plugins', payload)
    }

    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
  }
  saving.value = false
}

async function togglePlugin(row) {
  try {
    const status = row._active ? 'active' : 'inactive'
    await api.put(`/admin/plugins/${row.id}`, { name: row.plugin_name || row.name, status })
    ElMessage.success(row._active ? '插件已启用' : '插件已停用')
  } catch {
    row._active = !row._active
    ElMessage.error('操作失败')
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确定下架插件 "${row.plugin_name || row.name}" 吗？用户配置和审计记录将保留。`, '确认下架')
  try {
    await api.delete(`/admin/plugins/${row.id}`)
    ElMessage.success('插件已下架')
    loadData()
  } catch {}
}
</script>

<style scoped>
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card {
  background: #fff; border-radius: 8px; padding: 16px; text-align: center;
  border: 1px solid #e8e8e8; box-shadow: 0 2px 6px rgba(0,0,0,0.04);
}
.stat-value { font-size: 24px; font-weight: 700; }
.stat-label { font-size: 12px; color: #999; margin-top: 4px; }

.filter-bar { display: flex; gap: 10px; }
.plugin-icon-sm {
  width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; flex-shrink: 0;
}

@media (max-width: 767px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
