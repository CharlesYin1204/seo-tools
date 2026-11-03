<template>
  <div class="container py-4">
    <el-skeleton v-if="loading" :rows="8" animated />
    <template v-else-if="property">
      <div class="card-container">
        <h4 class="fw-bold mb-2">{{ property.community || '房源分享' }}</h4>
        <el-tag type="danger" size="large" class="mb-3">¥{{ property.price || '--' }}/月</el-tag>
        <div class="row mb-3">
          <div class="col-auto"><strong>区域:</strong> {{ property.district }}</div>
          <div class="col-auto"><strong>卧室:</strong> {{ property.bedrooms }}室</div>
          <div class="col-auto"><strong>洗手间:</strong> {{ property.bathrooms || 1 }}卫</div>
        </div>
        <el-divider />
        <h6 class="fw-bold">朋友圈原文</h6>
        <p class="text-secondary" style="white-space: pre-wrap;">{{ property.moment_content }}</p>
      </div>
    </template>
    <div v-else class="empty-state"><div class="empty-text">房源不存在或已删除</div></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api'

const route = useRoute()
const property = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api.get(`/share/expat-property/${route.params.token}`)
    property.value = res.data
  } catch {}
  loading.value = false
})
</script>
