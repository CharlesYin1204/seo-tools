<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">语言管理</h3>
      <el-button type="primary" @click="openDialog()">添加语言</el-button>
    </div>

    <div class="card-container">
      <el-table :data="languages" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="code" label="语言代码" width="120" />
        <el-table-column prop="name" label="语言名称" />
        <el-table-column prop="native_name" label="本地名称" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{row}">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="showDialog" :title="form.id ? '编辑语言' : '添加语言'" width="500px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="语言代码"><el-input v-model="form.code" placeholder="例如: zh-CN, en" /></el-form-item>
        <el-form-item label="语言名称"><el-input v-model="form.name" placeholder="例如: Chinese" /></el-form-item>
        <el-form-item label="本地名称"><el-input v-model="form.native_name" placeholder="例如: 中文" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status"><el-option label="启用" value="active" /><el-option label="停用" value="inactive" /></el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveLanguage">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const languages = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const form = ref({})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/languages')
    languages.value = res.data?.data || res.data || []
  } catch {}
  loading.value = false
}

function openDialog(row) {
  form.value = row ? { ...row } : { status: 'active' }
  showDialog.value = true
}

async function saveLanguage() {
  saving.value = true
  try {
    await api.post('/admin/languages', form.value)
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch {}
  saving.value = false
}
</script>
