<template>
  <div>
    <div class="page-header"><h3 class="page-title">订单中心</h3></div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <i class="fas fa-shopping-cart"></i>
        </div>
        <div class="stat-info">
          <span class="stat-label">总订单数</span>
          <span class="stat-value">{{ stats.total_orders }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
          <i class="fas fa-yen-sign"></i>
        </div>
        <div class="stat-info">
          <span class="stat-label">累计收入</span>
          <span class="stat-value">¥{{ stats.total_revenue }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #ffecd2, #fcb69f);">
          <i class="fas fa-clock"></i>
        </div>
        <div class="stat-info">
          <span class="stat-label">待支付</span>
          <span class="stat-value">{{ stats.pending_orders }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #a1c4fd, #c2e9fb);">
          <i class="fas fa-calendar-day"></i>
        </div>
        <div class="stat-info">
          <span class="stat-label">今日订单</span>
          <span class="stat-value">{{ stats.today_orders }}</span>
        </div>
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="card-container">
      <div class="filter-bar">
        <el-input v-model="keyword" placeholder="搜索订单号/用户名..." clearable style="width:220px" @keyup.enter="handleSearch" />
        <el-select v-model="statusFilter" placeholder="订单状态" clearable style="width:130px" @change="handleSearch">
          <el-option label="已支付" value="paid" />
          <el-option label="待支付" value="pending" />
          <el-option label="已取消" value="cancelled" />
          <el-option label="已退款" value="refunded" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:280px" @change="handleSearch" />
        <el-button type="primary" @click="handleSearch"><i class="fas fa-search me-1"></i>搜索</el-button>
        <el-button @click="resetFilters"><i class="fas fa-redo me-1"></i>重置</el-button>
      </div>

      <!-- 订单表格 -->
      <el-table :data="orders" stripe v-loading="loading" style="width:100%">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="order_id" label="订单号" min-width="200">
          <template #default="{ row }">
            <a href="javascript:void(0)" class="order-link" @click="showDetail(row)">{{ row.order_id }}</a>
          </template>
        </el-table-column>
        <el-table-column label="用户" width="130">
          <template #default="{ row }">{{ row.username || row.email || '-' }}</template>
        </el-table-column>
        <el-table-column prop="organization_name" label="组织" min-width="130" show-overflow-tooltip />
        <el-table-column prop="title" label="商品" min-width="160" />
        <el-table-column label="金额" width="100">
          <template #default="{ row }">
            <span class="amount-text">¥{{ parseFloat(row.amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" width="100">
          <template #default="{ row }">
            <span>{{ paymentMethodLabel(row.payment_method) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订阅" width="110">
          <template #default="{ row }"><el-tag v-if="row.subscription_status" :type="subscriptionTagType(row.subscription_status)" size="small">{{ subscriptionLabel(row.subscription_status) }}</el-tag><span v-else>-</span></template>
        </el-table-column>
        <el-table-column label="下单时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="showDetail(row)">详情</el-button>
            <el-button v-if="allowedTransitions(row.status).length" type="warning" link size="small" @click="openStatusDialog(row)">改状态</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="d-flex justify-content-center mt-3">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next, jumper"
          @current-change="loadOrders"
        />
      </div>
    </div>

    <!-- 订单详情弹窗 -->
    <el-dialog v-model="detailVisible" title="订单详情" width="560px" :close-on-click-modal="false">
      <div v-if="detailOrder" class="order-detail">
        <div class="detail-row"><label>订单号</label><span>{{ detailOrder.order_id }}</span></div>
        <div class="detail-row"><label>用户</label><span>{{ detailOrder.username || detailOrder.email || '-' }}</span></div>
        <div class="detail-row"><label>组织</label><span>{{ detailOrder.organization_name || '-' }}</span></div>
        <div class="detail-row"><label>商品</label><span>{{ detailOrder.title }}</span></div>
        <div class="detail-row"><label>金额</label><span class="amount-text">¥{{ parseFloat(detailOrder.amount || 0).toFixed(2) }}</span></div>
        <div class="detail-row"><label>支付方式</label><span>{{ paymentMethodLabel(detailOrder.payment_method) }}</span></div>
        <div class="detail-row"><label>状态</label><el-tag :type="statusTagType(detailOrder.status)" size="small">{{ statusLabel(detailOrder.status) }}</el-tag></div>
        <div class="detail-row"><label>交易号</label><span>{{ detailOrder.trade_no || '-' }}</span></div>
        <div class="detail-row"><label>下单时间</label><span>{{ formatTime(detailOrder.created_at) }}</span></div>
        <div class="detail-row"><label>支付时间</label><span>{{ detailOrder.paid_at ? formatTime(detailOrder.paid_at) : '-' }}</span></div>
        <div class="detail-row"><label>订阅套餐</label><span>{{ detailOrder.subscription_plan_name || '-' }}</span></div>
        <div class="detail-row"><label>订阅状态</label><el-tag v-if="detailOrder.subscription_status" :type="subscriptionTagType(detailOrder.subscription_status)" size="small">{{ subscriptionLabel(detailOrder.subscription_status) }}</el-tag><span v-else>-</span></div>
        <div class="detail-row"><label>订阅到期</label><span>{{ detailOrder.subscription_period_end ? formatTime(detailOrder.subscription_period_end) : '-' }}</span></div>
        <div class="detail-row"><label>更新时间</label><span>{{ formatTime(detailOrder.updated_at) }}</span></div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="detailOrder && allowedTransitions(detailOrder.status).length" type="warning" @click="openStatusDialog(detailOrder)">修改状态</el-button>
      </template>
    </el-dialog>

    <!-- 修改状态弹窗 -->
    <el-dialog v-model="statusDialogVisible" title="修改订单状态" width="400px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="当前状态">
          <el-tag :type="statusTagType(editingOrder?.status)" size="small">{{ statusLabel(editingOrder?.status) }}</el-tag>
        </el-form-item>
        <el-form-item label="新状态">
          <el-select v-model="newStatus" placeholder="选择新状态" style="width:100%">
            <el-option v-for="status in allowedTransitions(editingOrder?.status)" :key="status" :label="statusLabel(status)" :value="status" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="statusUpdating" @click="updateOrderStatus">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const orders = ref([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const dateRange = ref(null)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const stats = reactive({
  total_orders: 0,
  total_revenue: 0,
  pending_orders: 0,
  today_orders: 0,
  today_revenue: 0,
})

const detailVisible = ref(false)
const detailOrder = ref(null)

const statusDialogVisible = ref(false)
const editingOrder = ref(null)
const newStatus = ref('')
const statusUpdating = ref(false)

const STATUS_MAP = {
  paid: '已支付',
  pending: '待支付',
  cancelled: '已取消',
  refunded: '已退款',
  completed: '已完成',
}

const STATUS_TAG_MAP = {
  paid: 'success',
  pending: 'warning',
  cancelled: 'danger',
  refunded: 'info',
  completed: 'success',
}

const PAYMENT_MAP = {
  yipay: '易支付',
  wechat: '微信支付',
  alipay: '支付宝',
  balance: '余额支付',
  card_key: '卡密兑换',
}

function statusLabel(s) { return STATUS_MAP[s] || s || '-' }
function statusTagType(s) { return STATUS_TAG_MAP[s] || 'info' }
function paymentMethodLabel(m) { return PAYMENT_MAP[m] || m || '-' }
const SUBSCRIPTION_MAP = { trialing: '试用中', active: '生效中', past_due: '逾期', cancelled: '已取消', expired: '已到期' }
function subscriptionLabel(status) { return SUBSCRIPTION_MAP[status] || status || '-' }
function subscriptionTagType(status) { return status === 'active' ? 'success' : status === 'trialing' ? 'warning' : status === 'past_due' ? 'danger' : 'info' }
const TRANSITIONS = { pending: ['paid', 'cancelled'], paid: ['completed', 'refunded'], completed: ['refunded'], cancelled: [], refunded: [] }
function allowedTransitions(status) { return TRANSITIONS[status] || [] }

function formatTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function handleSearch() {
  page.value = 1
  loadOrders()
}

function resetFilters() {
  keyword.value = ''
  statusFilter.value = ''
  dateRange.value = null
  page.value = 1
  loadOrders()
}

async function loadOrders() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (keyword.value) params.keyword = keyword.value
    if (statusFilter.value) params.status = statusFilter.value
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    const res = await api.get('/admin/orders', { params })
    orders.value = res.data?.data || []
    total.value = res.data?.pagination?.total || res.data?.total || 0
  } catch (e) {
    console.error('加载订单失败', e)
  }
  loading.value = false
}

async function loadStats() {
  try {
    const res = await api.get('/admin/orders/stats')
    const data = res.data || {}
    stats.total_orders = data.total_orders || 0
    stats.total_revenue = parseFloat(data.total_revenue || 0).toFixed(2)
    stats.pending_orders = data.pending_orders || 0
    stats.today_orders = data.today_orders || 0
    stats.today_revenue = parseFloat(data.today_revenue || 0).toFixed(2)
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

function showDetail(row) {
  detailOrder.value = { ...row }
  detailVisible.value = true
}

function openStatusDialog(row) {
  editingOrder.value = { ...row }
  newStatus.value = ''
  statusDialogVisible.value = true
}

async function updateOrderStatus() {
  if (!editingOrder.value || !newStatus.value) return
  if (newStatus.value === editingOrder.value.status) {
    ElMessage.warning('状态未改变')
    return
  }
  statusUpdating.value = true
  try {
    await api.put(`/admin/orders/${editingOrder.value.id}/status`, { status: newStatus.value })
    ElMessage.success('订单状态更新成功')
    statusDialogVisible.value = false
    detailVisible.value = false
    loadOrders()
    loadStats()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '状态更新失败')
  }
  statusUpdating.value = false
}

onMounted(() => {
  loadOrders()
  loadStats()
})
</script>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  flex-shrink: 0;
}
.stat-info {
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #333;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  align-items: center;
}
.order-link {
  color: #2F80ED;
  text-decoration: none;
  font-weight: 500;
}
.order-link:hover {
  text-decoration: underline;
}
.amount-text {
  font-weight: 600;
  color: #e74c3c;
}
.order-detail {
  padding: 0 8px;
}
.detail-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.detail-row:last-child {
  border-bottom: none;
}
.detail-row label {
  width: 80px;
  color: #999;
  font-size: 13px;
  flex-shrink: 0;
}
.detail-row span,
.detail-row .el-tag {
  font-size: 14px;
  color: #333;
}

@media (max-width: 992px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 576px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
  .filter-bar {
    flex-direction: column;
  }
  .filter-bar > * {
    width: 100% !important;
  }
}
</style>
