<template>
  <div class="container py-5">
    <div v-loading="loading">
      <div v-if="agent">
        <nav aria-label="breadcrumb" class="mb-3">
          <ol class="breadcrumb">
            <li class="breadcrumb-item"><router-link to="/">首页</router-link></li>
            <li class="breadcrumb-item"><router-link to="/agents">经纪人</router-link></li>
            <li class="breadcrumb-item active">{{ agent.display_name }}</li>
          </ol>
        </nav>

        <div class="card border-0 shadow-sm mb-4">
          <div class="card-body p-4">
            <div class="d-flex align-items-center gap-4 flex-wrap">
              <el-avatar :size="100" :src="agent.avatar">{{ agent.display_name?.[0] }}</el-avatar>
              <div>
                <h2 class="mb-1">{{ agent.display_name }}</h2>
                <p class="text-muted mb-1">{{ agent.company || '独立经纪人' }}</p>
                <div class="d-flex gap-3">
                  <el-tag v-if="agent.verified" type="success">已认证</el-tag>
                  <span class="text-muted"><i class="bi bi-house"></i> {{ agent.property_count || 0 }} 套房源</span>
                  <span class="text-muted"><i class="bi bi-star"></i> {{ agent.rating || '5.0' }} 评分</span>
                </div>
              </div>
              <div class="ms-auto">
                <el-button type="primary" @click="contactAgent">联系经纪人</el-button>
              </div>
            </div>
          </div>
        </div>

        <h4 class="mb-3">在售房源</h4>
        <div class="row g-4" v-if="properties.length">
          <div class="col-md-4" v-for="prop in properties" :key="prop.id">
            <div class="card h-100 border-0 shadow-sm">
              <img :src="prop.cover || '/placeholder.jpg'" class="card-img-top" style="height:180px;object-fit:cover" :alt="prop.title">
              <div class="card-body">
                <h6>{{ prop.title }}</h6>
                <p class="text-primary fw-bold mb-1">¥{{ prop.price }}/月</p>
                <small class="text-muted">{{ prop.district }} · {{ prop.area }}㎡</small>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无房源" />
      </div>
      <el-empty v-else-if="!loading" description="经纪人不存在" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api'
import { ElMessage } from 'element-plus'

const route = useRoute()
const agent = ref(null)
const properties = ref([])
const loading = ref(false)

onMounted(() => loadAgent())

async function loadAgent() {
  loading.value = true
  try {
    const res = await api.get(`/agents/${route.params.id}`)
    agent.value = res.data?.agent || res.data
    properties.value = res.data?.properties || []
  } catch {}
  loading.value = false
}

function contactAgent() {
  ElMessage.info('联系功能开发中，请直接拨打经纪人电话')
}
</script>
