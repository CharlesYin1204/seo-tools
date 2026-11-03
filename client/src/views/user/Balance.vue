<template>
  <div class="balance-page" :class="{ 'is-mobile': isMobile }">
    <!-- 移动端返回头部 -->
    <div v-if="isMobile" class="m-page-header">
      <router-link to="/user/dashboard" class="m-back-btn"><i class="fas fa-arrow-left"></i></router-link>
      <span class="m-page-title">我的余额</span>
      <span></span>
    </div>

    <!-- 余额总览卡片 -->
    <div class="balance-hero">
      <div class="hero-bg">
        <div class="hero-circle c1"></div>
        <div class="hero-circle c2"></div>
      </div>
      <div class="hero-content">
        <div class="hero-label"><i class="fas fa-wallet"></i> 账户余额 (元)</div>
        <div class="hero-amount">
          <span class="hero-currency">¥</span>{{ formatMoney(balanceInfo.balance) }}
        </div>
        <div class="hero-sub">
          累计充值 ¥{{ formatMoney(balanceInfo.total_recharge ?? 0) }} · 累计消费 ¥{{ formatMoney(balanceInfo.total_spent ?? 0) }}
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="action-row">
      <div class="action-item" @click="scrollToHistory">
        <div class="action-icon" style="background: linear-gradient(135deg, #667eea, #764ba2)"><i class="fas fa-receipt"></i></div>
        <span>交易明细</span>
      </div>
      <div class="action-item" @click="showRechargeDialog = true">
        <div class="action-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7)"><i class="fas fa-plus-circle"></i></div>
        <span>充值</span>
      </div>
      <div class="action-item" @click="showCardKeyDialog = true">
        <div class="action-icon" style="background: linear-gradient(135deg, #fa709a, #fee140)"><i class="fas fa-key"></i></div>
        <span>卡密充值</span>
      </div>
      <div class="action-item">
        <div class="action-icon" style="background: linear-gradient(135deg, #a18cd1, #fbc2eb)"><i class="fas fa-question-circle"></i></div>
        <span>帮助</span>
      </div>
    </div>

    <!-- 卡密充值弹窗 -->
    <el-dialog v-model="showCardKeyDialog" title="卡密充值" :width="isMobile ? '92%' : '400px'">
      <p style="color:#666;font-size:13px;margin-bottom:16px;">输入余额卡密，即可为账户充值对应金额。</p>
      <el-input v-model="balanceCardCode" placeholder="请输入余额卡密" size="large" clearable>
        <template #prefix><i class="fas fa-key" style="color:#999"></i></template>
      </el-input>
      <template #footer>
        <el-button @click="showCardKeyDialog = false">取消</el-button>
        <el-button type="primary" @click="redeemBalanceCard" :loading="redeemingCard">兑换充值</el-button>
      </template>
    </el-dialog>

    <!-- 在线充值弹窗 -->
    <el-dialog v-model="showRechargeDialog" title="余额充值" :width="isMobile ? '92%' : '420px'" @close="resetRechargeForm">
      <div v-if="!rechargeError" class="recharge-form">
        <p class="recharge-hint">选择充值金额，支持支付宝、微信支付</p>
        <el-form label-width="80px">
          <el-form-item label="充值金额">
            <div class="amount-options">
              <span v-for="a in [50, 100, 200, 500, 1000]" :key="a"
                    class="amount-opt" :class="{ active: rechargeAmount === a }"
                    @click="rechargeAmount = a">¥{{ a }}</span>
              <el-input-number v-model="rechargeAmount" :min="1" :max="50000" :step="10" size="default" class="amount-input" />
            </div>
          </el-form-item>
          <el-form-item label="支付方式">
            <el-radio-group v-model="rechargePayMethod">
              <el-radio v-if="enabledMethods.includes('wechat')" label="wechat"><i class="fab fa-weixin" style="color:#07c160;margin-right:4px"></i>微信官方支付</el-radio>
              <el-radio v-if="enabledMethods.includes('yipay')" label="yipay_alipay"><i class="fab fa-alipay" style="color:#1677ff;margin-right:4px"></i>支付宝</el-radio>
              <el-radio v-if="enabledMethods.includes('yipay')" label="yipay_wxpay"><i class="fab fa-weixin" style="color:#07c160;margin-right:4px"></i>微信支付(易支付)</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </div>
      <p v-else class="recharge-error">{{ rechargeError }}</p>
      <template #footer>
        <el-button @click="showRechargeDialog = false">取消</el-button>
        <el-button type="primary" @click="doRecharge" :loading="recharging">
          <i class="fas fa-credit-card me-1"></i>去支付
        </el-button>
      </template>
    </el-dialog>

    <!-- 支付等待弹窗 -->
    <el-dialog v-model="showPayWaiting" title="等待支付结果" :width="isMobile ? '92%' : '420px'" :close-on-click-modal="false" @close="closePayWaiting">
      <div style="text-align:center;padding:16px 0;">
        <!-- 微信Native支付二维码 -->
        <template v-if="wechatCodeUrl">
          <div style="margin-bottom:12px;">
            <i class="fab fa-weixin" style="font-size:36px;color:#07c160;margin-bottom:8px;display:block"></i>
            <p style="font-weight:600;font-size:15px;margin-bottom:8px;">请使用微信扫码支付</p>
            <p style="color:#666;font-size:13px;margin-bottom:12px;">支付金额: ¥{{ rechargeAmount }}</p>
          </div>
          <div style="display:inline-block;padding:12px;background:#fff;border:1px solid #eee;border-radius:8px;">
            <img :src="wechatQrCodeDataUrl" alt="微信支付二维码" style="width:200px;height:200px;" v-if="wechatQrCodeDataUrl" />
            <div v-else style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#999;">
              <i class="fas fa-spinner fa-spin" style="font-size:24px;"></i>
            </div>
          </div>
        </template>
        <!-- 易支付跳转 -->
        <template v-else>
          <i class="fas fa-external-link-alt" style="font-size:36px;color:var(--primary-color,#2F80ED);margin-bottom:12px;display:block"></i>
          <p style="font-weight:600;font-size:15px;margin-bottom:8px;">支付页面已打开</p>
          <p style="color:#666;font-size:13px;margin-bottom:4px;">请在新窗口中完成扫码支付</p>
        </template>
        <p v-if="checkingPay" style="color:#999;font-size:12px;margin-top:8px;">
          <i class="fas fa-spinner fa-spin" style="margin-right:4px"></i>正在自动检测支付结果…
        </p>
        <p style="color:#e6a23c;font-size:12px;margin-top:8px;">
          支付完成后如未自动识别，请点击下方「我已完成支付」
        </p>
      </div>
      <template #footer>
        <el-button @click="closePayWaiting">关闭</el-button>
        <el-button type="success" @click="manualCheckRecharge" :loading="recharging">
          <i class="fas fa-check-circle" style="margin-right:4px"></i>我已完成支付
        </el-button>
      </template>
    </el-dialog>

    <!-- 交易明细 -->
    <div class="history-section" ref="historyRef">
      <div class="section-header">
        <span class="section-title"><i class="fas fa-list-ul"></i> 交易明细</span>
        <span class="section-total">共 {{ total }} 条记录</span>
      </div>

      <div v-loading="loading" class="history-list">
        <template v-if="transactions.length">
          <div class="history-item" v-for="item in transactions" :key="item.id">
            <div class="hi-left">
              <div class="hi-icon" :class="isIncome(item) ? 'income' : 'expense'">
                <i :class="getTypeIcon(item)"></i>
              </div>
              <div class="hi-info">
                <div class="hi-title">{{ item.type_label || getTypeLabel(item) }}</div>
                <div class="hi-desc">{{ item.description || '-' }}</div>
                <div class="hi-time">{{ formatTime(item.created_at) }}</div>
              </div>
            </div>
            <div class="hi-amount" :class="isIncome(item) ? 'income' : 'expense'">
              {{ isIncome(item) ? '+' : '-' }}¥{{ formatMoney(Math.abs(item.amount)) }}
            </div>
          </div>
        </template>

        <div v-else-if="!loading" class="empty-state">
          <div class="empty-icon"><i class="fas fa-wallet"></i></div>
          <div class="empty-text">暂无交易记录</div>
          <div class="empty-hint">充值或消费后交易记录将在此显示</div>
        </div>
      </div>

      <div v-if="total > pageSize" class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          small
          @current-change="loadTransactions"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const isMobile = ref(window.innerWidth < 768)
