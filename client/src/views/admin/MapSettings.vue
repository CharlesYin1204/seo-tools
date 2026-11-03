<template>
  <div class="map-settings-page">
    <div class="page-header">
      <h3 class="page-title">
        <i class="fas fa-map-marked-alt me-2"></i>
        地图设置
      </h3>
      <p class="page-subtitle text-muted">配置高德地图(AMap) API，支持多组Key轮训管理</p>
    </div>

    <!-- Key组管理区域 -->
    <el-card v-loading="loading" class="card-container" style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header-flex">
          <span><i class="fas fa-layer-group me-1"></i>API Key 组管理</span>
          <el-button type="primary" size="small" @click="openAddDialog">
            <i class="fas fa-plus me-1"></i>添加Key组
          </el-button>
        </div>
      </template>

      <!-- Key组列表 -->
      <el-table :data="keyGroups" style="width: 100%" border stripe size="small">
        <el-table-column label="组名称" prop="group_name" min-width="100">
          <template #default="{ row }">
            <div class="group-name-cell">
              <el-tag v-if="row.is_default" type="success" size="small" effect="dark" style="margin-right: 6px;">默认</el-tag>
              <span>{{ row.group_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="API Key" min-width="180">
          <template #default="{ row }">
            <span class="key-mask">{{ maskKey(row.api_key) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="JS API Key" min-width="180">
          <template #default="{ row }">
            <span class="key-mask">{{ maskKey(row.js_api_key) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="安全密钥" min-width="180">
          <template #default="{ row }">
            <span class="key-mask">{{ maskKey(row.security_js_key) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="70" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.is_enabled" size="small" @change="toggleGroupEnabled(row)" />
          </template>
        </el-table-column>
        <el-table-column label="今日用量" width="100" align="center">
          <template #default="{ row }">
            <span>{{ row.used_count || 0 }}</span>
            <span v-if="row.daily_limit > 0" class="text-muted"> / {{ row.daily_limit }}</span>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="70" align="center" prop="sort_order" />
        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" type="primary" plain @click="openEditDialog(row)">
                <i class="fas fa-edit"></i>
              </el-button>
              <el-button size="small" type="warning" plain :loading="row._checking" @click="checkKeyGroup(row)">
                <i class="fas fa-stethoscope"></i>
              </el-button>
              <el-button v-if="!row.is_default" size="small" type="success" plain @click="setDefault(row)">
                <i class="fas fa-star"></i>
              </el-button>
              <el-button v-if="!row.is_default" size="small" type="danger" plain @click="deleteGroup(row)">
                <i class="fas fa-trash"></i>
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 检测结果展示 -->
      <div v-if="checkResult" class="check-result-panel" style="margin-top: 16px;">
        <el-alert :title="'检测结果: ' + (checkResult.group_name || '')" :type="checkResult.status === 'normal' ? 'success' : checkResult.status === 'limited' ? 'warning' : 'error'" show-icon :closable="true" @close="checkResult = null">
          <template #default>
            <div class="check-detail">
              <div v-if="checkResult.details?.api_key_status">
                <strong>API Key: </strong>
                <el-tag :type="checkResult.details.api_key_status.valid ? 'success' : 'danger'" size="small">
                  {{ checkResult.details.api_key_status.valid ? '正常' : '异常' }}
                </el-tag>
                <span class="text-muted ms-1">{{ checkResult.details.api_key_status.info }} ({{ checkResult.details.api_key_status.infocode }})</span>
              </div>
              <div v-if="checkResult.details?.js_api_key_status" style="margin-top: 4px;">
                <strong>JS API Key: </strong>
                <el-tag :type="checkResult.details.js_api_key_status.valid ? 'success' : 'danger'" size="small">
                  {{ checkResult.details.js_api_key_status.valid ? '正常' : '异常' }}
                </el-tag>
                <span class="text-muted ms-1">{{ checkResult.details.js_api_key_status.info }} ({{ checkResult.details.js_api_key_status.infocode }})</span>
              </div>
              <div class="text-muted" style="margin-top: 4px; font-size: 12px;">
                检测时间: {{ checkResult.details?.checked_at }}
              </div>
            </div>
          </template>
        </el-alert>
      </div>
    </el-card>

    <!-- 轮训配置与地图基础设置 -->
    <el-card v-loading="loading" class="card-container">
      <el-form :model="form" label-position="top" class="map-settings-form">

        <!-- 轮训模式 -->
        <el-divider content-position="left">
          <i class="fas fa-sync-alt me-1"></i>轮训规则
        </el-divider>

        <el-form-item label="轮训模式">
          <template #label>
            <span><i class="fas fa-random text-primary me-1"></i>轮训模式</span>
          </template>
          <el-radio-group v-model="form.rotation_mode">
            <el-radio-button value="default_first">优先默认组</el-radio-button>
            <el-radio-button value="round_robin">顺序轮训</el-radio-button>
            <el-radio-button value="random">随机选取</el-radio-button>
            <el-radio-button value="failover">故障转移</el-radio-button>
          </el-radio-group>
          <div class="form-hint">
            <template v-if="form.rotation_mode === 'default_first'">优先使用默认组，默认组不可用时自动切换到下一个可用组</template>
            <template v-else-if="form.rotation_mode === 'round_robin'">按排序顺序依次使用各个启用的Key组，均匀分配请求</template>
            <template v-else-if="form.rotation_mode === 'random'">从所有可用的Key组中随机选取一个使用</template>
            <template v-else-if="form.rotation_mode === 'failover'">使用默认组，仅在默认组限额/出错时切换到备用组</template>
          </div>
        </el-form-item>

        <el-divider content-position="left">
          <i class="fas fa-map me-1"></i>默认地图中心
        </el-divider>

        <el-form-item label="默认中心纬度">
          <el-input-number
            v-model="form.default_lat"
            :precision="4"
            :step="0.0001"
            :min="-90"
            :max="90"
            placeholder="31.2304"
            controls-position="right"
            style="width: 100%"
          />
          <div class="form-hint">上海市中心约 31.2304</div>
        </el-form-item>

        <el-form-item label="默认中心经度">
          <el-input-number
            v-model="form.default_lng"
            :precision="4"
            :step="0.0001"
            :min="-180"
            :max="180"
            placeholder="121.4737"
            controls-position="right"
            style="width: 100%"
          />
          <div class="form-hint">上海市中心约 121.4737</div>
        </el-form-item>

        <el-form-item label="默认缩放级别">
          <el-input-number
            v-model="form.default_zoom"
            :min="1"
            :max="18"
            :step="1"
            placeholder="12"
            controls-position="right"
            style="width: 100%"
          />
          <div class="form-hint">缩放级别 1-18，数值越大放大程度越高</div>
        </el-form-item>

        <el-divider />

        <el-form-item label="是否启用地图">
          <template #label>
            <span><i class="fas fa-toggle-on text-info me-1"></i>是否启用地图</span>
          </template>
          <el-switch
            v-model="form.enabled"
            active-text="启用"
            inactive-text="关闭"
            inline-prompt
          />
          <div class="form-hint">启用后，网站将显示地图搜索功能</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveSettings">
            <i class="fas fa-save me-1"></i>
            保存设置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Key组编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingGroup.id ? '编辑Key组' : '添加Key组'"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form :model="editingGroup" label-position="top">
        <el-form-item label="组名称" required>
          <el-input v-model="editingGroup.group_name" placeholder="例如：主账号Key、备用Key" maxlength="100" show-word-limit clearable />
        </el-form-item>

        <el-form-item required>
          <template #label>
            <span><i class="fas fa-key text-primary me-1"></i>API Key（Web服务）</span>
          </template>
          <el-input v-model="editingGroup.api_key" placeholder="用于服务端地理编码等API调用" maxlength="255" clearable />
          <div class="form-hint">高德开放平台 → 我的应用 → Web服务 类型的Key</div>
        </el-form-item>

        <el-form-item required>
          <template #label>
            <span><i class="fas fa-code text-success me-1"></i>JS API Key（Web端）</span>
          </template>
          <el-input v-model="editingGroup.js_api_key" placeholder="用于前端地图显示" maxlength="255" clearable />
          <div class="form-hint">高德开放平台 → 我的应用 → Web端(JS API) 类型的Key</div>
        </el-form-item>

        <el-form-item>
          <template #label>
            <span><i class="fas fa-shield-alt text-warning me-1"></i>安全密钥 JS Key</span>
          </template>
          <el-input v-model="editingGroup.security_js_key" placeholder="JS API安全密钥（可选）" maxlength="255" clearable />
          <div class="form-hint">可选的安全密钥，生产环境建议配置</div>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="每日限额">
              <el-input-number v-model="editingGroup.daily_limit" :min="0" :step="1000" placeholder="0=不限" controls-position="right" style="width: 100%" />
              <div class="form-hint">0 表示不限额，高德免费额度通常5000次/天</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序权重">
              <el-input-number v-model="editingGroup.sort_order" :min="0" :max="999" controls-position="right" style="width: 100%" />
              <div class="form-hint">数值越小越优先</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="设为默认组">
              <el-switch v-model="editingGroup.is_default" active-text="是" inactive-text="否" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="启用">
              <el-switch v-model="editingGroup.is_enabled" active-text="启用" inactive-text="禁用" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSaving" @click="saveKeyGroup">
          <i class="fas fa-check me-1"></i>确定保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const dialogSaving = ref(false)
const checkResult = ref(null)

const form = reactive({
  default_lat: 31.2304,
  default_lng: 121.4737,
  default_zoom: 12,
  enabled: true,
  rotation_mode: 'default_first',
})

const keyGroups = ref([])

const editingGroup = reactive({
  id: null,
  group_name: '',
  api_key: '',
  js_api_key: '',
  security_js_key: '',
  is_default: false,
  is_enabled: true,
  daily_limit: 0,
  sort_order: 0,
})

function maskKey(key) {
  if (!key) return '—'
  if (key.length <= 8) return key
  return key.substring(0, 6) + '****' + key.substring(key.length - 4)
}

function statusTagType(status) {
  const map = { normal: 'success', limited: 'warning', error: 'danger' }
  return map[status] || 'info'
}

function statusLabel(status) {
  const map = { normal: '正常', limited: '限流', error: '异常' }
  return map[status] || '未知'
}

async function loadSettings() {
  loading.value = true
  try {
    const res = await api.get('/admin/expatshome/map-settings')
    const data = res.data || {}
    const s = data.settings || data

    Object.assign(form, {
      default_lat: parseFloat(s.default_lat ?? s.default_center_lat ?? 31.2304) || 31.2304,
      default_lng: parseFloat(s.default_lng ?? s.default_center_lng ?? 121.4737) || 121.4737,
      default_zoom: Math.min(18, Math.max(1, parseInt(s.default_zoom, 10) || 12)),
      enabled:
        s.enabled !== undefined
          ? !!s.enabled
          : s.map_enabled !== undefined
            ? !!s.map_enabled
            : s.is_enabled !== undefined
              ? !!parseInt(s.is_enabled, 10)
              : true,
      rotation_mode: s.rotation_mode || 'default_first',
    })

    if (data.key_groups) {
      keyGroups.value = data.key_groups.map(g => ({ ...g, _checking: false }))
    }
  } catch (err) {
    ElMessage.error(err?.message || '加载设置失败')
    console.error('[MapSettings] loadSettings error:', err)
  } finally {
    loading.value = false
  }
}

function toPayload() {
  return [
    { key: 'default_lat', value: String(form.default_lat ?? 31.2304) },
    { key: 'default_lng', value: String(form.default_lng ?? 121.4737) },
    { key: 'default_zoom', value: String(form.default_zoom ?? 12) },
    { key: 'enabled', value: form.enabled ? '1' : '0' },
    { key: 'rotation_mode', value: form.rotation_mode || 'default_first' },
  ]
}

async function saveSettings() {
  saving.value = true
  try {
    await api.post('/admin/expatshome/map-settings', { settings: toPayload() })
    ElMessage.success('保存成功')
  } catch (err) {
    ElMessage.error(err?.message || '保存失败')
    console.error('[MapSettings] saveSettings error:', err)
  } finally {
    saving.value = false
  }
}

function openAddDialog() {
  Object.assign(editingGroup, {
    id: null,
    group_name: '',
    api_key: '',
    js_api_key: '',
    security_js_key: '',
    is_default: false,
    is_enabled: true,
    daily_limit: 0,
    sort_order: keyGroups.value.length,
  })
  dialogVisible.value = true
}

function openEditDialog(row) {
  Object.assign(editingGroup, {
    id: row.id,
    group_name: row.group_name,
    api_key: row.api_key,
    js_api_key: row.js_api_key,
    security_js_key: row.security_js_key,
    is_default: row.is_default,
    is_enabled: row.is_enabled,
    daily_limit: row.daily_limit || 0,
    sort_order: row.sort_order || 0,
  })
  dialogVisible.value = true
}

async function saveKeyGroup() {
  if (!editingGroup.group_name?.trim()) {
    ElMessage.warning('请填写组名称')
    return
  }
  if (!editingGroup.api_key && !editingGroup.js_api_key) {
    ElMessage.warning('至少填写一个API Key')
    return
  }
  dialogSaving.value = true
  try {
    await api.post('/admin/expatshome/map-key-groups', { ...editingGroup })
    ElMessage.success(editingGroup.id ? '更新成功' : '添加成功')
    dialogVisible.value = false
    await loadSettings()
  } catch (err) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    dialogSaving.value = false
  }
}

async function deleteGroup(row) {
  try {
    await ElMessageBox.confirm(`确定要删除Key组「${row.group_name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await api.delete(`/admin/expatshome/map-key-groups/${row.id}`)
    ElMessage.success('删除成功')
    await loadSettings()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err?.message || '删除失败')
    }
  }
}

async function setDefault(row) {
  try {
    await api.post(`/admin/expatshome/map-key-groups/${row.id}/set-default`)
    ElMessage.success(`已将「${row.group_name}」设为默认组`)
    await loadSettings()
  } catch (err) {
    ElMessage.error(err?.message || '设置失败')
  }
}

async function toggleGroupEnabled(row) {
  try {
    await api.post('/admin/expatshome/map-key-groups', {
      id: row.id,
      group_name: row.group_name,
      api_key: row.api_key,
      js_api_key: row.js_api_key,
      security_js_key: row.security_js_key,
      is_default: row.is_default,
      is_enabled: row.is_enabled,
      daily_limit: row.daily_limit,
      sort_order: row.sort_order,
    })
    ElMessage.success(row.is_enabled ? '已启用' : '已禁用')
  } catch (err) {
    ElMessage.error(err?.message || '操作失败')
    row.is_enabled = !row.is_enabled
  }
}

async function checkKeyGroup(row) {
  row._checking = true
  checkResult.value = null
  try {
    const res = await api.post(`/admin/expatshome/map-key-groups/${row.id}/check`)
    const data = res.data || res
    checkResult.value = {
      group_name: row.group_name,
      status: data.status,
      details: data.details,
    }
    await loadSettings()
  } catch (err) {
    ElMessage.error(err?.message || '检测失败')
  } finally {
    row._checking = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.map-settings-page {
  padding: 0;
}

.page-subtitle {
  font-size: 14px;
  margin-top: 4px;
  margin-bottom: 0;
}

/* 卡片容器 - 规范编号 CARD-001 */
.card-container {
  padding: var(--space-md, 16px);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: var(--background-light, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
}

.map-settings-form {
  max-width: 700px;
}

.form-hint {
  color: var(--text-secondary, #666);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}

.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-name-cell {
  display: flex;
  align-items: center;
}

.key-mask {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #666;
  word-break: break-all;
}

.check-detail {
  font-size: 13px;
  line-height: 1.6;
}

.text-primary {
  color: var(--primary-color, #2f80ed);
}

.text-success {
  color: var(--secondary-color, #27ae60);
}

.text-warning {
  color: #f59e0b;
}

.text-info {
  color: #0ea5e9;
}

.text-muted {
  color: var(--text-secondary, #666);
}

.me-1 {
  margin-right: 4px;
}

.me-2 {
  margin-right: 8px;
}

.ms-1 {
  margin-left: 4px;
}
</style>
