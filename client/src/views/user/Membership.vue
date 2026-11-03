<template>
  <section class="billing" v-loading="loading">
    <header class="page-head">
      <div><h2>套餐与用量</h2><p>查看当前周期额度、实际消耗和订阅权益。</p></div>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </header>

    <div id="membership-current" class="current">
      <div><span class="eyebrow">当前套餐</span><h3>{{ data.subscription?.plan_name || 'Free 免费版' }}</h3><p>{{ data.organization?.name || '我的工作区' }}</p></div>
      <div class="period"><span>订阅状态</span><el-tag :type="data.subscription ? 'success' : 'info'">{{ data.subscription ? (statusText[data.subscription.status] || data.subscription.status) : '免费使用' }}</el-tag></div>
      <div class="period"><span>用量重置日</span><strong>{{ date(data.usage_period?.reset_at) }}</strong></div>
      <div class="period"><span>扫描频率</span><strong>{{ scanFrequency(data.subscription?.entitlements?.scan_interval_hours || 168) }}</strong></div>
    </div>

    <div class="usage-grid">
      <article v-for="item in data.usage || []" :key="item.metric">
        <div class="usage-title"><span>{{ item.label }}</span><strong>{{ item.used.toLocaleString() }} / {{ item.limit == null ? '不限' : item.limit.toLocaleString() }} {{ item.unit }}</strong></div>
        <el-progress :percentage="percent(item)" :stroke-width="7" :show-text="false" :status="percent(item) >= 90 ? 'exception' : ''" />
        <small>剩余 {{ item.remaining == null ? '不限' : item.remaining.toLocaleString() + ' ' + item.unit }}</small>
      </article>
    </div>

    <div id="membership-plans" class="section-head"><div><h3>套餐方案</h3><p>年付价格按文档建议约为 10 个月月费。</p></div><el-radio-group v-model="billing" size="small"><el-radio-button value="monthly">月付</el-radio-button><el-radio-button value="annual">年付</el-radio-button></el-radio-group></div>
    <div class="plans">
      <article v-for="plan in data.plans || []" :key="plan.id" :class="{ active: plan.code === data.subscription?.plan_code }">
        <div class="plan-top"><div><span>{{ plan.code.toUpperCase() }}</span><h3>{{ plan.name }}</h3></div><el-tag v-if="plan.code === data.subscription?.plan_code" type="success">当前套餐</el-tag></div>
        <div class="price"><b>{{ selectedPrice(plan) > 0 ? `¥${selectedPrice(plan).toLocaleString()}` : '暂未定价' }}</b><span v-if="selectedPrice(plan) > 0">/{{ billing === 'annual' ? '年' : '月' }}</span></div>
        <p class="annual">{{ billing === 'annual' && selectedPrice(plan) > 0 ? `折合 ¥${Math.round(selectedPrice(plan) / 12).toLocaleString()} / 月` : Number(plan.annual_price) > 0 ? `年付 ¥${Number(plan.annual_price).toLocaleString()}` : '该计费周期暂不可购买' }}</p>
        <ul>
          <li>{{ plan.entitlements.sites }} 个站点 · {{ plan.entitlements.members }} 名成员</li>
          <li>每月 {{ Number(plan.entitlements.crawl_pages_monthly).toLocaleString() }} 抓取页</li>
          <li>单次最多 {{ Number(plan.entitlements.pages_per_scan).toLocaleString() }} 页</li>
          <li>每月 {{ Number(plan.entitlements.ai_points_monthly).toLocaleString() }} AI 算力</li>
          <li>{{ scanFrequency(plan.entitlements.scan_interval_hours) }} · {{ plan.entitlements.history_days }} 天历史</li>
        </ul>
        <el-button v-if="plan.code !== data.subscription?.plan_code" type="primary" :disabled="!canPurchase(plan)" :title="purchaseHint(plan)" @click="createOrder(plan)">{{ purchaseLabel(plan) }}</el-button>
      </article>
    </div>

    <div id="membership-usage" class="section-head ledger-head"><div><h3>用量流水</h3><p>仅成功结算的真实抓取、AI、导出和 API 用量会记录在此。</p></div>
      <el-select v-model="metric" clearable placeholder="全部类型" style="width:150px" @change="changeMetric"><el-option label="抓取页面" value="crawl_page"/><el-option label="AI 算力" value="ai_point"/><el-option label="报告导出" value="export"/><el-option label="API 调用" value="api_call"/></el-select>
    </div>
    <el-table :data="ledgers" stripe empty-text="本周期暂无用量记录">
      <el-table-column prop="metric_label" label="用量类型" min-width="120"/>
      <el-table-column label="数量" width="120"><template #default="{row}">{{ row.quantity.toLocaleString() }} {{ row.unit }}</template></el-table-column>
      <el-table-column prop="reference_type" label="来源" min-width="120"><template #default="{row}">{{ sourceText[row.reference_type] || row.reference_type || '-' }}</template></el-table-column>
      <el-table-column prop="reference_id" label="关联编号" width="110"/>
      <el-table-column label="结算时间" min-width="170"><template #default="{row}">{{ datetime(row.created_at) }}</template></el-table-column>
    </el-table>
    <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="loadLedgers" />
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const loading=ref(false),data=ref({}),ledgers=ref([]),metric=ref(''),page=ref(1),total=ref(0),pageSize=20
const router=useRouter(),route=useRoute()
const billing=ref('monthly')
const canManageBilling=computed(()=>['owner','admin'].includes(data.value.organization?.role))
const selectedPrice=plan=>Number(billing.value==='annual'?plan.annual_price:plan.monthly_price)||0
const canPurchase=plan=>canManageBilling.value&&selectedPrice(plan)>0
const purchaseLabel=plan=>!canManageBilling.value?'仅管理员可购买':selectedPrice(plan)>0?'创建升级订单':plan.code==='free'?'免费套餐':'暂不可购买'
const purchaseHint=plan=>!canManageBilling.value?'仅组织所有者或管理员可购买套餐':selectedPrice(plan)<=0?'当前计费周期未配置价格':''
const statusText={active:'生效中',trialing:'试用中',past_due:'付款逾期',cancelled:'已取消',expired:'已到期'}
const sourceText={scan:'站点扫描',ai:'AI 操作',report:'报告导出',api:'API 调用'}
const date=v=>v?new Date(v).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}):'-'
const datetime=v=>v?new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'-'
const percent=item=>item.limit?Math.min(100,Math.round(item.used/item.limit*100)):0
const scanFrequency=h=>!Number(h)?'按需扫描':Number(h)>=24?`${Number(h)/24} 天一次`:`每 ${h} 小时`
async function loadLedgers(){const r=await api.get('/user/membership/usage-ledgers',{params:{page:page.value,pageSize,metric:metric.value||undefined}});ledgers.value=r.data.data||[];total.value=r.data.total||0}
async function load(){loading.value=true;try{const [overview]=await Promise.all([api.get('/user/membership'),loadLedgers()]);data.value=overview.data||{}}finally{loading.value=false}}
function changeMetric(){page.value=1;loadLedgers()}
async function applySection(section=route.query.section){
  if(section==='ai'&&metric.value!=='ai_point'){metric.value='ai_point';page.value=1;await loadLedgers()}
  await nextTick()
  document.getElementById(section==='ai'?'membership-usage':'membership-plans')?.scrollIntoView({behavior:'smooth',block:'start'})
}
async function createOrder(plan){try{const r=await api.post('/user/membership/plan-orders',{plan_code:plan.code,billing:billing.value});const orderNo=r.data?.order_no||r.data?.data?.order_no;ElMessage.success(r.message||'订单已创建');await router.push({path:'/user/orders',query:orderNo?{order:orderNo}:{}})}catch(e){ElMessage.error(e?.response?.data?.message||'创建订单失败')}}
onMounted(async()=>{await load();await applySection()})
watch(()=>route.query.section,section=>applySection(section))
</script>

