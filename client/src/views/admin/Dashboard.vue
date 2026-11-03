<template>
  <div v-loading="loading" class="dashboard">
    <div class="page-head">
      <div><small>COMMERCIAL OPERATIONS</small><h2>SEO AI 运营仪表盘</h2><p>客户增长、站点健康、AI 用量与商业化状态</p></div>
      <span><i class="fas fa-clock" /> {{ now }}</span>
    </div>

    <div class="metrics">
      <router-link v-for="item in metrics" :key="item.label" :to="item.to">
        <div class="metric-head"><span>{{ item.label }}</span><i :class="item.icon" /></div>
        <strong>{{ item.prefix }}{{ format(item.value) }}</strong>
        <small>{{ item.note }}</small>
      </router-link>
    </div>

    <nav class="quick-nav" aria-label="常用运营入口">
      <router-link v-for="item in quickActions" :key="item.label" :to="item.to"><i :class="item.icon" /><span>{{ item.label }}</span><small>{{ item.note }}</small></router-link>
    </nav>

    <div class="main-grid">
      <section class="trend-panel">
        <div class="section-head"><div><h3>经营趋势</h3><p>最近 14 天真实业务数据</p></div><div class="segments"><button v-for="option in trendOptions" :key="option.key" :class="{active:trendMetric===option.key}" @click="trendMetric=option.key">{{ option.label }}</button></div></div>
        <div class="trend-summary"><strong>{{ trendOption.prefix }}{{ format(trendTotal) }}</strong><span>14 天累计 · 峰值 {{ trendOption.prefix }}{{ format(trendMax) }}</span></div>
        <div class="bars" role="img" :aria-label="`${trendOption.label}最近14天趋势`">
          <div v-for="point in activeTrend" :key="point.date" class="bar-item"><div class="bar-track"><i :style="{height:`${barHeight(point.value)}%`}" /></div><span>{{ shortDate(point.date) }}</span><b>{{ format(point.value) }}</b></div>
        </div>
      </section>

      <section class="todo-panel">
        <div class="section-head"><div><h3>运营待办</h3><p>按风险优先处理</p></div><b>{{ alertTotal }}</b></div>
        <router-link v-for="item in alerts" :key="item.label" :to="item.to" :class="{danger:item.value>0}"><i :class="item.icon" /><span>{{ item.label }}</span><strong>{{ format(item.value) }}</strong><em>处理</em></router-link>
      </section>
    </div>

    <div class="lower-grid">
      <section>
        <div class="section-head"><div><h3>站点健康排行</h3><p>优先展示严重问题较多的站点</p></div><router-link to="/admin/seo/sites">全部站点</router-link></div>
        <el-table :data="siteHealth" size="small" empty-text="暂无站点数据">
          <el-table-column label="站点" min-width="180"><template #default="{row}"><div class="site-name"><b>{{ row.name }}</b><small>{{ row.normalized_host }}</small></div></template></el-table-column>
          <el-table-column label="评分" width="80"><template #default="{row}"><b>{{ row.last_score ?? '--' }}</b></template></el-table-column>
          <el-table-column prop="open_issues" label="待处理" width="90" />
          <el-table-column label="严重" width="80"><template #default="{row}"><el-tag :type="Number(row.serious_issues)>0?'danger':'success'" size="small">{{ row.serious_issues }}</el-tag></template></el-table-column>
          <el-table-column label="最近扫描" width="150"><template #default="{row}">{{ date(row.last_scan_at) }}</template></el-table-column>
        </el-table>
      </section>
      <section>
        <div class="section-head"><div><h3>新增客户</h3><p>最近注册账号</p></div><router-link to="/admin/users">用户管理</router-link></div>
        <div class="users"><div v-for="user in recentUsers" :key="user.id"><i class="fas fa-user" /><span><b>{{ user.username }}</b><small>{{ user.email || '未填写邮箱' }}</small></span><time>{{ date(user.created_at) }}</time></div><el-empty v-if="!recentUsers.length" description="暂无客户" :image-size="44" /></div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/api'

