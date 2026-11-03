<template>
  <section class="publishing-page">
    <header class="head">
      <div><small>PUBLISH & VERIFY</small><h2>发布与检查</h2><p>从已审核候选到网站写入、原 URL 复扫和证据留存。</p></div>
      <el-button :loading="loading" @click="load"><i class="fas fa-refresh" /> 刷新</el-button>
    </header>

    <div class="metrics">
      <article><span>可发布</span><b>{{ data.summary?.ready || 0 }}</b></article>
      <article><span>发布中</span><b>{{ data.summary?.running || 0 }}</b></article>
      <article><span>已验证</span><b>{{ data.summary?.published || 0 }}</b></article>
      <article><span>失败待处理</span><b>{{ data.summary?.failed || 0 }}</b></article>
    </div>

    <section class="connector-strip">
      <div><b>网站连接</b><span>发布前必须由管理员审核连接器，并取得最近一次 HTTP 2xx 健康检查。</span></div>
      <router-link to="/user/seo-sites"><el-button type="primary" plain>管理连接器</el-button></router-link>
    </section>
    <div v-if="data.connectors?.length" class="connectors">
      <article v-for="item in data.connectors" :key="item.id">
        <div><b>{{ item.site_name }}</b><span>{{ connectorName[item.connector_type] || item.connector_type }} · {{ item.auth_type }}</span></div>
        <div><el-tag :type="connectorType(item)">{{ connectorStatus(item) }}</el-tag><small>{{ item.last_test_at ? formatTime(item.last_test_at) : '尚未健康检查' }}</small></div>
      </article>
    </div>
    <el-alert v-else title="当前没有发布连接器，请先在“我的网站”提交 HTTPS 连接地址并等待管理员审核。" type="warning" :closable="false" />

    <section class="section-head"><div><h3>待发布候选</h3><p>候选 URL 固定来自扫描页面；发布后自动复扫同一 URL。</p></div></section>
    <el-table :data="data.candidates || []" v-loading="loading" stripe>
      <el-table-column label="状态" width="125"><template #default="{row}"><el-tag :type="candidateType[row.status] || 'info'">{{ candidateName[row.status] || row.status }}</el-tag></template></el-table-column>
      <el-table-column label="站点与页面" min-width="260"><template #default="{row}"><b>{{ row.site_name }}</b><a :href="row.url" target="_blank" rel="noopener">{{ row.url }}</a></template></el-table-column>
      <el-table-column label="待发布标题与描述" min-width="390"><template #default="{row}"><strong>{{ row.candidate_title }}</strong><p>{{ row.candidate_description }}</p></template></el-table-column>
      <el-table-column label="操作" width="150"><template #default="{row}"><el-button v-if="['approved','exported','publish_failed'].includes(row.status)" type="primary" size="small" :loading="publishingId===row.id" @click="publish(row)">{{ row.status==='publish_failed' ? '重试发布' : '发布并复扫' }}</el-button><span v-else>{{ row.status==='published' ? '复扫已通过' : '任务处理中' }}</span></template></el-table-column>
    </el-table>
    <el-empty v-if="!loading && !data.candidates?.length" description="暂无已批准的元数据候选"><router-link to="/user/seo/metadata">前往页面分数生成候选</router-link></el-empty>

    <section class="section-head jobs-head"><div><h3>发布任务证据</h3><p>远端状态、复扫对比和错误原因均来自实际执行。</p></div></section>
    <el-table :data="data.jobs || []" v-loading="loading" stripe>
      <el-table-column label="任务" width="100"><template #default="{row}">#{{ row.id }}</template></el-table-column>
      <el-table-column label="结果" width="145"><template #default="{row}"><el-tag :type="jobType[row.status] || 'info'">{{ jobName[row.status] || row.status }}</el-tag><small class="remote">HTTP {{ row.remote_status || '--' }}</small></template></el-table-column>
      <el-table-column label="页面" min-width="260"><template #default="{row}"><b>{{ row.site_name }}</b><a :href="row.url" target="_blank" rel="noopener">{{ row.url }}</a></template></el-table-column>
      <el-table-column label="检查证据" min-width="350"><template #default="{row}"><p>{{ row.error_message || row.response_excerpt || '任务正在执行' }}</p><small v-if="verification(row)">标题 {{ verification(row).title_match ? '匹配' : '不匹配' }} · 描述 {{ verification(row).description_match ? '匹配' : '不匹配' }}</small></template></el-table-column>
      <el-table-column label="完成时间" width="175"><template #default="{row}">{{ formatTime(row.completed_at || row.started_at) }}</template></el-table-column>
    </el-table>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '@/api';
