<template>
  <div class="wechat-robot-admin" v-loading="loading" element-loading-text="加载中...">
    <div class="page-header">
      <h3 class="page-title">在线微信统计</h3>
    </div>

    <!-- 9 个统计卡片 - 3 列响应式网格 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2)">
          <i class="fas fa-robot"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.total_robots ?? 0 }}</span>
          <span class="stat-label">总机器人数</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #07C160, #06AD56)">
          <i class="fas fa-circle"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.online_robots ?? 0 }}</span>
          <span class="stat-label">在线数</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #3498DB, #2980B9)">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.active_online_robots ?? 0 }}</span>
          <span class="stat-label">有效在线数</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #FA9D3B, #E88B28)">
          <i class="fas fa-user-friends"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ formatNum(stats.total_contacts) }}</span>
          <span class="stat-label">联系人总数</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #9B59B6, #8E44AD)">
          <i class="fas fa-users"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ formatNum(stats.total_groups) }}</span>
          <span class="stat-label">群组总数</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #E74C3C, #C0392B)">
          <i class="fas fa-comment-dots"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ formatNum(stats.total_messages) }}</span>
          <span class="stat-label">消息总数</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #1ABC9C, #16A085)">
          <i class="fas fa-calendar-day"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ formatNum(stats.today_messages) }}</span>
          <span class="stat-label">今日消息数</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #F39C12, #D68910)">
          <i class="fas fa-camera"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ formatNum(stats.total_moments) }}</span>
          <span class="stat-label">朋友圈数</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #576B95, #4A5A7D)">
          <i class="fas fa-reply"></i>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ formatNum(stats.total_auto_replies) }}</span>
          <span class="stat-label">自动回复规则数</span>
        </div>
      </div>
    </div>

    <!-- Table 1: 最近添加的机器人 -->
    <div class="table-section">
      <div class="table-header">
        <h5 class="table-title">
          <i class="fas fa-history text-info me-2"></i>最近添加的机器人
        </h5>
      </div>
      <el-table :data="recentRobots" stripe empty-text="暂无机器人账号" class="data-table">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="微信昵称" min-width="120">
          <template #default="{ row }">
            <div class="d-flex align-items-center gap-2">
              <img v-if="row.avatar" :src="row.avatar" class="avatar-sm" alt="" />
              <div v-else class="avatar-placeholder">
                <i class="fab fa-weixin"></i>
              </div>
              <span>{{ row.nickname || '未登录' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="wxid" label="微信ID" width="150">
          <template #default="{ row }">
            <code>{{ row.wxid || '-' }}</code>
          </template>
        </el-table-column>
        <el-table-column label="所属用户" width="140">
          <template #default="{ row }">
            {{ row.user_display_name || row.username || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="['status-badge', getStatusClass(row)]">
              {{ getStatusText(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="开通时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.activated_at || row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="到期时间" width="160">
          <template #default="{ row }">
            {{ formatExpire(row.wechat_robot_expire_at) }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Table 2: 在线机器人详情 -->
    <div class="table-section">
      <div class="table-header">
        <h5 class="table-title">
          <i class="fab fa-weixin text-success me-2"></i>在线机器人详情
          <span class="badge ms-2">{{ onlineRobots.length }}个在线</span>
        </h5>
      </div>
      <el-table :data="onlineRobots" stripe empty-text="当前没有在线的微信机器人" class="data-table">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="微信昵称" min-width="120">
          <template #default="{ row }">
            <div class="d-flex align-items-center gap-2">
              <img v-if="row.avatar" :src="row.avatar" class="avatar-sm" alt="" />
              <div v-else class="avatar-placeholder">
                <i class="fab fa-weixin"></i>
              </div>
              <span>{{ row.nickname || '未登录' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="wxid" label="微信ID" width="150">
          <template #default="{ row }">
            <code>{{ row.wxid || '-' }}</code>
          </template>
        </el-table-column>
        <el-table-column label="所属用户" min-width="140">
          <template #default="{ row }">
            <div>
              <span class="fw-medium">{{ row.user_display_name || row.username || '-' }}</span>
              <br />
              <small class="text-muted">{{ row.email || '' }}</small>
              <br v-if="row.wechat_robot_limit" />
              <small class="text-info" v-if="row.wechat_robot_limit">配额: {{ row.wechat_robot_limit }}个</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="['status-badge', getStatusClass(row)]">
              {{ getStatusText(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="开通时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.activated_at || row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="到期时间" width="160">
          <template #default="{ row }">
            {{ formatExpire(row.wechat_robot_expire_at) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'

const accounts = ref([])
const stats = ref({})
const loading = ref(false)
const loadError = ref('')

// 最近添加的机器人（前10个）
const recentRobots = computed(() => accounts.value.slice(0, 10))

// 在线机器人详情
const onlineRobots = computed(() =>
  accounts.value.filter((a) => a.status === 'online' && a.is_active !== 0)
)

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    await Promise.all([loadAccounts(), loadStats()])
  } catch (e) {
    loadError.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadAccounts() {
  try {
    const res = await api.get('/admin/wechat-robot/accounts')
    accounts.value = Array.isArray(res.data) ? res.data : res.data?.data || []
  } catch (e) {
    console.error('loadAccounts error:', e)
    accounts.value = []
  }
}

async function loadStats() {
  try {
    const res = await api.get('/admin/wechat-robot/stats')
    stats.value = res.data || {}
  } catch (e) {
    console.error('loadStats error:', e)
    stats.value = {}
  }
}

function formatNum(n) {
  if (n == null || n === undefined) return '0'
  const num = Number(n)
  return num >= 10000 ? (num / 10000).toFixed(1) + '万' : String(num)
}

function formatDate(d) {
  if (!d) return '-'
  try {
    const dt = new Date(d)
    return dt.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(d)
  }
}

function formatExpire(expireAt) {
  if (!expireAt) return '永久有效'
  try {
    const ts = new Date(expireAt).getTime()
    const now = Date.now()
    const week = 7 * 24 * 3600 * 1000
    const dateStr = formatDate(expireAt)
    if (ts < now) return `${dateStr} (已过期)`
    if (ts < now + week) return `${dateStr} (即将到期)`
    return dateStr
  } catch {
    return String(expireAt)
  }
}

function isExpired(row) {
  const t = row?.wechat_robot_expire_at
  if (!t) return false
  return new Date(t).getTime() < Date.now()
}

function getStatusClass(row) {
  if (isExpired(row)) return 'status-expired'
  const s = row?.status || ''
  return s === 'online' ? 'status-online' : s === 'logging' ? 'status-logging' : s === 'error' ? 'status-error' : 'status-offline'
}

function getStatusText(row) {
  if (isExpired(row)) return '已过期'
  const map = { online: '在线', offline: '离线', logging: '登录中', error: '异常' }
  return map[row?.status] || '未知'
}
</script>

<style scoped>
.wechat-robot-admin {
  padding: 0;
}

.page-header {
  margin-bottom: var(--space-lg, 24px);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

/* 统计卡片网格 - 3列桌面端 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md, 16px);
  margin-bottom: var(--space-xl, 32px);
}

@media (max-width: 992px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: var(--space-md, 16px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: var(--space-md, 16px);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
  flex-shrink: 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #333);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
}

/* 表格区块 */
.table-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: var(--space-lg, 24px);
}

.table-header {
  background: #f7f7f7;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
}

.table-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 10px;
  background: rgba(7, 193, 96, 0.15);
  color: #07c160;
}

.data-table {
  width: 100%;
}

/* 头像 */
.avatar-sm {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
}

.avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(135deg, #07c160, #06ad56);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

/* 状态徽章 */
.status-badge {
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-online {
  background: rgba(7, 193, 96, 0.1);
  color: #07c160;
}

.status-offline {
  background: rgba(136, 136, 136, 0.1);
  color: #888;
}

.status-logging {
  background: rgba(250, 157, 59, 0.1);
  color: #fa9d3b;
}

.status-error {
  background: rgba(250, 81, 81, 0.1);
  color: #fa5151;
}

.status-expired {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

/* 工具类 */
.d-flex { display: flex; }
.align-items-center { align-items: center; }
.gap-2 { gap: 8px; }
.me-2 { margin-right: 8px; }
.ms-2 { margin-left: 8px; }
.text-muted { color: #888; }
.text-info { color: #3498db; }
.text-success { color: #07c160; }
.fw-medium { font-weight: 500; }
code {
  font-size: 0.85em;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
