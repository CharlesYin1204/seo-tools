<template>
  <div class="share-history-page">
    <!-- 页面头部 - 绿色渐变（与PHP版一致） -->
    <div class="page-header-green">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h2><i class="fas fa-history me-2"></i>发送记录</h2>
          <p class="mb-0 opacity-90">查看已发送给好友的内容资产链接历史记录</p>
        </div>
        <router-link to="/user/all-properties" class="btn-back-link">
          <i class="fas fa-arrow-left me-1"></i>返回所有内容资产
        </router-link>
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-card">
      <div class="row g-3">
        <div class="col-md-3 col-6">
          <label class="form-label">发送状态</label>
          <el-select v-model="filters.status" placeholder="全部状态" clearable size="default" class="w-100" @change="loadData(1)">
            <el-option label="全部状态" value="" />
            <el-option label="发送成功" value="success" />
            <el-option label="发送失败" value="failed" />
          </el-select>
        </div>
        <div class="col-md-3 col-6">
          <label class="form-label">开始日期</label>
          <el-date-picker v-model="filters.date_from" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" class="w-100" />
        </div>
        <div class="col-md-3 col-6">
          <label class="form-label">结束日期</label>
          <el-date-picker v-model="filters.date_to" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" class="w-100" />
        </div>
        <div class="col-md-3 col-6">
          <label class="form-label">搜索</label>
          <div class="d-flex gap-1">
            <el-input v-model="filters.keyword" placeholder="搜索好友/内容资产编号" clearable @keyup.enter="loadData(1)" />
            <el-button type="success" @click="loadData(1)" class="btn-green">
              <i class="fas fa-search"></i>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 记录列表 -->
    <div class="history-card">
      <div v-if="loading" class="text-center py-5 text-muted">
        <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
        <p>加载中...</p>
      </div>

      <div v-else-if="list.length === 0" class="empty-state">
        <i class="fas fa-inbox fa-3x mb-3"></i>
        <p>暂无发送记录</p>
      </div>

      <div v-else class="table-responsive">
        <table class="table table-hover align-middle history-table">
          <thead>
            <tr>
              <th width="80">缩略图</th>
              <th>内容资产编号</th>
              <th>接收好友</th>
              <th>发送时间</th>
              <th width="80">状态</th>
              <th width="120">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in list" :key="record.id">
              <td>
                <img v-if="record.thumb_url" :src="getProxyUrl(record.thumb_url)" class="thumb-img" @error="$event.target.style.display='none'">
                <div v-else class="thumb-placeholder"><i class="fas fa-image"></i></div>
              </td>
              <td>
                <strong>{{ record.property_code || record.id || '-' }}</strong>
                <br><small class="text-muted">{{ truncate(record.content_preview || record.property_title || record.title || '', 40) }}</small>
              </td>
              <td>
                <i class="fas fa-user text-muted me-1"></i>
                {{ record.friend_nickname || record.friend_wxid || record.target_name || record.contact_name || '-' }}
              </td>
              <td><small>{{ formatTime(record.created_at_formatted || record.created_at) }}</small></td>
              <td>
                <span :class="record.status === 'success' || record.status === 'sent' ? 'badge bg-success' : 'badge bg-danger'">
                  <i :class="record.status === 'success' || record.status === 'sent' ? 'fas fa-check me-1' : 'fas fa-times me-1'"></i>
                  {{ record.status === 'success' || record.status === 'sent' ? '成功' : '失败' }}
                </span>
              </td>
              <td>
                <a v-if="record.share_url" :href="record.share_url" target="_blank" class="btn btn-sm btn-outline-primary me-1" title="查看链接">
                  <i class="fas fa-external-link-alt"></i>
                </a>
                <button class="btn btn-sm btn-outline-secondary" @click="copyLink(record.share_url || '')" title="复制链接">
                  <i class="fas fa-copy"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页信息和分页器 -->
      <div v-if="total > 0" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
        <span class="text-muted" style="font-size: 13px">共 {{ total }} 条记录</span>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="sizes, prev, pager, next"
          @size-change="loadData(1)"
          @current-change="loadData"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filters = reactive({
  status: '',
  date_from: '',
  date_to: '',
  keyword: '',
})

function getProxyUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://wx.qlogo.cn') || url.startsWith('https://wx.qlogo.cn') ||
      url.startsWith('http://mmbiz.qpic.cn') || url.startsWith('https://mmbiz.qpic.cn')) {
    return '/user/wechat-robot/proxy-image?url=' + encodeURIComponent(url)
  }
  return url
}

function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

function formatTime(t) {
  if (!t) return '-'
  try {
    const d = new Date(t)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return t }
}

function copyLink(url) {
  if (!url) { ElMessage.warning('暂无链接'); return }
  navigator.clipboard?.writeText(url).then(() => {
    ElMessage.success('链接已复制到剪贴板')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    ElMessage.success('链接已复制到剪贴板')
  })
}

async function loadData(p) {
  if (p) page.value = p
  loading.value = true
  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
      per_page: pageSize.value,
      pageSize: pageSize.value,
    }
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to

    const res = await api.get('/user/expat/share-history', { params })
    const data = res.data?.data || res.data
    list.value = data?.items || data?.records || data?.list || (Array.isArray(data) ? data : [])
    total.value = data?.total ?? list.value.length
  } catch (err) {
    console.error('[ShareHistory] 加载失败:', err)
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { status: '', date_from: '', date_to: '', keyword: '' })
  loadData(1)
}

onMounted(() => loadData(1))
</script>

<style scoped>
.share-history-page {
  max-width: 1200px;
}

/* 绿色渐变头部 - 与PHP版一致 */
.page-header-green {
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}
.page-header-green h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 8px;
}
.page-header-green p {
  opacity: 0.9;
  margin-bottom: 0;
}
.btn-back-link {
  display: inline-flex;
  align-items: center;
  color: white;
  text-decoration: none;
  background: rgba(255,255,255,0.2);
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.3s;
}
.btn-back-link:hover {
  background: rgba(255,255,255,0.3);
  color: white;
}

/* 筛选区域 */
.filter-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.filter-card .form-label {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 6px;
  font-weight: 500;
}
.btn-green {
  background: #4CAF50 !important;
  border-color: #4CAF50 !important;
}
.btn-green:hover {
  background: #43A047 !important;
  border-color: #43A047 !important;
}

/* 记录列表卡片 */
.history-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

/* 表格样式 - 与PHP版一致 */
.history-table thead th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #dee2e6;
  font-size: 13px;
}
.history-table tbody td {
  vertical-align: middle;
  font-size: 13px;
}
.thumb-img {
  width: 60px;
  height: 45px;
  object-fit: cover;
  border-radius: 6px;
}
.thumb-placeholder {
  width: 60px;
  height: 45px;
  background: #f0f0f0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
}

/* 空状态 */
.empty-state {
  text-align: center;
  color: #999;
  padding: 60px 20px;
}
.empty-state i { opacity: 0.4; }

/* 响应式 */
@media (max-width: 767px) {
  .page-header-green { padding: 14px 16px; border-radius: 10px; margin-bottom: 12px; }
  .page-header-green h2 { font-size: 1.1rem; }
  .filter-card { padding: 12px; border-radius: 10px; margin-bottom: 12px; }
  .history-card { padding: 12px; border-radius: 10px; }
  .thumb-img { width: 50px; height: 38px; }
  .thumb-placeholder { width: 50px; height: 38px; }
  .btn-back-link { font-size: 12px; padding: 6px 10px; }
}
</style>
