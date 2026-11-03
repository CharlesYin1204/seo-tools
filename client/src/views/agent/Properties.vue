<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">房源管理</h3>
      <el-button type="primary" @click="showDialog = true">发布房源</el-button>
    </div>

    <div class="card-container">
      <el-table :data="properties" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="price" label="价格" width="120">
          <template #default="{row}">¥{{ row.price }}/月</template>
        </el-table-column>
        <el-table-column prop="area" label="面积(㎡)" width="100" />
        <el-table-column prop="district" label="区域" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === 'published' ? 'success' : 'warning'">{{ row.status === 'published' ? '已发布' : '草稿' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{row}">
            <el-button size="small" @click="editProperty(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <el-dialog v-model="showDialog" :title="form.id ? '编辑房源' : '发布房源'" width="600px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="价格"><el-input-number v-model="form.price" :min="0" style="width:100%" /></el-form-item>
        <el-form-item label="面积"><el-input-number v-model="form.area" :min="0" style="width:100%" /></el-form-item>
        <el-form-item label="区域"><el-input v-model="form.district" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
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
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const properties = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const form = ref({})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/agent/properties', { params: { page: page.value, pageSize: pageSize.value } })
    properties.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

function editProperty(row) {
  form.value = { ...row }
  showDialog.value = true
}

async function saveProperty() {
  saving.value = true
  try {
    if (form.value.id) {
      await api.put(`/agent/properties/${form.value.id}`, form.value)
    } else {
      await api.post('/agent/properties', form.value)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    form.value = {}
    loadData()
  } catch {}
  saving.value = false
}
</script>
