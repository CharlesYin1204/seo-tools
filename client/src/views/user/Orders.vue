<template>
  <div class="orders-page" :class="{ 'is-mobile': isMobile }">
    <!-- 移动端返回头部 -->
    <div v-if="isMobile" class="m-page-header">
      <router-link to="/user/dashboard" class="m-back-btn"><i class="fas fa-arrow-left"></i></router-link>
      <span class="m-page-title">订单中心</span>
      <span></span>
    </div>

    <div v-if="!isMobile" class="page-header"><h3 class="page-title">我的订单</h3></div>

    <div class="card-container">
      <!-- 状态筛选标签 -->
      <div class="status-tabs">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          class="status-tab"
          :class="{ active: statusFilter === tab.value }"
          @click="switchStatus(tab.value)"
        >
          {{ tab.label }}
          <span v-if="tab.value === '' && total > 0" class="tab-count">{{ total }}</span>
        </button>
      </div>

      <!-- PC端表格 -->
      <template v-if="!isMobile">
        <el-table :data="orders" stripe v-loading="loading" style="width:100%" empty-text="暂无订单记录">
          <el-table-column prop="order_no" label="订单号" min-width="200">
            <template #default="{ row }">
              <a href="javascript:void(0)" class="order-link" @click="showDetail(row)">{{ row.order_no }}</a>
            </template>
          </el-table-column>
          <el-table-column prop="product_name" label="商品" min-width="160" />
          <el-table-column label="金额" width="110">
            <template #default="{ row }">
              <span class="amount-text">¥{{ parseFloat(row.amount || 0).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="支付方式" width="100">
            <template #default="{ row }">{{ paymentMethodLabel(row.payment_method) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="下单时间" width="170">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'pending'" type="primary" link size="small" @click="payOrder(row)">支付</el-button>
              <el-button type="primary" link size="small" @click="showDetail(row)">详情</el-button>
              <el-button v-if="row.status === 'pending'" type="danger" link size="small" @click="confirmCancel(row)">取消</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 移动端卡片列表 -->
      <template v-else>
        <div v-loading="loading" class="m-order-list">
          <div v-for="row in orders" :key="row.id" class="m-order-card" @click="showDetail(row)">
            <div class="m-order-top">
              <span class="m-order-no">{{ row.order_no }}</span>
              <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            </div>
            <div class="m-order-body">
              <div class="m-order-product">{{ row.product_name }}</div>
              <div class="m-order-amount">¥{{ parseFloat(row.amount || 0).toFixed(2) }}</div>
            </div>
            <div class="m-order-bottom">
              <span class="m-order-pay">{{ paymentMethodLabel(row.payment_method) }}</span>
              <span class="m-order-time">{{ formatTime(row.created_at) }}</span>
            </div>
            <div v-if="row.status === 'pending'" class="m-order-actions">
              <el-button type="primary" size="small" @click.stop="payOrder(row)">立即支付</el-button>
              <el-button type="danger" size="small" plain @click.stop="confirmCancel(row)">取消订单</el-button>
            </div>
          </div>
          <div v-if="!loading && orders.length === 0" class="m-empty">
            <div class="m-empty-icon"><i class="fas fa-receipt"></i></div>
            <div class="m-empty-text">暂无订单记录</div>
          </div>
        </div>
      </template>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="d-flex justify-content-center mt-3">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          :layout="isMobile ? 'prev, pager, next' : 'total, prev, pager, next'"
          small
          @current-change="loadOrders"
        />
      </div>
    </div>

    <!-- 订单详情弹窗 -->
    <el-dialog v-model="detailVisible" title="订单详情" :width="isMobile ? '92%' : '520px'" :close-on-click-modal="false">
      <div v-if="detailOrder" class="order-detail">
        <div class="detail-row"><label>订单号</label><span style="word-break:break-all">{{ detailOrder.order_no || detailOrder.order_id }}</span></div>
        <div class="detail-row"><label>商品</label><span>{{ detailOrder.product_name || detailOrder.title }}</span></div>
        <div class="detail-row"><label>金额</label><span class="amount-text">¥{{ parseFloat(detailOrder.amount || 0).toFixed(2) }}</span></div>
        <div class="detail-row"><label>支付方式</label><span>{{ paymentMethodLabel(detailOrder.payment_method) }}</span></div>
        <div class="detail-row">
          <label>状态</label>
          <el-tag :type="statusTagType(detailOrder.status)" size="small">{{ statusLabel(detailOrder.status) }}</el-tag>
        </div>
        <div class="detail-row"><label>下单时间</label><span>{{ formatTime(detailOrder.created_at) }}</span></div>
        <div class="detail-row"><label>支付时间</label><span>{{ detailOrder.paid_at ? formatTime(detailOrder.paid_at) : '-' }}</span></div>
        <div v-if="detailOrder.status === 'pending'" class="detail-row"><label>付款渠道</label><el-select v-model="payType" style="width:180px"><el-option label="支付宝" value="alipay"/><el-option label="微信支付" value="wxpay"/></el-select></div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="detailOrder && detailOrder.status === 'pending'" type="primary" @click="payOrder(detailOrder)">立即支付</el-button>
        <el-button v-if="detailOrder && detailOrder.status === 'pending'" type="danger" @click="confirmCancel(detailOrder)">取消订单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const isMobile = ref(window.innerWidth < 768)
const orders = ref([])
const loading = ref(false)
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const detailVisible = ref(false)
const detailOrder = ref(null)
const payType = ref('alipay')
const route = useRoute()
const pendingPaymentId = ref('')
let paymentPollTimer = null
let checkingPayment = false
let paymentPollAttempts = 0

const statusTabs = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已取消', value: 'cancelled' },
  { label: '已退款', value: 'refunded' },
]

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

function formatTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function switchStatus(val) {
  statusFilter.value = val
  page.value = 1
  loadOrders()
}

async function loadOrders() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await api.get('/user/orders', { params })
    orders.value = res.data?.data || []
    total.value = res.data?.pagination?.total || res.data?.total || 0
  } catch (e) {
    console.error('加载订单失败', e)
  }
  loading.value = false
}