const historyRef = ref(null)
const isWechat = /MicroMessenger/i.test(navigator.userAgent)
const wechatOpenid = ref(localStorage.getItem('wx_jsapi_openid') || '')

function handleResize() { isMobile.value = window.innerWidth < 768 }

const balanceInfo = reactive({ balance: '0.00', total_recharge: 0, total_spent: 0 })
const transactions = ref([])
const loading = ref(false)
const enabledMethods = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

function formatMoney(n) {
  const num = Number(n || 0)
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isIncome(item) {
  return item.type === 'income' || item.type === 'recharge' || Number(item.amount) > 0
}

function getTypeLabel(item) {
  const map = { income: '收入', expense: '支出', recharge: '充值', withdraw: '提现', payment: '支付', refund: '退款' }
  return map[item.type] || item.type || '交易'
}

function getTypeIcon(item) {
  if (isIncome(item)) return 'fas fa-arrow-down'
  return 'fas fa-arrow-up'
}

function scrollToHistory() {
  historyRef.value?.scrollIntoView({ behavior: 'smooth' })
}

async function loadPaymentMethods() {
  try {
    const res = await api.get('/api/payment/methods')
    const data = res.data?.data || res.data || {}
    enabledMethods.value = Array.isArray(data.methods) ? data.methods : []
    if (enabledMethods.value.length > 0) {
      if (enabledMethods.value.includes('wechat')) rechargePayMethod.value = 'wechat'
      else if (enabledMethods.value.includes('yipay')) rechargePayMethod.value = 'yipay_alipay'
    }
  } catch { /* ignore */ }
}

async function loadBalance() {
  try {
    const res = await api.get('/user/balance')
    const data = res.data?.data || res.data || {}
    Object.assign(balanceInfo, data)
  } catch { /* ignore */ }
}

async function loadTransactions() {
  loading.value = true
  try {
    const res = await api.get('/user/balance/transactions', {
      params: { page: page.value, pageSize: pageSize.value },
    })
    const d = res.data?.data || res.data
    transactions.value = Array.isArray(d) ? d : []
    total.value = res.data?.pagination?.total || res.data?.total || 0
  } catch { /* ignore */ }
  loading.value = false
}

const showCardKeyDialog = ref(false)
const showRechargeDialog = ref(false)
const balanceCardCode = ref('')
const redeemingCard = ref(false)
const rechargeAmount = ref(100)
const rechargePayMethod = ref('wechat')
const recharging = ref(false)
const rechargeError = ref('')
const wechatCodeUrl = ref('')
const wechatQrCodeDataUrl = ref('')

function resetRechargeForm() {
  rechargeAmount.value = 100
  rechargeError.value = ''
  if (enabledMethods.value.includes('wechat')) rechargePayMethod.value = 'wechat'
  else if (enabledMethods.value.includes('yipay')) rechargePayMethod.value = 'yipay_alipay'
}

async function redeemBalanceCard() {
  if (!balanceCardCode.value.trim()) return
  redeemingCard.value = true
  try {
    const res = await api.post('/user/feature-modules/redeem-balance', { card_code: balanceCardCode.value.trim() })
    ElMessage.success(res.data?.message || '充值成功')
    showCardKeyDialog.value = false
    balanceCardCode.value = ''
    loadBalance()
    loadTransactions()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '兑换失败')
  }
  redeemingCard.value = false
}

