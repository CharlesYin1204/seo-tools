<template>
  <div class="payment-result-page">
    <div class="container">
      <div class="result-card">
        <!-- 支付成功 -->
        <template v-if="tradeSuccess">
          <div class="success-icon"><i class="fas fa-check-circle"></i></div>
          <h2>支付成功！</h2>
          <p class="result-desc">您的支付已完成处理</p>
        </template>
        <!-- 状态未知 -->
        <template v-else>
          <div class="success-icon"><i class="fas fa-info-circle" style="color:#e6a23c"></i></div>
          <h2>支付结果</h2>
          <p class="result-desc">正在确认支付状态…</p>
        </template>

        <div class="order-details">
          <div class="detail-row">
            <span class="detail-label">订单号</span>
            <span class="detail-value">{{ orderNo || '-' }}</span>
          </div>
          <div class="detail-row" v-if="routeMoney">
            <span class="detail-label">金额</span>
            <span class="detail-value price">¥{{ routeMoney }}</span>
          </div>
          <div class="detail-row" v-if="routeName">
            <span class="detail-label">商品</span>
            <span class="detail-value">{{ routeName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态</span>
            <span class="detail-value" :style="{ color: tradeSuccess ? '#22c55e' : '#e6a23c', fontWeight: 600 }">
              {{ tradeSuccess ? '已支付' : '处理中' }}
            </span>
          </div>
        </div>

        <div class="action-buttons">
          <router-link to="/user/membership" class="btn-secondary">返回会员中心</router-link>
          <router-link to="/user/balance" class="btn-secondary">返回余额</router-link>
          <router-link to="/" class="btn-primary-custom">回到首页</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api'

const route = useRoute()

const orderNo = computed(() => route.query.out_trade_no || route.query.order_no || '')
const routeMoney = computed(() => route.query.money || '')
const routeName = computed(() => route.query.name || '')
const tradeSuccess = ref(route.query.trade_status === 'TRADE_SUCCESS')
const confirming = ref(false)

onMounted(async () => {
  if (!orderNo.value) return
  confirming.value = true
  try {
    const res = await api.get('/api/payment/check-status', {
      params: { out_trade_no: orderNo.value, _t: Date.now() },
    })
    const data = res.data?.data || res.data
    if (data?.paid || data?.status === 'paid') {
      tradeSuccess.value = true
    }
  } catch {}
  confirming.value = false
})
</script>

<style scoped>
.payment-result-page {
  min-height: calc(100vh - 80px); display: flex; align-items: center; justify-content: center;
  padding: 40px 20px; background: #f8f9fa;
}
.result-card {
  background: white; border-radius: 16px; padding: 48px 40px; text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 480px; width: 100%;
}
.success-icon { margin-bottom: 20px; }
.success-icon i { font-size: 72px; color: #22c55e; }
.result-card h2 { font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
.result-desc { font-size: 15px; color: #64748b; margin-bottom: 28px; }

.order-details {
  background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 28px; text-align: left;
}
.detail-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid #e9ecef;
}
.detail-row:last-child { border-bottom: none; }
.detail-label { font-size: 13px; color: #94a3b8; }
.detail-value { font-size: 14px; color: #1e293b; font-weight: 500; }
.detail-value.price { color: #e74c3c; font-size: 16px; font-weight: 600; }

.action-buttons { display: flex; gap: 12px; justify-content: center; }
.btn-secondary {
  padding: 12px 24px; border-radius: 10px; border: 2px solid #e9ecef;
  color: #475569; font-weight: 600; font-size: 14px; text-decoration: none; transition: all 0.3s;
}
.btn-secondary:hover { border-color: #667eea; color: #667eea; }
.btn-primary-custom {
  padding: 12px 24px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #667eea, #764ba2); color: white;
  font-weight: 600; font-size: 14px; text-decoration: none; transition: all 0.3s;
}
.btn-primary-custom:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(102,126,234,0.4); }

@media (max-width: 768px) {
  .result-card { padding: 32px 24px; }
  .success-icon i { font-size: 56px; }
  .result-card h2 { font-size: 20px; }
  .action-buttons { flex-direction: column; }
}
</style>
