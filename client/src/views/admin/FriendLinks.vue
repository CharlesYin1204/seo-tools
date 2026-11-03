<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">友情链接管理</h3>
      <el-button type="primary" @click="openDialog()">新增链接</el-button>
    </div>
    <div class="card-container">
      <el-table :data="links" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="url" label="链接地址" min-width="250" show-overflow-tooltip>
          <template #default="{ row }">
            <a :href="row.url" target="_blank" rel="noopener">{{ row.url }}</a>
          </template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="showDialog" :title="form.id ? '编辑链接' : '新增链接'" width="500px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="链接名称" /></el-form-item>
        <el-form-item label="URL"><el-input v-model="form.url" placeholder="https://..." /></el-form-item>
        <el-form-item label="Logo"><el-input v-model="form.logo_url" placeholder="Logo图片地址（可选）" /></el-form-item>
        <el-form-item label="排序"><el-input v-model="form.sort_order" type="number" placeholder="数字越小越靠前" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveLink">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const links = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const form = ref({})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/friend-links')
    links.value = res.data || []
  } catch {}
  loading.value = false
}

function openDialog(row) {
  form.value = row ? { ...row } : { status: 'active', sort_order: 0 }
  showDialog.value = true
}

async function saveLink() {
  saving.value = true
  try {
    if (form.value.id) {
      await api.put(`/admin/friend-links/${form.value.id}`, form.value)
    } else {
      await api.post('/admin/friend-links', form.value)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch {}
  saving.value = false
}

async function handleDelete(row) {
  await ElMessageBox.confirm('确定删除该友情链接？', '确认')
  try {
    await api.delete(`/admin/friend-links/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>

<style scoped>
.page-container { padding: 20px; }
</style>
