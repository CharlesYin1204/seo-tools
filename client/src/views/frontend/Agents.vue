<template>
  <div class="container py-5">
    <div class="page-header mb-4">
      <h1 class="page-title">经纪人列表</h1>
      <p class="text-muted">寻找专业的租房经纪人为您服务</p>
    </div>

    <div class="row mb-4">
      <div class="col-md-4">
        <el-input v-model="search" placeholder="搜索经纪人..." clearable @keyup.enter="loadData" />
      </div>
    </div>

    <div v-loading="loading">
      <div class="row g-4" v-if="agents.length">
        <div class="col-md-4 col-lg-3" v-for="agent in agents" :key="agent.id">
          <div class="card h-100 border-0 shadow-sm text-center">
            <div class="card-body">
              <el-avatar :size="80" :src="agent.avatar" class="mb-3">{{ agent.display_name?.[0] || '?' }}</el-avatar>
              <h5 class="card-title mb-1">{{ agent.display_name }}</h5>
              <p class="text-muted small mb-2">{{ agent.company || '独立经纪人' }}</p>
              <div class="d-flex justify-content-center gap-3 text-muted small mb-3">
                <span><i class="bi bi-house"></i> {{ agent.property_count || 0 }}套</span>
                <span><i class="bi bi-star"></i> {{ agent.rating || '5.0' }}</span>
              </div>
              <router-link :to="`/agents/${agent.id}`" class="btn btn-outline-primary btn-sm w-100">查看详情</router-link>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无经纪人" />
    </div>

    <div class="d-flex justify-content-center mt-4">
      <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const agents = ref([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/agents', { params: { page: page.value, pageSize: pageSize.value, search: search.value } })
    agents.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}
</script>
