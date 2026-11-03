<template>
  <div class="quick-search-page">
    <teleport to="body">
      <div v-if="featureBlocked" class="fb-mask">
        <div class="fb-modal">
          <div class="fb-icon"><i class="fas fa-lock"></i></div>
          <h3 class="fb-title">功能未开通</h3>
          <p class="fb-desc">
            您尚未购买“快速内容检索”功能模块，
            <br>
            开通后即可使用搜索内容检索、需求管理等全部功能。
          </p>
          <button class="fb-btn fb-btn-primary" @click="$router.push('/user/membership')">
            <i class="fas fa-crown"></i> 前往购买会员
          </button>
          <button class="fb-btn fb-btn-secondary" @click="$router.push('/user/dashboard')">返回首页</button>
        </div>
      </div>
    </teleport>

    <div class="page-header">
      <h3 class="page-title">
        <i class="fas fa-search me-2"></i>搜索内容检索
      </h3>
    </div>

    <div class="card-container">
      <el-form :model="searchForm" label-width="100px" class="search-form">
        <div class="row g-3">
          <div class="col-12 col-md-6 col-lg-3">
            <el-form-item label="关键词">
              <el-input
                v-model="searchForm.keyword"
                placeholder="小区名、地段等"
                clearable
                @keyup.enter="handleSearch"
              >
                <template #prefix>
                  <i class="fas fa-keyboard"></i>
                </template>
              </el-input>
            </el-form-item>
          </div>

          <div class="col-12 col-md-6 col-lg-3">
            <el-form-item label="区域">
              <el-select
                v-model="searchForm.district"
                placeholder="选择区域"
                clearable
                class="w-100"
              >
                <el-option v-for="d in districts" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
          </div>

          <div class="col-12 col-md-6 col-lg-2">
            <el-form-item label="最低价">
              <el-input-number
                v-model="searchForm.priceMin"
                :min="0"
                :max="999999"
                placeholder="最低"
                controls-position="right"
                class="w-100"
              />
            </el-form-item>
          </div>

          <div class="col-12 col-md-6 col-lg-2">
            <el-form-item label="最高价">
              <el-input-number
                v-model="searchForm.priceMax"
                :min="0"
                :max="999999"
                placeholder="最高"
                controls-position="right"
                class="w-100"
              />
            </el-form-item>
          </div>

          <div class="col-12 col-md-6 col-lg-2">
            <el-form-item label="户型">
              <el-select
                v-model="searchForm.rooms"
                placeholder="室数"
                clearable
                class="w-100"
              >
                <el-option v-for="n in [1, 2, 3, 4, 5]" :key="n" :label="`${n}室`" :value="n" />
              </el-select>
            </el-form-item>
          </div>

          <div class="col-12 col-md-6 col-lg-2">
            <el-form-item label="面积">
              <el-select
                v-model="searchForm.area"
                placeholder="面积"
                clearable
                class="w-100"
              >
                <el-option
                  v-for="a in areaOptions"
                  :key="a.value"
                  :label="a.label"
                  :value="a.value"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="col-12 col-lg-4">
            <el-form-item label="发布时间">
              <div class="publish-time-range">
                <el-date-picker
                  v-model="searchForm.publishTimeStart"
                  type="date"
                  placeholder="开始日期"
                  value-format="YYYY-MM-DD"
                  class="w-100"
                />
                <span class="publish-time-separator">-</span>
                <el-date-picker
                  v-model="searchForm.publishTimeEnd"
                  type="date"
                  placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                  class="w-100"
                />
              </div>
            </el-form-item>
          </div>
        </div>

        <div class="form-actions">
          <el-button type="primary" :loading="searching" @click="handleSearch">
            <i class="fas fa-search me-1"></i>搜索
          </el-button>
          <el-button :loading="saving" @click="handleSaveSearch">
            <i class="fas fa-save me-1"></i>保存内容检索需求
          </el-button>
        </div>
      </el-form>
    </div>

    <div class="card-container results-section">
      <div v-loading="searching" class="results-content">
        <div v-if="errorMsg" class="error-message">
          <i class="fas fa-exclamation-circle me-2"></i>
          {{ errorMsg }}
        </div>

        <div v-else-if="results.length" class="row g-4">
          <div
            v-for="item in results"
            :key="item.id"
            class="col-12 col-md-6 col-lg-4"
          >
            <router-link :to="`/properties/${item.id}`" class="property-card-link">
              <el-card shadow="hover" class="property-card" :body-style="{ padding: 0 }">
                <div
                  class="property-cover"
                  :style="{ backgroundImage: `url(${getPropertyImage(item)})` }"
                >
                  <el-tag v-if="item.property_type" class="property-tag" size="small">
                    {{ item.property_type }}
                  </el-tag>
                </div>

                <div class="property-info">
                  <h5 class="property-title" :title="item.title">
                    {{ item.title || item.community || '未命名内容资产' }}
                  </h5>
                  <p class="property-location">
                    <i class="fas fa-map-marker-alt me-1"></i>
                    {{ item.district }} {{ item.address || '' }}
                  </p>
                  <div class="property-footer">
                    <span class="property-price">
                      {{ item.price ? `¥${item.price}` : '价格面议' }}
                      <small>/月</small>
                    </span>
                    <span class="property-meta">
                      {{ item.bedrooms || '-' }}室 {{ item.bathrooms || '-' }}卫
                    </span>
                  </div>
                </div>
              </el-card>
            </router-link>
          </div>
        </div>

        <el-empty
          v-else
          description="暂无内容资产，请调整搜索条件或保存内容检索需求"
          :image-size="80"
        />

        <div v-if="total > pageSize && results.length" class="pagination-wrap mt-3">
          <el-pagination
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next"
            @current-change="handleSearch"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const isAdminView = route.path.startsWith('/admin')
