<template>
  <div>
    <div class="page-header"><h3 class="page-title">房东仪表盘</h3></div>

    <div class="row g-4 mb-4">
      <div class="col-md-4">
        <el-card shadow="hover"><el-statistic title="我的房源" :value="stats.properties || 0" /></el-card>
      </div>
      <div class="col-md-4">
        <el-card shadow="hover"><el-statistic title="已出租" :value="stats.rented || 0" /></el-card>
      </div>
      <div class="col-md-4">
        <el-card shadow="hover"><el-statistic title="待处理预约" :value="stats.pending_appointments || 0" /></el-card>
      </div>
    </div>

    <el-card>
      <template #header><span>最近房源</span></template>
      <el-table :data="recentProperties" stripe>
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="price" label="价格" width="120">
          <template #default="{row}">¥{{ row.price }}/月</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === 'published' ? 'success' : 'warning'">{{ row.status === 'published' ? '出租中' : '草稿' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const stats = ref({})
const recentProperties = ref([])

onMounted(() => loadDashboard())

async function loadDashboard() {
  try {
    const res = await api.get('/landlord/dashboard')
    stats.value = res.data?.stats || {}
    recentProperties.value = res.data?.recent_properties || []
  } catch {}
}
</script>
