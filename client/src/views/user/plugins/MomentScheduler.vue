<template>
  <div class="scheduler-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-clock me-2"></i>朋友圈定时发布</div>
      <div class="plugin-card-body">
        <div class="schedule-layout">
          <div class="schedule-form">
            <h6>创建定时发布</h6>
            <div class="mb-3"><label class="form-label">发布内容</label><textarea v-model="form.content" class="form-control" rows="4" placeholder="输入朋友圈文案内容...&#10;支持表情和文字"></textarea></div>
            <div class="mb-3">
              <label class="form-label">配图（最多9张）</label>
              <input type="file" accept="image/*" multiple @change="onImagesChange" class="form-control" />
              <div class="image-preview-grid mt-2" v-if="form.images.length">
                <div v-for="(img, i) in form.images" :key="i" class="preview-item">
                  <img :src="img" /><button class="remove-btn" @click="form.images.splice(i,1)"><i class="fas fa-times"></i></button>
                </div>
              </div>
            </div>
            <div class="mb-3"><label class="form-label">发布时间</label><input v-model="form.scheduled_time" type="datetime-local" class="form-control" /></div>
            <div class="mb-3">
              <label class="form-label">重复设置</label>
              <select v-model="form.repeat" class="form-select">
                <option value="none">不重复</option><option value="daily">每天</option>
                <option value="weekly">每周</option><option value="monthly">每月</option>
              </select>
            </div>
            <button class="btn btn-primary w-100" @click="createSchedule" :disabled="saving">
              <i class="fas" :class="saving?'fa-spinner fa-spin':'fa-calendar-plus'"></i>
              {{ saving ? '创建中...' : '创建定时任务' }}
            </button>
          </div>
          <div class="schedule-list">
            <h6><i class="fas fa-list-alt me-1"></i>定时任务列表</h6>
            <div v-for="item in schedules" :key="item.id" class="schedule-item">
              <div class="schedule-header">
                <span class="badge" :class="item.data_json?.status==='pending'?'bg-warning':'bg-success'">
                  {{ item.data_json?.status==='pending'?'待发布':'已发布' }}
                </span>
                <span class="text-muted small">{{ item.data_json?.scheduled_time || '' }}</span>
              </div>
              <div class="schedule-content">{{ item.content?.substring(0, 100) }}</div>
              <div class="schedule-actions">
                <button v-if="item.data_json?.status==='pending'" class="btn btn-sm btn-outline-danger" @click="cancelSchedule(item.id)"><i class="fas fa-times me-1"></i>取消</button>
              </div>
            </div>
            <div v-if="!schedules.length" class="text-center text-muted py-4">暂无定时任务</div>
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
const form = reactive({ content: '', images: [], scheduled_time: '', repeat: 'none' })
const saving = ref(false)
const schedules = ref([])

const onImagesChange = (e) => {
  const files = Array.from(e.target.files).slice(0, 9 - form.images.length)
  files.forEach(f => { const r = new FileReader(); r.onload = ev => form.images.push(ev.target.result); r.readAsDataURL(f) })
}

const createSchedule = async () => {
  if (!form.content.trim()) return ElMessage.warning('请输入发布内容')
  if (!form.scheduled_time) return ElMessage.warning('请选择发布时间')
  saving.value = true
  try {
    await api.post('/user/plugin-exec/moment-scheduler/data', {
      data_type: 'schedule', title: form.content.substring(0, 60), content: form.content,
      data_json: { scheduled_time: form.scheduled_time, repeat: form.repeat, images_count: form.images.length, status: 'pending' }
    })
    ElMessage.success('定时任务已创建')
    form.content = ''; form.images = []; form.scheduled_time = ''; form.repeat = 'none'
    loadSchedules()
  } catch { ElMessage.error('创建失败') }
  saving.value = false
}

const cancelSchedule = async (id) => {
  try { await api.delete(`/user/plugin-exec/moment-scheduler/data/${id}`); ElMessage.success('已取消'); loadSchedules() } catch {}
}

const loadSchedules = async () => {
  try {
    const res = await api.get('/user/plugin-exec/moment-scheduler/data', { params: { data_type: 'schedule' } })
    schedules.value = (res.data?.data || []).map(r => { try { if (typeof r.data_json === 'string') r.data_json = JSON.parse(r.data_json) } catch {}; return r })
  } catch {}
}

onMounted(loadSchedules)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #636e72, #2d3436); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.schedule-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 768px) { .schedule-layout { grid-template-columns: 1fr; } }
h6 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.image-preview-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.preview-item { position: relative; width: 60px; height: 60px; border-radius: 4px; overflow: hidden; }
.preview-item img { width: 100%; height: 100%; object-fit: cover; }
.remove-btn { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.schedule-item { padding: 10px; border-bottom: 1px solid #f0f0f0; }
.schedule-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
.schedule-content { font-size: 13px; color: #333; }
.schedule-actions { margin-top: 6px; }
</style>