const loading=ref(true),stats=ref({}),recentUsers=ref([]),siteHealth=ref([]),trends=ref({}),trendMetric=ref('scans')
const now=new Date().toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
const metrics=computed(()=>[
  {label:'注册客户',value:stats.value.users?.total,note:`今日新增 ${stats.value.users?.today_new||0}`,icon:'fas fa-users',to:'/admin/users'},
  {label:'活跃站点',value:stats.value.sites?.active,note:`累计接入 ${stats.value.sites?.total||0}`,icon:'fas fa-globe',to:'/admin/seo/sites'},
  {label:'本月扫描页面',value:stats.value.scans?.pages,note:`完成 ${stats.value.scans?.completed||0} 次扫描`,icon:'fas fa-chart-column',to:'/admin/seo/scans'},
  {label:'当前 MRR',value:stats.value.subscriptions?.mrr,prefix:'¥',note:`生效订阅 ${stats.value.subscriptions?.active||0}`,icon:'fas fa-credit-card',to:'/admin/orders'},
])
const quickActions=[
  {label:'站点管理',note:'接入与状态',icon:'fas fa-globe',to:'/admin/seo/sites'},
  {label:'扫描任务',note:'成功与失败',icon:'fas fa-rotate',to:'/admin/seo/scans'},
  {label:'问题审核',note:'处理 SEO 风险',icon:'fas fa-list-check',to:'/admin/seo/issues'},
  {label:'用量流水',note:'核对资源消耗',icon:'fas fa-chart-pie',to:'/admin/seo/usage'},
  {label:'套餐权益',note:'价格与配额',icon:'fas fa-layer-group',to:'/admin/seo/plans'},
  {label:'外链权威',note:'Ahrefs 数据源',icon:'fas fa-link',to:'/admin/seo/authority'},
]
const alerts=computed(()=>[
  {label:'严重 SEO 问题',value:stats.value.alerts?.critical_issues||0,icon:'fas fa-triangle-exclamation',to:'/admin/seo/issues'},
  {label:'扫描失败',value:stats.value.alerts?.failed_scans||0,icon:'fas fa-rotate',to:'/admin/seo/scans'},
  {label:'待审核接入',value:stats.value.alerts?.pending_connections||0,icon:'fas fa-plug',to:'/admin/seo/connectors'},
  {label:'逾期订阅',value:stats.value.alerts?.past_due||0,icon:'fas fa-credit-card',to:'/admin/orders'},
  {label:'待支付订单',value:stats.value.alerts?.pending_orders||0,icon:'fas fa-receipt',to:'/admin/orders'},
])
const alertTotal=computed(()=>alerts.value.reduce((sum,item)=>sum+Number(item.value||0),0))
const trendOptions=[{key:'scans',label:'扫描页面',field:'pages',prefix:''},{key:'registrations',label:'新增客户',field:'value',prefix:''},{key:'ai_points',label:'AI 点数',field:'value',prefix:''},{key:'revenue',label:'收入',field:'value',prefix:'¥'}]
const trendOption=computed(()=>trendOptions.find(item=>item.key===trendMetric.value)||trendOptions[0])
const activeTrend=computed(()=>fillDays(trends.value[trendMetric.value]||[],trendOption.value.field))
const trendTotal=computed(()=>activeTrend.value.reduce((sum,item)=>sum+item.value,0)),trendMax=computed(()=>Math.max(0,...activeTrend.value.map(item=>item.value)))
function fillDays(rows,field){const values=new Map(rows.map(row=>[String(row.date).slice(0,10),Number(row[field])||0]));return Array.from({length:14},(_,index)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(13-index));const key=d.toISOString().slice(0,10);return{date:key,value:values.get(key)||0}})}
const barHeight=value=>trendMax.value?Math.max(4,Math.round(Number(value)/trendMax.value*100)):0
const format=value=>(Number(value)||0).toLocaleString('zh-CN'),shortDate=value=>`${Number(value.slice(5,7))}/${Number(value.slice(8,10))}`,date=value=>value?new Date(value).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}):'未扫描'
onMounted(async()=>{try{const response=await api.get('/admin/dashboard'),data=response.data||response;stats.value=data.stats||{};recentUsers.value=data.recentUsers||[];siteHealth.value=data.siteHealth||[];trends.value=data.trends||{}}finally{loading.value=false}})
</script>

