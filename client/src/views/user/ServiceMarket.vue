<template>
  <div class="page-container">
    <div class="page-header"><h3 class="page-title">服务市场</h3></div>

    <div v-loading="loading">
      <div class="row g-4" v-if="services.length">
        <div class="col-12 col-sm-6 col-lg-4" v-for="service in services" :key="service.id">
          <el-card shadow="hover" class="service-card" :body-style="{ padding: 0 }">
            <div class="service-header" :style="{ background: getGradient(service.id) }">
              <el-icon :size="36" color="#fff"><ShoppingCart /></el-icon>
            </div>
            <div class="service-body">
              <h5 class="service-name">{{ service.name }}</h5>
              <p class="service-desc">{{ service.description || '暂无描述' }}</p>
              <div class="d-flex align-items-center justify-content-between mt-auto">
                <span class="service-price">¥{{ service.price }}</span>
                <el-button
                  type="primary"
                  size="small"
                  @click="purchaseService(service)"
                  :loading="purchasing === service.id"
                >立即购买</el-button>
              </div>
            </div>
          </el-card>
        </div>
      </div>
      <el-empty v-else description="暂无可用服务" />
    </div>

    <div class="d-flex justify-content-center mt-4" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="loadServices"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ShoppingCart } from '@element-plus/icons-vue'

const services = ref([])
const loading = ref(false)
const purchasing = ref(null)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

const gradients = [
  'linear-gradient(135deg, #2F80ED, #56CCF2)',
  'linear-gradient(135deg, #27AE60, #6FCF97)',
  'linear-gradient(135deg, #F2994A, #F2C94C)',
  'linear-gradient(135deg, #EB5757, #F2994A)',
  'linear-gradient(135deg, #9B51E0, #BB6BD9)',
  'linear-gradient(135deg, #2D9CDB, #56CCF2)',
]

function getGradient(id) {
  return gradients[(id || 0) % gradients.length]
}

async function loadServices() {
  loading.value = true
  try {
    const res = await api.get('/user/service-market', {
      params: { page: page.value, pageSize: pageSize.value },
    })
    services.value = res.data?.data || res.data || []
    total.value = res.data?.total || 0
  } catch { /* 拦截器已处理 */ }
  loading.value = false
}

async function purchaseService(service) {
  try {
    await ElMessageBox.confirm(
      `确定购买「${service.name}」？价格：¥${service.price}`,
      '确认购买',
      { confirmButtonText: '确认购买', cancelButtonText: '取消', type: 'info' }
    )
    purchasing.value = service.id
    await api.post('/user/service-market/purchase', { service_id: service.id })
    ElMessage.success('购买成功')
  } catch { /* 用户取消或拦截器已处理 */ }
  purchasing.value = null
}

onMounted(() => loadServices())
</script>

<style scoped lang="scss">
.page-container {
  padding: 20px;
}
.service-card {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}
.service-header {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.service-body {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  flex: 1;
}
.service-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}
.service-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: var(--space-md);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.service-price {
  font-size: 22px;
  font-weight: 700;
  color: var(--danger-color);
}
</style>
