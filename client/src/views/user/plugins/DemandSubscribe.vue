<template>
  <div class="subscribe-plugin">
    <!-- 统计栏 -->
    <div class="sub-stats-bar">
      <div class="stat-item" :class="{ active: viewFilter === '' }" @click="viewFilter = ''">
        <div class="stat-num">{{ subscriptions.length }}</div>
        <div class="stat-label">全部任务</div>
      </div>
      <div class="stat-item" :class="{ active: viewFilter === 'active' }" @click="viewFilter = 'active'">
        <div class="stat-num text-success">{{ subscriptions.filter(s => s.status === 'active').length }}</div>
        <div class="stat-label">监控中</div>
      </div>
      <div class="stat-item" :class="{ active: viewFilter === 'paused' }" @click="viewFilter = 'paused'">
        <div class="stat-num text-warning">{{ subscriptions.filter(s => s.status === 'paused').length }}</div>
        <div class="stat-label">已暂停</div>
      </div>
      <div class="stat-item" :class="{ active: viewFilter === 'ended' }" @click="viewFilter = 'ended'">
        <div class="stat-num" style="color:#999">{{ subscriptions.filter(s => s.status === 'ended').length }}</div>
        <div class="stat-label">已结束</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="sub-toolbar">
      <span class="toolbar-tip"><i class="fas fa-bell me-1"></i>设置内容检索需求，系统自动匹配符合条件的内容资产并通知</span>
      <el-button type="primary" size="small" @click="openAddForm"><i class="fas fa-plus me-1"></i>新建订阅</el-button>
    </div>

    <!-- 订阅列表 -->
    <div class="sub-list">
      <div v-for="s in filteredSubs" :key="s.id" class="sub-card" :class="'border-' + s.status">
        <div class="sub-card-header">
          <div class="sub-name">
            <i class="fas fa-bell-concierge me-1"></i>{{ s.name }}
            <span class="sub-status-tag" :class="'st-' + s.status">{{ subStatusText(s.status) }}</span>
          </div>
          <div class="sub-actions">
            <el-tooltip v-if="s.status === 'active'" content="立即匹配" placement="top">
              <button class="act-btn success" @click.stop="runMatch(s)" :disabled="matching === s.id"><i class="fas fa-sync" :class="{ 'fa-spin': matching === s.id }"></i></button>
            </el-tooltip>
            <el-tooltip :content="s.status === 'active' ? '暂停' : '启动'" placement="top">
              <button class="act-btn" @click.stop="toggleStatus(s, s.status === 'active' ? 'paused' : 'active')">
                <i :class="s.status === 'active' ? 'fas fa-pause' : 'fas fa-play'"></i>
              </button>
            </el-tooltip>
            <el-tooltip content="编辑" placement="top"><button class="act-btn" @click.stop="openEditForm(s)"><i class="fas fa-edit"></i></button></el-tooltip>
            <el-tooltip content="结束" placement="top"><button class="act-btn danger" @click.stop="toggleStatus(s, 'ended')"><i class="fas fa-stop"></i></button></el-tooltip>
            <el-tooltip content="删除" placement="top"><button class="act-btn danger" @click.stop="deleteSub(s)"><i class="fas fa-trash"></i></button></el-tooltip>
          </div>
        </div>

        <div class="sub-card-body" @click="openResults(s)">
          <div class="sub-conditions">
            <span v-if="s.client_name"><i class="fas fa-user"></i> {{ s.client_name }}</span>
            <span v-if="s.budget_min || s.budget_max"><i class="fas fa-yen-sign"></i> {{ s.budget_min || '?' }}-{{ s.budget_max || '?' }}</span>
            <span v-if="s.bedrooms"><i class="fas fa-bed"></i> {{ s.bedrooms }}室</span>
            <span v-if="s.district"><i class="fas fa-map-marker-alt"></i> {{ s.district }}</span>
            <span v-if="s.metro_lines?.length"><i class="fas fa-subway"></i> {{ s.metro_lines.slice(0, 2).join('/') }}</span>
            <span v-if="s.keywords"><i class="fas fa-search"></i> {{ s.keywords }}</span>
          </div>
          <div class="sub-result-bar">
            <div class="result-stat">
              <span class="result-total">匹配 <strong>{{ s.stats?.total || 0 }}</strong> 条</span>
              <span class="result-unread" v-if="s.stats?.unread"><el-badge :value="s.stats.unread" type="danger" /> 未读</span>
              <span class="result-read">已读 {{ s.stats?.read || 0 }}</span>
            </div>
            <div class="sub-time">
              <span v-if="s.monitor_start || s.monitor_end">
                <i class="fas fa-calendar-alt"></i> {{ s.monitor_start || '不限' }} ~ {{ s.monitor_end || '不限' }}
              </span>
              <span v-if="s.last_match_time" class="match-time">上次匹配: {{ formatRelTime(s.last_match_time) }}</span>
            </div>
          </div>
          <div class="sub-notify-icons">
            <span v-if="s.notify_email" class="notify-on"><i class="fas fa-envelope"></i> 邮件</span>
            <span v-if="s.notify_sms" class="notify-on"><i class="fas fa-sms"></i> 短信</span>
            <span v-if="s.notify_wechat_official" class="notify-on"><i class="fab fa-weixin"></i> 公众号</span>
          </div>
        </div>
      </div>

      <div v-if="!filteredSubs.length" class="empty-state">
        <i class="fas fa-bell-slash"></i>
        <p>暂无订阅任务</p>
        <el-button type="primary" size="small" @click="openAddForm">创建第一个需求订阅</el-button>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal-box sub-form-modal">
        <div class="modal-header">
          <h5>{{ editingId ? '编辑订阅' : '新建需求订阅' }}</h5>
          <button class="btn-close" @click="showForm = false"></button>
        </div>
        <div class="modal-body">
          <el-tabs v-model="formTab">
            <el-tab-pane label="基本信息" name="basic">
              <div class="form-grid">
                <div class="form-item full">
                  <label class="required">订阅名称</label>
                  <el-input v-model="form.name" placeholder="如：静安区2室8000-15000" />
                </div>
                <div class="form-item">
                  <label>关联客户</label>
                  <el-select v-model="form.client_id" placeholder="选择CRM客户(可选)" clearable filterable class="w-100" @change="onClientSelect">
                    <el-option v-for="c in crmClients" :key="c.id" :label="c.name" :value="c.id" />
                  </el-select>
                </div>
                <div class="form-item">
                  <label>客户名称</label>
                  <el-input v-model="form.client_name" placeholder="或手动输入客户名" />
                </div>
                <div class="form-item">
                  <label>监控开始日期</label>
                  <el-date-picker v-model="form.monitor_start" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width:100%" />
                </div>
                <div class="form-item">
                  <label>监控截止日期</label>
                  <el-date-picker v-model="form.monitor_end" type="date" placeholder="截止日期" value-format="YYYY-MM-DD" style="width:100%" />
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="筛选条件" name="filter">
              <div class="form-grid">
                <div class="form-item">
                  <label>预算最低 (元/月)</label>
                  <el-input v-model.number="form.budget_min" placeholder="最低" type="number" />
                </div>
                <div class="form-item">
                  <label>预算最高 (元/月)</label>
                  <el-input v-model.number="form.budget_max" placeholder="最高" type="number" />
                </div>
                <div class="form-item">
                  <label>卧室数量</label>
                  <el-select v-model="form.bedrooms" placeholder="不限" clearable class="w-100">
                    <el-option v-for="n in 5" :key="n" :label="`${n}室`" :value="String(n)" />
                    <el-option label="5室+" value="6" />
                  </el-select>
                </div>
                <div class="form-item">
                  <label>意向区域</label>
                  <el-select v-model="form.district" placeholder="选择区域" clearable filterable class="w-100">
                    <el-option v-for="d in districtOptions" :key="d" :label="d" :value="d" />
                  </el-select>
                </div>
                <div class="form-item full">
                  <label>地铁线路 (可多选)</label>
                  <el-select v-model="form.metro_lines" placeholder="选择线路" multiple clearable collapse-tags :max-collapse-tags="3" class="w-100">
                    <el-option v-for="l in metroLineOptions" :key="l" :label="l" :value="l" />
                  </el-select>
                </div>
                <div class="form-item">
                  <label>内容资产类型</label>
                  <el-select v-model="form.property_type" placeholder="不限" clearable class="w-100">
                    <el-option label="公寓" value="apartment" />
                    <el-option label="别墅" value="villa" />
                    <el-option label="老洋房" value="lane_house" />
                  </el-select>
                </div>
                <div class="form-item">
                  <label>关键词</label>
                  <el-input v-model="form.keywords" placeholder="小区名/关键词" />
                </div>
                <div class="form-item check-row">
                  <el-checkbox v-model="form.has_elevator">有电梯</el-checkbox>
                  <el-checkbox v-model="form.has_parking">有车位</el-checkbox>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="通知设置" name="notify">
              <div class="notify-section">
                <p class="notify-desc">当有新内容资产匹配到订阅条件时，通过以下渠道通知您：</p>
                <div class="notify-channel">
                  <div class="channel-item">
                    <el-switch v-model="form.notify_email" />
                    <div class="channel-info"><i class="fas fa-envelope"></i><span>邮件通知</span></div>
                    <el-input v-if="form.notify_email" v-model="form.email_address" placeholder="接收邮箱" size="small" style="width:240px" />
                  </div>
                  <div class="channel-item">
                    <el-switch v-model="form.notify_sms" />
                    <div class="channel-info"><i class="fas fa-sms"></i><span>短信通知</span></div>
                    <el-input v-if="form.notify_sms" v-model="form.phone_number" placeholder="手机号" size="small" style="width:240px" />
                  </div>
                  <div class="channel-item">
                    <el-switch v-model="form.notify_wechat_official" />
                    <div class="channel-info"><i class="fab fa-weixin"></i><span>公众号通知</span></div>
                    <span v-if="form.notify_wechat_official" class="channel-tip">需先关注公众号并绑定</span>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
        <div class="modal-footer">
          <el-button @click="showForm = false">取消</el-button>
          <el-button type="primary" @click="saveSub" :loading="saving">保存订阅</el-button>
        </div>
      </div>
    </div>

    <!-- 匹配结果弹窗 -->
    <div v-if="showResults" class="modal-overlay" @click.self="showResults = false">
      <div class="modal-box sub-results-modal">
        <div class="modal-header results-header">
          <h5><i class="fas fa-chart-bar me-2"></i>{{ resultsSub?.name }} - 匹配结果</h5>
          <button class="btn-close" @click="showResults = false"></button>
        </div>
        <div class="modal-body">
          <div class="results-stats-bar">
            <div class="rs-item" :class="{ active: resultFilter === '' }" @click="resultFilter = ''">
              全部 <strong>{{ resultsSub?.stats?.total || 0 }}</strong>
            </div>
            <div class="rs-item" :class="{ active: resultFilter === 'unread' }" @click="resultFilter = 'unread'">
              <el-badge :value="resultsSub?.stats?.unread || 0" type="danger" :hidden="!resultsSub?.stats?.unread" />
              未读
            </div>
            <div class="rs-item" :class="{ active: resultFilter === 'read' }" @click="resultFilter = 'read'">
              已读 <strong>{{ resultsSub?.stats?.read || 0 }}</strong>
            </div>
          </div>
          <div class="results-list">
            <div v-for="m in filteredResults" :key="m.property_id" class="result-item" :class="{ unread: !m.is_read }">
              <div class="result-info">
                <span class="result-code">#{{ m.property_id }}</span>
                <span class="result-title">{{ m.title }}</span>
                <span class="result-price" v-if="m.price">¥{{ m.price }}</span>
                <span class="result-detail">{{ m.district }} {{ m.bedrooms ? m.bedrooms + '室' : '' }}</span>
              </div>
              <div class="result-actions">
                <span class="result-time">{{ formatRelTime(m.matched_at) }}</span>
                <el-button v-if="!m.is_read" size="small" type="primary" text @click="markRead(m)">标记已读</el-button>
                <span v-else class="read-mark"><i class="fas fa-check"></i> 已读</span>
              </div>
            </div>
            <div v-if="!filteredResults.length" class="empty-results">暂无匹配结果，请点击"立即匹配"按钮</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