const showPayWaiting = ref(false)
const pendingOrderNo = ref(null)
const checkingPay = ref(false)
let pollTimer = null

async function ensureWechatOpenid() {
  if (wechatOpenid.value) return true
  try {
    const savedRes = await api.get('/api/payment/wechat/saved-openid')
    const savedData = savedRes.data?.openid ? savedRes.data : (savedRes.data?.data || savedRes.data || {})
    if (savedData.openid) {
      wechatOpenid.value = savedData.openid
      localStorage.setItem('wx_jsapi_openid', savedData.openid)
      return true
    }
  } catch { /* ignore */ }
  try {
    const res = await api.get('/api/payment/wechat/jsapi-auth-url', {
      params: { redirect_uri: window.location.href }
    })
    const d = res.data?.auth_url ? res.data : (res.data?.data || res.data || {})
    const authUrl = d.auth_url
    if (authUrl) {
      localStorage.setItem('wx_pending_recharge', JSON.stringify({
        amount: rechargeAmount.value,
        method: rechargePayMethod.value,
      }))
      window.location.href = authUrl
      return false
    }
  } catch (e) {
    ElMessage.error('获取微信授权失败')
  }
  return false
}

function invokeWechatJsapiPay(params, orderNo) {
  showRechargeDialog.value = false
  pendingOrderNo.value = orderNo
  showPayWaiting.value = true
  checkingPay.value = true

  function onBridgeReady() {
    WeixinJSBridge.invoke('getBrandWCPayRequest', {
      appId: params.appId,
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
    }, function(payRes) {
      if (payRes.err_msg === 'get_brand_wcpay_request:ok') {
        onRechargeSuccess()
      } else if (payRes.err_msg === 'get_brand_wcpay_request:cancel') {
        ElMessage.info('支付已取消')
        checkingPay.value = false
      } else {
        ElMessage.error('支付失败，请重试')
        startAutoCheck(orderNo)
      }
    })
  }
  if (typeof WeixinJSBridge === 'undefined') {
    document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false)
  } else {
    onBridgeReady()
  }
}

