<template>
  <div class="page-container">
    <div class="page-header"><h3 class="page-title">我的收藏</h3></div>

    <div v-loading="loading">
      <div class="row g-4" v-if="favorites.length">
        <div class="col-12 col-md-6 col-lg-4" v-for="item in favorites" :key="item.id">
          <el-card shadow="hover" class="favorite-card" :body-style="{ padding: 0 }">
            <div class="favorite-cover" :style="{ backgroundImage: `url(${item.cover || item.image || '/placeholder.jpg'})` }">
              <el-tag class="favorite-tag" size="small" v-if="item.property_type">{{ item.property_type }}</el-tag>
            </div>
            <div class="favorite-info">
              <h5 class="favorite-title" :title="item.title">{{ item.title || '未命名内容资产' }}</h5>
              <p class="favorite-address" v-if="item.address">{{ item.address }}</p>
              <div class="d-flex align-items-center justify-content-between">
                <span class="favorite-price" v-if="item.price">¥{{ item.price }}<small>/月</small></span>
                <span class="favorite-price" v-else>价格面议</span>
                <el-button type="danger" link size="small" @click="removeFavorite(item)">
                  <el-icon><Delete /></el-icon> 取消收藏
                </el-button>
              </div>
            </div>
          </el-card>
        </div>
      </div>
      <el-empty v-else description="暂无收藏" />
    </div>

    <div class="d-flex justify-content-center mt-4" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="loadFavorites"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'

const favorites = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

async function loadFavorites() {
  loading.value = true
  try {
    const res = await api.get('/user/favorites', {
      params: { page: page.value, pageSize: pageSize.value },
    })
    favorites.value = res.data?.data || res.data || []
    total.value = res.data?.total || 0
  } catch { /* 拦截器已处理 */ }
  loading.value = false
}

async function removeFavorite(item) {
  try {
    await ElMessageBox.confirm('确定取消收藏该内容资产？', '提示', { type: 'warning' })
    await api.delete(`/user/favorites/${item.id}`)
    favorites.value = favorites.value.filter((f) => f.id !== item.id)
    total.value = Math.max(0, total.value - 1)
    ElMessage.success('已取消收藏')
  } catch { /* 用户取消或拦截器已处理 */ }
}

onMounted(() => loadFavorites())
</script>

<style scoped lang="scss">
.page-container {
  padding: 20px;
}
.favorite-card {
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
}
.favorite-cover {
  height: 180px;
  background-size: cover;
  background-position: center;
  background-color: var(--background-light);
  position: relative;
}
.favorite-tag {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
}
.favorite-info {
  padding: var(--space-md);
}
.favorite-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.favorite-address {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.favorite-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--danger-color);
  small {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-secondary);
  }
}
</style>