function showDetail(row) {
  detailOrder.value = { ...row }
  detailVisible.value = true
}

async function payOrder(row) {
  const orderNo = row.order_no || row.order_id
  if (!orderNo) return ElMessage.error('订单号无效')
  const paymentWindow = window.open('', '_blank')
  if (!paymentWindow) return ElMessage.error('浏览器阻止了支付窗口，请允许弹窗后重试')
  paymentWindow.document.write('<p style="font-family:system-ui;text-align:center;margin-top:20vh">正在准备支付...</p>')
  try {
    const response = await api.get(`/api/payment/redirect/${encodeURIComponent(orderNo)}`, {
      params: { type: payType.value },
      responseType: 'text',
    })
    paymentWindow.document.open()
    paymentWindow.document.write(response.data)
    paymentWindow.document.close()
    pendingPaymentId.value = orderNo
    startPaymentPolling()
  } catch (error) {
    paymentWindow.close()
    ElMessage.error(error?.response?.data?.message || '创建支付页面失败')
  }
}

function stopPaymentPolling() {
  if (paymentPollTimer) clearInterval(paymentPollTimer)
  paymentPollTimer = null
}

async function checkPaymentStatus() {
  if (!pendingPaymentId.value || checkingPayment) return
  if (paymentPollAttempts >= 120) {
    stopPaymentPolling()
    return
  }
  paymentPollAttempts += 1
  checkingPayment = true
  try {
    const response = await api.get(`/user/orders/${encodeURIComponent(pendingPaymentId.value)}/status`)
    if (response.data?.status === 'paid') {
      stopPaymentPolling()
      pendingPaymentId.value = ''
      detailVisible.value = false
      ElMessage.success('支付成功，套餐权益已生效')
      await loadOrders()
    }
  } catch {
    // A transient payment-status error should not interrupt the payment window.
  } finally {
    checkingPayment = false
  }
}

function startPaymentPolling() {
  stopPaymentPolling()
  paymentPollAttempts = 0
  checkPaymentStatus()
  paymentPollTimer = setInterval(checkPaymentStatus, 5000)
}

