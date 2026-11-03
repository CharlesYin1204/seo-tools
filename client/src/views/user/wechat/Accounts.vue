<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">公众号管理</h3>
      <el-button type="primary" @click="showDialog = true">添加公众号</el-button>
    </div>

    <div class="card-container">
      <el-table :data="accounts" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="公众号名称" min-width="150" />
        <el-table-column prop="app_id" label="AppID" width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === 'active' ? 'success' : 'warning'">{{ row.status === 'active' ? '正常' : '未授权' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{row}">
            <el-button size="small" type="danger" @click="deleteAccount(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="showDialog" title="添加公众号" width="500px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="公众号名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="AppID"><el-input v-model="form.app_id" /></el-form-item>
        <el-form-item label="AppSecret"><el-input v-model="form.app_secret" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="addAccount">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const accounts = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const form = ref({})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/user/wechat/accounts')
    accounts.value = res.data?.data || res.data || []
  } catch {}
  loading.value = false
}

async function addAccount() {
  saving.value = true
  try {
    await api.post('/user/wechat/accounts', form.value)
    ElMessage.success('添加成功')
    showDialog.value = false
    form.value = {}
    loadData()
  } catch {}
  saving.value = false
}

async function deleteAccount(row) {
  await ElMessageBox.confirm('确定删除该公众号？', '确认')
  try {
    await api.delete(`/user/wechat/accounts/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>
