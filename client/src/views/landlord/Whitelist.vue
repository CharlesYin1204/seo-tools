<template>
  <div class="landlord-whitelist">
    <div class="page-header">
      <h3 class="page-title"><i class="fas fa-user-check me-2"></i>白名单管理</h3>
      <el-button type="primary" size="small" @click="addDialogVisible = true"><i class="fas fa-plus me-1"></i>添加中介</el-button>
    </div>

    <div class="card-container" v-loading="loading">
      <el-table :data="list" stripe border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="agent_name" label="中介名称" min-width="150" />
        <el-table-column prop="agent_id" label="中介ID" width="100" />
        <el-table-column prop="created_at" label="添加时间" width="180" />
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="danger" @click="removeAgent(row)"><i class="fas fa-trash me-1"></i>移除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </div>

    <!-- 添加中介弹窗 -->
    <el-dialog v-model="addDialogVisible" title="添加中介到白名单" width="400px" destroy-on-close @closed="addForm.agent_id = ''">
      <el-form :model="addForm" label-position="top">
        <el-form-item label="中介ID" required>
          <el-input v-model.number="addForm.agent_id" type="number" placeholder="请输入中介用户ID" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="addAgent">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const addDialogVisible = ref(false)
const addForm = reactive({ agent_id: '' })

onMounted(() => loadList())

async function loadList() {
  loading.value = true
  try {
    const res = await api.get('/landlord/whitelist', {
      params: { page: page.value, pageSize: pageSize.value },
    })
    const data = res.data
    if (Array.isArray(data)) {
      list.value = data
      total.value = data.length < pageSize.value ? (page.value - 1) * pageSize.value + data.length : Math.max(total.value, page.value * pageSize.value + 1)
    } else {
      list.value = data?.list || data?.items || data?.data || []
      total.value = data?.total ?? data?.pagination?.total ?? list.value.length
    }
  } catch (e) {
    console.error('加载白名单失败:', e)
  }
  loading.value = false
}

async function addAgent() {
  if (!addForm.agent_id) return ElMessage.warning('请输入中介ID')
  submitting.value = true
  try {
    await api.post('/landlord/whitelist', { agent_id: addForm.agent_id })
    ElMessage.success('添加成功')
    addDialogVisible.value = false
    await loadList()
  } catch (e) {
    ElMessage.error(e?.message || '添加失败')
  }
  submitting.value = false
}

async function removeAgent(row) {
  try {
    await ElMessageBox.confirm(`确定将「${row.agent_name || '该中介'}」从白名单中移除？`, '确认', { type: 'warning' })
    await api.delete(`/landlord/whitelist/${row.id}`)
    ElMessage.success('已移除')
    await loadList()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '移除失败')
  }
}
</script>

<style scoped>
.landlord-whitelist .page-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.landlord-whitelist .page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
}
.landlord-whitelist .card-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.landlord-whitelist .pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
</style>