defineProps({ plugin: Object })

const subscriptions = ref([])
const crmClients = ref([])
const showForm = ref(false)
const showResults = ref(false)
const saving = ref(false)
const matching = ref(null)
const editingId = ref(null)
const formTab = ref('basic')
const viewFilter = ref('')
const resultFilter = ref('')
const resultsSub = ref(null)

const districtOptions = [
  '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区',
  '浦东新区', '闵行区', '宝山区', '嘉定区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'
]
const metroLineOptions = [
  '1号线', '2号线', '3号线', '4号线', '5号线', '6号线', '7号线', '8号线',
  '9号线', '10号线', '11号线', '12号线', '13号线', '14号线', '15号线', '16号线', '17号线', '18号线'
]

const defaultForm = () => ({
  name: '', client_name: '', client_id: null,
  budget_min: null, budget_max: null, bedrooms: '', district: '',
  metro_lines: [], metro_stations: [], property_type: '',
  has_elevator: false, has_parking: false, outdoor_features: [], keywords: '',
  monitor_start: '', monitor_end: '',
  notify_email: false, notify_sms: false, notify_wechat_official: false,
  email_address: '', phone_number: '',
})
const form = reactive(defaultForm())

const subStatusText = (s) => ({ active: '监控中', paused: '已暂停', ended: '已结束' }[s] || '监控中')

