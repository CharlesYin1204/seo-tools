<template>
  <div>
    <div class="page-header"><h3 class="page-title">支付配置</h3><p class="text-muted">配置支付渠道，用于会员功能购买和余额充值</p></div>

    <el-card v-loading="loading">
      <el-form :model="config" label-width="130px">
        <!-- 启用的支付方式 -->
        <el-form-item label="启用支付方式">
          <el-checkbox-group v-model="config.methods">
            <el-checkbox label="wechat"><i class="fab fa-weixin text-success me-1"></i>微信官方支付</el-checkbox>
            <el-checkbox label="alipay"><i class="fab fa-alipay text-primary me-1"></i>支付宝</el-checkbox>
            <el-checkbox label="yipay"><i class="fas fa-bolt text-warning me-1"></i>易支付（聚合支付宝/微信）</el-checkbox>
            <el-checkbox label="paypal"><i class="fab fa-paypal me-1"></i>PayPal</el-checkbox>
            <el-checkbox label="stripe"><i class="fab fa-stripe me-1"></i>Stripe</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <!-- 微信官方支付 -->
        <el-divider><i class="fab fa-weixin"></i> 微信官方支付配置</el-divider>
        <el-alert type="info" :closable="false" class="mb-3">
          <template #title>微信支付需要申请微信商户号，配置JSAPI/Native支付能力。</template>
        </el-alert>
        <el-form-item label="商户号(mch_id)">
          <el-input v-model="config.wechat_mch_id" placeholder="微信商户号" />
        </el-form-item>
        <el-form-item label="API密钥(key)">
          <el-input v-model="config.wechat_api_key" placeholder="商户API密钥" type="password" show-password />
        </el-form-item>
        <el-form-item label="AppID">
          <el-input v-model="config.wechat_app_id" placeholder="公众号/小程序AppID" />
        </el-form-item>
        <el-form-item label="AppSecret">
          <el-input v-model="config.wechat_app_secret" placeholder="公众号/小程序AppSecret" type="password" show-password />
        </el-form-item>
        <el-form-item label="回调地址(自动)">
          <el-input :model-value="autoWechatNotifyUrl" disabled />
          <div style="font-size:12px;color:#909399;margin-top:4px;">系统根据APP_URL自动生成，无需手动配置</div>
        </el-form-item>

        <!-- 易支付配置 -->
        <el-divider><i class="fas fa-bolt"></i> 易支付配置</el-divider>
        <el-alert type="info" :closable="false" class="mb-3">
          <template #title>易支付接口文档：<a href="https://epay.epays123.com/doc.html" target="_blank">https://epay.epays123.com/doc.html</a></template>
        </el-alert>
        <el-form-item label="商户ID(pid)">
          <el-input v-model="config.yipay_pid" placeholder="易支付商户ID" />
        </el-form-item>
        <el-form-item label="商户密钥(key)">
          <el-input v-model="config.yipay_key" placeholder="易支付商户密钥" type="password" show-password />
        </el-form-item>
        <el-form-item label="接口地址">
          <el-input v-model="config.yipay_url" placeholder="如 https://epay.iyunxuan.com" />
        </el-form-item>
        <el-form-item label="回调地址(自动)">
          <el-input :model-value="autoNotifyUrl" disabled />
          <div style="font-size:12px;color:#909399;margin-top:4px;">系统根据APP_URL自动生成，无需手动配置</div>
        </el-form-item>
        <el-form-item label="返回地址(自动)">
          <el-input :model-value="autoReturnUrl" disabled />
          <div style="font-size:12px;color:#909399;margin-top:4px;">支付完成后跳转地址，系统自动生成</div>
        </el-form-item>

        <!-- 支付宝官方配置 -->
        <el-divider><i class="fab fa-alipay text-primary"></i> 支付宝官方配置</el-divider>
        <el-alert type="info" :closable="false" class="mb-3">
          <template #title>支付宝需申请开放平台应用，配置电脑网站支付或手机网站支付。也可通过易支付使用支付宝。</template>
        </el-alert>
        <el-form-item label="应用ID(app_id)">
          <el-input v-model="config.alipay_app_id" placeholder="支付宝应用ID" />
        </el-form-item>
        <el-form-item label="应用私钥">
          <el-input v-model="config.alipay_private_key" placeholder="应用私钥" type="password" show-password />
        </el-form-item>
        <el-form-item label="支付宝公钥">
          <el-input v-model="config.alipay_public_key" placeholder="支付宝公钥" type="textarea" :rows="2" />
        </el-form-item>

        <!-- PayPal 配置 -->
        <el-divider><i class="fab fa-paypal"></i> PayPal 配置</el-divider>
        <el-alert type="info" :closable="false" class="mb-3">
          <template #title>PayPal 适用于国际用户支付，需在 PayPal Developer 创建应用获取 Client ID 和 Secret。</template>
        </el-alert>
        <el-form-item label="Client ID">
          <el-input v-model="config.paypal_client_id" placeholder="PayPal Client ID" />
        </el-form-item>
        <el-form-item label="Client Secret">
          <el-input v-model="config.paypal_client_secret" placeholder="PayPal Client Secret" type="password" show-password />
        </el-form-item>
        <el-form-item label="环境">
          <el-radio-group v-model="config.paypal_sandbox">
            <el-radio :label="true">沙箱测试</el-radio>
            <el-radio :label="false">正式环境</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- Stripe 配置 -->
        <el-divider><i class="fab fa-stripe"></i> Stripe 配置</el-divider>
        <el-alert type="info" :closable="false" class="mb-3">
          <template #title>Stripe 支持信用卡等国际支付方式，需在 Stripe Dashboard 获取 API 密钥。</template>
        </el-alert>
        <el-form-item label="Publishable Key">
          <el-input v-model="config.stripe_publishable_key" placeholder="pk_xxx" />
        </el-form-item>
        <el-form-item label="Secret Key">
          <el-input v-model="config.stripe_secret_key" placeholder="sk_xxx" type="password" show-password />
        </el-form-item>
        <el-form-item label="Webhook 密钥">
          <el-input v-model="config.stripe_webhook_secret" placeholder="whsec_xxx（可选）" type="password" show-password />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveConfig"><i class="fas fa-save me-1"></i>保存配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 订单记录 -->
    <el-card class="mt-4">
      <template #header><span>最近订单</span></template>
      <el-table :data="orders" size="small" border v-loading="ordersLoading">
        <el-table-column prop="order_id" label="订单号" width="180" />
        <el-table-column prop="title" label="描述" />
        <el-table-column prop="amount" label="金额" width="100"><template #default="{row}">¥{{ row.amount }}</template></el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="{paid:'success',pending:'warning',cancelled:'info',refunded:'danger'}[row.status]" size="small">
              {{ {paid:'已支付',pending:'待支付',cancelled:'已取消',refunded:'已退款'}[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="payment_method" label="支付方式" width="90" />
        <el-table-column prop="created_at" label="创建时间" width="160" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const config = ref({ methods: [] })
const appUrl = computed(() => (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/api\/?$/, '').replace(/\/$/, ''))
const autoNotifyUrl = computed(() => `${appUrl.value}/api/payment/notify/yipay`)
const autoReturnUrl = computed(() => `${appUrl.value}/api/payment/return/yipay`)
const autoWechatNotifyUrl = computed(() => `${appUrl.value}/api/payment/notify/wechat`)
const loading = ref(false)
const saving = ref(false)
const orders = ref([])
const ordersLoading = ref(false)

onMounted(() => { loadConfig(); loadOrders() })

async function loadConfig() {
  loading.value = true
  try {
    const res = await api.get('/admin/payment-config')
    const data = res.data?.data || res.data || {}
    if (!data.methods) data.methods = []
    if (typeof data.methods === 'string') {
      try { data.methods = JSON.parse(data.methods) } catch { data.methods = [] }
    }
    if (data.paypal_sandbox === 'false' || data.paypal_sandbox === false) data.paypal_sandbox = false
    else data.paypal_sandbox = true
    config.value = { ...data, paypal_sandbox: data.paypal_sandbox }
  } catch {}
  loading.value = false
}

async function saveConfig() {
  saving.value = true
  try {
    const payload = { ...config.value }
    delete payload.yipay_notify_url
    delete payload.yipay_return_url
    delete payload.wechat_notify_url
    if (typeof payload.paypal_sandbox === 'boolean') payload.paypal_sandbox = payload.paypal_sandbox ? 'true' : 'false'
    await api.post('/admin/payment-config', payload)
    ElMessage.success('支付配置保存成功')
  } catch { ElMessage.error('保存失败') }
  saving.value = false
}

async function loadOrders() {
  ordersLoading.value = true
  try {
    const res = await api.get('/admin/orders', { params: { pageSize: 20 } })
    const data = res.data?.data || res.data
    orders.value = Array.isArray(data) ? data : (data?.list || [])
  } catch {}
  ordersLoading.value = false
}
</script>
