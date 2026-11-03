<template>
  <div class="mass-send-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-paper-plane me-2"></i>微信群发助手</div>
      <div class="plugin-card-body">
        <div class="send-layout">
          <div class="send-compose">
            <h6>编辑消息</h6>
            <div class="mb-3">
              <label class="form-label">消息类型</label>
              <div class="btn-group w-100">
                <button v-for="t in msgTypes" :key="t.value" class="btn btn-sm" :class="msgType===t.value?'btn-primary':'btn-outline-secondary'" @click="msgType=t.value">
                  <i :class="t.icon" class="me-1"></i>{{ t.label }}
                </button>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">发送对象</label>
              <select v-model="sendTarget" class="form-select">
                <option value="all">所有好友</option><option value="groups">所有群聊</option>
                <option value="tag">按标签选择</option><option value="custom">自定义选择</option>
              </select>
            </div>
            <div v-if="sendTarget==='tag'" class="mb-3">
              <label class="form-label">选择标签</label>
              <input v-model="tagFilter" class="form-control" placeholder="输入标签名称..." />
            </div>
            <div class="mb-3">
              <label class="form-label">消息内容</label>
              <textarea v-model="messageContent" class="form-control" rows="5" placeholder="输入要群发的消息内容...&#10;&#10;支持变量：&#10;{nickname} - 好友昵称&#10;{date} - 当前日期"></textarea>
            </div>
            <div v-if="msgType==='image'" class="mb-3">
              <label class="form-label">附加图片</label>
              <input type="file" accept="image/*" @change="onImageSelect" class="form-control" />
              <img v-if="attachImage" :src="attachImage" class="mt-2 img-preview-small" />
            </div>
            <div class="mb-3">
              <label class="form-label">发送时间</label>
              <div class="d-flex gap-2">
                <label class="form-check"><input type="radio" v-model="sendTime" value="now" class="form-check-input" /> 立即发送</label>
                <label class="form-check"><input type="radio" v-model="sendTime" value="later" class="form-check-input" /> 定时发送</label>
              </div>
              <input v-if="sendTime==='later'" v-model="scheduledTime" type="datetime-local" class="form-control mt-2" />
            </div>
            <button class="btn btn-primary w-100" @click="sendMessage" :disabled="sending">
              <i class="fas" :class="sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
              {{ sending ? '发送中...' : '发送消息' }}
            </button>
          </div>
          <div class="send-history">
            <h6><i class="fas fa-history me-1"></i>发送记录</h6>
            <div class="record-list">
              <div v-for="r in records" :key="r.id" class="record-item">
                <div class="record-head">
                  <span class="badge" :class="r.data_json?.status==='sent'?'bg-success':'bg-warning'">{{ r.data_json?.status==='sent'?'已发送':'待发送' }}</span>
                  <span class="text-muted small">{{ formatTime(r.created_at) }}</span>
                </div>
                <div class="record-content">{{ r.content?.substring(0, 80) }}{{ r.content?.length > 80 ? '...' : '' }}</div>
                <div class="record-meta text-muted small">目标: {{ r.data_json?.target || '-' }} | 类型: {{ r.data_json?.type || '-' }}</div>
              </div>
              <div v-if="!records.length" class="text-center text-muted py-4">暂无发送记录</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })
const msgTypes = [
  { value: 'text', label: '文本', icon: 'fas fa-font' },
  { value: 'image', label: '图文', icon: 'fas fa-image' },
  { value: 'link', label: '链接', icon: 'fas fa-link' },
]
const msgType = ref('text')
const sendTarget = ref('all')
const tagFilter = ref('')
const messageContent = ref('')
const attachImage = ref(null)
const sendTime = ref('now')
const scheduledTime = ref('')
const sending = ref(false)
const records = ref([])

const onImageSelect = (e) => {
  const f = e.target.files[0]; if (!f) return
  const r = new FileReader(); r.onload = (ev) => attachImage.value = ev.target.result; r.readAsDataURL(f)
}

const sendMessage = async () => {
  if (!messageContent.value.trim()) return ElMessage.warning('请输入消息内容')
  sending.value = true
  try {
    await api.post('/user/plugin-exec/wechat-mass-send/data', {
      data_type: 'send_record', title: messageContent.value.substring(0, 60), content: messageContent.value,
      data_json: { type: msgType.value, target: sendTarget.value, tag: tagFilter.value, scheduled: sendTime.value === 'later' ? scheduledTime.value : null, status: 'sent', sent_at: new Date().toISOString() }
    })
    ElMessage.success(sendTime.value === 'later' ? '定时任务已创建' : '消息已发送')
    messageContent.value = ''; loadRecords()
  } catch (err) { ElMessage.error('发送失败') }
  sending.value = false
}

const loadRecords = async () => {
  try {
    const res = await api.get('/user/plugin-exec/wechat-mass-send/data', { params: { data_type: 'send_record' } })
    records.value = (res.data?.data || []).map(r => {
      try { if (typeof r.data_json === 'string') r.data_json = JSON.parse(r.data_json) } catch {}
      return r
    })
  } catch {}
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : ''

onMounted(loadRecords)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #00b894, #00cec9); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.send-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 768px) { .send-layout { grid-template-columns: 1fr; } }
h6 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.img-preview-small { max-height: 100px; border-radius: 6px; }
.record-list { max-height: 500px; overflow-y: auto; }
.record-item { padding: 10px; border-bottom: 1px solid #f0f0f0; }
.record-head { display: flex; justify-content: space-between; margin-bottom: 4px; }
.record-content { font-size: 13px; color: #333; }
.record-meta { margin-top: 4px; }
</style>
