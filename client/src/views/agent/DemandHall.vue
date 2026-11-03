<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">需求大厅</h3>
      <el-input v-model="keyword" placeholder="搜索需求..." clearable style="width: 260px" @keyup.enter="loadData(1)">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar mb-3 d-flex gap-2 flex-wrap">
      <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 140px" @change="loadData(1)">
        <el-option label="全部" value="" />
        <el-option label="待匹配" value="pending" />
        <el-option label="已匹配" value="matched" />
        <el-option label="已关闭" value="closed" />
      </el-select>
      <el-select v-model="filterDistrict" placeholder="区域筛选" clearable style="width: 140px" @change="loadData(1)">
        <el-option label="全部区域" value="" />
        <el-option v-for="d in districts" :key="d" :label="d" :value="d" />
      </el-select>
    </div>

    <!-- 需求卡片列表 -->
    <div v-loading="loading" class="row g-3">
      <div v-for="item in demands" :key="item.id" class="col-md-6 col-lg-4">
        <el-card shadow="hover" class="demand-card">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <el-tag :type="statusTagType(item.status)" size="small">{{ statusLabel(item.status) }}</el-tag>
            <span class="text-muted small">{{ item.created_at }}</span>
          </div>
          <div class="demand-budget mb-2">
            <i class="fas fa-yen-sign"></i>
            <strong>{{ item.budget_min || 0 }} - {{ item.budget_max || '不限' }}</strong>
            <span class="text-muted small ms-1">元/月</span>
          </div>
          <div class="demand-info">
            <div v-if="item.district" class="info-row">
              <i class="fas fa-map-marker-alt"></i><span>{{ item.district }}</span>
            </div>
            <div v-if="item.bedrooms" class="info-row">
              <i class="fas fa-bed"></i><span>{{ item.bedrooms }} 室</span>
            </div>
            <div v-if="item.description" class="info-row desc-row">
              <i class="fas fa-comment-dots"></i><span>{{ item.description }}</span>
            </div>
          </div>
          <div class="d-flex gap-2 mt-3">
            <el-button size="small" @click="viewDetail(item)">查看详情</el-button>
            <el-button size="small" type="primary" @click="contactDemand(item)">
              <el-icon class="me-1"><Phone /></el-icon>联系租客
            </el-button>
          </div>
        </el-card>
      </div>

      <div v-if="!loading && demands.length === 0" class="col-12">
        <el-empty description="暂无租客需求" :image-size="80" />
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="d-flex justify-content-center mt-4">
      <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
    </div>

    <!-- 详情对话框 -->
    <el-dialog v-model="showDetail" title="需求详情" width="560px" destroy-on-close>
      <div v-if="currentDemand">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentDemand.status)" size="small">{{ statusLabel(currentDemand.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="发布时间">{{ currentDemand.created_at }}</el-descriptions-item>
          <el-descriptions-item label="预算范围">¥{{ currentDemand.budget_min || 0 }} - ¥{{ currentDemand.budget_max || '不限' }}/月</el-descriptions-item>
          <el-descriptions-item label="期望区域">{{ currentDemand.district || '不限' }}</el-descriptions-item>
          <el-descriptions-item label="户型">{{ currentDemand.bedrooms ? currentDemand.bedrooms + '室' : '不限' }}</el-descriptions-item>
          <el-descriptions-item label="入住时间">{{ currentDemand.move_in_date || '待定' }}</el-descriptions-item>
          <el-descriptions-item label="联系人" :span="2">{{ currentDemand.contact_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="需求描述" :span="2">{{ currentDemand.description || '无' }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
        <el-button type="primary" @click="contactDemand(currentDemand)">联系租客</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { Search, Phone } from '@element-plus/icons-vue'

const demands = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)
const keyword = ref('')
const filterStatus = ref('')
const filterDistrict = ref('')
const districts = ref(['浦东', '静安', '徐汇', '长宁', '黄浦', '虹口', '杨浦', '闵行', '普陀', '宝山'])

const showDetail = ref(false)
const currentDemand = ref(null)

const statusMap = { pending: '待匹配', matched: '已匹配', closed: '已关闭' }
const statusLabel = (s) => statusMap[s] || s || '待匹配'
const statusTagType = (s) => ({ pending: 'warning', matched: 'success', closed: 'info' }[s] || 'warning')

onMounted(() => loadData())

async function loadData(pg) {
  if (pg) page.value = pg
  loading.value = true
  try {
    const res = await api.get('/agent/demand-hall', {
      params: { page: page.value, pageSize: pageSize.value, keyword: keyword.value, status: filterStatus.value, district: filterDistrict.value }
    })
    demands.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch { /* 错误由拦截器处理 */ }
  loading.value = false
}

async function viewDetail(item) {
  try {
    const res = await api.get(`/agent/demand-hall/${item.id}`)
    currentDemand.value = res.data || item
  } catch {
    currentDemand.value = item
  }
  showDetail.value = true
}

async function contactDemand(item) {
  if (!item) return
  try {
    await api.post(`/agent/demand-hall/${item.id}/contact`)
    ElMessage.success('联系请求已发送，请等待租客确认')
  } catch { /* 错误由拦截器处理 */ }
}
</script>

<style scoped>
.demand-card { transition: transform 0.3s ease; }
.demand-card:hover { transform: translateY(-3px); }
.demand-budget { font-size: 18px; color: #e74c3c; }
.demand-budget i { margin-right: 4px; font-size: 14px; }
.demand-info { display: flex; flex-direction: column; gap: 6px; }
.info-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #666; }
.info-row i { color: var(--primary-color, #2F80ED); margin-top: 3px; width: 14px; text-align: center; }
.desc-row span {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; line-height: 1.4;
}
</style>
