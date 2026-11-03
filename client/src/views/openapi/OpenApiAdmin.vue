<template>
  <div class="open-api-admin">
    <header class="topbar">
      <div>
        <h1>开放 API 后台</h1>
        <p>独立管理外部网站接入朋友圈房源解析数据的接口权限、密钥和调用日志。</p>
      </div>
      <div class="actions">
        <el-button :icon="Refresh" @click="loadAll">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增应用</el-button>
      </div>
    </header>

    <section class="stats">
      <div class="stat">
        <span>接入应用</span>
        <strong>{{ apps.length }}</strong>
      </div>
      <div class="stat">
        <span>今日调用</span>
        <strong>{{ todayCalls }}</strong>
      </div>
      <div class="stat">
        <span>接口地址</span>
        <code>{{ apiBaseUrl }}</code>
      </div>
    </section>

    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="应用管理" name="apps">
        <el-table v-loading="loading" :data="apps" border>
          <el-table-column prop="app_name" label="应用名称" min-width="160" />
          <el-table-column prop="app_id" label="App ID" min-width="220">
            <template #default="{ row }">
              <code>{{ row.app_id }}</code>
            </template>
          </el-table-column>
          <el-table-column label="密钥前缀" width="120">
            <template #default="{ row }">
              <code>{{ row.key_prefix || '-' }}</code>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.is_enabled ? 'success' : 'info'">
                {{ row.is_enabled ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="rate_limit_per_minute" label="每分钟" width="90" />
          <el-table-column prop="daily_limit" label="每日上限" width="100" />
          <el-table-column prop="today_calls" label="今日调用" width="100" />
          <el-table-column prop="last_used_at" label="最近调用" width="170" />
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" type="warning" plain @click="resetKey(row)">重置密钥</el-button>
              <el-button size="small" :type="row.is_enabled ? 'danger' : 'success'" plain @click="toggleApp(row)">
                {{ row.is_enabled ? '停用' : '启用' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="调用日志" name="logs">
        <div class="log-filter">
          <el-select v-model="logQuery.app_id" clearable placeholder="全部应用" style="width: 240px" @change="loadLogs">
            <el-option v-for="app in apps" :key="app.id" :label="app.app_name" :value="app.id" />
          </el-select>
          <el-button :icon="Refresh" @click="loadLogs">刷新日志</el-button>
        </div>
        <el-table v-loading="logLoading" :data="logs" border>
          <el-table-column prop="created_at" label="时间" width="170" />
          <el-table-column prop="app_name" label="应用" min-width="140" />
          <el-table-column prop="request_method" label="方法" width="80" />
          <el-table-column prop="request_path" label="接口" min-width="220" />
          <el-table-column prop="response_status" label="状态" width="80" />
          <el-table-column prop="result_count" label="数量" width="80" />
          <el-table-column prop="duration_ms" label="耗时ms" width="90" />
          <el-table-column prop="client_ip" label="IP" width="150" />
          <el-table-column prop="error_message" label="错误" min-width="180" show-overflow-tooltip />
        </el-table>
        <el-pagination
          class="pager"
          background
          layout="prev, pager, next, total"
          :page-size="logQuery.per_page"
          :current-page="logQuery.page"
          :total="logPagination.total"
          @current-change="changeLogPage"
        />
      </el-tab-pane>

      <el-tab-pane label="接口说明" name="docs">
        <section class="docs">
          <h2>外部网站调用方式</h2>
          <p>请求头必须携带 App ID 和 API Key。</p>
          <pre>GET {{ apiBaseUrl }}/v1/moments/properties?page=1&per_page=20
X-App-Id: app_xxx
X-Api-Key: eh_xxx</pre>
          <h2>核心接口</h2>
          <ul>
            <li><code>GET /open-api/v1/health</code> 健康检查</li>
            <li><code>GET /open-api/v1/moments/properties</code> 朋友圈房源列表</li>
            <li><code>GET /open-api/v1/moments/properties/:id</code> 朋友圈房源详情</li>
            <li><code>GET /open-api/v1/moments/filters</code> 筛选项</li>
          </ul>
        </section>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑应用' : '新增应用'" width="760px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="应用名称">
          <el-input v-model="form.app_name" placeholder="例如：合作租房网站" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="用途说明" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="每分钟调用次数">
            <el-input-number v-model="form.rate_limit_per_minute" :min="1" :max="10000" />
          </el-form-item>
          <el-form-item label="每日调用上限">
            <el-input-number v-model="form.daily_limit" :min="1" :max="10000000" />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="form.is_enabled" active-text="启用" inactive-text="停用" />
          </el-form-item>
        </div>
        <el-form-item label="IP 白名单">
          <el-input v-model="allowedIpText" type="textarea" :rows="3" placeholder="一行一个 IP；留空表示不限 IP" />
        </el-form-item>
        <el-form-item label="接口权限">
          <el-checkbox-group v-model="form.permissions">
            <el-checkbox v-for="item in meta.permissions" :key="item.value" :label="item.value">
              {{ item.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="允许返回字段">
          <div class="field-tools">
            <el-button size="small" @click="form.allowed_fields = meta.fields.slice()">全选</el-button>
            <el-button size="small" @click="form.allowed_fields = meta.fields.filter(f => !meta.sensitive_fields.includes(f))">排除敏感字段</el-button>
          </div>
          <el-checkbox-group v-model="form.allowed_fields" class="field-grid">
            <el-checkbox v-for="field in meta.fields" :key="field" :label="field">
              {{ field }}<span v-if="meta.sensitive_fields.includes(field)" class="sensitive">敏感</span>
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveApp">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="keyDialogVisible" title="请立即保存 API Key" width="620px">
      <p class="key-warning">API Key 只在本次显示，关闭后无法再次查看。如遗失可重新生成。</p>
      <el-input v-model="newKeyInfo.app_id" readonly>
        <template #prepend>App ID</template>
      </el-input>
      <el-input v-model="newKeyInfo.api_key" readonly class="key-input">
        <template #prepend>API Key</template>
      </el-input>
      <template #footer>
        <el-button type="primary" @click="keyDialogVisible = false">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import api from '@/api'

const activeTab = ref('apps')
const loading = ref(false)
const logLoading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const keyDialogVisible = ref(false)
const editingId = ref(null)
const apps = ref([])
const logs = ref([])
const meta = reactive({ fields: [], sensitive_fields: [], permissions: [] })
const allowedIpText = ref('')
const newKeyInfo = reactive({ app_id: '', api_key: '' })
const logQuery = reactive({ page: 1, per_page: 20, app_id: '' })
const logPagination = reactive({ total: 0 })

const apiBaseUrl = computed(() => `${window.location.origin}/open-api`)
const todayCalls = computed(() => apps.value.reduce((sum, app) => sum + Number(app.today_calls || 0), 0))

const defaultForm = () => ({
  app_name: '',
  description: '',
  allowed_ips: [],
  allowed_fields: meta.fields.slice(),
  permissions: meta.permissions.map(item => item.value),
  rate_limit_per_minute: 60,
  daily_limit: 10000,
  is_enabled: true,
})
const form = reactive(defaultForm())

function resetForm(data = null) {
  Object.assign(form, defaultForm(), data || {})
  form.is_enabled = Boolean(form.is_enabled)
  form.allowed_fields = Array.isArray(form.allowed_fields) ? form.allowed_fields : meta.fields.slice()
  form.permissions = Array.isArray(form.permissions) ? form.permissions : meta.permissions.map(item => item.value)
  allowedIpText.value = Array.isArray(form.allowed_ips) ? form.allowed_ips.join('\n') : ''
}

async function loadMeta() {
  const res = await api.get('/api/open-api-admin/meta')
  Object.assign(meta, res.data || {})
}

async function loadApps() {
  loading.value = true
  try {
    const res = await api.get('/api/open-api-admin/apps')
    apps.value = res.data?.apps || []
  } finally {
    loading.value = false
  }
}

async function loadLogs() {
  logLoading.value = true
  try {
    const res = await api.get('/api/open-api-admin/logs', { params: logQuery })
    const payload = res.data || {}
    logs.value = payload.data || []
    Object.assign(logPagination, payload.pagination || { total: 0 })
  } finally {
    logLoading.value = false
  }
}

async function loadAll() {
  await loadMeta()
  await loadApps()
  await loadLogs()
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  resetForm(row)
  dialogVisible.value = true
}

async function saveApp() {
  if (!form.app_name.trim()) {
    ElMessage.warning('请填写应用名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form,
      allowed_ips: allowedIpText.value.split('\n').map(v => v.trim()).filter(Boolean),
    }
    if (editingId.value) {
      await api.put(`/api/open-api-admin/apps/${editingId.value}`, payload)
      ElMessage.success('已保存')
    } else {
      const res = await api.post('/api/open-api-admin/apps', payload)
      Object.assign(newKeyInfo, res.data || {})
      keyDialogVisible.value = true
      ElMessage.success('应用已创建')
    }
    dialogVisible.value = false
    await loadApps()
  } finally {
    saving.value = false
  }
}

async function resetKey(row) {
  await ElMessageBox.confirm(`确定重置「${row.app_name}」的 API Key 吗？旧密钥会立即失效。`, '重置密钥', { type: 'warning' })
  const res = await api.post(`/api/open-api-admin/apps/${row.id}/reset-key`)
  newKeyInfo.app_id = row.app_id
  newKeyInfo.api_key = res.data?.api_key || ''
  keyDialogVisible.value = true
  await loadApps()
}

async function toggleApp(row) {
  await api.put(`/api/open-api-admin/apps/${row.id}`, { is_enabled: !row.is_enabled })
  ElMessage.success(row.is_enabled ? '已停用' : '已启用')
  await loadApps()
}

function changeLogPage(page) {
  logQuery.page = page
  loadLogs()
}

loadAll()
</script>

<style scoped>
.open-api-admin {
  min-height: 100vh;
  padding: 24px;
  background: #f6f7fb;
  color: #1f2937;
}

.topbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.topbar h1 {
  margin: 0 0 6px;
  font-size: 24px;
  line-height: 1.25;
}

.topbar p {
  margin: 0;
  color: #64748b;
}

.actions {
  display: flex;
  gap: 10px;
}

.stats {
  display: grid;
  grid-template-columns: 180px 180px 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.stat {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px 16px;
}

.stat span {
  display: block;
  color: #64748b;
  font-size: 13px;
  margin-bottom: 8px;
}

.stat strong {
  font-size: 24px;
}

.stat code,
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  color: #334155;
}

.main-tabs {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
}

.log-filter {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.pager {
  margin-top: 14px;
  justify-content: flex-end;
}

.docs {
  max-width: 900px;
  color: #334155;
}

.docs h2 {
  font-size: 16px;
  margin: 14px 0 8px;
}

.docs pre {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  overflow: auto;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.field-tools {
  margin-bottom: 10px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
  width: 100%;
}

.sensitive {
  margin-left: 6px;
  color: #dc2626;
  font-size: 12px;
}

.key-warning {
  color: #b45309;
  margin-top: 0;
}

.key-input {
  margin-top: 10px;
}

@media (max-width: 860px) {
  .topbar {
    flex-direction: column;
  }

  .stats,
  .form-grid,
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