async function confirmCancel(row) {
  try {
    await ElMessageBox.confirm(
      `确定要取消订单 ${row.order_no || row.order_id} 吗？取消后不可恢复。`,
      '取消订单',
      { confirmButtonText: '确定取消', cancelButtonText: '返回', type: 'warning' }
    )
    const res = await api.post(`/user/orders/${row.id}/cancel`)
    if (res.data?.success) {
      ElMessage.success('订单已取消')
      detailVisible.value = false
      loadOrders()
    } else {
      ElMessage.error(res.data?.message || '取消失败')
    }
  } catch (e) {
    if (e !== 'cancel' && e?.toString() !== 'cancel') {
      ElMessage.error(e.response?.data?.message || '操作失败')
    }
  }
}

onMounted(async () => {
  window.addEventListener('focus', checkPaymentStatus)
  await loadOrders()
  const orderNo = String(route.query.order || '')
  if (orderNo) {
    const row = orders.value.find(item => String(item.order_no || item.order_id) === orderNo)
    if (row) showDetail(row)
  }
})
onBeforeUnmount(() => {
  stopPaymentPolling()
  window.removeEventListener('focus', checkPaymentStatus)
})
</script>

<style scoped>
.orders-page { max-width: 1200px; }
.orders-page.is-mobile { padding: 0; margin: -12px; background: #f5f6fa; min-height: 100vh; }

/* 移动端头部 */
.m-page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #fff; border-bottom: 1px solid #f0f0f0;
}
.m-back-btn { color: #333; text-decoration: none; font-size: 16px; width: 32px; }
.m-page-title { font-size: 16px; font-weight: 600; color: #333; }

.card-container { padding: 0 16px; }
.orders-page.is-mobile .card-container { padding: 12px; }

.status-tabs {
  display: flex; gap: 0; margin-bottom: 16px;
  border-bottom: 2px solid #f0f0f0; background: #fff;
}
.status-tab {
  background: none; border: none; padding: 10px 20px; font-size: 14px;
  color: #666; cursor: pointer; border-bottom: 2px solid transparent;
  margin-bottom: -2px; transition: all 0.25s;
  display: flex; align-items: center; gap: 6px;
}
.status-tab:hover { color: #2F80ED; }
.status-tab.active { color: #2F80ED; border-bottom-color: #2F80ED; font-weight: 600; }
.tab-count {
  background: #2F80ED; color: #fff; font-size: 11px;
  padding: 1px 6px; border-radius: 10px; line-height: 1.4;
}
.order-link { color: #2F80ED; text-decoration: none; font-weight: 500; }
.order-link:hover { text-decoration: underline; }
.amount-text { font-weight: 600; color: #e74c3c; }

/* 订单详情弹窗 */
.order-detail { padding: 0 8px; }
.detail-row {
  display: flex; align-items: center; padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.detail-row:last-child { border-bottom: none; }
.detail-row label { width: 80px; color: #999; font-size: 13px; flex-shrink: 0; }
.detail-row span, .detail-row .el-tag { font-size: 14px; color: #333; }

/* 移动端卡片列表 */
.m-order-list { display: flex; flex-direction: column; gap: 10px; }
.m-order-card {
  background: #fff; border-radius: 10px; padding: 12px 14px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06); cursor: pointer;
  transition: box-shadow 0.2s;
}
.m-order-card:active { box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
.m-order-top {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
}
.m-order-no { font-size: 12px; color: #999; font-family: monospace; }
.m-order-body {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
}
.m-order-product { font-size: 14px; font-weight: 600; color: #333; flex: 1; }
.m-order-amount { font-size: 16px; font-weight: 700; color: #e74c3c; flex-shrink: 0; margin-left: 12px; }
.m-order-bottom {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; color: #999;
}
.m-order-actions { margin-top: 10px; padding-top: 10px; border-top: 1px solid #f5f5f5; text-align: right; }

.m-empty { text-align: center; padding: 40px 0; }
.m-empty-icon { font-size: 40px; color: #ddd; margin-bottom: 12px; }
.m-empty-text { font-size: 14px; color: #999; }

@media (max-width: 576px) {
  .status-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .status-tab { white-space: nowrap; padding: 8px 14px; font-size: 13px; }
}
</style>
