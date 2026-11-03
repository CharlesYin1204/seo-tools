<template>
  <div class="moments-refresh-settings-page">
    <!-- 紫色渐变头部 - 与PHP版一致 -->
    <div class="refresh-header">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h4><i class="fas fa-sync-alt me-2"></i>朋友圈刷新设置</h4>
          <p>设置自动刷新时间段和频率，保持朋友圈数据实时更新</p>
        </div>
        <div>
          <el-select v-model="selectedRobotId" placeholder="选择微信机器人" class="robot-select" @change="onRobotChange">
            <el-option v-for="acc in robots" :key="acc.id" :label="`${acc.nickname || acc.wxid || '未命名账号'} (${acc.status === 'online' ? '在线' : '离线'})`" :value="acc.id" />
            <el-option v-if="!robots.length" label="暂无微信账号" :value="''" disabled />
          </el-select>
        </div>
      </div>
    </div>

    <div class="row">
      <!-- 左侧：刷新设置 -->
      <div class="col-lg-8">
        <!-- 时间段刷新设置 -->
        <div class="content-card">
          <div class="content-header">
            <h5 class="mb-0"><i class="fas fa-clock text-primary me-2"></i>时间段刷新设置</h5>
            <el-button class="btn-outline-purple" size="small" @click="addScheduleItem">
              <i class="fas fa-plus me-1"></i>添加时间段
            </el-button>
          </div>
          <div class="content-body" v-loading="loading">
            <!-- 说明提示 -->
            <div class="info-box">
              <i class="fas fa-info-circle"></i>
              <p>
                <strong>说明：</strong>您可以为不同时间段设置不同的刷新频率。例如：工作时间（8:00-22:00）每10分钟刷新一次，夜间（22:00-6:00）每2小时刷新一次。
                <br>启用自动刷新后，系统将立即刷新一次朋友圈数据，确保搜索内容资产时使用最新数据。
              </p>
            </div>

            <!-- 总开关 -->
            <div class="schedule-item switch-area">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div class="switch-container">
                  <el-switch v-model="isAutoRefresh" active-color="#27AE60" @change="toggleAutoRefresh" />
                  <span class="switch-label">启用自动刷新</span>
                </div>
                <el-button class="btn-purple" :loading="refreshingNow" @click="refreshNow">
                  <i class="fas fa-sync-alt me-1"></i>立即刷新
                </el-button>
              </div>
            </div>

            <!-- 时间段列表 -->
            <div v-for="(item, idx) in scheduleConfig" :key="idx" class="schedule-item" :class="{ active: item.enabled }">
              <div class="schedule-header">
                <div class="schedule-title">
                  <i class="fas fa-clock"></i>
                  <span>时间段 {{ idx + 1 }}</span>
                </div>
                <div class="d-flex align-items-center gap-3">
                  <el-switch v-model="item.enabled" size="small" active-color="#27AE60" />
                  <el-button v-if="idx > 1" type="danger" size="small" plain @click="removeScheduleItem(idx)">
                    <i class="fas fa-trash"></i>
                  </el-button>
                </div>
              </div>
              <div class="time-range-row">
                <span class="time-label">从</span>
                <select v-model.number="item.start_hour" class="time-select">
                  <option v-for="h in 24" :key="h-1" :value="h-1">{{ String(h-1).padStart(2,'0') }}:00</option>
                </select>
                <span class="time-label">到</span>
                <select v-model.number="item.end_hour" class="time-select">
                  <option v-for="h in 24" :key="h-1" :value="h-1">{{ String(h-1).padStart(2,'0') }}:00</option>
                </select>
                <span class="time-label">刷新频率</span>
                <select v-model.number="item.interval_minutes" class="interval-select">
                  <option :value="5">每5分钟</option>
                  <option :value="10">每10分钟</option>
                  <option :value="15">每15分钟</option>
                  <option :value="30">每30分钟</option>
                  <option :value="60">每1小时</option>
                  <option :value="120">每2小时</option>
                  <option :value="180">每3小时</option>
                  <option :value="360">每6小时</option>
                </select>
              </div>
            </div>

            <div class="text-end mt-4">
              <el-button class="btn-purple" :loading="saving" @click="saveScheduleConfig">
                <i class="fas fa-save me-1"></i>保存设置
              </el-button>
            </div>
          </div>
        </div>

        <!-- 刷新日志 -->
        <div class="content-card">
          <div class="content-header">
            <h5 class="mb-0"><i class="fas fa-history text-info me-2"></i>刷新日志</h5>
            <div class="d-flex align-items-center gap-3">
              <div class="d-flex align-items-center gap-2">
                <label class="text-muted" style="font-size: 13px; white-space: nowrap;">每页显示</label>
                <select v-model.number="logsPageSize" class="form-select form-select-sm" style="width: auto;" @change="loadRefreshLogs(1)">
                  <option :value="10">10条</option>
                  <option :value="20">20条</option>
                  <option :value="50">50条</option>
                  <option :value="100">100条</option>
                </select>
              </div>
              <el-button size="small" @click="loadRefreshLogs(logsPage)">
                <i class="fas fa-refresh me-1"></i>刷新
              </el-button>
            </div>
          </div>
          <div class="content-body" style="padding: 0;" v-loading="logsLoading">
            <table class="log-table" v-if="refreshLogs.length">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>获取数量</th>
                  <th>新增数量</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in refreshLogs" :key="log.id">
                  <td>{{ formatTime(log.created_at) }}</td>
                  <td>
                    <span class="log-type" :class="log.refresh_type || log.type || 'auto'">{{ getLogTypeText(log.refresh_type || log.type) }}</span>
                  </td>
                  <td>
                    <span class="log-status" :class="log.status">
                      <i :class="getLogStatusIcon(log.status)"></i>
                      {{ getLogStatusText(log.status) }}
                    </span>
                  </td>
                  <td>{{ log.moments_count || log.total_count || 0 }}</td>
                  <td class="text-success fw-bold">{{ log.new_count || 0 }}</td>
                  <td>{{ log.duration_ms ? `${(log.duration_ms/1000).toFixed(1)}s` : (log.duration ? `${log.duration}s` : '-') }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-state">
              <i class="fas fa-inbox"></i>
              <p>暂无刷新日志</p>
            </div>

            <!-- 分页 -->
            <div v-if="logsTotal > logsPageSize" class="d-flex justify-content-between align-items-center p-3 border-top">
              <div class="text-muted" style="font-size: 13px;">共 {{ logsTotal }} 条记录</div>
              <el-pagination
                v-model:current-page="logsPage"
                :page-size="logsPageSize"
                :total="logsTotal"
                layout="prev, pager, next"
                small
                @current-change="loadRefreshLogs"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：状态面板 -->
      <div class="col-lg-4">
        <!-- 刷新状态 -->
        <div class="content-card">
          <div class="content-header">
            <h5 class="mb-0"><i class="fas fa-info-circle text-success me-2"></i>刷新状态</h5>
          </div>
          <div class="content-body">
            <div class="status-card mb-4">
              <div class="status-icon" :class="isAutoRefresh ? 'active' : 'inactive'">
                <i :class="isAutoRefresh ? 'fas fa-check' : 'fas fa-pause'"></i>
              </div>
              <div class="status-text" :class="isAutoRefresh ? 'active' : 'inactive'">
                {{ isAutoRefresh ? '自动刷新已启用' : '自动刷新已关闭' }}
              </div>
              <div class="status-detail">
                {{ lastRefreshAt ? `上次刷新: ${formatTime(lastRefreshAt)}` : '尚未执行刷新' }}
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label fw-bold">当前账号状态</label>
              <div class="d-flex align-items-center gap-2">
                <template v-if="currentAccount && currentAccount.status === 'online'">
                  <span class="badge bg-success"><i class="fas fa-circle me-1" style="font-size: 8px;"></i>在线</span>
                  <span class="text-muted">{{ currentAccount.nickname || '' }}</span>
                </template>
                <template v-else>
                  <span class="badge bg-secondary"><i class="fas fa-circle me-1" style="font-size: 8px;"></i>离线</span>
                  <span class="text-muted">请先登录微信</span>
                </template>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label fw-bold">下次预计刷新</label>
              <div class="text-muted">
                {{ isAutoRefresh && nextRefreshAt ? formatTime(nextRefreshAt) : '--' }}
              </div>
            </div>

            <hr>

            <div class="mb-3">
              <label class="form-label fw-bold">统计信息</label>
              <div class="row text-center">
                <div class="col-6">
                  <div class="h4 mb-0 text-primary">{{ stats.today_refresh_count || 0 }}</div>
                  <small class="text-muted">今日刷新次数</small>
                </div>
                <div class="col-6">
                  <div class="h4 mb-0 text-success">{{ stats.today_new_moments || 0 }}</div>
                  <small class="text-muted">今日新增动态</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 使用提示 -->
        <div class="content-card">
          <div class="content-header">
            <h5 class="mb-0"><i class="fas fa-lightbulb text-warning me-2"></i>使用提示</h5>
          </div>
          <div class="content-body">
            <ul class="tips-list">
              <li><i class="fas fa-check text-success me-2"></i>启用自动刷新后会立即执行一次刷新</li>
              <li><i class="fas fa-check text-success me-2"></i>不同时间段可设置不同刷新频率</li>
              <li><i class="fas fa-check text-success me-2"></i>刷新日志帮助您监控刷新状态</li>
              <li><i class="fas fa-check text-success me-2"></i>建议工作时间频繁刷新，夜间减少频率</li>
              <li><i class="fas fa-exclamation-triangle text-warning me-2"></i>刷新需要微信账号在线</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api'
import { ElMessage } from 'element-plus'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
function apiPrefix() { return isAdmin.value ? '/admin' : '/user' }

const robots = ref([])
const selectedRobotId = ref(null)
const loading = ref(false)
const saving = ref(false)
const refreshingNow = ref(false)
const logsLoading = ref(false)

const isAutoRefresh = ref(false)
const lastRefreshAt = ref(null)
const nextRefreshAt = ref(null)
const stats = reactive({ today_refresh_count: 0, today_new_moments: 0 })

const scheduleConfig = ref([
  { start_hour: 8, end_hour: 22, interval_minutes: 10, enabled: true },
  { start_hour: 22, end_hour: 8, interval_minutes: 120, enabled: true },
])

const refreshLogs = ref([])
const logsPage = ref(1)
const logsPageSize = ref(10)
const logsTotal = ref(0)

const currentAccount = computed(() => robots.value.find(r => r.id === selectedRobotId.value))

async function loadRobots() {
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/accounts`)
    robots.value = res.data?.data || res.data || []
    if (robots.value.length && !selectedRobotId.value) {
      selectedRobotId.value = robots.value[0].id
      onRobotChange()
    }
  } catch { robots.value = [] }
}

function onRobotChange() {
  if (selectedRobotId.value) {
    loadSettings()
    loadRefreshLogs(1)
    loadStats()
  }
}

async function loadSettings() {
  if (!selectedRobotId.value) return
  loading.value = true
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/moments/refresh-settings`)
    const data = res.data?.data || res.data || {}
    isAutoRefresh.value = !!data.is_auto_refresh
    lastRefreshAt.value = data.last_refresh_at || null
    nextRefreshAt.value = data.next_refresh_at || null
    if (data.schedule_config) {
      try {
        const parsed = typeof data.schedule_config === 'string' ? JSON.parse(data.schedule_config) : data.schedule_config
        if (Array.isArray(parsed) && parsed.length) scheduleConfig.value = parsed
      } catch {}
    }
  } catch {}
  loading.value = false
}

