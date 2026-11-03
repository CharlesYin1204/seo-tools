<template>
  <div>
    <!-- 页面头部 -->
    <div class="um-page-header">
      <div>
        <h3 class="page-title"><i class="fas fa-users text-primary me-2"></i>用户管理</h3>
        <nav class="breadcrumb-nav">
          <span>仪表板</span> / <span>内容管理</span> / <span class="active">用户管理</span>
        </nav>
      </div>
      <el-button type="primary" @click="showCreateDialog"><i class="fas fa-plus me-2"></i>添加用户</el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value text-primary" :class="{ 'loading-pulse': statsLoading }">{{ statsLoading ? '-' : formatNumber(userStats.totalUsers) }}</div>
        <div class="stat-label">总用户数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-success" :class="{ 'loading-pulse': statsLoading }">{{ statsLoading ? '-' : formatNumber(userStats.activeUsers) }}</div>
        <div class="stat-label">活跃用户</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-danger" :class="{ 'loading-pulse': statsLoading }">{{ statsLoading ? '-' : formatNumber(userStats.adminCount) }}</div>
        <div class="stat-label">管理员</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-info" :class="{ 'loading-pulse': statsLoading }">{{ statsLoading ? '-' : formatNumber(userStats.userCount) }}</div>
        <div class="stat-label">普通用户</div>
      </div>
    </div>

    <!-- 筛选和表格区域 -->
    <div class="card-container" v-loading="loading">
      <!-- 筛选区域 -->
      <div class="filter-section">
        <div class="filter-grid">
          <div class="filter-col">
            <label>用户角色</label>
            <el-select v-model="role" placeholder="所有角色" clearable @change="handleFilter">
              <el-option label="普通用户" value="user" />
              <el-option label="管理员" value="admin" />
              <el-option label="SEO 专员" value="agent" />
              <el-option label="内容管理员" value="landlord" />
            </el-select>
          </div>
          <div class="filter-col">
            <label>用户状态</label>
            <el-select v-model="status" placeholder="所有状态" clearable @change="handleFilter">
              <el-option label="活跃" value="active" />
              <el-option label="已封禁" value="banned" />
              <el-option label="待审核" value="pending" />
            </el-select>
          </div>
          <div class="filter-col search-col">
            <label>关键词搜索</label>
            <el-input v-model="search" placeholder="搜索用户名、邮箱、手机号..." clearable @keyup.enter="handleFilter" />
          </div>
          <div class="filter-col filter-actions">
            <label>&nbsp;</label>
            <div class="d-flex gap-2">
              <el-button type="primary" @click="handleFilter"><i class="fas fa-search me-1"></i>搜索</el-button>
              <el-button @click="resetFilters"><i class="fas fa-times"></i></el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 批量操作栏 -->
      <div class="batch-bar" v-if="selectedIds.length > 0">
        <div class="batch-info"><strong>已选择 {{ selectedIds.length }} 个用户</strong></div>
        <div class="batch-actions">
          <el-button size="small" type="success" plain @click="batchAction('status', 'active')"><i class="fas fa-check me-1"></i>批量激活</el-button>
          <el-button size="small" type="warning" plain @click="batchAction('status', 'banned')"><i class="fas fa-ban me-1"></i>批量封禁</el-button>
          <el-button size="small" type="danger" plain @click="batchAction('delete')"><i class="fas fa-trash me-1"></i>批量删除</el-button>
        </div>
      </div>

      <!-- 用户列表表格 -->
      <el-table :data="users" @selection-change="onSelectionChange" stripe>
        <el-table-column type="selection" width="45" />
        <el-table-column label="用户信息" min-width="260">
          <template #default="{ row }">
            <div class="user-info-cell">
              <div class="user-avatar">
                <img v-if="row.avatar" :src="row.avatar" class="avatar-img" />
                <div v-else class="avatar-placeholder">{{ getInitial(row) }}</div>
              </div>
              <div class="user-details">
                <div class="user-name">{{ row.display_name || row.username || '未设置' }}</div>
                <div class="user-email"><i class="fas fa-envelope me-1"></i>{{ row.email || '' }}</div>
                <div v-if="row.phone" class="user-phone"><i class="fas fa-phone me-1"></i>{{ row.phone }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small" class="role-badge" effect="dark" round>
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small" effect="dark" round>
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="试用" width="100" align="center">
          <template #default="{ row }">
            <template v-if="row.is_trial">
              <el-tag v-if="row.trial_end_date && new Date(row.trial_end_date) < new Date()" type="danger" size="small" round>已过期</el-tag>
              <el-tag v-else type="success" size="small" round>{{ row.trial_days }}天</el-tag>
            </template>
            <span v-else class="text-muted small">-</span>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="130">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatDate(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最后活动" width="130">
          <template #default="{ row }">
            <span class="text-muted small">{{ formatRelativeTime(getLastActivity(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="action-btns">
              <el-tooltip content="查看详情" placement="top">
                <el-button size="small" circle plain type="primary" @click="showDetail(row)"><i class="fas fa-eye"></i></el-button>
              </el-tooltip>
              <el-tooltip content="编辑用户" placement="top">
                <el-button size="small" circle plain type="warning" @click="showEditDialog(row)"><i class="fas fa-edit"></i></el-button>
              </el-tooltip>
              <el-tooltip :content="row.is_trial ? '管理试用' : '设置试用'" placement="top">
                <el-button size="small" circle plain :type="row.is_trial ? 'success' : 'info'" @click="openTrialDialog(row)"><i class="fas fa-hourglass-half"></i></el-button>
              </el-tooltip>
              <el-tooltip content="重置密码" placement="top">
                <el-button size="small" circle plain @click="handleResetPassword(row)"><i class="fas fa-key"></i></el-button>
              </el-tooltip>
              <el-tooltip content="删除用户" placement="top">
                <el-button size="small" circle plain type="danger" @click="handleDelete(row)"><i class="fas fa-trash"></i></el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total"
                       layout="total, prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <!-- 添加/编辑用户弹窗 -->
    <el-dialog v-model="formDialogVisible" :title="editingUser ? '编辑用户' : '添加用户'" width="520px" destroy-on-close>
      <el-form :model="userForm" label-width="90px">
        <el-form-item label="用户名" v-if="!editingUser">
          <el-input v-model="userForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="userForm.display_name" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="userForm.email" placeholder="user@example.com" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="userForm.phone" placeholder="手机号（选填）" />
        </el-form-item>
        <el-form-item label="密码" v-if="!editingUser">
          <el-input v-model="userForm.password" type="password" show-password placeholder="至少6位" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role" style="width:100%">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
            <el-option label="SEO 专员" value="agent" />
            <el-option label="内容管理员" value="landlord" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="userForm.status" style="width:100%">
            <el-option label="活跃" value="active" />
            <el-option label="封禁" value="banned" />
            <el-option label="待审核" value="pending" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSubmitting" @click="submitForm">{{ editingUser ? '保存修改' : '创建用户' }}</el-button>
      </template>
    </el-dialog>

    <!-- 用户详情弹窗 -->
    <el-dialog v-model="detailVisible" title="用户详情" width="500px" destroy-on-close>
      <div v-if="detailUser" class="user-detail-card">
        <div class="detail-avatar-row">
          <div class="detail-avatar">
            <img v-if="detailUser.avatar" :src="detailUser.avatar" />
            <div v-else class="avatar-placeholder lg">{{ getInitial(detailUser) }}</div>
          </div>
          <div>
            <h4>{{ detailUser.display_name || detailUser.username }}</h4>
            <el-tag :type="roleTagType(detailUser.role)" size="small" effect="dark" round>{{ roleLabel(detailUser.role) }}</el-tag>
            <el-tag :type="statusTagType(detailUser.status)" size="small" effect="dark" round class="ms-2">{{ statusLabel(detailUser.status) }}</el-tag>
          </div>
        </div>
        <el-descriptions :column="1" border class="mt-3">
          <el-descriptions-item label="ID">{{ detailUser.id }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ detailUser.username }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ detailUser.email }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detailUser.phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ detailUser.created_at }}</el-descriptions-item>
          <el-descriptions-item label="最后活动">{{ formatDateTime(getLastActivity(detailUser)) }}</el-descriptions-item>
        </el-descriptions>
        <div class="detail-action-row">
          <el-button type="warning" plain size="small" @click="showEditDialog(detailUser); detailVisible = false"><i class="fas fa-edit me-1"></i>编辑</el-button>
          <el-button plain size="small" @click="handleResetPassword(detailUser)"><i class="fas fa-key me-1"></i>重置密码</el-button>
          <el-button :type="detailUser.status === 'active' ? 'info' : 'success'" plain size="small" @click="toggleStatus(detailUser)">
            {{ detailUser.status === 'active' ? '封禁' : '启用' }}
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 用户详情/试用状态对话框 -->
    <el-dialog v-model="trialDialogVisible" title="用户详情" width="560px" destroy-on-close>
      <div v-if="trialForm.username" class="trial-user-info mb-3">
        <strong>{{ trialForm.display_name || trialForm.username }}</strong>
        <span class="text-muted ms-2">(ID: {{ trialForm.userId }})</span>
      </div>

      <el-descriptions :column="2" border size="small" class="mb-3">
        <el-descriptions-item label="试用状态">
          <el-tag v-if="trialForm.is_trial && !trialForm.trial_expired" type="success" size="small">试用中</el-tag>
          <el-tag v-else-if="trialForm.is_trial && trialForm.trial_expired" type="danger" size="small">试用已结束</el-tag>
          <el-tag v-else type="info" size="small">未试用</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="试用天数">{{ trialForm.trial_days || 0 }} 天</el-descriptions-item>
        <el-descriptions-item label="试用开始" v-if="trialForm.is_trial">{{ trialForm.trial_start_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="试用到期" v-if="trialForm.is_trial">{{ trialForm.trial_end_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="账户余额">¥{{ trialForm.balance || '0.00' }}</el-descriptions-item>
        <el-descriptions-item label="积分">{{ trialForm.points || 0 }}</el-descriptions-item>
      </el-descriptions>

      <h5 style="font-size:14px;margin:16px 0 8px;">功能模块订阅</h5>
      <el-table :data="trialForm.featureSubscriptions || []" size="small" border v-if="(trialForm.featureSubscriptions || []).length">
        <el-table-column prop="module_name" label="功能" width="120" />
        <el-table-column prop="source" label="来源" width="80">
          <template #default="{row}">{{ {trial:'试用',card_key:'卡密',payment:'购买',admin:'管理员'}[row.source] || row.source }}</template>
        </el-table-column>
        <el-table-column prop="end_date" label="到期" width="150" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag size="small" :type="row.status==='active' && new Date(row.end_date) > new Date() ? 'success' : 'info'">
              {{ row.status==='active' && new Date(row.end_date) > new Date() ? '有效' : '已过期' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="text-muted" style="font-size:13px;">暂无功能订阅</p>

      <h5 style="font-size:14px;margin:16px 0 8px;">已安装插件</h5>
      <el-table :data="trialForm.installedPlugins || []" size="small" border v-if="(trialForm.installedPlugins || []).length">
        <el-table-column prop="plugin_name" label="插件" />
        <el-table-column prop="usage_count" label="使用次数" width="80" />
        <el-table-column prop="installed_at" label="安装时间" width="150" />
      </el-table>
      <p v-else class="text-muted" style="font-size:13px;">暂无安装的插件</p>

      <template #footer>
        <el-button @click="trialDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 修改角色对话框 -->
    <el-dialog v-model="roleDialogVisible" title="修改用户角色" width="420px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="用户"><span class="fw-bold">{{ roleForm.username }}</span></el-form-item>
        <el-form-item label="当前角色">
          <el-tag :type="roleTagType(roleForm.currentRole)" size="small" effect="dark">{{ roleLabel(roleForm.currentRole) }}</el-tag>
        </el-form-item>
        <el-form-item label="新角色">
          <el-select v-model="roleForm.newRole" style="width:100%">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
            <el-option label="SEO 专员" value="agent" />
            <el-option label="内容管理员" value="landlord" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="roleSubmitting" @click="submitRoleChange">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const users = ref([])
const loading = ref(false)
const statsLoading = ref(true)
const search = ref('')
const role = ref('')
const status = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectedIds = ref([])

const userStats = reactive({ totalUsers: 0, activeUsers: 0, adminCount: 0, userCount: 0 })

const formDialogVisible = ref(false)
const formSubmitting = ref(false)
const editingUser = ref(null)
const userForm = reactive({ username: '', display_name: '', email: '', phone: '', password: '', role: 'user', status: 'active' })

const detailVisible = ref(false)
const detailUser = ref(null)

const roleDialogVisible = ref(false)
const roleSubmitting = ref(false)
const roleForm = ref({ userId: null, username: '', currentRole: '', newRole: '' })

const trialDialogVisible = ref(false)
const trialSubmitting = ref(false)
const trialForm = ref({ userId: null, username: '', display_name: '', trial_days: 7, is_trial: false, trial_start_date: '', trial_end_date: '', trial_expired: false })

const roleMap = { admin: '管理员', user: '普通用户', agent: 'SEO 专员', landlord: '内容管理员' }
function roleLabel(r) { return roleMap[r] || r }
function roleTagType(r) { return { admin: 'danger', agent: 'warning', landlord: '', user: 'primary' }[r] || 'info' }
function statusLabel(s) { return { active: '活跃', banned: '已封禁', pending: '待审核' }[s] || s }
function statusTagType(s) { return { active: 'success', banned: 'danger', pending: 'warning' }[s] || 'info' }
function formatNumber(n) { return (n || 0).toLocaleString() }

function getInitial(user) {
  const name = user?.display_name || user?.username || 'U'
  return name.charAt(0).toUpperCase()
}

function formatDate(d) {
  if (!d) return '-'
  const date = new Date(d)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDateTime(d) {
  if (!d) return '-'
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

function getLastActivity(user) {
  return user?.last_login_at || user?.updated_at || ''
}

function formatRelativeTime(d) {
  if (!d) return '从未登录'
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  const date = new Date(d)
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

onMounted(() => { loadData(); loadStats() })

async function loadStats() {
  statsLoading.value = true
  try {
    const res = await api.get('/admin/users-stats')
    const d = res.data?.data || res.data || {}
    Object.assign(userStats, d)
  } catch {}
  statsLoading.value = false
}

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/users', {
      params: { page: page.value, pageSize: pageSize.value, search: search.value, role: role.value, status: status.value },
    })
    users.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

function handleFilter() { page.value = 1; loadData() }
function resetFilters() { search.value = ''; role.value = ''; status.value = ''; page.value = 1; loadData() }

function onSelectionChange(rows) { selectedIds.value = rows.map(r => r.id) }

function showCreateDialog() {
  editingUser.value = null
  Object.assign(userForm, { username: '', display_name: '', email: '', phone: '', password: '', role: 'user', status: 'active' })
  formDialogVisible.value = true
}

function showEditDialog(row) {
  editingUser.value = row
  Object.assign(userForm, { display_name: row.display_name || '', email: row.email || '', phone: row.phone || '', role: row.role, status: row.status })
  formDialogVisible.value = true
}

async function submitForm() {
  formSubmitting.value = true
  try {
    if (editingUser.value) {
      await api.put(`/admin/users/${editingUser.value.id}`, userForm)
      ElMessage.success('用户更新成功')
    } else {
      if (!userForm.username || !userForm.email || !userForm.password) {
        ElMessage.warning('请填写必填信息'); formSubmitting.value = false; return
      }
      await api.post('/admin/users/create', userForm)
      ElMessage.success('用户创建成功')
    }
    formDialogVisible.value = false
    loadData()
    loadStats()
  } catch {}
  formSubmitting.value = false
}

function showDetail(row) { detailUser.value = { ...row }; detailVisible.value = true }

async function toggleStatus(row) {
  const newStatus = row.status === 'active' ? 'banned' : 'active'
  const label = newStatus === 'banned' ? '封禁' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${label}用户 "${row.display_name || row.username}" 吗？`, '操作确认', { type: 'warning' })
    await api.put(`/admin/users/${row.id}/status`, { status: newStatus })
    row.status = newStatus
    ElMessage.success(`${label}成功`)
    loadStats()
  } catch {}
}

async function handleResetPassword(row) {
  try {
    const { value } = await ElMessageBox.prompt(`为用户 "${row.display_name || row.username}" 设置新密码（至少6位）`, '重置密码', {
      confirmButtonText: '确定', cancelButtonText: '取消', inputType: 'password', inputPattern: /.{6,}/, inputErrorMessage: '密码至少6位'
    })
    await api.post(`/admin/users/${row.id}/reset-password`, { newPassword: value })
    ElMessage.success('密码已重置')
  } catch {}
}

function openRoleDialog(row) {
  roleForm.value = { userId: row.id, username: row.display_name || row.username, currentRole: row.role, newRole: row.role }
  roleDialogVisible.value = true
}

async function submitRoleChange() {
  if (roleForm.value.newRole === roleForm.value.currentRole) { ElMessage.info('角色未改变'); return }
  roleSubmitting.value = true
  try {
    await api.put(`/admin/users/${roleForm.value.userId}/role`, { role: roleForm.value.newRole })
    ElMessage.success('角色已更新')
    roleDialogVisible.value = false
    loadData(); loadStats()
  } catch {}
  roleSubmitting.value = false
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除用户 "${row.display_name || row.username}" 吗？此操作不可恢复！`, '危险操作', {
      confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'error'
    })
    await api.delete(`/admin/users/${row.id}`)
    ElMessage.success('用户已删除')
    loadData(); loadStats()
  } catch {}
}

async function batchAction(action, newStatus) {
  if (!selectedIds.value.length) return ElMessage.warning('请先选择用户')
  const labels = { delete: '删除', status: newStatus === 'active' ? '激活' : '封禁' }
  try {
    await ElMessageBox.confirm(`确定要批量${labels[action]}选中的 ${selectedIds.value.length} 个用户吗？`, '批量操作', { type: 'warning' })
    await api.post('/admin/users/batch-action', { ids: selectedIds.value, action, status: newStatus })
    ElMessage.success('批量操作成功')
    selectedIds.value = []
    loadData(); loadStats()
  } catch {}
}

async function openTrialDialog(row) {
  const endDate = row.trial_end_date ? new Date(row.trial_end_date) : null
  const expired = endDate ? new Date() > endDate : false
  trialForm.value = {
    userId: row.id,
    username: row.username,
    display_name: row.display_name,
    trial_days: row.trial_days ?? 0,
    is_trial: row.is_trial === 1,
    trial_start_date: row.trial_start_date ? new Date(row.trial_start_date).toLocaleString() : '',
    trial_end_date: row.trial_end_date ? new Date(row.trial_end_date).toLocaleString() : '',
    trial_expired: expired,
    balance: row.balance || '0.00',
    points: row.points || 0,
    featureSubscriptions: [],
    installedPlugins: [],
  }
  trialDialogVisible.value = true

  try {
    const [subRes, pluginRes] = await Promise.all([
      api.get('/admin/feature-modules/subscriptions', { params: { user_id: row.id, pageSize: 50 } }).catch(() => ({ data: { data: { list: [] } } })),
      api.get(`/admin/users/${row.id}`).catch(() => ({ data: { data: {} } })),
    ])
    trialForm.value.featureSubscriptions = subRes.data?.data?.list || []
    const userDetail = pluginRes.data?.data || {}
    if (userDetail.balance !== undefined) trialForm.value.balance = userDetail.balance
    if (userDetail.points !== undefined) trialForm.value.points = userDetail.points
  } catch {}

  try {
    const plugRes = await api.get('/admin/plugin-dashboard').catch(() => ({ data: { data: {} } }))
    const allUsers = plugRes.data?.data?.recentUsers || []
    trialForm.value.installedPlugins = allUsers.filter(u => u.user_id === row.id)
  } catch {}
}

async function submitTrial() {
  if (!trialForm.value.trial_days || trialForm.value.trial_days < 1) {
    return ElMessage.warning('试用天数必须大于0')
  }
  trialSubmitting.value = true
  try {
    await api.put(`/admin/users/${trialForm.value.userId}/trial`, { trial_days: trialForm.value.trial_days })
    ElMessage.success('试用设置成功')
    trialDialogVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '设置失败')
  }
  trialSubmitting.value = false
}

async function cancelTrial() {
  try {
    await ElMessageBox.confirm('确定取消该用户的试用期吗？', '确认')
    trialSubmitting.value = true
    await api.delete(`/admin/users/${trialForm.value.userId}/trial`)
    ElMessage.success('试用已取消')
    trialDialogVisible.value = false
    loadData()
  } catch {}
  trialSubmitting.value = false
}
</script>

<style scoped>
.um-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0 0 4px; display: flex; align-items: center; }
.breadcrumb-nav { font-size: 13px; color: #999; }
.breadcrumb-nav .active { color: #333; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card {
  background: white; border-radius: 10px; padding: 20px; text-align: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05); transition: all 0.3s ease;
}
.stat-card:hover { box-shadow: 0 5px 20px rgba(0,0,0,0.1); transform: translateY(-2px); }
.stat-value { font-size: 1.8rem; font-weight: 700; margin-bottom: 4px; }
.stat-label { font-size: 13px; color: #888; }
.text-primary { color: #2F80ED; }
.text-success { color: #27AE60; }
.text-danger { color: #EB5757; }
.text-info { color: #2D9CDB; }

.card-container { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }

.filter-section { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.filter-grid { display: grid; grid-template-columns: 1fr 1fr 2fr auto; gap: 16px; align-items: end; }
.filter-col label { display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 500; }
.filter-col .el-select, .filter-col .el-input { width: 100%; }
.filter-actions { display: flex; flex-direction: column; }

.batch-bar {
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
  background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;
}
.batch-info { font-size: 14px; color: #856404; }
.batch-actions { display: flex; gap: 8px; }

.user-info-cell { display: flex; align-items: center; gap: 12px; }
.user-avatar { flex-shrink: 0; }
.avatar-img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.avatar-placeholder {
  width: 40px; height: 40px; border-radius: 50%; background: #2F80ED; color: white;
  display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px;
}
.avatar-placeholder.lg { width: 56px; height: 56px; font-size: 22px; }
.user-details { min-width: 0; }
.user-name { font-weight: 600; font-size: 14px; color: #333; }
.user-email, .user-phone { font-size: 12px; color: #999; margin-top: 2px; }

.role-badge { min-width: 60px; }

.action-btns { display: flex; gap: 4px; }

.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0; }

.user-detail-card { padding: 0; }
.detail-avatar-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.detail-avatar img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
.detail-avatar-row h4 { margin: 0 0 6px; font-size: 18px; }
.detail-action-row { display: flex; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0; }

.d-flex { display: flex; }
.gap-2 { gap: 8px; }
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.ms-2 { margin-left: 8px; }
.mt-3 { margin-top: 16px; }
.fw-bold { font-weight: 700; }
.text-muted { color: #999; }
.small { font-size: 12px; }

.loading-pulse { animation: pulse-anim 1.2s ease-in-out infinite; color: #ddd !important; }
@keyframes pulse-anim { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

.trial-user-info { padding: 10px 14px; background: #f5f7fa; border-radius: 8px; }
.trial-info-box {
  background: #fef0f0; border: 1px solid #fde2e2; border-radius: 8px; padding: 12px 16px; margin-top: 8px;
}
.trial-info-box p { margin: 4px 0; font-size: 13px; color: #666; }

.trial-user-info { padding: 10px 14px; background: #f8f9fa; border-radius: 8px; }
.trial-info-box {
  background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 12px 14px;
  font-size: 13px; color: #856404; margin-top: 8px;
}
.trial-info-box p { margin: 4px 0; }

@media (max-width: 992px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .filter-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 768px) {
  .filter-grid { grid-template-columns: 1fr; }
}
</style>
