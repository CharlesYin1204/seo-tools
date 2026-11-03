<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <div>
        <h3 class="page-title"><i class="fab fa-weixin text-success me-2"></i>微信小程序管理</h3>
        <p class="text-muted mb-0">配置和发布微信小程序</p>
      </div>
      <el-button type="primary" @click="openDialog()"><i class="fas fa-plus me-2"></i>新建小程序</el-button>
    </div>

    <!-- 小程序卡片列表 -->
    <div class="mp-cards" v-loading="loading">
      <div v-if="configs.length === 0" class="empty-state">
        <i class="fab fa-weixin"></i>
        <p>暂无小程序配置，点击右上角创建</p>
      </div>
      <div v-for="item in configs" :key="item.id" class="mp-card">
        <div class="mp-card-header">
          <div class="mp-icon"><i class="fab fa-weixin"></i></div>
          <div class="mp-info">
            <h4>{{ item.app_name || '未命名小程序' }}</h4>
            <span class="status-badge" :class="'status-' + item.status">{{ statusText(item.status) }}</span>
          </div>
          <div class="mp-qrcode" v-if="item.qr_code_url">
            <img :src="item.qr_code_url" alt="小程序码" />
          </div>
        </div>
        <div class="mp-card-body">
          <div class="mp-meta-grid">
            <div class="mp-meta"><label>AppID</label><span>{{ item.app_id || '-' }}</span></div>
            <div class="mp-meta"><label>原始ID</label><span>{{ item.original_id || '-' }}</span></div>
            <div class="mp-meta"><label>版本</label><span>v{{ item.version || '1.0.0' }}</span></div>
            <div class="mp-meta"><label>分类</label><span>{{ item.category || '-' }}</span></div>
            <div class="mp-meta"><label>服务器域名</label><span class="text-truncate">{{ item.server_domain || '-' }}</span></div>
            <div class="mp-meta"><label>业务域名</label><span class="text-truncate">{{ item.business_domain || '-' }}</span></div>
          </div>
          <p class="mp-desc">{{ item.description || '暂无描述' }}</p>
        </div>
        <div class="mp-card-actions">
          <el-button size="small" @click="openDialog(item)"><i class="fas fa-edit me-1"></i>编辑</el-button>
          <el-dropdown @command="(cmd) => handleStatusChange(item, cmd)" trigger="click">
            <el-button size="small" type="success"><i class="fas fa-paper-plane me-1"></i>操作<i class="fas fa-chevron-down ms-1"></i></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="submitted" :disabled="item.status === 'submitted'">提交审核</el-dropdown-item>
                <el-dropdown-item command="published" :disabled="item.status !== 'approved'">发布上线</el-dropdown-item>
                <el-dropdown-item command="draft">撤回为草稿</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button size="small" type="danger" @click="handleDelete(item)"><i class="fas fa-trash me-1"></i>删除</el-button>
        </div>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showDialog" :title="form.id ? '编辑小程序配置' : '新建小程序'" width="680px" destroy-on-close>
      <el-tabs v-model="dialogTab">
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="form" label-width="110px">
            <el-form-item label="小程序名称" required>
              <el-input v-model="form.app_name" placeholder="小程序名称" />
            </el-form-item>
            <el-form-item label="AppID">
              <el-input v-model="form.app_id" placeholder="微信小程序AppID" />
            </el-form-item>
            <el-form-item label="AppSecret">
              <el-input v-model="form.app_secret" type="password" show-password placeholder="微信小程序AppSecret" />
            </el-form-item>
            <el-form-item label="原始ID">
              <el-input v-model="form.original_id" placeholder="gh_xxxxxxxx" />
            </el-form-item>
            <el-form-item label="版本号">
              <el-input v-model="form.version" placeholder="如: 1.0.0" />
            </el-form-item>
            <el-form-item label="分类">
              <el-input v-model="form.category" placeholder="小程序分类" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="form.description" type="textarea" :rows="3" placeholder="小程序功能描述" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="域名配置" name="domain">
          <el-form :model="form" label-width="110px">
            <el-form-item label="服务器域名">
              <el-input v-model="form.server_domain" placeholder="request合法域名，多个用逗号分隔" />
            </el-form-item>
            <el-form-item label="业务域名">
              <el-input v-model="form.business_domain" placeholder="web-view业务域名" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="支付配置" name="payment">
          <el-form :model="form" label-width="110px">
            <el-form-item label="商户号">
              <el-input v-model="form.payment_mch_id" placeholder="微信支付商户号" />
            </el-form-item>
            <el-form-item label="支付密钥">
              <el-input v-model="form.payment_key" type="password" show-password placeholder="微信支付API密钥" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="模板配置" name="template">
          <el-form :model="form" label-width="110px">
            <el-form-item label="模板ID">
              <el-input v-model="form.template_id" placeholder="订阅消息模板ID" />
            </el-form-item>
            <el-form-item label="小程序码URL">
              <el-input v-model="form.qr_code_url" placeholder="小程序码图片URL" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const configs = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const form = ref({})