async function doRecharge() {
  const amt = Number(rechargeAmount.value)
  if (!amt || amt < 1) {
    ElMessage.warning('请输入有效充值金额')
    return
  }
  rechargeError.value = ''
  recharging.value = true
  wechatCodeUrl.value = ''
  wechatQrCodeDataUrl.value = ''

  const isWechatOfficial = rechargePayMethod.value === 'wechat'
  const payType = rechargePayMethod.value === 'yipay_alipay' ? 'alipay' : 'wxpay'
  const payMethod = isWechatOfficial ? 'wechat' : 'yipay'

  try {
    if (isWechatOfficial && isWechat) {
      if (!await ensureWechatOpenid()) { recharging.value = false; return }
      const res = await api.post('/user/balance/recharge', {
        amount: amt,
        payment_method: 'wechat',
        trade_type: 'JSAPI',
        openid: wechatOpenid.value,
      })
      const data = res.data?.order_no ? res.data : (res.data?.data || res.data || {})
      if (data?.order_no && data?.jsapi_params) {
        invokeWechatJsapiPay(data.jsapi_params, data.order_no)
      } else {
        rechargeError.value = '创建JSAPI支付订单失败'
        ElMessage.error('创建支付订单失败，请重试')
      }
      recharging.value = false
      return
    }

    const res = await api.post('/user/balance/recharge', {
      amount: amt,
      payment_method: payMethod,
      pay_type: payType,
    })
    const data = res.data?.data || res.data
    if (data?.order_no) {
      showRechargeDialog.value = false
      pendingOrderNo.value = data.order_no
      showPayWaiting.value = true

      if (isWechatOfficial && data.code_url) {
        wechatCodeUrl.value = data.code_url
        generateQrCode(data.code_url)
      } else if (!isWechatOfficial) {
        const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/api\/?$/, '')
        const redirectUrl = `${baseUrl}/api/payment/redirect/${data.order_no}?type=${encodeURIComponent(payType)}`
        if (isWechat) {
          window.location.href = redirectUrl
        } else {
          window.open(redirectUrl, '_blank')
        }
      }
      startAutoCheck(data.order_no)
    } else {
      rechargeError.value = '订单创建失败，请稍后重试'
    }
  } catch (e) {
    const msg = e.response?.data?.message || '创建订单失败，请稍后重试'
    rechargeError.value = msg
    ElMessage.error(msg)
  }
  recharging.value = false
}

