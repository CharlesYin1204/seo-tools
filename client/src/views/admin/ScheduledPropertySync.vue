<template>
  <div class="scheduled-sync-page">
    <!-- 紫色渐变头部 -->
    <div class="plugin-header">
      <div class="header-content">
        <div>
          <h2><i class="fas fa-sync-alt"></i> 同步内容资产</h2>
          <p>自动化搜索朋友圈并保存内容资产信息</p>
        </div>
        <div class="header-actions">
          <el-button size="small" class="btn-light" @click="$router.push('/admin/moments-parsed-list')">
            <i class="fas fa-list"></i> 内容资产列表
          </el-button>
        </div>
      </div>
    </div>

    <!-- 账号选择器 -->
    <div class="robot-selector">
      <div class="selector-content">
        <div class="selector-left">
          <i class="fas fa-robot robot-icon"></i>
          <span class="label">当前账号：</span>
          <el-select v-model="selectedRobotId" placeholder="请选择微信账号" size="default" style="width: 220px" @change="onRobotChange">
            <el-option v-for="r in robots" :key="r.id" :label="(r.nickname || r.wxid) + (r.status === 'online' ? ' (在线)' : '')" :value="r.id" />
          </el-select>
        </div>
      </div>
    </div>

    <!-- 正在执行的任务面板 -->
    <div v-if="runningTasks.length" class="running-panel">
      <div class="running-header">
        <div class="running-title">
          <div class="title-icon running-icon"><i class="fas fa-bolt"></i></div>
          <span class="title-text">正在执行的任务</span>
          <span class="running-count">{{ runningTasks.length }}</span>
        </div>
        <el-button size="small" type="danger" plain @click="stopAllTasks">
          <i class="fas fa-stop-circle"></i> 停止全部
        </el-button>
      </div>
      <div v-for="rt in runningTasks" :key="rt.log_id" class="running-item">
        <div class="running-item-left">
          <i class="fas fa-spinner fa-spin running-spinner"></i>
          <div>
            <strong>{{ rt.task_name || ('任务 #' + rt.task_id) }}</strong>
            <div class="running-item-info">开始: {{ rt.start_time || '-' }} | 耗时: {{ rt.duration_text || '-' }} | 找到: {{ rt.total_found || 0 }} | 保存: {{ rt.saved_count || 0 }}</div>
          </div>
        </div>
        <el-button size="small" type="danger" plain circle @click="stopSingleTask(rt)">
          <i class="fas fa-stop"></i>
        </el-button>
      </div>
      <div class="running-hint"><i class="fas fa-info-circle"></i> 此面板显示所有正在后台执行的任务</div>
    </div>

    <!-- 搜索任务列表 -->
    <div class="module-card">
      <div class="module-header">
        <div class="module-title">
          <div class="title-icon"><i class="fas fa-clock"></i></div>
          <span>搜索任务</span>
        </div>
        <el-button type="primary" size="small" class="btn-purple" @click="showAddModal">
          <i class="fas fa-plus"></i> 添加任务
        </el-button>
      </div>

      <!-- 按钮说明 -->
      <div class="btn-hint">
        <i class="fas fa-info-circle"></i>
        <strong>按钮说明：</strong>
        <span class="hint-badge badge-primary"><i class="fas fa-bolt"></i> 执行一次</span> 手动触发任务执行一次
        <span class="hint-sep">|</span>
        <span class="hint-badge badge-warning"><i class="fas fa-pause"></i> 暂停定时</span>
        <span class="hint-badge badge-success"><i class="fas fa-clock"></i> 启用定时</span> 控制任务是否按设定时间自动执行
      </div>

      <!-- 任务列表 -->
      <div v-loading="loading" element-loading-text="加载中...">
        <div v-if="!loading && !tasks.length" class="empty-state">
          <i class="fas fa-search"></i>
          <p>暂无搜索任务</p>
          <p class="empty-hint">添加搜索任务后，系统将自动搜索朋友圈并保存内容资产</p>
        </div>

        <div v-for="task in tasks" :key="task.id" class="task-item">
          <div class="task-main">
            <div class="task-info">
              <div class="task-title-row">
                <h6>
                  <i :class="['fas', task.is_active ? 'fa-play-circle status-active' : 'fa-pause-circle status-inactive']"></i>
                  {{ task.task_name }}
                </h6>
                <span :class="['task-badge', 'badge-' + getTodayExecClass(task)]">
                  <i :class="['fas', 'fa-' + getTodayExecIcon(task)]"></i> {{ getTodayExecStatus(task) }}
                </span>
                <span v-if="task.last_execution_status" :class="['task-badge', 'badge-' + getLastExecClass(task)]">
                  <i :class="['fas', 'fa-' + getLastExecIcon(task)]"></i> 上次: {{ getLastExecText(task) }}
                </span>
                <span v-if="(task.consecutive_failures || 0) >= 3" class="task-badge badge-danger">
                  <i class="fas fa-exclamation-triangle"></i> 连续失败
                </span>
              </div>

              <div class="task-meta">
                <i class="fas fa-clock"></i> 执行时间: {{ (task.schedule_time || '').substring(0, 5) }}
                <span class="meta-sep">|</span>
                <i class="fas fa-calendar-alt"></i> 执行日期: {{ formatDates(task.specific_dates) }}
                <template v-if="task.search_time_mode === 'relative' && task.search_recent_hours">
                  <span class="meta-sep">|</span>
                  <i class="fas fa-history"></i> 搜索最近 {{ task.search_recent_hours }} 小时
                </template>
              </div>

              <div v-if="task.search_keywords && task.search_keywords.length" class="task-meta">
                <i class="fas fa-search"></i> 关键词: {{ task.search_keywords.join(', ') }}
              </div>
              <div v-if="task.exclude_keywords && task.exclude_keywords.length" class="task-meta text-danger">
                <i class="fas fa-ban"></i> 排除: {{ task.exclude_keywords.join(', ') }}
              </div>
              <div v-if="task.last_run_at" class="task-meta task-stats">
                <i class="fas fa-history"></i> 上次执行: {{ task.last_run_at }}
                <span class="meta-sep">|</span>
                <span class="text-success">成功: {{ task.success_count || 0 }}次</span>
                <span class="meta-sep">|</span>
                <span class="text-danger">失败: {{ task.fail_count || 0 }}次</span>
                <span class="meta-sep">|</span>
                总执行: {{ task.run_count || 0 }}次
              </div>
              <div v-if="task.last_error_message" class="task-meta text-danger">
                <i class="fas fa-exclamation-triangle"></i> 错误: {{ (task.last_error_message || '').substring(0, 100) }}
              </div>
            </div>

            <div class="task-actions">
              <el-button size="small" type="primary" @click="runTask(task)">
                <i class="fas fa-bolt"></i> 执行一次
              </el-button>
              <el-button size="small" :type="task.is_active ? 'warning' : 'success'" @click="toggleTask(task)">
                <i :class="['fas', task.is_active ? 'fa-pause' : 'fa-clock']"></i>
                {{ task.is_active ? '暂停定时' : '启用定时' }}
              </el-button>
              <el-button size="small" plain circle @click="viewLogs(task)" title="执行日志">
                <i class="fas fa-history"></i>
              </el-button>
              <el-button size="small" plain circle @click="editTask(task)" title="编辑">
                <i class="fas fa-edit"></i>
              </el-button>
              <el-button size="small" type="danger" plain circle @click="deleteTask(task)" title="删除">
                <i class="fas fa-trash"></i>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑任务弹窗 -->
    <el-dialog v-model="showTaskDialog" :title="editingTaskId ? '编辑搜索任务' : '添加搜索任务'" width="720px" @close="resetForm" destroy-on-close>
      <div class="task-form">
        <div class="form-row">
          <div class="form-col">
            <label>任务名称 <span class="required">*</span></label>
            <el-input v-model="form.task_name" placeholder="如：今日内容资产搜索" />
          </div>
          <div class="form-col">
            <label>执行时间 <span class="required">*</span></label>
            <el-time-picker v-model="form.schedule_time_obj" format="HH:mm" value-format="HH:mm" placeholder="选择时间" style="width: 100%" />
          </div>
        </div>

        <!-- 立即同步选项 -->
        <div class="immediate-sync-option">
          <el-checkbox v-model="form.run_immediately">
            <strong class="purple-text"><i class="fas fa-bolt"></i> 立即同步</strong>
            <span class="hint-text">（保存任务后立即执行一次同步）</span>
          </el-checkbox>
        </div>

        <!-- 指定执行日期 -->
        <div class="form-section">
          <label>指定执行日期 <span class="required">*</span></label>
          <div class="quick-dates">
            <span class="quick-label">快捷选择：</span>
            <el-button size="small" plain @click="addQuickDate('today')"><i class="fas fa-calendar-day"></i> 今天</el-button>
            <el-button size="small" plain @click="addQuickDate('tomorrow')"><i class="fas fa-calendar-plus"></i> 明天</el-button>
            <el-button size="small" plain @click="addQuickDate('dayAfterTomorrow')"><i class="fas fa-calendar"></i> 后天</el-button>
          </div>
          <div class="date-input-row">
            <el-date-picker v-model="newDateInput" type="date" placeholder="选择日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="flex:1" />
            <el-button type="primary" plain @click="addSpecificDate"><i class="fas fa-plus"></i> 添加日期</el-button>
          </div>
          <div class="selected-dates">
            <el-tag v-for="(d, i) in form.specific_dates" :key="d" closable type="primary" @close="removeDate(i)">{{ d }}</el-tag>
          </div>
          <div class="form-hint"><i class="fas fa-info-circle"></i> 任务将在指定的日期和时间执行搜索</div>
        </div>

        <!-- 搜索关键词 -->
        <div class="form-section">
          <label>
            <i class="fas fa-search text-primary"></i> 搜索关键词（每行一个）
            <span :class="['keyword-count', form.search_keywords_text ? 'count-active' : '']">{{ keywordCount }}个</span>
          </label>
          <el-input v-model="form.search_keywords_text" type="textarea" :rows="3" placeholder="租房&#10;出租&#10;整租&#10;合租" />
          <div class="form-hint"><i class="fas fa-info-circle"></i> 只采集包含<strong>任意一个</strong>关键词的内容资产（OR关系）</div>
          <div class="form-hint warning"><i class="fas fa-lightbulb"></i> 建议：添加多个相关词提高匹配率，如"出租"、"整租"、"合租"</div>
        </div>

        <!-- 排除关键词 -->
        <div class="form-section">
          <label>
            <i class="fas fa-ban text-danger"></i> 排除关键词（每行一个）
            <span :class="['keyword-count count-danger', form.exclude_keywords_text ? 'count-active' : '']">{{ excludeKeywordCount }}个</span>
          </label>
          <el-input v-model="form.exclude_keywords_text" type="textarea" :rows="3" placeholder="求租&#10;招租&#10;服务团队&#10;找室友" />
          <div class="form-hint danger"><i class="fas fa-exclamation-triangle"></i> 包含<strong>任意一个</strong>排除关键词的内容资产将不会被采集</div>
        </div>

        <!-- 发布时间筛选 / 指定好友 -->
        <div class="form-row">
          <div class="form-col">
            <label>发布时间筛选</label>
            <el-radio-group v-model="form.search_time_mode" size="small" class="time-mode-group">
              <el-radio-button value="absolute"><i class="fas fa-calendar"></i> 指定日期</el-radio-button>
              <el-radio-button value="relative"><i class="fas fa-history"></i> 最近时间</el-radio-button>
            </el-radio-group>
            <div v-if="form.search_time_mode === 'absolute'" class="time-fields">
              <el-date-picker v-model="form.search_date_from" type="date" placeholder="开始日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:48%" />
              <el-date-picker v-model="form.search_date_to" type="date" placeholder="结束日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:48%" />
              <div class="form-hint">留空表示不限制发布时间</div>
            </div>
            <div v-else class="time-fields">
              <el-select v-model="form.search_recent_hours" placeholder="选择时间范围">
                <el-option v-for="h in recentHoursOptions" :key="h.value" :label="h.label" :value="h.value" />
              </el-select>
            </div>
          </div>
          <div class="form-col">
            <label>
              指定好友
              <span v-if="allFriends.length" class="keyword-count">共{{ allFriends.length }}人</span>
              <span v-if="form.search_wxids.length" class="keyword-count count-active">已选{{ form.search_wxids.length }}人</span>
            </label>
            <div class="friend-selector">
              <div class="selected-display" @click="showFriendDropdown = !showFriendDropdown">
                <template v-if="form.search_wxids.length">
                  <span v-for="wxid in form.search_wxids" :key="wxid" class="friend-tag">
                    {{ getFriendName(wxid) }}
                    <span class="remove-tag" @click.stop="removeFriend(wxid)">&times;</span>
                  </span>
                </template>
                <span v-else class="placeholder-text">点击选择好友...</span>
              </div>
              <div v-if="showFriendDropdown" class="friend-dropdown">
                <div class="friend-search">
                  <el-input v-model="friendSearchText" placeholder="搜索好友..." size="small" clearable />
                  <div class="friend-search-stats">
                    <span>共 <strong>{{ allFriends.length }}</strong> 位好友</span>
                    <span v-if="friendSearchText">，匹配 <strong>{{ filteredFriends.length }}</strong> 位</span>
                  </div>
                </div>
                <div class="friend-list">
                  <div v-for="f in filteredFriends" :key="f.wxid" :class="['friend-item', { selected: form.search_wxids.includes(f.wxid) }]" @click="toggleFriend(f.wxid)">
                    <div class="friend-avatar">
                      <img v-if="f.avatar" :src="f.avatar" @error="$event.target.style.display='none'" />
                      <i v-else class="fas fa-user"></i>
                    </div>
                    <div class="friend-info">
                      <div class="friend-name">{{ f.remark || f.nickname || f.wxid }}</div>
                      <div class="friend-wxid">{{ f.wxid }}</div>
                    </div>
                    <i v-if="form.search_wxids.includes(f.wxid)" class="fas fa-check check-icon"></i>
                  </div>
                  <div v-if="!filteredFriends.length" class="no-friends">暂无好友</div>
                </div>
              </div>
            </div>
            <div class="form-hint">只搜索指定好友的朋友圈</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showTaskDialog = false">取消</el-button>
        <el-button type="primary" class="btn-purple" :loading="saving" @click="saveTask">保存任务</el-button>
      </template>
    </el-dialog>

    <!-- 执行日志弹窗 -->
    <el-dialog v-model="showLogsDialog" title="任务执行日志" width="800px" destroy-on-close>
      <template #header>
        <span><i class="fas fa-history text-info"></i> 任务执行日志</span>
      </template>
      <div class="logs-stats">
        <div class="stat-card"><div class="stat-label">总执行次数</div><div class="stat-value text-primary">{{ logStats.total_runs }}</div></div>
        <div class="stat-card"><div class="stat-label">成功次数</div><div class="stat-value text-success">{{ logStats.success_count }}</div></div>
        <div class="stat-card"><div class="stat-label">失败次数</div><div class="stat-value text-danger">{{ logStats.fail_count }}</div></div>
        <div class="stat-card"><div class="stat-label">成功率</div><div class="stat-value text-info">{{ successRate }}%</div></div>
      </div>
      <el-table :data="logs" stripe size="small" v-loading="logsLoading">
        <el-table-column prop="executed_at" label="执行时间" width="170" />
        <el-table-column label="触发方式" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.trigger_type === 'manual' ? 'info' : 'primary'" size="small">{{ row.trigger_type === 'manual' ? '手动' : '定时' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="执行状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="logStatusType(row.status)" size="small">
              <i v-if="row.status === 'running'" class="fas fa-spinner fa-spin"></i>
              {{ logStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="搜索/保存/跳过" width="130">
          <template #default="{ row }">{{ row.searched_count || 0 }}/{{ row.saved_count || 0 }}/{{ row.skipped_count || 0 }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="80">
          <template #default="{ row }">{{ row.duration ? row.duration + 's' : '-' }}</template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="150">
          <template #default="{ row }">
            <span :class="{ 'text-danger': row.error_message }">{{ row.error_message ? row.error_message.substring(0, 50) : '-' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="logs-pagination">
        <span class="logs-total">共 {{ logsTotal }} 条记录</span>
        <el-pagination v-if="logsPages > 1" :current-page="logsPage" :page-size="10" :total="logsTotal" layout="prev, pager, next" small @current-change="onLogsPageChange" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'
import api from '@/api'

const loading = ref(false)
const saving = ref(false)
const robots = ref([])
const selectedRobotId = ref(null)
const tasks = ref([])
const runningTasks = ref([])
let runningInterval = null

const showTaskDialog = ref(false)
const editingTaskId = ref(null)
const newDateInput = ref(null)
const showFriendDropdown = ref(false)
const friendSearchText = ref('')
const allFriends = ref([])

const recentHoursOptions = [
  { value: 1, label: '1小时' }, { value: 2, label: '2小时' }, { value: 3, label: '3小时' },
  { value: 4, label: '4小时' }, { value: 6, label: '6小时' }, { value: 8, label: '8小时' },
  { value: 12, label: '12小时' }, { value: 24, label: '24小时' }, { value: 48, label: '2天' }, { value: 72, label: '3天' },
]

const form = reactive({
  task_name: '',
  schedule_time_obj: '09:00',
  run_immediately: false,
  specific_dates: [],
  search_keywords_text: '',
  exclude_keywords_text: '',
  search_time_mode: 'absolute',
  search_date_from: null,
  search_date_to: null,
  search_recent_hours: 2,
  search_wxids: [],
  search_tag_ids: [],
})

const keywordCount = computed(() => {
  const t = (form.search_keywords_text || '').trim()
  return t ? t.split('\n').filter(k => k.trim()).length : 0
})
const excludeKeywordCount = computed(() => {
  const t = (form.exclude_keywords_text || '').trim()
  return t ? t.split('\n').filter(k => k.trim()).length : 0
})

const filteredFriends = computed(() => {
  const s = friendSearchText.value.toLowerCase()
  if (!s) return allFriends.value
  return allFriends.value.filter(f =>
    (f.nickname || '').toLowerCase().includes(s) ||
    (f.wxid || '').toLowerCase().includes(s) ||
    (f.remark || '').toLowerCase().includes(s)
  )
})

// 日志相关
const showLogsDialog = ref(false)
const logsLoading = ref(false)
const logs = ref([])
const logsTotal = ref(0)
const logsPages = ref(0)
const logsPage = ref(1)
const currentLogsTaskId = ref(null)
const logStats = reactive({ total_runs: 0, success_count: 0, fail_count: 0 })
const successRate = computed(() => logStats.total_runs > 0 ? Math.round((logStats.success_count / logStats.total_runs) * 100) : 0)

// ========== 数据加载 ==========

async function loadRobots() {
  try {
    const res = await api.get('/admin/scheduled-tasks/robots')
    robots.value = res.data?.data || res.data || []
    if (robots.value.length && !selectedRobotId.value) {
      selectedRobotId.value = robots.value[0].id
    }
  } catch (err) {
    console.error('[ScheduledSync] 加载机器人失败:', err)
  }
}

async function loadTasks() {
  loading.value = true
  try {
    const params = selectedRobotId.value ? { robot_id: selectedRobotId.value } : {}
    const res = await api.get('/admin/scheduled-tasks', { params })
    tasks.value = res.data?.data || res.data || []
  } catch (err) {
    console.error('[ScheduledSync] 加载任务失败:', err)
    tasks.value = []
  } finally {
    loading.value = false
  }
}

async function checkRunningTasks() {
  try {
    const res = await api.get('/admin/scheduled-tasks/running')
    runningTasks.value = res.data?.data || []
  } catch {
    runningTasks.value = []
  }
}

async function loadFriends() {
  if (!selectedRobotId.value) return
  try {
    const token = localStorage.getItem('token')
    const { data: body } = await axios.get(`/admin/scheduled-tasks/friends/${selectedRobotId.value}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 60000,
    })
    const payload = body?.data || body
    const list = payload?.list || (Array.isArray(payload) ? payload : [])
    allFriends.value = Array.isArray(list) ? list : []
  } catch (err) {
    console.error('[loadFriends] failed:', err?.message || err)
    allFriends.value = []
  }
}

function onRobotChange() {
  loadTasks()
  loadFriends()
}

// ========== 任务操作 ==========

async function toggleTask(task) {
  const actionText = task.is_active ? '暂停' : '启用'
  try {
    await ElMessageBox.confirm(
      `确定要${actionText}此任务的定时执行吗？\n\n${task.is_active ? '暂停后，任务将不再按设定时间自动执行。' : '启用后，任务将按设定的时间自动执行。'}`,
      '确认', { type: 'warning' }
    )
    await api.post(`/admin/scheduled-tasks/${task.id}/toggle`)
    ElMessage.success(`已${actionText}`)
    loadTasks()
  } catch {}
}

async function runTask(task) {
  try {
    await ElMessageBox.confirm('确定要立即执行一次这个任务吗？\n\n这将手动触发任务执行一次，不影响定时计划。', '确认', { type: 'info' })
    await api.post(`/admin/scheduled-tasks/${task.id}/run`)
    ElMessage.success('任务已开始执行，请稍后查看执行日志')
    loadTasks()
    checkRunningTasks()
  } catch {}
}

async function deleteTask(task) {
  try {
    await ElMessageBox.confirm('确定要删除这个搜索任务吗？', '确认', { type: 'warning' })
    await api.delete(`/admin/scheduled-tasks/${task.id}`)
    ElMessage.success('删除成功')
    loadTasks()
  } catch {}
}

async function stopSingleTask(rt) {
  try {
    await ElMessageBox.confirm('确定要停止此任务吗？', '确认', { type: 'warning' })
    await api.post(`/admin/scheduled-tasks/${rt.task_id}/stop`, { log_id: rt.log_id })
    ElMessage.success('任务已停止')
    checkRunningTasks()
    loadTasks()
  } catch {}
}

async function stopAllTasks() {
  try {
    await ElMessageBox.confirm('确定要停止所有正在执行的任务吗？', '确认', { type: 'warning' })
    await api.post('/admin/scheduled-tasks/stop-all')
    ElMessage.success('所有任务已停止')
    checkRunningTasks()
    loadTasks()
  } catch {}
}

// ========== 弹窗表单 ==========

function showAddModal() {
  editingTaskId.value = null
  form.task_name = ''
  form.schedule_time_obj = '09:00'
  form.run_immediately = false
  form.specific_dates = []
  form.search_keywords_text = ''
  form.exclude_keywords_text = '收房\n拿房\n宿舍'
  form.search_time_mode = 'absolute'
  form.search_date_from = null
  form.search_date_to = null
  form.search_recent_hours = 2
  form.search_wxids = []
  form.search_tag_ids = []
  showFriendDropdown.value = false
  friendSearchText.value = ''
  loadFriends()
  showTaskDialog.value = true
}

async function editTask(task) {
  try {
    const res = await api.get(`/admin/scheduled-tasks/${task.id}`)
    const t = res.data?.data || res.data
    if (!t) return ElMessage.error('获取任务详情失败')

    editingTaskId.value = t.id
    form.task_name = t.task_name || ''
    form.schedule_time_obj = t.schedule_time ? t.schedule_time.substring(0, 5) : '09:00'
    form.run_immediately = false
    form.specific_dates = Array.isArray(t.specific_dates) ? [...t.specific_dates] : []
    const kw = t.search_keywords || []
    form.search_keywords_text = Array.isArray(kw) ? kw.join('\n') : ''
    const ekw = t.exclude_keywords || []
    form.exclude_keywords_text = Array.isArray(ekw) ? ekw.join('\n') : ''
    form.search_time_mode = t.search_time_mode || 'absolute'
    form.search_date_from = t.search_date_from || null
    form.search_date_to = t.search_date_to || null
    form.search_recent_hours = t.search_recent_hours || 2
    form.search_wxids = Array.isArray(t.search_wxids) ? [...t.search_wxids] : []
    form.search_tag_ids = Array.isArray(t.search_tag_ids) ? [...t.search_tag_ids] : []
    showFriendDropdown.value = false
    friendSearchText.value = ''
    loadFriends()
    showTaskDialog.value = true
  } catch (err) {
    console.error('[ScheduledSync] 加载任务详情失败:', err)
    ElMessage.error('获取任务详情失败')
  }
}

function resetForm() {
  editingTaskId.value = null
  showFriendDropdown.value = false
}

async function saveTask() {
  if (!form.task_name.trim()) return ElMessage.warning('请输入任务名称')
  if (!form.specific_dates.length) return ElMessage.warning('请至少选择一个执行日期')

  const kwText = (form.search_keywords_text || '').trim()
  const keywords = kwText ? [...new Set(kwText.split('\n').map(k => k.trim()).filter(k => k))] : []
  const ekwText = (form.exclude_keywords_text || '').trim()
  const excludeKeywords = ekwText ? [...new Set(ekwText.split('\n').map(k => k.trim()).filter(k => k))] : []

  saving.value = true
  try {
    const data = {
      id: editingTaskId.value || undefined,
      robot_id: selectedRobotId.value,
      task_name: form.task_name,
      schedule_time: (form.schedule_time_obj || '09:00') + ':00',
      schedule_mode: 'specific_dates',
      schedule_days: '1,2,3,4,5,6,7',
      specific_dates: JSON.stringify(form.specific_dates),
      search_keywords: JSON.stringify(keywords),
      exclude_keywords: JSON.stringify(excludeKeywords),
      search_time_mode: form.search_time_mode,
      search_date_from: form.search_time_mode === 'absolute' ? form.search_date_from : null,
      search_date_to: form.search_time_mode === 'absolute' ? form.search_date_to : null,
      search_recent_hours: form.search_time_mode === 'relative' ? parseInt(form.search_recent_hours) : null,
      search_wxids: JSON.stringify(form.search_wxids),
      search_tag_ids: JSON.stringify(form.search_tag_ids),
      auto_save: 1,
      sync_before_search: 1,
      is_active: 1,
      run_immediately: form.run_immediately ? 1 : 0,
    }

    await api.post('/admin/scheduled-tasks', data)
    ElMessage.success(editingTaskId.value ? '更新成功' : '创建成功')
    showTaskDialog.value = false
    loadTasks()
  } catch (err) {
    console.error('[ScheduledSync] 保存任务失败:', err)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// ========== 日期操作 ==========

function addQuickDate(type) {
  const today = new Date()
  const target = new Date(today)
  if (type === 'tomorrow') target.setDate(today.getDate() + 1)
  else if (type === 'dayAfterTomorrow') target.setDate(today.getDate() + 2)

  const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
  if (form.specific_dates.includes(dateStr)) return ElMessage.warning('该日期已添加')
  form.specific_dates.push(dateStr)
  form.specific_dates.sort()
  ElMessage.success('已添加: ' + dateStr)
}

function addSpecificDate() {
  if (!newDateInput.value) return ElMessage.warning('请选择日期')
  if (form.specific_dates.includes(newDateInput.value)) return ElMessage.warning('该日期已添加')
  form.specific_dates.push(newDateInput.value)
  form.specific_dates.sort()
  newDateInput.value = null
}

function removeDate(index) {
  form.specific_dates.splice(index, 1)
}

// ========== 好友操作 ==========

function getFriendName(wxid) {
  const f = allFriends.value.find(x => x.wxid === wxid)
  return f ? (f.remark || f.nickname || wxid) : wxid
}

function toggleFriend(wxid) {
  const idx = form.search_wxids.indexOf(wxid)
  if (idx > -1) form.search_wxids.splice(idx, 1)
  else form.search_wxids.push(wxid)
}

function removeFriend(wxid) {
  const idx = form.search_wxids.indexOf(wxid)
  if (idx > -1) form.search_wxids.splice(idx, 1)
}

// ========== 状态计算 ==========

function getTodayExecStatus(task) {
  if (!task.is_active) return '已禁用'
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const dates = task.specific_dates || []
  if (!dates.includes(todayStr)) return '非执行日'
  const lastRunDate = task.last_run_at ? task.last_run_at.substring(0, 10) : null
  if (lastRunDate === todayStr) return '今日已执行'
  const currentTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:${String(today.getSeconds()).padStart(2, '0')}`
  if (currentTime < (task.schedule_time || '00:00:00')) return '待执行'
  return '等待执行'
}

function getTodayExecClass(task) {
  const s = getTodayExecStatus(task)
  if (s === '已禁用' || s === '非执行日') return 'secondary'
  if (s === '今日已执行') return 'success'
  if (s === '待执行') return 'primary'
  return 'warning'
}

function getTodayExecIcon(task) {
  const s = getTodayExecStatus(task)
  if (s === '已禁用') return 'ban'
  if (s === '非执行日') return 'calendar-times'
  if (s === '今日已执行') return 'check-double'
  if (s === '待执行') return 'hourglass-half'
  return 'clock'
}

function getLastExecText(task) {
  const m = { success: '成功', failed: '失败', running: '执行中', partial: '部分成功' }
  return m[task.last_execution_status] || task.last_execution_status || ''
}
function getLastExecClass(task) {
  const m = { success: 'success-subtle', failed: 'danger-subtle', running: 'warning-subtle', partial: 'info-subtle' }
  return m[task.last_execution_status] || 'secondary'
}
function getLastExecIcon(task) {
  const m = { success: 'check-circle', failed: 'times-circle', running: 'spinner', partial: 'exclamation-circle' }
  return m[task.last_execution_status] || 'question-circle'
}

function formatDates(dates) {
  if (!dates || !dates.length) return '无'
  if (dates.length <= 5) return dates.join(', ')
  return dates.slice(0, 5).join(', ') + `...(共${dates.length}天)`
}

// ========== 日志 ==========

async function viewLogs(task) {
  currentLogsTaskId.value = task.id
  logsPage.value = 1
  showLogsDialog.value = true
  await loadLogs()
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const res = await api.get(`/admin/scheduled-tasks/${currentLogsTaskId.value}/logs`, { params: { page: logsPage.value, limit: 10 } })
    const d = res.data?.data || res.data || {}
    logs.value = d.logs || []
    logsTotal.value = d.total || 0
    logsPages.value = d.pages || 0
    if (d.stats) {
      logStats.total_runs = d.stats.total_runs || 0
      logStats.success_count = d.stats.success_count || 0
      logStats.fail_count = d.stats.fail_count || 0
    }
  } catch (err) {
    console.error('[ScheduledSync] 加载日志失败:', err)
  } finally {
    logsLoading.value = false
  }
}

function onLogsPageChange(page) {
  logsPage.value = page
  loadLogs()
}

function logStatusType(s) {
  const m = { success: 'success', failed: 'danger', running: 'warning', partial: 'info', cancelled: 'info' }
  return m[s] || 'info'
}
function logStatusText(s) {
  const m = { success: '成功', failed: '失败', running: '执行中', partial: '部分成功', cancelled: '已取消' }
  return m[s] || '未知'
}

// ========== 生命周期 ==========

onMounted(async () => {
  await loadRobots()
  loadTasks()
  loadFriends()
  checkRunningTasks()
  runningInterval = setInterval(checkRunningTasks, 10000)
})

onUnmounted(() => {
  if (runningInterval) clearInterval(runningInterval)
})

// 点击外部关闭好友下拉
function handleDocClick(e) {
  if (!e.target.closest('.friend-selector')) {
    showFriendDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', handleDocClick))
onUnmounted(() => document.removeEventListener('click', handleDocClick))
</script>

<style scoped lang="scss">
$purple: #9C27B0;
$purple-dark: #7B1FA2;

.scheduled-sync-page {
  padding: 0;
}

/* 紫色渐变头部 */
.plugin-header {
  background: linear-gradient(135deg, $purple 0%, $purple-dark 100%);
  color: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 8px 0;
    i { margin-right: 8px; }
  }
  p {
    margin: 0;
    opacity: 0.75;
    font-size: 14px;
  }
  .btn-light {
    background: rgba(255,255,255,0.9);
    border: none;
    color: $purple;
    font-weight: 500;
    &:hover { background: #fff; }
  }
}

/* 账号选择器 */
.robot-selector {
  background: white;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);

  .selector-content { display: flex; align-items: center; justify-content: space-between; }
  .selector-left { display: flex; align-items: center; gap: 8px; }
  .robot-icon { color: $purple; font-size: 16px; }
  .label { font-size: 14px; color: #333; }
}

/* 运行中任务面板 */
.running-panel {
  border: 2px solid #ff9800;
  background: linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%);
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 20px;

  .running-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
  }
  .running-title { display: flex; align-items: center; gap: 10px; }
  .running-icon { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%) !important; }
  .title-text { font-weight: 600; color: #e65100; font-size: 1.1rem; }
  .running-count {
    background: #ff9800; color: #333; font-size: 12px; padding: 2px 8px;
    border-radius: 10px; font-weight: 600;
  }
  .running-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 16px; margin-bottom: 8px;
    background: rgba(255,152,0,0.1); border-radius: 8px;
  }
  .running-item-left { display: flex; align-items: center; gap: 10px; }
  .running-spinner { color: #ff9800; }
  .running-item-info { font-size: 12px; color: #888; margin-top: 2px; }
  .running-hint { font-size: 12px; color: #888; margin-top: 8px; i { margin-right: 4px; } }
}

/* 模块卡片 */
.module-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.module-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.module-title {
  display: flex; align-items: center; gap: 12px;
  font-size: 1.1rem; font-weight: 600; color: #191919;
}
.title-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, $purple 0%, $purple-dark 100%);
  color: white; display: flex; align-items: center; justify-content: center;
}

.btn-purple {
  background: $purple !important; border-color: $purple !important; color: white !important;
  &:hover { background: $purple-dark !important; border-color: $purple-dark !important; }
}

/* 按钮说明 */
.btn-hint {
  background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px;
  padding: 10px 16px; margin-bottom: 16px; font-size: 13px; color: #666;

  i:first-child { color: #2196f3; margin-right: 6px; }
  strong { margin-right: 6px; }
  .hint-badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
    border-radius: 4px; font-size: 12px; font-weight: 500; margin: 0 4px;
    i { font-size: 11px; }
  }
  .badge-primary { background: #2196f3; color: white; }
  .badge-warning { background: #ff9800; color: #333; }
  .badge-success { background: #4caf50; color: white; }
  .hint-sep { margin: 0 6px; color: #ccc; }
}

/* 空状态 */
.empty-state {
  text-align: center; padding: 60px 20px; color: #888;
  i { font-size: 64px; margin-bottom: 20px; opacity: 0.4; display: block; }
  p { margin: 0 0 4px 0; font-size: 15px; }
  .empty-hint { font-size: 13px; color: #aaa; }
}

/* 任务项 */
.task-item {
  border: 1px solid #e5e5e5; border-radius: 10px; padding: 16px; margin-bottom: 12px;
  transition: all 0.2s ease;
  &:hover { border-color: $purple; box-shadow: 0 2px 8px rgba(156,39,176,0.15); }
}
.task-main { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.task-info { flex: 1; min-width: 0; }
.task-title-row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;
  h6 { margin: 0; font-size: 15px; font-weight: 600; white-space: nowrap;
    .status-active { color: $purple; }
    .status-inactive { color: #9e9e9e; }
    i { margin-right: 6px; }
  }
}
.task-badge {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
  border-radius: 4px; font-size: 12px; font-weight: 500;
  i { font-size: 11px; }
}
.badge-secondary { background: #e0e0e0; color: #666; }
.badge-success { background: #e8f5e9; color: #2e7d32; }
.badge-primary { background: #e3f2fd; color: #1565c0; }
.badge-warning { background: #fff3e0; color: #e65100; }
.badge-danger { background: #ffebee; color: #c62828; }
.badge-success-subtle { background: rgba(76,175,80,0.15); color: #2e7d32; border: 1px solid #4caf50; }
.badge-danger-subtle { background: rgba(244,67,54,0.15); color: #c62828; border: 1px solid #f44336; }
.badge-warning-subtle { background: rgba(255,152,0,0.15); color: #e65100; border: 1px solid #ff9800; }
.badge-info-subtle { background: rgba(33,150,243,0.15); color: #1565c0; border: 1px solid #2196f3; }

.task-meta {
  font-size: 13px; color: #888; margin-bottom: 4px;
  i { margin-right: 4px; }
}
.meta-sep { margin: 0 8px; color: #ddd; }
.task-stats { margin-top: 4px; }
.text-danger { color: #f44336 !important; }
.text-success { color: #4caf50 !important; }
.text-primary { color: #2196f3 !important; }
.text-info { color: #03a9f4 !important; }

.task-actions {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap;
}

/* 弹窗表单 */
.task-form {
  .form-row { display: flex; gap: 16px; margin-bottom: 16px; }
  .form-col { flex: 1; min-width: 0; }
  label {
    display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #333;
    .required { color: #f44336; }
  }
  .form-section { margin-bottom: 16px; }
  .form-hint {
    font-size: 12px; color: #888; margin-top: 6px;
    i { margin-right: 4px; }
    &.danger { color: #f44336; }
    &.warning { color: #ff9800; }
    strong { font-weight: 600; }
  }

  .immediate-sync-option {
    background: rgba(156,39,176,0.05); padding: 12px 16px; border-radius: 8px;
    border: 1px solid rgba(156,39,176,0.2); margin-bottom: 16px;
    .purple-text { color: $purple; i { margin-right: 4px; } }
    .hint-text { color: #888; margin-left: 6px; }
  }

  .quick-dates { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; .quick-label { font-size: 13px; color: #888; } }
  .date-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .selected-dates { display: flex; flex-wrap: wrap; gap: 6px; min-height: 32px; }

  .keyword-count {
    font-size: 12px; padding: 2px 8px; border-radius: 10px;
    background: #e3f2fd; color: #1565c0; margin-left: 6px;
    &.count-active { background: #e8f5e9; color: #2e7d32; }
    &.count-danger { background: #ffebee; color: #c62828; &.count-active { background: #fff3e0; color: #e65100; } }
  }

  .time-mode-group { margin-bottom: 10px; }
  .time-fields { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
}

/* 好友选择器 */
.friend-selector {
  position: relative;

  .selected-display {
    min-height: 40px; border: 1px solid #e5e5e5; border-radius: 8px;
    padding: 6px 12px; display: flex; flex-wrap: wrap; gap: 6px;
    cursor: pointer; transition: border-color 0.3s; background: #fff;
    &:hover { border-color: $purple; }
  }
  .placeholder-text { color: #999; line-height: 28px; }
  .friend-tag {
    background: rgba(156,39,176,0.1); color: $purple; padding: 3px 10px;
    border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 6px;
    .remove-tag { cursor: pointer; font-weight: bold; }
  }

  .friend-dropdown {
    position: absolute; top: 100%; left: 0; right: 0; background: white;
    border: 1px solid #e5e5e5; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    z-index: 1050; max-height: 300px; margin-top: 4px;
  }
  .friend-search {
    padding: 10px; border-bottom: 1px solid #e5e5e5; position: sticky; top: 0; background: white; z-index: 10;
    .friend-search-stats {
      font-size: 12px; color: #888; margin-top: 6px;
      strong { color: $purple; font-weight: 600; }
    }
  }
  .friend-list { max-height: 240px; overflow-y: auto; padding: 4px 0; }
  .friend-item {
    padding: 10px 12px; display: flex; align-items: center; gap: 10px;
    cursor: pointer; transition: background 0.2s;
    &:hover { background: #f5f5f5; }
    &.selected { background: rgba(156,39,176,0.05); }
  }
  .friend-avatar {
    width: 32px; height: 32px; border-radius: 6px; background: #e0e0e0;
    display: flex; align-items: center; justify-content: center; color: #888; overflow: hidden;
    img { width: 100%; height: 100%; object-fit: cover; }
  }
  .friend-info { flex: 1; }
  .friend-name { font-size: 14px; color: #333; }
  .friend-wxid { font-size: 11px; color: #999; }
  .check-icon { color: $purple; font-size: 16px; }
  .no-friends { text-align: center; padding: 20px; color: #999; font-size: 13px; }
}

/* 日志弹窗 */
.logs-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;
  .stat-card {
    background: #f8f9fa; border-radius: 8px; padding: 12px; text-align: center;
    .stat-label { font-size: 12px; color: #888; margin-bottom: 4px; }
    .stat-value { font-size: 24px; font-weight: 700; }
  }
}
.logs-pagination {
  display: flex; justify-content: space-between; align-items: center; margin-top: 12px;
  .logs-total { font-size: 13px; color: #888; }
}

/* 响应式 */
@media (max-width: 768px) {
  .plugin-header { padding: 16px; border-radius: 10px; h2 { font-size: 1.15rem; } p { font-size: 12px; } }
  .task-main { flex-direction: column; }
  .task-actions { width: 100%; padding-top: 10px; border-top: 1px solid #f0f0f0; }
  .task-form .form-row { flex-direction: column; gap: 0; }
  .logs-stats { grid-template-columns: repeat(2, 1fr); }
  .header-content { flex-direction: column; gap: 12px; }
}
</style>
