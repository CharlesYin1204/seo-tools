<template>
  <div class="contract-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-file-contract me-2"></i>合同电子签</div>
      <div class="plugin-card-body">
        <div class="contract-layout">
          <div class="contract-form">
            <h6>创建内容服务协议</h6>
            <div class="mb-3">
              <label class="form-label">合同模板</label>
              <select v-model="form.template" class="form-select">
                <option value="standard_zh">标准服务协议（中文）</option>
                <option value="standard_en">Standard Content Services Agreement (English)</option>
                <option value="bilingual">双语服务协议 / Bilingual</option>
              </select>
            </div>
            <div class="section-title">服务方信息</div>
            <div class="row mb-2">
              <div class="col-6"><label class="form-label">姓名</label><input v-model="form.landlordName" class="form-control" /></div>
              <div class="col-6"><label class="form-label">证件号</label><input v-model="form.landlordId" class="form-control" /></div>
            </div>
            <div class="mb-2"><label class="form-label">联系电话</label><input v-model="form.landlordPhone" class="form-control" /></div>
            <div class="section-title mt-3">客户信息</div>
            <div class="row mb-2">
              <div class="col-6"><label class="form-label">姓名</label><input v-model="form.tenantName" class="form-control" /></div>
              <div class="col-6"><label class="form-label">护照/证件号</label><input v-model="form.tenantId" class="form-control" /></div>
            </div>
            <div class="mb-2"><label class="form-label">联系电话</label><input v-model="form.tenantPhone" class="form-control" /></div>
            <div class="section-title mt-3">项目范围</div>
            <div class="mb-2"><label class="form-label">项目/站点地址</label><input v-model="form.address" class="form-control" /></div>
            <div class="row mb-2">
              <div class="col-4"><label class="form-label">服务费(元)</label><input v-model.number="form.rent" type="number" class="form-control" /></div>
              <div class="col-4"><label class="form-label">预付款(元)</label><input v-model.number="form.deposit" type="number" class="form-control" /></div>
              <div class="col-4"><label class="form-label">结算方式</label>
                <select v-model="form.payMethod" class="form-select"><option value="monthly">月付</option><option value="quarterly">季付</option><option value="semiannual">半年付</option><option value="annual">年付</option></select>
              </div>
            </div>
            <div class="row mb-2">
              <div class="col-6"><label class="form-label">服务开始日期</label><input v-model="form.startDate" type="date" class="form-control" /></div>
              <div class="col-6"><label class="form-label">服务结束日期</label><input v-model="form.endDate" type="date" class="form-control" /></div>
            </div>
            <div class="mb-3"><label class="form-label">补充条款</label><textarea v-model="form.extraTerms" class="form-control" rows="2" placeholder="其他约定事项..."></textarea></div>
            <div class="d-flex gap-2">
              <button class="btn btn-primary flex-fill" @click="generateContract" :disabled="generating"><i class="fas fa-file-alt me-1"></i>{{ generating ? '生成中...' : '生成合同' }}</button>
              <button class="btn btn-outline-primary" @click="previewContract"><i class="fas fa-eye me-1"></i>预览</button>
            </div>
          </div>
          <div class="contract-list">
            <h6><i class="fas fa-folder-open me-1"></i>我的合同</h6>
            <div v-for="c in contracts" :key="c.id" class="contract-item">
              <div class="contract-head">
                <strong>{{ c.title }}</strong>
                <span class="badge" :class="statusBadge(c.data_json?.status)">{{ statusText(c.data_json?.status) }}</span>
              </div>
              <div class="contract-meta text-muted small">{{ c.data_json?.address || '' }} | {{ formatTime(c.created_at) }}</div>
              <div class="contract-actions mt-1">
                <button class="btn btn-sm btn-outline-primary" @click="viewContract(c)"><i class="fas fa-eye me-1"></i>查看</button>
                <button class="btn btn-sm btn-outline-success" @click="downloadContract(c)"><i class="fas fa-download me-1"></i>下载</button>
                <button class="btn btn-sm btn-outline-danger" @click="deleteContract(c.id)"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            <div v-if="!contracts.length" class="text-center text-muted py-4"><i class="fas fa-file-contract" style="font-size:36px"></i><p class="mt-2">暂无合同</p></div>
          </div>
        </div>

        <div v-if="showPreviewModal" class="preview-modal" @click.self="showPreviewModal=false">
          <div class="preview-box">
            <div class="preview-header"><h5>合同预览</h5><button class="btn-close" @click="showPreviewModal=false"></button></div>
            <div class="preview-body" v-html="contractHtml"></div>
            <div class="preview-footer">
              <button class="btn btn-success" @click="downloadPreview"><i class="fas fa-download me-1"></i>下载合同</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })
