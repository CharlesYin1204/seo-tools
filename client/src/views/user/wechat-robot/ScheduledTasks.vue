<template>
  <div class="tasks-page">
    <div class="toolbar">
      <select v-model="selectedRobotId" class="robot-select" @change="onRobotChange">
        <option value="">选择微信账号</option>
        <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
      </select>
      <button class="btn-add" @click="openAddDialog"><i class="fas fa-plus"></i> 创建任务</button>
    </div>

    <div v-if="loading" class="loading-state"><i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i></div>
    <div v-else-if="!tasks.length" class="empty-state">
      <i class="fas fa-clock fa-3x" style="color:#ddd;"></i>
      <p>{{ selectedRobotId ? '暂无定时任务' : '请选择微信账号' }}</p>
    </div>

    <div v-else class="task-list">
      <div v-for="task in tasks" :key="task.id" class="task-card">
        <div class="task-header">
          <div class="task-title">
            <span class="task-name">{{ task.name || '定时发送任务' }}</span>
            <span :class="['status-badge', task.is_enabled ? 'active' : 'inactive']">{{ task.is_enabled ? '已启用' : '已停用' }}</span>
          </div>
          <label class="switch">
            <input type="checkbox" :checked="task.is_enabled" @change="toggleTask(task)">
            <span class="slider"></span>
          </label>
        </div>
        <div class="task-body">
          <div class="task-row"><i class="fas fa-users"></i> 发送对象: {{ task.contact_count || '-' }}人</div>
          <div class="task-row"><i class="fas fa-clock"></i> 发送时间: {{ task.schedule_time || '-' }}</div>
          <div class="task-row"><i class="fas fa-file-alt"></i> 素材: {{ task.material_title || '-' }}</div>
        </div>
        <div class="task-footer">
          <button class="action-btn" @click="viewLogs(task)"><i class="fas fa-list"></i> 日志</button>
          <button class="action-btn danger" @click="deleteTask(task)"><i class="fas fa-trash"></i> 删除</button>
        </div>
      </div>
    </div>

    <!-- 日志弹窗 -->
    <el-dialog v-model="showLogDialog" title="任务日志" width="600px">
      <div v-if="!taskLogs.length" style="text-align:center;color:#ccc;padding:20px;">暂无日志</div>
      <div v-else class="log-list">
        <div v-for="log in taskLogs" :key="log.id" class="log-item">
          <span :class="['log-status', log.status]">{{ log.status === 'success' ? '成功' : '失败' }}</span>
          <span class="log-msg">{{ log.message || '-' }}</span>
          <span class="log-time">{{ log.created_at }}</span>
        </div>
      </div>
    </el-dialog>

    <!-- 创建任务弹窗 -->
    <el-dialog v-model="showAddDialog" title="创建定时任务" width="500px">
      <div class="form-group">
        <label class="form-label">任务名称</label>
        <input v-model="addForm.name" class="form-input" placeholder="任务名称">
      </div>
      <div class="form-group">
        <label class="form-label">发送时间</label>
        <input v-model="addForm.schedule_time" type="datetime-local" class="form-input">
      </div>
      <div class="form-group">
        <label class="form-label">发送内容</label>
        <textarea v-model="addForm.content" class="form-input" rows="3" placeholder="发送内容"></textarea>
      </div>
      <template #footer>
        <button class="btn-cancel" @click="showAddDialog = false">取消</button>
        <button class="btn-save" @click="handleCreate">创建</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { wechatRobotApi } from '@/api/modules/wechatRobot'

const selectedRobotId = ref('')
const robots = ref([])
const tasks = ref([])
const loading = ref(false)
const showLogDialog = ref(false)
const showAddDialog = ref(false)
const taskLogs = ref([])
const addForm = reactive({ name: '', schedule_time: '', content: '' })

async function loadRobots() {
  try {
    const res = await wechatRobotApi.getAccounts()
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) selectedRobotId.value = robots.value[0].id
  } catch { robots.value = [] }
}

function onRobotChange() { loadTasks() }

