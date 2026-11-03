<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">会员套餐管理</h3>
      <el-button type="primary" @click="openDialog()">新建套餐</el-button>
    </div>

    <div class="card-container">
      <el-table :data="packages" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="套餐名称" />
        <el-table-column prop="price" label="价格" width="120">
          <template #default="{row}">¥{{ row.price }}</template>
        </el-table-column>
        <el-table-column prop="duration" label="时长(天)" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{row}">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deletePackage(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="showDialog" :title="form.id ? '编辑套餐' : '新建套餐'" width="500px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="价格"><el-input-number v-model="form.price" :min="0" style="width:100%" /></el-form-item>
        <el-form-item label="时长(天)"><el-input-number v-model="form.duration" :min="1" style="width:100%" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status"><el-option label="启用" value="active" /><el-option label="停用" value="inactive" /></el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePackage">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const packages = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const form = ref({})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/membership/packages')
    packages.value = res.data?.data || res.data || []
  } catch {}
  loading.value = false
}

function openDialog(row) {
  form.value = row ? { ...row } : { status: 'active' }
  showDialog.value = true
}

async function savePackage() {
  saving.value = true
  try {
    await api.post('/admin/membership/packages', form.value)
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch {}
  saving.value = false
}

async function deletePackage(row) {
  await ElMessageBox.confirm('确定删除该套餐？', '确认')
  try {
    await api.delete(`/admin/membership/packages/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>