const dialogTab = ref('basic')

function statusText(s) {
  const map = { draft: '草稿', submitted: '审核中', approved: '审核通过', rejected: '审核不通过', published: '已发布' }
  return map[s] || '草稿'
}

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/mini-program')
    configs.value = res.data?.data || res.data || []
  } catch { configs.value = [] }
  loading.value = false
}

function openDialog(row) {
  form.value = row ? { ...row } : { version: '1.0.0' }
  dialogTab.value = 'basic'
  showDialog.value = true
}

async function saveConfig() {
  if (!form.value.app_name) return ElMessage.warning('请填写小程序名称')
  saving.value = true
  try {
    if (form.value.id) {
      await api.put(`/admin/mini-program/${form.value.id}`, form.value)
    } else {
      await api.post('/admin/mini-program', form.value)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
  }
  saving.value = false
}

async function handleStatusChange(item, status) {
  const actionMap = { submitted: '提交审核', published: '发布上线', draft: '撤回为草稿' }
  await ElMessageBox.confirm(`确定将 ${item.app_name} ${actionMap[status]}吗？`, '确认操作')
  try {
    await api.put(`/admin/mini-program/${item.id}/status`, { status })
    ElMessage.success('操作成功')
    loadData()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function handleDelete(item) {
  await ElMessageBox.confirm(`确定删除 ${item.app_name} 吗？`, '确认删除')
  try {
    await api.delete(`/admin/mini-program/${item.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>

<style scoped>
.mp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
.mp-card {
  background: #fff; border-radius: 10px; border: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; transition: all 0.25s;
}
.mp-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); }
.mp-card-header { display: flex; align-items: center; gap: 12px; padding: 16px 16px 0; }
.mp-icon {
  width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #07C160, #09BB07);
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; flex-shrink: 0;
}
.mp-info { flex: 1; }
.mp-info h4 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
.mp-qrcode { width: 48px; height: 48px; flex-shrink: 0; }
.mp-qrcode img { width: 100%; height: 100%; border-radius: 6px; object-fit: cover; }
.status-badge {
  font-size: 11px; padding: 2px 10px; border-radius: 10px; color: #fff; display: inline-block;
}
.status-draft { background: #909399; }
.status-submitted { background: #E6A23C; }
.status-approved { background: #67C23A; }
.status-rejected { background: #F56C6C; }
.status-published { background: #409EFF; }

.mp-card-body { padding: 12px 16px; }
.mp-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
.mp-meta { display: flex; gap: 6px; font-size: 12px; }
.mp-meta label { color: #999; flex-shrink: 0; min-width: 52px; }
.mp-meta span { color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-desc { font-size: 12px; color: #888; margin: 0; line-height: 1.5; }
.mp-card-actions { padding: 12px 16px; border-top: 1px solid #f0f0f0; display: flex; gap: 6px; flex-wrap: wrap; }

.empty-state { text-align: center; padding: 60px 20px; color: #ccc; grid-column: 1 / -1; }
.empty-state i { font-size: 48px; margin-bottom: 12px; }
.empty-state p { font-size: 14px; }

@media (max-width: 767px) {
  .mp-cards { grid-template-columns: 1fr; }
}
</style>
