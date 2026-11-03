<template>
  <div class="ai-search-page">
    <!-- 搜索Hero -->
    <section class="search-hero">
      <div class="container">
        <div class="text-center">
          <h1><i class="fas fa-magic me-2"></i>AI Property Search</h1>
          <p class="hero-desc">Describe your ideal home in natural language, and our AI will find the best matches for you</p>
        </div>

        <div class="search-container">
          <div class="search-input-wrapper">
            <i class="fas fa-search search-icon"></i>
            <input
              v-model="query"
              type="text"
              class="search-input"
              placeholder="Try: &quot;2BR apartment near Jing'an Temple, under 10000 RMB, with balcony&quot;"
              @keyup.enter="doSearch"
            />
            <button class="search-btn" :disabled="searching || !query.trim()" @click="doSearch">
              <i v-if="searching" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-arrow-right"></i>
            </button>
          </div>
          <div class="search-tips">
            <span class="tip-label">Popular searches:</span>
            <button v-for="tip in quickTips" :key="tip" class="tip-btn" @click="query = tip; doSearch()">{{ tip }}</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 搜索结果 -->
    <section v-if="results.length > 0 || searched" class="results-section">
      <div class="container">
        <div class="results-header">
          <h3 v-if="results.length > 0"><i class="fas fa-list-ul me-2"></i>{{ results.length }} Properties Found</h3>
          <h3 v-else>No Results</h3>
        </div>

        <div v-if="aiSummary" class="ai-summary">
          <div class="summary-icon"><i class="fas fa-robot"></i></div>
          <div class="summary-text">{{ aiSummary }}</div>
        </div>

        <div class="row g-3">
          <div v-for="item in results" :key="item.id" class="col-md-6 col-lg-4">
            <a :href="'/properties/' + item.id" class="result-card" target="_blank">
              <div class="result-image">
                <img :src="item.image || '/assets/images/default-property.svg'" :alt="item.title" @error="$event.target.src='/assets/images/default-property.svg'" loading="lazy" />
                <span v-if="item.match_score" class="match-badge">{{ item.match_score }}% Match</span>
              </div>
              <div class="result-content">
                <h4>{{ item.title }}</h4>
                <div class="result-meta">
                  <span v-if="item.price"><i class="fas fa-yen-sign"></i> {{ item.price }}/mo</span>
                  <span v-if="item.bedrooms"><i class="fas fa-bed"></i> {{ item.bedrooms }}BR</span>
                  <span v-if="item.district"><i class="fas fa-map-marker-alt"></i> {{ item.district }}</span>
                </div>
                <p v-if="item.ai_reason" class="result-reason">{{ item.ai_reason }}</p>
              </div>
            </a>
          </div>
        </div>

        <div v-if="searched && results.length === 0" class="empty-result text-center">
          <i class="fas fa-search"></i>
          <h4>No matching properties found</h4>
          <p>Try adjusting your description or use different keywords</p>
        </div>
      </div>
    </section>

    <!-- 搜索历史 -->
    <section v-if="history.length > 0 && !searched" class="history-section">
      <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h3 class="history-title"><i class="fas fa-history me-2"></i>Search History</h3>
          <button class="clear-btn" @click="clearHistory">Clear All</button>
        </div>
        <div class="history-list">
          <button v-for="(h, i) in history" :key="i" class="history-item" @click="query = h.query; doSearch()">
            <i class="fas fa-clock"></i>
            <span>{{ h.query }}</span>
            <span class="history-time">{{ h.time }}</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const query = ref('')
const results = ref([])
const aiSummary = ref('')
const searching = ref(false)
const searched = ref(false)
const history = ref([])

const quickTips = [
  '2BR near Jing\'an, under 10K',
  'Pet-friendly apartment in Pudong',
  'Family home near international school',
  'Studio near Line 2 metro',
]

onMounted(() => loadHistory())

async function loadHistory() {
  try {
    const res = await api.get('/user/ai-property-search/history')
    history.value = res.data?.data || []
  } catch { /* 未登录或无历史 */ }
}

