<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">租房需求</h3>
      <el-button type="primary" @click="openDialog()">发布需求</el-button>
    </div>

    <div class="card-container">
      <el-table :data="demands" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="150" />
        <el-table-column prop="budget_min" label="预算" width="150">
          <template #default="{row}">¥{{ row.budget_min || 0 }} - ¥{{ row.budget_max || 0 }}</template>
        </el-table-column>
        <el-table-column prop="preferred_district" label="意向区域" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '进行中' : '已关闭' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="发布时间" width="160" />
        <el-table-column label="操作" width="160">
          <template #default="{row}">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteDemand(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <el-dialog v-model="showDialog" :title="form.id ? '编辑需求' : '发布需求'" width="500px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="最低预算"><el-input-number v-model="form.budget_min" :min="0" style="width:100%" /></el-form-item>
        <el-form-item label="最高预算"><el-input-number v-model="form.budget_max" :min="0" style="width:100%" /></el-form-item>
        <el-form-item label="意向区域"><el-input v-model="form.preferred_district" /></el-form-item>
        <el-form-item label="详细描述"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDemand">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const demands = ref([])
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
    const res = await api.get('/user/demands', { params: { page: page.value, pageSize: pageSize.value } })
    demands.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

function openDialog(row) {
  form.value = row ? { ...row } : {}
  showDialog.value = true
}

async function saveDemand() {
  saving.value = true
  try {
    if (form.value.id) {
      await api.put(`/user/demands/${form.value.id}`, form.value)
    } else {
      await api.post('/user/demands', form.value)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch {}
  saving.value = false
}

async function deleteDemand(row) {
  await ElMessageBox.confirm('确定删除该需求？', '确认')
  try {
    await api.delete(`/user/demands/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>
