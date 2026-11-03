<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">通知管理</h3>
      <el-button type="primary" @click="showDialog = true">发送通知</el-button>
    </div>

    <div class="card-container">
      <el-table :data="notifications" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{row}">
            <el-tag>{{ { system: '系统', promotion: '推广', update: '更新' }[row.type] || row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target" label="目标" width="100" />
        <el-table-column prop="created_at" label="发送时间" width="160" />
      </el-table>
      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <el-dialog v-model="showDialog" title="发送通知" width="500px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type"><el-option label="系统通知" value="system" /><el-option label="推广通知" value="promotion" /></el-select>
        </el-form-item>
        <el-form-item label="目标">
          <el-select v-model="form.target"><el-option label="所有用户" value="all" /><el-option label="VIP用户" value="vip" /></el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="sendNotification">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const notifications = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const form = ref({ type: 'system', target: 'all' })

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/notifications', { params: { page: page.value, pageSize: pageSize.value } })
    notifications.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

async function sendNotification() {
  saving.value = true
  try {
    await api.post('/admin/notifications', form.value)
    ElMessage.success('发送成功')
    showDialog.value = false
    form.value = { type: 'system', target: 'all' }
    loadData()
  } catch {}
  saving.value = false
}
</script>