<style scoped>
.dashboard{max-width:1360px;margin:auto;color:#1d2939}.page-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}.page-head small{font-weight:700;color:#246bfd}.page-head h2{font-size:24px;margin:5px 0}.page-head p,.page-head>span{color:#667085;font-size:13px;margin:0}.metrics{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid #e4e8ee;border-radius:7px}.metrics>a{padding:18px 20px;text-decoration:none;color:inherit;border-right:1px solid #edf0f3}.metrics>a:last-child{border-right:0}.metric-head{display:flex;justify-content:space-between;color:#667085;font-size:13px}.metric-head i{color:#246bfd}.metrics strong{display:block;font-size:27px;margin:11px 0 5px}.metrics small{color:#667085}.quick-nav{display:grid;grid-template-columns:repeat(6,1fr);margin-top:14px;background:#fff;border:1px solid #e4e8ee;border-radius:7px;padding:10px}.quick-nav a{display:grid;grid-template-columns:34px 1fr;column-gap:9px;padding:10px;text-decoration:none;color:inherit;border-right:1px solid #edf0f3}.quick-nav a:last-child{border:0}.quick-nav i{grid-row:1/3;width:34px;height:34px;display:grid;place-items:center;background:#eef4ff;color:#246bfd;border-radius:5px}.quick-nav span{font-size:13px;font-weight:650}.quick-nav small{font-size:10px;color:#98a2b3;margin-top:3px}.main-grid,.lower-grid{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-top:14px}.main-grid>section,.lower-grid>section{background:#fff;border:1px solid #e4e8ee;border-radius:7px;padding:18px;min-width:0}.section-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.section-head h3{font-size:15px;margin:0}.section-head p{font-size:11px;color:#98a2b3;margin:3px 0 0}.section-head>a{font-size:12px;color:#246bfd;text-decoration:none}.segments{display:flex;border:1px solid #dce2ea;border-radius:5px;overflow:hidden}.segments button{border:0;border-right:1px solid #dce2ea;background:#fff;padding:6px 10px;font-size:11px;color:#667085}.segments button:last-child{border:0}.segments button.active{background:#246bfd;color:#fff}.trend-summary strong{font-size:24px}.trend-summary span{font-size:11px;color:#98a2b3;margin-left:8px}.bars{height:185px;display:grid;grid-template-columns:repeat(14,1fr);align-items:end;gap:8px;margin-top:12px}.bar-item{height:100%;display:grid;grid-template-rows:1fr 17px;position:relative}.bar-track{height:100%;display:flex;align-items:flex-end;background:#f3f5f8;border-radius:3px 3px 0 0;overflow:hidden}.bar-track i{width:100%;background:#246bfd;border-radius:3px 3px 0 0;min-height:0}.bar-item span{font-size:9px;color:#98a2b3;text-align:center;padding-top:4px}.bar-item b{display:none}.todo-panel>a{display:grid;grid-template-columns:28px 1fr auto 32px;gap:8px;align-items:center;padding:11px 0;border-bottom:1px solid #edf0f3;text-decoration:none;color:inherit;font-size:12px}.todo-panel>a i{color:#98a2b3}.todo-panel>a.danger i,.todo-panel>a.danger strong{color:#d92d20}.todo-panel>a em{font-style:normal;color:#246bfd}.site-name b,.site-name small{display:block}.site-name small,.users small{font-size:10px;color:#98a2b3;margin-top:3px}.users>div{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid #edf0f3}.users>div>i{width:30px;height:30px;display:grid;place-items:center;background:#eef4ff;color:#246bfd;border-radius:50%}.users span b,.users span small{display:block}.users time{font-size:10px;color:#98a2b3}@media(max-width:1050px){.metrics{grid-template-columns:repeat(2,1fr)}.metrics>a:nth-child(2){border-right:0}.quick-nav{grid-template-columns:repeat(3,1fr)}.main-grid,.lower-grid{grid-template-columns:1fr}}@media(max-width:700px){.metrics{grid-template-columns:1fr}.metrics>a{border-right:0;border-bottom:1px solid #edf0f3}.quick-nav{grid-template-columns:repeat(2,1fr)}.quick-nav a{border:0}.page-head>span{display:none}.segments{overflow-x:auto}.segments button{white-space:nowrap}.bars{gap:3px}.bar-item span{font-size:8px}}
</style>
