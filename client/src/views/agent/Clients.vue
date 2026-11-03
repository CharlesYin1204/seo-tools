<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">客户管理</h3>
      <el-button type="primary" @click="showDialog = true">添加客户</el-button>
    </div>

    <div class="card-container">
      <div class="mb-3">
        <el-input v-model="search" placeholder="搜索客户..." clearable style="width:240px" @keyup.enter="loadData" />
      </div>
      <el-table :data="clients" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="phone" label="电话" width="150" />
        <el-table-column prop="email" label="邮箱" width="200" />
        <el-table-column prop="demand" label="需求描述" min-width="200" />
        <el-table-column prop="created_at" label="添加时间" width="160" />
      </el-table>
      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <el-dialog v-model="showDialog" title="添加客户" width="500px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="需求"><el-input v-model="form.demand" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="addClient">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const clients = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const form = ref({})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/agent/clients', { params: { page: page.value, pageSize: pageSize.value, search: search.value } })
    clients.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

async function addClient() {
  saving.value = true
  try {
    await api.post('/agent/clients', form.value)
    ElMessage.success('添加成功')
    showDialog.value = false
    form.value = {}
    loadData()
  } catch {}
  saving.value = false
}
</script>
