<template>
  <div>
    <div class="page-header"><h3 class="page-title">用户需求管理</h3></div>
    <div class="card-container">
      <div class="mb-3 d-flex gap-2 flex-wrap">
        <el-input v-model="search" placeholder="搜索用户名/需求描述..." clearable style="width:240px" @keyup.enter="loadData" />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width:140px" @change="loadData">
          <el-option label="待处理" value="pending" />
          <el-option label="处理中" value="processing" />
          <el-option label="已完成" value="completed" />
          <el-option label="已关闭" value="closed" />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>
      <el-table :data="demands" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="tenant_name" label="用户名" width="120" />
        <el-table-column prop="description" label="需求描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="budget" label="预算" width="120">
          <template #default="{ row }">{{ row.budget ? `¥${row.budget}/月` : '-' }}</template>
        </el-table-column>
        <el-table-column prop="district" label="期望区域" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="demandStatusType(row.status)">{{ demandStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-select v-model="row.status" size="small" style="width:100px" @change="updateStatus(row)">
              <el-option label="待处理" value="pending" />
              <el-option label="处理中" value="processing" />
              <el-option label="已完成" value="completed" />
              <el-option label="已关闭" value="closed" />
            </el-select>
            <el-button size="small" type="danger" @click="handleDelete(row)" style="margin-left:8px">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const demands = ref([])
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const demandStatusType = (s) => ({ pending: 'warning', processing: '', completed: 'success', closed: 'info' }[s] || '')
const demandStatusLabel = (s) => ({ pending: '待处理', processing: '处理中', completed: '已完成', closed: '已关闭' }[s] || s)

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/demands', {
      params: { page: page.value, pageSize: pageSize.value, search: search.value, status: statusFilter.value }
    })
    demands.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

async function updateStatus(row) {
  try {
    await api.put(`/admin/demands/${row.id}/status`, { status: row.status })
    ElMessage.success('状态更新成功')
  } catch {
    loadData()
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm('确定删除该需求记录？', '确认')
  try {
    await api.delete(`/admin/demands/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>

<style scoped>
.page-container { padding: 20px; }
</style>