async function doSearch() {
  if (!query.value.trim() || searching.value) return
  searching.value = true
  searched.value = true
  results.value = []
  aiSummary.value = ''
  try {
    const res = await api.post('/user/ai-property-search/search', { query: query.value })
    results.value = res.data?.results || []
    aiSummary.value = res.data?.ai_summary || ''
    loadHistory()
  } catch { /* 错误由拦截器处理 */ }
  searching.value = false
}

function clearHistory() {
  history.value = []
}
</script>

<style scoped>
.search-hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60px 20px 50px;
}
.search-hero h1 { color: white; font-size: 32px; font-weight: 700; margin-bottom: 10px; }
.hero-desc { color: rgba(255,255,255,0.9); font-size: 16px; margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto; }

.search-container { max-width: 720px; margin: 0 auto; }
.search-input-wrapper {
  display: flex; align-items: center; background: white; border-radius: 14px;
  padding: 6px 6px 6px 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);
}
.search-icon { color: #94a3b8; font-size: 18px; margin-right: 12px; }
.search-input {
  flex: 1; border: none; outline: none; font-size: 15px; padding: 12px 0;
  background: transparent; color: #1e293b;
}
.search-input::placeholder { color: #94a3b8; }
.search-btn {
  width: 48px; height: 48px; border-radius: 12px; border: none;
  background: linear-gradient(135deg, #667eea, #764ba2); color: white;
  font-size: 18px; cursor: pointer; transition: all 0.3s; flex-shrink: 0;
}
.search-btn:hover:not(:disabled) { transform: scale(1.05); }
.search-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.search-tips { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.tip-label { color: rgba(255,255,255,0.7); font-size: 13px; }
.tip-btn {
  background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3);
  padding: 4px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; transition: all 0.3s;
}
.tip-btn:hover { background: rgba(255,255,255,0.25); }

.results-section { padding: 30px 20px 50px; }
.results-header h3 { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 16px; }

.ai-summary {
  display: flex; gap: 12px; align-items: flex-start; background: #f0f4ff; border-radius: 12px;
  padding: 16px; margin-bottom: 20px; border-left: 4px solid #667eea;
}
.summary-icon { color: #667eea; font-size: 20px; margin-top: 2px; }
.summary-text { font-size: 14px; color: #475569; line-height: 1.6; }

.result-card {
  display: block; background: white; border-radius: 12px; overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08); transition: all 0.3s; text-decoration: none; color: inherit;
}
.result-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
.result-image { position: relative; padding-top: 60%; background: #f1f3f5; overflow: hidden; }
.result-image img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
.match-badge {
  position: absolute; top: 10px; left: 10px; background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
}
.result-content { padding: 14px; }
.result-content h4 {
  font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 8px;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
}
.result-meta { display: flex; gap: 12px; font-size: 12px; color: #64748b; margin-bottom: 8px; }
.result-meta i { color: #667eea; margin-right: 3px; }
.result-reason { font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; }

.empty-result { padding: 40px; }
.empty-result i { font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 16px; }
.empty-result h4 { color: #64748b; font-size: 16px; margin-bottom: 8px; }
.empty-result p { color: #94a3b8; font-size: 14px; }

.history-section { padding: 30px 20px 50px; }
.history-title { font-size: 18px; font-weight: 600; color: #1e293b; margin: 0; }
.clear-btn { background: none; border: none; color: #667eea; font-size: 13px; cursor: pointer; }
.history-list { display: flex; flex-direction: column; gap: 4px; }
.history-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  background: white; border: 1px solid #f1f3f5; border-radius: 8px;
  cursor: pointer; transition: background 0.2s; text-align: left; width: 100%;
}
.history-item:hover { background: #f8f9ff; }
.history-item i { color: #94a3b8; font-size: 13px; }
.history-item span { font-size: 14px; color: #475569; flex: 1; }
.history-time { font-size: 12px; color: #94a3b8; flex: none !important; }

@media (max-width: 768px) {
  .search-hero { padding: 40px 16px 30px; }
  .search-hero h1 { font-size: 24px; }
  .hero-desc { font-size: 14px; }
  .search-tips { justify-content: center; }
}
</style>