async function generateQrCode(text) {
  try {
    const qrModule = await import('qrcode')
    const QRCode = qrModule.default || qrModule
    wechatQrCodeDataUrl.value = await QRCode.toDataURL(text, { width: 200, margin: 2 })
  } catch {
    wechatQrCodeDataUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  }
}

function startAutoCheck(orderNo) {
  stopAutoCheck()
  checkingPay.value = true
  let count = 0
  pollTimer = setInterval(async () => {
    count++
    if (count > 180) { stopAutoCheck(); return }
    try {
      const r = await api.get('/api/payment/check-status', { params: { out_trade_no: orderNo, _t: Date.now() } })
      const d = r.data?.data || r.data
      if (d?.paid || d?.status === 'paid') {
        onRechargeSuccess()
      }
    } catch {}
  }, 5000)
}

function stopAutoCheck() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  checkingPay.value = false
}

function onRechargeSuccess() {
  stopAutoCheck()
  pendingOrderNo.value = null
  showPayWaiting.value = false
  ElMessage.success('充值成功！余额已到账')
  loadBalance()
  loadTransactions()
}

async function manualCheckRecharge() {
  if (!pendingOrderNo.value) return
  recharging.value = true
  try {
    const r = await api.get('/api/payment/check-status', { params: { out_trade_no: pendingOrderNo.value, _t: Date.now() } })
    const d = r.data?.data || r.data
    if (d?.paid || d?.status === 'paid') {
      onRechargeSuccess()
    } else {
      ElMessage.warning('支付处理中，请稍等片刻后再点击此按钮')
    }
  } catch {
    ElMessage.warning('查询失败，请稍后再试')
  }
  recharging.value = false
}

function closePayWaiting() {
  stopAutoCheck()
  pendingOrderNo.value = null
  showPayWaiting.value = false
  wechatCodeUrl.value = ''
  wechatQrCodeDataUrl.value = ''
  loadBalance()
  loadTransactions()
}

async function handleWechatOAuthCallback() {
  if (!isWechat) return
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const state = urlParams.get('state')
  if (code && state === 'jsapi_pay') {
    try {
      const res = await api.get('/api/payment/wechat/jsapi-openid', { params: { code } })
      const d = res.data?.openid ? res.data : (res.data?.data || res.data || {})
      const openid = d.openid
      if (openid) {
        wechatOpenid.value = openid
        localStorage.setItem('wx_jsapi_openid', openid)
      }
    } catch { /* ignore */ }
    const url = new URL(window.location.href)
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    window.history.replaceState({}, '', url.toString())
    const pending = localStorage.getItem('wx_pending_recharge')
    if (pending) {
      localStorage.removeItem('wx_pending_recharge')
      try {
        const info = JSON.parse(pending)
        if (info.amount) rechargeAmount.value = info.amount
        if (info.method) rechargePayMethod.value = info.method
        await loadPaymentMethods()
        showRechargeDialog.value = true
      } catch { /* ignore */ }
    }
  }
}

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  await handleWechatOAuthCallback()
  loadPaymentMethods()
  loadBalance()
  loadTransactions()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopAutoCheck()
})
</script>

