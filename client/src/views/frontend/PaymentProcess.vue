<template>
  <div class="payment-process-page">
    <div class="container">
      <div class="process-card">
        <!-- 处理中状态 -->
        <div v-if="status === 'processing'" class="process-state">
          <div class="spinner-wrapper">
            <div class="spinner"></div>
          </div>
          <h2>Processing Payment...</h2>
          <p class="process-desc">Please wait while we confirm your payment</p>
          <p class="process-hint">Do not close this page</p>
        </div>

        <!-- 成功状态 -->
        <div v-else-if="status === 'success'" class="process-state">
          <div class="success-icon"><i class="fas fa-check-circle"></i></div>
          <h2>Payment Successful!</h2>
          <p class="process-desc">Redirecting to order details...</p>
        </div>

        <!-- 失败状态 -->
        <div v-else-if="status === 'failed'" class="process-state">
          <div class="fail-icon"><i class="fas fa-times-circle"></i></div>
          <h2>Payment Failed</h2>
          <p class="process-desc">{{ errorMsg || 'Something went wrong with your payment' }}</p>
          <div class="action-buttons">
            <button class="btn-retry" @click="retryPayment">Try Again</button>
            <router-link to="/user/orders" class="btn-orders">View Orders</router-link>
          </div>
        </div>

        <!-- 订单信息 -->
        <div v-if="orderInfo" class="order-summary">
          <div class="summary-row">
            <span>Order</span>
            <span>{{ orderInfo.order_no || '-' }}</span>
          </div>
          <div class="summary-row">
            <span>Amount</span>
            <span class="amount">¥{{ orderInfo.amount || '0.00' }}</span>
          </div>
          <div class="summary-row">
            <span>Product</span>
            <span>{{ orderInfo.product_name || '-' }}</span>
          </div>
        </div>

        <!-- 轮询倒计时 -->
        <div v-if="status === 'processing'" class="poll-info">
          <span>Auto-checking payment status... ({{ pollCount }}/{{ maxPoll }})</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'

const route = useRoute()
const router = useRouter()

const status = ref('processing')
const orderInfo = ref(null)
const errorMsg = ref('')
const pollCount = ref(0)
const maxPoll = 30
let pollTimer = null

onMounted(() => {
  const orderNo = route.query.order_no || route.query.out_trade_no
  if (orderNo) {
    startPolling(orderNo)
  } else {
    status.value = 'failed'
    errorMsg.value = 'Order not found'
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

function startPolling(orderNo) {
  checkPaymentStatus(orderNo)
  pollTimer = setInterval(() => {
    pollCount.value++
    if (pollCount.value >= maxPoll) {
      clearInterval(pollTimer)
      status.value = 'failed'
      errorMsg.value = 'Payment verification timed out. If you have paid, please check your order later.'
      return
    }
    checkPaymentStatus(orderNo)
  }, 3000)
}

async function checkPaymentStatus(orderNo) {
  try {
    const res = await api.get(`/user/orders/${orderNo}/status`)
    const data = res.data || {}
    orderInfo.value = data.order || orderInfo.value

    if (data.status === 'paid' || data.status === 'completed') {
      clearInterval(pollTimer)
      status.value = 'success'
      setTimeout(() => {
        router.push({ path: '/payment/success', query: { order_no: orderNo } })
      }, 1500)
    } else if (data.status === 'failed' || data.status === 'cancelled') {
      clearInterval(pollTimer)
      status.value = 'failed'
      errorMsg.value = data.message || 'Payment was not completed'
    }
  } catch { /* 继续轮询 */ }
}

function retryPayment() {
  const orderNo = route.query.order_no || route.query.out_trade_no
  if (orderNo) {
    status.value = 'processing'
    pollCount.value = 0
    startPolling(orderNo)
  }
}
</script>

<style scoped>
.payment-process-page {
  min-height: calc(100vh - 80px); display: flex; align-items: center; justify-content: center;
  padding: 40px 20px; background: #f8f9fa;
}
.process-card {
  background: white; border-radius: 16px; padding: 48px 40px; text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 460px; width: 100%;
}
.process-state { margin-bottom: 24px; }
.process-card h2 { font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
.process-desc { font-size: 15px; color: #64748b; margin-bottom: 4px; }
.process-hint { font-size: 13px; color: #94a3b8; }

.spinner-wrapper { margin-bottom: 24px; }
.spinner {
  width: 64px; height: 64px; border: 4px solid #e9ecef; border-top-color: #667eea;
  border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

.success-icon i { font-size: 64px; color: #22c55e; margin-bottom: 16px; display: block; }
.fail-icon i { font-size: 64px; color: #ef4444; margin-bottom: 16px; display: block; }

.order-summary {
  background: #f8f9fa; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: left;
}
.summary-row {
  display: flex; justify-content: space-between; padding: 8px 0;
  border-bottom: 1px solid #e9ecef; font-size: 13px; color: #475569;
}
.summary-row:last-child { border-bottom: none; }
.summary-row .amount { color: #e74c3c; font-weight: 600; }

.poll-info { font-size: 12px; color: #94a3b8; margin-top: 12px; }

.action-buttons { display: flex; gap: 12px; justify-content: center; margin-top: 20px; }
.btn-retry {
  padding: 10px 24px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #667eea, #764ba2); color: white;
  font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.3s;
}
.btn-retry:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(102,126,234,0.4); }
.btn-orders {
  padding: 10px 24px; border-radius: 10px; border: 2px solid #e9ecef;
  color: #475569; font-weight: 600; font-size: 14px; text-decoration: none; transition: all 0.3s;
}
.btn-orders:hover { border-color: #667eea; color: #667eea; }

@media (max-width: 768px) {
  .process-card { padding: 32px 24px; }
  .action-buttons { flex-direction: column; }
}
</style>