const form = reactive({
  template: 'standard_zh', landlordName: '', landlordId: '', landlordPhone: '',
  tenantName: '', tenantId: '', tenantPhone: '', address: '',
  rent: null, deposit: null, payMethod: 'monthly', startDate: '', endDate: '', extraTerms: ''
})
const contracts = ref([])
const generating = ref(false)
const showPreviewModal = ref(false)
const contractHtml = ref('')

const statusBadge = (s) => ({ draft: 'bg-secondary', pending: 'bg-warning text-dark', signed: 'bg-success', expired: 'bg-danger' }[s] || 'bg-secondary')
const statusText = (s) => ({ draft: '草稿', pending: '待签署', signed: '已签署', expired: '已过期' }[s] || '草稿')

const buildContractHtml = () => {
  const payMethodText = { monthly: '月结', quarterly: '季度结算', semiannual: '半年结算', annual: '年度结算' }[form.payMethod] || ''
  return `<div style="font-family:SimSun,serif;padding:30px;line-height:2;"><h2 style="text-align:center;margin-bottom:20px;">内容服务协议</h2><p><strong>服务方：</strong>${form.landlordName || '______'}  证件/统一社会信用代码：${form.landlordId || '______'}  电话：${form.landlordPhone || '______'}</p><p><strong>客户方：</strong>${form.tenantName || '______'}  证件/统一社会信用代码：${form.tenantId || '______'}  电话：${form.tenantPhone || '______'}</p><hr/><p>双方经协商一致，就 SEO、内容与 AI 搜索可见性服务达成如下协议：</p><p><strong>一、项目范围：</strong>${form.address || '______'}</p><p><strong>二、服务期限：</strong>自 ${form.startDate || '______'} 起至 ${form.endDate || '______'} 止。</p><p><strong>三、服务费及结算：</strong>服务费人民币 <u>${form.rent || '______'}</u> 元，采用${payMethodText}方式支付。</p><p><strong>四、预付款：</strong>客户方支付预付款人民币 <u>${form.deposit || '______'}</u> 元，具体以订单和交付记录为准。</p><p><strong>五、其他约定：</strong>${form.extraTerms || '无'}</p><br/><div style="display:flex;justify-content:space-between;margin-top:40px;"><div><p>服务方签字：________________</p><p>日期：________________</p></div><div><p>客户方签字：________________</p><p>日期：________________</p></div></div></div>`
}

const previewContract = () => { contractHtml.value = buildContractHtml(); showPreviewModal.value = true }

const generateContract = async () => {
  if (!form.landlordName || !form.tenantName) return ElMessage.warning('请填写服务方和客户姓名')
  generating.value = true
  try {
    const html = buildContractHtml()
    await api.post('/user/plugin-exec/e-contract/data', {
      data_type: 'contract', title: `${form.landlordName} - ${form.tenantName} 内容服务协议`,
      content: html,
      data_json: { ...form, status: 'draft' }
    })
    ElMessage.success('合同已生成')
    loadContracts()
  } catch { ElMessage.error('生成失败') }
  generating.value = false
}

const viewContract = (c) => { contractHtml.value = c.content || ''; showPreviewModal.value = true }

const downloadContract = (c) => { downloadHtml(c.content || '', c.title || '合同') }
const downloadPreview = () => { downloadHtml(contractHtml.value, '内容服务协议') }

const downloadHtml = (html, title) => {
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>@media print{body{margin:0}}</style></head><body>${html}</body></html>`
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${title}.html`; link.click()
  ElMessage.info('已下载HTML格式，用浏览器打开后可打印为PDF')
}

const deleteContract = async (id) => {
  try { await api.delete(`/user/plugin-exec/e-contract/data/${id}`); ElMessage.success('已删除'); loadContracts() } catch {}
}

const loadContracts = async () => {
  try {
    const res = await api.get('/user/plugin-exec/e-contract/data', { params: { data_type: 'contract' } })
    contracts.value = (res.data?.data || []).map(r => { try { if (typeof r.data_json === 'string') r.data_json = JSON.parse(r.data_json) } catch {}; return r })
  } catch {}
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : ''

onMounted(loadContracts)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #2d3436, #636e72); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.contract-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
@media (max-width: 768px) { .contract-layout { grid-template-columns: 1fr; } }
h6 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.section-title { font-size: 13px; font-weight: 600; color: #4879FF; padding-bottom: 4px; border-bottom: 1px solid #e0e0e0; margin-bottom: 8px; }
.contract-item { background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.contract-head { display: flex; justify-content: space-between; align-items: center; }
.preview-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.preview-box { background: #fff; border-radius: 10px; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; }
.preview-header { padding: 14px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
.preview-header h5 { margin: 0; }
.preview-body { padding: 20px; }
.preview-footer { padding: 12px 20px; border-top: 1px solid #eee; text-align: right; }
</style>
