<template>
  <div>
    <div class="page-header"><h3 class="page-title">经纪人仪表盘</h3></div>

    <div class="row g-4 mb-4">
      <div class="col-md-3">
        <el-card shadow="hover"><el-statistic title="我的房源" :value="stats.properties || 0" /></el-card>
      </div>
      <div class="col-md-3">
        <el-card shadow="hover"><el-statistic title="我的客户" :value="stats.clients || 0" /></el-card>
      </div>
      <div class="col-md-3">
        <el-card shadow="hover"><el-statistic title="待处理预约" :value="stats.pending_appointments || 0" /></el-card>
      </div>
      <div class="col-md-3">
        <el-card shadow="hover"><el-statistic title="本月成交" :value="stats.monthly_deals || 0" /></el-card>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-6">
        <el-card>
          <template #header><span>最近预约</span></template>
          <div v-if="recentAppointments.length">
            <div v-for="apt in recentAppointments" :key="apt.id" class="d-flex justify-content-between align-items-center py-2 border-bottom">
              <div>
                <strong>{{ apt.client_name }}</strong>
                <div class="text-muted small">{{ apt.property_title }}</div>
              </div>
              <div class="text-end">
                <div class="small">{{ apt.appointment_time }}</div>
                <el-tag size="small" :type="apt.status === 'confirmed' ? 'success' : 'warning'">{{ apt.status === 'confirmed' ? '已确认' : '待确认' }}</el-tag>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无预约" :image-size="60" />
        </el-card>
      </div>
      <div class="col-md-6">
        <el-card>
          <template #header><span>快速操作</span></template>
          <div class="d-flex flex-wrap gap-3">
            <router-link to="/agent/properties" class="btn btn-outline-primary">发布房源</router-link>
            <router-link to="/agent/clients" class="btn btn-outline-primary">添加客户</router-link>
            <router-link to="/agent/appointments" class="btn btn-outline-primary">查看预约</router-link>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const stats = ref({})
const recentAppointments = ref([])

onMounted(() => loadDashboard())

async function loadDashboard() {
  try {
    const res = await api.get('/agent/dashboard')
    stats.value = res.data?.stats || {}
    recentAppointments.value = res.data?.recent_appointments || []
  } catch {}
}
</script>
