<template>
  <div>
    <div class="page-header"><h3 class="page-title">预约管理</h3></div>

    <div class="card-container">
      <el-table :data="appointments" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="client_name" label="客户" width="120" />
        <el-table-column prop="property_title" label="房源" min-width="200" />
        <el-table-column prop="appointment_time" label="预约时间" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="{ pending: 'warning', confirmed: 'success', cancelled: 'danger', completed: 'info' }[row.status]">
              {{ { pending: '待确认', confirmed: '已确认', cancelled: '已取消', completed: '已完成' }[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{row}">
            <el-button v-if="row.status === 'pending'" size="small" type="success" @click="updateStatus(row, 'confirmed')">确认</el-button>
            <el-button v-if="row.status === 'confirmed'" size="small" type="primary" @click="updateStatus(row, 'completed')">完成</el-button>
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
import { ElMessage } from 'element-plus'

const appointments = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/agent/appointments', { params: { page: page.value, pageSize: pageSize.value } })
    appointments.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

async function updateStatus(row, status) {
  try {
    await api.put(`/user/appointments/${row.id}`, { status })
    ElMessage.success('更新成功')
    loadData()
  } catch {}
}
</script>