async function loadStats() {
  if (!selectedRobotId.value) return
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/moments/refresh-stats`)
    const data = res.data?.data || res.data || {}
    stats.today_refresh_count = data.today_refresh_count || 0
    stats.today_new_moments = data.today_new_moments || 0
  } catch {}
}

async function saveScheduleConfig() {
  if (!selectedRobotId.value) { ElMessage.warning('请先选择机器人账号'); return }
  saving.value = true
  try {
    await api.post(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/moments/refresh-settings`, {
      is_auto_refresh: isAutoRefresh.value,
      schedule_config: JSON.stringify(scheduleConfig.value),
    })
    ElMessage.success('保存成功')
    loadSettings()
  } catch (e) { ElMessage.error(e?.response?.data?.message || '保存失败') }
  saving.value = false
}

async function toggleAutoRefresh(val) {
  if (!selectedRobotId.value) { ElMessage.warning('请先选择机器人账号'); return }
  try {
    await api.post(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/moments/refresh-settings`, {
      is_auto_refresh: val,
      schedule_config: JSON.stringify(scheduleConfig.value),
    })
    ElMessage.success(val ? '自动刷新已启用' : '自动刷新已关闭')
    loadSettings()
    loadStats()
  } catch (e) { ElMessage.error('操作失败') }
}

async function refreshNow() {
  if (!selectedRobotId.value) { ElMessage.warning('请先选择机器人账号'); return }
  refreshingNow.value = true
  try {
    await api.post(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/moments/refresh-now`)
    ElMessage.success('已发起刷新请求')
    setTimeout(() => { loadRefreshLogs(1); loadStats() }, 2000)
  } catch (e) { ElMessage.error(e?.response?.data?.message || '刷新失败') }
  refreshingNow.value = false
}

