<template>
  <div class="ai-desc-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-robot me-2"></i>AI智能内容资产描述</div>
      <div class="plugin-card-body">
        <div class="desc-layout">
          <div class="desc-input-section">
            <div class="mb-3">
              <label class="form-label fw-bold">内容资产基本信息</label>
              <textarea v-model="form.property_info" class="form-control" rows="5"
                placeholder="请输入内容资产信息，例如：&#10;小区：碧云花园&#10;面积：120平米，3室2厅2卫&#10;楼层：12/28层&#10;装修：精装修，全配家电&#10;位置：浦东新区金桥路888号&#10;交通：地铁9号线金桥站步行5分钟"></textarea>
            </div>
            <div class="row mb-3">
              <div class="col-6">
                <label class="form-label">语言</label>
                <select v-model="form.language" class="form-select">
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label">风格</label>
                <select v-model="form.style" class="form-select">
                  <option value="professional">专业正式</option>
                  <option value="casual">轻松活泼</option>
                  <option value="luxury">高端奢华</option>
                  <option value="friendly">亲切温馨</option>
                </select>
              </div>
            </div>
            <button class="btn btn-primary w-100" @click="generate" :disabled="generating">
              <i class="fas" :class="generating ? 'fa-spinner fa-spin' : 'fa-magic'"></i>
              {{ generating ? '生成中...' : 'AI智能生成描述' }}
            </button>
          </div>
          <div class="desc-output-section">
            <label class="form-label fw-bold">生成结果</label>
            <div v-if="result" class="result-box">
              <textarea v-model="result" class="form-control result-text" rows="10"></textarea>
              <div class="result-actions mt-2">
                <button class="btn btn-sm btn-success" @click="copyResult"><i class="fas fa-copy me-1"></i>复制</button>
                <span class="text-muted small ms-2">{{ result.length }}字</span>
              </div>
            </div>
            <div v-else class="empty-result"><i class="fas fa-wand-magic-sparkles"></i><p>输入内容资产信息后点击生成</p></div>
          </div>
        </div>
        <div v-if="history.length" class="history-section mt-4">
          <h6><i class="fas fa-history me-1"></i>生成历史</h6>
          <div class="history-list">
            <div v-for="item in history" :key="item.id" class="history-item" @click="loadHistory(item)">
              <div><span class="history-title">{{ item.title }}</span><span class="text-muted small ms-2">{{ formatTime(item.created_at) }}</span></div>
              <button class="btn btn-sm btn-outline-danger" @click.stop="deleteItem(item.id)"><i class="fas fa-trash"></i></button>
            </div>
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
const form = reactive({ property_info: '', language: 'zh', style: 'professional' })
const result = ref('')
const generating = ref(false)
const history = ref([])

const generate = async () => {
  if (!form.property_info.trim()) return ElMessage.warning('请输入内容资产信息')
  generating.value = true
  try {
    const res = await api.post('/user/plugin-exec/ai-description', form)
    result.value = res.data?.data?.description || ''
    ElMessage.success('描述已生成')
    loadHistoryList()
  } catch (err) {
    ElMessage.error('生成失败: ' + (err.response?.data?.message || err.message))
  }
  generating.value = false
}

const copyResult = () => {
  navigator.clipboard.writeText(result.value).then(() => ElMessage.success('已复制')).catch(() => {
    const t = document.createElement('textarea'); t.value = result.value; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); ElMessage.success('已复制')
  })
}

const loadHistoryList = async () => {
  try {
    const res = await api.get('/user/plugin-exec/ai-property-desc/data', { params: { data_type: 'generation' } })
    history.value = res.data?.data || []
  } catch {}
}

const loadHistory = (item) => { result.value = item.content || '' }
const deleteItem = async (id) => {
  try { await api.delete(`/user/plugin-exec/ai-property-desc/data/${id}`); history.value = history.value.filter(h => h.id !== id); ElMessage.success('已删除') } catch {}
}
const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : ''

onMounted(loadHistoryList)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.desc-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 768px) {
  .desc-layout { grid-template-columns: 1fr; gap: 12px; }
  .plugin-card-header { padding: 12px 14px; font-size: 14px; }
  .plugin-card-body { padding: 14px; }
  .result-text { min-height: 150px; font-size: 13px; }
}
.result-box { background: #f8f9fa; border-radius: 8px; padding: 12px; }
.result-text { resize: vertical; min-height: 200px; }
.empty-result { text-align: center; padding: 60px 20px; color: #ccc; }
.empty-result i { font-size: 48px; margin-bottom: 12px; }
.history-section h6 { font-size: 14px; }
.history-list { max-height: 200px; overflow-y: auto; }
.history-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; cursor: pointer; }
.history-item:hover { background: #f8f9fa; }
.history-title { font-size: 13px; max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
