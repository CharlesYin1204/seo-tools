<template>
  <div class="workspace" v-loading="loading">
    <div class="welcome">
      <div><small>SEO WORKSPACE</small><h2>你好，{{ auth.displayName || '用户' }}</h2><p>从真实抓取到审核发布，掌握站点今天最需要处理的事项。</p></div>
      <router-link :to="nextStep.to" class="primary"><i :class="nextStep.icon" /> {{ nextStep.action }}</router-link>
    </div>

    <div class="metrics">
      <router-link v-for="item in metrics" :key="item.label" :to="item.to"><div><span>{{ item.label }}</span><i :class="item.icon" /></div><strong>{{ format(item.value) }}</strong><small>{{ item.note }}</small></router-link>
    </div>

    <nav class="quick-nav" aria-label="SEO 常用功能">
      <router-link v-for="item in quickActions" :key="item.label" :to="item.to"><i :class="item.icon" /><span>{{ item.label }}</span><small>{{ item.note }}</small></router-link>
    </nav>

    <div class="main-grid">
      <section class="trend-panel">
        <div class="section-head"><div><h3>抓取趋势</h3><p>最近 14 天真实扫描页面数</p></div><router-link to="/user/seo-sites">管理扫描</router-link></div>
        <div class="trend-summary"><strong>{{ format(scanTotal) }}</strong><span>累计抓取页面 · {{ format(scanJobs) }} 次任务</span></div>
        <div class="bars" role="img" aria-label="最近14天扫描页面趋势"><div v-for="point in scanTrend" :key="point.date" class="bar-item"><div class="bar-track"><i :style="{height:`${barHeight(point.pages)}%`}" /></div><span>{{ shortDate(point.date) }}</span></div></div>
      </section>

      <section class="next-panel">
        <div class="section-head"><div><h3>优化进度</h3><p>{{ completedCount === steps.length ? '完整闭环已完成' : `下一步：${nextStep.title}` }}</p></div><b>{{ completedCount }}/{{ steps.length }}</b></div>
        <el-progress :percentage="progress" :show-text="false" :stroke-width="6" />
        <router-link v-for="(step,index) in steps" :key="step.title" :to="step.to" :class="{done:step.done,current:index===currentStepIndex}"><em><i v-if="step.done" class="fas fa-check" /><span v-else>{{ index+1 }}</span></em><div><b>{{ step.title }}</b><small>{{ step.text }}</small></div><i class="fas fa-chevron-right" /></router-link>
      </section>
    </div>

    <div class="lower-grid">
      <section>
        <div class="section-head"><div><h3>站点健康</h3><p>按严重问题优先排序</p></div><router-link to="/user/seo-sites">全部站点</router-link></div>
        <el-table :data="siteHealth" size="small" empty-text="尚未添加站点">
          <el-table-column label="站点" min-width="180"><template #default="{row}"><div class="site-name"><b>{{ row.name }}</b><small>{{ row.normalized_host }}</small></div></template></el-table-column>
          <el-table-column label="评分" width="72"><template #default="{row}"><b>{{ row.last_score ?? '--' }}</b></template></el-table-column>
          <el-table-column prop="open_issues" label="问题" width="70" />
          <el-table-column label="风险" width="82"><template #default="{row}"><el-tag :type="Number(row.serious_issues)>0?'danger':'success'" size="small">{{ Number(row.serious_issues)>0 ? `${row.serious_issues} 严重` : '正常' }}</el-tag></template></el-table-column>
          <el-table-column label="GSC" width="80"><template #default="{row}"><span :class="['state',row.gsc_status==='active'?'ok':'']">{{ row.gsc_status==='active'?'已连接':'未连接' }}</span></template></el-table-column>
        </el-table>
      </section>
      <section class="issues-panel">
        <div class="section-head"><div><h3>优先处理</h3><p>最近扫描的高优先级证据</p></div><router-link to="/user/seo-sites">查看全部</router-link></div>
        <router-link v-for="issue in topIssues" :key="issue.id" to="/user/seo-sites"><el-tag :type="issue.severity==='critical'||issue.severity==='high'?'danger':'warning'" size="small">{{ severityName(issue.severity) }}</el-tag><span><b>{{ issue.title }}</b><small>{{ issue.site_name }} · {{ issue.evidence }}</small></span><i class="fas fa-chevron-right" /></router-link>
        <el-empty v-if="!topIssues.length" description="暂无待处理问题" :image-size="50" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/api'
import { useAuthStore } from '@/store/auth'

