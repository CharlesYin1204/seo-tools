<template>
  <div class="tenant-dashboard">
    <div class="stats-grid">
      <div v-for="card in statCards" :key="card.key" class="tenant-card stat-card">
        <div class="stat-icon"><i :class="card.icon"></i></div>
        <div><div class="stat-value">{{ dashboard.stats?.[card.key] || 0 }}</div><div class="stat-label">{{ card.label }}</div></div>
      </div>
    </div>

    <div class="content-grid mt-3">
      <section class="tenant-card">
        <div class="section-head"><h3>最近沟通</h3><router-link to="/tenant/messages">查看全部</router-link></div>
        <div v-if="dashboard.recentConversations?.length" class="list-stack">
          <div v-for="item in dashboard.recentConversations" :key="item.id" class="list-row">
            <div><strong>{{ item.property_title || item.subject || '租房咨询' }}</strong><p>{{ item.last_message || '暂无消息' }}</p></div>
            <span class="status">{{ item.status }}</span>
          </div>
        </div>
        <div v-else class="empty-state">暂无站内沟通，去房源详情页发起咨询后会显示在这里。</div>
      </section>

      <section class="tenant-card">
        <div class="section-head"><h3>看房预约</h3><router-link to="/tenant/appointments">查看全部</router-link></div>
        <div v-if="dashboard.upcomingAppointments?.length" class="list-stack">
          <div v-for="item in dashboard.upcomingAppointments" :key="item.id" class="list-row">
            <div><strong>{{ item.property_title || '房源预约' }}</strong><p>{{ formatDate(item.appointment_date) }}</p></div>
            <span class="status">{{ item.status }}</span>
          </div>
        </div>
        <div v-else class="empty-state">暂无看房预约。</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { tenantApi } from '@/api/modules/tenant'

const dashboard = ref({ stats: {}, recentConversations: [], upcomingAppointments: [] })
const statCards = computed(() => [
  { key: 'demands', label: '找房需求', icon: 'fas fa-list-check' },
  { key: 'favorites', label: '收藏房源', icon: 'fas fa-heart' },
  { key: 'conversations', label: '站内沟通', icon: 'fas fa-comments' },
  { key: 'appointments', label: '看房预约', icon: 'fas fa-calendar-check' },
  { key: 'applications', label: '租赁申请', icon: 'fas fa-file-signature' },
  { key: 'contracts', label: '合同', icon: 'fas fa-file-contract' },
  { key: 'pendingBills', label: '待处理账单', icon: 'fas fa-receipt' },
])
function formatDate(value) { return value ? new Date(value).toLocaleString('zh-CN') : '-' }
onMounted(async () => { dashboard.value = (await tenantApi.getDashboard()).data || dashboard.value })
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
.stat-card { display: flex; align-items: center; gap: 14px; }
.stat-icon { width: 42px; height: 42px; border-radius: 8px; display: grid; place-items: center; color: #0f766e; background: #ccfbf1; }
.stat-value { font-size: 24px; font-weight: 800; color: #0f172a; }
.stat-label { color: #64748b; font-size: 13px; }
.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
h3 { margin: 0; font-size: 16px; }
.section-head a { color: #0f766e; font-size: 13px; text-decoration: none; }
.list-stack { display: grid; gap: 10px; }
.list-row { display: flex; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.list-row p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
.status { color: #0f766e; font-size: 12px; white-space: nowrap; }
@media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } .content-grid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .stats-grid { grid-template-columns: 1fr; } }
</style>