<style scoped>
.billing{max-width:1200px;margin:auto}.page-head,.section-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px}.page-head h2,.section-head h3{margin:0 0 5px}.page-head p,.section-head p,.current p{margin:0;color:#667085;font-size:13px}.current{display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:20px;background:#fff;border:1px solid #e4e8ee;border-radius:7px;padding:20px;margin-bottom:14px}.eyebrow,.period span,.plan-top span{display:block;color:#667085;font-size:11px}.current h3{font-size:22px;margin:5px 0}.period{border-left:1px solid #eaecf0;padding-left:20px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:8px}.usage-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}.usage-grid article{background:#fff;border:1px solid #e4e8ee;border-radius:7px;padding:15px}.usage-title{display:flex;justify-content:space-between;gap:10px;font-size:12px;margin-bottom:12px}.usage-title strong{font-size:12px}.usage-grid small{display:block;color:#667085;margin-top:9px}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:30px}.plans article{background:#fff;border:1px solid #e4e8ee;border-radius:7px;padding:19px}.plans article.active{border-color:#1677ff;box-shadow:0 0 0 1px #1677ff}.plan-top{display:flex;justify-content:space-between}.plan-top h3{font-size:17px;margin:4px 0}.price{margin-top:20px}.price b{font-size:27px}.price span,.annual{color:#667085;font-size:12px}.plans ul{padding:0;list-style:none;border-top:1px solid #eaecf0;margin:16px 0}.plans li{font-size:12px;padding-top:10px}.ledger-head{margin-top:4px}.el-pagination{justify-content:flex-end;margin-top:14px}@media(max-width:800px){.current{grid-template-columns:1fr 1fr}.period{border-left:0;padding-left:0}.usage-grid,.plans{grid-template-columns:1fr}.ledger-head{gap:10px}.page-head p{display:none}}@media(max-width:480px){.current{grid-template-columns:1fr}.page-head,.ledger-head{align-items:center}.section-head p{display:none}}
</style>