const auth=useAuthStore(),loading=ref(true),data=ref({})
const steps=computed(()=>[
  {title:'添加站点',text:'输入公网域名',to:'/user/seo-sites',action:'添加站点',icon:'fas fa-plus',done:Number(data.value.sites?.total)>0},
  {title:'验证所有权',text:'保护发布权限',to:'/user/seo-sites',action:'验证站点',icon:'fas fa-shield-alt',done:Number(data.value.sites?.verified)>0},
  {title:'首次扫描',text:'抓取真实页面',to:'/user/seo-sites',action:'开始扫描',icon:'fas fa-rotate',done:Number(data.value.scans?.completed)>0},
  {title:'审核候选',text:'确认 AI 优化',to:'/user/seo/changes',action:'审核候选',icon:'fas fa-list-check',done:Number(data.value.onboarding?.approved)>0},
  {title:'发布验证',text:'发布后重新检查',to:'/user/seo/publishing',action:'发布与检查',icon:'fas fa-cloud-arrow-up',done:Number(data.value.onboarding?.exported)>0},
])
const completedCount=computed(()=>steps.value.filter(item=>item.done).length),currentStepIndex=computed(()=>{const index=steps.value.findIndex(item=>!item.done);return index<0?steps.value.length-1:index}),nextStep=computed(()=>steps.value[currentStepIndex.value]),progress=computed(()=>Math.round(completedCount.value/steps.value.length*100))
const remainingAi=computed(()=>Math.max(0,Number(data.value.quota?.ai_points||0)-Number(data.value.usage?.ai_points||0)))
const metrics=computed(()=>[
  {label:'我的站点',value:data.value.sites?.total,note:`${data.value.sites?.verified||0} 个已验证`,icon:'fas fa-globe',to:'/user/seo-sites'},
  {label:'待处理问题',value:data.value.issues?.open,note:`${data.value.issues?.serious||0} 个高优先级`,icon:'fas fa-triangle-exclamation',to:'/user/seo-sites'},
  {label:'本月抓取',value:data.value.usage?.crawl_pages,note:`配额 ${format(data.value.quota?.crawl_pages)}`,icon:'fas fa-chart-column',to:'/user/seo-sites'},
  {label:'可用 AI 点数',value:remainingAi.value,note:`本月使用 ${format(data.value.usage?.ai_points)}`,icon:'fas fa-wand-magic-sparkles',to:'/user/membership'},
])
const quickActions=[
  {label:'站点与审计',note:'扫描真实页面',icon:'fas fa-globe',to:'/user/seo-sites'},
  {label:'内容优化',note:'页面内容简报',icon:'fas fa-file-lines',to:'/user/seo/content'},
  {label:'内链建议',note:'同站链接机会',icon:'fas fa-link',to:'/user/seo/internal-links'},
  {label:'结构化数据',note:'检查 JSON-LD',icon:'fas fa-code',to:'/user/seo/schema'},
  {label:'GEO 可发现性',note:'AI 引用准备度',icon:'fas fa-compass',to:'/user/seo/geo'},
  {label:'发布与检查',note:'复扫确认结果',icon:'fas fa-cloud-arrow-up',to:'/user/seo/publishing'},
]
const siteHealth=computed(()=>data.value.site_health||[]),topIssues=computed(()=>data.value.first_value?.top_issues||[])
const scanTrend=computed(()=>fillDays(data.value.trends?.scans||[])),scanTotal=computed(()=>scanTrend.value.reduce((sum,item)=>sum+item.pages,0)),scanJobs=computed(()=>scanTrend.value.reduce((sum,item)=>sum+item.jobs,0)),scanMax=computed(()=>Math.max(0,...scanTrend.value.map(item=>item.pages)))
function fillDays(rows){const values=new Map(rows.map(row=>[String(row.date).slice(0,10),row]));return Array.from({length:14},(_,index)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(13-index));const key=date.toISOString().slice(0,10),row=values.get(key)||{};return{date:key,pages:Number(row.pages)||0,jobs:Number(row.jobs)||0}})}
const barHeight=value=>scanMax.value?Math.max(4,Math.round(Number(value)/scanMax.value*100)):0
const format=value=>(Number(value)||0).toLocaleString('zh-CN'),shortDate=value=>`${Number(value.slice(5,7))}/${Number(value.slice(8,10))}`,severityName=value=>({critical:'严重',high:'高',medium:'中',low:'低'}[value]||value)
onMounted(async()=>{try{data.value=(await api.get('/user/seo/overview')).data||{}}finally{loading.value=false}})
</script>

