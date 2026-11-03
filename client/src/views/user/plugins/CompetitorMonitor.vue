<template>
  <div class="monitor-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-binoculars me-2"></i>竞品内容资产监控</div>
      <div class="plugin-card-body">
        <div class="monitor-layout">
          <div class="monitor-config">
            <h6>监控配置</h6>
            <div class="mb-3"><label class="form-label">监控平台</label>
              <select v-model="newMonitor.platform" class="form-select">
                <option value="58">58同城</option><option value="anjuke">安居客</option>
                <option value="lianjia">链家</option><option value="other">其他平台</option>
              </select>
            </div>
            <div class="mb-3"><label class="form-label">监控关键词/URL</label><input v-model="newMonitor.keyword" class="form-control" placeholder="输入搜索关键词或竞品页面URL" /></div>
            <div class="mb-3"><label class="form-label">监控区域</label><input v-model="newMonitor.area" class="form-control" placeholder="例：浦东新区" /></div>
            <div class="row mb-3">
              <div class="col-6"><label class="form-label">最低价格</label><input v-model.number="newMonitor.minPrice" type="number" class="form-control" placeholder="元/月" /></div>
              <div class="col-6"><label class="form-label">最高价格</label><input v-model.number="newMonitor.maxPrice" type="number" class="form-control" placeholder="元/月" /></div>
            </div>
            <div class="mb-3">
              <label class="form-label">监控频率</label>
              <select v-model="newMonitor.frequency" class="form-select">
                <option value="hourly">每小时</option><option value="daily">每天</option><option value="weekly">每周</option>
              </select>
            </div>
            <div class="mb-3"><label class="form-check"><input type="checkbox" v-model="newMonitor.notify" class="form-check-input" /> 新内容资产提醒通知</label></div>
            <button class="btn btn-primary w-100" @click="saveMonitor" :disabled="saving"><i class="fas fa-plus me-1"></i>{{ editingId ? '更新监控' : '添加监控' }}</button>
          </div>
          <div class="monitor-list">
            <h6><i class="fas fa-tasks me-1"></i>监控任务 ({{ monitors.length }})</h6>
            <div v-for="m in monitors" :key="m.id" class="monitor-item">
              <div class="monitor-head">
                <span class="badge bg-info">{{ platformName(m.data_json?.platform) }}</span>
                <span class="badge" :class="m.data_json?.active?'bg-success':'bg-secondary'">{{ m.data_json?.active?'运行中':'已暂停' }}</span>
              </div>
              <div class="monitor-info"><strong>{{ m.title }}</strong></div>
              <div class="monitor-meta text-muted small">
                区域: {{ m.data_json?.area || '不限' }} | 价格: {{ m.data_json?.minPrice || '0' }}-{{ m.data_json?.maxPrice || '不限' }}元 | {{ frequencyName(m.data_json?.frequency) }}
              </div>
              <div class="monitor-actions mt-1">
                <button class="btn btn-sm btn-outline-primary me-1" @click="toggleMonitor(m)"><i class="fas" :class="m.data_json?.active?'fa-pause':'fa-play'"></i></button>
                <button class="btn btn-sm btn-outline-danger" @click="deleteMonitor(m.id)"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            <div v-if="!monitors.length" class="text-center text-muted py-4"><i class="fas fa-binoculars" style="font-size:36px"></i><p class="mt-2">暂无监控任务，请添加</p></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })
const newMonitor = reactive({ platform: '58', keyword: '', area: '', minPrice: null, maxPrice: null, frequency: 'daily', notify: true })
const monitors = ref([])
const saving = ref(false)
const editingId = ref(null)

const platformName = (p) => ({ '58': '58同城', anjuke: '安居客', lianjia: '链家', other: '其他' }[p] || p)
const frequencyName = (f) => ({ hourly: '每小时', daily: '每天', weekly: '每周' }[f] || f)

const saveMonitor = async () => {
  if (!newMonitor.keyword.trim()) return ElMessage.warning('请输入监控关键词或URL')
  saving.value = true
  try {
    await api.post('/user/plugin-exec/competitor-monitor/data', {
      id: editingId.value || undefined, data_type: 'monitor', title: newMonitor.keyword,
      data_json: { ...newMonitor, active: true, created: new Date().toISOString() }
    })
    ElMessage.success('监控任务已保存')
    Object.assign(newMonitor, { keyword: '', area: '', minPrice: null, maxPrice: null })
    editingId.value = null; loadMonitors()
  } catch { ElMessage.error('保存失败') }
  saving.value = false
}

const toggleMonitor = async (m) => {
  const d = m.data_json || {}; d.active = !d.active
  try {
    await api.post('/user/plugin-exec/competitor-monitor/data', { id: m.id, data_type: 'monitor', title: m.title, data_json: d })
    ElMessage.success(d.active ? '已启动' : '已暂停'); loadMonitors()
  } catch {}
}

const deleteMonitor = async (id) => {
  try { await api.delete(`/user/plugin-exec/competitor-monitor/data/${id}`); ElMessage.success('已删除'); loadMonitors() } catch {}
}

const loadMonitors = async () => {
  try {
    const res = await api.get('/user/plugin-exec/competitor-monitor/data', { params: { data_type: 'monitor' } })
    monitors.value = (res.data?.data || []).map(r => { try { if (typeof r.data_json === 'string') r.data_json = JSON.parse(r.data_json) } catch {}; return r })
  } catch {}
}

onMounted(loadMonitors)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #d63031, #e17055); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.monitor-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 768px) { .monitor-layout { grid-template-columns: 1fr; } }
h6 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.monitor-item { background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.monitor-head { display: flex; gap: 6px; margin-bottom: 6px; }
.monitor-info { font-size: 14px; }
.monitor-meta { margin-top: 4px; }
</style>