<style scoped>
/* 页面容器 */
.balance-page { max-width: 800px; margin: 0; padding: 20px; }
.balance-page.is-mobile { padding: 0; margin: -24px; background: #f5f6fa; min-height: 100vh; }

/* 移动端头部 */
.m-page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #fff; border-bottom: 1px solid #f0f0f0;
  position: sticky; top: 0; z-index: 10;
}
.m-back-btn { color: #333; font-size: 16px; text-decoration: none; width: 32px; }
.m-page-title { font-size: 16px; font-weight: 600; color: #333; }

/* 余额总览 Hero 卡片 */
.balance-hero {
  position: relative; overflow: hidden; border-radius: 16px;
  background: linear-gradient(135deg, #27AE60, #2ECC71, #1ABC9C);
  color: #fff; padding: 28px 24px; margin-bottom: 16px;
}
.is-mobile .balance-hero { border-radius: 0; margin-bottom: 0; }
.hero-bg { position: absolute; inset: 0; pointer-events: none; }
.hero-circle {
  position: absolute; border-radius: 50%; opacity: 0.1;
  background: #fff;
}
.hero-circle.c1 { width: 180px; height: 180px; top: -50px; right: -40px; }
.hero-circle.c2 { width: 110px; height: 110px; bottom: -30px; right: 50px; }
.hero-content { position: relative; z-index: 1; }
.hero-label { font-size: 13px; opacity: 0.9; margin-bottom: 6px; }
.hero-label i { margin-right: 4px; }
.hero-amount { font-size: 40px; font-weight: 800; letter-spacing: -1px; line-height: 1.1; margin-bottom: 8px; }
.hero-currency { font-size: 22px; font-weight: 600; margin-right: 2px; vertical-align: top; line-height: 1.8; }
.hero-sub { font-size: 12px; opacity: 0.75; }

/* 快捷操作 */
.action-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  background: #fff; border-radius: 12px; padding: 16px 12px; margin-bottom: 16px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}
.is-mobile .action-row { border-radius: 0; margin-bottom: 8px; box-shadow: none; border-bottom: 8px solid #f5f6fa; }
.action-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  cursor: pointer; transition: transform 0.2s;
}
.action-item:active { transform: scale(0.95); }
.action-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 16px; box-shadow: 0 3px 10px rgba(0,0,0,0.12);
}
.action-item span { font-size: 11px; color: #666; font-weight: 500; }

/* 交易明细区域 */
.history-section {
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}
.is-mobile .history-section { border-radius: 0; padding: 12px 14px; box-shadow: none; }
.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0;
}
.section-title { font-size: 15px; font-weight: 600; color: #333; }
.section-title i { margin-right: 6px; color: #27AE60; }
.section-total { font-size: 12px; color: #999; }

/* 列表项 */
.history-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; border-bottom: 1px solid #f8f8f8;
  transition: background 0.15s;
}
.history-item:last-child { border-bottom: none; }
.history-item:hover { background: #fafafa; }
.hi-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.hi-icon {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; flex-shrink: 0;
}
.hi-icon.income { background: #e8f5e9; color: #4CAF50; }
.hi-icon.expense { background: #fce4ec; color: #e91e63; }
.hi-info { flex: 1; min-width: 0; }
.hi-title { font-size: 13px; font-weight: 600; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hi-desc { font-size: 11px; color: #999; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hi-time { font-size: 10px; color: #bbb; margin-top: 2px; }
.hi-amount {
  font-size: 16px; font-weight: 700; flex-shrink: 0; margin-left: 12px; white-space: nowrap;
}
.hi-amount.income { color: #4CAF50; }
.hi-amount.expense { color: #e91e63; }

/* 空状态 */
.empty-state { text-align: center; padding: 40px 20px; }
.empty-icon { font-size: 48px; color: #ddd; margin-bottom: 12px; }
.empty-text { font-size: 14px; color: #999; margin-bottom: 4px; }
.empty-hint { font-size: 12px; color: #ccc; }

/* 分页 */
.pagination-wrap { display: flex; justify-content: center; padding: 16px 0 4px; }

/* 充值弹窗 */
.recharge-hint { color: #666; font-size: 13px; margin-bottom: 16px; }
.amount-options { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.amount-opt {
  padding: 8px 16px; border: 1px solid #e0e0e0; border-radius: 8px;
  cursor: pointer; font-weight: 600; color: #333; transition: all 0.2s;
}
.amount-opt:hover { border-color: #27AE60; color: #27AE60; }
.amount-opt.active { border-color: #27AE60; background: #e8f5e9; color: #27AE60; }
.amount-input { width: 120px; }
.recharge-error { color: #e74c3c; font-size: 13px; margin: 0; }
</style>