async function loadRefreshLogs(page) {
  if (!selectedRobotId.value) { refreshLogs.value = []; return }
  logsPage.value = page || 1
  logsLoading.value = true
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/moments/refresh-logs`, {
      params: { page: logsPage.value, pageSize: logsPageSize.value }
    })
    const data = res.data || {}
    refreshLogs.value = data.data || data.list || (Array.isArray(data) ? data : [])
    logsTotal.value = data.pagination?.total || data.total || refreshLogs.value.length
  } catch { refreshLogs.value = [] }
  logsLoading.value = false
}

function addScheduleItem() {
  scheduleConfig.value.push({ start_hour: 0, end_hour: 6, interval_minutes: 120, enabled: false })
}

function removeScheduleItem(idx) {
  scheduleConfig.value.splice(idx, 1)
}

function formatTime(t) {
  if (!t) return '-'
  try { return new Date(t).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return t }
}

function getLogTypeText(type) {
  const map = { manual: '手动', auto: '自动', on_enable: '启用时' }
  return map[type] || type || '自动'
}

function getLogStatusText(status) {
  const map = { success: '成功', failed: '失败', partial: '部分成功', running: '进行中' }
  return map[status] || status || '-'
}

function getLogStatusIcon(status) {
  const map = { success: 'fas fa-check-circle', failed: 'fas fa-times-circle', partial: 'fas fa-exclamation-circle', running: 'fas fa-spinner fa-spin' }
  return map[status] || 'fas fa-circle'
}

onMounted(() => { loadRobots() })
</script>

<style scoped>
.moments-refresh-settings-page { padding: 0; }

/* 紫色渐变头部 */
.refresh-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px; padding: 24px; margin-bottom: 24px; color: white;
}
.refresh-header h4 { margin: 0; color: white; font-weight: 600; }
.refresh-header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
.robot-select { min-width: 200px; }
:deep(.robot-select .el-input__wrapper) { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); }
:deep(.robot-select .el-input__inner) { color: white; }
:deep(.robot-select .el-input__inner::placeholder) { color: rgba(255,255,255,0.6); }

/* 卡片 */
.content-card {
  background: white; border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  overflow: hidden; margin-bottom: 24px;
}
.content-header {
  padding: 16px 20px; border-bottom: 1px solid #E5E5E5;
  display: flex; justify-content: space-between; align-items: center;
}
.content-header h5 { font-size: 15px; font-weight: 600; }
.content-body { padding: 20px; }

/* 提示框 */
.info-box {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;
  display: flex; align-items: flex-start; gap: 12px;
}
.info-box i { color: #1976D2; font-size: 18px; margin-top: 2px; }
.info-box p { margin: 0; color: #1565C0; font-size: 13px; line-height: 1.6; }

/* 时间段设置 */
.schedule-item {
  background: #f8f9fa; border-radius: 12px; padding: 18px;
  margin-bottom: 14px; border: 2px solid transparent; transition: all 0.3s ease;
}
.schedule-item:hover { border-color: #667eea; }
.schedule-item.active { border-color: #27AE60; background: linear-gradient(135deg, #f8fff8 0%, #e8f5e9 100%); }
.schedule-item.switch-area { background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%); }
.schedule-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.schedule-title { font-weight: 600; color: #333; display: flex; align-items: center; gap: 8px; }
.schedule-title i { color: #667eea; }

.time-range-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.time-select, .interval-select {
  padding: 8px 12px; border: 1px solid #E5E5E5; border-radius: 8px;
  font-size: 13px; background: white;
}
.time-select { min-width: 90px; }
.interval-select { min-width: 130px; }
.time-select:focus, .interval-select:focus {
  border-color: #667eea; outline: none; box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
}
.time-label { color: #666; font-size: 13px; }

/* 按钮 */
.btn-purple {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important; color: white !important;
  border-radius: 10px !important; font-weight: 500 !important;
}
.btn-purple:hover { transform: translateY(-1px); box-shadow: 0 5px 15px rgba(102,126,234,0.4); }
.btn-outline-purple {
  border: 2px solid #667eea !important; color: #667eea !important;
  background: transparent !important; border-radius: 8px !important;
}
.btn-outline-purple:hover { background: #667eea !important; color: white !important; }

.switch-container { display: flex; align-items: center; gap: 12px; }
.switch-label { font-size: 15px; font-weight: 500; }

/* 日志表格 */
.log-table { width: 100%; border-collapse: collapse; }
.log-table th {
  background: #f8f9fa; padding: 12px 14px; text-align: left;
  font-weight: 600; font-size: 13px; color: #333;
  border-bottom: 2px solid #E5E5E5;
}
.log-table td { padding: 12px 14px; border-bottom: 1px solid #E5E5E5; vertical-align: middle; font-size: 13px; }
.log-table tr:hover { background: #f8f9ff; }

.log-status {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
}
.log-status.success { background: rgba(39,174,96,0.1); color: #27AE60; }
.log-status.failed { background: rgba(231,76,60,0.1); color: #E74C3C; }
.log-status.partial { background: rgba(243,156,18,0.1); color: #F39C12; }

.log-type {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; background: #e9ecef; color: #666;
}
.log-type.manual { background: #e3f2fd; color: #1976D2; }
.log-type.auto { background: #f3e5f5; color: #7B1FA2; }
.log-type.on_enable { background: #fff3e0; color: #E65100; }

/* 状态面板 */
.status-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px; padding: 20px; text-align: center;
}
.status-icon {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 10px; font-size: 22px;
}
.status-icon.active { background: linear-gradient(135deg, #27AE60, #2ECC71); color: white; }
.status-icon.inactive { background: linear-gradient(135deg, #95a5a6, #7f8c8d); color: white; }
.status-text { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.status-text.active { color: #27AE60; }
.status-text.inactive { color: #95a5a6; }
.status-detail { font-size: 13px; color: #666; }

/* 空状态 */
.empty-state { text-align: center; padding: 50px 20px; color: #999; }
.empty-state i { font-size: 42px; margin-bottom: 12px; opacity: 0.5; display: block; }

.tips-list { list-style: none; padding: 0; margin: 0; font-size: 13px; color: #666; }
.tips-list li { margin-bottom: 8px; }

/* 响应式 */
@media (max-width: 768px) {
  .time-range-row { flex-direction: column; align-items: stretch; }
  .time-select, .interval-select { width: 100%; }
  .schedule-header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .refresh-header { padding: 16px; border-radius: 12px; }
}
</style>