import { ElMessage } from 'element-plus';
const loading=ref(false),publishingId=ref(null),data=ref({summary:{},candidates:[],connectors:[],jobs:[]});
const candidateName={approved:'已批准',exported:'已导出',publishing:'发布中',published:'已发布并验证',publish_failed:'发布失败'},candidateType={approved:'success',exported:'info',publishing:'warning',published:'success',publish_failed:'danger'};
const connectorName={wordpress:'WordPress',rest:'REST API',webhook:'Webhook'},jobName={running:'执行中',published:'发布并验证',verification_failed:'复扫未匹配',failed:'发布失败'},jobType={running:'warning',published:'success',verification_failed:'danger',failed:'danger'};
const connectorStatus=item=>item.status==='pending'?'待管理员审核':item.status==='rejected'?'已拒绝':item.status==='disabled'?'已停用':Number(item.last_test_status)>=200&&Number(item.last_test_status)<300?'健康检查通过':'等待健康检查';
const connectorType=item=>item.status==='active'&&Number(item.last_test_status)>=200&&Number(item.last_test_status)<300?'success':item.status==='rejected'?'danger':'warning';
const formatTime=value=>value?new Date(value).toLocaleString('zh-CN'):'--';
function verification(row){try{return typeof row.verification==='string'?JSON.parse(row.verification):row.verification}catch{return null}}
async function load(){loading.value=true;try{const response=await api.get('/user/seo/publishing');data.value=response.data||{}}finally{loading.value=false}}
async function publish(row){publishingId.value=row.id;try{await api.post(`/user/seo/candidates/${row.id}/publish-check`,{},{timeout:90000});ElMessage.success('发布完成，原页面复扫验证一致');await load()}catch(error){ElMessage.error(error.response?.data?.message||'发布失败，任务证据已保存');await load()}finally{publishingId.value=null}}
onMounted(load);
</script>

<style scoped>
.publishing-page{max-width:1180px;margin:auto}.head,.connector-strip,.section-head{display:flex;justify-content:space-between;align-items:flex-start}.head{margin-bottom:16px}.head small{color:#1677ff;font-weight:700}.head h2{font-size:24px;margin:5px 0}.head p,.section-head p{margin:0;color:#667085}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.metrics article,.connector-strip,.connectors article{background:#fff;border:1px solid #e4e8ee;border-radius:7px}.metrics article{padding:15px}.metrics span,.connector-strip span,.connectors span,.connectors small,.remote{display:block;color:#667085;font-size:11px}.metrics b{display:block;font-size:24px;margin-top:4px}.connector-strip{align-items:center;padding:14px 16px;margin-bottom:10px}.connector-strip span{margin-top:4px}.connectors{display:grid;gap:8px;margin-bottom:14px}.connectors article{display:flex;justify-content:space-between;padding:12px 14px}.connectors article>div:last-child{text-align:right}.connectors small{margin-top:4px}.section-head{margin:20px 0 10px}.section-head h3{font-size:15px;margin:0 0 4px}.section-head p{font-size:11px}.jobs-head{margin-top:24px}a{display:block;color:#667085;font-size:11px;margin-top:4px;overflow-wrap:anywhere}.el-table p{margin:4px 0;color:#667085;font-size:12px}.remote{margin-top:4px}@media(max-width:700px){.head p{display:none}.metrics{grid-template-columns:1fr 1fr}.connector-strip{align-items:flex-start;gap:12px}.connectors article{gap:12px}}
</style>
