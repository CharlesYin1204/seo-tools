<template>
  <div class="container py-4">
    <div class="page-header"><h3 class="page-title">房源列表</h3></div>

    <!-- 筛选栏 -->
    <div class="card-container mb-4">
      <div class="row g-3 align-items-end">
        <div class="col-md-3">
          <label class="form-label small">区域</label>
          <el-select v-model="filters.district" placeholder="选择区域" clearable class="w-100" @change="loadData">
            <el-option v-for="d in districts" :key="d" :label="d" :value="d" />
          </el-select>
        </div>
        <div class="col-md-2">
          <label class="form-label small">最低价</label>
          <el-input v-model.number="filters.priceMin" placeholder="最低价" @change="loadData" />
        </div>
        <div class="col-md-2">
          <label class="form-label small">最高价</label>
          <el-input v-model.number="filters.priceMax" placeholder="最高价" @change="loadData" />
        </div>
        <div class="col-md-2">
          <label class="form-label small">卧室</label>
          <el-select v-model="filters.bedrooms" placeholder="卧室数" clearable class="w-100" @change="loadData">
            <el-option v-for="n in [1,2,3,4,5]" :key="n" :label="`${n}室`" :value="n" />
          </el-select>
        </div>
        <div class="col-md-3">
          <el-input v-model="filters.search" placeholder="搜索关键词" clearable @keyup.enter="loadData">
            <template #append><el-button @click="loadData"><el-icon><Search /></el-icon></el-button></template>
          </el-input>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="text-center py-5"><el-skeleton :rows="5" animated /></div>
    <div v-else class="row g-4">
      <div v-for="p in list" :key="p.id" class="col-md-6 col-lg-4">
        <router-link :to="`/properties/${p.id}`" class="text-decoration-none">
          <el-card shadow="hover" :body-style="{ padding: 0 }">
            <div class="property-img" :style="{ backgroundImage: `url(${getImage(p)})` }"></div>
            <div class="p-3">
              <h6 class="fw-bold text-truncate text-dark">{{ p.title || p.community || '未命名' }}</h6>
              <p class="small text-muted mb-2">{{ p.district }} {{ p.address }}</p>
              <div class="d-flex justify-content-between">
                <span class="text-danger fw-bold">¥{{ p.price }}/月</span>
                <span class="text-muted small">{{ p.bedrooms }}室{{ p.bathrooms }}卫</span>
              </div>
            </div>
          </el-card>
        </router-link>
      </div>
    </div>
    <div v-if="!loading && list.length === 0" class="empty-state"><div class="empty-text">暂无符合条件的房源</div></div>
    <div class="d-flex justify-content-center mt-4">
      <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api'

const route = useRoute()
const list = ref([])
const loading = ref(true)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)
const districts = ref([])

const filters = reactive({
  district: '', priceMin: '', priceMax: '', bedrooms: '', search: route.query.search || '',
})

onMounted(async () => {
  try { const res = await api.get('/districts'); districts.value = (res.data || []).map(d => d.name_cn) } catch {}
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/properties/search', { params: { page: page.value, pageSize: pageSize.value, ...filters } })
    list.value = res.data || []
    total.value = res.pagination?.total || 0
  } catch {}
  loading.value = false
}

function getImage(p) {
  try { return p.images ? JSON.parse(p.images)[0] : '' } catch { return '' }
}
</script>

<style scoped>
.property-img { height: 180px; background-size: cover; background-position: center; background-color: #e0e0e0; }
</style>
