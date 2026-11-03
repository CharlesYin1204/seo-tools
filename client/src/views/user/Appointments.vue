<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">我的预约</h3>
      <el-button type="primary" @click="showDialog = true">新建预约</el-button>
    </div>

    <div class="card-container">
      <el-table :data="appointments" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="property_title" label="内容资产" min-width="150" />
        <el-table-column prop="appointment_time" label="预约时间" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="{ pending: 'warning', confirmed: 'success', cancelled: 'danger', completed: 'info' }[row.status]">
              {{ { pending: '待确认', confirmed: '已确认', cancelled: '已取消', completed: '已完成' }[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" />
        <el-table-column label="操作" width="120">
          <template #default="{row}">
            <el-button v-if="row.status === 'pending'" size="small" type="danger" @click="cancelAppointment(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <el-dialog v-model="showDialog" title="新建预约" width="500px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="内容资产ID"><el-input-number v-model="form.property_id" :min="1" style="width:100%" /></el-form-item>
        <el-form-item label="预约时间"><el-date-picker v-model="form.appointment_time" type="datetime" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAppointment">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const appointments = ref([])
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
    const res = await api.get('/user/appointments', { params: { page: page.value, pageSize: pageSize.value } })
    appointments.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

async function saveAppointment() {
  saving.value = true
  try {
    await api.post('/user/appointments', form.value)
    ElMessage.success('预约成功')
    showDialog.value = false
    form.value = {}
    loadData()
  } catch {}
  saving.value = false
}

async function cancelAppointment(row) {
  try {
    await api.put(`/user/appointments/${row.id}`, { status: 'cancelled' })
    ElMessage.success('已取消')
    loadData()
  } catch {}
}
</script>