const filteredSubs = computed(() => {
  if (!viewFilter.value) return subscriptions.value
  return subscriptions.value.filter(s => s.status === viewFilter.value)
})

const filteredResults = computed(() => {
  const matches = resultsSub.value?.matches || []
  if (resultFilter.value === 'unread') return matches.filter(m => !m.is_read)
  if (resultFilter.value === 'read') return matches.filter(m => m.is_read)
  return matches
})

const formatRelTime = (t) => {
  if (!t) return ''
  const diff = Date.now() - new Date(t).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return new Date(t).toLocaleDateString('zh-CN')
}

const loadSubscriptions = async () => {
  try {
    const res = await api.get('/user/plugin-exec/subscribe/list')
    subscriptions.value = res.data?.data || res.data || []
  } catch { subscriptions.value = [] }
}

const loadCrmClients = async () => {
  try {
    const res = await api.get('/user/plugin-exec/crm/clients')
    crmClients.value = res.data?.data || res.data || []
  } catch { crmClients.value = [] }
}

const onClientSelect = (clientId) => {
  if (!clientId) return
  const c = crmClients.value.find(c => c.id === clientId)
  if (c) {
    form.client_name = c.name
    if (c.demand_budget_min && !form.budget_min) form.budget_min = c.demand_budget_min
    if (c.demand_budget_max && !form.budget_max) form.budget_max = c.demand_budget_max
    if (c.demand_bedrooms && !form.bedrooms) form.bedrooms = c.demand_bedrooms
    if (c.demand_district && !form.district) form.district = c.demand_district
    if (c.demand_metro_lines?.length && !form.metro_lines.length) form.metro_lines = [...c.demand_metro_lines]
  }
}

