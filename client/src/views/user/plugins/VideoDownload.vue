<template>
  <div class="video-download-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header">
        <i :class="plugin?.slug === 'xiaohongshu-download' ? 'fas fa-camera-retro' : 'fas fa-video'" class="me-2"></i>
        {{ plugin?.slug === 'xiaohongshu-download' ? '小红书内容下载' : '微信视频号视频下载' }}
      </div>
      <div class="plugin-card-body">
        <div class="input-group mb-3">
          <input v-model="inputUrl" type="text" class="form-control"
            :placeholder="plugin?.slug === 'xiaohongshu-download' ? '粘贴小红书分享链接...' : '粘贴微信视频号分享链接...'" />
          <button class="btn btn-primary" @click="parseUrl" :disabled="parsing">
            <i class="fas" :class="parsing ? 'fa-spinner fa-spin' : 'fa-search'"></i> {{ parsing ? '解析中...' : '解析' }}
          </button>
        </div>
        <div class="tips-box mb-3">
          <i class="fas fa-lightbulb text-warning me-1"></i>
          <template v-if="plugin?.slug === 'xiaohongshu-download'">
            <span>打开小红书App → 找到笔记 → 点击"分享"按钮 → 复制链接</span>
          </template>
          <template v-else>
            <span>打开微信 → 进入视频号 → 点击视频右上角"..." → 复制链接</span>
          </template>
        </div>

        <div v-if="parseResult" class="result-section">
          <div class="result-header">
            <h5>{{ parseResult.title || '解析结果' }}</h5>
            <p v-if="parseResult.description" class="text-muted small">{{ parseResult.description }}</p>
          </div>

          <div v-if="parseResult.videos?.length" class="media-section">
            <h6><i class="fas fa-video me-1"></i>视频 ({{ parseResult.videos.length }})</h6>
            <div class="media-grid">
              <div v-for="(v, i) in parseResult.videos" :key="'v'+i" class="media-item video-item">
                <video :src="v" controls preload="metadata" class="media-preview" />
                <div class="media-actions">
                  <a :href="v" target="_blank" download class="btn btn-sm btn-success"><i class="fas fa-download me-1"></i>下载视频</a>
                  <button class="btn btn-sm btn-outline-primary" @click="copyLink(v)"><i class="fas fa-copy me-1"></i>复制链接</button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="parseResult.images?.length" class="media-section mt-3">
            <h6><i class="fas fa-images me-1"></i>图片 ({{ parseResult.images.length }})</h6>
            <div class="media-grid image-grid">
              <div v-for="(img, i) in parseResult.images" :key="'i'+i" class="media-item image-item">
                <img :src="img" class="media-preview" @error="e=>e.target.src='/images/placeholder.png'" />
                <div class="media-actions">
                  <a :href="img" target="_blank" download class="btn btn-sm btn-success"><i class="fas fa-download me-1"></i>下载</a>
                  <button class="btn btn-sm btn-outline-primary" @click="copyLink(img)"><i class="fas fa-copy"></i></button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!parseResult.videos?.length && !parseResult.images?.length" class="no-media">
            <i class="fas fa-info-circle text-warning me-1"></i>
            <span>未能直接提取媒体文件。</span>
            <p class="mt-2 small text-muted">部分平台对内容有加密保护，可尝试以下方式：</p>
            <ol class="small text-muted">
              <li>确认链接格式正确（应包含完整分享链接）</li>
              <li>在浏览器中打开链接 → 右键 → "另存为" 保存视频/图片</li>
              <li>使用浏览器开发者工具（F12）→ Network面板 → 过滤Media文件</li>
            </ol>
            <div v-if="parseResult.fallbackUrl" class="mt-2">
              <a :href="parseResult.fallbackUrl" target="_blank" class="btn btn-outline-primary btn-sm">
                <i class="fas fa-external-link-alt me-1"></i>在浏览器中打开原链接
              </a>
            </div>
          </div>
        </div>

        <div v-if="history.length" class="history-section mt-4">
          <h6><i class="fas fa-history me-1"></i>解析历史</h6>
          <div class="history-list">
            <div v-for="item in history" :key="item.id" class="history-item">
              <div class="history-info">
                <span class="history-title">{{ item.title || '未知标题' }}</span>
                <span class="history-time text-muted">{{ formatTime(item.created_at) }}</span>
              </div>
              <button class="btn btn-sm btn-outline-danger" @click="deleteHistory(item.id)"><i class="fas fa-trash"></i></button>
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

