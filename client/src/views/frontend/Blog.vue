<template>
  <div class="container py-5">
    <div class="page-header mb-4">
      <h1 class="page-title">博客资讯</h1>
      <p class="text-muted">了解最新的租房资讯和生活指南</p>
    </div>

    <div class="row mb-4">
      <div class="col-md-6">
        <el-input v-model="search" placeholder="搜索文章..." clearable @keyup.enter="loadData">
          <template #append>
            <el-button @click="loadData"><el-icon><Search /></el-icon></el-button>
          </template>
        </el-input>
      </div>
      <div class="col-md-3">
        <el-select v-model="category" placeholder="选择分类" clearable @change="loadData" style="width:100%">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </div>
    </div>

    <div v-loading="loading">
      <div class="row g-4" v-if="articles.length">
        <div class="col-md-4" v-for="article in articles" :key="article.id">
          <div class="card h-100 shadow-sm border-0">
            <img :src="article.cover || '/placeholder.jpg'" class="card-img-top" style="height:200px;object-fit:cover" :alt="article.title">
            <div class="card-body d-flex flex-column">
              <span class="badge bg-primary mb-2 align-self-start">{{ article.category_name || '未分类' }}</span>
              <h5 class="card-title">{{ article.title }}</h5>
              <p class="card-text text-muted flex-grow-1">{{ article.excerpt }}</p>
              <div class="d-flex justify-content-between align-items-center mt-3">
                <small class="text-muted">{{ article.created_at }}</small>
                <router-link :to="`/blog/${article.slug || article.id}`" class="btn btn-outline-primary btn-sm">阅读更多</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无文章" />
    </div>

    <div class="d-flex justify-content-center mt-4">
      <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { Search } from '@element-plus/icons-vue'

const articles = ref([])
const categories = ref([])
const loading = ref(false)
const search = ref('')
const category = ref('')
const page = ref(1)
const pageSize = ref(9)
const total = ref(0)

onMounted(() => { loadData(); loadCategories() })

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/blog', { params: { page: page.value, pageSize: pageSize.value, search: search.value, category: category.value } })
    articles.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch { /* handled by interceptor */ }
  loading.value = false
}

async function loadCategories() {
  try {
    const res = await api.get('/admin/article-categories')
    categories.value = res.data || []
  } catch {}
}
</script>

<style scoped>
.card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
.card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }
</style>