const featureBlocked = ref(false)

const districts = ref([])
const results = ref([])
const searching = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

const searchForm = reactive({
  keyword: '',
  district: '',
  priceMin: null,
  priceMax: null,
  rooms: null,
  area: '',
  publishTimeStart: '',
  publishTimeEnd: '',
})

const areaOptions = [
  { label: '50㎡以下', value: '0-50' },
  { label: '50-80㎡', value: '50-80' },
  { label: '80-120㎡', value: '80-120' },
  { label: '120-150㎡', value: '120-150' },
  { label: '150㎡以上', value: '150-' },
]

function getPropertyImage(item) {
  try {
    if (item.images && typeof item.images === 'string') {
      const arr = JSON.parse(item.images)
      return arr?.[0] || '/placeholder.jpg'
    }
    return item.cover || item.image || '/placeholder.jpg'
  } catch {
    return '/placeholder.jpg'
  }
}

async function loadDistricts() {
  try {
    const res = await api.get('/districts')
    districts.value = (res.data || []).map((d) => d.name_cn || d)
  } catch {
    districts.value = []
  }
}

async function handleSearch() {
  searching.value = true
  errorMsg.value = ''
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      search: searchForm.keyword,
      district: searchForm.district,
      priceMin: searchForm.priceMin,
      priceMax: searchForm.priceMax,
      bedrooms: searchForm.rooms,
      area: searchForm.area,
    }

    if (searchForm.publishTimeStart) params.publish_time_start = searchForm.publishTimeStart
    if (searchForm.publishTimeEnd) params.publish_time_end = searchForm.publishTimeEnd

    const res = await api.get('/properties/search', { params })
    results.value = res.data || []
    total.value = res.pagination?.total ?? 0
  } catch (e) {
    errorMsg.value = e?.message || '搜索失败，请稍后重试'
    results.value = []
    total.value = 0
  } finally {
    searching.value = false
  }
}

async function handleSaveSearch() {
  saving.value = true
  try {
    await api.post('/user/expat/search-lists', {
      keyword: searchForm.keyword,
      district: searchForm.district,
      price_min: searchForm.priceMin,
      price_max: searchForm.priceMax,
      rooms: searchForm.rooms,
      area: searchForm.area,
      publish_time_start: searchForm.publishTimeStart || '',
      publish_time_end: searchForm.publishTimeEnd || '',
    })
    ElMessage.success('已保存内容检索需求')
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!isAdminView) {
    try {
      const checkRes = await api.get('/user/feature-modules/check/quick-search')
      const access = checkRes.data
      if (access && access.allowed === false) {
        featureBlocked.value = true
        return
      }
    } catch (e) {
      if (e.response?.status === 403) {
        featureBlocked.value = true
        return
      }
    }
  }

  await loadDistricts()
  await handleSearch()
})
</script>

<style scoped lang="scss">
.quick-search-page {
  padding: 0;
}

.search-form {
  .form-actions {
    margin-top: var(--space-md);
    padding-top: var(--space-md);
    border-top: 1px solid var(--border-color);
  }
}

.results-section {
  min-height: 200px;
}

.results-content {
  min-height: 150px;
}

.error-message {
  color: var(--danger-color);
  padding: var(--space-md);
  background: #ffebee;
  border-radius: 6px;
  display: flex;
  align-items: center;
}

.property-card-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.property-card {
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border-radius: 8px;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}

.property-cover {
  height: 180px;
  background-size: cover;
  background-position: center;
  background-color: var(--background-light);
  position: relative;
}

.property-tag {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
}

.property-info {
  padding: var(--space-md);
}

.property-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property-location {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.property-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--danger-color);

  small {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-secondary);
  }
}

.property-meta {
  font-size: 13px;
  color: var(--text-muted);
}

.pagination-wrap {
  display: flex;
  justify-content: center;
}

.publish-time-range {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}

.publish-time-separator {
  flex: 0 0 auto;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .publish-time-range {
    flex-direction: column;
    align-items: stretch;
  }

  .publish-time-separator {
    display: none;
  }

  .property-footer {
    gap: 8px;
    align-items: flex-start;
    flex-direction: column;
  }
}

.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.mt-3 { margin-top: var(--space-lg); }
.w-100 { width: 100%; }
</style>