<style scoped>
.workspace{max-width:1240px;margin:auto;color:#1d2939}.welcome{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.welcome small{color:#246bfd;font-weight:700}.welcome h2{font-size:24px;margin:5px 0}.welcome p{color:#667085;margin:0;font-size:13px}.primary{background:#246bfd;color:#fff;border-radius:5px;padding:10px 15px;text-decoration:none;font-size:13px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid #e4e8ee;border-radius:7px}.metrics>a{padding:18px 20px;border-right:1px solid #edf0f3;text-decoration:none;color:inherit}.metrics>a:last-child{border:0}.metrics>a>div{display:flex;justify-content:space-between;color:#667085;font-size:13px}.metrics>a i{color:#246bfd}.metrics strong{display:block;font-size:27px;margin:10px 0 5px}.metrics small{color:#667085}.quick-nav{display:grid;grid-template-columns:repeat(6,1fr);margin-top:14px;background:#fff;border:1px solid #e4e8ee;border-radius:7px;padding:10px}.quick-nav a{display:grid;grid-template-columns:34px 1fr;column-gap:9px;padding:10px;text-decoration:none;color:inherit;border-right:1px solid #edf0f3}.quick-nav a:last-child{border:0}.quick-nav i{grid-row:1/3;width:34px;height:34px;display:grid;place-items:center;background:#eef4ff;color:#246bfd;border-radius:5px}.quick-nav span{font-size:12px;font-weight:650}.quick-nav small{font-size:10px;color:#98a2b3;margin-top:3px}.main-grid,.lower-grid{display:grid;grid-template-columns:1.65fr 1fr;gap:14px;margin-top:14px}.main-grid>section,.lower-grid>section{background:#fff;border:1px solid #e4e8ee;border-radius:7px;padding:18px;min-width:0}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.section-head h3{font-size:15px;margin:0}.section-head p{font-size:11px;color:#98a2b3;margin:3px 0 0}.section-head>a{font-size:12px;color:#246bfd;text-decoration:none}.trend-summary strong{font-size:24px}.trend-summary span{font-size:11px;color:#98a2b3;margin-left:8px}.bars{height:190px;display:grid;grid-template-columns:repeat(14,1fr);align-items:end;gap:8px;margin-top:12px}.bar-item{height:100%;display:grid;grid-template-rows:1fr 17px}.bar-track{display:flex;align-items:flex-end;background:#f3f5f8;border-radius:3px 3px 0 0;overflow:hidden}.bar-track i{width:100%;background:#246bfd;border-radius:3px 3px 0 0}.bar-item span{font-size:9px;color:#98a2b3;text-align:center;padding-top:4px}.next-panel>a{display:grid;grid-template-columns:25px 1fr 12px;align-items:center;gap:9px;padding:9px 0;text-decoration:none;color:inherit}.next-panel>a em{width:23px;height:23px;display:grid;place-items:center;border-radius:50%;background:#f2f4f7;color:#667085;font-size:10px;font-style:normal}.next-panel>a.done em{background:#e9f7ef;color:#17894c}.next-panel>a.current em{background:#eaf2ff;color:#246bfd}.next-panel>a div b,.next-panel>a div small{display:block}.next-panel>a div b{font-size:12px}.next-panel>a div small{font-size:10px;color:#98a2b3;margin-top:2px}.next-panel>a>i{font-size:10px;color:#98a2b3}.site-name b,.site-name small{display:block}.site-name small{font-size:10px;color:#98a2b3;margin-top:3px}.state{font-size:11px;color:#98a2b3}.state.ok{color:#17894c}.issues-panel>a{display:grid;grid-template-columns:auto 1fr 10px;gap:9px;align-items:start;padding:11px 0;border-bottom:1px solid #edf0f3;text-decoration:none;color:inherit}.issues-panel>a span{min-width:0}.issues-panel>a b,.issues-panel>a small{display:block}.issues-panel>a b{font-size:12px}.issues-panel>a small{font-size:10px;color:#98a2b3;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.issues-panel>a>i{font-size:10px;color:#98a2b3;margin-top:6px}@media(max-width:1050px){.metrics{grid-template-columns:repeat(2,1fr)}.metrics>a:nth-child(2){border-right:0}.quick-nav{grid-template-columns:repeat(3,1fr)}.main-grid,.lower-grid{grid-template-columns:1fr}}@media(max-width:700px){.metrics{grid-template-columns:1fr}.metrics>a{border:0;border-bottom:1px solid #edf0f3}.quick-nav{grid-template-columns:repeat(2,1fr)}.quick-nav a{border:0}.welcome{align-items:flex-start;gap:12px}.welcome p{display:none}.primary{white-space:nowrap}.bars{gap:3px}.bar-item span{font-size:8px}}
</style>