const openAddForm = () => {
  editingId.value = null
  Object.assign(form, defaultForm())
  formTab.value = 'basic'
  showForm.value = true
}

const openEditForm = (s) => {
  editingId.value = s.id
  Object.assign(form, {
    name: s.name || '', client_name: s.client_name || '', client_id: s.client_id || null,
    budget_min: s.budget_min || null, budget_max: s.budget_max || null,
    bedrooms: s.bedrooms || '', district: s.district || '',
    metro_lines: s.metro_lines || [], metro_stations: s.metro_stations || [],
    property_type: s.property_type || '',
    has_elevator: s.has_elevator || false, has_parking: s.has_parking || false,
    outdoor_features: s.outdoor_features || [], keywords: s.keywords || '',
    monitor_start: s.monitor_start || '', monitor_end: s.monitor_end || '',
    notify_email: s.notify_email || false, notify_sms: s.notify_sms || false,
    notify_wechat_official: s.notify_wechat_official || false,
    email_address: s.email_address || '', phone_number: s.phone_number || '',
  })
  formTab.value = 'basic'
  showForm.value = true
}

const saveSub = async () => {
  if (!form.name?.trim()) return ElMessage.warning('请输入订阅名称')
  saving.value = true
  try {
    await api.post('/user/plugin-exec/subscribe/save', { ...form, id: editingId.value || undefined })
    ElMessage.success('保存成功')
    showForm.value = false
    loadSubscriptions()
  } catch (err) {
    ElMessage.error('保存失败')
  }
  saving.value = false
}