async function loadTasks() {
  if (!selectedRobotId.value) { tasks.value = []; return }
  loading.value = true
  try {
    const res = await wechatRobotApi.getScheduledTasks(selectedRobotId.value, {})
    tasks.value = res?.data?.data || res?.data || []
    if (!Array.isArray(tasks.value)) tasks.value = []
  } catch { tasks.value = [] }
  loading.value = false
}

function openAddDialog() {
  Object.assign(addForm, { name: '', schedule_time: '', content: '' })
  showAddDialog.value = true
}

async function handleCreate() {
  if (!selectedRobotId.value) return
  try {
    await wechatRobotApi.saveScheduledTask(selectedRobotId.value, addForm)
    ElMessage.success('创建成功')
    showAddDialog.value = false
    loadTasks()
  } catch (err) { ElMessage.error(err?.response?.data?.message || '创建失败') }
}

function toggleTask(task) {
  wechatRobotApi.saveScheduledTask(selectedRobotId.value, { ...task, is_enabled: !task.is_enabled })
    .then(() => { task.is_enabled = !task.is_enabled })
    .catch(() => ElMessage.error('操作失败'))
}

async function deleteTask(task) {
  try {
    await ElMessageBox.confirm('确定删除该任务吗？', '提示', { type: 'warning' })
    await wechatRobotApi.deleteScheduledTask(selectedRobotId.value, task.id)
    ElMessage.success('删除成功')
    loadTasks()
  } catch {}
}

async function viewLogs(task) {
  try {
    const res = await wechatRobotApi.getTaskLogs(selectedRobotId.value, task.id)
    taskLogs.value = res?.data?.data || res?.data || []
    if (!Array.isArray(taskLogs.value)) taskLogs.value = []
    showLogDialog.value = true
  } catch { taskLogs.value = []; showLogDialog.value = true }
}

onMounted(() => loadRobots().then(loadTasks))
</script>

<style scoped>
.tasks-page { max-width: 900px; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.robot-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; min-width: 160px; }
.btn-add { background: #07C160; border: none; color: #fff; border-radius: 10px; padding: 8px 18px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.loading-state, .empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888; }
.empty-state p { margin-top: 16px; }

.task-list { display: flex; flex-direction: column; gap: 12px; }
.task-card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.task-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
.task-title { display: flex; align-items: center; gap: 10px; }
.task-name { font-weight: 600; font-size: 0.95rem; }
.status-badge { padding: 3px 10px; border-radius: 10px; font-size: 0.72rem; font-weight: 500; }
.status-badge.active { background: rgba(7,193,96,0.1); color: #07C160; }
.status-badge.inactive { background: rgba(136,136,136,0.1); color: #888; }
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 24px; transition: 0.3s; }
.slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
input:checked + .slider { background: #07C160; }
input:checked + .slider:before { transform: translateX(20px); }

.task-body { padding: 16px 20px; }
.task-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.88rem; color: #555; }
.task-row:last-child { margin-bottom: 0; }
.task-row i { color: #888; width: 16px; text-align: center; }
.task-footer { display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid #f0f0f0; }
.action-btn { background: none; border: 1px solid #ddd; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; color: #666; display: flex; align-items: center; gap: 4px; }
.action-btn:hover { border-color: #07C160; color: #07C160; }
.action-btn.danger:hover { border-color: #E53935; color: #E53935; }

.log-list { max-height: 400px; overflow-y: auto; }
.log-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 0.85rem; }
.log-status { padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 500; }
.log-status.success { background: rgba(7,193,96,0.1); color: #07C160; }
.log-status.failed { background: rgba(229,57,53,0.1); color: #E53935; }
.log-msg { flex: 1; color: #555; }
.log-time { color: #bbb; font-size: 0.78rem; }

.form-group { margin-bottom: 16px; }
.form-label { display: block; font-weight: 600; font-size: 0.88rem; margin-bottom: 6px; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.88rem; outline: none; box-sizing: border-box; }
textarea.form-input { resize: none; }
.btn-cancel { background: #f5f5f5; border: 1px solid #ddd; color: #666; padding: 8px 18px; border-radius: 8px; cursor: pointer; margin-right: 8px; }
.btn-save { background: #07C160; border: none; color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; }
</style>