const props = defineProps({ plugin: Object })
const inputUrl = ref('')
const parsing = ref(false)
const parseResult = ref(null)
const history = ref([])

const parseUrl = async () => {
  if (!inputUrl.value.trim()) return ElMessage.warning('请输入链接')
  parsing.value = true
  parseResult.value = null
  try {
    const platform = props.plugin?.slug === 'xiaohongshu-download' ? 'xiaohongshu' : 'wechat'
    const res = await api.post('/user/plugin-exec/parse-media', { url: inputUrl.value.trim(), platform })
    parseResult.value = res.data?.data || res.data
    await api.post(`/user/plugin-exec/${props.plugin?.slug}/data`, {
      data_type: 'history',
      title: parseResult.value?.title || inputUrl.value.substring(0, 80),
      content: inputUrl.value,
      data_json: { videos_count: parseResult.value?.videos?.length || 0, images_count: parseResult.value?.images?.length || 0 }
    })
    loadHistory()
  } catch (err) {
    ElMessage.error('解析失败: ' + (err.response?.data?.message || err.message))
  }
  parsing.value = false
}

const copyLink = (link) => {
  navigator.clipboard.writeText(link).then(() => ElMessage.success('链接已复制'))
    .catch(() => { const t = document.createElement('textarea'); t.value = link; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); ElMessage.success('链接已复制'); })
}

const loadHistory = async () => {
  try {
    const res = await api.get(`/user/plugin-exec/${props.plugin?.slug}/data`, { params: { data_type: 'history' } })
    history.value = res.data?.data || []
  } catch {}
}

const deleteHistory = async (id) => {
  try {
    await api.delete(`/user/plugin-exec/${props.plugin?.slug}/data/${id}`)
    history.value = history.value.filter(h => h.id !== id)
    ElMessage.success('已删除')
  } catch {}
}

const formatTime = (t) => { if (!t) return ''; return new Date(t).toLocaleString('zh-CN') }

onMounted(loadHistory)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #4879FF, #6C5CE7); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.input-group .form-control { height: 44px; border-radius: 6px 0 0 6px; }
.input-group .btn { border-radius: 0 6px 6px 0; padding: 0 20px; }
.tips-box { font-size: 12px; color: #888; background: #FFF9E6; padding: 8px 12px; border-radius: 6px; }
.result-section { background: #f8f9fa; border-radius: 8px; padding: 16px; }
.result-header h5 { font-size: 15px; margin-bottom: 4px; }
.media-section h6 { font-size: 14px; color: #333; margin-bottom: 10px; }
.media-grid { display: grid; gap: 12px; }
.media-grid.image-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
.media-item { background: #fff; border-radius: 6px; padding: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.media-preview { width: 100%; max-height: 300px; object-fit: contain; border-radius: 4px; }
.image-item .media-preview { height: 140px; object-fit: cover; }
.media-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.no-media { background: #fff; padding: 16px; border-radius: 6px; }
.history-section h6 { font-size: 14px; color: #333; }
.history-list { max-height: 200px; overflow-y: auto; }
.history-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #f0f0f0; }
.history-title { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px; }
.history-time { font-size: 11px; margin-left: 8px; }

@media (max-width: 767px) {
  .plugin-card-header { padding: 12px 14px; font-size: 14px; }
  .plugin-card-body { padding: 14px; }
  .input-group .form-control { height: 40px; font-size: 13px; }
  .input-group .btn { padding: 0 14px; font-size: 13px; }
  .media-grid.image-grid { grid-template-columns: repeat(2, 1fr); }
  .media-preview { max-height: 200px; }
  .image-item .media-preview { height: 100px; }
  .media-actions { gap: 4px; }
  .media-actions .btn { font-size: 11px; padding: 4px 8px; }
  .history-title { max-width: 180px; font-size: 12px; }
  .result-section { padding: 12px; }
  .result-header h5 { font-size: 14px; }
  .no-media ol { padding-left: 16px; }
}
</style>