const deleteSub = async (s) => {
  try {
    await ElMessageBox.confirm(`确定删除订阅「${s.name}」？`, '确认', { type: 'warning' })
    await api.delete(`/user/plugin-exec/demand-subscribe/data/${s.id}`)
    ElMessage.success('已删除')
    loadSubscriptions()
  } catch {}
}

const toggleStatus = async (s, newStatus) => {
  try {
    await api.put(`/user/plugin-exec/subscribe/${s.id}/status`, { status: newStatus })
    ElMessage.success(subStatusText(newStatus))
    loadSubscriptions()
  } catch {}
}

const runMatch = async (s) => {
  matching.value = s.id
  try {
    const res = await api.post(`/user/plugin-exec/subscribe/${s.id}/match`)
    const data = res.data?.data || res.data || {}
    ElMessage.success(`匹配完成，找到 ${data.stats?.total || 0} 条内容资产`)
    loadSubscriptions()
  } catch {
    ElMessage.error('匹配失败')
  }
  matching.value = null
}

const openResults = (s) => {
  resultsSub.value = { ...s }
  resultFilter.value = ''
  showResults.value = true
}

const markRead = async (m) => {
  if (!resultsSub.value) return
  try {
    await api.post(`/user/plugin-exec/subscribe/${resultsSub.value.id}/read`, { property_ids: [m.property_id] })
    m.is_read = true
    if (resultsSub.value.stats) {
      resultsSub.value.stats.unread = Math.max(0, (resultsSub.value.stats.unread || 0) - 1)
      resultsSub.value.stats.read = (resultsSub.value.stats.read || 0) + 1
    }
    loadSubscriptions()
  } catch {}
}

onMounted(() => {
  loadSubscriptions()
  loadCrmClients()
})
</script>

<style scoped>
.subscribe-plugin { max-width: 100%; }

