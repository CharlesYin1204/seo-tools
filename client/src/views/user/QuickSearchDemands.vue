<template>
  <div class="quick-search-demands-page">
    <!-- 未购买功能模块：全屏遮罩 + 居中弹窗 -->
    <teleport to="body">
      <div v-if="featureBlocked" class="fb-mask">
        <div class="fb-modal">
          <div class="fb-icon"><i class="fas fa-lock"></i></div>
          <h3 class="fb-title">功能未开通</h3>
          <p class="fb-desc">您尚未购买「快速内容检索」功能模块，<br>开通后即可使用内容检索需求管理等全部功能。</p>
          <button class="fb-btn fb-btn-primary" @click="$router.push('/user/membership')">
            <i class="fas fa-crown"></i> 前往购买会员
          </button>
          <button class="fb-btn fb-btn-secondary" @click="$router.push('/user/dashboard')">返回首页</button>
        </div>
      </div>
    </teleport>

    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">
        <i class="fas fa-clipboard-list me-2"></i>内容检索需求管理
      </h3>
      <el-button type="primary" @click="openDialog()">
        <i class="fas fa-plus me-1"></i>添加需求
      </el-button>
    </div>

    <div class="card-container">
      <el-table :data="demands" stripe v-loading="loading" class="demands-table">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="note" label="关键词/备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.note || row.keyword || row.title || '-' }}</template>
        </el-table-column>
        <el-table-column prop="district" label="区域" width="110" />
        <el-table-column prop="budget_min" label="预算" width="140">
          <template #default="{ row }">
            {{ formatBudget(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="bedrooms" label="户型" width="80">
          <template #default="{ row }">
            {{ row.bedrooms || row.rooms ? `${row.bedrooms || row.rooms}室` : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">
              <i class="fas fa-edit me-1"></i>编辑
            </el-button>
            <el-button size="small" type="danger" @click="deleteDemand(row)">
              <i class="fas fa-trash me-1"></i>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="errorMsg" class="error-message mt-3">
        <i class="fas fa-exclamation-circle me-2"></i>{{ errorMsg }}
      </div>

      <el-empty v-if="!loading && !demands.length" description="暂无内容检索需求" />

      <div class="d-flex justify-content-center mt-3" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog
      v-model="showDialog"
      :title="form.id ? '编辑需求' : '添加需求'"
      width="520px"
      destroy-on-close
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="关键词/备注" prop="note">
          <el-input v-model="form.note" placeholder="小区名、地段等关键词" />
        </el-form-item>
        <el-form-item label="区域" prop="district">
          <el-input v-model="form.district" placeholder="如：浦东、静安" />
        </el-form-item>
        <el-form-item label="最低预算" prop="budgetMin">
          <el-input-number v-model="form.budgetMin" :min="0" placeholder="最低" class="w-100" />
        </el-form-item>
        <el-form-item label="最高预算" prop="budgetMax">
          <el-input-number v-model="form.budgetMax" :min="0" placeholder="最高" class="w-100" />
        </el-form-item>
        <el-form-item label="户型" prop="bedrooms">
          <el-select v-model="form.bedrooms" placeholder="选择室数" clearable class="w-100">
            <el-option v-for="n in [1,2,3,4,5]" :key="n" :label="`${n}室`" :value="n" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" placeholder="状态" class="w-100">
            <el-option label="进行中" value="active" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDemand">
          <i class="fas fa-save me-1"></i>保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const isAdminView = route.path.startsWith('/admin')
const featureBlocked = ref(false)

const demands = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const errorMsg = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const formRef = ref(null)

const form = reactive({
  id: null,
  note: '',
  district: '',
  budgetMin: null,
  budgetMax: null,
  bedrooms: null,
  status: 'active',
})

const rules = {}

/** 格式化预算显示 */
function formatBudget(row) {
  const min = row.budget_min ?? 0
  const max = row.budget_max ?? 0
  if (min || max) return `¥${min || 0} - ¥${max || 0}`
  return '-'
}

function getStatusType(status) {
  return status === 'active' ? 'success' : 'info'
}

function getStatusText(status) {
  return status === 'active' ? '进行中' : status === 'closed' ? '已关闭' : status || '-'
}

function resetForm() {
  form.id = null
  form.note = ''
  form.district = ''
  form.budgetMin = null
  form.budgetMax = null
  form.bedrooms = null
  form.status = 'active'
  formRef.value?.resetFields()
}

function openDialog(row) {
  if (row) {
    form.id = row.id
    form.note = row.note || row.keyword || row.title || ''
    form.district = row.district || row.preferred_district || ''
    form.budgetMin = row.budget_min ?? null
    form.budgetMax = row.budget_max ?? null
    form.bedrooms = row.bedrooms ?? row.rooms ?? null
    form.status = row.status || 'active'
  } else {
    resetForm()
  }
  showDialog.value = true
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await api.get('/user/demands', {
      params: { page: page.value, pageSize: pageSize.value },
    })
    demands.value = res.data?.data ?? res.data ?? []
    total.value = res.data?.total ?? 0
  } catch (e) {
    errorMsg.value = e?.message || '加载失败'
    demands.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function saveDemand() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!form.district && !form.note && !form.budgetMin && !form.budgetMax) {
    ElMessage.warning('请至少填写区域、关键词或预算')
    return
  }

  saving.value = true
  try {
    const payload = {
      district: form.district,
      budgetMin: form.budgetMin,
      budgetMax: form.budgetMax,
      bedrooms: form.bedrooms,
      note: form.note,
      status: form.status,
    }
    if (form.id) {
      await api.put(`/user/demands/${form.id}`, payload)
    } else {
      await api.post('/user/demands', payload)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteDemand(row) {
  try {
    await ElMessageBox.confirm('确定删除该内容检索需求？', '确认', { type: 'warning' })
    await api.delete(`/user/demands/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(async () => {
  if (!isAdminView) {
    try {
      const checkRes = await api.get('/user/feature-modules/check/quick-search')
      const access = checkRes.data
      if (access && access.allowed === false) {
        featureBlocked.value = true
        return
      }
    } catch (e) {
      if (e.response?.status === 403) {
        featureBlocked.value = true
        return
      }
    }
  }
  loadData()
})
</script>

<style scoped lang="scss">
.quick-search-demands-page {
  padding: 0;
}

.demands-table {
  border-radius: 6px;
  overflow: hidden;
}

.error-message {
  color: var(--danger-color);
  padding: var(--space-sm);
  background: #ffebee;
  border-radius: 6px;
  display: flex;
  align-items: center;
}

.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.mt-3 { margin-top: var(--space-lg); }
.w-100 { width: 100%; }
</style>
