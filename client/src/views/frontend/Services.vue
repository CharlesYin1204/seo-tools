<template>
  <div class="container py-5">
    <div class="text-center mb-5">
      <h1 class="fw-bold">我们的服务</h1>
      <p class="text-muted fs-5">为外籍人士提供一站式租房服务</p>
    </div>

    <div class="row g-4">
      <div class="col-md-4" v-for="(service, i) in services" :key="i">
        <div class="card h-100 border-0 shadow-sm text-center p-4">
          <div class="mb-3">
            <el-icon :size="48" color="var(--primary-color)"><component :is="service.icon" /></el-icon>
          </div>
          <h4>{{ service.title }}</h4>
          <p class="text-muted">{{ service.desc }}</p>
        </div>
      </div>
    </div>

    <div class="text-center mt-5">
      <h3 class="mb-3">需要帮助？</h3>
      <p class="text-muted mb-4">我们的团队随时为您提供专业的租房咨询服务</p>
      <router-link to="/contact" class="btn btn-primary btn-lg px-5">联系我们</router-link>
    </div>
  </div>
</template>

<script setup>
import { House, Search, ChatDotRound, Position, Service, Key } from '@element-plus/icons-vue'

const services = [
  { icon: Search, title: '智能找房', desc: '基于AI的智能搜索引擎，根据您的需求精准匹配房源，节省您的时间和精力。' },
  { icon: House, title: '房源管理', desc: '完善的房源信息管理系统，真实房源照片和详细信息，确保所见即所得。' },
  { icon: ChatDotRound, title: '在线咨询', desc: '专业顾问在线解答您的各类租房问题，提供个性化的租房方案建议。' },
  { icon: Position, title: '地图找房', desc: '可视化地图搜索，快速定位周边生活配套设施，找到最适合您的居住地段。' },
  { icon: Service, title: '预约看房', desc: '便捷的在线预约系统，灵活安排看房时间，专人全程陪同看房。' },
  { icon: Key, title: '签约入住', desc: '标准化的合同模板和签约流程，保障租客和房东双方的合法权益。' },
]
</script>

<style scoped>
.card { transition: transform 0.3s ease; }
.card:hover { transform: translateY(-6px); }
</style>