.sub-stats-bar {
  display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto;
  background: #fff; border-radius: 10px; padding: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.06);
}
.stat-item { flex: 1; min-width: 80px; text-align: center; padding: 10px 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
.stat-item:hover, .stat-item.active { background: #f0f4ff; }
.stat-item.active { box-shadow: inset 0 -2px 0 var(--primary-color, #2F80ED); }
.stat-num { font-size: 22px; font-weight: 700; }
.stat-label { font-size: 12px; color: #888; margin-top: 2px; }

.sub-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 16px; flex-wrap: wrap;
}
.toolbar-tip { font-size: 13px; color: #888; }

.sub-list { display: flex; flex-direction: column; gap: 10px; }

.sub-card {
  background: #fff; border-radius: 10px; overflow: hidden;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05); transition: all 0.2s;
  border-left: 3px solid #67C23A;
}
.sub-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.1); }
.sub-card.border-paused { border-left-color: #E6A23C; }
.sub-card.border-ended { border-left-color: #ccc; }

.sub-card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; background: #fafbfc; border-bottom: 1px solid #f0f0f0;
}
.sub-name { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.sub-status-tag { font-size: 11px; padding: 1px 8px; border-radius: 10px; font-weight: 500; }
.st-active { background: #F0F9EB; color: #67C23A; }
.st-paused { background: #FDF6EC; color: #E6A23C; }
.st-ended { background: #F4F4F5; color: #909399; }

.sub-actions { display: flex; gap: 4px; }
.act-btn {
  width: 28px; height: 28px; border: none; background: #f0f2f5; border-radius: 6px;
  cursor: pointer; color: #666; font-size: 12px; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.act-btn:hover { background: #e4e7ec; color: #409EFF; }
.act-btn.success:hover { color: #67C23A; }
.act-btn.danger:hover { color: #F56C6C; background: #FEF0F0; }
.act-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.sub-card-body { padding: 14px 16px; cursor: pointer; }
.sub-conditions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.sub-conditions span { font-size: 12px; color: #555; background: #f5f7fa; padding: 2px 8px; border-radius: 4px; }
.sub-conditions i { margin-right: 3px; color: #999; font-size: 11px; }

.sub-result-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.result-stat { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.result-total { color: #333; }
.result-unread { display: flex; align-items: center; gap: 4px; color: #F56C6C; }
.result-read { color: #999; }
.sub-time { font-size: 11px; color: #bbb; display: flex; gap: 12px; }
.match-time { color: #aaa; }

.sub-notify-icons { display: flex; gap: 10px; margin-top: 8px; }
.notify-on { font-size: 11px; color: #67C23A; display: flex; align-items: center; gap: 3px; }

.empty-state {
  text-align: center; padding: 60px 20px; color: #ccc;
  background: #fff; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}
.empty-state i { font-size: 48px; margin-bottom: 12px; display: block; }
.empty-state p { color: #999; margin-bottom: 16px; }

/* 弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding-top: 40px; overflow-y: auto; }
.modal-box { background: #fff; border-radius: 12px; width: 92%; max-height: 90vh; overflow-y: auto; }
.sub-form-modal { max-width: 680px; }
.sub-results-modal { max-width: 720px; }
.modal-header { padding: 16px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
.modal-header h5 { margin: 0; font-size: 16px; font-weight: 600; }
.modal-body { padding: 20px; }
.modal-footer { padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 8px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-item { display: flex; flex-direction: column; }
.form-item.full { grid-column: 1 / -1; }
.form-item label { font-size: 13px; color: #555; margin-bottom: 4px; font-weight: 500; }
.form-item label.required::after { content: ' *'; color: #F56C6C; }
.check-row { flex-direction: row; gap: 16px; align-items: center; padding-top: 20px; }

.notify-section { }
.notify-desc { font-size: 13px; color: #888; margin-bottom: 16px; }
.notify-channel { display: flex; flex-direction: column; gap: 14px; }
.channel-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: #fafbfc; border-radius: 8px; }
.channel-info { display: flex; align-items: center; gap: 6px; font-size: 14px; min-width: 100px; }
.channel-info i { font-size: 16px; color: #409EFF; }
.channel-tip { font-size: 12px; color: #E6A23C; }

/* 结果弹窗 */
.results-header { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border-radius: 12px 12px 0 0; }
.results-header .btn-close { filter: brightness(0) invert(1); }
.results-stats-bar { display: flex; gap: 8px; margin-bottom: 16px; }
.rs-item {
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;
  display: flex; align-items: center; gap: 6px; background: #f5f7fa; transition: all 0.2s;
}
.rs-item:hover, .rs-item.active { background: #e8edf5; color: #409EFF; }

.results-list { max-height: 50vh; overflow-y: auto; }
.result-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 12px; border-bottom: 1px solid #f5f5f5; transition: background 0.2s;
}
.result-item:hover { background: #fafbfc; }
.result-item.unread { background: #FFF9F0; border-left: 3px solid #E6A23C; }
.result-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
.result-code { color: #999; font-size: 12px; }
.result-title { font-weight: 500; }
.result-price { color: #F56C6C; font-weight: 600; }
.result-detail { color: #888; font-size: 12px; }
.result-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.result-time { font-size: 11px; color: #bbb; }
.read-mark { font-size: 12px; color: #67C23A; }
.empty-results { text-align: center; padding: 40px; color: #ccc; font-size: 13px; }

@media (max-width: 768px) {
  .sub-stats-bar { gap: 4px; padding: 8px; }
  .stat-item { padding: 8px 4px; }
  .stat-num { font-size: 18px; }
  .form-grid { grid-template-columns: 1fr; }
  .sub-form-modal, .sub-results-modal { width: 96%; }
  .modal-overlay { padding-top: 20px; }
  .sub-actions { gap: 2px; }
  .channel-item { flex-wrap: wrap; }
}

.w-100 { width: 100%; }
</style>
