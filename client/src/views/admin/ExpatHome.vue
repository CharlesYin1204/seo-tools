<template>
  <div>
    <div class="page-header"><h3 class="page-title">SEO 内容运营</h3></div>
    <!-- 统计卡片 -->
    <div class="row g-4 mb-4">
      <div class="col-md-3" v-for="s in statCards" :key="s.label">
        <div class="stat-card">
          <div class="stat-value">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </div>
    <!-- 搜索筛选 -->
    <div class="card-container">
      <div class="mb-3 d-flex gap-2 flex-wrap">
        <el-input v-model="filters.keyword" placeholder="搜索内容资产标题..." clearable style="width:200px" @keyup.enter="loadData" />
        <el-select v-model="filters.district" placeholder="区域" clearable style="width:140px" @change="loadData">
          <el-option v-for="d in districtOptions" :key="d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:120px" @change="loadData">
          <el-option label="已上架" value="active" />
          <el-option label="待审核" value="pending" />
          <el-option label="已下架" value="inactive" />
        </el-select>
        <el-input v-model="filters.priceMin" placeholder="最低价" clearable style="width:120px" type="number" />
        <el-input v-model="filters.priceMax" placeholder="最高价" clearable style="width:120px" type="number" />
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>
      <!-- 内容资产列表 -->
      <el-table :data="properties" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="price" label="价格" width="100">
          <template #default="{ row }">¥{{ row.price || 0 }}/月</template>
        </el-table-column>
        <el-table-column prop="district" label="区域" width="120" />
        <el-table-column prop="bedrooms" label="卧室" width="70" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showDialog" :title="form.id ? '编辑内容资产' : '新增内容资产'" width="600px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="价格"><el-input v-model="form.price" type="number" /></el-form-item>
        <el-form-item label="区域"><el-input v-model="form.district" /></el-form-item>
        <el-form-item label="卧室数"><el-input v-model="form.bedrooms" type="number" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="已上架" value="active" />
            <el-option label="待审核" value="pending" />
            <el-option label="已下架" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveProperty">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const stats = ref({})
const properties = ref([])
const districtOptions = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const form = ref({})
const filters = reactive({ keyword: '', district: '', status: '', priceMin: '', priceMax: '' })

const statCards = computed(() => [
  { label: '总内容资产', value: stats.value.totalProperties || 0 },
  { label: '已上架', value: stats.value.activeProperties || 0 },
  { label: '待审核', value: stats.value.pendingProperties || 0 },
  { label: '联系记录数', value: stats.value.contactRecords || 0 },
])

const statusTagType = (s) => ({ active: 'success', pending: 'warning', inactive: 'info' }[s] || '')
const statusLabel = (s) => ({ active: '已上架', pending: '待审核', inactive: '已下架' }[s] || s)

onMounted(async () => {
  await loadDashboard()
  await loadData()
})

async function loadDashboard() {
  try {
    const res = await api.get('/admin/expatshome/dashboard')
    stats.value = res.data?.stats || {}
    districtOptions.value = res.data?.districts || []
  } catch {}
}

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/expatshome/properties', {
      params: { page: page.value, pageSize: pageSize.value, ...filters }
    })
    properties.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

function openDialog(row) {
  form.value = row ? { ...row } : { status: 'pending' }
  showDialog.value = true
}

async function saveProperty() {
  saving.value = true
  try {
    if (form.value.id) {
      await api.put(`/admin/expatshome/properties/${form.value.id}`, form.value)
    } else {
      await api.post('/admin/expatshome/properties', form.value)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch {}
  saving.value = false
}

async function handleDelete(row) {
  await ElMessageBox.confirm('确定删除该内容资产？', '确认')
  try {
    await api.delete(`/admin/expatshome/properties/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>

<style scoped>
.page-container { padding: 20px; }
</style>
