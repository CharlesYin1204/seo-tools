<template>
  <div>
    <div class="page-header"><h3 class="page-title">内容资产采集管理</h3></div>
    <el-tabs v-model="activeTab" type="card">
      <!-- 采集源管理 -->
      <el-tab-pane label="采集源" name="sources">
        <div class="card-container">
          <div class="mb-3 d-flex justify-content-between align-items-center">
            <span class="fw-bold">采集源列表</span>
            <el-button type="primary" @click="openSourceDialog()">新增采集源</el-button>
          </div>
          <el-table :data="sources" stripe v-loading="loadingSources">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="name" label="采集源名称" min-width="150" />
            <el-table-column prop="url" label="源地址" min-width="250" show-overflow-tooltip>
              <template #default="{ row }">
                <a :href="row.url" target="_blank" rel="noopener">{{ row.url }}</a>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button size="small" type="success" @click="startScrape(row)" :loading="row._scraping">采集</el-button>
                <el-button size="small" @click="openSourceDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteSource(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
      <!-- 采集任务 -->
      <el-tab-pane label="采集任务" name="tasks">
        <div class="card-container">
          <div class="mb-3 d-flex justify-content-between align-items-center">
            <span class="fw-bold">任务历史记录</span>
            <el-button @click="loadTasks">刷新</el-button>
          </div>
          <el-table :data="tasks" stripe v-loading="loadingTasks">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="source_name" label="采集源" width="150" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="taskStatusType(row.status)">{{ taskStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="total_count" label="采集数量" width="100" />
            <el-table-column prop="success_count" label="成功数" width="100" />
            <el-table-column prop="fail_count" label="失败数" width="100" />
            <el-table-column prop="started_at" label="开始时间" width="160" />
            <el-table-column prop="finished_at" label="完成时间" width="160" />
          </el-table>
          <el-empty v-if="!tasks.length && !loadingTasks" description="暂无采集任务" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑采集源对话框 -->
    <el-dialog v-model="showSourceDialog" :title="sourceForm.id ? '编辑采集源' : '新增采集源'" width="550px" destroy-on-close>
      <el-form :model="sourceForm" label-width="100px">
        <el-form-item label="采集源名称"><el-input v-model="sourceForm.name" placeholder="如：58同城、链家" /></el-form-item>
        <el-form-item label="源地址"><el-input v-model="sourceForm.url" placeholder="https://..." /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="sourceForm.type" style="width:100%">
            <el-option label="网页爬取" value="web" />
            <el-option label="API接口" value="api" />
            <el-option label="RSS订阅" value="rss" />
          </el-select>
        </el-form-item>
        <el-form-item label="采集规则">
          <el-input v-model="sourceForm.rules_json" type="textarea" :rows="4" placeholder='CSS选择器或JSON配置' />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="sourceForm.status" style="width:100%">
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSourceDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingSource" @click="saveSource">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('sources')
const sources = ref([])
const tasks = ref([])
const loadingSources = ref(false)
const loadingTasks = ref(false)
const savingSource = ref(false)
const showSourceDialog = ref(false)
const sourceForm = ref({})

const taskStatusType = (s) => ({ running: 'warning', completed: 'success', failed: 'danger', queued: 'info' }[s] || '')
const taskStatusLabel = (s) => ({ running: '运行中', completed: '已完成', failed: '失败', queued: '排队中' }[s] || s)

onMounted(() => {
  loadSources()
  loadTasks()
})

async function loadSources() {
  loadingSources.value = true
  try {
    const res = await api.get('/admin/property-scraper/sources')
    sources.value = (res.data || []).map(s => ({ ...s, _scraping: false }))
  } catch {}
  loadingSources.value = false
}

async function loadTasks() {
  loadingTasks.value = true
  try {
    const res = await api.get('/admin/property-scraper/tasks')
    tasks.value = res.data || []
  } catch {}
  loadingTasks.value = false
}

function openSourceDialog(row) {
  sourceForm.value = row ? { ...row } : { status: 'active', type: 'web' }
  showSourceDialog.value = true
}

async function saveSource() {
  savingSource.value = true
  try {
    if (sourceForm.value.id) {
      await api.put(`/admin/property-scraper/sources/${sourceForm.value.id}`, sourceForm.value)
    } else {
      await api.post('/admin/property-scraper/sources', sourceForm.value)
    }
    ElMessage.success('保存成功')
    showSourceDialog.value = false
    loadSources()
  } catch {}
  savingSource.value = false
}

async function deleteSource(row) {
  await ElMessageBox.confirm('确定删除该采集源？', '确认')
  try {
    await api.delete(`/admin/property-scraper/sources/${row.id}`)
    ElMessage.success('删除成功')
    loadSources()
  } catch {}
}

async function startScrape(row) {
  row._scraping = true
  try {
    await api.post('/admin/property-scraper/start', { source_id: row.id })
    ElMessage.success('采集任务已启动')
    loadTasks()
  } catch {}
  row._scraping = false
}
</script>

<style scoped>
.page-container { padding: 20px; }
</style>
