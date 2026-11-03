<template>
  <div class="seo-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-search-dollar me-2"></i>SEO优化工具</div>
      <div class="plugin-card-body">
        <div class="seo-layout">
          <div class="seo-input">
            <h6>页面SEO分析</h6>
            <div class="mb-3">
              <label class="form-label">输入要分析的页面URL</label>
              <div class="input-group">
                <input v-model="analyzeUrl" class="form-control" placeholder="https://example.com/your-page" />
                <button class="btn btn-primary" @click="analyze" :disabled="analyzing">
                  <i class="fas" :class="analyzing?'fa-spinner fa-spin':'fa-search'"></i> {{ analyzing ? '分析中...' : '分析' }}
                </button>
              </div>
            </div>
            <div class="quick-links mb-3">
              <span class="small text-muted me-2">快速检测：</span>
              <button class="btn btn-sm btn-outline-secondary me-1" @click="analyzeUrl=window.location.origin; analyze()">本站首页</button>
              <button class="btn btn-sm btn-outline-secondary" @click="analyzeUrl=window.location.origin+'/properties'; analyze()">内容资产页</button>
            </div>

            <div v-if="result" class="result-section">
              <div class="score-circle" :class="scoreClass">
                <span class="score-num">{{ result.score }}</span>
                <span class="score-label">SEO评分</span>
              </div>

              <div class="result-detail mt-3">
                <h6>页面信息</h6>
                <div class="info-row"><span>标题</span><strong>{{ result.title || '未设置' }}</strong></div>
                <div class="info-row"><span>描述</span><strong>{{ result.description ? result.description.substring(0, 60) + '...' : '未设置' }}</strong></div>
              </div>

              <div v-if="result.issues?.length" class="issues-section mt-3">
                <h6 class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>问题 ({{ result.issues.length }})</h6>
                <div v-for="(issue, i) in result.issues" :key="'issue'+i" class="issue-item">
                  <i class="fas fa-times-circle text-danger me-1"></i> {{ issue }}
                </div>
              </div>

              <div v-if="result.suggestions?.length" class="suggestions-section mt-3">
                <h6 class="text-warning"><i class="fas fa-lightbulb me-1"></i>优化建议 ({{ result.suggestions.length }})</h6>
                <div v-for="(sug, i) in result.suggestions" :key="'sug'+i" class="sug-item">
                  <i class="fas fa-info-circle text-warning me-1"></i> {{ sug }}
                </div>
              </div>
            </div>
          </div>

          <div class="seo-tips">
            <h6><i class="fas fa-graduation-cap me-1"></i>SEO优化指南</h6>
            <div class="tip-card" v-for="(tip, i) in seoTips" :key="i">
              <div class="tip-head" @click="tip.open = !tip.open">
                <i :class="tip.icon" class="me-2 text-primary"></i>
                <span>{{ tip.title }}</span>
                <i class="fas" :class="tip.open?'fa-chevron-up':'fa-chevron-down'" style="margin-left:auto"></i>
              </div>
              <div v-if="tip.open" class="tip-body">{{ tip.content }}</div>
            </div>

            <div v-if="historyList.length" class="history-section mt-4">
              <h6><i class="fas fa-history me-1"></i>分析历史</h6>
              <div v-for="h in historyList" :key="h.id" class="history-item">
                <span>{{ h.title }}</span><span class="badge" :class="h.data_json?.score>=80?'bg-success':h.data_json?.score>=60?'bg-warning':'bg-danger'">{{ h.data_json?.score || 0 }}分</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })
const analyzeUrl = ref('')
const analyzing = ref(false)
const result = ref(null)
const historyList = ref([])

const scoreClass = computed(() => {
  if (!result.value) return ''
  const s = result.value.score
  return s >= 80 ? 'score-good' : s >= 60 ? 'score-ok' : 'score-bad'
})

const seoTips = ref([
  { icon: 'fas fa-heading', title: '标题优化', content: '标题建议15-60个字符，包含核心关键词，每个页面标题应该唯一。放在<title>标签中。', open: false },
  { icon: 'fas fa-paragraph', title: 'Meta描述', content: '描述建议120-160字符，包含关键词和吸引点击的文案。使用<meta name="description">标签。', open: false },
  { icon: 'fas fa-image', title: '图片优化', content: '所有图片添加alt属性，使用描述性文件名，压缩图片大小，使用WebP格式。', open: false },
  { icon: 'fas fa-link', title: '内链建设', content: '合理设置页面间的内部链接，使用描述性锚文本，确保重要页面容易被访问到。', open: false },
  { icon: 'fas fa-mobile-alt', title: '移动适配', content: '确保网站在移动设备上有良好体验，使用响应式设计，设置viewport meta标签。', open: false },
  { icon: 'fas fa-tachometer-alt', title: '页面速度', content: '优化图片、CSS和JS文件大小，使用CDN，启用压缩，减少HTTP请求数。', open: false },
])

const analyze = async () => {
  if (!analyzeUrl.value.trim()) return ElMessage.warning('请输入URL')
  if (!analyzeUrl.value.startsWith('http')) analyzeUrl.value = 'https://' + analyzeUrl.value
  analyzing.value = true; result.value = null
  try {
    const res = await api.post('/user/plugin-exec/seo-analyze', { url: analyzeUrl.value })
    result.value = res.data?.data || {}
    await api.post('/user/plugin-exec/seo-optimizer/data', {
      data_type: 'analysis', title: analyzeUrl.value,
      data_json: { score: result.value.score, issues: result.value.issues?.length || 0 }
    })
    loadHistory()
  } catch (err) {
    ElMessage.error('分析失败: ' + (err.response?.data?.message || err.message))
  }
  analyzing.value = false
}

const loadHistory = async () => {
  try {
    const res = await api.get('/user/plugin-exec/seo-optimizer/data', { params: { data_type: 'analysis' } })
    historyList.value = (res.data?.data || []).slice(0, 10).map(r => { try { if (typeof r.data_json === 'string') r.data_json = JSON.parse(r.data_json) } catch {}; return r })
  } catch {}
}

onMounted(loadHistory)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #00b894, #55efc4); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.seo-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
@media (max-width: 768px) { .seo-layout { grid-template-columns: 1fr; } }
h6 { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.score-circle { width: 120px; height: 120px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto; }
.score-good { background: #d4edda; color: #155724; }
.score-ok { background: #fff3cd; color: #856404; }
.score-bad { background: #f8d7da; color: #721c24; }
.score-num { font-size: 36px; font-weight: 800; line-height: 1; }
.score-label { font-size: 12px; }
.info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; gap: 12px; }
.info-row strong { text-align: right; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.issue-item, .sug-item { padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f5f5f5; }
.tip-card { background: #f8f9fa; border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
.tip-head { padding: 10px 14px; display: flex; align-items: center; cursor: pointer; font-size: 13px; font-weight: 500; }
.tip-body { padding: 0 14px 10px; font-size: 12px; color: #666; }
.history-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
</style>
