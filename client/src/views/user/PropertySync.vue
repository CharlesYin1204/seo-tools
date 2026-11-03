<template>
  <div class="property-sync-page">
    <div class="page-header">
      <h1 class="page-title">
        <i class="fas fa-sync-alt me-2"></i>朋友圈同步内容资产
      </h1>
      <div class="page-actions">
        <el-select
          v-model="selectedRobotId"
          placeholder="选择机器人账号"
          clearable
          class="me-2"
          style="width: 200px"
          @change="loadTasks"
        >
          <el-option
            v-for="r in robots"
            :key="r.id || r.robot_id"
            :label="r.nickname || r.wxid || '未命名'"
            :value="r.id || r.robot_id"
          />
        </el-select>
        <el-button type="primary" :disabled="!selectedRobotId" @click="showAddDialog = true">
          <i class="fas fa-plus me-1"></i>新建同步任务
        </el-button>
      </div>
    </div>

    <el-card v-loading="loading" element-loading-text="加载中..." class="card-container">
      <el-table :data="tasks" stripe>
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column label="机器人名称" width="140">
          <template #default="{ row }">
            {{ getRobotName(row.robot_id) }}
          </template>
        </el-table-column>
        <el-table-column prop="sync_interval" label="同步间隔" width="120">
          <template #default="{ row }">
            {{ row.sync_interval || '-' }}{{ (row.sync_interval_unit || 'minutes') === 'minutes' ? '分钟' : '小时' }}
          </template>
        </el-table-column>
        <el-table-column prop="last_sync_at" label="上次同步时间" width="180">
          <template #default="{ row }">
            {{ row.last_sync_at || '从未' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'on' || row.enabled ? 'success' : 'info'" size="small">
              {{ row.status === 'on' || row.enabled ? '开启' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="toggleStatus(row)">
              {{ row.status === 'on' || row.enabled ? '关闭' : '开启' }}
            </el-button>
            <el-button link type="primary" size="small" @click="runSync(row)">立即同步</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && !tasks.length" class="empty-state">
        <i class="fas fa-sync-alt empty-icon"></i>
        <p class="empty-text">{{ selectedRobotId ? '暂无同步任务，请点击上方按钮新建' : '请先选择机器人账号' }}</p>
      </div>
    </el-card>

    <!-- 新建同步任务弹窗 -->
    <el-dialog v-model="showAddDialog" title="新建同步任务" width="500px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="机器人账号" prop="robot_id">
          <el-select v-model="form.robot_id" placeholder="选择机器人" style="width: 100%">
            <el-option v-for="r in robots" :key="r.id || r.robot_id" :label="r.nickname || r.wxid" :value="r.id || r.robot_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="同步间隔" prop="sync_interval">
          <el-input-number v-model="form.sync_interval" :min="1" :max="1440" placeholder="分钟" style="width: 100%" />
          <span class="ms-2 text-muted">分钟</span>
        </el-form-item>
        <el-form-item label="目标群组" prop="target_groups">
          <el-select v-model="form.target_groups" multiple collapse-tags placeholder="选择要同步到的群组" style="width: 100%">
            <el-option v-for="g in groups" :key="g.wxid || g.id" :label="g.name" :value="g.wxid || g.id" />
          </el-select>
          <div class="text-muted small mt-1">留空则同步到默认群组</div>
        </el-form-item>
        <el-form-item label="自动发布" prop="auto_publish">
          <el-switch v-model="form.auto_publish" />
          <span class="ms-2 text-muted">同步后自动发布到朋友圈</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import { wechatRobotApi } from '@/api/modules/wechatRobot'

const loading = ref(false)
const saving = ref(false)
const showAddDialog = ref(false)
const selectedRobotId = ref(null)
const robots = ref([])
const tasks = ref([])
const groups = ref([])
const formRef = ref(null)

const form = reactive({
  robot_id: null,
  sync_interval: 30,
  target_groups: [],
  auto_publish: true,
})

const formRules = {
  robot_id: [{ required: true, message: '请选择机器人账号', trigger: 'change' }],
  sync_interval: [{ required: true, message: '请输入同步间隔', trigger: 'blur' }],
}

function getRobotName(robotId) {
  const r = robots.value.find((x) => (x.id || x.robot_id) === robotId)
  return r?.nickname || r?.wxid || robotId || '-'
}

async function loadRobots() {
  try {
    const res = await wechatRobotApi.getAccounts()
    robots.value = res.data || []
    if (robots.value.length && !selectedRobotId.value) {
      selectedRobotId.value = robots.value[0].id || robots.value[0].robot_id
    }
  } catch (err) {
    console.error('[PropertySync] 加载机器人列表失败:', err)
    robots.value = []
    ElMessage.error('加载机器人列表失败')
  }
}

async function loadGroups() {
  if (!selectedRobotId.value) return
  try {
    const res = await wechatRobotApi.getGroups(selectedRobotId.value, { per_page: 500 })
    groups.value = res.data || res.list || []
  } catch {
    groups.value = []
  }
}

async function loadTasks() {
  if (!selectedRobotId.value) {
    tasks.value = []
    return
  }
  loading.value = true
  try {
    const res = await api.get(`/user/wechat-robot/${selectedRobotId.value}/scheduled-tasks`, {
      params: { type: 'property_sync', per_page: 100 },
    })
    const data = res.data
    tasks.value = data?.data ?? data?.list ?? (Array.isArray(data) ? data : [])
  } catch (err) {
    console.error('[PropertySync] 加载任务列表失败:', err)
    tasks.value = []
    ElMessage.error('加载任务列表失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.robot_id = selectedRobotId.value
  form.sync_interval = 30
  form.target_groups = []
  form.auto_publish = true
  formRef.value?.resetFields()
}

async function handleCreate() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await api.post(`/user/wechat-robot/${form.robot_id}/scheduled-tasks`, {
      type: 'property_sync',
      sync_interval: form.sync_interval,
      sync_interval_unit: 'minutes',
      target_groups: form.target_groups,
      auto_publish: form.auto_publish,
      enabled: true,
    })
    ElMessage.success('创建成功')
    showAddDialog.value = false
    loadTasks()
  } catch (err) {
    console.error('[PropertySync] 创建任务失败:', err)
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row) {
  try {
    await api.put(`/user/wechat-robot/${row.robot_id}/scheduled-tasks/${row.id}`, {
      enabled: !(row.status === 'on' || row.enabled),
    })
    ElMessage.success('状态已更新')
    loadTasks()
  } catch (err) {
    console.error('[PropertySync] 更新状态失败:', err)
  }
}

async function runSync(row) {
  try {
    await api.post(`/user/wechat-robot/${row.robot_id}/scheduled-tasks/${row.id}/run`)
    ElMessage.success('已触发同步')
    loadTasks()
  } catch (err) {
    console.error('[PropertySync] 执行同步失败:', err)
    ElMessage.error('执行同步失败')
  }
}

function handleDelete(row) {
  ElMessageBox.confirm('确定删除该同步任务？', '确认', { type: 'warning' })
    .then(async () => {
      try {
        await api.delete(`/user/wechat-robot/${row.robot_id}/scheduled-tasks/${row.id}`)
        ElMessage.success('删除成功')
        loadTasks()
      } catch (err) {
        console.error('[PropertySync] 删除失败:', err)
      }
    })
    .catch(() => {})
}

watch(selectedRobotId, (val) => {
  if (val) loadGroups()
})
watch(showAddDialog, (val) => {
  if (val) {
    form.robot_id = selectedRobotId.value
    loadGroups()
  }
})

onMounted(() => loadRobots().then(() => loadTasks()))
</script>

<style scoped lang="scss">
.property-sync-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
    gap: var(--space-md);
  }
  .page-title {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
  }
  .page-actions {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
  }
  .card-container {
    background: white;
    border-radius: 8px;
    padding: var(--space-lg);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
  .empty-state {
    padding: var(--space-xl);
    text-align: center;
    color: var(--text-secondary);
    .empty-icon {
      font-size: 64px;
      margin-bottom: var(--space-md);
      opacity: 0.5;
    }
    .empty-text {
      margin: 0;
      font-size: 14px;
    }
  }
  .me-1 { margin-right: 4px; }
  .me-2 { margin-right: 8px; }
  .ms-2 { margin-left: 8px; }
  .mt-1 { margin-top: 4px; }
  .text-muted { color: #999; }
  .small { font-size: 12px; }
}
</style>
